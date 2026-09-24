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

/** Variablene i blokken som begynner med nøyaktig denne selektoren. */
function blokk(selektor: string): Record<string, string> {
  const start = css.indexOf(`${selektor} {`)
  if (start === -1) throw new Error(`Fant ikke ${selektor} i tokens.css`)
  const innhold = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start))
  const funn: Record<string, string> = {}
  for (const m of innhold.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    if (m[1] && m[2]) funn[m[1]] = m[2].trim()
  }
  return funn
}

/** Følger `var(--navn)` til verdien den peker på, så et token som peker på et annet måles som det det er. */
function losOpp(palett: Record<string, string>): Record<string, string> {
  const los = (verdi: string, sett: string[] = []): string => {
    const m = /^var\((--[\w-]+)\)$/.exec(verdi)
    if (!m?.[1]) return verdi
    const neste = palett[m[1]]
    if (neste === undefined || sett.includes(m[1])) throw new Error(`Kan ikke løse opp ${verdi}`)
    return los(neste, [...sett, m[1]])
  }
  return Object.fromEntries(Object.entries(palett).map(([navn, verdi]) => [navn, los(verdi)]))
}

const FELLES = blokk(':root')
const LYST = blokk(":root,\n:root[data-tema='lyst'],\n[data-tema='lyst']")

const TEMAER = {
  lyst: losOpp({ ...FELLES, ...LYST }),
  // Mørkt tema legger seg over det lyse, som i nettleseren.
  moerkt: losOpp({ ...FELLES, ...LYST, ...blokk(":root[data-tema='moerkt'],\n[data-tema='moerkt']") }),
}

/** [forgrunn, bakgrunn, minstekrav, hva det er] */
const KRAV: [string, string, number, string][] = [
  ['--blekk-sterk', '--flate-bunn', 4.5, 'analyttnavn i søkealternativene'],
  ['--blekk', '--flate-bunn', 4.5, 'brødtekst på sidebakgrunn'],
  ['--blekk', '--flate', 4.5, 'brødtekst på kort'],
  ['--blekk', '--flate-hevet', 4.5, 'brødtekst på hevet flate'],
  ['--blekk-dempet', '--flate-bunn', 4.5, 'dempet tekst på sidebakgrunn'],
  ['--blekk-dempet', '--flate', 4.5, 'dempet tekst på kort'],
  ['--blekk-dempet', '--flate-hevet', 4.5, 'dempet tekst på hevet flate, som i søkefeltet'],
  ['--aksent', '--flate-bunn', 4.5, 'analyttkode'],
  ['--aksent', '--flate', 4.5, 'metalinjens kode og lenker på kort'],
  ['--paa-aksent', '--aksent', 4.5, 'tekst i primærknapp'],
  ['--under-blekk', '--under-flate', 4.5, 'nivå «under»'],
  ['--referanse-blekk', '--referanse-flate', 4.5, 'nivå «innenfor» og referanseområde'],
  ['--toksisk-blekk', '--toksisk-flate', 4.5, 'toksisk område og bånd over referanseområdet'],
  ['--alvorlig-blekk', '--alvorlig-flate', 4.5, 'nivå «over», ringegrense og alvorlig intoksikasjon'],
  // Kvitteringen «Kopiert» i rusmiddelmodulen, på begge flatene den kan stå på.
  ['--referanse-blekk', '--flate-hevet', 4.5, 'kvittering for kopiert kommentar'],
  ['--referanse-blekk', '--flate', 4.5, 'kvittering for kopiert kommentar på kort'],
  // Påslått innstilling og valgt tilstand: teksten på sin egen flate, og
  // kanten rundt knappen mot sidebakgrunnen.
  ['--aksent', '--aksent-flate', 4.5, 'påslått eller valgt knapp'],
  ['--aksent', '--flate-bunn', 3, 'kant rundt påslått knapp'],
  // Den nøytrale knappen i EtG- og EtS-modulen står på et kort.
  ['--blekk', '--flate-hevet', 4.5, 'tekst på nøytral knapp'],
  ['--blekk-dempet', '--flate', 3, 'kant rundt nøytral knapp'],
  ['--toksisk-blekk', '--toksisk-flate', 4.5, 'advarsel om måleområde'],
  ['--fritak-blekk', '--fritak-flate', 4.5, 'merket for godkjenningsfritak i Preparater'],
  ['--referanse-kant', '--flate-bunn', 3, 'kant rundt «innenfor»'],
  ['--toksisk-kant', '--flate-bunn', 3, 'kant rundt gult bånd'],
  ['--alvorlig-kant', '--flate-bunn', 3, 'kant rundt «over»'],
  ['--under-kant', '--flate-bunn', 3, 'kant rundt «under»'],
  // Kanten som alene viser hvor et felt er — søkefeltet i fortolkningen.
  ['--linje-kontroll', '--flate-bunn', 3, 'kant rundt felt på sidebakgrunn'],
  ['--linje-kontroll', '--flate', 3, 'kant rundt felt på kort'],
  ['--fokus', '--flate-bunn', 3, 'fokusmarkering'],
  ['--fokus', '--flate-hevet', 3, 'fokusmarkering på hevet flate, som i toppmenyen'],
  ['--tips-blekk', '--tips-flate', 4.5, 'tekst i tooltip'],
  ['--tips-blekk-dempet', '--tips-flate', 4.5, 'dempet tekst i tooltip'],
  // Boblen er snudd i forhold til appen, og skal skille seg fra flaten den
  // legger seg over — ellers flyter den sammen med kortet under.
  ['--tips-flate', '--flate', 3, 'tooltipflate mot kort'],
  ['--tips-flate', '--flate-bunn', 3, 'tooltipflate mot sidebakgrunn'],
  // Merkene på føringene i endringsloggen.
  ['--merke-design', '--merke-design-flate', 4.5, 'merket «Design / layout»'],
  ['--merke-funksjon', '--merke-funksjon-flate', 4.5, 'merket «Funksjonalitet»'],
  ['--merke-fag', '--merke-fag-flate', 4.5, 'merket «Fag»'],
  // Admin-merket i kontomenyen.
  ['--aksent-2', '--flate', 4.5, 'merket «Admin»'],
  ['--toksisk-blekk', '--flate', 4.5, 'advarselen ved det midlertidige passordet'],
  ['--blekk', '--flate-bunn', 4.5, 'tekst i skjemafelt'],
  // Analysemetodepillen bærer metodens egen farge og ikke et token; den
  // kontrastmåles i `domain/__tests__/optionColours.test.ts`.
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

describe('tokens', () => {
  it('har samme fargenavn i lyst og mørkt tema', () => {
    const farger = (palett: Record<string, string>) =>
      Object.keys(palett).filter((navn) => !(navn in FELLES)).sort()
    const moerkt = blokk(":root[data-tema='moerkt'],\n[data-tema='moerkt']")
    expect(Object.keys(moerkt).filter((navn) => !(navn in FELLES)).sort()).toEqual(farger(LYST))
  })

  it('setter alle varigheter til 0 ved redusert bevegelse', () => {
    const varigheter = Object.keys(FELLES).filter((navn) => navn.startsWith('--fart-'))
    const redusert = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'))
    const blokken = redusert.slice(0, redusert.indexOf('}\n}'))
    for (const navn of varigheter) expect(blokken, navn).toContain(`${navn}: 0ms`)
  })
})
