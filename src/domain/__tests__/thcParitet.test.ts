import { describe, expect, it } from 'vitest'
import gjeldende from './fasit/thc-regelsett.json'
import gjeldendeTekster from './fasit/thc-tekster.json'
import { fasitniva, forventetKommentar } from './hjelp/thcKommentarfasit'
import {
  beregnKategori,
  FIGURKURVER,
  fortolkThc as gammelFortolk,
  type Sikkerhetsmargin,
} from './hjelp/thcOpprinnelig'
import { fortolkThc as nyFortolk, konklusjon, lagThcModell, type ThcInndata } from '../thcMotor'
import type { ThcRegelsett } from '../thcRegelsett'
import type { ThcTekster } from '../thcTekster'
import { formaterDatoNorsk, lesTall } from '../thcTall'
import { byggGraf, figurkurver } from '../thcPlot'

/**
 * Den nye motoren mot den opprinnelige modulen, side om side, på tilfeldige
 * inndata. Fasiten dekker grensene systematisk; dette fanger det rutenettet
 * ikke tenkte på. Den opprinnelige modulen er fryst i `hjelp/thcOpprinnelig.ts`
 * og brukes bare her, i den gamle testen av den og til å lage fasiten.
 *
 * Konklusjonen, manglene, varselet og tallene skal være de samme. Ordlyden er
 * ny (12.10.2026): kommentaren skal være eierens for det nivået og den
 * konklusjonen den opprinnelige modulen ga (`hjelp/thcKommentarfasit.ts`).
 */
const REGELSETT = gjeldende as ThcRegelsett
const MODELL = (() => {
  const m = lagThcModell(REGELSETT, gjeldendeTekster as ThcTekster)
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
      const gammelKonklusjon = inn.ingenTidligere
        ? 'uten_forrige'
        : gammel.type === 'mangler'
          ? null
          : gammel.kategori >= 4
            ? 'nytt_inntak'
            : gammel.kategori === 3
              ? 'vanskelig'
              : 'ikke_nodvendigvis'
      const likt =
        gammel.type === 'mangler' || ny.type === 'mangler'
          ? JSON.stringify(gammel) === JSON.stringify(ny)
          : ny.kommentar ===
              forventetKommentar(
                fasitniva(lesTall(inn.aktuellVerdi)!),
                gammelKonklusjon!,
                !inn.ingenTidligere && inn.forrigeUnderCutoff,
                formaterDatoNorsk(inn.forrigeDato),
              ) &&
            gammel.merEnn30Dager === ny.langtMellomProvene &&
            JSON.stringify(gammel.grunnlag) === JSON.stringify(ny.grunnlag) &&
            ny.konklusjon === gammelKonklusjon &&
            (ny.grunnlag === null ||
              ny.grunnlag.dager < 1 ||
              JSON.stringify(byggGraf(ny.grunnlag, figurkurver(REGELSETT))) === JSON.stringify(byggGraf(ny.grunnlag, FIGURKURVER)))
      if (!likt) avvik.push(JSON.stringify(inn))
    }
    expect(avvik).toEqual([])
  })
})

describe('konklusjonen mot den opprinnelige modulen', () => {
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
