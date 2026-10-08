/**
 * Lesingen av de kjemiske grunndataene, slik appen gjør den.
 *
 * Nettleseren leser bare OUSFARs egen kopi i Supabase (`les_kjemi`), aldri
 * PubChem direkte. Svaret leses defensivt: en forbindelse som ikke ser ut som
 * ventet, hoppes over, så siden aldri viser halve tall.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { INCHIKEY } from './forbindelser'
import type { Pubchemdata } from './pubchem'

/** En forbindelse i kopien, med når den sist ble hentet og endret. */
export interface Kjemipost {
  cid: number
  data: Pubchemdata
  sist_hentet_kl: string | null
  sist_endret_kl: string | null
}

export interface Kjemiutvalg {
  kilde: string
  forbindelser: Kjemipost[]
}

export interface Kjemileser {
  /** Dataene for CID-ene, som tekst (slik `useKilde` tar ID-ene). */
  les(cider: readonly string[]): Promise<Kjemiutvalg>
}

const erObjekt = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const tekst = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)
const tall = (v: unknown, standard = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : standard)

/** Dataene slik synkroniseringen lagret dem, eller `null` når noe av det som vises, mangler. */
export function lesPubchemdata(o: unknown): Pubchemdata | null {
  if (!erObjekt(o)) return null
  const cid = tall(o.cid)
  const formel = tekst(o.formel)
  const molvekt = tekst(o.molvekt)
  const inchikey = tekst(o.inchikey)
  if (!Number.isInteger(cid) || cid <= 0 || !formel || !molvekt || !/^\d+(\.\d+)?$/.test(molvekt) || !inchikey || !INCHIKEY.test(inchikey)) {
    return null
  }
  const stereo = erObjekt(o.stereo) ? o.stereo : {}
  return {
    cid,
    tittel: tekst(o.tittel) ?? `CID ${cid}`,
    formel,
    molvekt,
    monoisotopisk_masse: tekst(o.monoisotopisk_masse),
    inchikey,
    iupac: tekst(o.iupac),
    ladning: tall(o.ladning),
    enheter: tall(o.enheter, 1),
    stereo: {
      definerte: tall(stereo.definerte),
      udefinerte: tall(stereo.udefinerte),
      definerte_bindinger: tall(stereo.definerte_bindinger),
      udefinerte_bindinger: tall(stereo.udefinerte_bindinger),
    },
  }
}

export function lesKjemiutvalg(svar: unknown): Kjemiutvalg {
  const o = erObjekt(svar) ? svar : {}
  const forbindelser: Kjemipost[] = []
  for (const f of Array.isArray(o.forbindelser) ? o.forbindelser : []) {
    if (!erObjekt(f)) continue
    const data = lesPubchemdata(f.data)
    if (data && data.cid === f.cid) {
      forbindelser.push({ cid: data.cid, data, sist_hentet_kl: tekst(f.sist_hentet_kl), sist_endret_kl: tekst(f.sist_endret_kl) })
    }
  }
  return { kilde: tekst(o.kilde) ?? 'PubChem', forbindelser }
}

export function lagKjemileser(klient: SupabaseClient): Kjemileser {
  return {
    les: async (cider) => {
      const { data, error } = await klient.rpc('les_kjemi', { cider: cider.map(Number) })
      if (error) throw new Error(error.message)
      return lesKjemiutvalg(data)
    },
  }
}
