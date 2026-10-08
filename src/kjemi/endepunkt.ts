/**
 * Serverendepunktet `/api/pubchem-synk`, som synkroniserer de kjemiske
 * grunndataene fra PubChem (`docs/kjemi.md`). Vercel kaller det hver uke med
 * `GET` og `Authorization: Bearer <CRON_SECRET>`; en administrator kan be om
 * det samme med `POST` og sin egen innlogging («Hent nå» i «Datakilder»).
 */
import { kallMot } from '../legemiddeldata/lager.js'
import { erAdmin, hvem, serverklient, svar, type Adminsjekk, type Miljo } from '../server/tilgang.js'
import { lagKjemilager } from './lager.js'
import { lagPubchemApi, type PubchemApi } from './pubchem.js'
import { synkroniserKjemi, type Kjemisynkresultat, type Kjemisynkvalg } from './synk.js'

type Synkroniser = (valg: Pick<Kjemisynkvalg, 'lager' | 'api' | 'utlostAv'>) => Promise<Kjemisynkresultat>

export async function behandlePubchemSynk(
  foresporsel: Request,
  miljo: Miljo,
  { synkroniser = synkroniserKjemi, adminsjekk = erAdmin, api }: { synkroniser?: Synkroniser; adminsjekk?: Adminsjekk; api?: PubchemApi } = {},
): Promise<Response> {
  if (foresporsel.method !== 'GET' && foresporsel.method !== 'POST') return svar(405, { feil: 'Bare GET og POST.' })
  const utlostAv = await hvem(foresporsel, miljo, adminsjekk)
  if (!utlostAv) return svar(401, { feil: 'Ikke tilgang.' })

  const klient = serverklient(miljo)
  if (!klient) return svar(500, { feil: 'Mangler oppkoblingen mot databasen.' })

  const resultat = await synkroniser({ lager: lagKjemilager(kallMot(klient)), api: api ?? lagPubchemApi(), utlostAv })
  // En feilet kjøring er logget i databasen; statuskoden gjør den synlig i Vercel også.
  return svar(resultat.status === 'feilet' ? 502 : 200, resultat)
}
