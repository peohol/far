/**
 * «Tilbakestill passord» — administratoren gir en bruker et nytt midlertidig
 * passord.
 *
 * Det gamle passordet kan ikke hentes fram; veien videre er alltid et nytt.
 * Kontoen settes samtidig tilbake i førstegangsoppsett, slik at brukeren må
 * velge sitt eget passord ved neste innlogging.
 */
import { brukerIdFelt, endepunkt } from '../_edge/kontekst.ts'
import { hentProfil, settMidlertidigPassord } from '../_edge/kontooperasjoner.ts'

Deno.serve(
  endepunkt({ krevAdmin: true }, async ({ kropp, admin }) => {
    const brukerId = brukerIdFelt(kropp)
    const profil = await hentProfil(admin, brukerId)
    const midlertidigPassord = await settMidlertidigPassord(admin, brukerId)

    return { brukernavn: profil.username, midlertidigPassord }
  }),
)
