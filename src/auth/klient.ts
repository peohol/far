/**
 * Supabase-klienten appen bruker.
 *
 * Økten lagres i en informasjonskapsel og ikke i nettleserens lokale lager.
 * Det er det som gjør innloggingsveggen mulig: en kapsel følger med
 * forespørselen etter den kliniske delen av pakken, slik at kanten kan
 * kontrollere økten før noe utleveres. Se `src/auth/vegg.ts`.
 *
 * Klienten lages bare når begge innstillingene finnes, slik at et bygg uten
 * dem ikke faller sammen ved innlasting. Mangler de, sier appen fra på
 * innloggingssiden i stedet for å vise en tom skjerm.
 */
import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { sporetFetch } from './aktivitet'

const url = import.meta.env.VITE_SUPABASE_URL
const publiserbarNokkel = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const KONFIGURASJON_MANGLER =
  'Appen mangler oppkoblingen mot brukerdatabasen. Si fra til den som drifter OUSFAR.'

const klienten: SupabaseClient | null =
  url && publiserbarNokkel
    ? createBrowserClient(url, publiserbarNokkel, {
        cookieOptions: {
          // Kapselen må følge med på forespørselen etter de bygde filene, og
          // ikke bare på sidevisninger.
          path: '/',
          sameSite: 'lax',
          secure: window.location.protocol === 'https:',
        },
        // Lasteindikatoren viser når appen henter noe (`aktivitet.ts`).
        global: { fetch: sporetFetch },
        auth: {
          // Ingenting i innloggingen går gjennom adressefeltet, så
          // URL-gjenkjenning er slått av.
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
