/**
 * Lager migrasjonene som legger inn indikasjonene for stoffsidene uten
 * analyttkode, fra datasettet i `supabase/import/indikasjoner/`.
 *
 *   npx vite-node scripts/importer-indikasjoner.ts -- <brukernavn> <mappe>
 *
 * Som `importer-stoffsider.ts`: `brukernavn` er administratoren revisjonene
 * føres på, og filene skrives som `stoffsider_indikasjoner_NN.sql` i `mappe`.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { importmigrasjoner } from '../src/faginnhold/import'
import { indikasjonsplan } from '../src/faginnhold/indikasjoner'

const [admin, mappe] = process.argv.slice(2).filter((a) => a !== '--')
if (!admin || !mappe) {
  console.error('Bruk: <brukernavn> <mappe>')
  process.exit(1)
}

const plan = indikasjonsplan()
mkdirSync(mappe, { recursive: true })
// Uten linjeskift til slutt: apply_migration lagrer teksten uten, og filen skal være lik byte for byte.
const filer = importmigrasjoner(plan, admin, 55_000, 'utvid')
filer.forEach((sql, i) => writeFileSync(join(mappe, `stoffsider_indikasjoner_${String(i + 1).padStart(2, '0')}.sql`), sql))
console.log(`${plan.koder.length} stoffer og ${plan.referanser.length} referanser → ${filer.length} migrasjoner i ${mappe}`)
