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

/** Det en kjøring avslutter med: det som byttes inn, feilene og tellingen. */
export interface Kjemiavslutning {
  forbindelser: Lagringsforbindelse[]
  feil: { cid: number; feil: string }[]
  /** Tellingen uten `hentet` og `endret`, som databasen fyller inn. */
  resultat: Omit<Kjemisynktelling, 'hentet' | 'endret'>
}

export interface Kjemilager {
  start(utlostAv: 'cron' | 'manuell'): Promise<number>
  /** Bytter inn, noterer feilene og avslutter kjøringen i én transaksjon. */
  fullfor(
    synk: number,
    avslutning: Kjemiavslutning,
    parserversjon: number,
  ): Promise<{ status: 'fullfort' | 'delvis'; hentet: number; endret: number }>
  avbryt(synk: number, feil: string): Promise<void>
}

export function lagKjemilager(kall: Databasekall): Kjemilager {
  return {
    start: async (utlostAv) => Number(await kall('pubchem_start_synk', { utlost_av: utlostAv })),
    fullfor: async (synk, { forbindelser, feil, resultat }, parserversjon) => {
      const svar = (await kall('pubchem_fullfor_synk', { synk, forbindelser, feil, resultat, parserversjon })) as {
        status?: string
        hentet?: number
        endret?: number
      } | null
      if (svar?.status !== 'fullfort' && svar?.status !== 'delvis') throw new Error('Databasen avsluttet ikke kjøringen.')
      return { status: svar.status, hentet: Number(svar.hentet ?? 0), endret: Number(svar.endret ?? 0) }
    },
    avbryt: async (synk, feil) => {
      await kall('pubchem_avbryt_synk', { synk, feil })
    },
  }
}
