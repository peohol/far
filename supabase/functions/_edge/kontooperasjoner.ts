/**
 * Kontooperasjonene som trenger forhøyede rettigheter, samlet ett sted fordi
 * flere endepunkter bruker de samme stegene.
 */
import type { SupabaseContext } from 'npm:@supabase/server@1'
import { genererMidlertidigPassord } from '../_delt/passord.ts'
import type { Profil } from '../_delt/profil.ts'
import { Avvist } from './kontekst.ts'

type Adminklient = SupabaseContext['supabaseAdmin']

/**
 * Klarerer ett brukernavn for kontoopprettelse.
 *
 * Databasetriggeren på `auth.users` krever en slik reservasjon og bruker den
 * opp. Den kan bare legges inn med hemmelig nøkkel, og er dermed beviset på
 * at kontoen kommer fra adminveien og ikke fra en selvregistrering.
 */
export async function reserverBrukernavn(
  admin: Adminklient,
  brukernavn: string,
): Promise<void> {
  const { error } = await admin
    .from('kontoreservasjoner')
    .upsert({ username: brukernavn, reservert_kl: new Date().toISOString() })
  if (error) throw error
}

/** Tar reservasjonen tilbake når kontoen likevel ikke ble opprettet. */
export async function frigiBrukernavn(admin: Adminklient, brukernavn: string): Promise<void> {
  await admin.from('kontoreservasjoner').delete().eq('username', brukernavn)
}

/** Profilen til en bruker, eller en lesbar feil når ingen finnes. */
export async function hentProfil(admin: Adminklient, brukerId: string): Promise<Profil> {
  const { data, error } = await admin
    .from('profiles')
    .select('*')
    .eq('id', brukerId)
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Avvist('Ukjent bruker.', 404)
  return data as Profil
}

/**
 * Gir brukeren et nytt midlertidig passord og setter kontoen tilbake i
 * førstegangsoppsett.
 *
 * Passordet returneres én gang, til den administratoren som ba om det. Det
 * lagres ingen steder og kan ikke hentes fram igjen — mistes det, må det
 * lages et nytt.
 */
export async function settMidlertidigPassord(
  admin: Adminklient,
  brukerId: string,
): Promise<string> {
  const midlertidig = genererMidlertidigPassord()

  const { error: passordfeil } = await admin.auth.admin.updateUserById(brukerId, {
    password: midlertidig,
  })
  if (passordfeil) throw passordfeil

  const { error: profilfeil } = await admin
    .from('profiles')
    .update({ must_change_password: true })
    .eq('id', brukerId)
  if (profilfeil) throw profilfeil

  return midlertidig
}
