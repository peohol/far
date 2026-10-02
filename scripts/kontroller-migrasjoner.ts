/**
 * Kontrollerer navnene på migrasjonsfilene, og skriver lesespørringen som
 * sammenligner dem med historikken produksjonen har registrert.
 *
 *   npm run kontroller:migrasjoner [-- <utfil>]
 *
 * Spørringen kjøres med Supabase-MCP-ens `execute_sql` eller i SQL-editoren.
 * Ingen rader betyr at versjonene, navnene og innholdet stemmer. Bakgrunnen står
 * i `src/faginnhold/migrasjonshistorikk.ts` og `docs/monografkuratering.md`.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { filnavnfeil, historikkSql, lesMigrasjonsfil } from '../src/faginnhold/migrasjonshistorikk'

const MAPPE = fileURLToPath(new URL('../supabase/migrations', import.meta.url))
const filnavn = readdirSync(MAPPE).filter((f) => f.endsWith('.sql')).sort()

const feil = filnavnfeil(filnavn)
if (feil.length) {
  console.error(feil.join('\n'))
  process.exit(1)
}

const sql = historikkSql(filnavn.map((f) => lesMigrasjonsfil(f, readFileSync(`${MAPPE}/${f}`, 'utf8'))))
const [utfil] = process.argv.slice(2).filter((a) => a !== '--')
if (utfil) {
  writeFileSync(utfil, sql)
  console.error(`${filnavn.length} migrasjonsfiler → ${utfil}`)
} else {
  console.log(sql)
}
