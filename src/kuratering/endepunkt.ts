/**
 * Serverendepunktene agentene når kurateringsgrenene gjennom
 * (`docs/kurateringsgrener.md`):
 *
 * - `/api/kuratering`: `POST {"handling": ..., "data": {...}}` med
 *   `Authorization: Bearer <agentnøkkel>`;
 * - `/api/kuratering-mcp`: de samme handlingene som MCP-verktøy (JSON-RPC over
 *   HTTP), for ChatGPT og andre MCP-klienter, og verktøyet `instruks` med
 *   kontrollørinstruksen. Nøkkelen står i `Authorization: Bearer`, eller i
 *   adressen (`?nokkel=`) for klienter som ikke kan sende den.
 * - `/api/kuratering-ko`: grenene uten fagtekst, for kurateringskøen. Den
 *   kaller med GitHubs OIDC-token for arbeidsflyten «Kurateringskø» på main,
 *   uten noen hemmelighet å lagre (`docs/kurateringsko.md`).
 *
 * Endepunktet kontrollerer ikke nøkkelen selv: databasen gjør det
 * (`public.kuratering_agent`, bare for tjenesterollen), sammen med rollen og
 * statusen for hver handling. Den hemmelige nøkkelen forlater aldri serveren,
 * og agentnøkkelen skrives aldri i loggen.
 */
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Greninfo } from '../kurateringsko/modell.js'
import { bearer, erAdmin, hvem, serverklient, svar, type Adminsjekk, type Githubsjekk, type Miljo } from '../server/tilgang.js'
import { AGENTHANDLINGER, AGENTHANDLINGSNAVN, KLIENT_ID } from './handlinger.js'

export const MCP_PROTOKOLL = '2025-06-18'
const MCP_PROTOKOLLER = new Set(['2024-11-05', '2025-03-26', MCP_PROTOKOLL])

/** Svaret fra databasen på én handling, eller feilen med HTTP-statusen den svarer til. */
export type Utfall = { ok: true; data: unknown } | { ok: false; status: number; kode: string; feil: string }

const STATUS_FOR_KODE: Record<string, number> = { '42501': 403, PT404: 404, PT409: 409, '22023': 400, '22P02': 400 }

export async function utforHandling(klient: SupabaseClient, nokkel: string, handling: string, data: unknown): Promise<Utfall> {
  if (!AGENTHANDLINGSNAVN.has(handling)) return { ok: false, status: 400, kode: '22023', feil: `Ukjent handling «${handling}».` }
  if (data !== undefined && (data === null || typeof data !== 'object' || Array.isArray(data))) {
    return { ok: false, status: 400, kode: '22023', feil: 'Argumentene må være et JSON-objekt.' }
  }
  const { data: svaret, error } = await klient.rpc('kuratering_agent', { nokkel, handling, data: data ?? {} })
  if (error) return feilutfall(error.code, error.message, 'Databasen svarte med en feil.')
  // En handling som må lagre utfallet av en feil (publiseringen blokkerer
  // grenen med grunnen), svarer `{ok: false, kode, feil}` i stedet for å kaste den.
  if (erAvvist(svaret)) return feilutfall(svaret.kode, svaret.feil, 'Publiseringen feilet; grenen er blokkert, og grunnen står i den.')
  return { ok: true, data: svaret }
}

const erAvvist = (svaret: unknown): svaret is { ok: false; kode?: string; feil?: string } =>
  svaret !== null && typeof svaret === 'object' && (svaret as { ok?: unknown }).ok === false

// Feilene databasen gir med en kjent kode, er skrevet for agenten; andre
// feil sier ingenting om databasen utad.
function feilutfall(kode: string | undefined, melding: string | undefined, ukjent: string): Utfall {
  const status = STATUS_FOR_KODE[kode ?? '']
  return status ? { ok: false, status, kode: kode!, feil: melding ?? ukjent } : { ok: false, status: 500, kode: kode ?? 'ukjent', feil: ukjent }
}

