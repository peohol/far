/**
 * Oppsettet i Supabase, kontrollert mot det appen mener.
 *
 * Reglene for brukersystemet står to steder som ikke kan importere hverandre:
 * i TypeScript-modulene appen og Edge-funksjonene deler, og i SQL-en og
 * oppsettsfila som Supabase-prosjektet bygges av. Kommer de i utakt, virker
 * alt helt til det ikke gjør det — og da er det en sikkerhetsregel som har
 * glippet. Testen her leser filene og sammenligner.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { BRUKERNAVN_MEST, BRUKERNAVN_MINST, INTERN_AUTH_DOMENE } from '@delt/brukernavn'
import { PASSORD_MINST } from '@delt/passord'
import { AVATAR_BOTTE } from '@delt/profil'

function les(sti: string): string {
  return readFileSync(fileURLToPath(new URL(`../../${sti}`, import.meta.url)), 'utf8')
}

/**
 * Migrasjonen med dette navnet. Filnavnene har et tidsstempel foran, som
 * følger prosjektet og ikke innholdet, så den slås opp på navnet i stedet.
 */
function lesMigrasjon(navn: string): string {
  const mappe = 'supabase/migrations'
  const katalog = fileURLToPath(new URL(`../../${mappe}`, import.meta.url))
  const fil = readdirSync(katalog).find((f) => f.endsWith(`_${navn}.sql`))
  if (!fil) throw new Error(`Fant ingen migrasjon som heter ${navn}`)
  return les(`${mappe}/${fil}`)
}

