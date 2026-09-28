/**
 * Lager migrasjonen som slår metabolittsidene sammen med moderstoffets side
 * i databasen (se `src/faginnhold/sammenslatte.ts`).
 *
 *   npx vite-node scripts/lag-sammenslaing.ts -- <brukernavn> <fil>
 *
 * `brukernavn` er administratoren revisjonene føres på. Filen rulles ut med
 * `apply_migration` og gis versjonen prosjektet registrerer når den legges i
 * `supabase/migrations/`.
 */
import { writeFileSync } from 'node:fs'
import { sammenslaingSql } from '../src/faginnhold/sammenslatte'

const [admin, fil] = process.argv.slice(2).filter((a) => a !== '--')
if (!admin || !fil) {
  console.error('Bruk: <brukernavn> <fil>')
  process.exit(1)
}

// Uten linjeskift til slutt: apply_migration lagrer teksten uten, og filen skal være lik byte for byte.
writeFileSync(fil, sammenslaingSql(admin))
console.log(`Sammenslåingen → ${fil}`)
