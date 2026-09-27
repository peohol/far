/**
 * Endepunktet som synkroniserer legemiddeldataene fra FEST:
 * `/api/legemiddeldata-synk`. Vercel kaller det hver natt med `GET` og
 * `Authorization: Bearer <CRON_SECRET>`. En administrator kan be om det samme
 * med `POST` og sin egen innlogging («Hent nå» i «Datakilder»). Tilgangen og
 * oppkoblingen står i `src/server/tilgang.ts`; den hemmelige Supabase-nøkkelen
 * forlater aldri serveren. Selve jobben står i `synk.ts`.
 */
import { erAdmin, hvem, serverklient, svar, type Adminsjekk, type Miljo } from '../server/tilgang.js'
import { kallMot, lagLegemiddellager } from './lager.js'
import { synkroniserFest, type Synkresultat, type Synkvalg } from './synk.js'

export type { Miljo }

type Synkroniser = (valg: Pick<Synkvalg, 'lager' | 'utlostAv'>) => Promise<Synkresultat>

export async function behandleSynk(
  foresporsel: Request,
  miljo: Miljo,
  { synkroniser = synkroniserFest, adminsjekk = erAdmin }: { synkroniser?: Synkroniser; adminsjekk?: Adminsjekk } = {},
): Promise<Response> {
  if (foresporsel.method !== 'GET' && foresporsel.method !== 'POST') return svar(405, { feil: 'Bare GET og POST.' })
  const utlostAv = await hvem(foresporsel, miljo, adminsjekk)
  if (!utlostAv) return svar(401, { feil: 'Ikke tilgang.' })

  const klient = serverklient(miljo)
  if (!klient) return svar(500, { feil: 'Mangler oppkoblingen mot databasen.' })

  const resultat = await synkroniser({ lager: lagLegemiddellager(kallMot(klient)), utlostAv })
  // En feilet kjøring er logget i databasen; statuskoden gjør den synlig i Vercel også.
  return svar(resultat.status === 'feilet' ? 502 : 200, resultat)
}
