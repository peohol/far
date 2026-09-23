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
import type { Historikk } from './historikk'
import type {
  Infosideinnhold,
  Innholdselementinnhold,
  Laboratorieanalyttinnhold,
  Referanseinnhold,
  Tilstand,
} from './modell'
import type { Kommentarinnhold } from '../domain/kommentarobjekt'
import { harVerdi, lesIntervallverdi, type Intervallverdi } from './paneler'
import { kommentarIder } from '../regler/kommentarer'
import type { Intervallregelsettinnhold } from '../regler/modell'

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

/**
 * Et regelsett med kommentarobjektene det peker på, i samme tilstand. Hver
 * har sin egen revisjon og publisering; se `src/regler/kommentarer.ts`.
 */
export interface Regelsettutgave {
  regelsett: Utgave<Intervallregelsettinnhold>
  kommentarer: Utgave<Kommentarinnhold>[]
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
  /**
   * Fortolkningsreglene for koden, når den har et regelsett. Regelsettet er
   * sitt eget objekt og peker på koden, ikke på siden.
   */
  regelsett: Regelsettutgave | null
}

/** En kode som ikke har noen side ennå, eller som leseren ikke har tilgang til. */
export const TOM_SIDE: Analyttsidedata = {
  analytt: null,
  infoside: null,
  elementer: [],
  komponenter: [],
  referanser: [],
  regelsett: null,
}

export interface Faginnholdsleser {
  /**
   * Siden for en analyttkode, med regelsettet for koden. {@link TOM_SIDE}
   * når ingen av delene finnes.
   */
  lesAnalyttside(kode: string, tilstand: Tilstand): Promise<Analyttsidedata>
  /** Hele referansebasen, til å velge kilder fra. */
  lesReferanser(tilstand: Tilstand): Promise<Utgave<Referanseinnhold>[]>
  /** Informasjonssidene med disse navnene, uten hensyn til store og små bokstaver. */
  finnInfosider(navn: string[], tilstand: Tilstand): Promise<Utgave<Infosideinnhold>[]>
  /** Regelsettet for en analyttkode med kommentarene det bruker, eller `null` når koden ikke har noe. */
  finnIntervallregelsett(kode: string, tilstand: Tilstand): Promise<Regelsettutgave | null>
  /** Alle regelsettene i én tilstand, sortert på analyttkode. Fortolkningen bruker de publiserte. */
  lesIntervallregelsett(tilstand: Tilstand): Promise<Utgave<Intervallregelsettinnhold>[]>
  /** Kommentarene i én tilstand: alle, eller bare dem med disse ID-ene. */
  lesKommentarer(tilstand: Tilstand, ider?: string[]): Promise<Utgave<Kommentarinnhold>[]>
  /**
   * Referanseområdet på informasjonssiden for hver analyttkode som har det,
   * i én tilstand. Fortolkningen viser det samme tallet under analyttnavnet.
   */
  lesReferanseomrader(tilstand: Tilstand): Promise<ReadonlyMap<string, Intervallverdi>>
  /**
   * Historikken til ett objekt: hendelsene og øyeblikksbildene. Leseren ser
   * de revisjonene radsikkerheten gir: administratorer alle, andre de som
   * har vært publisert.
   */
  lesHistorikk<T>(objekt: string): Promise<Historikk<T>>
}

export function lagFaginnholdsleser(klient: SupabaseClient): Faginnholdsleser {
  async function kall<T>(funksjon: string, argumenter: Record<string, unknown>): Promise<T | null> {
    const { data, error } = await klient.rpc(funksjon, argumenter)
    if (error) throw tilFeil(error)
    return (data ?? null) as T | null
  }

  const lesKommentarer: Faginnholdsleser['lesKommentarer'] = async (tilstand, ider) =>
    (await kall<Utgave<Kommentarinnhold>[]>('les_kommentarer', {
      kommentartilstand: tilstand,
      ...(ider ? { ider } : {}),
    })) ?? []

  const finnIntervallregelsett: Faginnholdsleser['finnIntervallregelsett'] = async (kode, tilstand) => {
    const regelsett = await kall<Utgave<Intervallregelsettinnhold>>('finn_intervallregelsett', {
      analyttkode: kode,
      sidetilstand: tilstand,
    })
    if (!regelsett) return null
    return { regelsett, kommentarer: await lesKommentarer(tilstand, kommentarIder(regelsett.innhold)) }
  }

  return {
    lesAnalyttside: async (kode, tilstand) => {
      const [side, regelsett] = await Promise.all([
        kall<Omit<Analyttsidedata, 'regelsett'>>('les_analyttside', { analyttkode: kode, sidetilstand: tilstand }),
        finnIntervallregelsett(kode, tilstand),
      ])
      return { ...TOM_SIDE, ...side, regelsett }
    },
    lesReferanser: async (tilstand) =>
      (await kall<Utgave<Referanseinnhold>[]>('les_referanser', { sidetilstand: tilstand })) ?? [],
    finnInfosider: async (navn, tilstand) =>
      (await kall<Utgave<Infosideinnhold>[]>('finn_infosider', { navn, sidetilstand: tilstand })) ?? [],
    finnIntervallregelsett,
    lesIntervallregelsett: async (tilstand) =>
      (await kall<Utgave<Intervallregelsettinnhold>[]>('les_intervallregelsett', { sidetilstand: tilstand })) ?? [],
    lesKommentarer,
    lesReferanseomrader: async (tilstand) => {
      const rader =
        (await kall<{ analyttkode: string; verdi: unknown }[]>('les_referanseomrader', { sidetilstand: tilstand })) ?? []
      return new Map(
        rader.flatMap(({ analyttkode, verdi }) => {
          const omrade = lesIntervallverdi(verdi)
          return harVerdi(omrade) ? [[analyttkode, omrade] as const] : []
        }),
      )
    },
    lesHistorikk: async <T,>(objekt: string) =>
      (await kall<Historikk<T>>('les_historikk', { objekt })) ?? { hendelser: [], revisjoner: [] },
  }
}
