/**
 * Lesingen av faginnholdet, slik appen gjør den.
 *
 * Hver stoffside leses i ett kall etter stoffets nøkkel (`les_stoff`), med
 * radsikkerheten som ellers: det publiserte for alle, utkastet bare for
 * administratorer. Hvert objekt kommer tilbake som en {@link Utgave} — innholdet
 * i én tilstand, revisjonen det står på, og hvem som laget den.
 *
 * Fortolkningsreglene leses for seg, etter analyttkoden eller modulen, og
 * kobles inn på stoffsiden bare der koblingene i stoffregisteret sier det.
 *
 * Klienten sendes inn, som i `lagring.ts`, slik at modulen ikke binder seg til
 * én bestemt oppkobling.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { tilFeil } from './lagring'
import type { Historikk } from './historikk'
import type { Infosideinnhold, Innholdselementinnhold, Referanseinnhold, Tilstand } from './modell'
import { referanseomraderPerAnalytt, type Stoffreferanseomrade } from '../domain/koblinger'
import type { Stoffoppforing } from '../domain/stoffregister'
import type { Kommentarinnhold } from '../domain/kommentarobjekt'
import { harVerdi, lesIntervallverdi, type Intervallverdi } from './paneler'
import { kommentarIder } from '../regler/kommentarer'
import type { Intervallregelsettinnhold } from '../regler/modell'
import type { ThcRegelsettinnhold } from '../domain/thcTekster'
import { scenariokommentarer } from '../regler/scenarioredigering'
import type { Scenarioregelsett } from '../domain/scenario'
import type { Scenarioregeldata } from './scenarioregler'

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
  /**
   * Hvor innholdet kom fra når det ikke ble skrevet i appen, f.eks.
   * «Importert fra Psykofarmaka.pdf, side 7». Utelatt for vanlige endringer.
   */
  kilde?: string
}

/**
 * Et regelsett med kommentarobjektene det peker på, i samme tilstand. Hver
 * har sin egen revisjon og publisering; se `src/regler/kommentarer.ts`.
 */
export interface Regelsettutgave<T = Intervallregelsettinnhold> {
  regelsett: Utgave<T>
  kommentarer: Utgave<Kommentarinnhold>[]
}

/**
 * Et scenarioregelsett med kommentarobjektene det peker på, i samme tilstand,
 * som {@link Regelsettutgave} for intervallregelsettene.
 */
export interface Scenarioregelsettutgave {
  regelsett: Utgave<Scenarioregelsett>
  kommentarer: Utgave<Kommentarinnhold>[]
}

/** Alt på én stoffside — monografien — i én tilstand. */
export interface Stoffsidedata {
  /** Stoffet siden handler om, slik databasen har det. `null` når siden ikke finnes ennå. */
  stoff: Stoffoppforing | null
  infoside: Utgave<Infosideinnhold> | null
  elementer: Utgave<Innholdselementinnhold>[]
  referanser: Utgave<Referanseinnhold>[]
}

/** Et stoff som ikke har noen side ennå, eller som leseren ikke har tilgang til. */
export const TOM_STOFFSIDE: Stoffsidedata = { stoff: null, infoside: null, elementer: [], referanser: [] }

/**
 * Fortolkningsreglene for laboratorieanalyttene en stoffside viser, lest for
 * seg etter analyttkoden og fortolkningsmodulen — aldri gjennom siden. De hører
 * til fortolkningssystemet; stoffsiden viser og redigerer dem der koblingen i
 * stoffregisteret sier at stoffet er analyttens primære stoff.
 */
export interface Regeldata {
  /** Intervallregelsettet for hver analyttkode som har et. */
  regelsett: Readonly<Record<string, Regelsettutgave>>
  /** THC-syreregelsettet, når en av analyttene er THC-syre (`THC_KODE`). */
  thcregelsett: Regelsettutgave<ThcRegelsettinnhold> | null
  /**
   * Scenarioregelsettet for hver modul analyttene fortolkes i med
   * scenarioregler, etter modulens ID. Hentes bare til redigeringen;
   * lesemodusen viser dem appen alt har hentet (`Scenarioreglerkilde`).
   */
  scenarioregelsett: Readonly<Record<string, Scenarioregelsettutgave>>
}

export const INGEN_REGLER: Regeldata = { regelsett: {}, thcregelsett: null, scenarioregelsett: {} }

