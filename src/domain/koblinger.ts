import { ANALYTTKATALOG, type Analyttkatalog, type Laboratorieanalytt } from './analyttkatalog'
import { menyanalytter } from './analysemetoder'
import { stoffadresse } from './rute'
import { iSetning } from './names'
import { ANDRE_STOFFER, STOFFREGISTER, type Stoff, type StoffAnalyttKobling, type Stoffregister } from './stoffregister'
import type { Analyte } from '../types'

/**
 * Veiene mellom de to domenene: stoffregisteret (fagsidene, etter stoffets
 * nøkkel) og fortolkningssystemet (laboratorieanalyttene, etter koden).
 *
 * Alt går gjennom de eksplisitte koblingene i registeret. Ingenting her
 * gjetter en kobling av at navnene ligner, og ingen av sidene bytter identitet:
 *
 *   Fortolkning:  HBUP → HBUP-reglene
 *   Fagstoff:     bupropion → Bupropion-monografien
 *   Kobling:      bupropion ↔ HBUP (metabolitt)
 */

/** En kobling med analytten den peker på, slik stoffsiden viser den. */
export interface KobletAnalytt {
  kobling: StoffAnalyttKobling
  analytt: Laboratorieanalytt
}

/** Analyttene koblet til stoffet, i registerets rekkefølge. Koder fortolkningen ikke kjenner, utelates. */
export function analytterForStoff(
  slug: string,
  register: Stoffregister = STOFFREGISTER,
  katalog: Analyttkatalog = ANALYTTKATALOG,
): KobletAnalytt[] {
  return register.analytterFor(slug).flatMap((kobling) => {
    const analytt = katalog.finn(kobling.kode)
    return analytt ? [{ kobling, analytt }] : []
  })
}

/**
 * Analyttene stoffet er primært stoff for, hovedanalytten først. Det er dem
 * stoffsiden viser fortolkningsreglene og datakortene for.
 */
export function primareAnalytter(
  slug: string,
  register: Stoffregister = STOFFREGISTER,
  katalog: Analyttkatalog = ANALYTTKATALOG,
): Laboratorieanalytt[] {
  return analytterForStoff(slug, register, katalog)
    .filter(({ kobling }) => kobling.primar)
    .map(({ analytt }) => analytt)
}

/** Fortolkningsreglene for én modul på stoffsiden: analyttene i den og seksjonen de står i. */
export interface Regelseksjon {
  fortolkning: Analyte
  analytter: Laboratorieanalytt[]
  /** Nøkkelen til seksjonen på siden: `fortolkning` for den første, ellers med koden etter. */
  seksjon: string
}

/** Den første seksjonen med fortolkningsregler på en stoffside. */
export const FORTOLKNINGSSEKSJON = 'fortolkning'

/**
 * Fortolkningsmodulene til stoffets primære analytter, i rekkefølge, hver med
 * sin seksjon på siden. Analytter som deler modul (DIAZ og DMI), står sammen.
 */
export function regelseksjoner(
  slug: string,
  register: Stoffregister = STOFFREGISTER,
  katalog: Analyttkatalog = ANALYTTKATALOG,
): Regelseksjon[] {
  const seksjoner: Regelseksjon[] = []
  for (const analytt of primareAnalytter(slug, register, katalog)) {
    const kjent = seksjoner.find((s) => s.fortolkning === analytt.fortolkning)
    if (kjent) kjent.analytter.push(analytt)
    else
      seksjoner.push({
        fortolkning: analytt.fortolkning,
        analytter: [analytt],
        seksjon: seksjoner.length === 0 ? FORTOLKNINGSSEKSJON : `${FORTOLKNINGSSEKSJON}-${analytt.kode.toLowerCase()}`,
      })
  }
  return seksjoner
}

/**
 * Fortolkningsmodulen «Åpne fortolkning» på stoffsiden åpner: den ene modulen
 * stoffets primære analytter hører til. `undefined` når stoffet ikke har noen,
 * eller når de hører til flere — da åpnes hver fra koden sin på siden.
 */
export function fortolkningForStoff(
  slug: string,
  register: Stoffregister = STOFFREGISTER,
  katalog: Analyttkatalog = ANALYTTKATALOG,
): Analyte | undefined {
  const seksjoner = regelseksjoner(slug, register, katalog)
  return seksjoner.length === 1 ? seksjoner[0]!.fortolkning : undefined
}

/**
 * Stoffsiden en fortolkningsmodul fører til: det ene stoffet kodene i modulen
 * primært hører til. EtG og EtS fører begge til Etanol; DIAZ · DMI · OXA
 * fører til to stoffer og har derfor bare lenkene ved hver kode.
 */
export function stoffForFortolkning(analyte: Analyte, register: Stoffregister = STOFFREGISTER): Stoff | undefined {
  const stoffer = new Map<string, Stoff>()
  for (const { kode } of menyanalytter(analyte)) {
    const stoff = register.primartStoffFor(kode)
    if (stoff) stoffer.set(stoff.slug, stoff)
  }
  return stoffer.size === 1 ? [...stoffer.values()][0] : undefined
}

