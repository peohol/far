/**
 * Lager migrasjonen som slår metabolittsidene sammen med moderstoffets side
 * i databasen (se `src/faginnhold/sammenslatte.ts`).
 *
 *   npx vite-node scripts/lag-sammenslaing.ts -- <brukernavn> <fil> --agent <nøkkel> [--lenke <PR>]
 *
 * `brukernavn` er administratoren revisjonene føres på. Filen legges i
 * `supabase/migrations/` med tidspunktet som versjon, og rulles ut når PR-en
 * slås sammen (`docs/migrasjoner.md`).
 */
import { writeFileSync } from 'node:fs'
import { sammenslaingSql } from '../src/faginnhold/sammenslatte'
import { AGENTBRUK, erklartMigrasjon, lesAgentvalg } from './agentvalg'

const valg = lesAgentvalg(process.argv.slice(2))
const [admin, fil] = valg.resten
if (!admin || !fil) {
  console.error(`Bruk: <brukernavn> <fil> ${AGENTBRUK}`)
  process.exit(1)
}

// Uten linjeskift til slutt: apply_migration lagrer teksten uten, og filen skal være lik byte for byte.
writeFileSync(fil, erklartMigrasjon(sammenslaingSql(admin), fil, valg, 'Metabolittsider slått sammen med moderstoffet'))
console.log(`Sammenslåingen → ${fil}`)
