import rawData from '../data/analytter.json'
import rawAntihypertensiver from '../data/antihypertensiver.json'
import type { Analyte, Dataset } from '../types'

/**
 * Datasettene er statiske og bygges fra kildene i `originaldata/` med
 * `npm run data`. De lastes én gang og deles av hele appen.
 */
export const dataset = rawData as unknown as Dataset
export const antihypertensivdatasett = rawAntihypertensiver as unknown as Dataset

/**
 * Alle analyttene som kommenteres med konsentrasjonsbånd: psykofarmaka fra
 * kommentarer.pdf og antihypertensiver fra AHT.docx.
 *
 * De to kategoriene går samme vei gjennom appen og deler både båndene,
 * klassifiseringen og søket. Det eneste som skiller dem er hvilke
 * referansetall analyttkortet viser — se `domain/piller.ts`.
 */
export const analytes: Analyte[] = [...dataset.analytter, ...antihypertensivdatasett.analytter]

const byCode = new Map(analytes.map((a) => [a.kode, a]))

export function findByCode(kode: string): Analyte | undefined {
  return byCode.get(kode)
}
