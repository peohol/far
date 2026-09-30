/**
 * Lager migrasjonene som legger inn antihypertensivene, fra
 * datasettet i `supabase/import/antihypertensiver/`.
 *
 *   npx vite-node scripts/importer-antihypertensiver.ts -- <brukernavn> <mappe>
 *
 * `brukernavn` er administratoren revisjonene føres på — den som har bestilt
 * importen. Filene skrives som `antihypertensiver_import_NN.sql` i `mappe`, klare til
 * å rulles ut med `apply_migration`, og gis versjonen prosjektet registrerer
 * når de legges i `supabase/migrations/`. De gjør ingenting der
 * administratoren ikke finnes, som i testdatabasen (se `src/faginnhold/antihypertensiver.ts`).
 *
 * Datasettet kontrolleres før noe skrives; har det feil, skrives de i stedet.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { importmigrasjoner } from '../src/faginnhold/import'
import { antihypertensivplan } from '../src/faginnhold/antihypertensiver'

const [admin, mappe] = process.argv.slice(2).filter((a) => a !== '--')
if (!admin || !mappe) {
  console.error('Bruk: <brukernavn> <mappe>')
  process.exit(1)
}

const plan = antihypertensivplan()
const elementer = plan.koder.reduce((sum, k) => sum + k.elementer.length, 0)
mkdirSync(mappe, { recursive: true })
// Uten linjeskift til slutt: apply_migration lagrer teksten uten, og filen skal være lik byte for byte.
const filer = importmigrasjoner(plan, admin, 55_000, 'utvid')
filer.forEach((sql, i) => writeFileSync(join(mappe, `antihypertensiver_import_${String(i + 1).padStart(2, '0')}.sql`), sql))
console.log(`${plan.koder.length} stoffer, ${elementer} innholdselementer og ${plan.referanser.length} referanser → ${filer.length} migrasjoner i ${mappe}`)
