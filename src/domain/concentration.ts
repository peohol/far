import type { Analyte, Level, LevelComment } from '../types'

/**
 * Tolker et konsentrasjonsinnslag. Godtar både norsk desimalkomma og punktum,
 * og mellomrom som tusenskille. Returnerer `null` når teksten ikke er et tall.
 */
export function parseConcentration(input: string): number | null {
  const cleaned = input.trim().replace(/\s/g, '').replace(',', '.')
  if (cleaned === '' || !/^\d*\.?\d*$/.test(cleaned)) return null
  const value = Number(cleaned)
  return Number.isFinite(value) ? value : null
}

/**
 * Plasserer en konsentrasjon i ett av de tre nivåene.
 *
 * Grensene kommer fra «Under»- og «Over»-kolonnene i referansetabellene, som
 * til sammen dekker hele tallinjen. Der PDF-en har overlapp eller hull mellom
 * «Innenfor» og «Over» (se meta.avvik i datasettet) vinner «Over», som er den
 * kliniske sikre tolkningen.
 */
export function classify(analyte: Analyte, value: number): Level {
  if (value >= analyte.ovreGrense) return 'over'
  if (value < analyte.nedreGrense) return 'under'
  return 'innenfor'
}

export function levelComment(analyte: Analyte, level: Level): LevelComment {
  const match = analyte.nivaer.find((n) => n.niva === level)
  if (!match) throw new Error(`${analyte.kode} mangler nivået «${level}»`)
  return match
}

/** Sant når konsentrasjonen er over ringegrensen og rekvirenten skal varsles. */
export function isAboveCallLimit(analyte: Analyte, value: number): boolean {
  return analyte.ringegrense !== null && value > analyte.ringegrense
}

/** Sant når konsentrasjonen ligger utenfor det analysen faktisk kan måle. */
export function isOutsideMeasuringRange(analyte: Analyte, value: number): boolean {
  const bounds = analyte.maleomrade.deler
  if (bounds.length === 0) return false
  const lows = bounds.map((d) => d.fra).filter((n): n is number => n !== null)
  const highs = bounds.map((d) => d.til).filter((n): n is number => n !== null)
  if (lows.length > 0 && value < Math.min(...lows)) return true
  if (highs.length > 0 && value > Math.max(...highs)) return true
  return false
}
