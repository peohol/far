/**
 * Måler fargepaletten mot WCAG 2.1 AA, som er kravet i forskrift om
 * universell utforming av IKT. Testen leser tokens.css direkte, så et endret
 * token som senker kontrasten slår ut her og ikke først hos brukeren.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { contrastRatio } from '../../domain/contrast'

const css = readFileSync(fileURLToPath(new URL('../tokens.css', import.meta.url)), 'utf8')

/** Plukker ut variablene som gjelder i ett tema. */
function tokens(selector: string): Record<string, string> {
  const start = css.indexOf(selector)
  if (start === -1) throw new Error(`Fant ikke ${selector} i tokens.css`)
  const block = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start))
  const funn: Record<string, string> = {}
  for (const m of block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    if (m[1] && m[2]) funn[m[1]] = m[2].trim()
  }
  return funn
}

const TEMAER = {
  lyst: { ...tokens(":root,\n:root[data-tema='lyst']") },
  moerkt: { ...tokens(":root[data-tema='moerkt']") },
}

/** [forgrunn, bakgrunn, minstekrav, hva det er] */
const KRAV: [string, string, number, string][] = [
  ['--blekk', '--flate-bunn', 4.5, 'brødtekst på sidebakgrunn'],
  ['--blekk', '--flate', 4.5, 'brødtekst på kort og tooltip'],
  ['--blekk', '--flate-hevet', 4.5, 'brødtekst på hevet flate'],
  ['--blekk-dempet', '--flate-bunn', 4.5, 'dempet tekst på sidebakgrunn'],
  ['--blekk-dempet', '--flate', 4.5, 'dempet tekst på kort'],
  ['--blekk-svak', '--flate-bunn', 3, 'svake ikoner (grafisk element)'],
  ['--aksent', '--flate-bunn', 4.5, 'analyttkode'],
  ['--aksent-blekk', '--aksent', 4.5, 'tekst i hovedknapp'],
  ['--niva-under-blekk', '--niva-under-flate', 4.5, 'nivå «under»'],
  ['--niva-innenfor-blekk', '--niva-innenfor-flate', 4.5, 'nivå «innenfor»'],
  ['--niva-over-blekk', '--niva-over-flate', 4.5, 'nivå «over» og ringegrense'],
  ['--varsel-blekk', '--varsel-flate', 4.5, 'advarsel om måleområde'],
  ['--niva-under-linje', '--flate-bunn', 3, 'kant rundt «under»'],
  ['--niva-innenfor-linje', '--flate-bunn', 3, 'kant rundt «innenfor»'],
  ['--niva-over-linje', '--flate-bunn', 3, 'kant rundt «over»'],
  ['--linje-sterk', '--flate-bunn', 3, 'sterk kantlinje'],
  ['--fokus', '--flate-bunn', 3, 'fokusmarkering'],
]

describe.each(Object.entries(TEMAER))('%s tema', (_navn, palett) => {
  it.each(KRAV)('%s mot %s ≥ %s:1 (%s)', (fg, bg, minst) => {
    const forgrunn = palett[fg]
    const bakgrunn = palett[bg]
    expect(forgrunn, `mangler ${fg}`).toBeDefined()
    expect(bakgrunn, `mangler ${bg}`).toBeDefined()
    expect(contrastRatio(forgrunn as string, bakgrunn as string)).toBeGreaterThanOrEqual(minst)
  })
})
