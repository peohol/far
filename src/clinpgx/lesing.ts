/**
 * Lesingen av ClinPGx-dataene, slik appen gjør den.
 *
 * Nettleseren leser bare OUSFARs egen kopi i Supabase (`les_farmakogenetikk`),
 * aldri ClinPGx direkte. Oppslaget i ClinPGx når en administrator kobler en
 * side, og hentingen en administrator ber om, går gjennom serverendepunktene
 * (`src/clinpgx/endepunkt.ts`) med administratorens innlogging.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  erObjekt,
  lesKlinisk,
  lesPreparatomtale,
  lesRetningslinje,
  type Kjemikalie,
  type KliniskAnnotasjon,
  type Preparatomtale,
  type Retningslinje,
} from './modell'

/** Hvilke av de forespurte kjemikaliene en annotasjon gjelder. */
export type MedKjemikalier<T> = T & { kjemikalier: string[] }

/** Et kjemikalie i kopien: når det sist ble hentet, og siste feil. */
export interface Kjemikaliestatus {
  id: string
  /** Navnet ClinPGx ga ved siste henting; `null` før det er hentet. */
  navn: string | null
  /** Usann når ClinPGx har svart at kjemikaliet ikke finnes. */
  finnes: boolean
  sist_hentet_kl: string | null
  feil: string | null
  feil_kl: string | null
}

/** ClinPGx-dataene for et sett kjemikalier. */
export interface Farmakogenetikkutvalg {
  kilde: string
  /** Når en synkronisering sist gikk til ende. */
  kontrollert_kl: string | null
  kjemikalier: Kjemikaliestatus[]
  retningslinjer: MedKjemikalier<Retningslinje>[]
  preparatomtaler: MedKjemikalier<Preparatomtale>[]
  kliniske: MedKjemikalier<KliniskAnnotasjon>[]
}

export const TOMT_FARMAKOGENETIKKUTVALG: Farmakogenetikkutvalg = {
  kilde: 'ClinPGx',
  kontrollert_kl: null,
  kjemikalier: [],
  retningslinjer: [],
  preparatomtaler: [],
  kliniske: [],
}

function liste(verdi: unknown): unknown[] {
  return Array.isArray(verdi) ? verdi : []
}

function kjemikalieider(o: unknown): string[] {
  return erObjekt(o) ? liste(o.kjemikalier).filter((k): k is string => typeof k === 'string') : []
}

/** Hver annotasjon for seg: en som ikke kan leses, hoppes over, og resten vises. */
function lesListe<T>(verdi: unknown, les: (o: unknown) => T | null): MedKjemikalier<T>[] {
  return liste(verdi).flatMap((o) => {
    const lest = les(o)
    return lest ? [{ ...lest, kjemikalier: kjemikalieider(o) }] : []
  })
}

function tekstEllerNull(verdi: unknown): string | null {
  return typeof verdi === 'string' && verdi.trim() ? verdi.trim() : null
}

/** Svaret fra `les_farmakogenetikk`, lest defensivt. */
export function lesFarmakogenetikkutvalg(svar: unknown): Farmakogenetikkutvalg {
  if (!erObjekt(svar)) return TOMT_FARMAKOGENETIKKUTVALG
  return {
    kilde: tekstEllerNull(svar.kilde) ?? 'ClinPGx',
    kontrollert_kl: tekstEllerNull(svar.kontrollert_kl),
    kjemikalier: liste(svar.kjemikalier)
      .filter(erObjekt)
      .map((k) => ({
        id: tekstEllerNull(k.id) ?? '',
        navn: tekstEllerNull(k.navn),
        finnes: k.finnes !== false,
        sist_hentet_kl: tekstEllerNull(k.sist_hentet_kl),
        feil: tekstEllerNull(k.feil),
        feil_kl: tekstEllerNull(k.feil_kl),
      }))
      .filter((k) => k.id),
    retningslinjer: lesListe(svar.retningslinjer, lesRetningslinje),
    preparatomtaler: lesListe(svar.preparatomtaler, lesPreparatomtale),
    kliniske: lesListe(svar.kliniske, lesKlinisk),
  }
}

/**
 * Den delen av et utvalg som gjelder noen av kjemikaliene. Da kan dataene for
 * mange sider leses i ett kall og deles opp etterpå.
 */
