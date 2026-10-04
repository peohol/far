/**
 * Kontrollerer en importfil med bivirkninger fra en preparatomtale, viser hva
 * den inneholder og endrer, og lager migrasjonen som legger den inn (se
 * `docs/bivirkninger.md`).
 *
 *   npm run import:bivirkninger -- <importfil.json> [--mot <forrige.json>]
 *   npm run import:bivirkninger -- <importfil.json> <migrasjonsfil.sql>
 *   npm run import:bivirkninger -- --trekk-tilbake <stoff> <kildenøkkel> "<begrunnelse>" <migrasjonsfil.sql>
 *
 * Uten migrasjonsfil er det en tørrkjøring: fila kontrolleres, og
 * forhåndsvisningen skrives ut, men ingenting lages. Importen sammenlignes
 * med den siste importen av samme kilde i migrasjonene, eller med fila etter
 * `--mot`. Har fila feil, skrives alle ut med stedet i fila, og ingen
 * forhåndsvisning eller migrasjon lages. Er innholdet det samme som i den
 * siste importen, lages heller ingen migrasjon.
 *
 * Forhåndsvisningen er Markdown på standard ut og kan lagres med
 * `> rapport.md`; alt annet skrives til standard feil. Migrasjonen rulles ut
 * med `apply_migration` og gis versjonen prosjektet registrerer når den legges
 * i `supabase/migrations/`.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { importrapport, sammeInnhold, type Sammenligningsgrunnlag } from '../src/bivirkninger/forhandsvisning'
import {
  importmigrasjon,
  kildeid,
  kontrollerImport,
  sisteEndringer,
  tilbaketrekkingsmigrasjon,
  type Bivirkningsimport,
} from '../src/bivirkninger/import'

const MIGRASJONSMAPPE = new URL('../supabase/migrations/', import.meta.url)
const argumenter = process.argv.slice(2).filter((a) => a !== '--')

function avslutt(melding: string): never {
  console.error(melding)
  process.exit(1)
}

/** En importfil lest og kontrollert, eller avslutning med alle feilene. */
function lesImport(fil: string): Bivirkningsimport {
  let data: unknown
  try {
    data = JSON.parse(readFileSync(fil, 'utf8'))
  } catch (e) {
    avslutt(`${fil} er ikke gyldig JSON: ${(e as Error).message}`)
  }
  const kontroll = kontrollerImport(data)
  if (!kontroll.ok) avslutt(`${fil} har ${kontroll.feil.length} feil:\n${kontroll.feil.map((f) => `  - ${f}`).join('\n')}`)
  return kontroll.import
}

// Uten linjeskift til slutt: apply_migration lagrer teksten uten, og fila skal være lik byte for byte.
if (argumenter[0] === '--trekk-tilbake') {
  const [, stoff, nokkel, begrunnelse, fil] = argumenter
  if (!stoff || !nokkel || !begrunnelse?.trim() || !fil) {
    avslutt('Bruk: --trekk-tilbake <stoff> <kildenøkkel> "<begrunnelse>" <migrasjonsfil.sql>')
  }
  writeFileSync(fil, tilbaketrekkingsmigrasjon(stoff, nokkel, begrunnelse))
  console.error(`Tilbaketrekking av «${nokkel}» på «${stoff}» → ${fil}`)
} else {
  const mot = argumenter.indexOf('--mot')
  const motfil = mot >= 0 ? argumenter[mot + 1] : undefined
  if (mot >= 0 && !motfil) avslutt('Bruk: --mot <forrige.json>')
  const [importfil, fil, ...resten] = argumenter.filter((_, i) => mot < 0 || (i !== mot && i !== mot + 1))
  if (!importfil || resten.length > 0) avslutt('Bruk: <importfil.json> [<migrasjonsfil.sql>] [--mot <forrige.json>]')

  const imp = lesImport(importfil)
  const migrasjoner = readdirSync(MIGRASJONSMAPPE)
    .filter((f) => f.endsWith('.sql'))
    .map((navn) => ({ navn, sql: readFileSync(new URL(navn, MIGRASJONSMAPPE), 'utf8') }))
  const siste = sisteEndringer(migrasjoner).get(kildeid(imp.stoff, imp.kilde.nokkel))

  const grunnlag: Sammenligningsgrunnlag = motfil
    ? { slag: 'import', import: lesImport(motfil), beskrivelse: `fila ${motfil}` }
    : siste?.slag === 'import'
      ? { slag: 'import', import: siste.import as Bivirkningsimport, beskrivelse: `den siste importen av kilden, i migrasjonen ${siste.migrasjon}` }
      : siste
        ? { slag: 'ingen', merknad: `Kilden ble trukket tilbake i migrasjonen ${siste.migrasjon}; importen legger den inn igjen.` }
        : { slag: 'ingen' }
  process.stdout.write(importrapport(imp, grunnlag, importfil))

  if (fil) {
    if (siste?.slag === 'import' && sammeInnhold(siste.import as Bivirkningsimport, imp)) {
      avslutt(
        `Ingen migrasjon laget: innholdet er det samme som i den siste importen av kilden (${siste.migrasjon}), og databasen ville ikke endret noe.`,
      )
    }
    writeFileSync(fil, importmigrasjon(imp))
    console.error(`Migrasjonen → ${fil}`)
  }
}
