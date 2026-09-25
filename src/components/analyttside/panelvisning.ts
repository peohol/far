import type { Ikonnavn } from '../ikon/register'

/**
 * Ikonene på stoffsiden: seksjonsikonet for hvert panel, og ikonet for hvert
 * kort i farmakokinetikken. Tegningene står i Atlas-registeret
 * (`src/components/ikon/register.ts`); her står bare hvilket som hører til hva.
 *
 * Ikonene er pynt ved siden av en tittel som alltid står i tekst, så et ikon
 * som mangler eller er feil, endrer aldri hva siden sier.
 */

/** Seksjonsikonet for hver seksjon på siden, etter seksjonens faste nøkkel. */
const SEKSJONSIKONER: Readonly<Record<string, Ikonnavn>> = {
  viktige_data: 'ref',
  farmakodynamikk: 'gears',
  indikasjon: 'indik',
  preparater: 'prep',
  dosering: 'dose',
  farmakokinetikk: 'pk',
  farmakogenetikk: 'dna',
  interaksjoner: 'inter',
  serumkonsentrasjoner: 'serum',
  fortolkning: 'interp',
  referanser: 'refs',
}

/** Ikonet for seksjonen med nøkkelen, eller ingen når den ikke har et eget. */
export function seksjonsikon(nokkel: string): Ikonnavn | undefined {
  return SEKSJONSIKONER[nokkel]
}

/**
 * Kategoriene kortene i farmakokinetikken kan høre til, med mønstre for
 * overskriften. Overskriften er fri redaksjonell tekst, så den sammenlignes
 * etter normalisering (små bokstaver, uten aksenter, og senket skrift som
 * vanlige bokstaver: «tₘₐₓ» leses som «tmax»). Den første kategorien som
 * passer, vinner. Passer ingen, får kortet det generiske ikonet.
 */
const KINETIKKATEGORIER: readonly { ikon: Ikonnavn; monster: RegExp }[] = [
  { ikon: 'bio', monster: /biotilgj|bioavail/ },
  { ikon: 'absorp', monster: /absorp/ },
  { ikon: 'peak', monster: /^t ?max\b|maks(imal)?konsentrasjon|c ?max/ },
  { ikon: 'hl', monster: /^t ?(1\/2|1⁄2)|halveringstid/ },
  { ikon: 'ss', monster: /^t ?ss\b|steady.?state/ },
  { ikon: 'protein', monster: /protein/ },
  { ikon: 'dist', monster: /distribu|^v ?d\b|volum/ },
  { ikon: 'metab', monster: /metabol|cyp|enzym/ },
  { ikon: 'elim', monster: /elimin|utskil|ekskresj|clearance/ },
  { ikon: 'inter', monster: /interaksj/ },
]

/** Overskriften slik kategoriene sammenlignes: «tₘₐₓ» → «tmax», «Absorpsjon» → «absorpsjon». */
export function normaliserOverskrift(tittel: string): string {
  return tittel
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

/** Ikonet for et kort i farmakokinetikken, etter overskriften. `fallback` når ingen kategori passer. */
export function kinetikkikon(tittel: string): Ikonnavn {
  const normalisert = normaliserOverskrift(tittel)
  return KINETIKKATEGORIER.find(({ monster }) => monster.test(normalisert))?.ikon ?? 'fallback'
}

/**
 * Ikonene for legemiddelformene på t₁/₂- og tₛₛ-kortene i «Viktige data»,
 * med mønstre for navnet redaktøren har gitt formen («Peroralt»,
 * «Depotinjeksjon (Xeplion)»). Den første som passer, vinner; passer ingen,
 * får formen det generiske ikonet. Samme tegninger som legemiddelformene i
 * «Preparater» (`src/legemiddeldata/legemiddelformer.ts`).
 */
const FORMKATEGORIER: readonly { ikon: Ikonnavn; monster: RegExp }[] = [
  { ikon: 'dropper', monster: /draper/ },
  { ikon: 'capsule', monster: /kapsel/ },
  { ikon: 'tablet', monster: /peroral|^oralt?\b|tablett|\bp\.?o\b/ },
  { ikon: 'syringe', monster: /injek|depot|infusj|\bi\.?[mv]\b|intramusk|intraven/ },
  { ikon: 'bottle', monster: /mikstur|oppl[oø]sning/ },
]

/** Ikonet for en legemiddelform på et datakort, etter navnet. `fallback` når ingen kategori passer. */
export function legemiddelformikon(form: string): Ikonnavn {
  const normalisert = normaliserOverskrift(form)
  return FORMKATEGORIER.find(({ monster }) => monster.test(normalisert))?.ikon ?? 'fallback'
}

/**
 * Hvordan et tekstpanel vises. `lesing` er løpende tekst; `dosering` er ett
 * kort per avsnitt med etiketten foran kolonet (se `doseringskort`), når
 * teksten har den formen.
 */
export type Tekstvisning = 'lesing' | 'dosering'

const TEKSTVISNINGER: Readonly<Record<string, Tekstvisning>> = {
  dosering: 'dosering',
}

export function tekstvisning(nokkel: string): Tekstvisning {
  return TEKSTVISNINGER[nokkel] ?? 'lesing'
}