/** Koden uten kommentarer, når det er det koden gjør som skal kontrolleres. */
function utenKommentarer(kode: string): string {
  return kode.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

const profilmigrasjon = lesMigrasjon('profiler_og_roller')
const bildemigrasjon = lesMigrasjon('profilbilder')
const avatarstimigrasjon = lesMigrasjon('avatarsti_laast_til_eieren')
const oppsett = les('supabase/config.toml')
const kontekst = les('supabase/functions/_edge/kontekst.ts')
const endepunkter = {
  'opprett-bruker': les('supabase/functions/opprett-bruker/index.ts'),
  'sett-rolle': les('supabase/functions/sett-rolle/index.ts'),
  'nytt-passord': les('supabase/functions/nytt-passord/index.ts'),
  'fullfor-oppsett': les('supabase/functions/fullfor-oppsett/index.ts'),
}

describe('brukernavnreglene i databasen', () => {
  it('bruker det samme mønsteret som appen', () => {
    // Samme uttrykk som MONSTER i functions/_delt/brukernavn.ts.
    expect(profilmigrasjon).toContain("'^[a-z0-9]+([._-][a-z0-9]+)*$'")
  })

  it('bruker de samme lengdegrensene som appen', () => {
    expect(profilmigrasjon).toContain(`between ${BRUKERNAVN_MINST} and ${BRUKERNAVN_MEST}`)
  })

  it('håndhever formen på både profilen og reservasjonen', () => {
    expect(profilmigrasjon).toContain(
      'constraint profiles_username_form check (public.brukernavn_er_gyldig(username))',
    )
    expect(profilmigrasjon).toContain(
      'constraint kontoreservasjoner_username_form check (public.brukernavn_er_gyldig(username))',
    )
  })

  it('krever at brukernavnet er entydig', () => {
    expect(profilmigrasjon).toContain(
      'create unique index profiles_username_idx on public.profiles (username)',
    )
  })

  it('bruker det samme interne domenet som appen', () => {
    expect(profilmigrasjon).toContain(`select '${INTERN_AUTH_DOMENE}'::text`)
  })
})

describe('registrering er stengt i databasen', () => {
  it('avviser kontoer uten en reservasjon fra adminveien', () => {
    expect(profilmigrasjon).toContain('delete from public.kontoreservasjoner where username =')
    expect(profilmigrasjon).toMatch(
      /if not found then\s+raise exception 'OUSFAR er lukket\./,
    )
  })

  it('avviser adresser utenfor det interne domenet', () => {
    expect(profilmigrasjon).toContain('<> public.intern_auth_domene()')
  })

  it('lar ingen i nettleseren legge inn en reservasjon', () => {
    expect(profilmigrasjon).toContain(
      'revoke all on public.kontoreservasjoner from anon, authenticated',
    )
    // Ingen policy på tabellen betyr at radsikkerheten stenger den helt.
    expect(profilmigrasjon).not.toMatch(/create policy .* on public\.kontoreservasjoner/)
  })
})

describe('hva en innlogget bruker får gjøre med profiler', () => {
  it('lar alle innloggede lese hele brukerlista', () => {
    expect(profilmigrasjon).toContain('for select to authenticated\nusing (true)')
  })

  it('gir skriverett bare på egen rad', () => {
    expect(profilmigrasjon).toContain('using (id = (select auth.uid()))')
    expect(profilmigrasjon).toContain('with check (id = (select auth.uid()))')
  })

  it('gir skriverett bare på de ordinære feltene', () => {
    expect(profilmigrasjon).toContain('revoke all on public.profiles from anon, authenticated')
    expect(profilmigrasjon).toContain(
      'grant update (first_name, last_name, avatar_path) on public.profiles to authenticated',
    )
    // Ingen bredere update-rettighet noe sted.
    expect(profilmigrasjon).not.toMatch(/grant update on public\.profiles/)
    expect(profilmigrasjon).not.toMatch(/grant all on public\.profiles/)
  })

  it('sperrer de sikkerhetsrelevante feltene med en trigger i tillegg', () => {
    for (const felt of [
      'username',
      'role',
      'must_change_password',
      'onboarding_completed',
      'created_at',
    ]) {
      expect(profilmigrasjon, felt).toContain(`new.${felt} is distinct from old.${felt}`)
    }
    expect(profilmigrasjon).toContain("if current_user in ('authenticated', 'anon') then")
  })

  it('lar ingen opprette eller slette profiler fra nettleseren', () => {
    expect(profilmigrasjon).not.toMatch(/on public\.profiles for (insert|delete)/)
  })

  it('gir nye kontoer den minst privilegerte rollen', () => {
    expect(profilmigrasjon).toContain("role public.brukerrolle not null default 'user'")
    expect(profilmigrasjon).toContain('must_change_password boolean not null default true')
    expect(profilmigrasjon).toContain('onboarding_completed boolean not null default false')
  })
})

describe('lagringen av profilbilder', () => {
  it('bruker en privat bøtte med bare WebP', () => {
    expect(bildemigrasjon).toContain(`values ('${AVATAR_BOTTE}', '${AVATAR_BOTTE}', false,`)
    expect(bildemigrasjon).toContain("array['image/webp']")
    expect(oppsett).toContain(`[storage.buckets.${AVATAR_BOTTE}]`)
    expect(oppsett).toContain('public = false')
  })

  it('lar alle innloggede se bildene', () => {
    expect(bildemigrasjon).toContain('for select to authenticated\nusing (bucket_id = \'avatarer\')')
  })

  it('lar bare eieren skrive, og bare til sin ene faste fil', () => {
    // Den opprinnelige regelen målte bare mappa, og lot brukeren legge igjen
    // vilkårlig mange filer under den. Den er erstattet av en som måler hele
    // filnavnet.
    const skriveregler = avatarstimigrasjon.match(
      /name = \(select auth\.uid\(\)\)::text \|\| '\/avatar\.webp'/g,
    )
    // Én gang for insert, to for update (using og with check) og én for delete.
    expect(skriveregler?.length).toBe(4)
    expect(avatarstimigrasjon).not.toMatch(/storage\.foldername/)
  })

  it('lar ingen peke profilen sin på et annet bilde enn sitt eget', () => {
    // Uten dette kunne en bruker vist en kollegas ansikt som sitt eget, siden
    // `avatar_path` er et felt brukeren selv får skrive til.
    expect(avatarstimigrasjon).toContain(
      "check (avatar_path is null or avatar_path = id::text || '/avatar.webp')",
    )
  })
})

describe('Auth-oppsettet', () => {
  it('har registrering slått av', () => {
    expect(oppsett).toMatch(/^enable_signup = false$/m)
    expect(oppsett).toMatch(/^enable_anonymous_sign_ins = false$/m)
  })

  it('krever det samme passordet som appen', () => {
    expect(oppsett).toContain(`minimum_password_length = ${PASSORD_MINST}`)
  })

  it('har ingen e-postflyt', () => {
    expect(oppsett).toMatch(/^enable_confirmations = false$/m)
    expect(oppsett).toMatch(/^double_confirm_changes = false$/m)
    expect(oppsett).not.toMatch(/^\[auth\.email\.smtp\]/m)
  })

  it('krever gyldig innlogging på alle Edge-funksjonene', () => {
    const funksjoner = [...oppsett.matchAll(/^\[functions\.([a-z-]+)\]\nverify_jwt = (\w+)$/gm)]
    expect(funksjoner.length).toBe(4)
    for (const [, navn, verdi] of funksjoner) {
      expect(verdi, navn).toBe('true')
    }
  })
})

describe('Edge-funksjonene', () => {
  it('krever administrator på alle adminoperasjonene', () => {
    for (const navn of ['opprett-bruker', 'sett-rolle', 'nytt-passord'] as const) {
      expect(endepunkter[navn], navn).toContain('endepunkt({ krevAdmin: true }')
    }
  })

  it('lar brukeren fullføre sitt eget førstegangsoppsett', () => {
    expect(endepunkter['fullfor-oppsett']).toContain('endepunkt({ krevAdmin: false }')
  })

  it('slår opp rollen i profiltabellen, ikke i noe brukeren selv kan skrive', () => {
    expect(kontekst).toContain("innlogget.role !== 'admin'")
    expect(kontekst).toContain(".from('profiles')")
    // Rollen skal aldri leses av noe brukeren selv kan skrive til.
    expect(utenKommentarer(kontekst)).not.toMatch(/_metadata/)
  })

  it('henter bruker-ID-en fra JWT-en og ikke fra kroppen', () => {
    expect(kontekst).toContain('ctx.userClaims?.id ?? ctx.jwtClaims?.sub')
    expect(kontekst).toContain("throw new Avvist('Du er ikke logget inn.', 401)")
  })

  it('lar ingen endre sin egen rolle', () => {
    expect(endepunkter['sett-rolle']).toContain('brukerId === innlogget.id')
  })

  it('kontrollerer at profilbildet i oppsettet er brukerens eget', () => {
    expect(endepunkter['fullfor-oppsett']).toContain('avatarSti(innlogget.id)')
    expect(endepunkter['fullfor-oppsett']).toContain('kropp.avatarSti !== egetBilde')
  })

  it('åpner kontoen først når passordet faktisk er byttet', () => {
    const oppsettkode = endepunkter['fullfor-oppsett']
    expect(oppsettkode.indexOf('updateUserById')).toBeLessThan(
      oppsettkode.indexOf('must_change_password: false'),
    )
    expect(oppsettkode).toContain('onboarding_completed: true')
  })

  it('logger aldri det som sendes inn', () => {
    for (const [navn, kode] of Object.entries({ kontekst, ...endepunkter })) {
      const kjørende = utenKommentarer(kode)
      expect(kjørende, navn).not.toMatch(/console\.(log|info|warn)/)
      expect(kjørende, navn).not.toMatch(/console\.error\([^)]*(passord|kropp)/i)
    }
  })
})
