/**
 * Versjonsnummeret og formen på endringsloggen.
 *
 * Appen versjoneres etter SemVer (MAJOR.MINOR.PATCH). Selve føringene ligger i
 * `src/data/endringslogg.ts`, nyest først, og versjonen appen viser er den
 * øverste føringen der. Da kan ikke de to komme i utakt: det finnes bare ett
 * sted å skrive versjonen, og det er sammen med beskrivelsen av hva som ble
 * endret.
 *
 * Rutinen for å legge inn en ny føring står i `docs/endringslogg.md`.
 */

/**
 * Hva slags endring det er snakk om. Én føring kan være flere ting på én gang
 * — en ny modul er gjerne både fag og funksjonalitet.
 */
export const ENDRINGSTYPER = ['Design / layout', 'Funksjonalitet', 'Fag'] as const

export type Endringstype = (typeof ENDRINGSTYPER)[number]

/** Hvor stor endringen er. Vurderes skjønnsmessig, fra minst til størst. */
export const OMFANG = [
  'Minimalt omfang',
  'Mindre omfang',
  'Moderat omfang',
  'Større omfang',
  'Betydelig omfang',
] as const

export type Omfang = (typeof OMFANG)[number]

export interface Endring {
  /** MAJOR.MINOR.PATCH. */
  versjon: string
  /** ISO-dato, `åååå-mm-dd`. Sorterbar som den står; vises som dd.mm.åååå. */
  dato: string
  /** Én ekstremt kort linje om hva som ble gjort. */
  sammendrag: string
  typer: Endringstype[]
  omfang: Omfang
  /** Det konkrete, i vanlig språk — punktene som avdekkes når skuffen åpnes. */
  punkter: string[]
}

/**
 * Versjonen appen kjører: den øverste føringen i endringsloggen.
 *
 * Utledet og ikke skrevet ned et sted til, så versjonen aldri kan si noe annet
 * enn loggen gjør. `package.json` holdes lik av en test.
 */
export function nyesteVersjon(logg: Endring[]): string {
  const nyeste = logg[0]
  if (!nyeste) throw new Error('Endringsloggen er tom — appen har ingen versjon å vise')
  return nyeste.versjon
}

/** `2026-08-17` → `17.08.2026`. Formen føringene merkes med i loggen. */
export function formaterDato(iso: string): string {
  const treff = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!treff) throw new Error(`Ugyldig dato i endringsloggen: ${iso}`)
  const [, aar, maaned, dag] = treff
  return `${dag}.${maaned}.${aar}`
}

/** De tre tallene i en versjon, eller `null` når strengen ikke er SemVer. */
export function lesVersjon(versjon: string): [number, number, number] | null {
  const treff = /^(\d+)\.(\d+)\.(\d+)$/.exec(versjon)
  if (!treff) return null
  return [Number(treff[1]), Number(treff[2]), Number(treff[3])]
}

/**
 * Negativt når `a` er eldre enn `b`, positivt når den er nyere, 0 når de er
 * like. Sammenligner tall for tall, så `0.10.0` er nyere enn `0.9.0` — det er
 * nettopp her en ren tekstsammenligning ville tatt feil.
 */
export function sammenlignVersjon(a: string, b: string): number {
  const x = lesVersjon(a)
  const y = lesVersjon(b)
  if (!x || !y) throw new Error(`Ugyldig versjonsnummer: ${!x ? a : b}`)
  for (let i = 0; i < 3; i++) {
    const forskjell = (x[i] as number) - (y[i] as number)
    if (forskjell !== 0) return forskjell
  }
  return 0
}
