import { describe, expect, it } from 'vitest'
import { analytes, findByCode } from '../analytes'
import {
  classify,
  isAboveCallLimit,
  isOutsideMeasuringRange,
  levelComment,
  parseConcentration,
  sanitiseConcentrationInput,
} from '../concentration'
import type { Analyte } from '../../types'

function get(kode: string): Analyte {
  const a = findByCode(kode)
  if (!a) throw new Error(`Fant ikke ${kode}`)
  return a
}

describe('parseConcentration', () => {
  it('godtar norsk desimalkomma og punktum', () => {
    expect(parseConcentration('0,6')).toBe(0.6)
    expect(parseConcentration('0.6')).toBe(0.6)
    expect(parseConcentration(' 1799 ')).toBe(1799)
  })

  it('avviser tomt og ugyldig innhold', () => {
    expect(parseConcentration('')).toBeNull()
    expect(parseConcentration('abc')).toBeNull()
    expect(parseConcentration('1,2,3')).toBeNull()
  })
})

describe('sanitiseConcentrationInput', () => {
  it('slipper gjennom sifre og ett desimalskille', () => {
    expect(sanitiseConcentrationInput('1799')).toBe('1799')
    expect(sanitiseConcentrationInput('0,6')).toBe('0,6')
    expect(sanitiseConcentrationInput('0.6')).toBe('0.6')
    expect(sanitiseConcentrationInput('12,')).toBe('12,')
  })

  it('fjerner alt annet enn sifre og skilletegn', () => {
    expect(sanitiseConcentrationInput('12 mg/L')).toBe('12')
    expect(sanitiseConcentrationInput('-5')).toBe('5')
  })

  it('beholder bare det første skilletegnet, uansett hvilket', () => {
    expect(sanitiseConcentrationInput('1,2.3')).toBe('1,23')
    expect(sanitiseConcentrationInput('1.2,3')).toBe('1.23')
    expect(sanitiseConcentrationInput('1,2,3')).toBe('1,23')
    expect(sanitiseConcentrationInput('1.2.3')).toBe('1.23')
  })

  it('lar alt som slipper gjennom være noe parseConcentration godtar', () => {
    for (const rå of ['1,2.3', '1.2,3', '1,2,3', '12,5', '0.6', '9', '3,', '.5', ',5']) {
      const renset = sanitiseConcentrationInput(rå)
      expect(parseConcentration(renset), `«${rå}» ble «${renset}»`).not.toBeNull()
    }
  })
})

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

describe('ringegrense', () => {
  it('slår ut først over grensen, ikke på den', () => {
    const amt = get('AMTNORSUM') // ringegrense 1800
    expect(isAboveCallLimit(amt, 1800)).toBe(false)
    expect(isAboveCallLimit(amt, 1801)).toBe(true)
  })

  it('kan slå ut mens verdien fortsatt er innenfor', () => {
    const flup = get('FLUP') // ringegrense 35, over ≥ 36
    expect(classify(flup, 35.5)).toBe('innenfor')
    expect(isAboveCallLimit(flup, 35.5)).toBe(true)
  })
})

describe('måleområde', () => {
  it('kjenner igjen verdier utenfor det analysen kan måle', () => {
    const klorp = get('KLORP') // måleområde 5 – 500
    expect(isOutsideMeasuringRange(klorp, 300)).toBe(false)
    expect(isOutsideMeasuringRange(klorp, 600)).toBe(true)
    expect(isOutsideMeasuringRange(klorp, 1)).toBe(true)
  })

  it('bruker ytterpunktene når sumanalyser har ett område per delanalytt', () => {
    const kar = get('KARSUM') // KARI 2–120, DKARI 2–120, DDKARI 10–300
    expect(isOutsideMeasuringRange(kar, 250)).toBe(false)
    expect(isOutsideMeasuringRange(kar, 301)).toBe(true)
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
