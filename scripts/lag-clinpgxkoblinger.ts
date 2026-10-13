/**
 * Lager migrasjonen som kobler stoffsider til kjemikaliene i ClinPGx, for én av
 * importene i `CLINPGXKOBLINGSIMPORTER` i `src/faginnhold/clinpgxkoblinger.ts`.
 *
 *   npx vite-node scripts/lag-clinpgxkoblinger.ts -- <brukernavn> <migrasjon> <fil> --agent <nøkkel> [--lenke <PR>]
 *
 * `brukernavn` er administratoren revisjonene føres på, og `migrasjon` navnet
 * på importen (f.eks. `stoffsider_clinpgx_kobling`). Filen legges i
 * `supabase/migrations/` med tidspunktet som versjon, og rulles ut når PR-en
 * slås sammen (`docs/migrasjoner.md`).
 */
import { writeFileSync } from 'node:fs'
import { clinpgxkoblingSql, CLINPGXKOBLINGSIMPORTER } from '../src/faginnhold/clinpgxkoblinger'
import { AGENTBRUK, erklartMigrasjon, lesAgentvalg } from './agentvalg'

const valg = lesAgentvalg(process.argv.slice(2))
const [admin, migrasjon, fil] = valg.resten
const valgt = CLINPGXKOBLINGSIMPORTER.find((i) => i.migrasjon === migrasjon)
if (!admin || !valgt || !fil) {
  console.error(`Bruk: <brukernavn> <${CLINPGXKOBLINGSIMPORTER.map((i) => i.migrasjon).join(' | ')}> <fil> ${AGENTBRUK}`)
  process.exit(1)
}

// Uten linjeskift til slutt: apply_migration lagrer teksten uten, og filen skal være lik byte for byte.
writeFileSync(fil, erklartMigrasjon(clinpgxkoblingSql(valgt.koblinger, admin, valgt.festkrav), fil, valg, `Fagsider koblet til ClinPGx (${valgt.koblinger.length})`))
console.log(`${valgt.koblinger.length} koblinger → ${fil}`)
