/**
 * Favorittene i databasen: fagsidene brukeren har merket med stjernen, etter
 * stoffets nøkkel (`public.stoffavoritter`). Radsikkerheten gjør at hver
 * bruker bare ser og endrer sine egne.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { tilFeil } from '../faginnhold/lagring'

export interface Favorittlager {
  /** Nøklene til brukerens favoritter, de eldste først. */
  hent(): Promise<string[]>
  /** Gjør stoffet til favoritt eller ikke. Tåler å bli gjentatt. */
  sett(stoff: string, favoritt: boolean): Promise<void>
}

export function lagFavorittlager(klient: SupabaseClient): Favorittlager {
  return {
    async hent() {
      const { data, error } = await klient.rpc('les_stoffavoritter', {})
      if (error) throw tilFeil(error)
      return Array.isArray(data) ? data.filter((s): s is string => typeof s === 'string') : []
    },
    async sett(stoff, favoritt) {
      const { error } = await klient.rpc('sett_stoffavoritt', { stoff, favoritt })
      if (error) throw tilFeil(error)
    },
  }
}