export function farmakogenetikkFor(utvalg: Farmakogenetikkutvalg, koblet: readonly string[]): Farmakogenetikkutvalg {
  const egne = new Set(koblet)
  const gjelder = <T extends { kjemikalier: string[] }>(a: T) => a.kjemikalier.some((k) => egne.has(k))
  return {
    ...utvalg,
    kjemikalier: utvalg.kjemikalier.filter((k) => egne.has(k.id)),
    retningslinjer: utvalg.retningslinjer.filter(gjelder),
    preparatomtaler: utvalg.preparatomtaler.filter(gjelder),
    kliniske: utvalg.kliniske.filter(gjelder),
  }
}

/** Resultatet av en henting en administrator ba om. */
export interface Hentingsresultat {
  status: 'fullfort' | 'delvis' | 'feilet'
  hentet?: number
  feilet?: number
  feil?: string
}

export interface Farmakogenetikkleser {
  les(kjemikalier: readonly string[]): Promise<Farmakogenetikkutvalg>
  /** Slår opp et kjemikalie i ClinPGx, på navnet eller ID-en. Bare for administratorer. */
  sok(tekst: string): Promise<Kjemikalie[]>
  /** Henter dataene for kjemikaliene fra ClinPGx nå. Bare for administratorer. */
  hent(kjemikalier: readonly string[]): Promise<Hentingsresultat>
}

/** Flest kjemikalier `les_farmakogenetikk` tar imot i ett kall (migrasjonen `*_clinpgx.sql`). */
export const MAKS_KJEMIKALIER = 200

export function lagFarmakogenetikkleser(klient: SupabaseClient, hent: typeof fetch = (...a) => fetch(...a)): Farmakogenetikkleser {
  async function innlogget(): Promise<Record<string, string>> {
    const { data } = await klient.auth.getSession()
    const token = data.session?.access_token
    if (!token) throw new Error('Du må være logget inn.')
    return { authorization: `Bearer ${token}` }
  }

  async function json(res: Response): Promise<Record<string, unknown>> {
    const innhold = (await res.json().catch(() => ({}))) as unknown
    if (!res.ok) {
      const feil = erObjekt(innhold) && typeof innhold.feil === 'string' ? innhold.feil : `Serveren svarte ${res.status}.`
      throw new Error(feil)
    }
    return erObjekt(innhold) ? innhold : {}
  }

  return {
    les: async (kjemikalier) => {
      if (kjemikalier.length === 0) return TOMT_FARMAKOGENETIKKUTVALG
      const deler: string[][] = []
      for (let i = 0; i < kjemikalier.length; i += MAKS_KJEMIKALIER) deler.push(kjemikalier.slice(i, i + MAKS_KJEMIKALIER))
      const svar = await Promise.all(
        deler.map(async (del) => {
          const { data, error } = await klient.rpc('les_farmakogenetikk', { kjemikalie_ider: del })
          if (error) throw new Error(error.message)
          return lesFarmakogenetikkutvalg(data)
        }),
      )
      if (svar.length === 1) return svar[0]!
      const unike = <T extends { id: string }>(lister: T[][]) => [...new Map(lister.flat().map((x) => [x.id, x])).values()]
      return {
        ...svar[0]!,
        kjemikalier: unike(svar.map((s) => s.kjemikalier)),
        retningslinjer: unike(svar.map((s) => s.retningslinjer)),
        preparatomtaler: unike(svar.map((s) => s.preparatomtaler)),
        kliniske: unike(svar.map((s) => s.kliniske)),
      }
    },
    sok: async (tekst) => {
      if (tekst.trim().length < 2) return []
      const res = await hent(`/api/clinpgx-sok?q=${encodeURIComponent(tekst.trim())}`, { headers: await innlogget() })
      const { treff } = await json(res)
      return Array.isArray(treff) ? (treff as Kjemikalie[]) : []
    },
    hent: async (kjemikalier) => {
      const res = await hent('/api/clinpgx-synk', {
        method: 'POST',
        headers: { ...(await innlogget()), 'content-type': 'application/json' },
        body: JSON.stringify({ kjemikalier }),
      })
      const svar = (await res.json().catch(() => null)) as Hentingsresultat | { feil?: string } | null
      if (svar && 'status' in svar) return svar
      throw new Error((svar && 'feil' in svar && svar.feil) || `Serveren svarte ${res.status}.`)
    },
  }
}
