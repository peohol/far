/**
 * Serverendepunktet `/api/farmakologiportalen-synk`, som synkroniserer
 * laboratorieanalysene fra Farmakologiportalen (`docs/farmakologiportalen.md`).
 * Jobben i GitHub Actions kaller det hver natt med `POST` og et OIDC-token for
 * arbeidsflyten; en administrator kan be om det samme med sin egen innlogging
 * («Hent nå» i «Datakilder»). Kallene til portalen går fra Vercel i Stockholm,
 * den eneste veien portalen svarer.
 */
import { kallMot } from '../legemiddeldata/lager.js'
import { erAdmin, hvem, serverklient, svar, type Adminsjekk, type Githubsjekk, type Miljo } from '../server/tilgang.js'
import { lagFpApi, type FpApi } from './api.js'
import { lagFplager } from './lager.js'
import { synkroniserFarmakologiportalen, type Fpsynkresultat, type Fpsynkvalg } from './synk.js'

/** Arbeidsflyten som kjører synkroniseringen hver natt. */
export const FP_ARBEIDSFLYT = '.github/workflows/farmakologiportalen-synk.yml'

type Synkroniser = (valg: Pick<Fpsynkvalg, 'lager' | 'api' | 'utlostAv'>) => Promise<Fpsynkresultat>

export async function behandleFpSynk(
  foresporsel: Request,
  miljo: Miljo,
  {
    synkroniser = synkroniserFarmakologiportalen,
    adminsjekk = erAdmin,
    githubsjekk,
    api,
  }: { synkroniser?: Synkroniser; adminsjekk?: Adminsjekk; githubsjekk?: Githubsjekk; api?: FpApi } = {},
): Promise<Response> {
  if (foresporsel.method !== 'GET' && foresporsel.method !== 'POST') return svar(405, { feil: 'Bare GET og POST.' })
  const utlostAv = await hvem(foresporsel, miljo, adminsjekk, { arbeidsflyt: FP_ARBEIDSFLYT, sjekk: githubsjekk })
  if (!utlostAv) return svar(401, { feil: 'Ikke tilgang.' })

  const klient = serverklient(miljo)
  if (!klient) return svar(500, { feil: 'Mangler oppkoblingen mot databasen.' })

  const resultat = await synkroniser({ lager: lagFplager(kallMot(klient)), api: api ?? lagFpApi(), utlostAv })
  // En feilet kjøring er logget i databasen; statuskoden gjør den synlig i Vercel og GitHub også.
  return svar(resultat.status === 'feilet' ? 502 : 200, resultat)
}
