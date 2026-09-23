import type { Analyte } from '../types'

/** Prefikset kommentartabellen setter foran sumanalysene. */
const SUM_PREFIKS = /^sum:\s*/i

/**
 * Visningsnavnet uten «Sum: ».
 *
 * At noe er en sum går allerede fram av navnet — moderstoff pluss
 * metabolitter — så prefikset står bare foran det ordet brukeren leter etter.
 */
export function displayName(analyte: Analyte): string {
  return analyte.visningsnavn.replace(SUM_PREFIKS, '')
}

export interface SplitName {
  /** Moderstoffet: det første stoffet i en sum, ellers hele navnet. */
  moderstoff: string
  /** Metabolittene som summeres med moderstoffet. Tom for enkeltanalytter. */
  metabolitter: string[]
}

/**
 * Deler navnet i moderstoff og metabolitter.
 *
 * Koden og metabolittene er stort sett mindre kjent enn moderstoffet, så det
 * er moderstoffet som skal bære gjenkjennelsen i søkealternativene. Delingen
 * går på `navn` og ikke på `komponenter`, fordi `navn` har skrivemåten stoffene
 * skal vises med — «O-desmetylvenlafaksin» beholder den store O-en, mens
 * resten står med liten forbokstav slik de gjør i kilden.
 */
export function splitName(analyte: Analyte): SplitName {
  const deler = analyte.navn
    .split('+')
    .map((d) => d.trim())
    .filter(Boolean)
  const [moderstoff = analyte.navn, ...metabolitter] = deler
  return { moderstoff, metabolitter }
}

/**
 * Et stoffnavn slik det står midt i en setning: et vanlig ord får liten
 * forbokstav («Kodein» blir «kodein»), mens navn som «O-desmetylvenlafaksin»
 * og «MDMA» står som de er.
 */
export function iSetning(navn: string): string {
  return /^\p{Lu}\p{Ll}/u.test(navn) ? navn.charAt(0).toLocaleLowerCase('nb') + navn.slice(1) : navn
}
