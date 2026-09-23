import { describe, expect, it } from 'vitest'
import { dagensRegelsett } from '../../__tests__/hjelp/dagensregler'
import { analytes, findByCode } from '../analytes'
import { regelsettband } from '../intervallregler'
import { grensepiller } from '../piller'
import type { Analyte } from '../../types'

function get(kode: string): Analyte {
  const a = findByCode(kode)
  if (!a) throw new Error(`Fant ikke ${kode}`)
  return a
}

/** Pillene analytten får med regelsettet fra før byttet. */
function piller(kode: string, regelsett = dagensRegelsett(kode)): [string, string][] {
  return grensepiller(get(kode), regelsett).map((p) => [p.merke, p.verdi])
}

const medRegelsett = (a: Analyte) => grensepiller(a, dagensRegelsett(a.kode))

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

  it('viser bare tallene fra datasettet mens regelsettet hentes', () => {
    expect(grensepiller(get('AMTNORSUM'), null).map((p) => [p.merke, p.verdi])).toEqual([
      ['Referanseområde', '400 – 900 nmol/L'],
    ])
    expect(grensepiller(get('ENAT'), null).map((p) => p.slag)).toEqual(['pavisningsgrense', 'terapiomrade'])
  })

  it('setter enheten også på en pille som har en annen enhet enn pillen foran', () => {
    const amt = dagensRegelsett('AMTNORSUM')
    expect(piller('AMTNORSUM', { ...amt, enhet: 'µmol/L', ringegrense: 2 })).toEqual([
      ['Referanseområde', '400 – 900 nmol/L'],
      ['Ringegrense', '2 µmol/L'],
    ])
  })
})
