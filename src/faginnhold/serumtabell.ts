/**
 * Tabellen over serumkonsentrasjoner ved ulike doser, slik kilden har den.
 *
 * I kildedokumentet (`originaldata/Psykofarmaka.pdf`) er tabellen en matrise:
 * én kolonne per dose og én rad hver for antall prøver, 10-persentil, median
 * og 90-persentil. Under står referanseområdeprosjektets 10- og 90-persentil
 * i en egen liten tabell. Importen lagrer tabellen som tekstrader med faste
 * kolonner (`Doserad` i `paneler.ts`), laget av funksjonene her.
 *
 * Visningen leser radene tilbake til matrisen med {@link lesSerumtabell}.
 * Det er tapsfritt: en rad regnes bare som en del av matrisen når teksten
 * lages helt lik på nytt av tallene som ble lest ut av den. Alt annet — rader
 * en redaktør har skrevet selv, eller endret — vises som vanlige rader,
 * nøyaktig som de er lagret.
 */
import { formaterTall, type Doserad } from './paneler'

/* --- Teksten radene lagres med ------------------------------------------- */

/**
 * Et tall på norsk form, med vanlig mellomrom mellom tusener: teksten lagres,
 * og et hardt mellomrom er usynlig og overlever ikke alle veier inn i
 * databasen.
 */
function tall(verdi: number): string {
  return formaterTall(verdi).replace(/ /g, ' ')
}

/** «Median 118 nmol/L (10.–90. persentil: 51–402)», med det kilden faktisk har. */
export function persentiltekst(median: number | null, p10: number | null, p90: number | null, enhet: string): string {
  const spenn =
    p10 !== null && p90 !== null
      ? `10.–90. persentil: ${tall(p10)}–${tall(p90)}`
      : p10 !== null
        ? `10. persentil: ${tall(p10)}`
        : p90 !== null
          ? `90. persentil: ${tall(p90)}`
          : ''
  if (median === null) return spenn ? `${spenn} ${enhet}` : ''
  return `Median ${tall(median)} ${enhet}${spenn ? ` (${spenn})` : ''}`
}

/** Delene i merknaden, hver avsluttet med punktum når den ikke har et. */
function merknad(deler: string[]): string {
  return deler
    .filter(Boolean)
    .map((del) => (/[.)]$/.test(del) ? del : `${del}.`))
    .join(' ')
}

/** «Kvetiapin (…). 252 prøver. Jönsson et al. (2019)» — merknaden for én dose. */
export function persentilmerknad(stoff: string, antall: number | null, kilde: string): string {
  return merknad([stoff, antall !== null ? `${tall(antall)} prøver` : '', kilde])
}

/** Referanseområdeprosjektet ved Diakonhjemmet og St. Olavs, slik kilden omtaler det. */
export const REFERANSEOMRADEPROSJEKTET = {
  navn: 'Referanseområdeprosjektet 2005–2008',
  sted: 'Diakonhjemmet/St. Olavs',
} as const

/** Merknaden på raden fra referanseområdeprosjektet. */
export const PROSJEKTMERKNAD = `${REFERANSEOMRADEPROSJEKTET.navn} (${REFERANSEOMRADEPROSJEKTET.sted}).`

/* --- Tilbake til matrisen ------------------------------------------------- */

/** Én dose i en persentiltabell. `null` der kilden ikke har noe tall. */
export interface Persentilkolonne {
  dose: string
  antall: number | null
  p10: number | null
  median: number | null
  p90: number | null
}

/**
 * En del av tabellen, i den rekkefølgen radene er lagret:
 *
 * - `persentiler` — en matrise for ett stoff fra én kilde, som i kilden.
 * - `prosjekt` — 10- og 90-persentilen fra referanseområdeprosjektet.
 * - `rader` — rader som ikke har den formen, vist som de er.
 */
export type Serumblokk =
  | { slag: 'persentiler'; stoff: string; kilde: string; enhet: string; kolonner: Persentilkolonne[] }
  | { slag: 'prosjekt'; doser: string; enhet: string; p10: number | null; p90: number | null }
  | { slag: 'rader'; rader: Doserad[] }

const TALL = String.raw`(?:\d{1,3}(?: \d{3})+(?:,\d+)?|\d+(?:,\d+)?)`
const ENHET = String.raw`[^\s()]+`
const SPENN = String.raw`10\.–90\. persentil: ${TALL}–${TALL}|10\. persentil: ${TALL}|90\. persentil: ${TALL}`
const KONSENTRASJON = new RegExp(
  String.raw`^(?:Median (?<median>${TALL}) (?<enhetM>${ENHET})(?: \((?<spennM>${SPENN})\))?|(?<spennS>${SPENN}) (?<enhetS>${ENHET}))$`,
)
const SPENNDELER = new RegExp(String.raw`^(?:(?<hvilken>10\.–90\.|10\.|90\.) persentil: (?<forste>${TALL})(?:–(?<andre>${TALL}))?)$`)
/** Den første «N prøver.» i merknaden skiller stoffet fra kilden. */
const MERKNAD = new RegExp(String.raw`^(?<stoff>[\s\S]+?) (?<antall>${TALL}) prøver\. (?<kilde>[\s\S]+)$`)

