/**
 * Kontrollerer migrasjonsfilene, og skriver lesespørringen som sammenligner dem
 * med historikken produksjonen har registrert.
 *
 *   npm run kontroller:migrasjoner [-- <utfil>]
 *   npm run kontroller:migrasjoner -- --mot <gren> [--utrullet <commit>]
 *
 * Uten `--mot` kontrolleres filnavnene, og spørringen skrives (til utfila eller
 * skjermen). Den kjøres med Supabase-MCP-ens `execute_sql` eller i SQL-editoren;
 * ingen rader betyr at versjonene, navnene og innholdet stemmer.
 *
 * Med `--mot` kontrolleres i tillegg endringene sammenlignet med grenen PR-en
 * skal inn i, uten tilgang til produksjonen (`endringsfeil`): CI kjører den på
 * hver PR. `--utrullet` er commiten den siste vellykkede utrullingen gjaldt;
 * migrasjonene der er kjørt i produksjonen og kan ikke endres. Uten den gjelder
 * det alle på grenen. Bakgrunnen står i `docs/migrasjoner.md`.
 */
import { writeFileSync } from 'node:fs'
import { endringsfeil, historikkSql } from '../src/faginnhold/migrasjonshistorikk'
import { migrasjoner, migrasjonerI } from './migrasjonsmappe'

const args = process.argv.slice(2).filter((a) => a !== '--')
const filer = migrasjoner()

/** Verdien etter flagget, eller `undefined` når flagget mangler. */
function valg(flagg: string): string | undefined {
  const i = args.indexOf(flagg)
  if (i < 0) return undefined
  const verdi = args[i + 1]
  if (!verdi || verdi.startsWith('--')) {
    console.error(`${flagg} trenger en gren eller commit`)
    process.exit(1)
  }
  return verdi
}

const grunn = valg('--mot')
if (grunn) {
  const utrullet = valg('--utrullet')
  const feil = endringsfeil(migrasjonerI(grunn), filer, utrullet ? { utrullet: migrasjonerI(utrullet) } : {})
  if (feil.length) {
    console.error(`Migrasjonene kan ikke slås sammen slik de står:\n${feil.map((f) => `- ${f}`).join('\n')}`)
    process.exit(1)
  }
  console.log(`${filer.length} migrasjonsfiler er i orden mot ${grunn}${utrullet ? ` (sist utrullet: ${utrullet})` : ''}.`)
} else {
  const sql = historikkSql(filer)
  const [utfil] = args
  if (utfil) {
    writeFileSync(utfil, sql)
    console.error(`${filer.length} migrasjonsfiler → ${utfil}`)
  } else {
    console.log(sql)
  }
}
