/**
 * Formen på regelsettene for de enkle konsentrasjonsreglene, slik databasen
 * lagrer dem: øyeblikksbildet `les_intervallregelsett` gir og `lagre_utkast`
 * tar imot. Motoren som bruker dem, står i `src/domain/intervallregler.ts`, og
 * bakgrunnen i `docs/fortolkningsregler.md`.
 *
 * Verdiene under står også i migrasjonen som oppretter tabellene.
 * `src/__tests__/intervallregelsett.test.ts` kontrollerer at de stemmer overens.
 */
import { LEVELS } from '../types'

/** Samme verdier som `konsentrasjonsniva` i databasen. */
export const KONSENTRASJONSNIVAER = LEVELS

/** Handlingene en regel kan ha i tillegg til kommentaren. Samme som `regelhandling` i databasen. */
export const REGELHANDLINGER = ['ring_rekvirent'] as const
export type Regelhandling = (typeof REGELHANDLINGER)[number]

/** En kommentar: ren tekst med en stabil ID i regelsettet. */
export interface Regelkommentar {
  id: string
  tekst: string
}

/** Regelen for ett intervall. `kommentar` er ID-en til en kommentar i regelsettet. */
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

/** Øyeblikksbildet av et intervallregelsett. */
export interface Intervallregelsett {
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
  kommentarer: Regelkommentar[]
}
