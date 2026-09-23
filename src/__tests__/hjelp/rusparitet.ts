/**
 * Paritetsprøven for rusmiddelreglene: et scenarioregelsett med sine
 * kommentarer skal gi nøyaktig det den opprinnelige rusmiddelmotoren ga.
 *
 * Fasiten (`src/domain/__tests__/fasit/rus-fasit.json`) er det den
 * opprinnelige motoren (`rus.ts` med `rusmidler.json`) svarte, tatt opp rett
 * før fortolkningen ble lagt om til regelsettene i Supabase. For hver modul og
 * hver kombinasjon av påviste analytter står konsentrasjonsfeltene motoren ba
 * om, i begge avkryssingsrekkefølger, og svaret for hver kombinasjon av
 * verdier i feltene — et rutenett som treffer hver grense nøyaktig, rett under
 * og rett over, pluss tomme felt, null og tekst som ikke er tall. Svarene står
 * som løp av like svar, med hvert ulike svar én gang i `resultater`.
 *
 * Brukes både for grunnlaget som ble importert, og for regelsettene slik
 * databasen gir dem tilbake.
 */
import { expect } from 'vitest'
import fasit from '../../domain/__tests__/fasit/rus-fasit.json'
import type { Kommentaroppslag } from '../../domain/kommentarobjekt'
import { flettInn, kjorScenarier, verdifelter, type Scenarioregelsett, type Scenarioresultat } from '../../domain/scenario'

interface Fasitmodul {
  id: string
  verdihjelp: string
  delmengder: { pavist: string[]; felt: string[]; feltBaklengs: string[]; lop: [number, number][] }[]
}

const FASIT = fasit as unknown as { verdier: string[]; resultater: Scenarioresultat[]; moduler: Fasitmodul[] }

/** Modulene fasiten dekker, i den opprinnelige rekkefølgen. */
export const FASITMODULER: string[] = FASIT.moduler.map((m) => m.id)

/** Alle kombinasjoner av fasitens verdier i feltene, som felt → verdi, i fast rekkefølge. */
function verdikombinasjoner(felt: readonly string[]): Record<string, string>[] {
  return felt.reduce<Record<string, string>[]>(
    (alle, navn) => alle.flatMap((k) => FASIT.verdier.map((v) => ({ ...k, [navn]: v }))),
    [{}],
  )
}

/**
 * At regelsettet ber om de samme konsentrasjonene, med den samme
 * hjelpeteksten, og gir nøyaktig det fasiten sier for hele rutenettet — og at
 * hvert scenario treffes minst én gang.
 */
export function forventFasit(regelsett: Scenarioregelsett, kommentarer: Kommentaroppslag): void {
  const modul = FASIT.moduler.find((m) => m.id === regelsett.modul)
  expect(modul, `fasiten mangler ${regelsett.modul}`).toBeDefined()
  expect(flettInn(regelsett.verdihjelp, regelsett.parametere), modul!.id).toBe(modul!.verdihjelp)
  expect(
    modul!.delmengder.map((d) => [...d.pavist].sort().join('+')).sort(),
    'alle kombinasjoner av påviste analytter',
  ).toEqual(
    regelsett.analytter
      .reduce<string[][]>((alle, kode) => [...alle, ...alle.map((d) => [...d, kode])], [[]])
      .map((d) => [...d].sort().join('+'))
      .sort(),
  )

  const truffet = new Set<string>()
  let antall = 0
  for (const { pavist, felt, feltBaklengs, lop } of modul!.delmengder) {
    const baklengs = [...pavist].reverse()
    expect(verdifelter(regelsett, pavist), `${modul!.id} ${pavist.join('+')}`).toEqual(felt)
    expect(verdifelter(regelsett, baklengs), `${modul!.id} ${baklengs.join('+')}`).toEqual(feltBaklengs)

    const forventet = lop.flatMap(([svar, ganger]) => Array<number>(ganger).fill(svar))
    let i = 0
    for (const verdier of verdikombinasjoner(felt)) {
      for (const rekkefolge of [pavist, baklengs]) {
        const inn = { pavist: rekkefolge, verdier }
        const ny = kjorScenarier(regelsett, kommentarer, inn)
        expect(ny.resultat, `${modul!.id} ${JSON.stringify(inn)}`).toEqual(FASIT.resultater[forventet[i]!])
        if (ny.scenario) truffet.add(ny.scenario.nokkel)
        i++
        antall++
      }
    }
    expect(i, `${modul!.id} ${pavist.join('+')}: antall svar i fasiten`).toBe(forventet.length)
  }
  expect(antall).toBeGreaterThan(0)
  expect([...truffet].sort(), modul!.id).toEqual(regelsett.scenarier.map((s) => s.nokkel).sort())
}
