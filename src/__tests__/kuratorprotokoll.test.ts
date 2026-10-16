/**
 * Verktøyene i kuratorprotokollen (`docs/kuratorprotokoll.md`): kontroll-
 * punktene i dekningsmatrisen utledet av appens innholdsmodell, kontrollen av
 * en matrise, og agentklienten Claude-kuratoren kaller OUSFAR med.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { Agentfeil, lagAgentklient, lesArgumenter } from '../kuratorprotokoll/agentklient'
import { kontrollerDekning, kontrollpunkter, modellSha256, tomMatrise } from '../kuratorprotokoll/dekning'

const CITALOPRAM = JSON.parse(readFileSync(new URL('../../docs/kurateringsjournal/citalopram-dekning.json', import.meta.url), 'utf8')) as {
  omrader: { nokkel: string }[]
}

describe('dekningen', () => {
  it('utleder de samme 37 kontrollpunktene som den første de novo-piloten dekket, fra modellen', () => {
    expect(kontrollpunkter()).toHaveLength(37)
    expect(kontrollpunkter()).toEqual(CITALOPRAM.omrader.map((o) => o.nokkel))
  })

  it('godtar en matrise som dekker hvert punkt med belegg, og sier hva som mangler i en som ikke gjør det', () => {
    const m = tomMatrise('de_novo')
    expect(kontrollerDekning(m).filter((f) => f.endsWith('mangler begrunnelse.'))).toHaveLength(37)
    for (const o of m.omrader) Object.assign(o, { begrunnelse: 'Kontrollert.', kilder: ['SPC'], sok: ['søk'], bevis: 'Lest mot punkt 4.2.' })
    expect(kontrollerDekning(m)).toEqual([])

    const tomt = m.omrader.find((o) => o.nokkel === 'avhengighet_toleranse/laering_motivasjon/Lært mestringsavhengighet')!
    Object.assign(tomt, { status: 'tomt_begrunnet', kilder: [], sok: [], bevis: '' })
    expect(kontrollerDekning(m)).toEqual([`${tomt.nokkel}: et tomt område må si hva det ble søkt etter.`])
    tomt.sok = ['PubMed citalopram learned coping dependence']

    m.omrader.push({ ...m.omrader[0]! }, { ...m.omrader[0]!, nokkel: 'ukjent' })
    m.omrader.splice(1, 1)
    expect(kontrollerDekning({ ...m, modell_sha256: '0' })).toEqual([
      'modell_sha256 stemmer ikke med appens innholdsmodell nå; lag matrisen på nytt mot den.',
      'ukjent: ikke et kontrollpunkt i modellen.',
      'identitet: står 2 ganger.',
      'viktige_data: mangler i matrisen.',
    ])
  })

  it('får et nytt fingeravtrykk når modellen endres', () => {
    expect(modellSha256(['a', 'b'])).not.toBe(modellSha256(['a']))
    expect(modellSha256()).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('agentklienten', () => {
  it('kaller /api/kuratering med nøkkelen i overskriften, og gir feilen med koden fra OUSFAR', async () => {
    const hent = vi.fn(async (_url: string, valg?: RequestInit) =>
      JSON.parse(String(valg?.body)).handling === 'les' ? Response.json({ id: 'g' }) : Response.json({ feil: 'Ikke din gren.', kode: '42501' }, { status: 403 }),
    )
    const k = lagAgentklient({ adresse: 'https://ousfar.example/', nokkel: 'far_hemmelig', hent })
    expect(await k.kall('les', { gren: 'g' })).toEqual({ id: 'g' })
    expect(hent).toHaveBeenCalledWith('https://ousfar.example/api/kuratering', expect.objectContaining({ method: 'POST', headers: expect.objectContaining({ authorization: 'Bearer far_hemmelig' }) }))
    const feil = await k.kall('skriv').catch((e: unknown) => e)
    expect(feil).toBeInstanceOf(Agentfeil)
    expect(feil).toMatchObject({ status: 403, kode: '42501', message: 'Ikke din gren.' })
    expect(String(feil)).not.toContain('far_hemmelig')
  })

  it('leser argumentene som JSON eller fra en fil', () => {
    expect(lesArgumenter(undefined, () => '')).toEqual({})
    expect(lesArgumenter('{"gren":"g"}', () => '')).toEqual({ gren: 'g' })
    expect(lesArgumenter('@a.json', (sti) => (sti === 'a.json' ? '{"x":1}' : ''))).toEqual({ x: 1 })
    expect(() => lesArgumenter('[1]', () => '')).toThrow()
  })
})
