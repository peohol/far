/**
 * Innloggingen som testbrukeren, en vanlig bruker i OUSFAR, slik appen
 * logger inn (`docs/kuratorjobber.md`). Brukes av kuratorjobbene og
 * kurateringskøen i GitHub Actions. Passordet og feilmeldingen fra
 * innloggingen skrives aldri ut.
 *
 * Miljøet: `SUPABASE_URL` og `SUPABASE_PUBLISHABLE_KEY` (de offentlige
 * verdiene appen også har), og `OUSFAR_TESTBRUKER` og `OUSFAR_TESTPASSORD`
 * (hemmelige).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { internAuthAdresse } from '@delt/brukernavn'

/** Klienten som testbrukeren, eller grunnen til at det ikke går. */
export async function loggInnSomTestbruker(miljo: NodeJS.ProcessEnv = process.env): Promise<{ klient: SupabaseClient } | { feil: string }> {
  const verdi = (navn: string) => miljo[navn]?.trim() || null
  const url = verdi('SUPABASE_URL')
  const nokkel = verdi('SUPABASE_PUBLISHABLE_KEY')
  const brukernavn = verdi('OUSFAR_TESTBRUKER')
  const passord = miljo.OUSFAR_TESTPASSORD ?? ''
  if (!url || !nokkel) return { feil: 'SUPABASE_URL og SUPABASE_PUBLISHABLE_KEY mangler i miljøet.' }
  if (!brukernavn || !passord) {
    return { feil: 'Testbrukeren er ikke satt opp: hemmelighetene OUSFAR_TESTBRUKER og OUSFAR_TESTPASSORD mangler (docs/kuratorjobber.md).' }
  }
  const klient = createClient(url, nokkel, { auth: { persistSession: false, autoRefreshToken: false } })
  let adresse: string
  try {
    adresse = internAuthAdresse(brukernavn)
  } catch {
    return { feil: 'OUSFAR_TESTBRUKER er ikke et gyldig brukernavn.' }
  }
  const { error } = await klient.auth.signInWithPassword({ email: adresse, password: passord })
  // Feilmeldingen fra Auth tas ikke med; den kan si noe om kontoen.
  if (error) return { feil: `Testbrukeren kunne ikke logge inn (${error.status ?? 'ukjent status'}). Kontroller brukernavnet og passordet i hemmelighetene.` }
  return { klient }
}
