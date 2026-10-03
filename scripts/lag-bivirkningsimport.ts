/**
 * Kontrollerer en importfil med bivirkninger fra en preparatomtale, og lager
 * migrasjonen som legger den inn (se `docs/bivirkninger.md`).
 *
 *   npm run import:bivirkninger -- <importfil.json> [<migrasjonsfil.sql>]
 *   npm run import:bivirkninger -- --trekk-tilbake <stoff> <kildenøkkel> "<begrunnelse>" <migrasjonsfil.sql>
 *
 * Uten migrasjonsfil kontrolleres bare importfila. Har den feil, skrives alle
 * ut med stedet i fila, og ingen migrasjon lages. Migrasjonen rulles ut med
 * `apply_migration` og gis versjonen prosjektet registrerer når den legges i
 * `supabase/migrations/`.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { antallIImport, importmigrasjon, kontrollerImport, tilbaketrekkingsmigrasjon } from '../src/bivirkninger/import'

const argumenter = process.argv.slice(2).filter((a) => a !== '--')

function avslutt(melding: string): never {
  console.error(melding)
  process.exit(1)
}

// Uten linjeskift til slutt: apply_migration lagrer teksten uten, og fila skal være lik byte for byte.
if (argumenter[0] === '--trekk-tilbake') {
  const [, stoff, nokkel, begrunnelse, fil] = argumenter
  if (!stoff || !nokkel || !begrunnelse?.trim() || !fil) {
    avslutt('Bruk: --trekk-tilbake <stoff> <kildenøkkel> "<begrunnelse>" <migrasjonsfil.sql>')
  }
  writeFileSync(fil, tilbaketrekkingsmigrasjon(stoff, nokkel, begrunnelse))
  console.log(`Tilbaketrekking av «${nokkel}» på «${stoff}» → ${fil}`)
} else {
  const [importfil, fil] = argumenter
  if (!importfil) avslutt('Bruk: <importfil.json> [<migrasjonsfil.sql>]')
  let data: unknown
  try {
    data = JSON.parse(readFileSync(importfil, 'utf8'))
  } catch (e) {
    avslutt(`${importfil} er ikke gyldig JSON: ${(e as Error).message}`)
  }
  const kontroll = kontrollerImport(data)
  if (!kontroll.ok) avslutt(`${importfil} har ${kontroll.feil.length} feil:\n${kontroll.feil.map((f) => `  - ${f}`).join('\n')}`)
  const { stoff, kilde } = kontroll.import
  console.log(`${importfil} er i orden: ${antallIImport(kontroll.import)} bivirkninger for «${stoff}» fra «${kilde.tittel}».`)
  if (fil) {
    writeFileSync(fil, importmigrasjon(kontroll.import))
    console.log(`Migrasjonen → ${fil}`)
  }
}
