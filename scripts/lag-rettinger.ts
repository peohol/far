/**
 * Lager migrasjonen som retter rader i tabellene over serumkonsentrasjoner,
 * fra en rettingsfil i `supabase/import/rettinger/`.
 *
 *   npx vite-node scripts/lag-rettinger.ts -- <brukernavn> <rettingsfil> <utfil>
 *
 * `brukernavn` er administratoren revisjonene føres på — den som har bestilt
 * rettingen. Filen skrives klar til å rulles ut med `apply_migration`, og gis
 * versjonen prosjektet registrerer når den legges i `supabase/migrations/`.
 * Bakgrunnen står i `src/faginnhold/rettinger.ts`.
 *
 * Rettingsfilen kontrolleres før noe skrives; har den feil, skrives de i stedet.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { byggKatalog, FORTOLKNINGSOPPFORINGER } from '../src/domain/analyttkatalog'
import { kontrollerRettinger, rettingSql } from '../src/faginnhold/rettinger'

const [admin, rettingsfil, utfil] = process.argv.slice(2).filter((a) => a !== '--')
if (!admin || !rettingsfil || !utfil) {
  console.error('Bruk: <brukernavn> <rettingsfil> <utfil>')
  process.exit(1)
}

const fil = kontrollerRettinger(JSON.parse(readFileSync(rettingsfil, 'utf8')), byggKatalog(FORTOLKNINGSOPPFORINGER))
// Uten linjeskift til slutt: apply_migration lagrer teksten uten, og filen skal være lik byte for byte.
writeFileSync(utfil, rettingSql(fil, admin))
console.log(`${fil.rettinger.length} rettinger → ${utfil}`)
