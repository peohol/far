/**
 * «Gjør til administrator» og veien tilbake.
 *
 * Rollen kan bare settes herfra: nettleseren har ikke skriverett på kolonnen,
 * og ingen kan endre sin egen rolle — verken gi seg selv rettigheter eller ta
 * dem fra seg selv, som ellers kunne etterlatt systemet uten administrator
 * ved et uhell.
 */
import { erRolle } from '../_delt/profil.ts'
import { Avvist, brukerIdFelt, endepunkt, tekstfelt } from '../_edge/kontekst.ts'
import { hentProfil } from '../_edge/kontooperasjoner.ts'

Deno.serve(
  endepunkt({ krevAdmin: true }, async ({ kropp, innlogget, admin }) => {
    const brukerId = brukerIdFelt(kropp)
    const rolle = tekstfelt(kropp, 'rolle')
    if (!erRolle(rolle)) throw new Avvist('Ukjent rolle.')

    if (brukerId === innlogget.id) {
      throw new Avvist('Du kan ikke endre din egen rolle.', 403)
    }

    await hentProfil(admin, brukerId)

    const { data, error } = await admin
      .from('profiles')
      .update({ role: rolle })
      .eq('id', brukerId)
      .select('*')
      .single()

    if (error) throw error
    return { profil: data }
  }),
)
