/**
 * Passordene.
 *
 * Det midlertidige passordet er det eneste som står mellom en ny konto og
 * hvem som helst, i det korte vinduet før brukeren har byttet det. Testen
 * kontrollerer at det faktisk er tilfeldig, langt nok og satt sammen av det
 * tegnsettet vi mener å bruke.
 */
import { describe, expect, it } from 'vitest'
import {
  genererMidlertidigPassord,
  MIDLERTIDIG_PASSORD_LENGDE,
  PASSORD_MINST,
  passordFeil,
} from '@delt/passord'

/** Tegnene som er tatt ut fordi de lett forveksles visuelt. */
const FORVEKSLINGER = ['0', 'O', '1', 'l', 'I']

describe('genererMidlertidigPassord', () => {
  it('har den avtalte lengden', () => {
    expect(genererMidlertidigPassord()).toHaveLength(MIDLERTIDIG_PASSORD_LENGDE)
    expect(genererMidlertidigPassord()).toHaveLength(16)
  })

  it('bruker bare tegn fra tegnsettet', () => {
    for (let i = 0; i < 200; i++) {
      expect(genererMidlertidigPassord()).toMatch(/^[a-zA-Z2-9]+$/)
    }
  })

  it('utelater tegn som lett forveksles', () => {
    for (let i = 0; i < 200; i++) {
      const passord = genererMidlertidigPassord()
      for (const tegn of FORVEKSLINGER) {
        expect(passord.includes(tegn), `${passord} inneholder ${tegn}`).toBe(false)
      }
    }
  })

  it('har alltid både små bokstaver, store bokstaver og tall', () => {
    for (let i = 0; i < 200; i++) {
      const passord = genererMidlertidigPassord()
      expect(passord, passord).toMatch(/[a-z]/)
      expect(passord, passord).toMatch(/[A-Z]/)
      expect(passord, passord).toMatch(/[2-9]/)
    }
  })

  it('gir et nytt passord hver gang', () => {
    const sett = new Set(Array.from({ length: 300 }, () => genererMidlertidigPassord()))
    expect(sett.size).toBe(300)
  })

  it('legger ikke de tre påkrevde tegnene først', () => {
    // Uten stokkingen ville plass 1 alltid vært liten bokstav, plass 2 stor
    // og plass 3 et tall. Over mange trekninger skal alle tre variere.
    const forste = new Set<string>()
    const andre = new Set<string>()
    const tredje = new Set<string>()
    for (let i = 0; i < 200; i++) {
      const passord = genererMidlertidigPassord()
      forste.add(kategori(passord[0] as string))
      andre.add(kategori(passord[1] as string))
      tredje.add(kategori(passord[2] as string))
    }
    expect(forste.size).toBeGreaterThan(1)
    expect(andre.size).toBeGreaterThan(1)
    expect(tredje.size).toBeGreaterThan(1)
  })

  it('nekter en lengde under minstekravet', () => {
    expect(() => genererMidlertidigPassord(PASSORD_MINST - 1)).toThrow()
  })
})

function kategori(tegn: string): string {
  if (/[a-z]/.test(tegn)) return 'liten'
  if (/[A-Z]/.test(tegn)) return 'stor'
  return 'tall'
}

describe('passordFeil', () => {
  it('krever at feltet er fylt ut', () => {
    expect(passordFeil('')).toBe('Skriv inn et passord.')
  })

  it('krever minstelengden, og godtar den akkurat', () => {
    expect(passordFeil('a'.repeat(PASSORD_MINST - 1))).toContain(`minst ${PASSORD_MINST}`)
    expect(passordFeil('a'.repeat(PASSORD_MINST))).toBeNull()
  })

  it('godtar et midlertidig passord som det er', () => {
    expect(passordFeil(genererMidlertidigPassord())).toBeNull()
  })
})
