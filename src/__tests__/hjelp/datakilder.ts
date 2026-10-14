/**
 * Ekte utdrag fra PubChem og Farmakologiportalen, og falske API-er som svarer
 * med dem, til testene av synkroniseringene og av det appen leser av kopiene.
 *
 * - `data/pubchem/egenskaper.json`: PubChems svar for et utvalg forbindelser,
 *   blant dem citalopram og desmetylcitalopram.
 * - `data/farmakologiportalen/`: alle enhetene og prøvematerialene, og
 *   komponentene, analysene, laboratoriene og institusjonene for citalopram og
 *   desmetylcitalopram, THC med OH-THC og THC-COOH, og bupropion med
 *   hydroksybupropion — med gruppe- og sumanalysene som dekker dem. Bildene og
 *   redaksjonens navn er tatt ut.
 */
import { readFileSync } from 'node:fs'
import type { FpApi } from '../../farmakologiportalen/api'
import type { PubchemApi } from '../../kjemi/pubchem'

type Rad = Record<string, unknown>
const json = (sti: string) => JSON.parse(readFileSync(new URL(`../data/${sti}`, import.meta.url), 'utf8')) as unknown

/** Radene i PubChems svar (`PropertyTable.Properties`). */
export const PUBCHEMRADER = (json('pubchem/egenskaper.json') as { PropertyTable: { Properties: Rad[] } }).PropertyTable.Properties

/** Et PubChem som svarer med utdraget for CID-ene det blir spurt om, eventuelt endret. */
export function falskPubchemApi(endre: (rader: Rad[]) => Rad[] = (r) => r): PubchemApi & { kall: number } {
  const api = {
    kall: 0,
    egenskaper: async (cider: readonly number[]) => {
      api.kall += 1
      return endre(PUBCHEMRADER.filter((r) => cider.includes(r.CID as number)).map((r) => ({ ...r })))
    },
    cidsForNavn: async () => [],
    moderforbindelser: async () => [],
  }
  return api
}

/** Listene slik portalens API ga dem, per sti. */
export const FPLISTER: Record<string, Rad[]> = Object.fromEntries(
  (['units', 'sampletypes', 'institutions', 'labs', 'components', 'analyses'] as const).map((navn) => [
    `/${navn}`,
    json(`farmakologiportalen/${navn}.json`) as Rad[],
  ]),
)

/** Et API som svarer med utdraget fra Farmakologiportalen, eventuelt endret per sti. */
export function falskFpApi(endre: (sti: string, rader: Rad[]) => Rad[] = (_, r) => r): FpApi & { kall: string[] } {
  const kall: string[] = []
  return {
    kall,
    liste: async (sti) => {
      kall.push(sti)
      return endre(sti, structuredClone(FPLISTER[sti] ?? []))
    },
  }
}
