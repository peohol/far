/**
 * Brukernavnene.
 *
 * Reglene står tre steder — i appen, i Edge-funksjonene og i databasen — og
 * det er den samme modulen som brukes de to første stedene. Testen her holder
 * reglene i sjakk, og `sqlregler.test.ts` holder databasen i takt med dem.
 */
import { describe, expect, it } from 'vitest'
import {
  BRUKERNAVN_MEST,
  BRUKERNAVN_MINST,
  brukernavnFeil,
  brukernavnFraAuthAdresse,
  erGyldigBrukernavn,
  INTERN_AUTH_DOMENE,
  internAuthAdresse,
  normaliserBrukernavn,
} from '@delt/brukernavn'

describe('normaliserBrukernavn', () => {
  it('gjør om til små bokstaver', () => {
    expect(normaliserBrukernavn('PeoHol')).toBe('peohol')
    expect(normaliserBrukernavn('OLA.NORDMANN')).toBe('ola.nordmann')
  })

  it('fjerner mellomrom rundt navnet', () => {
    expect(normaliserBrukernavn('  peohol\n')).toBe('peohol')
    expect(normaliserBrukernavn('\t PeoHol  ')).toBe('peohol')
  })

  it('lar et allerede normalisert navn stå urørt', () => {
    expect(normaliserBrukernavn('peohol')).toBe('peohol')
  })
})

describe('erGyldigBrukernavn', () => {
  it('godtar vanlige OUS-brukernavn', () => {
    for (const navn of ['peohol', 'ola.nordmann', 'kari-hansen', 'test_bruker', 'lege2']) {
      expect(erGyldigBrukernavn(navn), navn).toBe(true)
    }
  })

  it('avviser store bokstaver og mellomrom', () => {
    expect(erGyldigBrukernavn('PeoHol')).toBe(false)
    expect(erGyldigBrukernavn('ola nordmann')).toBe(false)
    expect(erGyldigBrukernavn(' peohol')).toBe(false)
  })

  it('avviser tegn utenfor tegnsettet', () => {
    for (const navn of ['ole@ous', 'kari/hansen', 'bjørn', 'per+kari', 'kari!']) {
      expect(erGyldigBrukernavn(navn), navn).toBe(false)
    }
  })

  it('avviser skilletegn først, sist og to på rad', () => {
    for (const navn of ['.peohol', 'peohol.', '-peohol', 'peohol_', 'ola..nordmann', 'ola.-hansen']) {
      expect(erGyldigBrukernavn(navn), navn).toBe(false)
    }
  })

  it('holder seg innenfor lengdegrensene', () => {
    expect(erGyldigBrukernavn('a'.repeat(BRUKERNAVN_MINST - 1))).toBe(false)
    expect(erGyldigBrukernavn('a'.repeat(BRUKERNAVN_MINST))).toBe(true)
    expect(erGyldigBrukernavn('a'.repeat(BRUKERNAVN_MEST))).toBe(true)
    expect(erGyldigBrukernavn('a'.repeat(BRUKERNAVN_MEST + 1))).toBe(false)
  })

  it('avviser tomt brukernavn', () => {
    expect(erGyldigBrukernavn('')).toBe(false)
  })
})

describe('brukernavnFeil', () => {
  it('gir ingen melding for et gyldig navn', () => {
    expect(brukernavnFeil('peohol')).toBeNull()
  })

  it('sier fra på norsk hva som er galt', () => {
    expect(brukernavnFeil('')).toBe('Skriv inn et brukernavn.')
    expect(brukernavnFeil('PeoHol')).toContain('små bokstaver')
    expect(brukernavnFeil('ab')).toContain(`minst ${BRUKERNAVN_MINST}`)
    expect(brukernavnFeil('a'.repeat(BRUKERNAVN_MEST + 1))).toContain(`høyst ${BRUKERNAVN_MEST}`)
    expect(brukernavnFeil('ole@ous')).toContain('a–z')
  })
})

describe('internAuthAdresse', () => {
  it('utleder adressen av brukernavnet alene', () => {
    expect(internAuthAdresse('peohol')).toBe(`peohol@${INTERN_AUTH_DOMENE}`)
    expect(internAuthAdresse('peohol')).toBe('peohol@auth.ousfar.invalid')
  })

  it('bruker et domene som aldri kan eksistere', () => {
    expect(INTERN_AUTH_DOMENE.endsWith('.invalid')).toBe(true)
  })

  it('gir alltid det samme for det samme brukernavnet', () => {
    expect(internAuthAdresse('ola.nordmann')).toBe(internAuthAdresse('ola.nordmann'))
  })

  it('nekter å bygge en adresse av et ugyldig brukernavn', () => {
    expect(() => internAuthAdresse('PeoHol')).toThrow()
    expect(() => internAuthAdresse('ole@ous')).toThrow()
    expect(() => internAuthAdresse('')).toThrow()
  })
})

describe('brukernavnFraAuthAdresse', () => {
  it('finner brukernavnet igjen', () => {
    expect(brukernavnFraAuthAdresse('peohol@auth.ousfar.invalid')).toBe('peohol')
  })

  it('avviser adresser utenfor det interne domenet', () => {
    expect(brukernavnFraAuthAdresse('peohol@ous-hf.no')).toBeNull()
    expect(brukernavnFraAuthAdresse('peohol@gmail.com')).toBeNull()
    expect(brukernavnFraAuthAdresse('peohol')).toBeNull()
  })
})
