/**
 * Lager migrasjonen som kobler stoffsidene til virkestoffene i FEST, fra
 * `STOFFSIDE_FESTKOBLINGER` i `src/faginnhold/festkoblinger.ts`.
 *
 *   npx vite-node scripts/lag-festkoblinger.ts -- <brukernavn> <fil>
 *
 * `brukernavn` er administratoren revisjonene føres på. Filen rulles ut med
 * `apply_migration` og gis versjonen prosjektet registrerer når den legges i
 * `supabase/migrations/`.
 */
import { writeFileSync } from 'node:fs'
import { festkoblingSql, STOFFSIDE_FESTKOBLINGER } from '../src/faginnhold/festkoblinger'

const [admin, fil] = process.argv.slice(2).filter((a) => a !== '--')
if (!admin || !fil) {
  console.error('Bruk: <brukernavn> <fil>')
  process.exit(1)
}

// Uten linjeskift til slutt: apply_migration lagrer teksten uten, og filen skal være lik byte for byte.
writeFileSync(fil, festkoblingSql(STOFFSIDE_FESTKOBLINGER, admin))
console.log(`${STOFFSIDE_FESTKOBLINGER.length} koblinger → ${fil}`)
