/**
 * Kjører kurateringskøen én gang (`docs/kurateringsko.md`). GitHub Actions
 * kaller skriptet i `.github/workflows/kurateringsko.yml`.
 *
 *   npm run kurateringsko -- kjor <gitmappe>
 *
 * `<gitmappe>` er en klone av repoet med tilgang til å skrive grener; køen og
 * øktgrenene leses og skrives der uten å sjekkes ut. Koden, migrasjonene og
 * journalene leses fra mappen skriptet kjøres i (main).
 *
 * Miljøet:
 * - `GITHUB_REPOSITORY`, `GH_TOKEN`: repoet og nøkkelen PR-ene og utrullingene slås opp med.
 * - `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `OUSFAR_TESTBRUKER`, `OUSFAR_TESTPASSORD`:
 *   testbrukeren stoffene og tallene leses som (`src/kuratorjobb/testbruker.ts`). Uten den
 *   leses de ikke, og køen bruker det den har.
 * - `OUSFAR_KO_ADRESSE`, `ACTIONS_ID_TOKEN_REQUEST_URL`, `ACTIONS_ID_TOKEN_REQUEST_TOKEN`:
 *   kurateringsgrenene i OUSFAR leses der med OIDC-tokenet for kjøringen. Uten dem
 *   står det køen vet om grenene.
 * - `MAAL`: `true` for å lese stoffene og tallene nå.
 * - `KJORING`: lenken til kjøringen i Actions, til svarene.
 * - `GITHUB_STEP_SUMMARY`: sammendraget skrives dit.
 */
import { appendFileSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { STOFFREGISTERDATA } from '../src/domain/stoffregister'
import { lagGit } from '../src/kurateringsko/git'
import { ghApi, lagGithub } from '../src/kurateringsko/github'
import { lagGrenleser } from '../src/kurateringsko/grener'
import type { Repofil } from '../src/kurateringsko/historikk'
import { kjorKo } from '../src/kurateringsko/kjoring'
import { malRegisteret } from '../src/kurateringsko/maling'
import { loggInnSomTestbruker } from '../src/kuratorjobb/testbruker'

const [kommando, gitmappe = ''] = process.argv.slice(2).filter((a) => a !== '--')
if (kommando !== 'kjor' || !gitmappe) {
  console.error('Bruk: npm run kurateringsko -- kjor <gitmappe>')
  process.exit(2)
}

const filer = (mappe: string, monster: RegExp): Repofil[] =>
  readdirSync(mappe)
    .filter((n) => monster.test(n))
    .sort()
    .map((navn) => ({ navn, innhold: readFileSync(join(mappe, navn), 'utf8') }))

const repo = process.env.GITHUB_REPOSITORY?.trim()
const innlogging = await loggInnSomTestbruker()
const klient = 'klient' in innlogging ? innlogging.klient : null
if ('feil' in innlogging) console.log(`Stoffene og tallene leses ikke denne gangen: ${innlogging.feil}`)

const resultat = await kjorKo({
  git: lagGit(gitmappe),
  github: repo ? lagGithub(ghApi(repo)) : null,
  maling: klient ? () => malRegisteret(klient, new Date().toISOString()) : null,
  grener: lagGrenleser(process.env),
  reserveregister: STOFFREGISTERDATA.stoffer.map((s) => ({ stoff: s.slug, navn: s.navn, aktiv: true, maal: null })),
  repo: {
    // Bare kurateringene trengs; de kjennes igjen på kallet i innholdet.
    migrasjoner: filer('supabase/migrations', /^\d{14}_.*monografkuratering.*\.sql$/),
    journaler: filer('docs/kurateringsjournal', /\.md$/),
  },
  kjoring: process.env.KJORING?.trim() || null,
  tvingMaling: process.env.MAAL === 'true',
})

const linjer = [
  '### Kurateringskø',
  '',
  resultat.skrevet ? 'Køen er oppdatert på grenen `kurateringsko/tilstand`.' : 'Ingenting nytt; køen er uendret.',
  ...(resultat.malt ? [`Stoffene og tallene er lest fra databasen: ${resultat.malt.stoffer} stoffer${resultat.malt.feilet ? `, ${resultat.malt.feilet} sider kunne ikke leses` : ''}.`] : []),
  ...(resultat.utlopt.length ? [`Reservasjoner som gikk ut: ${resultat.utlopt.join(', ')}.`] : []),
  ...resultat.behandlet.map((b) => `- ${b.gren}: ${b.handling ?? 'ugyldig forespørsel'} → ${b.utfall}. ${b.melding}`),
  ...(resultat.slettet.length ? [`Slettet gamle øktgrener: ${resultat.slettet.join(', ')}.`] : []),
  '',
]
console.log(linjer.join('\n'))
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${linjer.join('\n')}\n`)
