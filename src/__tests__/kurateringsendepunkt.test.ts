/**
 * Serverendepunktene for kurateringsgrenene (`docs/kurateringsgrener.md`):
 * at nøkkelen bare sendes videre til databasen, at feilene blir riktige
 * HTTP-statuser uten å si noe om databasen utad, og at MCP-endepunktet svarer
 * på protokollen, gir de samme handlingene som verktøy, og gir
 * kontrollørinstruksen og kuratorprotokollen med verktøyet `instruks`.
 */
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, matchesGlob } from 'node:path'
import type { SupabaseClient } from '@supabase/supabase-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AGENTHANDLINGER, KLIENT_ID } from '../kuratering/handlinger'
import {
  behandleKuratering,
  behandleKurateringMcp,
  behandleKurateringsko,
  INSTRUKSFIL,
  INSTRUKSFILER,
  INSTRUKSINNLEDNING,
  KO_ARBEIDSFLYT,
  lesKontrollorinstruks,
  MCP_PROTOKOLL,
  PROTOKOLLFIL,
} from '../kuratering/endepunkt'

const NOKKEL = 'far_' + 'a'.repeat(64)

// Serverloggen (én linje per verktøykall) holdes ute av testutskriften.
beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => {})
})
afterEach(() => {
  vi.restoreAllMocks()
})

function klient(svar: { data?: unknown; error?: { code: string; message: string } | null } = { data: { ok: true } }) {
  const rpc = vi.fn().mockResolvedValue({ data: svar.data ?? null, error: svar.error ?? null })
  return { rpc, klient: { rpc } as unknown as SupabaseClient }
}

const post = (url: string, kropp: unknown, nokkel: string | null = NOKKEL) =>
  new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(nokkel ? { authorization: `Bearer ${nokkel}` } : {}) },
    body: JSON.stringify(kropp),
  })

describe('/api/kuratering', () => {
  it('sender nøkkelen, handlingen og argumentene til databasen', async () => {
    const k = klient({ data: [{ id: 'g' }] })
    const svar = await behandleKuratering(post('https://x/api/kuratering', { handling: 'oversikt', data: { stoff: 'a' } }), {}, k)
    expect(svar.status).toBe(200)
    expect(await svar.json()).toEqual([{ id: 'g' }])
    expect(k.rpc).toHaveBeenCalledWith('kuratering_agent', { nokkel: NOKKEL, handling: 'oversikt', data: { stoff: 'a' } })
  })

  it('avviser uten nøkkel, ukjente handlinger og annet enn POST uten å spørre databasen', async () => {
    const k = klient()
    expect((await behandleKuratering(post('https://x/api/kuratering', { handling: 'oversikt' }, null), {}, k)).status).toBe(401)
    expect((await behandleKuratering(post('https://x/api/kuratering', { handling: 'ny_agentnokkel' }), {}, k)).status).toBe(400)
    expect((await behandleKuratering(new Request('https://x/api/kuratering'), {}, k)).status).toBe(405)
    expect(k.rpc).not.toHaveBeenCalled()
  })

  it('gjør databasens feilkoder om til HTTP-statuser, og skjuler ukjente feil', async () => {
    for (const [code, status] of [
      ['42501', 403],
      ['PT404', 404],
      ['PT409', 409],
      ['22023', 400],
    ] as const) {
      const k = klient({ error: { code, message: 'Melding fra databasen' } })
      const svar = await behandleKuratering(post('https://x/api/kuratering', { handling: 'les', data: { gren: 'g' } }), {}, k)
      expect(svar.status).toBe(status)
      expect(await svar.json()).toEqual({ feil: 'Melding fra databasen', kode: code })
    }
    const k = klient({ error: { code: 'XX000', message: 'intern detalj om tabellen' } })
    const svar = await behandleKuratering(post('https://x/api/kuratering', { handling: 'les', data: {} }), {}, k)
    expect(svar.status).toBe(500)
    expect(JSON.stringify(await svar.json())).not.toContain('tabellen')
  })
  it('gir en publisering som feilet og blokkerte grenen, som en feil', async () => {
    const konflikt = klient({ data: { ok: false, status: 'blokkert', kode: 'PT409', feil: 'Siden er publisert på nytt.' } })
    const svar = await behandleKuratering(post('https://x/api/kuratering', { handling: 'publiser', data: { gren: 'g', revisjon: 2 } }), {}, konflikt)
    expect(svar.status).toBe(409)
    expect(await svar.json()).toEqual({ feil: 'Siden er publisert på nytt.', kode: 'PT409' })
    const teknisk = klient({ data: { ok: false, status: 'blokkert', kode: 'XX000', feil: 'intern detalj om tabellen' } })
    const mcp = await (
      await behandleKurateringMcp(post('https://x/api/kuratering-mcp', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'publiser', arguments: { gren: 'g', revisjon: 2 } } }), {}, teknisk)
    ).json()
    expect(mcp.result.isError).toBe(true)
    expect(JSON.stringify(mcp)).not.toContain('tabellen')
  })
})