function lesTall(tekst: string | undefined): number | null {
  return tekst === undefined ? null : Number(tekst.replace(/ /g, '').replace(',', '.'))
}

interface Konsentrasjon {
  median: number | null
  p10: number | null
  p90: number | null
  enhet: string
}

/** Tallene i en konsentrasjonstekst, eller `null` når teksten ikke er laget av {@link persentiltekst}. */
function lesKonsentrasjon(tekst: string): Konsentrasjon | null {
  const g = KONSENTRASJON.exec(tekst)?.groups
  if (!g) return null
  const spenn = SPENNDELER.exec(g.spennM ?? g.spennS ?? '')?.groups
  const forste = lesTall(spenn?.forste)
  const verdi: Konsentrasjon = {
    median: lesTall(g.median),
    p10: spenn?.hvilken === '90.' ? null : forste,
    p90: spenn?.hvilken === '90.' ? forste : lesTall(spenn?.andre),
    enhet: g.enhetM ?? g.enhetS ?? '',
  }
  return persentiltekst(verdi.median, verdi.p10, verdi.p90, verdi.enhet) === tekst ? verdi : null
}

/** Punktumet {@link merknad} la til, tatt bort igjen — når det var det som la det til. */
function utenPunktum(del: string): string {
  const uten = del.replace(/\.$/, '')
  return merknad([uten]) === del ? uten : del
}

/** Stoff, antall og kilde i en merknad, eller `null` når den ikke er laget av {@link persentilmerknad}. */
function lesMerknad(tekst: string): { stoff: string; antall: number; kilde: string } | null {
  const g = MERKNAD.exec(tekst)?.groups
  if (!g) return null
  const { stoff = '', antall = '', kilde = '' } = g
  const verdi = { stoff: utenPunktum(stoff), antall: lesTall(antall)!, kilde: utenPunktum(kilde) }
  return persentilmerknad(verdi.stoff, verdi.antall, verdi.kilde) === tekst ? verdi : null
}

type Lestrad =
  | { slag: 'persentil'; stoff: string; kilde: string; enhet: string; kolonne: Persentilkolonne }
  | { slag: 'prosjekt'; blokk: Extract<Serumblokk, { slag: 'prosjekt' }> }
  | { slag: 'fri'; rad: Doserad }

function lesRad(rad: Doserad): Lestrad {
  const fri: Lestrad = { slag: 'fri', rad }
  if (rad.regime !== '' || rad.dose === '') return fri
  const konsentrasjon = lesKonsentrasjon(rad.konsentrasjon)
  if (!konsentrasjon) return fri
  const { median, p10, p90, enhet } = konsentrasjon
  if (rad.merknad === PROSJEKTMERKNAD && median === null) {
    return { slag: 'prosjekt', blokk: { slag: 'prosjekt', doser: rad.dose, enhet, p10, p90 } }
  }
  const merknad = lesMerknad(rad.merknad)
  if (!merknad) return fri
  return {
    slag: 'persentil',
    stoff: merknad.stoff,
    kilde: merknad.kilde,
    enhet,
    kolonne: { dose: rad.dose, antall: merknad.antall, p10, median, p90 },
  }
}

/**
 * Radene i tabellen som delene kilden har: påfølgende rader for samme stoff,
 * kilde og enhet blir én matrise, som i PDF-en. Rekkefølgen er radenes.
 */
export function lesSerumtabell(rader: readonly Doserad[]): Serumblokk[] {
  const blokker: Serumblokk[] = []
  for (const rad of rader) {
    const lest = lesRad(rad)
    const forrige = blokker.at(-1)
    if (lest.slag === 'prosjekt') {
      blokker.push(lest.blokk)
    } else if (lest.slag === 'fri') {
      if (forrige?.slag === 'rader') forrige.rader.push(lest.rad)
      else blokker.push({ slag: 'rader', rader: [lest.rad] })
    } else if (
      forrige?.slag === 'persentiler' &&
      forrige.stoff === lest.stoff &&
      forrige.kilde === lest.kilde &&
      forrige.enhet === lest.enhet
    ) {
      forrige.kolonner.push(lest.kolonne)
    } else {
      blokker.push({ slag: 'persentiler', stoff: lest.stoff, kilde: lest.kilde, enhet: lest.enhet, kolonner: [lest.kolonne] })
    }
  }
  return blokker
}
