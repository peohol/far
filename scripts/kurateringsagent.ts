/**
 * Verktøyene Claude-agentene i kurateringsprosjektet arbeider med
 * (`docs/kuratering-prosjekt.md`, `docs/kuratorprotokoll.md`, skillene
 * `monografikurator` og `monografikontrollor`). `npm run kurator` arbeider som
 * kuratoren og `npm run kontrollor` som kontrolløren, hver med sin egen nøkkel:
 *
 *   npm run kurator -- kall <handling> [<json> | @<fil>]   en handling i kurateringsgrenene
 *   npm run kurator -- tom-dekning <modus>                 en tom dekningsmatrise mot modellen nå
 *   npm run kurator -- dekning <fil>                       kontrollerer en dekningsmatrise
 *   npm run kurator -- dekning-gren <gren>                 kontrollerer dekningsmatrisen som er lagret i grenen
 *   npm run kurator -- tom-selvtest                        en tom selvtest med hvert krav og hver port
 *   npm run kurator -- nye-nokler                          lager nøklene som mangler, og migrasjonen med kontrollsummene
 *
 * Miljøet: `OUSFAR_ADRESSE` (standard ousfar.vercel.app). Nøkkelen står i fila
 * rollen har i prosjektets delte mappe (`ROLLER`). Svarene kan ha fagtekst fra
 * bak innloggingen: de skrives bare til terminalen, og hører aldri hjemme i
 * repoet.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { kontrollerDekning, tomMatrise, type Dekningsmatrise } from '../src/kuratorprotokoll/dekning'
import { tomSelvtest } from '../src/kuratorprotokoll/selvtest'
import { Agentfeil, ROLLER, lagAgentklient, lesArgumenter, lesRolle } from '../src/kuratorprotokoll/agentklient'
import { migrasjonsversjon, nokkelmigrasjon, sikreNokler } from '../src/kuratorprotokoll/nokler'

const MIGRASJONER = 'supabase/migrations'

const [rolleArg, kommando, ...rest] = process.argv.slice(2).filter((a) => a !== '--')
const skriv = (v: unknown) => console.log(JSON.stringify(v, null, 2))

function klient() {
  const { navn, nokkelfil } = ROLLER[lesRolle(rolleArg)]
  if (!existsSync(nokkelfil)) throw new Error(`Fant ikke nøkkelen til ${navn} i ${nokkelfil}. Den lages med npm run kurator -- nye-nokler (docs/kuratering-prosjekt.md).`)
  const nokkel = readFileSync(nokkelfil, 'utf8').trim()
  return lagAgentklient({ adresse: process.env.OUSFAR_ADRESSE || undefined, nokkel })
}

/** Nøklene som mangler, og migrasjonen med kontrollsummene, med mindre den nyeste alt har dem. */
function nyeNokler() {
  const nokler = sikreNokler(Object.values(ROLLER))
  for (const n of nokler) console.log(`${n.agent}: ${n.ny ? 'ny nøkkel i' : 'nøkkelen finnes i'} ${n.nokkelfil} (SHA-256 ${n.sha256})`)
  const sql = nokkelmigrasjon(nokler)
  const forrige = readdirSync(MIGRASJONER).filter((f) => f.endsWith('_kurateringsnokler.sql')).sort().at(-1)
  if (forrige && readFileSync(`${MIGRASJONER}/${forrige}`, 'utf8') === sql) {
    console.log(`Migrasjonen med disse kontrollsummene finnes alt: ${MIGRASJONER}/${forrige}`)
    return
  }
  const fil = `${MIGRASJONER}/${migrasjonsversjon(new Date())}_kurateringsnokler.sql`
  writeFileSync(fil, sql)
  console.log(`Migrasjonen er skrevet: ${fil}`)
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
    case 'tom-selvtest':
      skriv(tomSelvtest())
      break
    case 'dekning':
      dekning(JSON.parse(readFileSync(rest[0] ?? '', 'utf8')))
      break
    case 'dekning-gren': {
      const dok = await klient().kall<{ innhold: unknown }>('les_dokument', { gren: rest[0], art: 'dekningsmatrise' })
      dekning(dok.innhold)
      break
    }
    case 'nye-nokler':
      nyeNokler()
      break
    default:
      console.error('Bruk: npm run kurator|kontrollor -- kall|tom-dekning|tom-selvtest|dekning|dekning-gren|nye-nokler …')
      process.exitCode = 2
  }
} catch (e) {
  console.error(e instanceof Agentfeil ? `OUSFAR (${e.status}${e.kode ? `, ${e.kode}` : ''}): ${e.message}` : e instanceof Error ? e.message : String(e))
  process.exitCode = 1
}
