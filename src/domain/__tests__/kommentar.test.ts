import { describe, expect, it } from 'vitest'
import { kanSkriveOver } from '../kommentar'

/**
 * Utfallet av en kopiering kommer først etter en tur innom utklippstavlen, og
 * i mellomtiden kan skjemaet ha fått et nytt svar. Regelen avgjør hvilket
 * utfall som blir stående.
 */
describe('kanSkriveOver', () => {
  it('lar utfallet stå når det ikke står noe fra før', () => {
    expect(kanSkriveOver(null, 3)).toBe(true)
  })

  it('lar en ny kopiering i samme utgave legge seg oppå den forrige', () => {
    expect(kanSkriveOver({ utgave: 3 }, 3)).toBe(true)
  })

  it('lar utfallet skrive over noe som hører til en eldre fortolkning', () => {
    expect(kanSkriveOver({ utgave: 2 }, 3)).toBe(true)
  })

  it('holder igjen et utfall som er innhentet av en nyere kopiering', () => {
    // Her ligger feilen regelen finnes for: en kopiering som lyktes sent skal
    // ikke ta bort reserveteksten for en nyere kopiering som nettopp feilet.
    expect(kanSkriveOver({ utgave: 4 }, 3)).toBe(false)
  })
})
