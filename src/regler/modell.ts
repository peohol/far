/**
 * Formen på regelsettene for de enkle konsentrasjonsreglene.
 *
 * Databasen lagrer {@link Intervallregelsettinnhold}: reglene, som peker på
 * kommentarobjektene med ID-en. Tekstene er egne objekter
 * (`src/domain/kommentarobjekt.ts`) med egen historikk og publisering.
 * Fortolkningen og redigeringen bruker {@link Intervallregelsett}: reglene med
 * tekstene til kommentarene de peker på slått opp (`src/regler/kommentarer.ts`).
 * Motoren står i `src/domain/intervallregler.ts`, og bakgrunnen i
 * `docs/fortolkningsregler.md`.
 *
 * Verdiene under står også i migrasjonen som oppretter tabellene.
 * `src/__tests__/intervallregelsett.test.ts` kontrollerer at de stemmer overens.
 */
import { LEVELS } from '../types'

/** Samme verdier som `konsentrasjonsniva` i databasen. */
export const KONSENTRASJONSNIVAER = LEVELS

/** Enhetene en konsentrasjon kan oppgis i. Samme som tabellen `maleenheter` i databasen. */
export const MALEENHETER = ['nmol/L', 'µmol/L'] as const

/** Handlingene en regel kan ha i tillegg til kommentaren. Samme som `regelhandling` i databasen. */
export const REGELHANDLINGER = ['ring_rekvirent'] as const
export type Regelhandling = (typeof REGELHANDLINGER)[number]

/** Teksten til et kommentarobjekt regelsettet peker på. */
export interface Regelkommentar {
  id: string
  tekst: string
}

/** Regelen for ett intervall. `kommentar` er ID-en til et kommentarobjekt. */
export interface Intervallregel {
  niva: (typeof KONSENTRASJONSNIVAER)[number]
  handling: Regelhandling | null
  kommentar: string
}

/** «Til stede under cut-off»: innledningen satt foran en av de ordinære kommentarene. */
export interface Cutoffregel {
  innledning: string
  kommentar: string
}

/** Øyeblikksbildet av et intervallregelsett, slik databasen lagrer det. */
export interface Intervallregelsettinnhold {
  analyttkode: string
  enhet: string
  /** Hvor fint konsentrasjonen oppgis. Grensene er hele steg. */
  desimaler: number
  /** Grensene mellom intervallene, strengt stigende. */
  skillepunkter: number[]
  /** Én regel per intervall, nedenfra og opp — én mer enn skillepunktene. */
  intervaller: Intervallregel[]
  /** Ringegrensen slik den vises som referansetall, eller `null` uten ringeregel. */
  ringegrense: number | null
  cutoff: Cutoffregel | null
}

/** Regelsettet med tekstene til kommentarene det peker på, i den rekkefølgen de brukes. */
export interface Intervallregelsett extends Intervallregelsettinnhold {
  kommentarer: Regelkommentar[]
}
