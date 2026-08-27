import { describe, expect, it } from 'vitest'
import { analytes, findByCode } from '../analytes'
import { bands } from '../bands'
import { grensepiller } from '../piller'
import type { Analyte } from '../../types'

function get(kode: string): Analyte {
  const a = findByCode(kode)
  if (!a) throw new Error(`Fant ikke ${kode}`)
  return a
}

function piller(kode: string): [string, string][] {
  return grensepiller(get(kode)).map((p) => [p.merke, p.verdi])
}

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
      const p = grensepiller(a)
      expect(p.length, a.kode).toBeGreaterThan(0)
      expect(p[0]?.verdi, a.kode).toContain(a.enhet)
      for (const senere of p.slice(1)) {
        expect(senere.verdi, `${a.kode}/${senere.slag}`).not.toContain(a.enhet)
      }
    }
  })

  it('lar den toksiske pillen vise det samme tallet som det øverste båndet', () => {
    for (const a of analytes) {
      const toksisk = grensepiller(a).find((p) => p.slag === 'toksisk')
      if (!toksisk) continue
      expect(toksisk.verdi, a.kode).toBe(bands(a).at(-1)?.label)
    }
  })

  it('gir hver analytt piller som hører til kategorien den er i', () => {
    for (const a of analytes) {
      const slag = grensepiller(a).map((p) => p.slag)
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
})
