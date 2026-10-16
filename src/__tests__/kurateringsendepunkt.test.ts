/**
 * Serverendepunktene for kurateringsgrenene (`docs/kurateringsgrener.md`):
 * at nøkkelen bare sendes videre til databasen, at feilene blir riktige
 * HTTP-statuser uten å si noe om databasen utad, og at MCP-endepunktet svarer
 * på protokollen og gir de samme handlingene som verktøy.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { AGENTHANDLINGER } from '../kuratering/handlinger'
import { behandleKuratering, behandleKurateringMcp, MCP_PROTOKOLL } from '../kuratering/endepunkt'

const NOKKEL = 'far_' + 'a'.repeat(64)

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
    expect(liste.result.tools.map((t: { name: string }) => t.name)).toEqual(AGENTHANDLINGER.map((h) => h.navn))
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
})
