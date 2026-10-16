/**
 * Verktøyene Claude-monografkuratoren arbeider med (`docs/kuratorprotokoll.md`,
 * `.claude/skills/monografkurator/SKILL.md`):
 *
 *   npm run kurator -- kall <handling> [<json> | @<fil>]   en handling i kurateringsgrenene
 *   npm run kurator -- tom-dekning <modus>                 en tom dekningsmatrise mot modellen nå
 *   npm run kurator -- dekning <fil>                       kontrollerer en dekningsmatrise
 *   npm run kurator -- dekning-gren <gren>                 kontrollerer dekningsmatrisen som er lagret i grenen
 *
 * Miljøet: `OUSFAR_ADRESSE` (standard ousfar.vercel.app), og nøkkelen i
 * `OUSFAR_AGENTNOKKEL` eller fila i `OUSFAR_NOKKELFIL` (standard i prosjektets
 * delte mappe). Svarene kan ha fagtekst fra bak innloggingen: de skrives bare
 * til terminalen, og hører aldri hjemme i repoet.
 */
import { readFileSync } from 'node:fs'
import { kontrollerDekning, tomMatrise, type Dekningsmatrise } from '../src/kuratorprotokoll/dekning'
import { Agentfeil, STANDARD_NOKKELFIL, lagAgentklient, lesArgumenter } from '../src/kuratorprotokoll/agentklient'

const [kommando, ...rest] = process.argv.slice(2).filter((a) => a !== '--')
const skriv = (v: unknown) => console.log(JSON.stringify(v, null, 2))

function klient() {
  const nokkel = process.env.OUSFAR_AGENTNOKKEL?.trim() || readFileSync(process.env.OUSFAR_NOKKELFIL || STANDARD_NOKKELFIL, 'utf8').trim()
  return lagAgentklient({ adresse: process.env.OUSFAR_ADRESSE || undefined, nokkel })
}

function dekning(matrise: unknown) {
  const feil = kontrollerDekning(matrise)
  if (feil.length === 0) console.log('Dekningsmatrisen dekker alle kontrollpunktene i modellen.')
  else {
    console.log(`Dekningsmatrisen har ${feil.length} mangler:`)
    for (const f of feil) console.log(`- ${f}`)
    process.exitCode = 1
  }
}

try {
  switch (kommando) {
    case 'kall':
      if (!rest[0]) throw new Error('Bruk: npm run kurator -- kall <handling> [<json> | @<fil>]')
      skriv(await klient().kall(rest[0], lesArgumenter(rest[1], (sti) => readFileSync(sti, 'utf8'))))
      break
    case 'tom-dekning':
      skriv(tomMatrise((rest[0] as Dekningsmatrise['modus']) || 'de_novo'))
      break
    case 'dekning':
      dekning(JSON.parse(readFileSync(rest[0] ?? '', 'utf8')))
      break
    case 'dekning-gren': {
      const dok = await klient().kall<{ innhold: unknown }>('les_dokument', { gren: rest[0], art: 'dekningsmatrise' })
      dekning(dok.innhold)
      break
    }
    default:
      console.error('Bruk: npm run kurator -- kall|tom-dekning|dekning|dekning-gren …')
      process.exitCode = 2
  }
} catch (e) {
  console.error(e instanceof Agentfeil ? `OUSFAR (${e.status}${e.kode ? `, ${e.kode}` : ''}): ${e.message}` : e instanceof Error ? e.message : String(e))
  process.exitCode = 1
}
