import type { Analyte, Level } from '../types'
import { levelComment } from './concentration'

/**
 * Fargetonen en knapp i steg 2 vises med. «over» deles i gult og rødt etter om
 * konsentrasjonen også passerer ringegrensen.
 *
 * «cutoff» hører til den ene knappen som ikke er et konsentrasjonsbånd — se
 * `domain/valg.ts` — og står her fordi den deler form og farger med båndene.
 */
export type BandTone = 'under' | 'innenfor' | 'over' | 'ring' | 'cutoff'

export interface Band {
  /** Stabil id, brukes som nøkkel i tilstanden. */
  key: string
  /** Hvilket nivå kommentaren hentes fra. */
  niva: Level
  /** Sant når konsentrasjonen er over ringegrensen og rekvirenten skal ringes. */
  ring: boolean
  tone: BandTone
  /** Inklusiv nedre grense for båndet. `null` = ingen nedre grense. */
  fra: number | null
  /** Inklusiv øvre grense for båndet. `null` = ingen øvre grense. */
  til: number | null
  /** Intervallet slik det står på knappen, f.eks. «10 – 1799». */
  label: string
  kommentar: string
}

/** Antall desimaler i tallene til en analytt — styrer hvor fint båndene deles. */
function decimalsOf(analyte: Analyte): number {
  const values = [analyte.nedreGrense, analyte.ovreGrense, analyte.ringegrense]
  return Math.max(...values.map((v) => (v === null ? 0 : (String(v).split('.')[1] ?? '').length)))
}

function round(value: number, decimals: number): number {
  const f = 10 ** decimals
  return Math.round(value * f) / f
}

/** Norsk tallformat: desimalkomma, ingen tusenskille. */
export function formatNumber(value: number, decimals = 0): string {
  return value.toFixed(decimals).replace('.', ',').replace(/,0+$/, '')
}

interface Segment {
  niva: Level
  /** Inklusiv nedre grense. `null` = ingen nedre grense. */
  fra: number | null
  /** Eksklusiv øvre grense. `null` = ingen øvre grense. */
  til: number | null
}

/**
 * Deler konsentrasjonsaksen i de båndene brukeren kan velge mellom.
 *
 * Grunnlaget er de tre nivåene fra referansetabellen. I tillegg deles et nivå
 * i to der ringegrensen går tvers gjennom det, slik at «ring rekvirenten» blir
 * et eget valg. Sammenfaller ringegrensen med starten på «over» — som den gjør
 * for 32 av 35 analytter — ville delingen gitt et bånd med én eneste verdi;
 * da slås den sammen til ett rødt bånd i stedet.
 *
 * Båndene dekker hele tallinjen uten hull eller overlapp, og deler den på
 * nøyaktig samme grenser som `classify`.
 */
export function bands(analyte: Analyte): Band[] {
  const desimaler = decimalsOf(analyte)
  const steg = 10 ** -desimaler
  const ring = analyte.ringegrense

  const segmenter: Segment[] = [
    { niva: 'under', fra: null, til: analyte.nedreGrense },
    { niva: 'innenfor', fra: analyte.nedreGrense, til: analyte.ovreGrense },
    { niva: 'over', fra: analyte.ovreGrense, til: null },
  ]

  const ut: Band[] = []
  for (const seg of segmenter) {
    const hoyeste = seg.til === null ? null : round(seg.til - steg, desimaler)
    const heltUnderRing = ring !== null && hoyeste !== null && hoyeste <= ring
    const heltOverRing = ring !== null && seg.fra !== null && seg.fra > ring
    // Et bånd på én verdi er ikke verdt en egen knapp; da tar ringegrensen
    // hele segmentet i stedet.
    const delingGirEnkeltverdi = ring !== null && seg.fra !== null && seg.fra >= ring

    if (ring === null || heltUnderRing) {
      ut.push(lagBand(analyte, seg.niva, seg.fra, hoyeste, false, desimaler))
    } else if (heltOverRing || delingGirEnkeltverdi) {
      ut.push(lagBand(analyte, seg.niva, seg.fra, hoyeste, true, desimaler))
    } else {
      ut.push(lagBand(analyte, seg.niva, seg.fra, ring, false, desimaler))
      ut.push(lagBand(analyte, seg.niva, round(ring + steg, desimaler), hoyeste, true, desimaler))
    }
  }
  return ut
}

/** Bygger ett bånd. `fra` og `til` er begge inklusive; `null` er åpen ende. */
function lagBand(
  analyte: Analyte,
  niva: Level,
  fra: number | null,
  til: number | null,
  ring: boolean,
  desimaler: number,
): Band {
  const steg = 10 ** -desimaler
  const f = (v: number) => formatNumber(v, desimaler)
  let label: string
  if (fra === null && til !== null) label = `< ${f(round(til + steg, desimaler))}`
  else if (til === null && fra !== null) label = `≥ ${f(fra)}`
  else if (fra !== null && til !== null) label = fra === til ? f(fra) : `${f(fra)} – ${f(til)}`
  else label = '–'

  return {
    key: ring ? `${niva}-ring` : niva,
    niva,
    ring,
    tone: niva === 'over' && ring ? 'ring' : niva,
    fra,
    til,
    label,
    kommentar: levelComment(analyte, niva).kommentar,
  }
}
