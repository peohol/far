/**
 * Førstegangsoppsettet, fullført i ett kall.
 *
 * Brukeren har logget inn med et midlertidig passord og kommer ikke inn i
 * appen før dette er gjort. Passordbyttet og profilopplysningene settes
 * sammen, og kontoen åpnes først når begge sitter. En bruker kan derfor ikke
 * hoppe over passordbyttet ved å skrive rett til profiltabellen: kolonnene
 * `must_change_password` og `onboarding_completed` kan bare settes herfra.
 *
 * Passord logges aldri, verken det gamle eller det nye.
 */
import { passordFeil } from '../_delt/passord.ts'
import { avatarSti, navnFeil, normaliserNavn } from '../_delt/profil.ts'
import { Avvist, endepunkt, tekstfelt } from '../_edge/kontekst.ts'

Deno.serve(
  endepunkt({ krevAdmin: false }, async ({ kropp, innlogget, admin }) => {
    const passord = tekstfelt(kropp, 'passord')
    const fornavn = normaliserNavn(tekstfelt(kropp, 'fornavn'))
    const etternavn = normaliserNavn(tekstfelt(kropp, 'etternavn'))

    const feil =
      passordFeil(passord) ?? navnFeil(fornavn, 'Fornavn') ?? navnFeil(etternavn, 'Etternavn')
    if (feil) throw new Avvist(feil)

    // Bildet er valgfritt, men stien må være brukerens egen. Ellers kunne en
    // profil pekt på bildet til noen andre.
    const egetBilde = avatarSti(innlogget.id)
    const harBilde = kropp.avatarSti !== undefined && kropp.avatarSti !== null
    if (harBilde && kropp.avatarSti !== egetBilde) {
      throw new Avvist('Profilbildet hører ikke til denne kontoen.', 403)
    }

    // Passordet først: går det galt, står kontoen igjen som før, og brukeren
    // kan prøve på nytt. Motsatt rekkefølge ville sluppet noen inn i appen
    // med det midlertidige passordet fortsatt i behold.
    const { error: passordlagringsfeil } = await admin.auth.admin.updateUserById(innlogget.id, {
      password: passord,
    })
    if (passordlagringsfeil) {
      const melding = passordlagringsfeil.message.toLowerCase()
      if (melding.includes('password')) {
        throw new Avvist('Passordet ble ikke godtatt. Velg et annet.', 400)
      }
      throw passordlagringsfeil
    }

    const { data, error } = await admin
      .from('profiles')
      .update({
        first_name: fornavn,
        last_name: etternavn,
        ...(harBilde ? { avatar_path: egetBilde } : {}),
        must_change_password: false,
        onboarding_completed: true,
      })
      .eq('id', innlogget.id)
      .select('*')
      .single()

    if (error) throw error
    return { profil: data }
  }),
)
