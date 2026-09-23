/**
 * Lager SQL-en som legger psykofarmakasidene inn i Supabase.
 *
 *   npm run import:psykofarmaka -- <brukernavn> [fil]
 *
 * `brukernavn` er administratoren revisjonene føres på — den som har bestilt
 * importen. SQL-en skrives til `fil`, eller til skjermen. Den kjøres mot
 * prosjektet med databasens egne rettigheter (SQL-editoren i Supabase, eller
 * `execute_sql` gjennom MCP), én blokk om gangen eller alle samlet. Blokkene
 * er hver sin transaksjon, og en kode som alt har en side, hoppes over, så den
 * kan kjøres igjen etter et avbrudd.
 *
 * Datasettet kontrolleres før noe skrives; har det feil, skrives de i stedet.
 * Bakgrunnen står i docs/faginnhold.md.
 */
import { writeFileSync } from 'node:fs'
import { importSql } from '../src/faginnhold/import'
import { psykofarmakaplan } from '../src/faginnhold/psykofarmaka'

const [admin, fil] = process.argv.slice(2).filter((a) => a !== '--')
if (!admin) {
  console.error('Oppgi brukernavnet til administratoren importen føres på.')
  process.exit(1)
}

const plan = psykofarmakaplan()
const sql = importSql(plan, admin).join('\n\n') + '\n'
if (fil) {
  writeFileSync(fil, sql)
  const elementer = plan.koder.reduce((sum, k) => sum + k.elementer.length, 0)
  console.log(`${plan.koder.length} koder, ${elementer} innholdselementer og ${plan.referanser.length} referanser → ${fil}`)
} else {
  process.stdout.write(sql)
}