export interface Avhengigheter {
  klient?: SupabaseClient | null
  /** Leser kontrollørinstruksen; byttes ut i testene. */
  lesInstruks?: () => Promise<string | null>
}

/** `/api/kuratering`. */
export async function behandleKuratering(foresporsel: Request, miljo: Miljo, { klient }: Avhengigheter = {}): Promise<Response> {
  if (foresporsel.method !== 'POST') return svar(405, { feil: 'Bare POST.' })
  const nokkel = bearer(foresporsel)
  if (!nokkel) return svar(401, { feil: 'Agentnøkkelen mangler.' })
  const db = klient === undefined ? serverklient(miljo) : klient
  if (!db) return svar(500, { feil: 'Mangler oppkoblingen mot databasen.' })

  let kropp: { handling?: unknown; data?: unknown }
  try {
    kropp = (await foresporsel.json()) as typeof kropp
  } catch {
    return svar(400, { feil: 'Forespørselen må være JSON.' })
  }
  if (typeof kropp?.handling !== 'string') return svar(400, { feil: 'Handlingen mangler.' })
  const utfall = await utforHandling(db, nokkel, kropp.handling, kropp.data)
  return utfall.ok ? svar(200, utfall.data) : svar(utfall.status, { feil: utfall.feil, kode: utfall.kode })
}

/* --- MCP ------------------------------------------------------------------ */

interface Rpc {
  jsonrpc?: unknown
  id?: string | number | null
  method?: unknown
  params?: Record<string, unknown>
}

const rpcSvar = (id: Rpc['id'], result: unknown) => ({ jsonrpc: '2.0', id: id ?? null, result })
const rpcFeil = (id: Rpc['id'], code: number, message: string) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } })

/**
 * Kontrollørinstruksen og kuratorprotokollen, som er det kontrolløren
 * kontrollerer mot, er filer i repoet. De tas med i funksjonen med
 * `includeFiles` i `vercel.json`, og leses der de ligger, så verktøyet
 * `instruks` alltid gir teksten i den utlagte versjonen. Ingen kopi i koden.
 */
export const INSTRUKSFIL = 'docs/kontrollorinstruks.md'
export const PROTOKOLLFIL = 'docs/kuratorprotokoll.md'
export const INSTRUKSFILER = [INSTRUKSFIL, PROTOKOLLFIL] as const

const lesFil = (fil: string) => readFile(join(process.cwd(), fil), 'utf8').catch(() => null)

// Uten instruksen er det ingenting å gi. Mangler bare protokollen, gis
// instruksen med en beskjed om hvor protokollen står, så kontrolløren ikke
// tror den har alt.
export async function lesKontrollorinstruks(): Promise<string | null> {
  const [instruks, protokoll] = await Promise.all(INSTRUKSFILER.map(lesFil))
  if (instruks === null) return null
  return `${instruks}\n\n---\n\n${protokoll ?? `${PROTOKOLLFIL} kunne ikke leses i OUSFAR nå. Les den på main i repoet peohol/far, og si fra om feilen.`}`
}

// Bare den offentlige instruksteksten: verktøyet spør ikke databasen og tar
// ingen argumenter, så det gir ingen tilgang til noe i grenene.
const INSTRUKSVERKTOY = {
  name: 'instruks',
  description:
    'Instruksen for kontrolløren, slik den gjelder nå (docs/kontrollorinstruks.md), og kuratorprotokollen den kontrollerer mot (docs/kuratorprotokoll.md). Kontrolløren leser den før noe annet i hver kjøring, og følger den. Bare den offentlige teksten; ingen fagtekst.',
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
}

export const MCP_VERKTOY = [
  INSTRUKSVERKTOY,
  ...AGENTHANDLINGER.map((h) => ({
    name: h.navn,
    description: h.beskrivelse,
    inputSchema: h.argumenter,
    annotations: { readOnlyHint: h.leser === true, destructiveHint: false, openWorldHint: false },
  })),
]