describe('/api/kuratering-mcp', () => {
  const rpc = (method: string, params?: unknown, id: number | null = 1) => ({ jsonrpc: '2.0', ...(id === null ? {} : { id }), method, params })

  it('svarer på initialize, ping og tools/list med alle agenthandlingene', async () => {
    const k = klient()
    const init = await (await behandleKurateringMcp(post('https://x/api/kuratering-mcp', rpc('initialize', { protocolVersion: '2025-03-26' })), {}, k)).json()
    expect(init.result).toMatchObject({ protocolVersion: '2025-03-26', capabilities: { tools: {} }, serverInfo: { name: 'ousfar-kuratering' } })
    const ukjent = await (await behandleKurateringMcp(post('https://x/api/kuratering-mcp', rpc('initialize', { protocolVersion: '1999-01-01' })), {}, k)).json()
    expect(ukjent.result.protocolVersion).toBe(MCP_PROTOKOLL)
    expect((await (await behandleKurateringMcp(post('https://x/api/kuratering-mcp', rpc('ping')), {}, k)).json()).result).toEqual({})

    const liste = await (await behandleKurateringMcp(post('https://x/api/kuratering-mcp', rpc('tools/list')), {}, k)).json()
    expect(liste.result.tools.map((t: { name: string }) => t.name)).toEqual(['instruks', ...AGENTHANDLINGER.map((h) => h.navn)])
    for (const t of liste.result.tools) expect(t.inputSchema).toMatchObject({ type: 'object' })
    expect(k.rpc).not.toHaveBeenCalled()
  })

  it('kaller handlingen for et verktøy, med nøkkelen fra overskriften eller adressen', async () => {
    const k = klient({ data: { status: 'klar' } })
    const svar = await (
      await behandleKurateringMcp(post('https://x/api/kuratering-mcp?nokkel=' + NOKKEL, rpc('tools/call', { name: 'les', arguments: { gren: 'g' } }), null), {}, k)
    ).json()
    expect(svar.result).toMatchObject({ isError: false, structuredContent: { status: 'klar' } })
    expect(JSON.parse(svar.result.content[0].text)).toEqual({ status: 'klar' })
    expect(k.rpc).toHaveBeenCalledWith('kuratering_agent', { nokkel: NOKKEL, handling: 'les', data: { gren: 'g' } })
  })

  it('gir feil i handlingen som verktøyfeil, en avvist nøkkel som protokollfeil, og varsler uten svar', async () => {
    const feil = klient({ error: { code: '22023', message: 'Grenen er «klar», så den kan ikke endres.' } })
    const svar = await (await behandleKurateringMcp(post('https://x/api/kuratering-mcp', rpc('tools/call', { name: 'skriv', arguments: {} })), {}, feil)).json()
    expect(svar.result.isError).toBe(true)
    expect(svar.result.content[0].text).toContain('kan ikke endres')

    const avvist = klient({ error: { code: '42501', message: 'Agentnøkkelen er ukjent eller ikke lenger gyldig.' } })
    const nei = await (await behandleKurateringMcp(post('https://x/api/kuratering-mcp', rpc('tools/call', { name: 'oversikt', arguments: {} })), {}, avvist)).json()
    expect(nei.error).toMatchObject({ code: -32001 })

    const varsel = await behandleKurateringMcp(post('https://x/api/kuratering-mcp', rpc('notifications/initialized', undefined, null)), {}, klient())
    expect(varsel.status).toBe(202)
    expect((await behandleKurateringMcp(post('https://x/api/kuratering-mcp', rpc('tools/list'), null), {}, klient())).status).toBe(401)
  })

  it('skriver én linje i serverloggen per verktøykall: verktøyet, utfallet og klient_id, aldri nøkkelen eller teksten', async () => {
    const logg = vi.mocked(console.info)
    const args = { gren: 'g', svar_pa: 'k', tekst: 'Syntetisk fagtekst som ikke skal i loggen.', klient_id: 'g-r6-merknad-1' }
    await behandleKurateringMcp(post('https://x/api/kuratering-mcp', rpc('tools/call', { name: 'kommenter', arguments: args })), {}, klient({ data: { lagret: true } }))
    const feil = klient({ error: { code: 'PT409', message: 'klient_id er alt brukt for en annen kommentar i grenen.' } })
    await behandleKurateringMcp(post('https://x/api/kuratering-mcp', rpc('tools/call', { name: 'kommenter', arguments: { ...args, klient_id: 'feil form!' } })), {}, feil)
    expect(logg.mock.calls.map(([linje]) => JSON.parse(String(linje)))).toEqual([
      { kuratering_mcp: 'kommenter', utfall: 'ok', ms: expect.any(Number), klient_id: 'g-r6-merknad-1' },
      { kuratering_mcp: 'kommenter', utfall: 'PT409', ms: expect.any(Number) },
    ])
    const alt = JSON.stringify(logg.mock.calls)
    for (const hemmelig of [NOKKEL, 'fagtekst', '"g"', 'alt brukt']) expect(alt).not.toContain(hemmelig)
  })

  it('logger også kallene som feiler i OUSFAR: uten database, ukjent verktøy og et unntak', async () => {
    const logg = vi.mocked(console.info)
    const kall = (name: string, avh: Parameters<typeof behandleKurateringMcp>[2]) =>
      behandleKurateringMcp(post('https://x/api/kuratering-mcp', rpc('tools/call', { name, arguments: { gren: 'g', tekst: 'Syntetisk fagtekst.' } })), {}, avh)
    expect((await (await kall('les', { klient: null })).json()).error).toMatchObject({ code: -32603 })
    expect((await (await kall('Syntetisk fagtekst', klient())).json()).error).toMatchObject({ code: -32602 })
    const brutt = { klient: { rpc: vi.fn().mockRejectedValue(new Error('fetch failed')) } as unknown as SupabaseClient }
    const unntak = await (await kall('kommenter', brutt)).json()
    expect(unntak.error).toMatchObject({ code: -32603 })
    expect(unntak.error.message).toMatch(/kan likevel være utført/)
    expect(logg.mock.calls.map(([linje]) => JSON.parse(String(linje)))).toEqual([
      { kuratering_mcp: 'les', utfall: 'uten_database', ms: expect.any(Number) },
      { kuratering_mcp: 'ukjent', utfall: 'ukjent_verktoy', ms: expect.any(Number) },
      { kuratering_mcp: 'kommenter', utfall: 'unntak', ms: expect.any(Number) },
    ])
    expect(JSON.stringify(logg.mock.calls)).not.toContain('fagtekst')
  })

  it('tilbyr klient_id i kommenter, med samme form som databasen krever', () => {
    const kommenter = AGENTHANDLINGER.find((h) => h.navn === 'kommenter')!
    const egenskaper = (kommenter.argumenter as { properties: Record<string, { pattern?: string }> }).properties
    expect(egenskaper.klient_id!.pattern).toBe(KLIENT_ID)
    const migrasjon = readFileSync(new URL('../../supabase/migrations/20261018025037_kommentar_klient_id.sql', import.meta.url), 'utf8')
    expect(migrasjon).toContain(`klient_id ~ '${KLIENT_ID}'`)
    expect(migrasjon).toContain(`v_klient !~ '${KLIENT_ID}'`)
    expect(kommenter.beskrivelse).toMatch(/lagret: true/)
  })
})

