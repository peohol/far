import { describe, expect, it } from 'vitest'
import importert from './fasit/thc-regelsett-import.json'
import importerteTekster from './fasit/thc-tekster-import.json'
import {
  beregnKategori,
  byggKommentar,
  FIGURKURVER,
  fortolkThc as gammelFortolk,
  type Konsentrasjonsniva,
  type Sikkerhetsmargin,
} from './hjelp/thcOpprinnelig'
import {
  fortolkThc as nyFortolk,
  konklusjon,
  lagThcModell,
  settSammen,
  THC_KONKLUSJONER,
  velgTekstbolker,
  type ThcInndata,
  type ThcKonklusjon,
} from '../thcMotor'
import type { ThcRegelsett } from '../thcRegelsett'
import type { ThcTekster } from '../thcTekster'
import { byggGraf, figurkurver } from '../thcPlot'

/**
 * Den nye motoren mot den opprinnelige modulen, side om side, på tilfeldige
 * inndata. Fasiten dekker grensene systematisk; dette fanger det rutenettet
 * ikke tenkte på. Den opprinnelige modulen er fryst i `hjelp/thcOpprinnelig.ts`
 * og brukes bare her, i den gamle testen av den og til å lage fasiten.
 */
const REGELSETT = importert as ThcRegelsett
const MODELL = (() => {
  const m = lagThcModell(REGELSETT, importerteTekster as ThcTekster)
  if (!m.ok) throw new Error(m.feil.join('\n'))
  return m.modell
})()

/** Fast frø, så et avvik kan gjenskapes. */
function tilfeldig(frø: number) {
  let s = frø >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe('den nye motoren mot den opprinnelige modulen', () => {
  it('gir nøyaktig samme utfall på 20 000 tilfeldige prøvepar', () => {
    const r = tilfeldig(20260923)
    const velg = <T,>(liste: readonly T[]) => liste[Math.floor(r() * liste.length)]!
    const tall = () => {
      const x = Math.exp(r() * 14 - 7) // fra 0,001 til 1100, logaritmisk
      return velg([String(x), x.toFixed(2).replace('.', ','), x.toFixed(0), '0', ''])
    }
    const dato = () => {
      const d = new Date(Date.UTC(2026, 0, 1) + Math.floor(r() * 400) * 86_400_000)
      return r() < 0.02 ? '' : d.toISOString().slice(0, 10)
    }

    const avvik: string[] = []
    for (let i = 0; i < 20_000 && avvik.length < 5; i++) {
      const inn: ThcInndata = {
        kronisk: r() < 0.5,
        aktuellVerdi: tall(),
        aktuellDato: dato(),
        ingenTidligere: r() < 0.1,
        forrigeUnderCutoff: r() < 0.25,
        forrigeVerdi: tall(),
        forrigeUcak: tall(),
        forrigeNkre: tall(),
        forrigeDato: dato(),
        sikkerhetsmargin: velg([0.5, 0.9, 0.99]),
      }
      const gammel = gammelFortolk({ ...inn, sikkerhetsmargin: inn.sikkerhetsmargin as Sikkerhetsmargin })
      const ny = nyFortolk(inn, MODELL)
      const likt =
        gammel.type === 'mangler' || ny.type === 'mangler'
          ? JSON.stringify(gammel) === JSON.stringify(ny)
          : gammel.kommentar === ny.kommentar &&
            gammel.merEnn30Dager === ny.langtMellomProvene &&
            JSON.stringify(gammel.grunnlag) === JSON.stringify(ny.grunnlag) &&
            (inn.ingenTidligere
              ? ny.konklusjon === 'uten_forrige'
              : ny.konklusjon ===
                (gammel.kategori >= 4 ? 'nytt_inntak' : gammel.kategori === 3 ? 'vanskelig' : 'ikke_nodvendigvis')) &&
            (ny.grunnlag === null ||
              ny.grunnlag.dager < 1 ||
              JSON.stringify(byggGraf(ny.grunnlag, figurkurver(REGELSETT))) === JSON.stringify(byggGraf(ny.grunnlag, FIGURKURVER)))
      if (!likt) avvik.push(JSON.stringify(inn))
    }
    expect(avvik).toEqual([])
  })
})

/** Kategorien den opprinnelige modulen ga hver konklusjon, med kronisk bruk lagt til grunn. */
const KATEGORI: Record<ThcKonklusjon, number> = { uten_forrige: 0, ikke_nodvendigvis: 2, vanskelig: 3, nytt_inntak: 4 }

describe('tekstbolkene mot den opprinnelige modulen', () => {
  it('gir samme kommentar for hvert nivå og hver konklusjon, med og uten cut-off', () => {
    for (const niva of MODELL.regler.konsentrasjonsnivaer) {
      for (const utfall of THC_KONKLUSJONER) {
        for (const underCutoff of [true, false]) {
          const ny = settSammen(MODELL.tekster, velgTekstbolker(niva, utfall, underCutoff), {
            niva: niva.navn,
            forrigeDato: '01.02.2026',
          })
          const gammel = byggKommentar(
            niva.navn as Konsentrasjonsniva,
            KATEGORI[utfall],
            utfall !== 'uten_forrige',
            '01.02.2026',
            underCutoff,
          )
          expect(ny, `${niva.navn}, ${utfall}, under cut-off: ${underCutoff}`).toBe(gammel)
        }
      }
    }
  })

  it('gir samme konklusjon som kategorien, for begge bruksmønstrene', () => {
    const forventet = { gronn: 1, gul: 2, rod: 3 }
    for (const kronisk of [true, false]) {
      for (const korrigert of [0.5, 1, 1.5, 2, 2.5, 3, 3.5]) {
        const kategori = beregnKategori(true, kronisk, korrigert, forventet)
        const somKonklusjon = kategori >= 4 ? 'nytt_inntak' : kategori === 3 ? 'vanskelig' : 'ikke_nodvendigvis'
        expect(konklusjon(MODELL.regler, kronisk, korrigert, forventet)).toBe(somKonklusjon)
      }
    }
  })
})
