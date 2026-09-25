/**
 * Kommentarene et regelsett peker på.
 *
 * Et regelsett eier ikke tekstene sine. Reglene peker på kommentarobjekter
 * med ID-en (`src/domain/kommentarobjekt.ts`), som har sin egen historikk og
 * publisering. Her settes de to sammen til det fortolkningen og redigeringen
 * bruker, og tas fra hverandre igjen når redigeringen lagrer.
 */
import type { Kommentarinnhold, Kommentaroppslag } from '../domain/kommentarobjekt'
import type { Faginnholdsleser, Regelsettutgave, Utgave } from '../faginnhold/lesing'
import { LEVELS, type Level } from '../types'
import type { Intervallregelsett, Intervallregelsettinnhold } from './modell'

/** ID-ene til kommentarene regelsettet bruker, i den rekkefølgen de brukes, hver én gang. */
export function kommentarIder(regelsett: Intervallregelsettinnhold): string[] {
  const ider = regelsett.intervaller.map((r) => r.kommentar)
  if (regelsett.cutoff) ider.push(regelsett.cutoff.kommentar, regelsett.cutoff.innledning)
  return [...new Set(ider)]
}

/** Tekstene i kommentarobjektene, etter ID. */
export function kommentaroppslag(kommentarer: readonly Utgave<Kommentarinnhold>[]): Kommentaroppslag {
  return new Map(kommentarer.map((k) => [k.id, k.innhold.tekst]))
}

/**
 * Regelsettet med tekstene det peker på. Mangler en av dem, kan regelsettet
 * ikke brukes, og det er en feil — ikke en tom kommentar.
 */
export function medKommentarer(regelsett: Intervallregelsettinnhold, oppslag: Kommentaroppslag): Intervallregelsett {
  const kommentarer = kommentarIder(regelsett).map((id) => {
    const tekst = oppslag.get(id)
    if (tekst === undefined) throw new Error(`Fant ikke kommentaren ${id} som regelsettet for ${regelsett.analyttkode} bruker.`)
    return { id, tekst }
  })
  return { ...utenKommentarer(regelsett), kommentarer }
}

/**
 * De publiserte regelsettene med tekstene til kommentarene de peker på, lest
 * i to kall; appen henter dem slik når den åpnes (`src/regler/publiserte.ts`).
 * Et publisert regelsett kan bare peke på publiserte kommentarer, så mangler
 * en tekst, er noe galt, og det gis som en feil.
 */
export async function lesPubliserteRegelsett(
  leser: Pick<Faginnholdsleser, 'lesIntervallregelsett' | 'lesKommentarer'>,
): Promise<Intervallregelsett[]> {
  const [regelsett, kommentarer] = await Promise.all([
    leser.lesIntervallregelsett('publisert'),
    leser.lesKommentarer('publisert'),
  ])
  const oppslag = kommentaroppslag(kommentarer)
  return regelsett.map((u) => medKommentarer(u.innhold, oppslag))
}

/** Regelsettet i utgaven med tekstene til kommentarene som ble lest sammen med det. */
export function losRegelsett(utgave: Regelsettutgave): Intervallregelsett {
  return medKommentarer(utgave.regelsett.innhold, kommentaroppslag(utgave.kommentarer))
}

/**
 * Regelsettet slik det lagres: uten tekstene. Tar også bort tekstene en
 * revisjon fra før kommentarene ble egne objekter, har i seg.
 */
export function utenKommentarer(regelsett: Intervallregelsettinnhold & { kommentarer?: unknown }): Intervallregelsettinnhold {
  const { analyttkode, enhet, desimaler, skillepunkter, intervaller, ringegrense, cutoff } = regelsett
  return { analyttkode, enhet, desimaler, skillepunkter, intervaller, ringegrense, cutoff }
}

const NIVAORD: Record<Level, string> = Object.fromEntries(
  LEVELS.map((niva) => [niva, `${niva} referanseområdet`]),
) as Record<Level, string>

/**
 * Navnet en ny kommentar får: koden og hva den brukes til, som «AMIS –
 * innenfor referanseområdet». Navnet følger ikke med i pasientsvaret. Det er
 * det samme navnet kommentarene fikk da de ble flyttet ut av regelsettene
 * (`supabase/migrations/*_flytt_regelsettkommentarer.sql`).
 */
export function kommentarnavn(regelsett: Intervallregelsettinnhold, id: string): string {
  const bruk = regelsett.intervaller
    .filter((r) => r.kommentar === id)
    .map((r) => `${NIVAORD[r.niva]}${r.handling === 'ring_rekvirent' ? ', ring rekvirent' : ''}`)
  if (regelsett.cutoff?.innledning === id) bruk.push('innledning til «Til stede under cut-off»')
  const beskrivelse = [...new Set(bruk)].join(' og ') || 'kommentar'
  return `${regelsett.analyttkode} – ${beskrivelse}`
}

/** En kommentar redigeringen lagrer sammen med regelsettet: ny (`revisjon: null`) eller endret. */
export interface Kommentarendring {
  id: string
  revisjon: number | null
  innhold: Kommentarinnhold
}

/**
 * Kommentarene som må lagres for at regelsettet skal peke på det
 * redigeringen viser: de nye, og de som har fått en annen tekst.
 *
 * `lagrede` er kommentarobjektene slik de er lest, den nyeste først når det
 * er flere lister. En kommentar som ikke står i noen av dem, er ny.
 */
export function kommentarendringer(
  regelsett: Intervallregelsett,
  ...lagrede: readonly (readonly Utgave<Kommentarinnhold>[])[]
): Kommentarendring[] {
  return tekstendringer(regelsett.kommentarer, (id) => kommentarnavn(regelsett, id), ...lagrede)
}

/**
 * Det samme for tekstene et hvilket som helst regelsett bruker, etter ID.
 * `navn` gir navnet en ny kommentar får.
 */
export function tekstendringer(
  tekster: readonly { id: string; tekst: string }[],
  navn: (id: string) => string,
  ...lagrede: readonly (readonly Utgave<Kommentarinnhold>[])[]
): Kommentarendring[] {
  const kjente = new Map<string, Utgave<Kommentarinnhold>>()
  for (const liste of lagrede) for (const k of liste) if (!kjente.has(k.id)) kjente.set(k.id, k)
  return tekster.flatMap(({ id, tekst }): Kommentarendring[] => {
    const lagret = kjente.get(id)
    if (!lagret) return [{ id, revisjon: null, innhold: { navn: navn(id), tekst, plassholdere: [] } }]
    if (lagret.innhold.tekst === tekst) return []
    return [{ id, revisjon: lagret.revisjon, innhold: { ...lagret.innhold, tekst } }]
  })
}
