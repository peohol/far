import { describe, expect, it } from 'vitest'
import { dagensRegelsett } from '../../__tests__/hjelp/dagensregler'
import { referanseomradeFor } from '../../__tests__/hjelp/referanseomrader'
import { analytes, findByCode } from '../analytes'
import { regelsettband } from '../intervallregler'
import { grensepiller, type Referanseomrade } from '../piller'
import type { Intervallregelsett } from '../../regler/modell'
import type { Analyte } from '../../types'

function get(kode: string): Analyte {
  const a = findByCode(kode)
  if (!a) throw new Error(`Fant ikke ${kode}`)
  return a
}

/** Pillene analytten får med regelsettet fra før byttet og referanseområdet på informasjonssiden. */
function piller(
  kode: string,
  regelsett: Intervallregelsett | null = dagensRegelsett(kode),
  referanseomrade: Referanseomrade | null = referanseomradeFor(kode),
): [string, string][] {
  return grensepiller(get(kode), regelsett, referanseomrade).map((p) => [p.merke, p.verdi])
}

const medRegelsett = (a: Analyte) => grensepiller(a, dagensRegelsett(a.kode), referanseomradeFor(a.kode))

describe('grensepiller', () => {
  it('gir psykofarmaka referanseområde og ringegrense', () => {
    expect(piller('AMTNORSUM')).toEqual([
      ['Referanseområde', '400 – 900 nmol/L'],
      ['Ringegrense', '1800'],
    ])
    expect(piller('LAM')).toEqual([
      ['Referanseområde', '10 – 50 µmol/L'],
      ['Ringegrense', '75'],
    ])
  })

  it('gir antihypertensiver påvisningsgrense, terapiområde og toksisk grense', () => {
    expect(piller('ENAT')).toEqual([
      ['Påvisningsgrense', '1 nmol/L'],
      ['Terapiområde', '10 – 300'],
      ['Toksisk', '≥ 1200'],
    ])
  })

  it('lar bumetanid og furosemid stå uten terapiområde', () => {
    expect(piller('BUME')).toEqual([
      ['Påvisningsgrense', '10 nmol/L'],
      ['Toksisk', '≥ 1600'],
    ])
    expect(piller('FURO')).toEqual([
      ['Påvisningsgrense', '50 nmol/L'],
      ['Toksisk', '≥ 40000'],
    ])
  })

  it('skriver desimaler med komma', () => {
    expect(piller('LERK')).toEqual([
      ['Påvisningsgrense', '0,1 nmol/L'],
      ['Terapiområde', '0,2 – 5'],
      ['Toksisk', '≥ 20'],
    ])
    expect(piller('EPLR')[1]).toEqual(['Terapiområde', '3,5 – 350'])
  })

  it('setter enheten på den første pillen og bare der', () => {
    for (const a of analytes) {
      const p = medRegelsett(a)
      expect(p.length, a.kode).toBeGreaterThan(0)
      expect(p[0]?.verdi, a.kode).toContain(a.enhet)
      for (const senere of p.slice(1)) {
        expect(senere.verdi, `${a.kode}/${senere.slag}`).not.toContain(a.enhet)
      }
    }
  })

  it('lar den toksiske pillen vise det samme tallet som det øverste båndet', () => {
    for (const a of analytes) {
      const toksisk = medRegelsett(a).find((p) => p.slag === 'toksisk')
      if (!toksisk) continue
      expect(toksisk.verdi, a.kode).toBe(regelsettband(dagensRegelsett(a.kode)).at(-1)?.label)
    }
  })

  it('gir hver analytt piller som hører til kategorien den er i', () => {
    for (const a of analytes) {
      const slag = medRegelsett(a).map((p) => p.slag)
      if (a.antihypertensiv) {
        expect(slag, a.kode).not.toContain('ringegrense')
        expect(slag[0], a.kode).toBe('pavisningsgrense')
        expect(slag.at(-1), a.kode).toBe('toksisk')
      } else {
        expect(slag, a.kode).not.toContain('pavisningsgrense')
        expect(slag, a.kode).not.toContain('toksisk')
      }
    }
  })

  it('leser ringegrensen og den toksiske grensen av regelsettet', () => {
    const amt = dagensRegelsett('AMTNORSUM')
    expect(piller('AMTNORSUM', { ...amt, ringegrense: 1799 })[1]).toEqual(['Ringegrense', '1799'])
    expect(piller('AMTNORSUM', { ...amt, ringegrense: null })).toEqual([['Referanseområde', '400 – 900 nmol/L']])

    // Toksisk begynner der det første intervallet på nivået «over» gjør.
    const enat = dagensRegelsett('ENAT')
    expect(piller('ENAT', { ...enat, skillepunkter: [10, 1300] }).at(-1)).toEqual(['Toksisk', '≥ 1300'])
  })

  it('viser referanseområdet informasjonssiden har', () => {
    // De tre som var ulike i de gamle datasettene (50–330, 18–550 og < 300).
    expect(piller('BREK')[0]).toEqual(['Referanseområde', '50 – 350 nmol/L'])
    expect(piller('DOKSUM')[0]).toEqual(['Referanseområde', '180 – 550 nmol/L'])
    expect(piller('LMP')[0]).toEqual(['Referanseområde', '10 – 300 nmol/L'])
    // Enheten er den kortet har.
    expect(piller('AMTNORSUM', undefined, { nedre: 0.4, ovre: 0.9, enhet: 'µmol/L' })).toEqual([
      ['Referanseområde', '0,4 – 0,9 µmol/L'],
      ['Ringegrense', '1800 nmol/L'],
    ])
  })

  it('sier bare det som er oppgitt når kortet har én grense', () => {
    expect(piller('AMTNORSUM', null, { nedre: 10, ovre: null, enhet: 'nmol/L' })).toEqual([
      ['Referanseområde', 'fra 10 nmol/L'],
    ])
    expect(piller('AMTNORSUM', null, { nedre: null, ovre: 300, enhet: 'nmol/L' })).toEqual([
      ['Referanseområde', 'opptil 300 nmol/L'],
    ])
    expect(piller('AMTNORSUM', null, { nedre: 5, ovre: 5, enhet: 'nmol/L' })).toEqual([['Referanseområde', '5 nmol/L']])
    expect(piller('AMTNORSUM', null, { nedre: null, ovre: null, enhet: 'nmol/L' })).toEqual([])
  })

  it('viser bare tallene fra datasettet mens regelsettet og referanseområdet hentes', () => {
    expect(grensepiller(get('AMTNORSUM'), null, null)).toEqual([])
    expect(grensepiller(get('ENAT'), null, null).map((p) => p.slag)).toEqual(['pavisningsgrense', 'terapiomrade'])
  })

  it('setter enheten også på en pille som har en annen enhet enn pillen foran', () => {
    const amt = dagensRegelsett('AMTNORSUM')
    expect(piller('AMTNORSUM', { ...amt, enhet: 'µmol/L', ringegrense: 2 })).toEqual([
      ['Referanseområde', '400 – 900 nmol/L'],
      ['Ringegrense', '2 µmol/L'],
    ])
  })
})
