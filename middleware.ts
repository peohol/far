/**
 * Innloggingsveggen, på Vercels kant.
 *
 * Den kliniske delen av appen utleveres bare til forespørsler som bærer en
 * gyldig OUSFAR-økt. Innloggingssiden og det den trenger for å logge inn står
 * åpent; alt annet er innenfor.
 *
 * Økten leses av informasjonskapselen Supabase setter, og kontrolleres her på
 * kanten mot prosjektets offentlige nøkler. Ingen hemmeligheter er involvert,
 * og det går ingen forespørsel ut per fil: nøklene hentes én gang og blir
 * stående i den varme instansen.
 *
 * Hva som regnes som innenfor veggen, står i `src/auth/vegg.ts`. Den samme
 * modulen navngir pakken under byggingen, så de to kan ikke komme i utakt.
 */
import { next } from '@vercel/functions'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import { beskyttetSti, oktKakenavn, tilgangstokenFra } from './src/auth/vegg'

export const config = {
  /**
   * Bare de bygde filene. Hva som faktisk er beskyttet av dem, avgjør
   * `beskyttetSti` — regelen skal stå ett sted, og det er i modulen som også
   * navngir pakken.
   */
  matcher: '/assets/:fil*',
}

const supabaseUrl = process.env.VITE_SUPABASE_URL

/**
 * Nøklene Supabase signerer øktene med. Hentes ved første behov og blir
 * stående. Supabase signerer asymmetrisk (ES256), så kanten trenger bare den
 * offentlige halvdelen.
 */
const noekler = supabaseUrl
  ? createRemoteJWKSet(new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`))
  : null

async function erGyldigOkt(token: string): Promise<boolean> {
  if (!noekler || !supabaseUrl) return false
  try {
    await jwtVerify(token, noekler, {
      issuer: `${supabaseUrl}/auth/v1`,
      audience: 'authenticated',
    })
    return true
  } catch {
    // Utløpt, endret på eller signert av noen andre.
    return false
  }
}

export default async function middleware(request: Request): Promise<Response> {
  const sti = new URL(request.url).pathname
  if (!beskyttetSti(sti)) return next()

  // Uten oppsett slipper ingenting gjennom. En feilkonfigurert vegg skal
  // stenge, ikke stå åpen.
  if (!supabaseUrl) {
    return svarStengt('Appen mangler oppkoblingen mot brukerdatabasen.')
  }

  const token = tilgangstokenFra(request.headers.get('cookie'), oktKakenavn(supabaseUrl))
  if (!token || !(await erGyldigOkt(token))) {
    return svarStengt('Logg inn i OUSFAR for å bruke appen.')
  }

  return next()
}

function svarStengt(melding: string): Response {
  return new Response(melding, {
    status: 401,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      // Et avslag skal aldri bli liggende i et mellomlager og møte den som
      // logger inn like etterpå.
      'cache-control': 'no-store',
    },
  })
}
