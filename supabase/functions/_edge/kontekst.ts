/**
 * Fellesdelen av de privilegerte Edge-funksjonene i OUSFAR.
 *
 * Hver funksjon her følger den samme rekkefølgen, og den ligger ett sted slik
 * at ingen av dem kan komme til å hoppe over et ledd:
 *
 *  1. autentiser den innloggede brukeren
 *  2. fastslå bruker-ID-en fra JWT-en
 *  3. slå opp adminstatus server-side, i profiltabellen
 *  4. valider det som er sendt inn
 *  5. først da: gjør jobben med en klient som har forhøyede rettigheter
 *
 * `withSupabase` fra @supabase/server gjør de to første leddene og svarer
 * selv på forespørsler uten gyldig JWT. Den håndterer også CORS, slik at
 * appen kan kalle funksjonene rett fra nettleseren.
 */
import { withSupabase, type SupabaseContext } from 'npm:@supabase/server@1'
import type { Profil } from '../_delt/profil.ts'

/**
 * En feil som skal bli et svar til den som kalte, med en melding vedkommende
 * kan lese. Alt annet som går galt, blir en generisk 500 uten detaljer.
 */
export class Avvist extends Error {
  readonly status: number

  constructor(melding: string, status = 400) {
    super(melding)
    this.status = status
  }
}

/** Det funksjonen får å jobbe med, når alle kontrollene er passert. */
export interface Endepunktinput {
  /** JSON-kroppen, slik den kom. Skal alltid valideres av funksjonen selv. */
  kropp: Record<string, unknown>
  /** Profilen til den innloggede brukeren, lest server-side. */
  innlogget: Profil
  /** Klienten som går utenom radsikkerheten. Brukes bare etter kontrollene. */
  admin: SupabaseContext['supabaseAdmin']
}

/**
 * Bygger et endepunkt.
 *
 * `krevAdmin` slår opp rollen i profiltabellen — aldri i `user_metadata`, som
 * brukeren selv kan skrive til.
 */
export function endepunkt(
  oppsett: { krevAdmin: boolean },
  handling: (input: Endepunktinput) => Promise<unknown>,
): (request: Request) => Promise<Response> {
  return withSupabase({ auth: 'user' }, async (request: Request, ctx: SupabaseContext) => {
    try {
      if (request.method !== 'POST') {
        throw new Avvist('Ukjent forespørsel.', 405)
      }

      const innlogget = await hentInnlogget(ctx)
      if (oppsett.krevAdmin && innlogget.role !== 'admin') {
        throw new Avvist('Handlingen krever at du er administrator.', 403)
      }

      const resultat = await handling({
        kropp: await lesKropp(request),
        innlogget,
        admin: ctx.supabaseAdmin,
      })
      return Response.json(resultat ?? { ok: true })
    } catch (feil) {
      if (feil instanceof Avvist) {
        return Response.json({ feil: feil.message }, { status: feil.status })
      }
      // Uventet: logg for vår egen feilsøking, men si ingenting utad. Det
      // som sendes inn kan inneholde passord, og hører ikke hjemme i loggen.
      console.error('Uventet feil i endepunktet:', feil instanceof Error ? feil.message : feil)
      return Response.json({ feil: 'Noe gikk galt. Prøv igjen.' }, { status: 500 })
    }
  })
}

/** Profilen til den som kaller, lest med forhøyede rettigheter. */
async function hentInnlogget(ctx: SupabaseContext): Promise<Profil> {
  const id = ctx.userClaims?.id ?? ctx.jwtClaims?.sub
  if (typeof id !== 'string' || id === '') {
    throw new Avvist('Du er ikke logget inn.', 401)
  }

  const { data, error } = await ctx.supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Avvist('Kontoen din finnes ikke lenger.', 403)
  return data as Profil
}

/** JSON-kroppen, eller et tomt objekt når det ikke fulgte noen med. */
async function lesKropp(request: Request): Promise<Record<string, unknown>> {
  const tekst = await request.text()
  if (tekst.trim() === '') return {}
  try {
    const lest: unknown = JSON.parse(tekst)
    if (lest === null || typeof lest !== 'object' || Array.isArray(lest)) {
      throw new Avvist('Forespørselen var ikke på forventet form.')
    }
    return lest as Record<string, unknown>
  } catch (feil) {
    if (feil instanceof Avvist) throw feil
    throw new Avvist('Forespørselen var ikke på forventet form.')
  }
}

/** Et tekstfelt fra kroppen, med en lesbar feil når det mangler. */
export function tekstfelt(kropp: Record<string, unknown>, navn: string): string {
  const verdi = kropp[navn]
  if (typeof verdi !== 'string') throw new Avvist(`Feltet «${navn}» mangler.`)
  return verdi
}

/** En bruker-ID fra kroppen, kontrollert mot formen en UUID har. */
export function brukerIdFelt(kropp: Record<string, unknown>, navn = 'brukerId'): string {
  const verdi = tekstfelt(kropp, navn)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(verdi)) {
    throw new Avvist('Ukjent bruker.')
  }
  return verdi
}
