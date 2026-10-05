/**
 * Lager migrasjonene som legger inn stoffsidene uten analyttkode, fra
 * datasettet i `supabase/import/stoffsider/`.
 *
 *   npx vite-node scripts/importer-stoffsider.ts -- <brukernavn> <mappe>
 *
 * `brukernavn` er administratoren revisjonene føres på — den som har bestilt
 * importen. Filene skrives som `stoffsider_import_NN.sql` i `mappe`, og legges
 * i `supabase/migrations/` med tidspunktet som versjon; de rulles ut når PR-en
 * slås sammen (`docs/migrasjoner.md`). De gjør ingenting der
 * administratoren ikke finnes, som i testdatabasen (se `src/faginnhold/stoffsider.ts`).
 *
 * Datasettet kontrolleres før noe skrives; har det feil, skrives de i stedet.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { importmigrasjoner } from '../src/faginnhold/import'
import { stoffsideplan } from '../src/faginnhold/stoffsider'

const [admin, mappe] = process.argv.slice(2).filter((a) => a !== '--')
if (!admin || !mappe) {
  console.error('Bruk: <brukernavn> <mappe>')
  process.exit(1)
}

const plan = stoffsideplan()
const elementer = plan.koder.reduce((sum, k) => sum + k.elementer.length, 0)
mkdirSync(mappe, { recursive: true })
// Uten linjeskift til slutt: apply_migration lagrer teksten uten, og filen skal være lik byte for byte.
const filer = importmigrasjoner(plan, admin, 55_000, 'utvid')
filer.forEach((sql, i) => writeFileSync(join(mappe, `stoffsider_import_${String(i + 1).padStart(2, '0')}.sql`), sql))
console.log(`${plan.koder.length} stoffer, ${elementer} innholdselementer og ${plan.referanser.length} referanser → ${filer.length} migrasjoner i ${mappe}`)
