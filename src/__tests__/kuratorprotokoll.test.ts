/**
 * Verktøyene i kuratorprotokollen (`docs/kuratorprotokoll.md`): kontroll-
 * punktene i dekningsmatrisen utledet av appens innholdsmodell, kontrollen av
 * en matrise, agentklienten Claude-agentene kaller OUSFAR med, og nøklene deres.
 */
import { mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { Agentfeil, ROLLER, lagAgentklient, lesArgumenter, lesRolle } from '../kuratorprotokoll/agentklient'
import { migrasjonsversjon, nokkelmigrasjon, nokkelSha256, sikreNokler } from '../kuratorprotokoll/nokler'
import { kontrollerDekning, kontrollpunkter, modellSha256, tomMatrise } from '../kuratorprotokoll/dekning'

const CITALOPRAM = JSON.parse(readFileSync(new URL('../../docs/kurateringsjournal/citalopram-dekning.json', import.meta.url), 'utf8')) as {
  omrader: { nokkel: string }[]
}

describe('dekningen', () => {
  it('utleder de 37 kontrollpunktene den første de novo-piloten dekket, og de faste kortene som er kommet til siden, fra modellen', () => {
    expect(kontrollpunkter()).toHaveLength(38)
    // «Fenomenologi» i «Virkninger» kom til 2026-10-22, etter piloten.
    expect(kontrollpunkter().filter((p) => p !== 'virkninger/Fenomenologi')).toEqual(CITALOPRAM.omrader.map((o) => o.nokkel))
    expect(kontrollpunkter().slice(8, 11)).toEqual(['virkninger', 'virkninger/Fenomenologi', 'bivirkninger'])
  })

  it('godtar en matrise som dekker hvert punkt med belegg, og sier hva som mangler i en som ikke gjør det', () => {
    const m = tomMatrise('de_novo')
    expect(kontrollerDekning(m).filter((f) => f.endsWith('mangler begrunnelse.'))).toHaveLength(38)
    for (const o of m.omrader) Object.assign(o, { begrunnelse: 'Kontrollert.', kilder: ['SPC'], sok: ['søk'], bevis: 'Lest mot punkt 4.2.' })
    expect(kontrollerDekning(m)).toEqual([])

    const tomt = m.omrader.find((o) => o.nokkel === 'avhengighet_toleranse/laering_motivasjon/Lært mestringsavhengighet')!
    Object.assign(tomt, { status: 'tomt_begrunnet', kilder: [], sok: [], bevis: '' })
    expect(kontrollerDekning(m)).toEqual([`${tomt.nokkel}: et tomt område må si hva det ble søkt etter.`])
    // Tomme oppføringer er ikke belegg, verken for et søk eller en kilde.
    tomt.sok = ['   ']
    expect(kontrollerDekning(m)).toEqual([`${tomt.nokkel}: kilder og sok må være lister med tekst, uten tomme oppføringer.`])
    tomt.sok = ['PubMed citalopram learned coping dependence']
    const beholdt = m.omrader[0]!
    beholdt.kilder = ['']
    expect(kontrollerDekning(m)).toEqual([`${beholdt.nokkel}: kilder og sok må være lister med tekst, uten tomme oppføringer.`])
    beholdt.kilder = ['SPC']

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

describe('rollene og nøklene', () => {
  it('gir kuratoren og kontrolløren hver sin agent og nøkkelfil, og godtar bare rollene som finnes', () => {
    expect(lesRolle('kurator')).toBe('kurator')
    expect(lesRolle('kontrollor')).toBe('kontrollor')
    for (const feil of [undefined, '', 'admin', 'toString']) expect(() => lesRolle(feil)).toThrow(/Ukjent rolle/)
    const roller = Object.values(ROLLER)
    expect(new Set(roller.map((r) => r.agent)).size).toBe(roller.length)
    expect(new Set(roller.map((r) => r.nokkelfil)).size).toBe(roller.length)
    for (const r of roller) expect(r.nokkelfil).toMatch(/^\/mnt\/project-files\/\.hemmelig\//)
  })

  it('lager en nøkkel som bare eieren kan lese, og overskriver aldri en som finnes', () => {
    const mappe = mkdtempSync(join(tmpdir(), 'nokler-'))
    const agenter = [
      { agent: 'a-kurator', nokkelfil: join(mappe, 'hemmelig', 'a.nokkel') },
      { agent: 'b-kontrollor', nokkelfil: join(mappe, 'hemmelig', 'b.nokkel') },
    ]
    const forste = sikreNokler(agenter)
    expect(forste.map((n) => n.ny)).toEqual([true, true])
    for (const n of forste) {
      const nokkel = readFileSync(n.nokkelfil, 'utf8').trim()
      expect(nokkel).toMatch(/^far_[0-9a-f]{64}$/)
      expect(n.sha256).toBe(nokkelSha256(nokkel))
      expect(statSync(n.nokkelfil).mode & 0o777).toBe(0o600)
    }
    expect(forste[0]!.sha256).not.toBe(forste[1]!.sha256)
    // En gang til: de samme nøklene.
    expect(sikreNokler(agenter)).toEqual(forste.map((n) => ({ ...n, ny: false })))
    // En fil uten gyldig nøkkel blir stående som den er.
    writeFileSync(agenter[1]!.nokkelfil, 'noe annet')
    expect(() => sikreNokler(agenter)).toThrow(/overskrives ikke/)
    expect(readFileSync(agenter[1]!.nokkelfil, 'utf8')).toBe('noe annet')
  })

  it('skriver migrasjonen med bare kontrollsummene, og versjonen som tidspunktet i UTC', () => {
    const sha = nokkelSha256('far_' + 'a'.repeat(64))
    const sql = nokkelmigrasjon([{ agent: 'claude-monografikontrollor', sha256: sha }])
    expect(sql).toContain(`nokkel_sha256 = '${sha}'`)
    expect(sql).toContain(`where agent = 'claude-monografikontrollor'`)
    expect(sql).not.toContain('a'.repeat(64))
    expect(() => nokkelmigrasjon([{ agent: "x'; drop table y; --", sha256: sha }])).toThrow()
    expect(() => nokkelmigrasjon([{ agent: 'x', sha256: 'far_hemmelig' }])).toThrow()
    expect(migrasjonsversjon(new Date('2026-10-19T04:05:06.789Z'))).toBe('20261019040506')
  })
})
