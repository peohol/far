/**
 * Lager migrasjonen som kobler stoffsider til virkestoffene i FEST, for én av
 * importene i `FESTKOBLINGSIMPORTER` i `src/faginnhold/festkoblinger.ts`.
 *
 *   npx vite-node scripts/lag-festkoblinger.ts -- <brukernavn> <migrasjon> <fil>
 *
 * `brukernavn` er administratoren revisjonene føres på, og `migrasjon` navnet
 * på importen (f.eks. `amfetamin_fest_kobling`). Filen legges i
 * `supabase/migrations/` med tidspunktet som versjon, og rulles ut når PR-en
 * slås sammen (`docs/migrasjoner.md`).
 */
import { writeFileSync } from 'node:fs'
import { festkoblingSql, FESTKOBLINGSIMPORTER } from '../src/faginnhold/festkoblinger'

const [admin, migrasjon, fil] = process.argv.slice(2).filter((a) => a !== '--')
const valgt = FESTKOBLINGSIMPORTER.find((i) => i.migrasjon === migrasjon)
if (!admin || !valgt || !fil) {
  console.error(`Bruk: <brukernavn> <${FESTKOBLINGSIMPORTER.map((i) => i.migrasjon).join(' | ')}> <fil>`)
  process.exit(1)
}

// Uten linjeskift til slutt: apply_migration lagrer teksten uten, og filen skal være lik byte for byte.
writeFileSync(fil, festkoblingSql(valgt.koblinger, admin))
console.log(`${valgt.koblinger.length} koblinger → ${fil}`)
