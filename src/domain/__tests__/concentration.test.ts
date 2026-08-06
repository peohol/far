import { describe, expect, it } from 'vitest'
import { analytes, findByCode } from '../analytes'
import { classify, levelComment } from '../concentration'
import type { Analyte } from '../../types'

function get(kode: string): Analyte {
  const a = findByCode(kode)
  if (!a) throw new Error(`Fant ikke ${kode}`)
  return a
}

describe('classify', () => {
  const amt = get('AMTNORSUM') // under < 10, innenfor 10–1799, over ≥ 1800

  it('treffer riktig nivå på hver side av grensene', () => {
    expect(classify(amt, 9.9)).toBe('under')
    expect(classify(amt, 10)).toBe('innenfor')
    expect(classify(amt, 1799)).toBe('innenfor')
    expect(classify(amt, 1800)).toBe('over')
  })

  it('dekker hele tallinjen for alle analytter', () => {
    for (const a of analytes) {
      for (const verdi of [0, a.nedreGrense, a.ovreGrense, a.ovreGrense * 10]) {
        expect(['under', 'innenfor', 'over']).toContain(classify(a, verdi))
      }
    }
  })

  it('lar Over vinne der PDF-en har overlapp mellom Innenfor og Over', () => {
    // LAM oppgir «2 – 75» som innenfor og «≥ 75» som over; 75 hører til begge.
    expect(classify(get('LAM'), 75)).toBe('over')
    expect(classify(get('ZUKLO'), 79)).toBe('over')
    expect(classify(get('BREK'), 600)).toBe('over')
    expect(classify(get('KARSUM'), 300)).toBe('over')
  })

  it('behandler hullet i FLUP som innenfor', () => {
    // Innenfor slutter på 34, Over starter på 36.
    expect(classify(get('FLUP'), 35)).toBe('innenfor')
    expect(classify(get('FLUP'), 36)).toBe('over')
  })
})

describe('levelComment', () => {
  it('gir en kommentar for alle nivåer på alle analytter', () => {
    for (const a of analytes) {
      for (const niva of ['under', 'innenfor', 'over'] as const) {
        expect(levelComment(a, niva).kommentar.length).toBeGreaterThan(20)
      }
    }
  })
})
