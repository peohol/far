import { describe, expect, it } from 'vitest'
import { renskTall } from '../tallfelt'
import { lesKonsentrasjon } from '../scenario'
import { lesTall } from '../thcTall'

describe('hva et konsentrasjonsfelt tar imot', () => {
  it('tar imot tall med både komma og punktum', () => {
    expect(renskTall('12')).toBe('12')
    expect(renskTall('0,5')).toBe('0,5')
    expect(renskTall('0.5')).toBe('0.5')
  })

  it('tar imot tallet slik det ser ut mens det skrives', () => {
    // Feltet er tomt før noe er skrevet, og desimaltegnet står et øyeblikk
    // alene bakerst. Begge må slippe gjennom, ellers kan tallet ikke skrives.
    expect(renskTall('')).toBe('')
    expect(renskTall('12,')).toBe('12,')
    expect(renskTall(',5')).toBe(',5')
  })

  it('avviser bokstaver, fortegn og enheter', () => {
    expect(renskTall('abc')).toBeNull()
    expect(renskTall('12e3')).toBeNull()
    expect(renskTall('-1')).toBeNull()
    expect(renskTall('12 µg/L')).toBeNull()
    expect(renskTall('1,2,3')).toBeNull()
  })

  it('lar ikke et mellomrom bli stående i tallet', () => {
    // Dette er hele poenget med at feltene er numeriske: mellomrom er ledig
    // til å kopiere kommentaren, og skal ikke kunne havne i en konsentrasjon.
    expect(renskTall('12 ')).toBe('12')
    expect(renskTall(' 0,5 ')).toBe('0,5')
    expect(renskTall('1 2')).toBe('12')
  })

  it('gir en verdi fortolkningen leser som et tall', () => {
    // Et ferdig utfylt felt skal aldri kunne stå med noe modulene ikke får
    // lest. Verdier under skriving er ennå ikke tall, og gir «mangler».
    for (const tastet of ['12', '0,5', '0.5', '1234', '0,05']) {
      const verdi = renskTall(tastet)
      expect(verdi).not.toBeNull()
      expect(lesKonsentrasjon(verdi as string)).not.toBeNull()
      expect(lesTall(verdi as string)).not.toBeNull()
    }
  })
})
