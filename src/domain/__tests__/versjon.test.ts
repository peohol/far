/**
 * Holder endringsloggen i form.
 *
 * Loggen skrives for hånd, én føring per endring, og feil i den er lette å
 * gjøre og vanskelige å se: en versjon som ikke stiger, en dato på feil form,
 * et merke som er stavet annerledes. Testen fanger dem her i stedet for hos
 * brukeren, så protokollen i `docs/endringslogg.md` ikke må leses på nytt for
 * å kontrollere arbeidet.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { ENDRINGSLOGG } from '../../data/endringslogg'
import {
  ENDRINGSTYPER,
  formaterDato,
  lesVersjon,
  nyesteVersjon,
  OMFANG,
  sammenlignVersjon,
  type Endring,
} from '../versjon'

describe('formaterDato', () => {
  it('gir dd.mm.åååå', () => {
    expect(formaterDato('2026-08-17')).toBe('17.08.2026')
  })

  it('beholder de innledende nullene i ensifret dag og måned', () => {
    expect(formaterDato('2026-01-05')).toBe('05.01.2026')
  })

  it('nekter datoer som ikke er på ISO-form', () => {
    expect(() => formaterDato('17.08.2026')).toThrow()
    expect(() => formaterDato('2026-8-17')).toThrow()
  })
})

describe('sammenlignVersjon', () => {
  it('teller MAJOR foran MINOR foran PATCH', () => {
    expect(sammenlignVersjon('1.0.0', '0.9.9')).toBeGreaterThan(0)
    expect(sammenlignVersjon('0.5.1', '0.5.0')).toBeGreaterThan(0)
    expect(sammenlignVersjon('0.5.0', '0.6.0')).toBeLessThan(0)
    expect(sammenlignVersjon('1.2.3', '1.2.3')).toBe(0)
  })

  // Nettopp her ville en ren tekstsammenligning tatt feil: «0.10.0» kommer
  // før «0.9.0» alfabetisk, men er den nyere versjonen.
  it('leser tallene som tall, ikke som tekst', () => {
    expect(sammenlignVersjon('0.10.0', '0.9.0')).toBeGreaterThan(0)
  })

  it('nekter versjoner som ikke er MAJOR.MINOR.PATCH', () => {
    expect(lesVersjon('1.0')).toBeNull()
    expect(lesVersjon('v1.0.0')).toBeNull()
    expect(() => sammenlignVersjon('1.0', '1.0.0')).toThrow()
  })
})

describe('nyesteVersjon', () => {
  it('er den øverste føringen', () => {
    expect(nyesteVersjon(ENDRINGSLOGG)).toBe(ENDRINGSLOGG[0]?.versjon)
  })

  it('sier fra i stedet for å gjette når loggen er tom', () => {
    expect(() => nyesteVersjon([])).toThrow()
  })
})

describe('endringsloggen', () => {
  it('har minst én føring', () => {
    expect(ENDRINGSLOGG.length).toBeGreaterThan(0)
  })

  it('står nyest først, med strengt synkende versjoner', () => {
    for (let i = 1; i < ENDRINGSLOGG.length; i++) {
      const nyere = ENDRINGSLOGG[i - 1] as Endring
      const eldre = ENDRINGSLOGG[i] as Endring
      expect(
        sammenlignVersjon(nyere.versjon, eldre.versjon),
        `${nyere.versjon} skal være nyere enn ${eldre.versjon}`,
      ).toBeGreaterThan(0)
    }
  })

  it('bruker hver versjon bare én gang', () => {
    const versjoner = ENDRINGSLOGG.map((e) => e.versjon)
    expect(new Set(versjoner).size).toBe(versjoner.length)
  })

  it('går ikke framover i tid nedover i lista', () => {
    for (let i = 1; i < ENDRINGSLOGG.length; i++) {
      const nyere = ENDRINGSLOGG[i - 1] as Endring
      const eldre = ENDRINGSLOGG[i] as Endring
      // ISO-datoer sorterer riktig som tekst.
      expect(
        nyere.dato >= eldre.dato,
        `${nyere.versjon} (${nyere.dato}) kan ikke være eldre enn ${eldre.versjon} (${eldre.dato})`,
      ).toBe(true)
    }
  })

  it.each(ENDRINGSLOGG.map((e) => [e.versjon, e] as const))('%s er fullstendig', (_v, endring) => {
    expect(lesVersjon(endring.versjon), 'versjonen må være MAJOR.MINOR.PATCH').not.toBeNull()

    // Datoen skal både være på riktig form og finnes i kalenderen.
    expect(() => formaterDato(endring.dato)).not.toThrow()
    expect(new Date(`${endring.dato}T00:00:00Z`).toISOString().slice(0, 10)).toBe(endring.dato)

    expect(endring.sammendrag.trim()).not.toBe('')
    expect(endring.punkter.length).toBeGreaterThan(0)
    endring.punkter.forEach((punkt) => expect(punkt.trim()).not.toBe(''))

    expect(endring.typer.length).toBeGreaterThan(0)
    expect(new Set(endring.typer).size).toBe(endring.typer.length)
    endring.typer.forEach((type) => expect(ENDRINGSTYPER).toContain(type))

    expect(OMFANG).toContain(endring.omfang)
  })
})

describe('package.json', () => {
  it('har samme versjon som den nyeste føringen', () => {
    const sti = fileURLToPath(new URL('../../../package.json', import.meta.url))
    const pakke = JSON.parse(readFileSync(sti, 'utf8')) as { version?: string }
    expect(pakke.version).toBe(nyesteVersjon(ENDRINGSLOGG))
  })
})
