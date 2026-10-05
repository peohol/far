/**
 * Lager SQL-en som legger psykofarmakasidene inn i Supabase.
 *
 *   npm run import:psykofarmaka -- <brukernavn> [fil]
 *   npm run import:psykofarmaka -- <brukernavn> --migrasjoner <mappe>
 *
 * `brukernavn` er administratoren revisjonene føres på — den som har bestilt
 * importen.
 *
 * Uten `--migrasjoner` skrives SQL-en til `fil`, eller til skjermen, for å
 * kjøres for hånd med databasens egne rettigheter (SQL-editoren i Supabase).
 * Blokkene er hver sin transaksjon, og en kode som alt har en side, hoppes
 * over, så den kan kjøres igjen etter et avbrudd.
 *
 * Med `--migrasjoner` skrives den som filer `psykofarmaka_import_NN.sql` i
 * `mappe`, som legges i `supabase/migrations/` med tidspunktet som versjon og
 * rulles ut når PR-en slås sammen (`docs/migrasjoner.md`; MCP-ens
 * `execute_sql` har bare leserettigheter). De gjør ingenting der administratoren
 * ikke finnes, som i testdatabasen.
 *
 * Datasettet kontrolleres før noe skrives; har det feil, skrives de i stedet.
 * Bakgrunnen står i docs/faginnhold.md.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { importmigrasjoner, importSql } from '../src/faginnhold/import'
import { psykofarmakaplan } from '../src/faginnhold/psykofarmaka'

const argumenter = process.argv.slice(2).filter((a) => a !== '--')
const migrasjonsmappe = argumenter.includes('--migrasjoner') ? argumenter[argumenter.indexOf('--migrasjoner') + 1] : undefined
const [admin, fil] = argumenter.filter((a, i) => a !== '--migrasjoner' && argumenter[i - 1] !== '--migrasjoner')
if (!admin || (argumenter.includes('--migrasjoner') && !migrasjonsmappe)) {
  console.error('Bruk: <brukernavn> [fil] eller <brukernavn> --migrasjoner <mappe>')
  process.exit(1)
}

const plan = psykofarmakaplan()
const elementer = plan.koder.reduce((sum, k) => sum + k.elementer.length, 0)
const omfang = `${plan.koder.length} koder, ${elementer} innholdselementer og ${plan.referanser.length} referanser`

if (migrasjonsmappe) {
  mkdirSync(migrasjonsmappe, { recursive: true })
  const filer = importmigrasjoner(plan, admin)
  filer.forEach((sql, i) => writeFileSync(join(migrasjonsmappe, `psykofarmaka_import_${String(i + 1).padStart(2, '0')}.sql`), sql))
  console.log(`${omfang} → ${filer.length} migrasjoner i ${migrasjonsmappe}`)
} else {
  const sql = importSql(plan, admin).join('\n\n') + '\n'
  if (fil) {
    writeFileSync(fil, sql)
    console.log(`${omfang} → ${fil}`)
  } else {
    process.stdout.write(sql)
  }
}
