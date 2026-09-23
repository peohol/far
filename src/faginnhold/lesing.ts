/**
 * Lesingen av faginnholdet, slik appen gjør den.
 *
 * Hver side leses i ett kall (`les_analyttside` i databasen), med
 * radsikkerheten som ellers: det publiserte for alle, utkastet bare for
 * administratorer. Hvert objekt kommer tilbake som en {@link Utgave} — innholdet
 * i én tilstand, revisjonen det står på, og hvem som laget den.
 *
 * Klienten sendes inn, som i `lagring.ts`, slik at modulen ikke binder seg til
 * én bestemt oppkobling.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { tilFeil } from './lagring'
import type {
  Infosideinnhold,
  Innholdselementinnhold,
  Laboratorieanalyttinnhold,
  Referanseinnhold,
  Tilstand,
} from './modell'

/** Ett objekt i én tilstand: øyeblikksbildet tilstanden peker på. */
export interface Utgave<T> {
  id: string
  /** Revisjonen tilstanden peker på. For utkastet er det den som lagres mot. */
  revisjon: number
  /** Den publiserte revisjonen, eller `null` når objektet aldri er publisert. */
  publisert_revisjon: number | null
  innhold: T
  endret_av_fornavn: string
  endret_av_etternavn: string
  endret_kl: string
}

/** En komponentside i en sumanalyse, med kodene som har den som hovedside. */
export type Komponentutgave = Utgave<Infosideinnhold> & { koder: string[] }

/** Alt på én analyttside, i én tilstand. */
export interface Analyttsidedata {
  analytt: Utgave<Laboratorieanalyttinnhold> | null
  infoside: Utgave<Infosideinnhold> | null
  elementer: Utgave<Innholdselementinnhold>[]
  komponenter: Komponentutgave[]
  referanser: Utgave<Referanseinnhold>[]
}

/** En kode som ikke har noen side ennå, eller som leseren ikke har tilgang til. */
export const TOM_SIDE: Analyttsidedata = {
  analytt: null,
  infoside: null,
  elementer: [],
  komponenter: [],
  referanser: [],
}

export interface Faginnholdsleser {
  /** Siden for en analyttkode. {@link TOM_SIDE} når den ikke finnes. */
  lesAnalyttside(kode: string, tilstand: Tilstand): Promise<Analyttsidedata>
  /** Hele referansebasen, til å velge kilder fra. */
  lesReferanser(tilstand: Tilstand): Promise<Utgave<Referanseinnhold>[]>
  /** Informasjonssidene med disse navnene, uten hensyn til store og små bokstaver. */
  finnInfosider(navn: string[], tilstand: Tilstand): Promise<Utgave<Infosideinnhold>[]>
}

export function lagFaginnholdsleser(klient: SupabaseClient): Faginnholdsleser {
  async function kall<T>(funksjon: string, argumenter: Record<string, unknown>): Promise<T | null> {
    const { data, error } = await klient.rpc(funksjon, argumenter)
    if (error) throw tilFeil(error)
    return (data ?? null) as T | null
  }

  return {
    lesAnalyttside: async (kode, tilstand) => {
      const side = await kall<Analyttsidedata>('les_analyttside', {
        analyttkode: kode,
        sidetilstand: tilstand,
      })
      return side ? { ...TOM_SIDE, ...side } : TOM_SIDE
    },
    lesReferanser: async (tilstand) =>
      (await kall<Utgave<Referanseinnhold>[]>('les_referanser', { sidetilstand: tilstand })) ?? [],
    finnInfosider: async (navn, tilstand) =>
      (await kall<Utgave<Infosideinnhold>[]>('finn_infosider', { navn, sidetilstand: tilstand })) ?? [],
  }
}
