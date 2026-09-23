import type { Intervallregelsett } from './modell'

/**
 * Regelsettene fortolkningen bruker: de publiserte, hentet fra databasen når
 * appen åpnes (se `usePubliserteRegler`). Steg 2 får regelsettet for koden
 * som et {@link Regeloppslag} og henter ingenting selv.
 */
export type Regeltilstand =
  | { status: 'laster' }
  | { status: 'feil'; melding: string }
  | { status: 'klar'; etterKode: ReadonlyMap<string, Intervallregelsett> }

/** Det steg 2 har å vise for én analyttkode. */
export type Regeloppslag =
  | { status: 'laster' }
  | { status: 'feil'; melding: string }
  | { status: 'mangler' }
  | { status: 'klar'; regelsett: Intervallregelsett }

/** Regelsettene ordnet etter analyttkoden de gjelder. */
export function etterKode(regelsett: Intervallregelsett[]): ReadonlyMap<string, Intervallregelsett> {
  return new Map(regelsett.map((r) => [r.analyttkode, r]))
}

/** Regelsettet for koden, eller hvorfor det ikke finnes ennå. */
export function slaOpp(tilstand: Regeltilstand, kode: string): Regeloppslag {
  if (tilstand.status !== 'klar') return tilstand
  const regelsett = tilstand.etterKode.get(kode)
  return regelsett ? { status: 'klar', regelsett } : { status: 'mangler' }
}
