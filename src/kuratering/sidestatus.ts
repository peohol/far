/**
 * Kurateringsstatusen til hver fagside: én status per side, regnet ut av alle
 * kurateringene den har hatt. Kurateringsmenyen for administratorene og fanen
 * «Kurateringer» i stoffregisteret bruker begge denne, så de aldri sier noe
 * forskjellig om en side (`docs/kurateringsgrener.md`, «Status per fagside»).
 *
 * - En side med en gren som pågår (høyst én per side), har den grenens status.
 * - Ellers er siden kuratert når minst én kuratering av den er publisert, og
 *   statusen er den sist publiserte.
 * - Ellers er den ikke kuratert. En forkastet gren, og en publisert
 *   gjenoppretting av en eldre versjon, gjør ingen side kuratert.
 */
import { erAktiv, type Grenart, type Grenstatus } from './modell'

/** Det som trengs av en kuratering for å regne ut statusen: en gren, eller en kuratering gjort med en migrasjon. */
export interface Kurateringsrad {
  stoff: string
  art: Grenart
  status: Grenstatus
  opprettet_kl: string
  /** Når grenen fikk statusen den har. */
  status_kl?: string
  publisert_kl?: string
}

export type Kurateringsfase = 'pagaar' | 'kuratert' | 'ikke_kuratert'

export const FASENAVN: Record<Kurateringsfase, string> = {
  pagaar: 'Pågår',
  kuratert: 'Kuratert',
  ikke_kuratert: 'Ikke kuratert',
}

/** Rekkefølgen fasene står i. */
export const FASER: readonly Kurateringsfase[] = ['pagaar', 'kuratert', 'ikke_kuratert']

/** Hvor langt en kuratering som pågår er kommet, i ord for alle brukerne. */
export const FREMDRIFTSNAVN: Partial<Record<Grenstatus, string>> = {
  arbeid: 'Kurateres',
  retting: 'Kurateres',
  tilbakemelding: 'Kurateres',
  blokkert: 'Kurateres',
  klar: 'Til kontroll',
  godkjent: 'Godkjent, venter på publisering',
  stanset: 'Satt på vent',
}

export interface Sidekuratering<R extends Kurateringsrad> {
  stoff: string
  fase: Kurateringsfase
  /** Grenen som pågår. */
  aktiv: R | null
  /** Den sist publiserte kurateringen. */
  publisert: R | null
  /** Hvor mange kurateringer av siden som er publisert. */
  antallPublisert: number
  /** Kurateringen statusen gjelder: den som pågår, ellers den sist publiserte, ellers den siste. */
  gjeldende: R
  /** De andre, nyeste først. */
  tidligere: R[]
  /**
   * Når kurateringen statusen gjelder, startet eller ble publisert: den som
   * pågår, når den startet; ellers når den ble publisert. Tom når siden ikke
   * er kuratert.
   */
  kl: string
}

const tid = (iso: string | undefined) => Date.parse(iso ?? '') || 0
/** Når en kuratering sist kom et steg videre (publisert, ny status eller startet), i millisekunder. */
export const sist = (r: Kurateringsrad) => Math.max(tid(r.publisert_kl), tid(r.status_kl), tid(r.opprettet_kl))
const nyestForst = (a: Kurateringsrad, b: Kurateringsrad) => sist(b) - sist(a)

/** Om kurateringen er publisert og teller som kuratering av siden. */
export function erPublisertKuratering(r: Kurateringsrad): boolean {
  return r.status === 'publisert' && r.art !== 'gjenoppretting'
}

/** Statusen til én side av kurateringene den har hatt. `null` uten noen. */
export function sidekuratering<R extends Kurateringsrad>(rader: readonly R[]): Sidekuratering<R> | null {
  const alle = [...rader].sort(nyestForst)
  const forste = alle[0]
  if (!forste) return null
  const aktiv = alle.find((r) => erAktiv(r.status)) ?? null
  const publiserte = alle.filter(erPublisertKuratering)
  const publisert = publiserte[0] ?? null
  const gjeldende = aktiv ?? publisert ?? forste
  return {
    stoff: forste.stoff,
    fase: aktiv ? 'pagaar' : publisert ? 'kuratert' : 'ikke_kuratert',
    aktiv,
    publisert,
    antallPublisert: publiserte.length,
    gjeldende,
    tidligere: alle.filter((r) => r !== gjeldende),
    kl: aktiv ? aktiv.opprettet_kl : (publisert?.publisert_kl ?? ''),
  }
}

/** Statusen til hver side som har hatt en kuratering, etter nøkkelen. */
export function perFagside<R extends Kurateringsrad>(rader: readonly R[]): Map<string, Sidekuratering<R>> {
  const etterStoff = new Map<string, R[]>()
  for (const r of rader) etterStoff.set(r.stoff, [...(etterStoff.get(r.stoff) ?? []), r])
  const svar = new Map<string, Sidekuratering<R>>()
  for (const [stoff, liste] of etterStoff) {
    const side = sidekuratering(liste)
    if (side) svar.set(stoff, side)
  }
  return svar
}
