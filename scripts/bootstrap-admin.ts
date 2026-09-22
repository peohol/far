/**
 * Oppretter den første administratoren i OUSFAR.
 *
 * Kjøres med `npm run bootstrap:admin` mot et prosjekt som har fått
 * migrasjonene. Skriptet er idempotent: finnes kontoen fra før, blir
 * passordet stående urørt, og skriptet sørger bare for at profilen har
 * adminrollen.
 *
 * Miljøvariabler:
 *   SUPABASE_URL            prosjektets URL (VITE_SUPABASE_URL godtas også)
 *   SUPABASE_SECRET_KEY     hemmelig nøkkel — aldri i klientkode eller i repoet
 *   BOOTSTRAP_ADMIN_USERNAME
 *   BOOTSTRAP_ADMIN_PASSWORD  midlertidig passord, bare ved førstegangsopprettelse
 *
 * Passordet skrives aldri ut og lagres ingen steder.
 */
import { createClient } from '@supabase/supabase-js'
import {
  brukernavnFeil,
  internAuthAdresse,
  normaliserBrukernavn,
} from '../supabase/functions/_delt/brukernavn.ts'

function kreves(...navn: string[]): string {
  for (const n of navn) {
    const verdi = process.env[n]
    if (verdi) return verdi
  }
  throw new Error(`Miljøvariabelen ${navn.join(' eller ')} mangler.`)
}

const url = kreves('SUPABASE_URL', 'VITE_SUPABASE_URL')
const hemmelig = kreves('SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY')
const brukernavn = normaliserBrukernavn(kreves('BOOTSTRAP_ADMIN_USERNAME'))
const passord = kreves('BOOTSTRAP_ADMIN_PASSWORD')

const feil = brukernavnFeil(brukernavn)
if (feil) throw new Error(`BOOTSTRAP_ADMIN_USERNAME: ${feil}`)

const admin = createClient(url, hemmelig, {
  auth: { autoRefreshToken: false, persistSession: false },
})

/** Setter adminrollen dersom den ikke alt er satt. */
async function sikreAdminrolle(id: string, rolle: string): Promise<void> {
  if (rolle === 'admin') return
  const { error } = await admin.from('profiles').update({ role: 'admin' }).eq('id', id)
  if (error) throw error
}

const { data: fra_for, error: oppslagsfeil } = await admin
  .from('profiles')
  .select('id, role')
  .eq('username', brukernavn)
  .maybeSingle()
if (oppslagsfeil) throw oppslagsfeil

if (fra_for) {
  await sikreAdminrolle(fra_for.id, fra_for.role)
  console.log(`«${brukernavn}» finnes fra før. Passordet er urørt; adminrollen er på plass.`)
} else {
  // Klareringen databasetriggeren krever. Den kan bare legges inn med
  // hemmelig nøkkel, og brukes opp i det kontoen opprettes.
  const { error: reservasjonsfeil } = await admin
    .from('kontoreservasjoner')
    .upsert({ username: brukernavn, reservert_kl: new Date().toISOString() })
  if (reservasjonsfeil) throw reservasjonsfeil

  const { data: opprettet, error: opprettelsesfeil } = await admin.auth.admin.createUser({
    email: internAuthAdresse(brukernavn),
    password: passord,
    email_confirm: true,
  })
  if (opprettelsesfeil) {
    await admin.from('kontoreservasjoner').delete().eq('username', brukernavn)
    throw opprettelsesfeil
  }

  const id = opprettet.user?.id
  if (!id) throw new Error('Auth opprettet ingen bruker')

  const { error: profilfeil } = await admin
    .from('profiles')
    .update({ role: 'admin', must_change_password: true, onboarding_completed: false })
    .eq('id', id)
  if (profilfeil) throw profilfeil

  console.log(
    `«${brukernavn}» er opprettet som administrator, med det midlertidige passordet fra BOOTSTRAP_ADMIN_PASSWORD. Det må byttes ved første innlogging.`,
  )
}
