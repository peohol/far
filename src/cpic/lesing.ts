/**
 * Lesingen av CPIC-dataene, slik appen gjør den.
 *
 * Nettleseren leser bare OUSFARs egen kopi i Supabase (`les_cpic`), aldri
 * CPIC direkte. En henting en administrator ber om, går gjennom
 * serverendepunktet (`src/cpic/endepunkt.ts`) med administratorens innlogging.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Anbefaling, Gen, Genresultat, Genresultatoppslag, Legemiddel, Par, Publikasjon, Retningslinje } from './modell'

/** Hvilken CPIC-database dataene kommer fra. */
export interface Cpickilde {
  navn: 'CPIC'
  /** Siste publiserte release da dataene ble byttet inn, f.eks. «v1.60.1». */
  release: string | null
  release_dato: string | null
  skjemaversjon: string | null
  /** Når dataene sist ble byttet inn. */
  endret_kl: string | null
  /** Når dataene sist ble kontrollert mot CPIC, også uten endringer. */
  kontrollert_kl: string | null
}

export type RetningslinjeMedPublikasjoner = Retningslinje & { publikasjoner: Publikasjon[] }

/** CPIC-dataene for et sett legemidler. */
export interface Cpicutvalg {
  kilde: Cpickilde
  legemidler: Legemiddel[]
  par: Par[]
  retningslinjer: RetningslinjeMedPublikasjoner[]
  anbefalinger: Anbefaling[]
  gener: Gen[]
  genresultater: Genresultat[]
}

export const TOM_CPICKILDE: Cpickilde = {
  navn: 'CPIC',
  release: null,
  release_dato: null,
  skjemaversjon: null,
  endret_kl: null,
  kontrollert_kl: null,
}

export const TOMT_CPICUTVALG: Cpicutvalg = {
  kilde: TOM_CPICKILDE,
  legemidler: [],
  par: [],
  retningslinjer: [],
  anbefalinger: [],
  gener: [],
  genresultater: [],
}

/** Et allel slik oversettelsen fra diplotype viser det: navnet og funksjonen CPIC har gitt det. */
export interface Allelfunksjon {
  navn: string
  funksjon: string | null
  klinisk_funksjon: string | null
  aktivitetsverdi: string | null
}

/** En kombinasjon av allelfunksjoner eller aktivitetsverdier, med diplotypene CPIC har for den. */
export type Diplotypeoppslag = Genresultatoppslag & { diplotyper: string[] }

/**
 * CPICs oversettelse fra diplotype til resultat for ett gen
 * (`les_cpic_diplotyper`): diplotype → kombinasjon → resultat.
 */
export interface Diplotypegrunnlag {
  kilde: Cpickilde
  /** `null` når CPIC ikke har genet. */
  gen: Gen | null
  genresultater: Genresultat[]
  oppslag: Diplotypeoppslag[]
  alleler: Allelfunksjon[]
}

/** Flest ClinPGx-ID-er `les_cpic` tar imot i ett kall (migrasjonen `*_cpic.sql`). */
export const MAKS_LEGEMIDLER = 200

