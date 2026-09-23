import type { Level } from '../types'

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

export function round(value: number, decimals: number): number {
  const f = 10 ** decimals
  return Math.round(value * f) / f
}

/** Norsk tallformat: desimalkomma, ingen tusenskille. */
export function formatNumber(value: number, decimals = 0): string {
  return value.toFixed(decimals).replace('.', ',').replace(/,0+$/, '')
}

/** Det som skal til for å bygge ett bånd. */
export interface Bandgrunnlag {
  niva: Level
  /** Inklusiv nedre grense. `null` = ingen nedre grense. */
  fra: number | null
  /** Inklusiv øvre grense. `null` = ingen øvre grense. */
  til: number | null
  ring: boolean
  desimaler: number
  kommentar: string
  /** Nøkkelen, når den ikke er den vanlige for nivået og ringingen. */
  key?: string
}

/**
 * Bygger ett bånd: tonen, nøkkelen og teksten på knappen. `fra` og `til` er
 * begge inklusive; `null` er åpen ende.
 *
 * Båndene steg 2 viser for et regelsett, bygges her; se `regelsettband` i
 * `intervallregler.ts`.
 */
export function lagBand({ niva, fra, til, ring, desimaler, kommentar, key }: Bandgrunnlag): Band {
  const steg = 10 ** -desimaler
  const f = (v: number) => formatNumber(v, desimaler)
  let label: string
  if (fra === null && til !== null) label = `< ${f(round(til + steg, desimaler))}`
  else if (til === null && fra !== null) label = `≥ ${f(fra)}`
  else if (fra !== null && til !== null) label = fra === til ? f(fra) : `${f(fra)} – ${f(til)}`
  else label = '–'

  return {
    key: key ?? (ring ? `${niva}-ring` : niva),
    niva,
    ring,
    tone: niva === 'over' && ring ? 'ring' : niva,
    fra,
    til,
    label,
    kommentar,
  }
}
