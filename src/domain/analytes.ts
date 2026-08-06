import rawData from '../data/analytter.json'
import type { Analyte, Dataset } from '../types'

/**
 * Datasettet er statisk og bygges fra kommentarer.pdf med
 * `npm run data`. Det lastes én gang og deles av hele appen.
 */
export const dataset = rawData as unknown as Dataset

export const analytes: Analyte[] = dataset.analytter

const byCode = new Map(analytes.map((a) => [a.kode, a]))

export function findByCode(kode: string): Analyte | undefined {
  return byCode.get(kode)
}
