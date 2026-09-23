/**
 * Rusmiddelreglene slik de ble importert til Supabase
 * (`src/domain/__tests__/fasit/rus-import.json`): regelsettene, og
 * kommentarene med nøklene i grunnlaget som ID-er.
 *
 * Det er disse regelsettene som er publisert, så testene som trenger
 * rusreglene uten en database, bruker dem herfra.
 */
import grunnlag from '../../domain/__tests__/fasit/rus-import.json'
import type { Kommentarinnhold, Kommentaroppslag } from '../../domain/kommentarobjekt'
import { kjorScenarier, type Scenarioinndata, type Scenarioregelsett, type Scenarioresultat } from '../../domain/scenario'
import type { Utgave } from '../../faginnhold/lesing'
import type { Scenarioregeldata } from '../../faginnhold/scenarioregler'

export const RUS_GRUNNLAG = grunnlag as unknown as {
  kommentarer: { id: string; innhold: Kommentarinnhold }[]
  regelsett: Scenarioregelsett[]
}

export const RUS_REGELSETT: readonly Scenarioregelsett[] = RUS_GRUNNLAG.regelsett

export const RUS_KOMMENTARER: Kommentaroppslag = new Map(RUS_GRUNNLAG.kommentarer.map((k) => [k.id, k.innhold.tekst]))

/** En kopi av regelsettet for modulen, til å endre i en test. */
export function rusRegelsett(modul: string): Scenarioregelsett {
  const funnet = RUS_REGELSETT.find((r) => r.modul === modul)
  if (!funnet) throw new Error(`ukjent regelsett i testen: ${modul}`)
  return structuredClone(funnet)
}

/** Fortolkningen modulen gir med de importerte reglene. */
export function fortolkRus(modul: string, inn: Scenarioinndata): Scenarioresultat {
  return kjorScenarier(rusRegelsett(modul), RUS_KOMMENTARER, inn).resultat
}

function utgave<T>(id: string, innhold: T): Utgave<T> {
  return {
    id,
    revisjon: 1,
    publisert_revisjon: 1,
    innhold,
    endret_av_fornavn: 'Ada',
    endret_av_etternavn: 'Adminsen',
    endret_kl: '2026-09-23T09:00:00Z',
  }
}

/** Reglene i den formen `les_scenarioregler` gir dem, med nøklene i grunnlaget som ID-er. */
export function rusScenarioregeldata(): Scenarioregeldata {
  return {
    regelsett: RUS_REGELSETT.map((r) => utgave(`regelsett/${r.modul}`, structuredClone(r))),
    kommentarer: RUS_GRUNNLAG.kommentarer.map((k) => utgave(k.id, k.innhold)),
  }
}
