/**
 * Migrasjonsfilene i `supabase/migrations/`, slik skriptene som kontrollerer og
 * ruller dem ut, leser dem: fra arbeidskopien, eller slik de står på en annen
 * gren eller commit i git.
 */
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { filnavnfeil, lesMigrasjonsfil, type Migrasjonsfil } from '../src/faginnhold/migrasjonshistorikk'

const RELATIV = 'supabase/migrations'
const MAPPE = fileURLToPath(new URL(`../${RELATIV}`, import.meta.url))

/** Avslutter med feilene hvis noen filnavn er ugyldige, og gir ellers filene. */
function lesAlle(filnavn: readonly string[], innhold: (fil: string) => string, hvor: string): Migrasjonsfil[] {
  const feil = filnavnfeil(filnavn)
  if (feil.length) {
    console.error(`Ugyldige migrasjonsfiler ${hvor}:\n${feil.join('\n')}`)
    process.exit(1)
  }
  return filnavn.map((f) => lesMigrasjonsfil(f, innhold(f)))
}

/** Migrasjonsfilene i arbeidskopien, sortert slik de kjøres. */
export function migrasjoner(): Migrasjonsfil[] {
  const filnavn = readdirSync(MAPPE).filter((f) => f.endsWith('.sql')).sort()
  return lesAlle(filnavn, (f) => readFileSync(`${MAPPE}/${f}`, 'utf8'), 'i arbeidskopien')
}

/** Migrasjonsfilene slik de står i `ref` (en gren eller commit git har hentet). */
export function migrasjonerI(ref: string): Migrasjonsfil[] {
  const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
  const filnavn = git('ls-tree', '--name-only', `${ref}:${RELATIV}`)
    .split('\n')
    .filter((f) => f.endsWith('.sql'))
    .sort()
  return lesAlle(filnavn, (f) => git('show', `${ref}:${RELATIV}/${f}`), `i ${ref}`)
}
