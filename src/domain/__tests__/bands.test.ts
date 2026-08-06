import { describe, expect, it } from 'vitest'
import { analytes, findByCode } from '../analytes'
import { bands, findBand } from '../bands'
import { classify } from '../concentration'
import type { Analyte } from '../../types'

function get(kode: string): Analyte {
  const a = findByCode(kode)
  if (!a) throw new Error(`Fant ikke ${kode}`)
  return a
}

function labels(kode: string): string[] {
  return bands(get(kode)).map((b) => b.label)
}

describe('bands', () => {
  it('slår sammen «over» og «over ringegrensen» når grensene er like', () => {
    // AMTNORSUM: under < 10, innenfor 10–1799, over ≥ 1800, ringegrense 1800.
    expect(labels('AMTNORSUM')).toEqual(['< 10', '10 – 1799', '≥ 1800'])
    const over = bands(get('AMTNORSUM'))[2]
    expect(over?.ring).toBe(true)
    expect(over?.tone).toBe('ring')
  })

  it('deler «over» i to når ringegrensen ligger over den', () => {
    // ZUKLO: over ≥ 79, ringegrense 100.
    expect(labels('ZUKLO')).toEqual(['< 1', '1 – 78', '79 – 100', '≥ 101'])
    const [, , over, ring] = bands(get('ZUKLO'))
    expect(over?.ring).toBe(false)
    expect(over?.tone).toBe('over')
    expect(ring?.ring).toBe(true)
    expect(ring?.tone).toBe('ring')
  })

  it('deler «innenfor» i to når ringegrensen ligger inni den', () => {
    // DOKSUM: innenfor 20–1099, over ≥ 1100, ringegrense 1000.
    expect(labels('DOKSUM')).toEqual(['< 20', '20 – 1000', '1001 – 1099', '≥ 1100'])
    const [, innenfor, innenforRing, over] = bands(get('DOKSUM'))
    expect(innenfor?.ring).toBe(false)
    expect(innenforRing?.ring).toBe(true)
    // Samme kommentar som det udelte båndet — bare ringepåminnelsen skiller.
    expect(innenforRing?.kommentar).toBe(innenfor?.kommentar)
    expect(innenforRing?.tone).toBe('innenfor')
    expect(over?.ring).toBe(true)
  })

  it('regner med desimaler der analytten har det', () => {
    // FLUP: under < 0,6, innenfor til 36, over ≥ 36, ringegrense 35.
    expect(labels('FLUP')).toEqual(['< 0,6', '0,6 – 35', '35,1 – 35,9', '≥ 36'])
    expect(labels('PERF')).toEqual(['< 0,6', '0,6 – 13,9', '≥ 14'])
  })

  it('gir tre eller fire bånd for alle analytter', () => {
    for (const a of analytes) {
      const n = bands(a).length
      expect(n, a.kode).toBeGreaterThanOrEqual(3)
      expect(n, a.kode).toBeLessThanOrEqual(4)
    }
  })

  it('gir hvert bånd en unik nøkkel som kan slås opp igjen', () => {
    for (const a of analytes) {
      const keys = bands(a).map((b) => b.key)
      expect(new Set(keys).size, a.kode).toBe(keys.length)
      for (const key of keys) expect(findBand(a, key)?.key).toBe(key)
    }
  })

  it('gir hvert bånd kommentaren som hører til nivået sitt', () => {
    for (const a of analytes) {
      for (const band of bands(a)) {
        const forventet = a.nivaer.find((n) => n.niva === band.niva)?.kommentar
        expect(band.kommentar, `${a.kode}/${band.key}`).toBe(forventet)
      }
    }
  })

  it('dekker hele tallinjen uten hull eller overlapp', () => {
    for (const a of analytes) {
      const b = bands(a)
      expect(b[0]?.fra, a.kode).toBeNull()
      expect(b.at(-1)?.til, a.kode).toBeNull()
      for (let i = 1; i < b.length; i += 1) {
        const forrige = b[i - 1]?.til
        const neste = b[i]?.fra
        expect(forrige, `${a.kode} bånd ${i}`).not.toBeNull()
        expect(neste, `${a.kode} bånd ${i}`).not.toBeNull()
        // Neste bånd starter ett steg over der forrige sluttet.
        expect(neste as number).toBeGreaterThan(forrige as number)
      }
    }
  })

  it('gir hvert bånd samme nivå som classify gir for verdiene i det', () => {
    for (const a of analytes) {
      for (const band of bands(a)) {
        const prover = [band.fra, band.til].filter((v): v is number => v !== null)
        if (band.fra !== null && band.til !== null) prover.push((band.fra + band.til) / 2)
        for (const verdi of prover) {
          expect(classify(a, verdi), `${a.kode}/${band.key} @ ${verdi}`).toBe(band.niva)
        }
      }
    }
  })

  it('setter ringeflagget på båndene som ligger over ringegrensen', () => {
    for (const a of analytes) {
      if (a.ringegrense === null) continue
      const b = bands(a)
      // Det øverste båndet er alltid over ringegrensen, det nederste under.
      expect(b.at(-1)?.ring, a.kode).toBe(true)
      expect(b[0]?.ring, a.kode).toBe(false)
      // Ingen bånd uten ringeflagg strekker seg forbi ringegrensen.
      for (const band of b) {
        if (!band.ring && band.til !== null) {
          expect(band.til, `${a.kode}/${band.key}`).toBeLessThanOrEqual(a.ringegrense)
        }
      }
    }
  })
})