const INSTRUKSER =
  'OUSFARs kurateringsgrener: isolerte arbeidsversjoner av fagsidene. Kontrolløren kaller verktøyet instruks før noe annet i hver kjøring, og følger instruksen det gir; en kort beskjed som «Kjør en kontrollrunde i OUSFAR» er nok. Grunnreglene: kontrolløren skriver aldri i grenen, men leser (oversikt, les, les_dokument, kommentarer), kommenterer med ankre (kommenter), lukker sine egne løste tråder (lukk_kommentar) og vurderer nøyaktig den siste revisjonen (vurder). Fagteksten er bak innloggingen: gjengi den aldri utenfor OUSFAR. Kjøringen avsluttes med en kort oversikt per gren til den som startet den, med ethvert kall som ble stoppet og feilmeldingen.'

// ChatGPT husker verktøylisten og `instructions` fra da koblingen ble lagt
// til, men henter hvert svar på nytt. Svaret på `oversikt`, som kontrolløren
// kaller først, har derfor instruksen med, foran svaret fra databasen.
export const INSTRUKSINNLEDNING = 'Instruksen for kontrolløren (docs/kontrollorinstruks.md), med kuratorprotokollen (docs/kuratorprotokoll.md) etter. Følg dem i denne kjøringen.'

const KLIENT_ID_FORM = new RegExp(KLIENT_ID)

/**
 * Én linje i serverloggen per verktøykall, uten nøkkel, argumenter eller
 * fagtekst: verktøyet, utfallet og tiden, og `klient_id` når kallet har en.
 * Den viser om et kall nådde OUSFAR og hva OUSFAR svarte; et kall ChatGPT
 * stoppet før det ble sendt, står ikke der (docs/kurateringsgrener.md,
 * «Når et kall ikke blir lagret»).
 */
export function loggKall(verktoy: string, utfall: { ok: boolean; kode?: string }, ms: number, args: unknown): string {
  const klient = args !== null && typeof args === 'object' ? (args as { klient_id?: unknown }).klient_id : undefined
  const linje = JSON.stringify({
    kuratering_mcp: verktoy,
    utfall: utfall.ok ? 'ok' : (utfall.kode ?? 'feil'),
    ms,
    ...(typeof klient === 'string' && KLIENT_ID_FORM.test(klient) ? { klient_id: klient } : {}),
  })
  console.info(linje)
  return linje
}

const tekstsvar = (id: Rpc['id'], innhold: unknown, feil: boolean, foran?: string) =>
  rpcSvar(id, {
    content: [...(foran ? [{ type: 'text', text: foran }] : []), { type: 'text', text: JSON.stringify(innhold) }],
    structuredContent: innhold !== null && typeof innhold === 'object' && !Array.isArray(innhold) ? innhold : { resultat: innhold },
    isError: feil,
  })

