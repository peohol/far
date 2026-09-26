/**
 * CPIC-kopien i databasen, slik synkroniseringen skriver til den.
 *
 * Skrivingen krever den hemmelige nøkkelen og skjer bare på serveren.
 * Funksjonene er beskrevet i migrasjonen `*_cpic.sql`.
 */
import type { Databasekall } from '../legemiddeldata/lager.js'
import type { Kildeinfo } from './api.js'
import type { Entitetnavn } from './modell.js'

/** Kontrollsummene fra siste vellykkede bytte, per type. */
export interface ForrigeSynk {
  entiteter: Partial<Record<Entitetnavn, string>>
  parserversjoner: Partial<Record<Entitetnavn, number>>
}

export interface Innlastingsrad {
  id: string
  versjon: number | null
  data: object
  raa?: unknown
}

/** Det synkroniseringen melder om hver type når uttrekket skal byttes inn. */
export interface Entitetsinnhold {
  antall: number
  sha256: string
  /** Usann når typen er uendret siden sist og ikke er lastet inn på nytt. */
  lastet: boolean
  forkastet: number
}

export type Uttrekksinnhold = Kildeinfo & {
  parserversjon: number
  entiteter: Record<Entitetnavn, Entitetsinnhold>
}

/** Tellingen per type etter et bytte. */
export type Opptelling = Partial<
  Record<Entitetnavn, { inn: number; nye?: number; endrede?: number; utgatte?: number; forkastet: number; uendret?: boolean }>
>

export interface Cpiclager {
  forrige(): Promise<ForrigeSynk>
  start(utlostAv: 'cron' | 'manuell'): Promise<number>
  lastInn(synk: number, entitet: Entitetnavn, rader: Innlastingsrad[]): Promise<void>
  fullfor(synk: number, innhold: Uttrekksinnhold): Promise<{ status: 'fullfort' | 'uendret'; antall: Opptelling }>
  avbryt(synk: number, feil: string): Promise<void>
}

export function lagCpiclager(kall: Databasekall): Cpiclager {
  return {
    forrige: async () =>
      ((await kall('cpic_forrige_synk', {})) as ForrigeSynk | null) ?? { entiteter: {}, parserversjoner: {} },
    start: async (utlostAv) => Number(await kall('cpic_start_synk', { utlost_av: utlostAv })),
    lastInn: async (synk, entitet, rader) => {
      await kall('cpic_last_inn', { synk, entitet, rader })
    },
    fullfor: async (synk, innhold) =>
      (await kall('cpic_fullfor_synk', { synk, innhold })) as { status: 'fullfort' | 'uendret'; antall: Opptelling },
    avbryt: async (synk, feil) => {
      await kall('cpic_avbryt_synk', { synk, feil })
    },
  }
}
