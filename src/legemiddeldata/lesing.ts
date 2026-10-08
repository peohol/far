/**
 * Lesingen av legemiddeldataene, slik appen gjør den.
 *
 * Nettleseren leser bare OUSFARs egen kopi i Supabase, aldri FEST direkte, og
 * bare gjennom funksjonene som er åpne for innloggede: `les_legemidler` (alt
 * en stoffside trenger om virkestoffene den er koblet til), `sok_virkestoff`
 * (til å velge koblingen) og `les_interaksjoner` (interaksjonene for
 * ATC-kodene og virkestoffene). Søket i hele kunnskapsbasen leser bare navnene,
 * med `les_preparatsok` og `les_interaksjonssok`. De er beskrevet i
 * migrasjonene `*_legemiddeldata.sql`, `*_legemiddelkobling.sql`,
 * `*_interaksjoner.sql` og `*_sokedata.sql`.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  Byttegruppedata,
  IkkeVurdertdata,
  Interaksjonsdata,
  Merkevaredata,
  Pakningsdata,
  Styrkedata,
  Virkestoffdata,
} from './fest'

export type MedId<T> = T & { id: string }

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

/** Det interaksjonene slås opp på: ATC-kodene, og virkestoff uten ATC-kode. */
export interface Interaksjonsnokler {
  atc: readonly string[]
  virkestoff: readonly string[]
}

/** Interaksjonene i FEST for et sett nøkler, og hvilke ATC-koder som ikke er vurdert. */
export interface Interaksjonsutvalg {
  interaksjoner: MedId<Interaksjonsdata>[]
  ikke_vurdert: MedId<IkkeVurdertdata>[]
}

export const TOMME_INTERAKSJONER: Interaksjonsutvalg = { interaksjoner: [], ikke_vurdert: [] }

/** Et preparat i søkedataene: legemiddelformens kode og tekst, og varenavnet. */
export type Preparatsokerad = [kode: string | null, tekst: string | null, navn: string]

/** En interaksjon i søkedataene: ID-en, FESTs relevanskode og navnet på det siden interagerer med. */
export type Interaksjonssokerad = [id: string, relevans: string, med: string]

/**
 * Det søket i hele kunnskapsbasen trenger fra legemiddeldataene: for hver side
 * — gitt som virkestoffene den er koblet til — preparatnavnene og
 * interaksjonene seksjonene viser. Svaret har én liste per side, i samme
 * rekkefølge.
 */
export interface Legemiddelsok {
  preparater(sider: readonly (readonly string[])[]): Promise<Preparatsokerad[][]>
  interaksjoner(sider: readonly (readonly string[])[]): Promise<Interaksjonssokerad[][]>
}

/** Flest sider `les_preparatsok` og `les_interaksjonssok` tar imot i ett kall (migrasjonen `*_sokedata.sql`). */
export const MAKS_SOKESIDER = 500

export function lagLegemiddelsok(klient: SupabaseClient): Legemiddelsok {
  const les = <T>(funksjon: string) => async (sider: readonly (readonly string[])[]): Promise<T[][]> => {
    const deler: (readonly string[])[][] = []
    for (let i = 0; i < sider.length; i += MAKS_SOKESIDER) deler.push(sider.slice(i, i + MAKS_SOKESIDER))
    const svar = await Promise.all(
      deler.map(async (del) => {
        const { data, error } = await klient.rpc(funksjon, { sider: del })
        if (error) throw new Error(error.message)
        if (!Array.isArray(data) || data.length !== del.length) throw new Error(`${funksjon} ga et uventet svar.`)
        return data as T[][]
      }),
    )
    return svar.flat()
  }
  return { preparater: les<Preparatsokerad>('les_preparatsok'), interaksjoner: les<Interaksjonssokerad>('les_interaksjonssok') }
}

export interface Legemiddelleser {
  les(virkestoff: readonly string[]): Promise<Legemiddelutvalg>
  sok(tekst: string): Promise<Virkestofftreff[]>
  interaksjoner(nokler: Interaksjonsnokler): Promise<Interaksjonsutvalg>
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
    interaksjoner: async ({ atc, virkestoff }) => {
      if (atc.length === 0 && virkestoff.length === 0) return TOMME_INTERAKSJONER
      const utvalg = await kall<Interaksjonsutvalg>('les_interaksjoner', {
        atc_koder: [...atc],
        virkestoff_ider: [...virkestoff],
      })
      return utvalg ? { ...TOMME_INTERAKSJONER, ...utvalg } : TOMME_INTERAKSJONER
    },
  }
}
