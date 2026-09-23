/**
 * Scenarioreglene slik fortolkningen henter dem: alle regelsettene i én
 * tilstand, med kommentarene de peker på, i ett kall
 * (`les_scenarioregler` i databasen).
 *
 * Databasen godtar bare gyldige regelsett, men appen kontrollerer dem likevel
 * før de tas i bruk: et regelsett som ikke består kontrollen her, brukes ikke,
 * og modulen sier fra i stedet for å gi en kommentar som kan være feil.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Kommentarinnhold, Kommentaroppslag } from '../domain/kommentarobjekt'
import type { Rusregler } from '../domain/rus'
import { validerScenarioregelsett, type Scenarioregelsett } from '../domain/scenario'
import { tilFeil } from './lagring'
import type { Utgave } from './lesing'
import type { Tilstand } from './modell'

/** Det databasen gir tilbake. */
export interface Scenarioregeldata {
  regelsett: Utgave<Scenarioregelsett>[]
  kommentarer: Utgave<Kommentarinnhold>[]
}

/** Reglene klare til bruk: regelsettene etter modul og kommentartekstene etter ID. */
export interface Scenarioregler {
  regelsett: ReadonlyMap<string, Utgave<Scenarioregelsett>>
  kommentarer: Kommentaroppslag
  /** Feilene i regelsettene som ikke kan brukes, etter modul. */
  ugyldige: ReadonlyMap<string, string[]>
}

export const INGEN_SCENARIOREGLER: Scenarioregeldata = { regelsett: [], kommentarer: [] }

export async function lesScenarioregler(
  klient: SupabaseClient,
  tilstand: Tilstand = 'publisert',
): Promise<Scenarioregeldata> {
  const { data, error } = await klient.rpc('les_scenarioregler', { regeltilstand: tilstand })
  if (error) throw tilFeil(error)
  return (data as Scenarioregeldata | null) ?? INGEN_SCENARIOREGLER
}

/** Regelsettene som består kontrollen, og feilene i dem som ikke gjør det. */
export function tilScenarioregler(data: Scenarioregeldata): Scenarioregler {
  const kommentarer: Kommentaroppslag = new Map(data.kommentarer.map((k) => [k.id, k.innhold.tekst]))
  const regelsett = new Map<string, Utgave<Scenarioregelsett>>()
  const ugyldige = new Map<string, string[]>()
  for (const utgave of data.regelsett) {
    const feil = validerScenarioregelsett(utgave.innhold, kommentarer)
    if (feil.length > 0) ugyldige.set(utgave.innhold.modul, feil)
    else regelsett.set(utgave.innhold.modul, utgave)
  }
  return { regelsett, kommentarer, ugyldige }
}

/** Hentingen av reglene, slik appen har den. */
export type Scenarioreglertilstand =
  | { status: 'laster' }
  | { status: 'feil'; melding: string }
  | { status: 'klar'; regler: Scenarioregler }

export const REGLENE_KUNNE_IKKE_HENTES = 'Fortolkningsreglene kunne ikke hentes.'

/**
 * Reglene for én modul, i den formen fortolkningen tar imot dem. En modul
 * uten gyldig regelsett gir en feil med forklaring; den fortolkes ikke.
 */
export function reglerForModul(
  tilstand: Scenarioreglertilstand,
  modul: { id: string; navn: string },
  provIgjen: () => void,
): Rusregler {
  if (tilstand.status === 'laster') return { status: 'laster' }
  if (tilstand.status === 'feil') return { status: 'feil', melding: tilstand.melding, provIgjen }
  const { regler } = tilstand
  const utgave = regler.regelsett.get(modul.id)
  if (utgave) return { status: 'klar', regelsett: utgave.innhold, kommentarer: regler.kommentarer }
  const melding = regler.ugyldige.has(modul.id)
    ? `Reglene for ${modul.navn} er ikke gyldige og brukes ikke. Si fra til den som redigerer fortolkningsreglene.`
    : `Det finnes ingen publiserte regler for ${modul.navn}. Si fra til den som redigerer fortolkningsreglene.`
  return { status: 'feil', melding, provIgjen }
}
