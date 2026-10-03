/**
 * Lesingen av bivirkningene for en fagside, slik appen gjør den
 * (`les_bivirkninger` i migrasjonen `*_bivirkninger.sql`).
 *
 * Svaret leses defensivt: en rad med en kode appen ikke kjenner, eller fra en
 * kilde eller tabell (kontekst) som ikke er med, hoppes over, så siden aldri faller sammen av data som
 * ikke ser ut som ventet. Databasen slipper ikke inn slike rader.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  INGEN_BIVIRKNINGER,
  KILDETYPER,
  erFrekvenskode,
  erOrgansystemkode,
  type Bivirkning,
  type Bivirkningsdata,
  type Bivirkningskilde,
  type Kontekst,
} from './modell'

type Objekt = Record<string, unknown>

function erObjekt(v: unknown): v is Objekt {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function tekst(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null
}

function lesKontekst(v: unknown): Kontekst | null {
  if (!erObjekt(v)) return null
  const nokkel = tekst(v.nokkel)
  const navn = tekst(v.navn)
  return nokkel && navn ? { nokkel, navn, frekvensgrunnlag: tekst(v.frekvensgrunnlag), merknad: tekst(v.merknad) } : null
}

function lesKilde(v: unknown): Bivirkningskilde | null {
  if (!erObjekt(v)) return null
  const id = tekst(v.id)
  const tittel = tekst(v.tittel)
  const type = KILDETYPER.find((t) => t === v.type)
  if (!id || !tittel || !type) return null
  return {
    id,
    nokkel: tekst(v.nokkel) ?? id,
    type,
    tittel,
    preparat: tekst(v.preparat),
    innehaver: tekst(v.innehaver),
    spc_versjon: tekst(v.spc_versjon),
    revisjonsdato: tekst(v.revisjonsdato),
    lenke: tekst(v.lenke),
    kontrollert: tekst(v.kontrollert),
    kontrollert_av: tekst(v.kontrollert_av),
    merknad: tekst(v.merknad),
    importert_kl: tekst(v.importert_kl) ?? '',
    importert_av: tekst(v.importert_av) ?? '',
    kontekster: (Array.isArray(v.kontekster) ? v.kontekster : []).map(lesKontekst).filter((k): k is Kontekst => k !== null),
  }
}

/** Kildene etter ID, med nøklene til tabellene i hver. */
type Kildeoppslag = ReadonlyMap<string, ReadonlySet<string>>

function lesBivirkning(v: unknown, kilder: Kildeoppslag): Bivirkning | null {
  if (!erObjekt(v)) return null
  const kilde = tekst(v.kilde)
  const kontekst = tekst(v.kontekst)
  const t = tekst(v.tekst)
  const tabeller = kilde ? kilder.get(kilde) : undefined
  if (!kilde || !tabeller || (kontekst !== null && !tabeller.has(kontekst))) return null
  if (!t || !erOrgansystemkode(v.organsystem) || !erFrekvenskode(v.frekvens)) return null
  return {
    kilde,
    kontekst,
    organsystem: v.organsystem,
    frekvens: v.frekvens,
    tekst: t,
    fotnote: tekst(v.fotnote),
    posisjon: typeof v.posisjon === 'number' && Number.isFinite(v.posisjon) ? v.posisjon : 0,
  }
}

/** Svaret fra `les_bivirkninger`, lest defensivt. */
export function lesBivirkningsdata(svar: unknown): Bivirkningsdata {
  if (!erObjekt(svar)) return INGEN_BIVIRKNINGER
  const kilder = (Array.isArray(svar.kilder) ? svar.kilder : []).map(lesKilde).filter((k): k is Bivirkningskilde => k !== null)
  const oppslag: Kildeoppslag = new Map(kilder.map((k) => [k.id, new Set(k.kontekster.map((t) => t.nokkel))]))
  const bivirkninger = (Array.isArray(svar.bivirkninger) ? svar.bivirkninger : [])
    .map((b) => lesBivirkning(b, oppslag))
    .filter((b): b is Bivirkning => b !== null)
  return { kilder, bivirkninger }
}

export interface Bivirkningsleser {
  /** Bivirkningene på fagsiden med nøkkelen. */
  les(stoff: string): Promise<Bivirkningsdata>
}

export function lagBivirkningsleser(klient: SupabaseClient): Bivirkningsleser {
  return {
    les: async (stoff) => {
      const { data, error } = await klient.rpc('les_bivirkninger', { stoff })
      if (error) throw new Error(error.message)
      return lesBivirkningsdata(data)
    },
  }
}
