/**
 * Endepunktet Vercel kaller hver natt for å synkronisere legemiddeldataene.
 *
 * Vercel sender `Authorization: Bearer <CRON_SECRET>`; alt annet avvises. Den
 * hemmelige Supabase-nøkkelen leses fra miljøet her på serveren og forlater
 * den aldri. Selve jobben står i `synk.ts`.
 */
import { createClient } from '@supabase/supabase-js'
import { kallMot, lagLegemiddellager } from './lager.js'
import { synkroniserFest, type Synkresultat, type Synkvalg } from './synk.js'

export type Miljo = Record<string, string | undefined>

type Synkroniser = (valg: Pick<Synkvalg, 'lager'>) => Promise<Synkresultat>

export async function behandleSynk(
  foresporsel: Request,
  miljo: Miljo,
  synkroniser: Synkroniser = synkroniserFest,
): Promise<Response> {
  const hemmelighet = miljo.CRON_SECRET
  if (!hemmelighet || foresporsel.headers.get('authorization') !== `Bearer ${hemmelighet}`) {
    return svar(401, { feil: 'Ikke tilgang.' })
  }

  const url = miljo.SUPABASE_URL ?? miljo.VITE_SUPABASE_URL
  const nokkel = miljo.SUPABASE_SECRET_KEY
  if (!url || !nokkel) return svar(500, { feil: 'Mangler oppkoblingen mot databasen.' })

  const klient = createClient(url, nokkel, { auth: { persistSession: false, autoRefreshToken: false } })
  const resultat = await synkroniser({ lager: lagLegemiddellager(kallMot(klient)) })
  // En feilet kjøring er logget i databasen; statuskoden gjør den synlig i Vercel også.
  return svar(resultat.status === 'feilet' ? 502 : 200, resultat)
}

function svar(status: number, innhold: unknown): Response {
  return new Response(JSON.stringify(innhold), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}