/** Et navn et stoff er kjent under, og om stoffet er det primære for analytten. */
export interface Stoffnavn {
  navn: string
  primar: boolean
}

/**
 * Navnene og aliasene i stoffregisteret til stoffene fortolkningsmodulen er
 * koblet til, så søket etter analytter kjenner de samme navnene som fagsøket:
 * «quetiapine» finner KVE, og «spironolakton» KANR. Stoffene analytten
 * primært hører til, kommer først.
 */
export function stoffnavnForFortolkning(analyte: Analyte, register: Stoffregister = STOFFREGISTER): Stoffnavn[] {
  const koblinger = menyanalytter(analyte).flatMap(({ kode }) => register.stofferFor(kode))
  return [...koblinger]
    .sort((a, b) => Number(b.primar) - Number(a.primar))
    .flatMap(({ stoff, primar }) => {
      const s = register.finn(stoff)
      return s ? [s.navn, ...s.aliaser].map((navn) => ({ navn, primar })) : []
    })
}

/**
 * Seksjonen på stoffsiden der reglene for koden står, eller `undefined` når
 * koden ikke har noe primært stoff.
 */
export function fortolkningsseksjonFor(
  kode: string,
  register: Stoffregister = STOFFREGISTER,
  katalog: Analyttkatalog = ANALYTTKATALOG,
): string | undefined {
  const stoff = register.primartStoffFor(kode)
  if (!stoff) return undefined
  const k = kode.trim().toUpperCase()
  return regelseksjoner(stoff.slug, register, katalog).find((s) => s.analytter.some((a) => a.kode === k))?.seksjon
}

/**
 * Adressen til fagsiden en analyttkode lenker til: det primære stoffets side.
 * `undefined` når koden ikke har noe primært stoff — da finnes det ingen
 * fagside å lenke til, og det lages ingen.
 */
export function stoffadresseForAnalytt(
  kode: string,
  sted: readonly string[] = [],
  register: Stoffregister = STOFFREGISTER,
): string | undefined {
  const stoff = register.primartStoffFor(kode)
  return stoff && stoffadresse(stoff.slug, sted)
}

/** Et referanseområdekort slik databasen gir det (`les_stoffreferanseomrader`). */
export interface Stoffreferanseomrade {
  /** Nøkkelen til stoffsiden kortet står på. */
  stoff: string
  /** Koden kortet gjelder, eller `null` for stoffets hovedanalytt. */
  gjelder: string | null
  verdi: unknown
}

/**
 * Referanseområdet for hver analyttkode, slik fortolkningen viser det: kortet
 * på det primære stoffets side som gjelder koden, eller — for stoffets
 * hovedanalytt — kortet uten `gjelder`. En metabolitt på moderstoffets side
 * får altså aldri moderstoffets referanseområde, og et stoff uten analytt gir
 * ingen.
 */
export function referanseomraderPerAnalytt(
  kort: readonly Stoffreferanseomrade[],
  register: Stoffregister = STOFFREGISTER,
): Map<string, unknown> {
  const svar = new Map<string, unknown>()
  for (const { kode, stoff, primar } of register.koblinger) {
    if (!primar) continue
    const hovedanalytt = register.analytterFor(stoff).find((k) => k.primar)?.kode === kode
    const treff =
      kort.find((k) => k.stoff === stoff && k.gjelder === kode) ??
      (hovedanalytt ? kort.find((k) => k.stoff === stoff && k.gjelder === null) : undefined)
    if (treff) svar.set(kode, treff.verdi)
  }
  return svar
}

/**
 * Linja under et stoff i søketreffene: kategorien i registeret og analyttene
 * stoffet er primært stoff for, som sekundær informasjon — f.eks.
 * «Antidepressiver › NDRI · analytt HBUP · hydroksybupropion». `undefined`
 * når det ikke er noe å si.
 */
export function stoffbeskrivelse(
  slug: string,
  register: Stoffregister = STOFFREGISTER,
  katalog: Analyttkatalog = ANALYTTKATALOG,
): string | undefined {
  const stoff = register.finn(slug)
  const kategori = register.kategorierFor(slug).find((k) => k.kategori !== ANDRE_STOFFER)
  const deler = [
    kategori && [kategori.kategori, kategori.underkategori].filter(Boolean).join(' › '),
    ...primareAnalytter(slug, register, katalog).map((a) =>
      stoff && a.navn.toLocaleLowerCase('nb') === stoff.navn.toLocaleLowerCase('nb')
        ? `analytt ${a.kode}`
        : `analytt ${a.kode} · ${iSetning(a.navn)}`,
    ),
  ].filter((d): d is string => Boolean(d))
  return deler.length > 0 ? deler.join(' · ') : undefined
}
