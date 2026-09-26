/**
 * Serverendepunktet for CPIC: `/api/cpic-synk` synkroniserer. Vercel kaller
 * det hver uke med `GET` og `Authorization: Bearer <CRON_SECRET>`. En
 * administrator kan be om det samme med `POST` og sin egen innlogging.
 * Tilgangen og oppkoblingen står i `src/server/tilgang.ts`.
 */
import { kallMot } from '../legemiddeldata/lager.js'
import { erAdmin, hvem, serverklient, svar, type Adminsjekk, type Miljo } from '../server/tilgang.js'
import { lagCpicApi, type CpicApi } from './api.js'
import { lagCpiclager } from './lager.js'
import { synkroniserCpic, type Synkresultat, type Synkvalg } from './synk.js'

type Synkroniser = (valg: Pick<Synkvalg, 'lager' | 'api' | 'utlostAv'>) => Promise<Synkresultat>

export async function behandleCpicSynk(
  foresporsel: Request,
  miljo: Miljo,
  { synkroniser = synkroniserCpic, adminsjekk = erAdmin, api }: { synkroniser?: Synkroniser; adminsjekk?: Adminsjekk; api?: CpicApi } = {},
): Promise<Response> {
  if (foresporsel.method !== 'GET' && foresporsel.method !== 'POST') return svar(405, { feil: 'Bare GET og POST.' })
  const utlostAv = await hvem(foresporsel, miljo, adminsjekk)
  if (!utlostAv) return svar(401, { feil: 'Ikke tilgang.' })

  const klient = serverklient(miljo)
  if (!klient) return svar(500, { feil: 'Mangler oppkoblingen mot databasen.' })

  const resultat = await synkroniser({ lager: lagCpiclager(kallMot(klient)), api: api ?? lagCpicApi(), utlostAv })
  // En feilet kjøring er logget i databasen; statuskoden gjør den synlig i Vercel også.
  return svar(resultat.status === 'feilet' ? 502 : 200, resultat)
}
