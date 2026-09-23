import { KURVE_GRONN, KURVE_GUL, KURVE_ROD } from './thc'
import { forventetEndring, tidForVerdi, verdiPaaKurve, type Kurve } from './thcKurver'
import type { ThcGrafgrunnlag } from './thcMotor'
import { THC_KURVEROLLER, kurverI, type ThcKurverolle, type ThcRegelsett } from './thcRegelsett'

/**
 * Tallgrunnlaget for visualiseringen av en fortolkning mot forrige prøve —
 * samme figur som i regnearkets Fortolkning-ark: tre utskillelseskurver som
 * prosentvis endring fra forrige prøve, med de to prøvene som punkter.
 * Komponenten som tegner får ferdige tall og trenger ikke regne selv.
 */

/**
 * En kurve slik figuren tegner den. Fargen følger rollen kurven har i
 * konklusjonen.
 */
export interface Figurkurve {
  navn: string
  tone: ThcKurverolle
  kurve: Kurve
}

/**
 * Kurvene i figuren — de samme tre som konklusjonsgrensene leses av, med
 * navnene fra regelsettet. Merk at dette er ett skritt bort fra regnearkets
 * egen graf, som tegner mellomkurven «Kronisk, typisk» (den lilla) i stedet
 * for den gule. Den lilla kurven er ikke med i konklusjonen, så figuren viste
 * en kurve kommentaren aldri leste av — og utelot den som avgjør. Figuren
 * skal speile fortolkningen.
 */
export function figurkurver(r: ThcRegelsett): Figurkurve[] {
  const kurver = kurverI(r)
  return THC_KURVEROLLER.map((rolle) => ({ navn: r.kurver[rolle].navn, tone: rolle, kurve: kurver[rolle] }))
}

/** Figurkurvene fra konstantene i den opprinnelige modulen. */
const FIGURKURVER: Figurkurve[] = [
  { navn: 'Normal utskillelse', tone: 'gronn', kurve: KURVE_GRONN },
  { navn: 'Moderat utskillelse', tone: 'gul', kurve: KURVE_GUL },
  { navn: 'Treg utskillelse', tone: 'rod', kurve: KURVE_ROD },
]

/** Punkter per kurve. Nok til at også den bratteste starten står jevn. */
const OPPLOSNING = 160

export interface Kurvespor {
  navn: string
  tone: ThcKurverolle
  /** Prosentvis endring per tidspunkt, fra dag 0 til siste dag. */
  punkter: { dag: number; prosent: number }[]
}

export interface Grafpunkt {
  navn: string
  dag: number
  prosent: number
}

export interface Graf {
  /** Siste dag på x-aksen — antall døgn mellom prøvene. */
  xMaks: number
  xSteg: number
  /** Y-aksen i prosent, med runde tall i begge ender. */
  yTopp: number
  yBunn: number
  ySteg: number
  kurver: Kurvespor[]
  punkter: Grafpunkt[]
}

/** Et «pent» trinn — 1, 2 eller 5 ganger en tierpotens — nær `grovt`. */
function pentSteg(grovt: number): number {
  if (!(grovt > 0)) return 1
  const tierpotens = 10 ** Math.floor(Math.log10(grovt))
  const faktor = grovt / tierpotens
  const pen = faktor < 1.5 ? 1 : faktor < 3 ? 2 : faktor < 7 ? 5 : 10
  return pen * tierpotens
}

/**
 * Dagintervallet på x-aksen: et pent tall som gir omtrent 10 merker. Bruker
 * samme «pene steg» som y-aksen, så intervallet skalerer uansett hvor mange
 * dager det er mellom prøvene — appen setter ingen øvre grense på det lenger,
 * og et fast tak her ville gitt et rutenett med tusenvis av streker for en
 * gammel eller feiltastet dato.
 */
function velgXSteg(dager: number): number {
  return pentSteg(dager / 10)
}

/**
 * Y-aksen der alle merkene — også topp og bunn — er runde tall: toppen rundes
 * opp og bunnen ned til nærmeste hele trinn. Bunnen går aldri under −100 %,
 * for mer enn alt kan ikke skilles ut.
 */
function penYAkse(minst: number, storst: number): { yTopp: number; yBunn: number; ySteg: number } {
  const steg = pentSteg((storst - minst) / 10)
  let yTopp = Math.ceil(storst / steg - 1e-9) * steg
  const yBunn = Math.max(Math.floor(minst / steg + 1e-9) * steg, -100)
  if (yTopp - yBunn < steg) yTopp = yBunn + steg
  return { yTopp, yBunn, ySteg: steg }
}

/** Bygger hele figuren fra fortolkningens grafgrunnlag. */
export function byggGraf(
  { forrige, dager, korrigertEndring }: ThcGrafgrunnlag,
  figur: Figurkurve[] = FIGURKURVER,
): Graf {
  const korrigertProsent = korrigertEndring * 100

  const kurver: Kurvespor[] = figur.map(({ navn, tone, kurve }) => {
    // Kurven leses av fra der forrige prøve ligger på den, som i regnearkets
    // graftabell — ett oppslag her i stedet for ett per punkt.
    const start = tidForVerdi(forrige, kurve)
    const punkter = []
    for (let i = 0; i <= OPPLOSNING; i++) {
      const dag = (dager * i) / OPPLOSNING
      punkter.push({ dag, prosent: (verdiPaaKurve(start + dag, kurve) / forrige - 1) * 100 })
    }
    return { navn, tone, punkter }
  })

  // Grønn kurve faller brattest og setter bunnen, om ikke prøvepunktet gjør det.
  const gronn = figur.find((k) => k.tone === 'gronn')?.kurve ?? figur[0]!.kurve
  const gronnSlutt = forventetEndring(forrige, dager, gronn) * 100
  const { yTopp, yBunn, ySteg } = penYAkse(
    Math.min(gronnSlutt, korrigertProsent),
    Math.max(0, korrigertProsent),
  )

  return {
    xMaks: dager,
    xSteg: velgXSteg(dager),
    yTopp,
    yBunn,
    ySteg,
    kurver,
    punkter: [
      { navn: 'Forrige prøve', dag: 0, prosent: 0 },
      { navn: 'Denne prøven', dag: dager, prosent: korrigertProsent },
    ],
  }
}

/** «−45 %», «0 %», «+12 %» — med ekte minustegn, som ellers i appen. */
export function formaterProsent(verdi: number): string {
  const rundet = Math.round(verdi)
  const fortegn = rundet > 0 ? '+' : rundet < 0 ? '−' : ''
  return `${fortegn}${Math.abs(rundet)} %`
}
