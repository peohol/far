/**
 * Lager migrasjonene som legger inn én omgang med indikasjoner fra
 * datasettet i `supabase/import/indikasjoner/` (se
 * `INDIKASJONSIMPORTER` i `src/faginnhold/indikasjoner.ts`).
 *
 *   npx vite-node scripts/importer-indikasjoner.ts -- <brukernavn> <migrasjon> <mappe>
 *
 * Som `importer-stoffsider.ts`: `brukernavn` er administratoren revisjonene
 * føres på, og filene skrives som `<migrasjon>_NN.sql` i `mappe`.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { importmigrasjoner } from '../src/faginnhold/import'
import { INDIKASJONSIMPORTER, indikasjonsplan } from '../src/faginnhold/indikasjoner'

const [admin, migrasjon, mappe] = process.argv.slice(2).filter((a) => a !== '--')
const omgang = INDIKASJONSIMPORTER.find((i) => i.migrasjon === migrasjon)
if (!admin || !omgang || !mappe) {
  console.error(`Bruk: <brukernavn> <${INDIKASJONSIMPORTER.map((i) => i.migrasjon).join(' | ')}> <mappe>`)
  process.exit(1)
}

const plan = indikasjonsplan(omgang)
mkdirSync(mappe, { recursive: true })
// Uten linjeskift til slutt: apply_migration lagrer teksten uten, og filen skal være lik byte for byte.
const filer = importmigrasjoner(plan, admin, 55_000, 'utvid')
filer.forEach((sql, i) => writeFileSync(join(mappe, `${omgang.migrasjon}_${String(i + 1).padStart(2, '0')}.sql`), sql))
console.log(`${plan.koder.length} sider og ${plan.referanser.length} referanser → ${filer.length} migrasjoner i ${mappe}`)
