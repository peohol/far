/**
 * Lager migrasjonen som oppdaterer kort på sidene etter en nyere kilde, fra en
 * oppdateringsfil i `supabase/import/oppdateringer/`.
 *
 *   npx vite-node scripts/lag-kortoppdateringer.ts -- <brukernavn> <oppdateringsfil> <utfil>
 *
 * `brukernavn` er administratoren revisjonene føres på — den som har bestilt
 * oppdateringen. Filen skrives klar til å rulles ut med `apply_migration`, og
 * gis versjonen prosjektet registrerer når den legges i `supabase/migrations/`.
 * Bakgrunnen står i `src/faginnhold/kortoppdateringer.ts`.
 *
 * Oppdateringsfilen kontrolleres før noe skrives; har den feil, skrives de i stedet.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { byggKatalog, FORTOLKNINGSOPPFORINGER } from '../src/domain/analyttkatalog'
import { kontrollerOppdateringer, oppdateringSql } from '../src/faginnhold/kortoppdateringer'

const [admin, oppdateringsfil, utfil] = process.argv.slice(2).filter((a) => a !== '--')
if (!admin || !oppdateringsfil || !utfil) {
  console.error('Bruk: <brukernavn> <oppdateringsfil> <utfil>')
  process.exit(1)
}

const fil = kontrollerOppdateringer(JSON.parse(readFileSync(oppdateringsfil, 'utf8')), byggKatalog(FORTOLKNINGSOPPFORINGER))
// Uten linjeskift til slutt: apply_migration lagrer teksten uten, og filen skal være lik byte for byte.
writeFileSync(utfil, oppdateringSql(fil, admin))
console.log(`${fil.oppdateringer.length} oppdateringer → ${utfil}`)
