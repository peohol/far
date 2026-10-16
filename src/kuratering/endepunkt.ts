/**
 * Serverendepunktene agentene når kurateringsgrenene gjennom
 * (`docs/kurateringsgrener.md`):
 *
 * - `/api/kuratering`: `POST {"handling": ..., "data": {...}}` med
 *   `Authorization: Bearer <agentnøkkel>`;
 * - `/api/kuratering-mcp`: de samme handlingene som MCP-verktøy (JSON-RPC over
 *   HTTP), for ChatGPT og andre MCP-klienter. Nøkkelen står i
 *   `Authorization: Bearer`, eller i adressen (`?nokkel=`) for klienter som
 *   ikke kan sende den.
 *
 * Endepunktet kontrollerer ikke nøkkelen selv: databasen gjør det
 * (`public.kuratering_agent`, bare for tjenesterollen), sammen med rollen og
 * statusen for hver handling. Den hemmelige nøkkelen forlater aldri serveren,
 * og agentnøkkelen skrives aldri i loggen.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { bearer, serverklient, svar, type Miljo } from '../server/tilgang.js'
import { AGENTHANDLINGER, AGENTHANDLINGSNAVN } from './handlinger.js'

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
  if (!error) return { ok: true, data: svaret }
  const status = STATUS_FOR_KODE[error.code ?? '']
  // Feilene databasen gir med en kjent kode, er skrevet for agenten; andre
  // feil sier ingenting om databasen utad.
  return status
    ? { ok: false, status, kode: error.code, feil: error.message }
    : { ok: false, status: 500, kode: error.code ?? 'ukjent', feil: 'Databasen svarte med en feil.' }
}

export interface Avhengigheter {
  klient?: SupabaseClient | null
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

export const MCP_VERKTOY = AGENTHANDLINGER.map((h) => ({
  name: h.navn,
  description: h.beskrivelse,
  inputSchema: h.argumenter,
  annotations: { readOnlyHint: h.leser === true, destructiveHint: false, openWorldHint: false },
}))

const INSTRUKSER =
  'OUSFARs kurateringsgrener: isolerte arbeidsversjoner av fagsidene. Kontrolløren leser grenene som er klare til kontroll (oversikt, les) og vurderer nøyaktig én revisjon (vurder). Fagteksten er bak innloggingen: gjengi den aldri utenfor OUSFAR. Arbeidsflyten står i docs/kurateringsgrener.md i repoet peohol/far.'

async function behandleRpc(melding: Rpc, db: SupabaseClient, nokkel: string): Promise<object | null> {
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
      if (typeof navn !== 'string' || !AGENTHANDLINGSNAVN.has(navn)) return rpcFeil(id, -32602, `Ukjent verktøy «${String(navn)}».`)
      const utfall = await utforHandling(db, nokkel, navn, melding.params?.arguments ?? {})
      if (!utfall.ok && utfall.status === 403) return rpcFeil(id, -32001, utfall.feil)
      const innhold = utfall.ok ? utfall.data : { feil: utfall.feil, kode: utfall.kode }
      return rpcSvar(id, {
        content: [{ type: 'text', text: JSON.stringify(innhold) }],
        structuredContent: innhold !== null && typeof innhold === 'object' && !Array.isArray(innhold) ? innhold : { resultat: innhold },
        isError: !utfall.ok,
      })
    }
    default:
      return rpcFeil(id, -32601, `Ukjent metode «${method}».`)
  }
}

/** `/api/kuratering-mcp`. */
export async function behandleKurateringMcp(foresporsel: Request, miljo: Miljo, { klient }: Avhengigheter = {}): Promise<Response> {
  if (foresporsel.method !== 'POST') return svar(405, { feil: 'Bare POST (MCP over HTTP uten strøm).' })
  const nokkel = bearer(foresporsel) ?? new URL(foresporsel.url).searchParams.get('nokkel')
  if (!nokkel) return svar(401, { feil: 'Agentnøkkelen mangler.' })
  const db = klient === undefined ? serverklient(miljo) : klient
  if (!db) return svar(500, { feil: 'Mangler oppkoblingen mot databasen.' })

  let kropp: unknown
  try {
    kropp = await foresporsel.json()
  } catch {
    return svar(400, rpcFeil(null, -32700, 'Forespørselen må være JSON.'))
  }
  const meldinger = Array.isArray(kropp) ? (kropp as Rpc[]) : [kropp as Rpc]
  const svarene = (await Promise.all(meldinger.map((m) => behandleRpc(m ?? {}, db, nokkel)))).filter((s) => s !== null)
  if (svarene.length === 0) return new Response(null, { status: 202 })
  return svar(200, Array.isArray(kropp) ? svarene : svarene[0])
}
