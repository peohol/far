/**
 * Lager migrasjonen som legger referanseområdene og TDM-kortene inn på
 * stoffsidene, fra datasettet i `supabase/import/tdm/`.
 *
 *   npx vite-node scripts/importer-tdm.ts -- <brukernavn> <mappe>
 *
 * `brukernavn` er administratoren revisjonene føres på — den som har bestilt
 * importen. Filene skrives som `tdm_referanseomrader_NN.sql` i `mappe`, og
 * legges i `supabase/migrations/` med tidspunktet som versjon; de rulles ut når
 * PR-en slås sammen (`docs/migrasjoner.md`). De gjør ingenting der
 * administratoren ikke finnes, som i testdatabasen, og utvider sidene som
 * finnes uten å endre det som står der (se `src/faginnhold/tdm.ts`).
 *
 * Datasettet kontrolleres før noe skrives; har det feil, skrives de i stedet.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { importmigrasjoner } from '../src/faginnhold/import'
import { tdmplan } from '../src/faginnhold/tdm'

const [admin, mappe] = process.argv.slice(2).filter((a) => a !== '--')
if (!admin || !mappe) {
  console.error('Bruk: <brukernavn> <mappe>')
  process.exit(1)
}

const plan = tdmplan()
const elementer = plan.koder.reduce((sum, k) => sum + k.elementer.length, 0)
mkdirSync(mappe, { recursive: true })
// Uten linjeskift til slutt: apply_migration lagrer teksten uten, og filen skal være lik byte for byte.
const filer = importmigrasjoner(plan, admin, 55_000, 'utvid')
filer.forEach((sql, i) => writeFileSync(join(mappe, `tdm_referanseomrader_${String(i + 1).padStart(2, '0')}.sql`), sql))
console.log(`${plan.koder.length} koder, ${elementer} innholdselementer og ${plan.referanser.length} referanser → ${filer.length} migrasjoner i ${mappe}`)
