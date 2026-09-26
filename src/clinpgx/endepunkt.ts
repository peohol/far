/**
 * Serverendepunktene for ClinPGx.
 *
 * - `/api/clinpgx-synk` synkroniserer. Vercel kaller det hver uke med
 *   `GET` og `Authorization: Bearer <CRON_SECRET>`. En administrator kan be om
 *   det samme med `POST` og sin egen innlogging, for alle kjemikaliene eller
 *   bare noen (`{ "kjemikalier": ["PA…"] }`).
 * - `/api/clinpgx-sok` slår opp et kjemikalie i ClinPGx på navnet eller
 *   ID-en, så en administrator kan velge hva en stoffside kobles til. Bare for
 *   administratorer.
 *
 * Den hemmelige Supabase-nøkkelen leses fra miljøet her på serveren og
 * forlater den aldri. En administrator kjennes igjen på innloggingen: tokenet
 * nettleseren sender, brukes mot databasen, som svarer på `er_admin()` for den
 * innloggede — et token som ikke er gyldig, avvises der.
 */
import { kallMot } from '../legemiddeldata/lager.js'
import { bearer, erAdmin, hvem, serverklient, svar, type Adminsjekk, type Miljo } from '../server/tilgang.js'
import { lagClinpgxApi, type ClinpgxApi } from './api.js'
import { lagClinpgxlager } from './lager.js'
import { lesKjemikaliesvar, type Kjemikalie } from './modell.js'
import { synkroniserClinpgx, type Synkresultat, type Synkvalg } from './synk.js'

export { erAdmin, type Adminsjekk, type Miljo }

type Synkroniser = (valg: Pick<Synkvalg, 'lager' | 'api' | 'utlostAv' | 'bare'>) => Promise<Synkresultat>

/** Flest kjemikalier en administrator kan be om å få hentet i ett kall. */
export const MAKS_MANUELLE = 20

/** Kjemikaliene en administrator ba om, eller `undefined` for alle. Ugyldige ID-er avvises. */
async function bestilte(foresporsel: Request): Promise<string[] | undefined | 'ugyldig'> {
  const tekst = await foresporsel.text()
  if (!tekst.trim()) return undefined
  try {
    const innhold = JSON.parse(tekst) as { kjemikalier?: unknown }
    if (innhold.kjemikalier === undefined) return undefined
    const liste = innhold.kjemikalier
    if (
      !Array.isArray(liste) ||
      liste.length === 0 ||
      liste.length > MAKS_MANUELLE ||
      !liste.every((id) => typeof id === 'string' && /^PA\d+$/.test(id))
    ) {
      return 'ugyldig'
    }
    return [...new Set(liste as string[])]
  } catch {
    return 'ugyldig'
  }
}

export async function behandleClinpgxSynk(
  foresporsel: Request,
  miljo: Miljo,
  { synkroniser = synkroniserClinpgx, adminsjekk = erAdmin, api }: { synkroniser?: Synkroniser; adminsjekk?: Adminsjekk; api?: ClinpgxApi } = {},
): Promise<Response> {
  if (foresporsel.method !== 'GET' && foresporsel.method !== 'POST') return svar(405, { feil: 'Bare GET og POST.' })
  const utlostAv = await hvem(foresporsel, miljo, adminsjekk)
  if (!utlostAv) return svar(401, { feil: 'Ikke tilgang.' })

  const bare = utlostAv === 'manuell' ? await bestilte(foresporsel) : undefined
  if (bare === 'ugyldig') {
    return svar(400, { feil: `Oppgi opptil ${MAKS_MANUELLE} ClinPGx-ID-er som «kjemikalier», f.eks. ["PA451333"].` })
  }

  const klient = serverklient(miljo)
  if (!klient) return svar(500, { feil: 'Mangler oppkoblingen mot databasen.' })

  const resultat = await synkroniser({
    lager: lagClinpgxlager(kallMot(klient)),
    api: api ?? lagClinpgxApi(),
    utlostAv,
    ...(bare && { bare }),
  })
  // En feilet kjøring er logget i databasen; statuskoden gjør den synlig i Vercel også.
  return svar(resultat.status === 'feilet' ? 502 : 200, resultat)
}

/** Et treff i oppslaget, til å koble en stoffside. */
export type Kjemikalietreff = Kjemikalie

/**
 * Kjemikaliet med ID-en eller navnet. ClinPGx søker bare på nøyaktig navn og
 * skiller store og små bokstaver; navnene er som regel med små, så søket
 * prøver også det.
 */
export async function slaOppKjemikalie(api: ClinpgxApi, sok: string): Promise<Kjemikalietreff[]> {
  const q = sok.trim()
  if (/^PA\d+$/i.test(q)) {
    const treff = lesKjemikaliesvar(await api.ett(`/data/chemical/${q.toUpperCase()}`, { view: 'max' }))
    return treff ? [treff] : []
  }
  for (const navn of [...new Set([q, q.toLowerCase()])]) {
    const treff = (await api.liste('/data/chemical', { name: navn, view: 'max' }))
      .map(lesKjemikaliesvar)
      .filter((k): k is Kjemikalie => k !== null)
    if (treff.length > 0) return treff
  }
  return []
}

export async function behandleClinpgxSok(
  foresporsel: Request,
  miljo: Miljo,
  { adminsjekk = erAdmin, api = lagClinpgxApi() }: { adminsjekk?: Adminsjekk; api?: ClinpgxApi } = {},
): Promise<Response> {
  const token = bearer(foresporsel)
  if (!token || !(await adminsjekk(token, miljo).catch(() => false))) return svar(401, { feil: 'Ikke tilgang.' })
  const sok = new URL(foresporsel.url).searchParams.get('q')?.trim() ?? ''
  if (sok.length < 2 || sok.length > 100) return svar(400, { feil: 'Søk på 2–100 tegn.' })
  try {
    return svar(200, { treff: await slaOppKjemikalie(api, sok) })
  } catch (e) {
    return svar(502, { feil: e instanceof Error ? e.message : String(e) })
  }
}
