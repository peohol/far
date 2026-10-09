/**
 * Kopien av Farmakologiportalen i databasen, slik synkroniseringen skriver
 * til den. Skrivingen krever den hemmelige nøkkelen og skjer bare på
 * serveren. Funksjonene er beskrevet i migrasjonen `*_farmakologiportalen.sql`.
 */
import type { Databasekall } from '../legemiddeldata/lager.js'
import type { Entitetnavn } from './modell.js'

export interface ForrigeSynk {
  entiteter: Partial<Record<Entitetnavn, string>>
  parserversjoner: Partial<Record<Entitetnavn, number>>
}

export interface Innlastingsrad {
  id: string
  data: object
  raa?: unknown
}

export interface Entitetsinnhold {
  antall: number
  sha256: string
  /** Usann når typen er uendret siden sist og ikke er lastet inn på nytt. */
  lastet: boolean
  forkastet: number
}

/** Det kjøringen fant som bør vurderes av noen, til «Datakilder». */
export interface Synkrapport {
  /** Forbindelsene uten kobling til portalen. */
  uavklarte: string[]
  /** Én setning per forhold: en kobling som ikke stemmer lenger, ulik molekylvekt, ukjente prøvematerialer. */
  merknader: string[]
}

export interface Uttrekksinnhold {
  parserversjon: number
  entiteter: Record<Entitetnavn, Entitetsinnhold>
  rapport: Synkrapport
}

/** Henvisninger som ikke traff etter byttet, per henvisning. */
export interface Brudd {
  fra: Entitetnavn
  til: Entitetnavn
  antall: number
  eksempler: string[]
}

export type Opptelling = Partial<
  Record<Entitetnavn, { inn: number; nye?: number; endrede?: number; utgatte?: number; forkastet: number; uendret?: boolean }>
> &
  Partial<Synkrapport> & { brudd?: Brudd[] }

export interface Fplager {
  forrige(): Promise<ForrigeSynk>
  start(utlostAv: 'cron' | 'manuell'): Promise<number>
  lastInn(synk: number, entitet: Entitetnavn, rader: Innlastingsrad[]): Promise<void>
  fullfor(synk: number, innhold: Uttrekksinnhold): Promise<{ status: 'fullfort' | 'uendret'; antall: Opptelling }>
  avbryt(synk: number, feil: string): Promise<void>
  /** Molekylvektene PubChem-kopien har for CID-ene (g/mol), til sammenligningen. */
  molvekter(cider: readonly number[]): Promise<Map<number, number>>
}

export function lagFplager(kall: Databasekall): Fplager {
  return {
    forrige: async () => ((await kall('fp_forrige_synk', {})) as ForrigeSynk | null) ?? { entiteter: {}, parserversjoner: {} },
    start: async (utlostAv) => Number(await kall('fp_start_synk', { utlost_av: utlostAv })),
    lastInn: async (synk, entitet, rader) => {
      await kall('fp_last_inn', { synk, entitet, rader })
    },
    fullfor: async (synk, innhold) =>
      (await kall('fp_fullfor_synk', { synk, innhold })) as { status: 'fullfort' | 'uendret'; antall: Opptelling },
    avbryt: async (synk, feil) => {
      await kall('fp_avbryt_synk', { synk, feil })
    },
    molvekter: async (cider) => {
      const vekter = new Map<number, number>()
      // les_kjemi tar høyst 200 om gangen.
      for (let i = 0; i < cider.length; i += 200) {
        const svar = (await kall('les_kjemi', { cider: cider.slice(i, i + 200) })) as {
          forbindelser?: { cid?: unknown; data?: { molvekt?: unknown } }[]
        } | null
        for (const f of svar?.forbindelser ?? []) {
          const mw = Number(f.data?.molvekt)
          if (typeof f.cid === 'number' && Number.isFinite(mw) && mw > 0) vekter.set(f.cid, mw)
        }
      }
      return vekter
    },
  }
}
