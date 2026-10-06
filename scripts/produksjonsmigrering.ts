/**
 * Utrullingen av migrasjonene til produksjonsdatabasen, med Supabase-CLI-en.
 * GitHub Actions kjører stegene etter hver sammenslåing til `main` som endrer
 * migrasjonene (`.github/workflows/produksjonsmigrering.yml`); bakgrunnen står i
 * `docs/migrasjoner.md`.
 *
 *   npm run produksjonsmigrering -- forkontroll
 *   npm run produksjonsmigrering -- utrull
 *   npm run produksjonsmigrering -- etterkontroll
 *
 * - `forkontroll` finner migrasjonene produksjonen ikke har kjørt, stopper hvis
 *   historikken ikke stemmer med repoet, hvis produksjonen har en migrasjon uten
 *   fil, eller hvis en ventende migrasjon har destruktive setninger uten
 *   godkjenning eller ikke ville blitt kjørt i én transaksjon, og tørrkjører CLI-en: den skal planlegge nøyaktig de samme filene.
 * - `utrull` kjører de ventende migrasjonene (`supabase db push`).
 * - `etterkontroll` stopper hvis historikken ikke stemmer nøyaktig med repoet.
 *
 * Forutsetter at prosjektet er lenket (`supabase link`) og `SUPABASE_ACCESS_TOKEN`.
 * Med `SUPABASE_DB_URL` brukes den databasen i stedet, for å prøve stegene lokalt.
 */
import { spawnSync } from 'node:child_process'
import { appendFileSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  filnavn,
  historikkSql,
  KJENTE_AVVIK,
  type Migrasjonsfil,
  utrullingsfeil,
  ventendeMigrasjoner,
} from '../src/faginnhold/migrasjonshistorikk'
import { migrasjoner } from './migrasjonsmappe'

const CLI = fileURLToPath(new URL('../node_modules/.bin/supabase', import.meta.url))
const MAAL = process.env.SUPABASE_DB_URL ? ['--db-url', process.env.SUPABASE_DB_URL] : ['--linked']
/** Bare migrasjonene: ikke hemmeligheter fra config.toml, roller eller frødata. */
const PUSH = ['db', 'push', ...MAAL, '--include-all', '--skip-vault']

/** Skriver til sammendraget for kjøringen i GitHub Actions, når det finnes. */
function sammendrag(tekst: string) {
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${tekst}\n`)
}

function stopp(melding: string): never {
  console.error(`\n${melding}`)
  sammendrag(`### Stoppet\n\n\`\`\`\n${melding}\n\`\`\``)
  process.exit(1)
}

/** Kjører CLI-en og gir det den skrev; stopper hvis den feilet. Argumentene skrives aldri ut. */
function supabase(...args: string[]): { ut: string; logg: string } {
  const kjoring = spawnSync(CLI, [...args, '--agent', 'no'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  if (kjoring.error) stopp(`Fant ikke Supabase-CLI-en: ${kjoring.error.message}`)
  process.stderr.write(kjoring.stderr)
  if (kjoring.status !== 0) stopp(`supabase ${args.slice(0, 2).join(' ')} feilet (se meldingen over).\n${kjoring.stdout}`.trim())
  return { ut: kjoring.stdout, logg: `${kjoring.stdout}\n${kjoring.stderr}` }
}

/** Kjører SQL-en mot databasen; en SQL-feil stopper. Gir det `db query` skrev (JSON). */
function sql(sporring: string): string {
  const fil = join(mkdtempSync(join(tmpdir(), 'migrering-')), 'sporring.sql')
  writeFileSync(fil, sporring)
  return supabase('db', 'query', ...MAAL, '-o', 'json', '-f', fil).ut
}

function registrerteVersjoner(): string[] {
  const rader = JSON.parse(sql('select version from supabase_migrations.schema_migrations order by version')) as unknown
  if (!Array.isArray(rader)) stopp(`Uventet svar fra databasen: ${JSON.stringify(rader).slice(0, 200)}`)
  return rader.map((r: { version?: unknown }) => String(r.version))
}

/** Filene `supabase db push` ville kjørt, ut fra tørrkjøringen. */
function cliPlan(): string[] {
  const { logg } = supabase(...PUSH, '--dry-run')
  const linjer = logg.replace(/\x1b\[[0-9;]*m/g, '').split('\n')
  return linjer.flatMap((l) => /^\s*•\s+(\S+\.sql)\s*$/.exec(l)?.[1] ?? []).sort()
}

const liste = (filer: readonly Migrasjonsfil[]) => filer.map((f) => `- ${filnavn(f)}`).join('\n')

function forkontroll() {
  const filer = migrasjoner()
  const { ventende, utenFil } = ventendeMigrasjoner(filer, registrerteVersjoner())
  const feil = [
    ...utenFil.map((v) => `${v}: er registrert i produksjonen, men har ingen fil i repoet`),
    ...utrullingsfeil(ventende),
  ]
  if (feil.length) stopp(`Utrullingen er stoppet før noe er endret:\n${feil.map((f) => `- ${f}`).join('\n')}`)

  // Det som alt er kjørt, skal stemme med filene; det som ikke er kjørt, rulles ut nå.
  sql(historikkSql(filer, KJENTE_AVVIK, { ventende: true, stopp: true }))

  const plan = cliPlan()
  const forventet = ventende.map(filnavn).sort()
  if (plan.join('\n') !== forventet.join('\n')) {
    stopp(
      'Tørrkjøringen planlegger andre migrasjoner enn dem produksjonen mangler. Ingenting er endret.\n' +
        `Mangler i produksjonen:\n${forventet.join('\n') || '(ingen)'}\nCLI-en ville kjørt:\n${plan.join('\n') || '(ingen)'}`,
    )
  }

  const nyeste = filer.filter((f) => !ventende.includes(f)).at(-1)?.versjon ?? ''
  const eldre = ventende.filter((f) => f.versjon < nyeste)
  if (eldre.length) console.log(`Eldre enn den nyeste i produksjonen, kjøres likevel (--include-all):\n${liste(eldre)}`)

  const melding = ventende.length
    ? `${ventende.length} migrasjon(er) skal rulles ut:\n${liste(ventende)}`
    : 'Produksjonen har alle migrasjonene; ingenting å rulle ut.'
  console.log(`\nForkontrollen er bestått. ${melding}`)
  sammendrag(`### Forkontroll\n\n${melding}`)
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `ventende=${ventende.length}\n`)
}

function utrull() {
  supabase(...PUSH, '--yes')
}

function etterkontroll() {
  const filer = migrasjoner()
  sql(historikkSql(filer, KJENTE_AVVIK, { stopp: true }))
  const melding = `Historikken i produksjonen stemmer med alle ${filer.length} migrasjonsfilene.`
  console.log(`\n${melding}`)
  sammendrag(`### Etterkontroll\n\n${melding}`)
}

const steg = { forkontroll, utrull, etterkontroll }
const valgt = process.argv.slice(2).find((a) => a !== '--') as keyof typeof steg | undefined
if (!valgt || !(valgt in steg)) stopp(`Bruk: npm run produksjonsmigrering -- ${Object.keys(steg).join(' | ')}`)
steg[valgt]()
