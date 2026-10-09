/**
 * ClinPGx-kopien i databasen, slik synkroniseringen skriver til den.
 *
 * Skrivingen krever den hemmelige nøkkelen og skjer bare på serveren.
 * Funksjonene er beskrevet i migrasjonen `*_clinpgx.sql`.
 */
import type { Databasekall } from '../legemiddeldata/lager.js'
import type { Annotasjonstype } from './modell.js'

export interface KobletKjemikalie {
  id: string
  /** Navnet koblingen lagret, fra ClinPGx da den ble valgt. */
  navn: string | null
  sist_hentet_kl: string | null
  /** Kjøringen som sist hentet kjemikaliet eller noterte en feil på det. */
  sist_synk: number | null
}

export interface Lagringsannotasjon {
  type: Annotasjonstype
  id: string
  data: object
  raa: unknown
}

/** Antall annotasjoner av hver type som ble byttet inn for et kjemikalie. */
export type Annotasjonstelling = Partial<Record<Annotasjonstype, number>>

export interface Synkresultattelling {
  kjemikalier: number
  hentet: number
  feilet: number
  utsatt: number
  annotasjoner: Annotasjonstelling
  /** Objekter i svarene som ikke kunne leses. Kjemikaliet de kom for, ble ikke byttet inn. */
  forkastet: number
  /** Objekter som kunne leses, men hadde en annen form enn ventet (`struktur.ts`). Kjemikaliet ble ikke byttet inn. */
  strukturavvik: number
  /** Feilene per kjemikalie, samlet til én tekst for loggen. */
  feil?: string
}

export interface Clinpgxlager {
  start(utlostAv: 'cron' | 'manuell'): Promise<number>
  /** Åpner en kjøring med kjemikalier utsatt for neste omgang, og gir tellingen så langt. */
  fortsett(synk: number): Promise<Synkresultattelling>
  koblede(): Promise<KobletKjemikalie[]>
  lagre(synk: number, kjemikalie: { id: string; data: object; raa: unknown }, annotasjoner: Lagringsannotasjon[]): Promise<Annotasjonstelling>
  feilet(synk: number, kjemikalie: string, feil: string, finnes?: boolean): Promise<void>
  fullfor(synk: number, resultat: Synkresultattelling, parserversjon: number): Promise<'fullfort' | 'delvis'>
  avbryt(synk: number, feil: string): Promise<void>
}

export function lagClinpgxlager(kall: Databasekall): Clinpgxlager {
  return {
    start: async (utlostAv) => Number(await kall('clinpgx_start_synk', { utlost_av: utlostAv })),
    fortsett: async (synk) => (await kall('clinpgx_fortsett_synk', { synk })) as Synkresultattelling,
    koblede: async () => ((await kall('clinpgx_koblede_kjemikalier', {})) as KobletKjemikalie[] | null) ?? [],
    lagre: async (synk, kjemikalie, annotasjoner) =>
      ((await kall('clinpgx_lagre_kjemikalie', { synk, kjemikalie, annotasjoner })) as Annotasjonstelling | null) ?? {},
    feilet: async (synk, kjemikalie, feil, finnes = true) => {
      await kall('clinpgx_kjemikalie_feilet', { synk, kjemikalie_id: kjemikalie, feil, finnes })
    },
    fullfor: async (synk, resultat, parserversjon) =>
      (await kall('clinpgx_fullfor_synk', { synk, resultat, parserversjon })) as 'fullfort' | 'delvis',
    avbryt: async (synk, feil) => {
      await kall('clinpgx_avbryt_synk', { synk, feil })
    },
  }
}
