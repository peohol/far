/**
 * Lager migrasjonen som gjør farmakodynamikktekstene om til mekanismekort,
 * fra datasettet i `supabase/import/farmakodynamikk/`.
 *
 *   npx vite-node scripts/lag-farmakodynamikkort.ts -- <brukernavn> <mappe>
 *
 * `brukernavn` er administratoren revisjonene føres på. Filene skrives som
 * `farmakodynamikk_mekanismekort_NN.sql` i `mappe`, klare til å rulles ut med
 * `apply_migration` i rekkefølge, og gis versjonen prosjektet registrerer når
 * de legges i `supabase/migrations/`. Bakgrunnen står i
 * `src/faginnhold/farmakodynamikk.ts`.
 *
 * Datasettet kontrolleres før noe skrives; har det feil, skrives de i stedet.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { farmakodynamikkmigrasjoner, farmakodynamikkplan } from '../src/faginnhold/farmakodynamikk'

const [admin, mappe] = process.argv.slice(2).filter((a) => a !== '--')
if (!admin || !mappe) {
  console.error('Bruk: <brukernavn> <mappe>')
  process.exit(1)
}

const plan = farmakodynamikkplan()
mkdirSync(mappe, { recursive: true })
// Uten linjeskift til slutt: apply_migration lagrer teksten uten, og filen skal være lik byte for byte.
const filer = farmakodynamikkmigrasjoner(plan, admin)
filer.forEach((sql, i) => writeFileSync(join(mappe, `farmakodynamikk_mekanismekort_${String(i + 1).padStart(2, '0')}.sql`), sql))
console.log(`${plan.length} stoffer, ${plan.reduce((sum, k) => sum + k.kort.length, 0)} mekanismekort → ${filer.length} migrasjoner i ${mappe}`)
