/**
 * Lesingen av laboratorieanalysene, slik appen gjør den.
 *
 * Nettleseren leser bare OUSFARs egen kopi i Supabase
 * (`les_laboratorieanalyser`), aldri portalen direkte. Svaret leses
 * defensivt: en rad som ikke ser ut som ventet, hoppes over.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Analysedata, Komponentdata } from './modell'

export interface Labpost<T> {
  id: string
  data: T
}

export interface Laboratoriedata {
  navn: string
  institusjon_id: string | null
  institusjon: string | null
  nettsted: string | null
  /** `false` når portalen har lagt ned laboratoriet; analysene der vises ikke. */
  aktiv?: boolean | null
}

export interface Labutvalg {
  kilde: { kontrollert_kl: string | null; endret_kl: string | null }
  komponenter: Labpost<Komponentdata>[]
  analyser: Labpost<Analysedata>[]
  laboratorier: Labpost<Laboratoriedata>[]
  institusjoner: Labpost<{ navn: string }>[]
}

export interface Lableser {
  /** Analysene for komponent-ID-ene i portalen, med gruppene som dekker dem. */
  les(komponenter: readonly string[]): Promise<Labutvalg>
}

const erObjekt = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const tekst = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)

function poster<T>(v: unknown, gyldig: (data: Record<string, unknown>) => boolean): Labpost<T>[] {
  return (Array.isArray(v) ? v : []).flatMap((p) =>
    erObjekt(p) && tekst(p.id) && erObjekt(p.data) && gyldig(p.data) ? [{ id: tekst(p.id)!, data: p.data as T }] : [],
  )
}

const harNavn = (d: Record<string, unknown>) => Boolean(tekst(d.navn))

export function lesLabutvalg(svar: unknown): Labutvalg {
  const o = erObjekt(svar) ? svar : {}
  const kilde = erObjekt(o.kilde) ? o.kilde : {}
  return {
    kilde: { kontrollert_kl: tekst(kilde.kontrollert_kl), endret_kl: tekst(kilde.endret_kl) },
    komponenter: poster<Komponentdata>(o.komponenter, (d) => harNavn(d) && Array.isArray(d.gruppe) && erObjekt(d.molvekt)),
    analyser: poster<Analysedata>(
      o.analyser,
      (d) => Boolean(tekst(d.komponent_id)) && erObjekt(d.provemateriale) && erObjekt(d.maleomrade) && erObjekt(d.maleomrade.enhet),
    ),
    laboratorier: poster<Laboratoriedata>(o.laboratorier, harNavn),
    institusjoner: poster<{ navn: string }>(o.institusjoner, harNavn),
  }
}

export function lagLableser(klient: SupabaseClient): Lableser {
  return {
    les: async (komponenter) => {
      const { data, error } = await klient.rpc('les_laboratorieanalyser', { komponenter })
      if (error) throw new Error(error.message)
      return lesLabutvalg(data)
    },
  }
}