export interface Faginnholdsleser {
  /** Stoffsiden for stoffet med denne nøkkelen. {@link TOM_STOFFSIDE} når siden ikke finnes. */
  lesStoffside(slug: string, tilstand: Tilstand): Promise<Stoffsidedata>
  /** Nøkkelen og navnet til hver stoffside i databasen, alfabetisk. */
  lesStoffliste(tilstand: Tilstand): Promise<Stoffoppforing[]>
  /** Hele referansebasen, til å velge kilder fra. */
  lesReferanser(tilstand: Tilstand): Promise<Utgave<Referanseinnhold>[]>
  /** Regelsettet for en analyttkode med kommentarene det bruker, eller `null` når koden ikke har noe. */
  finnIntervallregelsett(kode: string, tilstand: Tilstand): Promise<Regelsettutgave | null>
  /** Scenarioregelsettet for en fortolkningsmodul med kommentarene det bruker, eller `null` når modulen ikke har noe. */
  finnScenarioregelsett(modul: string, tilstand: Tilstand): Promise<Scenarioregelsettutgave | null>
  /** Alle regelsettene i én tilstand, sortert på analyttkode. Fortolkningen bruker de publiserte. */
  lesIntervallregelsett(tilstand: Tilstand): Promise<Utgave<Intervallregelsettinnhold>[]>
  /** THC-syreregelsettet med kommentarene tekstbolkene bruker, eller `null` når det ikke finnes. */
  lesThcRegelsett(tilstand: Tilstand): Promise<Regelsettutgave<ThcRegelsettinnhold> | null>
  /** Kommentarene i én tilstand: alle, eller bare dem med disse ID-ene. */
  lesKommentarer(tilstand: Tilstand, ider?: string[]): Promise<Utgave<Kommentarinnhold>[]>
  /**
   * Referanseområdet for hver analyttkode som har et, i én tilstand: kortet
   * på det primære stoffets side (se `referanseomraderPerAnalytt`).
   * Fortolkningen viser det samme tallet under analyttnavnet.
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

  const lesThcRegelsett: Faginnholdsleser['lesThcRegelsett'] = async (tilstand) => {
    const regelsett = await kall<Utgave<ThcRegelsettinnhold>>('les_thc_regelsett', { regelsettilstand: tilstand })
    if (!regelsett) return null
    return { regelsett, kommentarer: await lesKommentarer(tilstand, Object.values(regelsett.innhold.tekstbolker)) }
  }

  const finnIntervallregelsett: Faginnholdsleser['finnIntervallregelsett'] = async (kode, tilstand) => {
    const regelsett = await kall<Utgave<Intervallregelsettinnhold>>('finn_intervallregelsett', {
      analyttkode: kode,
      sidetilstand: tilstand,
    })
    if (!regelsett) return null
    return { regelsett, kommentarer: await lesKommentarer(tilstand, kommentarIder(regelsett.innhold)) }
  }

  return {
    lesStoffside: async (slug, tilstand) => ({
      ...TOM_STOFFSIDE,
      ...(await kall<Partial<Stoffsidedata>>('les_stoff', { stoff: slug, sidetilstand: tilstand })),
    }),
    lesStoffliste: async (tilstand) => (await kall<Stoffoppforing[]>('les_stoffliste', { sidetilstand: tilstand })) ?? [],
    lesReferanser: async (tilstand) =>
      (await kall<Utgave<Referanseinnhold>[]>('les_referanser', { sidetilstand: tilstand })) ?? [],
    finnIntervallregelsett,
    finnScenarioregelsett: async (modul, tilstand) => {
      // Alle regelsettene kommer i ett kall; det er få av dem.
      const data = await kall<Scenarioregeldata>('les_scenarioregler', { regeltilstand: tilstand })
      const regelsett = data?.regelsett.find((r) => r.innhold.modul === modul)
      if (!data || !regelsett) return null
      const ider = new Set(scenariokommentarer(regelsett.innhold))
      return { regelsett, kommentarer: data.kommentarer.filter((k) => ider.has(k.id)) }
    },
    lesIntervallregelsett: async (tilstand) =>
      (await kall<Utgave<Intervallregelsettinnhold>[]>('les_intervallregelsett', { sidetilstand: tilstand })) ?? [],
    lesThcRegelsett,
    lesKommentarer,
    lesReferanseomrader: async (tilstand) => {
      const kort = (await kall<Stoffreferanseomrade[]>('les_stoffreferanseomrader', { sidetilstand: tilstand })) ?? []
      return new Map(
        [...referanseomraderPerAnalytt(kort)].flatMap(([kode, verdi]) => {
          const omrade = lesIntervallverdi(verdi)
          return harVerdi(omrade) ? [[kode, omrade] as const] : []
        }),
      )
    },
    lesHistorikk: async <T,>(objekt: string) =>
      (await kall<Historikk<T>>('les_historikk', { objekt })) ?? { hendelser: [], revisjoner: [] },
  }
}
