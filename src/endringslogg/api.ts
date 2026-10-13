/**
 * Lesingen av endringsloggen for én side (`public.les_endringslogg`).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { lesbarFeil } from '../auth/databasefeil'
import { lesEndringslogg, type Endringslogg, type Endringsside, type Loggmarkor } from './modell'

/** Funksjonen finnes ikke: migrasjonen er ikke rullet ut mot databasen appen er koblet til. */
const MANGLER = 'PGRST202'

export interface Loggvalg {
  /** Administratorer: også det som ikke er publisert. */
  medUtkast?: boolean
  /** Også rutinene — ryddingen av papirkurven, tjenestene — som er skjult ellers. */
  medRutiner?: boolean
  /** Endringene etter denne, for å bla bakover. */
  etter?: Loggmarkor | null
  antall?: number
}

export interface Endringsloggleser {
  les(side: Endringsside, valg?: Loggvalg): Promise<Endringslogg>
}

export function lagEndringsloggleser(klient: SupabaseClient): Endringsloggleser {
  return {
    async les(side, { medUtkast = false, medRutiner = false, etter = null, antall = 30 } = {}) {
      const { data, error } = await klient.rpc('les_endringslogg', {
        side,
        med_utkast: medUtkast,
        med_rutiner: medRutiner,
        etter,
        antall,
      })
      if (error?.code === MANGLER) throw new Error('Endringsloggen er ikke satt opp i databasen ennå.')
      if (error) throw lesbarFeil(error)
      return lesEndringslogg(data)
    },
  }
}