describe('kontrollørinstruksen i MCP-koblingen', () => {
  const rpc = (method: string, params?: unknown) => ({ jsonrpc: '2.0', id: 1, method, params })
  const kall = async (kropp: unknown, avhengigheter: Parameters<typeof behandleKurateringMcp>[2]) =>
    (await behandleKurateringMcp(post('https://x/api/kuratering-mcp', kropp), {}, avhengigheter)).json()
  const les = (fil: string) => readFileSync(new URL(`../../${fil}`, import.meta.url), 'utf8')
  const INSTRUKSEN = les(INSTRUKSFIL)
  const PROTOKOLLEN = les(PROTOKOLLFIL)
  const FILA = `${INSTRUKSEN}\n\n---\n\n${PROTOKOLLEN}`

  it('gir den gjeldende instruksen med kuratorprotokollen etter, uten å spørre databasen', async () => {
    const k = klient()
    const svar = await kall(rpc('tools/call', { name: 'instruks', arguments: {} }), k)
    expect(svar.result).toEqual({ content: [{ type: 'text', text: FILA }], isError: false })
    expect(FILA).toMatch(/^# Instruks for kontrolløren/)
    // Kravene og erfaringene kontrolløren kontrollerer mot, står i svaret, ikke bare som en henvisning.
    expect(FILA).toContain('## De ufravikelige kravene')
    expect(FILA).toContain('## Erfaringer fra kontrollen')
    expect(await lesKontrollorinstruks()).toBe(FILA)
    expect(k.rpc).not.toHaveBeenCalled()
  })

  it('gir instruksen med beskjed om hvor protokollen står når bare protokollen mangler, og ingenting uten instruksen', async () => {
    const mappe = mkdtempSync(join(tmpdir(), 'instruks-'))
    mkdirSync(join(mappe, 'docs'))
    const cwd = vi.spyOn(process, 'cwd').mockReturnValue(mappe)
    try {
      expect(await lesKontrollorinstruks()).toBeNull()
      writeFileSync(join(mappe, INSTRUKSFIL), INSTRUKSEN)
      const tekst = await lesKontrollorinstruks()
      expect(tekst?.startsWith(INSTRUKSEN)).toBe(true)
      expect(tekst).toContain('docs/kuratorprotokoll.md kunne ikke leses')
    } finally {
      cwd.mockRestore()
    }
  })

  it('står først i tools/list, bare lesende og uten argumenter', async () => {
    const liste = await kall(rpc('tools/list'), klient())
    const [instruks] = liste.result.tools
    expect(instruks).toMatchObject({
      name: 'instruks',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, destructiveHint: false },
    })
    const oversikt = liste.result.tools.find((t: { name: string }) => t.name === 'oversikt')
    expect(oversikt.description).toContain('instruks')
  })

  it('initialize ber kontrolløren lese instruksen med verktøyet før noe annet', async () => {
    const init = await kall(rpc('initialize', { protocolVersion: MCP_PROTOKOLL }), klient())
    expect(init.result.instructions).toMatch(/kaller verktøyet instruks før noe annet/)
    expect(init.result.instructions).not.toContain('github')
  })

  it('svarer med protokollen og instruksen også uten databasen, men ikke med handlingene', async () => {
    const utenDb = { klient: null }
    expect((await kall(rpc('initialize'), utenDb)).result.instructions).toBeTruthy()
    expect((await kall(rpc('tools/call', { name: 'instruks' }), utenDb)).result.content[0].text).toBe(FILA)
    expect((await kall(rpc('tools/call', { name: 'oversikt', arguments: {} }), utenDb)).error).toMatchObject({ code: -32603 })
  })

  it('sier fra, med veien til instruksen, når fila ikke kan leses', async () => {
    const svar = await kall(rpc('tools/call', { name: 'instruks' }), { ...klient(), lesInstruks: async () => null })
    expect(svar.result.isError).toBe(true)
    expect(svar.result.content[0].text).toContain('docs/kontrollorinstruks.md')
  })

  it('står først i svaret på oversikt, foran svaret fra databasen, for en klient med en gammel verktøyliste', async () => {
    const GRENER = [{ id: 'g', status: 'klar' }]
    const k = klient({ data: GRENER })
    const svar = await kall(rpc('tools/call', { name: 'oversikt', arguments: {} }), k)
    expect(svar.result.content).toEqual([
      { type: 'text', text: `${INSTRUKSINNLEDNING}\n\n${FILA}` },
      { type: 'text', text: JSON.stringify(GRENER) },
    ])
    expect(svar.result).toMatchObject({ isError: false, structuredContent: { resultat: GRENER } })
    expect(k.rpc).toHaveBeenCalledWith('kuratering_agent', { nokkel: NOKKEL, handling: 'oversikt', data: {} })

    // Kan instruksen ikke leses, er svaret som før; de andre verktøyene har den ikke.
    const uten = await kall(rpc('tools/call', { name: 'oversikt', arguments: {} }), { ...klient({ data: GRENER }), lesInstruks: async () => null })
    expect(uten.result.content).toEqual([{ type: 'text', text: JSON.stringify(GRENER) }])
    const les = await kall(rpc('tools/call', { name: 'les', arguments: { gren: 'g' } }), klient({ data: { status: 'klar' } }))
    expect(les.result.content).toHaveLength(1)

    // /api/kuratering gir bare svaret fra databasen.
    const http = await behandleKuratering(post('https://x/api/kuratering', { handling: 'oversikt' }), {}, klient({ data: GRENER }))
    expect(await http.json()).toEqual(GRENER)
  })

  it('er bare et MCP-verktøy, ikke en handling i /api/kuratering', async () => {
    const k = klient()
    expect((await behandleKuratering(post('https://x/api/kuratering', { handling: 'instruks' }), {}, k)).status).toBe(400)
    expect(k.rpc).not.toHaveBeenCalled()
  })

  it('filene tas med i funksjonen i produksjonen (includeFiles i vercel.json)', () => {
    const vercel = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8')) as {
      functions: Record<string, { includeFiles?: string }>
    }
    const monster = vercel.functions['api/kuratering-mcp.ts']?.includeFiles ?? ''
    for (const fil of INSTRUKSFILER) expect(matchesGlob(fil, monster), fil).toBe(true)
  })
})

