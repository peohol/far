/**
 * Supabase-klienten appen bruker.
 *
 * Den lages bare når begge innstillingene finnes, slik at et bygg uten dem
 * ikke faller sammen ved innlasting. Mangler de, sier appen fra på
 * innloggingssiden i stedet for å vise en tom skjerm.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const publiserbarNokkel = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const KONFIGURASJON_MANGLER =
  'Appen mangler oppkoblingen mot brukerdatabasen. Si fra til den som drifter OUSFAR.'

const klienten: SupabaseClient | null =
  url && publiserbarNokkel
    ? createClient(url, publiserbarNokkel, {
        auth: {
          // Økten skal overleve at fanen lukkes, og fornyes av seg selv
          // mens den står åpen. Ingenting i innloggingen går gjennom
          // adressefeltet, så URL-gjenkjenning er slått av.
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
        },
      })
    : null

/** Sant når appen er koblet opp og innlogging er mulig. */
export function erKonfigurert(): boolean {
  return klienten !== null
}

/** Klienten, eller en tydelig feil når oppkoblingen mangler. */
export function klient(): SupabaseClient {
  if (!klienten) throw new Error(KONFIGURASJON_MANGLER)
  return klienten
}
