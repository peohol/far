/**
 * Lager migrasjonen som kobler stoffsider til virkestoffene i FEST, for én av
 * importene i `FESTKOBLINGSIMPORTER` i `src/faginnhold/festkoblinger.ts`.
 *
 *   npx vite-node scripts/lag-festkoblinger.ts -- <brukernavn> <migrasjon> <fil> --agent <nøkkel> [--lenke <PR>]
 *
 * `brukernavn` er administratoren revisjonene føres på, og `migrasjon` navnet
 * på importen (f.eks. `amfetamin_fest_kobling`). Filen legges i
 * `supabase/migrations/` med tidspunktet som versjon, og rulles ut når PR-en
 * slås sammen (`docs/migrasjoner.md`).
 */
import { writeFileSync } from 'node:fs'
import { festkoblingSql, FESTKOBLINGSIMPORTER } from '../src/faginnhold/festkoblinger'
import { AGENTBRUK, erklartMigrasjon, lesAgentvalg } from './agentvalg'

const valg = lesAgentvalg(process.argv.slice(2))
const [admin, migrasjon, fil] = valg.resten
const valgt = FESTKOBLINGSIMPORTER.find((i) => i.migrasjon === migrasjon)
if (!admin || !valgt || !fil) {
  console.error(`Bruk: <brukernavn> <${FESTKOBLINGSIMPORTER.map((i) => i.migrasjon).join(' | ')}> <fil> ${AGENTBRUK}`)
  process.exit(1)
}

// Uten linjeskift til slutt: apply_migration lagrer teksten uten, og filen skal være lik byte for byte.
writeFileSync(fil, erklartMigrasjon(festkoblingSql(valgt.koblinger, admin), fil, valg, `Fagsider koblet til legemiddeldataene (${valgt.koblinger.length})`))
console.log(`${valgt.koblinger.length} koblinger → ${fil}`)
