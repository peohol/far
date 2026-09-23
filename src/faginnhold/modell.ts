/**
 * Formen på det redigerbare faginnholdet, slik databasen lagrer det.
 *
 * Informasjonsside, laboratorieanalytt, innholdselement, referanse,
 * THC-syreregelsett, kommentar og scenarioregelsett (`docs/scenarioregler.md`)
 * er hver sin objekttype. Hvert objekt har en stabil ID, et utkast og eventuelt
 * en publisert utgave, og en historikk der hver endring er en egen revisjon med
 * et komplett øyeblikksbilde. Bakgrunnen står i `docs/faginnhold.md`; formen på
 * THC-syreregelsettet i `src/domain/thcTekster.ts` og `thcRegelsett.ts`.
 *
 * Verdiene under står også i migrasjonen som oppretter tabellene.
 * `src/__tests__/faginnhold.test.ts` kontrollerer at de stemmer overens.
 */

import type { Kommentarinnhold } from '../domain/kommentarobjekt'
import type { ThcRegelsettinnhold } from '../domain/thcTekster'
import type { Scenarioregelsett } from '../domain/scenario'

export const OBJEKTTYPER = [
  'infoside',
  'laboratorieanalytt',
  'innholdselement',
  'referanse',
  'thc_regelsett',
  'kommentar',
  'scenarioregelsett',
] as const
export type Objekttype = (typeof OBJEKTTYPER)[number]

/** Utkastet er arbeidsversjonen; det publiserte er det alle innloggede ser. */
export const TILSTANDER = ['utkast', 'publisert'] as const
export type Tilstand = (typeof TILSTANDER)[number]

/** Handlingene historikken skiller mellom. */
export const HANDLINGER = ['opprettet', 'endret', 'gjenopprettet', 'publisert'] as const
export type Handling = (typeof HANDLINGER)[number]

/**
 * Feilkoden databasen gir når noen har lagret i mellomtiden. Data-API-et
 * svarer på den med HTTP 409.
 */
export const KONFLIKT = 'PT409'

/**
 * Nivåene en referanse kan siteres på, i leserekkefølge: et helt panel, et
 * kort (innholdselement) og inline i teksten.
 */
export const REFERANSENIVAER = ['panel', 'element', 'inline'] as const
export type Referanseniva = (typeof REFERANSENIVAER)[number]

/**
 * Informasjonssiden for et virkestoff, f.eks. Amitriptylin.
 *
 * `panelreferanser` er referansene som gjelder et helt panel, fra panelnøkkel
 * til en ordnet liste med referanse-ID-er. Utelatt betyr ingen, og databasen
 * utelater feltet når siden ikke har noen.
 */
export interface Infosideinnhold {
  navn: string
  panelreferanser?: Record<string, string[]>
}

/**
 * Analyttkoden laboratoriet rapporterer. Hovedsiden er den ene siden koden
 * hører til; komponentene er stoffene analysen omfatter, i rekkefølge — for
 * en sumanalyse flere enn ett. ID-ene er informasjonssidenes.
 */
export interface Laboratorieanalyttinnhold {
  kode: string
  hovedside: string
  komponenter: string[]
}

/**
 * Et kort, felt eller tekststykke på en informasjonsside. `panel` og
 * `elementtype` er nøkler (små bokstaver, tall og understrek); hva `data`
 * inneholder, bestemmes av elementtypen. Rekkefølgen i et panel er
 * `posisjon`, deretter objekt-ID-en — to elementer kan stå på samme plass.
 *
 * `referanser` er kortreferansene: kildene for hele kortet, i rekkefølge.
 * Inline-siteringer står som siteringsnoder i `data` (se
 * `src/faginnhold/referanser.ts`). Utelatt betyr ingen, og databasen
 * utelater feltet når kortet ikke har noen.
 */
export interface Innholdselementinnhold {
  infoside: string
  panel: string
  posisjon: number
  elementtype: string
  data: Record<string, unknown>
  referanser?: string[]
}

/**
 * Én kilde i den globale referansebasen. Feltene er de samme som i Slaids, og
 * vises som «Tittel · Forfatter(e) · År · Lenke». Minst ett av tittel,
 * forfattere og lenke må være fylt ut, og lenken må være en nettadresse.
 *
 * En arkivert referanse kan ikke siteres. Utelatt `arkivert` er `false`.
 */
export interface Referanseinnhold {
  tittel: string
  forfattere: string
  aar: string
  lenke: string
  arkivert?: boolean
}

/** Innholdet til hver objekttype — det som lagres og står i hver revisjon. */
export interface Innhold {
  infoside: Infosideinnhold
  laboratorieanalytt: Laboratorieanalyttinnhold
  innholdselement: Innholdselementinnhold
  referanse: Referanseinnhold
  thc_regelsett: ThcRegelsettinnhold
  kommentar: Kommentarinnhold
  scenarioregelsett: Scenarioregelsett
}

/**
 * Hvor et objekt står. `revisjon` er utkastet; står den høyere enn
 * `publisert_revisjon`, finnes det endringer som ikke er publisert. Vanlige
 * brukere ser bare publiserte objekter, og aldri revisjonen til et utkast.
 */
export interface Objektstatus {
  id: string
  type: Objekttype
  revisjon: number | null
  endret_kl: string | null
  publisert_revisjon: number | null
  publisert_kl: string | null
}
