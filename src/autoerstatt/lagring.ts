/**
 * Autoerstatt-reglene i databasen (`public.autoerstatt_regler`). Alle
 * innloggede leser dem; radsikkerheten lar bare administratorer endre.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Autoerstattregel } from './regler'

export interface Autoerstattlager {
  /** Reglene, de eldste først. */
  hent(): Promise<Autoerstattregel[]>
  opprett(finn: string, erstatt: string): Promise<void>
  endre(id: string, finn: string, erstatt: string): Promise<void>
  slett(id: string): Promise<void>
}

const TABELL = 'autoerstatt_regler'

/** Svar fra databasen, gjort om til en melding som kan vises. */
function tilFeil(feil: { code?: string }): Error {
  if (feil.code === '23505') return new Error('Det finnes alt en regel for denne teksten.')
  if (feil.code === '42501') return new Error(IKKE_TILGANG)
  if (feil.code === '23514') return new Error('Regelen ble ikke godtatt. Sjekk lengden og at den endrer noe.')
  return new Error('Noe gikk galt. Prøv igjen.')
}

const IKKE_TILGANG = 'Bare en administrator kan endre autoerstatt-reglene.'

/**
 * En endring som ikke traff noen rad: regelen er slettet i mellomtiden, eller
 * radsikkerheten slapp den ikke gjennom.
 */
function maaTreffe(rader: unknown[] | null): void {
  if (!rader?.length) throw new Error('Regelen ble ikke endret. Den kan være slettet i mellomtiden.')
}

export function lagAutoerstattlager(klient: SupabaseClient): Autoerstattlager {
  return {
    async hent() {
      const { data, error } = await klient.from(TABELL).select('id, finn, erstatt').order('opprettet_kl').order('finn')
      if (error) throw tilFeil(error)
      return (data ?? []).filter(
        (r): r is Autoerstattregel => typeof r.id === 'string' && typeof r.finn === 'string' && typeof r.erstatt === 'string',
      )
    },
    async opprett(finn, erstatt) {
      const { error } = await klient.from(TABELL).insert({ finn, erstatt })
      if (error) throw tilFeil(error)
    },
    async endre(id, finn, erstatt) {
      const { data, error } = await klient.from(TABELL).update({ finn, erstatt }).eq('id', id).select('id')
      if (error) throw tilFeil(error)
      maaTreffe(data)
    },
    async slett(id) {
      const { data, error } = await klient.from(TABELL).delete().eq('id', id).select('id')
      if (error) throw tilFeil(error)
      maaTreffe(data)
    },
  }
}