async function behandleRpc(melding: Rpc, db: SupabaseClient | null, nokkel: string, lesInstruks: () => Promise<string | null>): Promise<object | null> {
  const { id, method } = melding
  const varsel = id === undefined
  if (melding.jsonrpc !== '2.0' || typeof method !== 'string') return varsel ? null : rpcFeil(id, -32600, 'Ugyldig forespørsel.')
  if (varsel) return null

  switch (method) {
    case 'initialize': {
      const onsket = melding.params?.protocolVersion
      return rpcSvar(id, {
        protocolVersion: typeof onsket === 'string' && MCP_PROTOKOLLER.has(onsket) ? onsket : MCP_PROTOKOLL,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'ousfar-kuratering', version: '1.0.0' },
        instructions: INSTRUKSER,
      })
    }
    case 'ping':
      return rpcSvar(id, {})
    case 'tools/list':
      return rpcSvar(id, { tools: MCP_VERKTOY })
    case 'tools/call': {
      const navn = melding.params?.name
      const start = Date.now()
      if (navn === INSTRUKSVERKTOY.name) {
        const instruks = await lesInstruks()
        loggKall(navn, { ok: instruks !== null, kode: 'uten_instruks' }, Date.now() - start, undefined)
        if (instruks === null) {
          return tekstsvar(id, { feil: 'Instruksen kunne ikke leses i OUSFAR nå. Les docs/kontrollorinstruks.md og docs/kuratorprotokoll.md på main i repoet peohol/far, og si fra om feilen.' }, true)
        }
        return rpcSvar(id, { content: [{ type: 'text', text: instruks }], isError: false })
      }
      if (typeof navn !== 'string' || !AGENTHANDLINGSNAVN.has(navn)) return rpcFeil(id, -32602, `Ukjent verktøy «${String(navn)}».`)
      if (!db) return rpcFeil(id, -32603, 'Mangler oppkoblingen mot databasen.')
      const args = melding.params?.arguments ?? {}
      const utfall = await utforHandling(db, nokkel, navn, args)
      loggKall(navn, utfall, Date.now() - start, args)
      if (!utfall.ok && utfall.status === 403) return rpcFeil(id, -32001, utfall.feil)
      const instruks = navn === 'oversikt' ? await lesInstruks() : null
      const foran = instruks === null ? undefined : `${INSTRUKSINNLEDNING}\n\n${instruks}`
      return tekstsvar(id, utfall.ok ? utfall.data : { feil: utfall.feil, kode: utfall.kode }, !utfall.ok, foran)
    }
    default:
      return rpcFeil(id, -32601, `Ukjent metode «${method}».`)
  }
}

/** `/api/kuratering-mcp`. */
export async function behandleKurateringMcp(
  foresporsel: Request,
  miljo: Miljo,
  { klient, lesInstruks = lesKontrollorinstruks }: Avhengigheter = {},
): Promise<Response> {
  if (foresporsel.method !== 'POST') return svar(405, { feil: 'Bare POST (MCP over HTTP uten strøm).' })
  const nokkel = bearer(foresporsel) ?? new URL(foresporsel.url).searchParams.get('nokkel')
  if (!nokkel) return svar(401, { feil: 'Agentnøkkelen mangler.' })
  // Uten databasen svarer protokollen og instruksen likevel; bare handlingene trenger den.
  const db = klient === undefined ? serverklient(miljo) : klient

  let kropp: unknown
  try {
    kropp = await foresporsel.json()
  } catch {
    return svar(400, rpcFeil(null, -32700, 'Forespørselen må være JSON.'))
  }
  const meldinger = Array.isArray(kropp) ? (kropp as Rpc[]) : [kropp as Rpc]
  const svarene = (await Promise.all(meldinger.map((m) => behandleRpc(m ?? {}, db, nokkel, lesInstruks)))).filter((s) => s !== null)
  if (svarene.length === 0) return new Response(null, { status: 202 })
  return svar(200, Array.isArray(kropp) ? svarene : svarene[0])
}

/* --- Kurateringskøen -------------------------------------------------------- */

/** Arbeidsflyten som kjører kurateringskøen. */
export const KO_ARBEIDSFLYT = '.github/workflows/kurateringsko.yml'

/** `/api/kuratering-ko`: grenene slik køen følger dem, for køen og administratorene. */
export async function behandleKurateringsko(
  foresporsel: Request,
  miljo: Miljo,
  { klient, adminsjekk = erAdmin, githubsjekk }: Avhengigheter & { adminsjekk?: Adminsjekk; githubsjekk?: Githubsjekk } = {},
): Promise<Response> {
  if (foresporsel.method !== 'POST') return svar(405, { feil: 'Bare POST.' })
  if (!(await hvem(foresporsel, miljo, adminsjekk, { arbeidsflyt: KO_ARBEIDSFLYT, sjekk: githubsjekk }))) return svar(401, { feil: 'Ikke tilgang.' })
  const db = klient === undefined ? serverklient(miljo) : klient
  if (!db) return svar(500, { feil: 'Mangler oppkoblingen mot databasen.' })
  const { data, error } = await db.rpc('kuratering_kostatus')
  if (error) return svar(502, { feil: 'Databasen svarte med en feil.' })
  return svar(200, { grener: (data ?? []) as Greninfo[] })
}
