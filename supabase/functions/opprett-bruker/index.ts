/**
 * «Opprett bruker» — den eneste veien inn i OUSFAR.
 *
 * Administratoren oppgir bare et brukernavn. Kontoen får et generert
 * midlertidig passord som returneres én gang, og som brukeren må bytte ved
 * første innlogging. Det sendes ingen e-post; den interne Auth-adressen er en
 * teknisk nøkkel utledet av brukernavnet.
 */
import { brukernavnFeil, internAuthAdresse, normaliserBrukernavn } from '../_delt/brukernavn.ts'
import { genererMidlertidigPassord } from '../_delt/passord.ts'
import { Avvist, endepunkt, tekstfelt } from '../_edge/kontekst.ts'
import { frigiBrukernavn, reserverBrukernavn } from '../_edge/kontooperasjoner.ts'

Deno.serve(
  endepunkt({ krevAdmin: true }, async ({ kropp, admin }) => {
    const brukernavn = normaliserBrukernavn(tekstfelt(kropp, 'brukernavn'))
    const feil = brukernavnFeil(brukernavn)
    if (feil) throw new Avvist(feil)

    // Den unike indeksen i databasen er den endelige sperren; dette oppslaget
    // er her for å kunne si tydelig fra før kontoen forsøkes opprettet.
    const { data: finnes, error: oppslagsfeil } = await admin
      .from('profiles')
      .select('id')
      .eq('username', brukernavn)
      .maybeSingle()
    if (oppslagsfeil) throw oppslagsfeil
    if (finnes) throw new Avvist('Brukernavnet er allerede i bruk.', 409)

    const midlertidigPassord = genererMidlertidigPassord()

    // Klareringen triggeren i databasen krever. Den legges inn først, og
    // trekkes tilbake igjen dersom kontoen ikke blir noe av.
    await reserverBrukernavn(admin, brukernavn)

    const { data: opprettet, error: opprettelsesfeil } = await admin.auth.admin.createUser({
      email: internAuthAdresse(brukernavn),
      password: midlertidigPassord,
      // Ingen bekreftelse skal sendes eller ventes på — adressen er intern.
      email_confirm: true,
    })

    if (opprettelsesfeil) {
      await frigiBrukernavn(admin, brukernavn)
      const melding = opprettelsesfeil.message.toLowerCase()
      if (melding.includes('already') || melding.includes('registered')) {
        throw new Avvist('Brukernavnet er allerede i bruk.', 409)
      }
      throw opprettelsesfeil
    }

    const nyId = opprettet.user?.id
    if (!nyId) throw new Error('Auth opprettet ingen bruker')

    // Triggeren `paa_ny_auth_bruker` har laget profilen. Blir den likevel
    // borte, er kontoen ubrukelig — da ryddes den heller bort enn å bli
    // liggende igjen halvferdig.
    const { data: profil, error: profilfeil } = await admin
      .from('profiles')
      .select('username')
      .eq('id', nyId)
      .maybeSingle()

    if (profilfeil || !profil) {
      await admin.auth.admin.deleteUser(nyId)
      throw new Error('Profilen ble ikke opprettet sammen med kontoen')
    }

    return { brukernavn, midlertidigPassord }
  }),
)
