import type { Analyte, Level, LevelComment } from '../types'

/**
 * Plasserer en konsentrasjon i ett av de tre nivåene.
 *
 * Grensene kommer fra «Under»- og «Over»-kolonnene i referansetabellene, som
 * til sammen dekker hele tallinjen. Der PDF-en har overlapp eller hull mellom
 * «Innenfor» og «Over» (se meta.avvik i datasettet) vinner «Over», som er den
 * kliniske sikre tolkningen.
 *
 * Dette er den kanoniske regelen for hvilken kommentar som gjelder.
 * {@link bands} deler tallinjen på nøyaktig de samme grensene, og testene
 * holder de to opp mot hverandre.
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
