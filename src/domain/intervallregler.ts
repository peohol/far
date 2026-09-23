import { bandmerke, lagBand, round, type Band } from './bands'
import type {
  Intervallregel,
  Intervallregelsett,
  Intervallregelsettinnhold,
  Regelhandling,
  Regelkommentar,
} from '../regler/modell'
import type { Level } from '../types'

/**
 * Regelsettene for de enkle konsentrasjonsreglene, og motoren som bruker dem.
 *
 * Et regelsett gjelder én analyttkode og sier hvilken kommentar en målt
 * konsentrasjon gir, og om rekvirenten skal ringes. Det lagres i Supabase som
 * ett redigerbart objekt (se `docs/fortolkningsregler.md`), på formen i
 * `src/regler/modell.ts`.
 *
 * Alt her er rene funksjoner uten tilgang til databasen. Fortolkningen og
 * redigeringen bruker dem på de regelsettene de har fått.
 *
 * **Intervallene.** Konsentrasjonsaksen deles av skillepunktene. Et intervall
 * har nedre grense med og øvre grense utenfor, `[fra, til)`, og det første og
 * det siste er åpne i enden. To naboer deler alltid det samme skillepunktet,
 * så intervallene dekker hele tallinjen uten hull eller overlapp.
 */

/** Ett intervall med grensene sine og regelen, som peker på kommentaren med ID-en. */
export interface Intervallgrenser {
  /** Plassen i regelsettet, fra 0. */
  indeks: number
  /** Nedre grense, inkludert. `null` = åpen. */
  fra: number | null
  /** Øvre grense, ikke inkludert. `null` = åpen. */
  til: number | null
  niva: Level
  handling: Regelhandling | null
  kommentarId: string
}

/** Ett intervall med grensene sine og det regelen gir. */
export interface Regeltreff extends Intervallgrenser {
  kommentar: Regelkommentar
}

/** Skillet mellom tekstene når to kommentarer settes sammen. */
const SAMMENFOYNING = ' '

/** Kommentaren med denne ID-en. Et regelsett som mangler den, er ugyldig. */
export function kommentaren(regelsett: Intervallregelsett, id: string): Regelkommentar {
  const kommentar = regelsett.kommentarer.find((k) => k.id === id)
  if (!kommentar) throw new Error(`Regelsettet for ${regelsett.analyttkode} mangler kommentaren ${id}`)
  return kommentar
}

/** Intervallene med grensene sine, nedenfra og opp, uten tekstene. */
export function grensene(regelsett: Intervallregelsettinnhold): Intervallgrenser[] {
  const { skillepunkter } = regelsett
  return regelsett.intervaller.map((regel, indeks) => ({
    indeks,
    fra: indeks === 0 ? null : (skillepunkter[indeks - 1] ?? null),
    til: indeks === skillepunkter.length ? null : (skillepunkter[indeks] ?? null),
    niva: regel.niva,
    handling: regel.handling,
    kommentarId: regel.kommentar,
  }))
}

/** Intervallene med grensene sine og kommentarene, nedenfra og opp. */
export function intervallene(regelsett: Intervallregelsett): Regeltreff[] {
  return grensene(regelsett).map((g) => ({ ...g, kommentar: kommentaren(regelsett, g.kommentarId) }))
}

/** Sant når verdien ligger i intervallet `[fra, til)`. */
export function iIntervallet(treff: Pick<Regeltreff, 'fra' | 'til'>, verdi: number): boolean {
  return (treff.fra === null || verdi >= treff.fra) && (treff.til === null || verdi < treff.til)
}

/** Regelen en målt konsentrasjon treffer. Det er alltid nøyaktig én. */
export function finnRegel(regelsett: Intervallregelsett, verdi: number): Regeltreff {
  const treff = intervallene(regelsett).find((t) => iIntervallet(t, verdi))
  if (!treff) throw new Error(`Ingen regel for ${verdi} i ${regelsett.analyttkode}`)
  return treff
}

/** Sant når regelen sier at rekvirenten skal ringes. */
export function ringes(regel: Pick<Intervallregel, 'handling'>): boolean {
  return regel.handling === 'ring_rekvirent'
}

/** Kommentaren «Til stede under cut-off» gir, eller `null` når regelsettet ikke har den. */
export function cutoffkommentar(regelsett: Intervallregelsett): string | null {
  if (!regelsett.cutoff) return null
  return [regelsett.cutoff.innledning, regelsett.cutoff.kommentar]
    .map((id) => kommentaren(regelsett, id).tekst)
    .join(SAMMENFOYNING)
}

/** Den minste verdien som kan oppgis over et skillepunkt: ett steg under, rundet. */
export function stegUnder(verdi: number, desimaler: number): number {
  return round(verdi - 10 ** -desimaler, desimaler)
}

/** Intervallet slik det står på knappen: `[10, 1800)` med 0 desimaler er «10 – 1799». */
export function intervallmerke(intervall: Pick<Intervallgrenser, 'fra' | 'til'>, desimaler: number): string {
  return bandmerke(intervall.fra, intervall.til === null ? null : stegUnder(intervall.til, desimaler), desimaler)
}

/**
 * Båndene steg 2 viser for regelsettet, i samme form som båndene fra
 * datasettet. Knappene viser hele steg: `[10, 1800)` med 0 desimaler er
 * «10 – 1799».
 *
 * Nøkkelen er nivået, med `-ring` når rekvirenten skal ringes. Har to
 * intervaller samme nøkkel, får de etter det første et løpenummer, så
 * nøklene alltid er entydige.
 */
export function regelsettband(regelsett: Intervallregelsett): Band[] {
  const brukt = new Map<string, number>()
  return intervallene(regelsett).map((treff) => {
    const ring = ringes(treff)
    const grunnnokkel = ring ? `${treff.niva}-ring` : treff.niva
    const nr = (brukt.get(grunnnokkel) ?? 0) + 1
    brukt.set(grunnnokkel, nr)
    return lagBand({
      niva: treff.niva,
      fra: treff.fra,
      til: treff.til === null ? null : stegUnder(treff.til, regelsett.desimaler),
      ring,
      desimaler: regelsett.desimaler,
      kommentar: treff.kommentar.tekst,
      key: nr === 1 ? grunnnokkel : `${grunnnokkel}-${nr}`,
    })
  })
}
