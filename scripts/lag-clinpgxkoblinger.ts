/**
 * Lager migrasjonen som kobler stoffsider til kjemikaliene i ClinPGx, for én av
 * importene i `CLINPGXKOBLINGSIMPORTER` i `src/faginnhold/clinpgxkoblinger.ts`.
 *
 *   npx vite-node scripts/lag-clinpgxkoblinger.ts -- <brukernavn> <migrasjon> <fil>
 *
 * `brukernavn` er administratoren revisjonene føres på, og `migrasjon` navnet
 * på importen (f.eks. `stoffsider_clinpgx_kobling`). Filen rulles ut med
 * `apply_migration` og gis versjonen prosjektet registrerer når den legges i
 * `supabase/migrations/`.
 */
import { writeFileSync } from 'node:fs'
import { clinpgxkoblingSql, CLINPGXKOBLINGSIMPORTER } from '../src/faginnhold/clinpgxkoblinger'

const [admin, migrasjon, fil] = process.argv.slice(2).filter((a) => a !== '--')
const valgt = CLINPGXKOBLINGSIMPORTER.find((i) => i.migrasjon === migrasjon)
if (!admin || !valgt || !fil) {
  console.error(`Bruk: <brukernavn> <${CLINPGXKOBLINGSIMPORTER.map((i) => i.migrasjon).join(' | ')}> <fil>`)
  process.exit(1)
}

// Uten linjeskift til slutt: apply_migration lagrer teksten uten, og filen skal være lik byte for byte.
writeFileSync(fil, clinpgxkoblingSql(valgt.koblinger, admin, valgt.festkrav))
console.log(`${valgt.koblinger.length} koblinger → ${fil}`)
