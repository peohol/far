/**
 * Lager SQL-en som legger regelsettene for de enkle konsentrasjonsreglene inn
 * i Supabase.
 *
 *   npm run import:intervallregelsett -- <brukernavn> [fil] [--migrering] [--del 2/6]
 *
 * `brukernavn` er administratoren revisjonene føres på — den som har bestilt
 * importen. SQL-en skrives til `fil`, eller til skjermen, og kjøres mot
 * prosjektet med databasens egne rettigheter. Et regelsett som alt finnes,
 * hoppes over. Med `--migrering` gjør SQL-en ingenting når administratoren
 * mangler, så den kan rulles ut som en datamigrering (`docs/migrasjoner.md`).
 * Med `--del i/n` lages bare del `i` når importen deles i `n` porsjoner.
 * Kommentarene blir kommentarobjekter med ID-ene i datasettet. Bakgrunnen
 * står i docs/fortolkningsregler.md.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { importdel, regelimportSql, tilRegelimport, type Regelkilde } from '../src/regler/import'

const argumenter = process.argv.slice(2).filter((a) => a !== '--')
const migrering = argumenter.includes('--migrering')
const delvalg = argumenter.indexOf('--del')
const [del, antall] = delvalg < 0 ? [1, 1] : (argumenter[delvalg + 1] ?? '').split('/').map(Number)
const [admin, fil] = argumenter.filter((a, i) => a !== '--migrering' && i !== delvalg && i !== delvalg + 1)
if (!admin) {
  console.error('Oppgi brukernavnet til administratoren importen føres på.')
  process.exit(1)
}

const alle = JSON.parse(
  readFileSync(new URL('../supabase/import/intervallregelsett.json', import.meta.url), 'utf8'),
) as Regelkilde[]
const importer = importdel(alle, del ?? 0, antall ?? 0).map(tilRegelimport)
const sql = regelimportSql(importer, admin, migrering ? 'hopp over' : 'stopp')
if (fil) {
  writeFileSync(fil, sql)
  console.log(`${importer.length} regelsett → ${fil}`)
} else {
  process.stdout.write(sql)
}
