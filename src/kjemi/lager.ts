/**
 * PubChem-kopien i databasen, slik synkroniseringen skriver til den.
 *
 * Skrivingen krever den hemmelige nøkkelen og skjer bare på serveren.
 * Funksjonene er beskrevet i migrasjonen `*_pubchem.sql`.
 */
import type { Databasekall } from '../legemiddeldata/lager.js'
import type { Pubchemdata } from './pubchem.js'

export interface Lagringsforbindelse {
  cid: number
  data: Pubchemdata
  raa: unknown
}

export interface Kjemisynktelling {
  /** Forbindelsene med verifisert kobling til PubChem. */
  forbindelser: number
  /** Byttet inn, og hvor mange av dem som var endret. */
  hentet: number
  endret: number
  /** Ikke byttet inn: dataene fra før står. */
  feilet: number
  /** Av de feilede: PubChem oppgir nå en annen InChIKey eller formel enn koblingen ble kontrollert mot. */
  konflikter: number
  /** Av de feilede: svaret manglet forbindelsen eller kunne ikke leses. */
  strukturavvik: number
  /** Forbindelsene i registeret uten verifisert kobling, til vurdering. */
  uavklarte: string[]
  /** Feilene per forbindelse, samlet til én tekst for loggen. */
  feil?: string
}

export interface Kjemilager {
  start(utlostAv: 'cron' | 'manuell'): Promise<number>
  lagre(synk: number, forbindelser: Lagringsforbindelse[], parserversjon: number): Promise<{ lagret: number; endret: number }>
  feilet(synk: number, feil: { cid: number; feil: string }[]): Promise<void>
  fullfor(synk: number, resultat: Kjemisynktelling, parserversjon: number): Promise<'fullfort' | 'delvis'>
  avbryt(synk: number, feil: string): Promise<void>
}

export function lagKjemilager(kall: Databasekall): Kjemilager {
  return {
    start: async (utlostAv) => Number(await kall('pubchem_start_synk', { utlost_av: utlostAv })),
    lagre: async (synk, forbindelser, parserversjon) => {
      const svar = (await kall('pubchem_lagre', { synk, forbindelser, parserversjon })) as { lagret?: number; endret?: number } | null
      return { lagret: Number(svar?.lagret ?? 0), endret: Number(svar?.endret ?? 0) }
    },
    feilet: async (synk, feil) => {
      await kall('pubchem_feilet', { synk, feil })
    },
    fullfor: async (synk, resultat, parserversjon) =>
      (await kall('pubchem_fullfor_synk', { synk, resultat, parserversjon })) as 'fullfort' | 'delvis',
    avbryt: async (synk, feil) => {
      await kall('pubchem_avbryt_synk', { synk, feil })
    },
  }
}
