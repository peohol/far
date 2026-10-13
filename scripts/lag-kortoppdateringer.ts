/**
 * Lager migrasjonen som oppdaterer kort på sidene etter en nyere kilde, fra en
 * oppdateringsfil i `supabase/import/oppdateringer/`.
 *
 *   npx vite-node scripts/lag-kortoppdateringer.ts -- <brukernavn> <oppdateringsfil> <utfil> --agent <nøkkel> [--lenke <PR>]
 *
 * `brukernavn` er administratoren revisjonene føres på — den som har bestilt
 * oppdateringen. Filen legges i `supabase/migrations/` med tidspunktet som
 * versjon, og rulles ut når PR-en slås sammen (`docs/migrasjoner.md`).
 * Bakgrunnen står i `src/faginnhold/kortoppdateringer.ts`.
 *
 * Oppdateringsfilen kontrolleres før noe skrives; har den feil, skrives de i stedet.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { byggKatalog, FORTOLKNINGSOPPFORINGER } from '../src/domain/analyttkatalog'
import { kontrollerOppdateringer, oppdateringSql } from '../src/faginnhold/kortoppdateringer'
import { AGENTBRUK, erklartMigrasjon, lesAgentvalg } from './agentvalg'

const valg = lesAgentvalg(process.argv.slice(2))
const [admin, oppdateringsfil, utfil] = valg.resten
if (!admin || !oppdateringsfil || !utfil) {
  console.error(`Bruk: <brukernavn> <oppdateringsfil> <utfil> ${AGENTBRUK}`)
  process.exit(1)
}

const fil = kontrollerOppdateringer(JSON.parse(readFileSync(oppdateringsfil, 'utf8')), byggKatalog(FORTOLKNINGSOPPFORINGER))
// Uten linjeskift til slutt: apply_migration lagrer teksten uten, og filen skal være lik byte for byte.
writeFileSync(utfil, erklartMigrasjon(oppdateringSql(fil, admin), utfil, valg, `Kort oppdatert etter nyere kilde (${fil.oppdateringer.length})`))
console.log(`${fil.oppdateringer.length} oppdateringer → ${utfil}`)
