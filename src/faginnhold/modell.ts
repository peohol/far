/**
 * Formen på det redigerbare faginnholdet, slik databasen lagrer det.
 *
 * Informasjonsside, laboratorieanalytt og innholdselement er hver sin
 * objekttype. Hvert objekt har en stabil ID, et utkast og eventuelt en
 * publisert utgave, og en historikk der hver endring er en egen revisjon med
 * et komplett øyeblikksbilde. Bakgrunnen står i `docs/faginnhold.md`.
 *
 * Verdiene under står også i migrasjonen som oppretter tabellene.
 * `src/__tests__/faginnhold.test.ts` kontrollerer at de stemmer overens.
 */

export const OBJEKTTYPER = ['infoside', 'laboratorieanalytt', 'innholdselement'] as const
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

/** Informasjonssiden for et virkestoff, f.eks. Amitriptylin. */
export interface Infosideinnhold {
  navn: string
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
 * inneholder, bestemmes av elementtypen.
 */
export interface Innholdselementinnhold {
  infoside: string
  panel: string
  posisjon: number
  elementtype: string
  data: Record<string, unknown>
}

/** Innholdet til hver objekttype — det som lagres og står i hver revisjon. */
export interface Innhold {
  infoside: Infosideinnhold
  laboratorieanalytt: Laboratorieanalyttinnhold
  innholdselement: Innholdselementinnhold
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
