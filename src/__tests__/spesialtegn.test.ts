/**
 * Spesialtegnene i tegnmenyen: de samme gruppene og tegnene som i mdeditz,
 * og «Nylig» med de sist brukte.
 */
import { describe, expect, it } from 'vitest'
import { NYLIG, NYLIG_MAKS, TEGNGRUPPER, TEGNNAVN, medBruktTegn, nyligeTegn, tegngrupper } from '../faginnhold/spesialtegn'

describe('spesialtegnene', () => {
  it('har gruppene fra mdeditz, i samme rekkefølge og med like mange tegn', () => {
    expect(TEGNGRUPPER.map((g) => [g.etikett, g.tegn.length])).toEqual([
      ['Piler', 28],
      ['Matematikk', 56],
      ['Gresk', 35],
      ['Typografi', 28],
      ['Merker', 24],
      ['Valuta og enheter', 18],
      ['Tastatur', 15],
      ['Bokstaver', 42],
    ])
    for (const gruppe of TEGNGRUPPER) expect(new Set(gruppe.tegn.map(([t]) => t)).size).toBe(gruppe.tegn.length)
  })

  it('gir et tegn som står i to grupper, navnet fra den første', () => {
    expect(TEGNNAVN.get('°')).toBe('Grader')
    expect(TEGNNAVN.get('µ')).toBe('Mikro')
    expect(TEGNNAVN.get('μ')).toBe('My')
  })

  it('husker de sist brukte, nyeste først, uten dubletter og ukjente tegn', () => {
    expect(nyligeTegn(['α', 'x', 3, '→'])).toEqual(['α', '→'])
    expect(nyligeTegn('α')).toEqual([])
    expect(medBruktTegn(['α', '→'], '→')).toEqual(['→', 'α'])
    const mange = TEGNGRUPPER[0]!.tegn.map(([t]) => t)
    expect(medBruktTegn(mange, 'α')).toHaveLength(NYLIG_MAKS)
  })

  it('setter «Nylig» først bare når noe er brukt', () => {
    expect(tegngrupper([])[0]!.etikett).toBe('Piler')
    const [nylig, forste] = tegngrupper(['β'])
    expect(nylig).toEqual({ id: NYLIG, etikett: 'Nylig', tegn: [['β', 'Beta']] })
    expect(forste!.etikett).toBe('Piler')
  })
})