describe('/api/kuratering-ko', () => {
  const GRENER = [{ id: 'g', stoff: 'a', art: 'de_novo', status: 'klar', revisjon: 1, runde: 1, oppdatert_kl: 'x', publisert_kl: null }]
  const ingenAdmin = async () => false

  it('gir grenene til kurateringskøen med OIDC-tokenet for arbeidsflyten, og ingen andre', async () => {
    const k = klient({ data: GRENER })
    const githubsjekk = vi.fn(async (token: string, arbeidsflyt: string) => (token === 'oidc' && arbeidsflyt === KO_ARBEIDSFLYT ? ('cron' as const) : null))
    const svar = await behandleKurateringsko(post('https://x/api/kuratering-ko', {}, 'oidc'), {}, { ...k, adminsjekk: ingenAdmin, githubsjekk })
    expect(svar.status).toBe(200)
    expect(await svar.json()).toEqual({ grener: GRENER })
    expect(k.rpc).toHaveBeenCalledWith('kuratering_kostatus')
    expect((await behandleKurateringsko(post('https://x/api/kuratering-ko', {}, 'annet'), {}, { ...k, adminsjekk: ingenAdmin, githubsjekk })).status).toBe(401)
    expect((await behandleKurateringsko(post('https://x/api/kuratering-ko', {}, null), {}, { ...k, adminsjekk: ingenAdmin, githubsjekk })).status).toBe(401)
    expect((await behandleKurateringsko(new Request('https://x/api/kuratering-ko'), {}, { ...k, adminsjekk: ingenAdmin, githubsjekk })).status).toBe(405)
    expect(k.rpc).toHaveBeenCalledTimes(1)
  })
})
