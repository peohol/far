/**
 * Paritetsprøven for rusmiddelreglene: et scenarioregelsett med sine
 * kommentarer kjøres mot dagens modul over alle kombinasjoner av påviste
 * analytter, og over et rutenett av konsentrasjoner som treffer hver grense
 * nøyaktig, rett under og rett over — pluss tomme felt, null og tekst som
 * ikke er tall. Resultatet skal være identisk.
 *
 * Brukes både for regelsettene i koden og for dem som er lagret i databasen.
 */
import { expect } from 'vitest'
import type { Kommentaroppslag } from '../../domain/kommentarobjekt'
import type { RusModul } from '../../domain/rus'
import { kjorScenarier, verdifelter, type Scenarioregelsett } from '../../domain/scenario'

/**
 * Konsentrasjonene som prøves i hvert felt. Med dem blir andelene i
 * diazepamgruppen (OXA / (DIAZ + DMI)) og kodeingruppen (MOR / KOD) både
 * nøyaktig 10 %, 20 % og 100 %, og rett under og over.
 */
const VERDIER = [
  '', ' ', 'abc', '-1', '1 0', '0', '0,0', '0,05', '0,1', '0,19', '0,2', '0,21', '0,5', '0,99', '1', '1,0', '1,01',
  '2', '10', '99', '100', '100,0', '101', '199', '199,9', '200', '200,1', '201', '400', '600', '999', '1000', '1000,5', '1001',
]

export function delmengder(koder: readonly string[]): string[][] {
  return koder.reduce<string[][]>((alle, kode) => [...alle, ...alle.map((d) => [...d, kode])], [[]])
}

function kombinasjoner(felt: readonly string[]): Record<string, string>[] {
  return felt.reduce<Record<string, string>[]>(
    (alle, navn) => alle.flatMap((k) => VERDIER.map((v) => ({ ...k, [navn]: v }))),
    [{}],
  )
}

/** At regelsettet ber om de samme konsentrasjonene som modulen, i begge rekkefølger. */
export function forventSammeVerdifelter(modul: RusModul, regelsett: Scenarioregelsett): void {
  for (const pavist of delmengder(regelsett.analytter)) {
    for (const rekkefolge of [pavist, [...pavist].reverse()]) {
      expect(verdifelter(regelsett, rekkefolge), rekkefolge.join('+')).toEqual(
        modul.verdifelter(rekkefolge).map((f) => f.kode),
      )
    }
  }
}

/**
 * At regelsettet gir nøyaktig det modulen gir for hele rutenettet, og at hvert
 * scenario treffes minst én gang.
 */
export function forventParitet(modul: RusModul, regelsett: Scenarioregelsett, kommentarer: Kommentaroppslag): void {
  const truffet = new Set<string>()
  let antall = 0
  for (const pavist of delmengder(regelsett.analytter)) {
    for (const verdier of kombinasjoner(modul.verdifelter(pavist).map((f) => f.kode))) {
      for (const rekkefolge of [pavist, [...pavist].reverse()]) {
        const inn = { pavist: rekkefolge, verdier }
        const ny = kjorScenarier(regelsett, kommentarer, inn)
        expect(ny.resultat, `${modul.id} ${JSON.stringify(inn)}`).toEqual(modul.fortolk(inn))
        if (ny.scenario) truffet.add(ny.scenario.nokkel)
        antall++
      }
    }
  }
  expect(antall).toBeGreaterThan(0)
  expect([...truffet].sort(), modul.id).toEqual(regelsett.scenarier.map((s) => s.nokkel).sort())
}
