/**
 * Fortolkningsreglene slik de var da fortolkningen ble byttet over til
 * regelsettene i Supabase — fasiten paritets- og regresjonstestene måles mot.
 *
 * Den gamle motoren og grensene og kommentarene i de statiske datasettene er
 * borte. Det de ga, står igjen her, frosset:
 *
 * - **Importdatasettet** (`supabase/import/intervallregelsett.json`):
 *   regelsettene dagens regler ble importert som, med kommentarene ord for ord.
 *   Da det ble laget, krevde testene at det var nøyaktig det den gamle motoren
 *   ga, og at knappene steg 2 lager av det, er de samme som den gamle motorens.
 * - **Grensene** (`../data/dagensgrenser.json`): tallene den gamle motoren
 *   fortolket etter — nedre og øvre grense og ringegrensen — og båndene den
 *   ga, skrevet ut med den gamle motoren rett før den ble fjernet.
 *
 * Begge har en kontrollsum, så de ikke kan endres uten at det synes.
 */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { antihypertensivdatasett, dataset } from '../../domain/analytes'
import { tilRegelimport, type Regelimport, type Regelkilde } from '../../regler/import'
import { kommentarnavn, utenKommentarer } from '../../regler/kommentarer'
import type { Intervallregelsett } from '../../regler/modell'
import type { Analyte, Level } from '../../types'

function lesJson<T>(sti: string): T {
  return JSON.parse(readFileSync(new URL(sti, import.meta.url), 'utf8')) as T
}

/** Innholdet i en JSON-fil som kontrollsum, uavhengig av linjeskift og innrykk. */
export function kontrollsum(verdi: unknown): string {
  return createHash('sha256').update(JSON.stringify(verdi)).digest('hex')
}

/** Kontrollsummene for fasiten, slik den var da fortolkningen ble byttet over. */
export const FASITSUMMER = {
  importdatasett: '510723006bb65a58fe24eeeb1fada1dcbbbb6c1a711ef1eec12f281cb6e1194c',
  grenser: 'eb9a0c277d920705c92d91ec5189f0b5f21b390ec0c9e64a541fcee38e490638',
}

/**
 * Importdatasettet: hvert regelsett med kilden den første revisjonen fikk,
 * og tekstene slik de ble importert, før kommentarene ble egne objekter.
 */
export const IMPORTDATASETT = lesJson<Regelkilde[]>('../../../supabase/import/intervallregelsett.json')

/** Importdatasettet slik det importeres nå: reglene og kommentarobjektene hver for seg. */
export const DAGENS_IMPORT: Regelimport[] = IMPORTDATASETT.map(tilRegelimport)

/** Regelsettene fra før byttet, sortert på analyttkode. */
export const DAGENS_REGELSETT: Intervallregelsett[] = IMPORTDATASETT.map((i) => i.regelsett)

const etterKode = new Map(DAGENS_REGELSETT.map((r) => [r.analyttkode, r]))

/** Regelsettet koden hadde før byttet. */
export function dagensRegelsett(kode: string): Intervallregelsett {
  const regelsett = etterKode.get(kode)
  if (!regelsett) throw new Error(`Fant ikke regelsettet for ${kode} i importdatasettet`)
  return regelsett
}

/** Ett bånd den gamle motoren ga. `fra` og `til` er inklusive, i hele steg. */
export interface DagensBand {
  key: string
  fra: number | null
  til: number | null
  ring: boolean
}

/** Grensene den gamle motoren fortolket en analytt etter, og båndene den ga. */
export interface Dagensgrenser {
  kode: string
  /** Konsentrasjoner under denne var «under». */
  nedreGrense: number
  /** Konsentrasjoner fra og med denne var «over». */
  ovreGrense: number
  ringegrense: number | null
  band: DagensBand[]
}

export const DAGENS_GRENSER = lesJson<Dagensgrenser[]>('../data/dagensgrenser.json')

/**
 * Nivået den gamle motoren ga en konsentrasjon — dens kanoniske regel. Der
 * kilden hadde overlapp mellom «innenfor» og «over», vant «over».
 */
export function dagensNiva(grenser: Dagensgrenser, verdi: number): Level {
  if (verdi >= grenser.ovreGrense) return 'over'
  if (verdi < grenser.nedreGrense) return 'under'
  return 'innenfor'
}

/** En fast UUID, laget av delene. Importen brukte den til kommentar-ID-ene. */
export function importId(...deler: string[]): string {
  const h = createHash('md5').update(['intervallregelsett', ...deler].join('/')).digest('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

/** Kilden som ble ført på den første revisjonen av regelsettet. */
export function importkilde(analyte: Analyte): string {
  const fil = analyte.antihypertensiv ? antihypertensivdatasett.meta.kilde : dataset.meta.kilde
  return `Importert fra ${fil}, via de statiske fortolkningsreglene i OUSFAR`
}

/** Kommentaren nivået ga før byttet: den det første intervallet på nivået bruker. */
export function dagensKommentar(kode: string, niva: Level): string {
  const regelsett = dagensRegelsett(kode)
  const regel = regelsett.intervaller.find((i) => i.niva === niva)
  const kommentar = regelsett.kommentarer.find((k) => k.id === regel?.kommentar)
  if (!kommentar) throw new Error(`${kode} har ingen kommentar for nivået «${niva}»`)
  return kommentar.tekst
}

/**
 * Det databasen gir for disse regelsettene som de publiserte: regelsettene
 * uten tekstene (`les_intervallregelsett`) og kommentarobjektene de peker på
 * (`les_kommentarer`). For testene som erstatter databasen.
 */
export function publiserteRader(regelsett: Intervallregelsett[]) {
  const utgave = <T,>(id: string, innhold: T) => ({
    id,
    revisjon: 1,
    publisert_revisjon: 1,
    innhold,
    endret_av_fornavn: '',
    endret_av_etternavn: '',
    endret_kl: '',
  })
  return {
    les_intervallregelsett: regelsett.map((r) => utgave(importId(r.analyttkode), utenKommentarer(r))),
    les_kommentarer: regelsett.flatMap((r) =>
      r.kommentarer.map((k) => utgave(k.id, { navn: kommentarnavn(r, k.id), tekst: k.tekst, plassholdere: [] })),
    ),
  }
}