function erObjekt(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function tekstEllerNull(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

/** Objektene i en liste som har feltene de må ha; resten hoppes over. */
function liste<T>(v: unknown, felt: readonly string[]): T[] {
  return (Array.isArray(v) ? v : []).filter(
    (o): o is T => erObjekt(o) && felt.every((f) => typeof o[f] === 'string' && o[f] !== ''),
  ) as T[]
}

function lesKilde(v: unknown): Cpickilde {
  const k = erObjekt(v) ? v : {}
  return {
    navn: 'CPIC',
    release: tekstEllerNull(k.release),
    release_dato: tekstEllerNull(k.release_dato),
    skjemaversjon: tekstEllerNull(k.skjemaversjon),
    endret_kl: tekstEllerNull(k.endret_kl),
    kontrollert_kl: tekstEllerNull(k.kontrollert_kl),
  }
}

/** Svaret fra `les_cpic`, lest defensivt. */
export function lesCpicutvalg(svar: unknown): Cpicutvalg {
  if (!erObjekt(svar)) return TOMT_CPICUTVALG
  return {
    kilde: lesKilde(svar.kilde),
    legemidler: liste<Legemiddel>(svar.legemidler, ['id', 'navn']),
    par: liste<Par>(svar.par, ['id', 'gen', 'legemiddel_id']),
    retningslinjer: liste<RetningslinjeMedPublikasjoner>(svar.retningslinjer, ['id', 'navn']).map((r) => ({
      ...r,
      publikasjoner: liste<Publikasjon>(r.publikasjoner, ['id']),
    })),
    anbefalinger: liste<Anbefaling>(svar.anbefalinger, ['id', 'legemiddel_id', 'retningslinje_id']).map((a) => ({
      ...a,
      betingelser: liste(a.betingelser, ['gen']),
    })),
    gener: liste<Gen>(svar.gener, ['symbol']),
    genresultater: liste<Genresultat>(svar.genresultater, ['id', 'gen', 'resultat']),
  }
}

/** Svaret fra `les_cpic_diplotyper`, lest defensivt. Diplotyper som ikke er tekst, hoppes over. */
export function lesDiplotypegrunnlag(svar: unknown): Diplotypegrunnlag {
  const s = erObjekt(svar) ? svar : {}
  const gen = liste<Gen>([s.gen], ['symbol'])[0] ?? null
  return {
    kilde: lesKilde(s.kilde),
    gen,
    genresultater: liste<Genresultat>(s.genresultater, ['id', 'gen', 'resultat']),
    oppslag: liste<Diplotypeoppslag>(s.oppslag, ['id', 'genresultat_id']).map((o) => ({
      ...o,
      diplotyper: (Array.isArray(o.diplotyper) ? o.diplotyper : []).filter((d): d is string => typeof d === 'string' && d !== ''),
    })),
    alleler: liste<Allelfunksjon>(s.alleler, ['navn']),
  }
}

/** Legger sammen utvalg lest i flere kall, uten gjentakelser. */
export function slaSammenCpicutvalg(utvalg: readonly Cpicutvalg[]): Cpicutvalg {
  const unike = <T>(lister: T[][], nokkel: (x: T) => string) => [...new Map(lister.flat().map((x) => [nokkel(x), x])).values()]
  const medId = <T extends { id: string }>(felt: (u: Cpicutvalg) => T[]) => unike(utvalg.map(felt), (x) => x.id)
  return {
    kilde: utvalg[0]?.kilde ?? TOM_CPICKILDE,
    legemidler: medId((u) => u.legemidler),
    par: medId((u) => u.par),
    retningslinjer: medId((u) => u.retningslinjer),
    anbefalinger: medId((u) => u.anbefalinger),
    gener: unike(utvalg.map((u) => u.gener), (g) => g.symbol),
    genresultater: medId((u) => u.genresultater),
  }
}

/** Resultatet av en henting en administrator ba om. */
export interface Hentingsresultat {
  status: 'fullfort' | 'uendret' | 'feilet'
  release?: string | null
  feil?: string
}

export interface Cpicleser {
  /** CPIC-dataene for legemidlene med disse ClinPGx-ID-ene. */
  les(clinpgxIder: readonly string[]): Promise<Cpicutvalg>
  /**
   * CPICs oversettelse fra diplotype til resultat for genet. Hentes én gang
   * per gen og husket; bare gensymbolet sendes, aldri en diplotype.
   */
  diplotyper(gen: string): Promise<Diplotypegrunnlag>
  /** Henter CPIC-databasen på nytt nå. Bare for administratorer. */
  hent(): Promise<Hentingsresultat>
}

export function lagCpicleser(klient: SupabaseClient, hent: typeof fetch = (...a) => fetch(...a)): Cpicleser {
  const diplotyper = new Map<string, Promise<Diplotypegrunnlag>>()
  return {
    les: async (clinpgxIder) => {
      const ider = [...new Set(clinpgxIder)]
      if (ider.length === 0) return TOMT_CPICUTVALG
      // Flere enn databasen tar i ett kall (søket i hele kunnskapsbasen) leses i deler.
      const deler: string[][] = []
      for (let i = 0; i < ider.length; i += MAKS_LEGEMIDLER) deler.push(ider.slice(i, i + MAKS_LEGEMIDLER))
      const svar = await Promise.all(
        deler.map(async (del) => {
          const { data, error } = await klient.rpc('les_cpic', { clinpgx_ider: del })
          if (error) throw new Error(error.message)
          return lesCpicutvalg(data)
        }),
      )
      return svar.length === 1 ? svar[0]! : slaSammenCpicutvalg(svar)
    },
    diplotyper: (gen) => {
      const husket = diplotyper.get(gen)
      if (husket) return husket
      const lest = (async () => {
        const { data, error } = await klient.rpc('les_cpic_diplotyper', { gensymbol: gen })
        if (error) throw new Error(error.message)
        return lesDiplotypegrunnlag(data)
      })()
      diplotyper.set(gen, lest)
      // En feil huskes ikke, så neste forsøk leser på nytt.
      lest.catch(() => diplotyper.delete(gen))
      return lest
    },
    hent: async () => {
      const { data } = await klient.auth.getSession()
      const token = data.session?.access_token
      if (!token) throw new Error('Du må være logget inn.')
      const res = await hent('/api/cpic-synk', { method: 'POST', headers: { authorization: `Bearer ${token}` } })
      // Nye data kan ha endret tabellene fra diplotype til resultat.
      diplotyper.clear()
      const svar = (await res.json().catch(() => null)) as Hentingsresultat | { feil?: string } | null
      if (svar && 'status' in svar) return svar
      throw new Error((svar && 'feil' in svar && svar.feil) || `Serveren svarte ${res.status}.`)
    },
  }
}
