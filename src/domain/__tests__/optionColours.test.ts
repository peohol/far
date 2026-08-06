import { describe, expect, it } from 'vitest'
import { MAX_RESULTS } from '../search'
import { OPTION_LIGHTNESS, OPTION_SATURATION, optionColour, optionHue } from '../optionColours'
import { contrastRatio } from '../contrast'

describe('optionHue', () => {
  it('starter alltid på 0°', () => {
    for (let n = 1; n <= MAX_RESULTS; n += 1) {
      expect(optionHue(0, n)).toBe(0)
    }
  })

  it('sprer alternativene jevnt rundt fargesirkelen', () => {
    for (let n = 2; n <= MAX_RESULTS; n += 1) {
      const hues = Array.from({ length: n }, (_, i) => optionHue(i, n))
      const avstander = hues.slice(1).map((h, i) => h - (hues[i] ?? 0))
      for (const d of avstander) expect(d).toBeCloseTo(360 / n, 6)
    }
  })

  it('gir første alternativ hsl(0 40% 70%)', () => {
    expect(optionColour(0, 5).solid).toBe(`hsl(0 ${OPTION_SATURATION}% ${OPTION_LIGHTNESS}%)`)
  })
})

describe('kontrast på tallmerket', () => {
  it('holder AA for stor tekst i alle hues', () => {
    for (let n = 1; n <= MAX_RESULTS; n += 1) {
      for (let i = 0; i < n; i += 1) {
        const { solid, ink } = optionColour(i, n)
        expect(contrastRatio(solid, ink)).toBeGreaterThanOrEqual(4.5)
      }
    }
  })
})
