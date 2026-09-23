/**
 * Lesingen av legemiddeldataene, slik appen gjør den.
 *
 * Nettleseren leser bare OUSFARs egen kopi i Supabase, aldri FEST direkte, og
 * bare gjennom de to funksjonene som er åpne for innloggede:
 * `les_legemidler` (alt en stoffside trenger om virkestoffene den er koblet
 * til) og `sok_virkestoff` (til å velge koblingen). Begge er beskrevet i
 * migrasjonene `*_legemiddeldata.sql` og `*_legemiddelkobling.sql`.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Byttegruppedata, Merkevaredata, Pakningsdata, Styrkedata, Virkestoffdata } from './fest'

type MedId<T> = T & { id: string }

/** Legemiddeldataene for virkestoffene en side er koblet til. */
export interface Legemiddelutvalg {
  kilde: string
  /** Når kopien sist ble kontrollert mot kilden, vellykket. */
  kontrollert_kl: string | null
  /** Når kilden laget uttrekket kopien bygger på. */
  kildedato: string | null
  /** De koblede virkestoffene, og de andre virkestoffene i preparatene. */
  virkestoff: MedId<Virkestoffdata & { utgatt: boolean }>[]
  styrker: MedId<Styrkedata>[]
  merkevarer: MedId<Merkevaredata>[]
  pakninger: MedId<Pakningsdata>[]
  byttegrupper: MedId<Byttegruppedata>[]
}

export const TOMT_UTVALG: Legemiddelutvalg = {
  kilde: 'FEST',
  kontrollert_kl: null,
  kildedato: null,
  virkestoff: [],
  styrker: [],
  merkevarer: [],
  pakninger: [],
  byttegrupper: [],
}

/** Et virkestoff i søket, til å koble en side til. */
export interface Virkestofftreff {
  id: string
  navn: string
  navn_engelsk: string | null
  /** Stoffene dette er salt eller ester av. Tom for et moderstoff. */
  salt_av: string[]
  /** Preparater som ikke er utgått, som har stoffet, også gjennom saltene. */
  preparater: number
}

export interface Legemiddelleser {
  les(virkestoff: readonly string[]): Promise<Legemiddelutvalg>
  sok(tekst: string): Promise<Virkestofftreff[]>
}

export function lagLegemiddelleser(klient: SupabaseClient): Legemiddelleser {
  async function kall<T>(funksjon: string, argumenter: Record<string, unknown>): Promise<T | null> {
    const { data, error } = await klient.rpc(funksjon, argumenter)
    if (error) throw new Error(error.message)
    return (data ?? null) as T | null
  }

  return {
    les: async (virkestoff) => {
      if (virkestoff.length === 0) return TOMT_UTVALG
      const utvalg = await kall<Legemiddelutvalg>('les_legemidler', { virkestoff_ider: [...virkestoff] })
      return utvalg ? { ...TOMT_UTVALG, ...utvalg } : TOMT_UTVALG
    },
    sok: async (tekst) =>
      tekst.trim().length < 2 ? [] : ((await kall<Virkestofftreff[]>('sok_virkestoff', { sok: tekst })) ?? []),
  }
}
