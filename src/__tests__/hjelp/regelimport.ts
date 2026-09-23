/**
 * Dagens konsentrasjonsregler og kommentarer, gjort om til regelsett.
 *
 * Det er dette importdatasettet (`supabase/import/intervallregelsett.json`)
 * inneholder, og testene kontrollerer at datasettet og denne omgjøringen er
 * like. Omgjøringen bruker
 * den gamle motoren selv — båndene i `domain/bands.ts` og cut-off-teksten i
 * `domain/valg.ts` — så regelsettene er nøyaktig det de statiske datasettene
 * gir, bare med grensene skrevet som skillepunkter.
 *
 * ID-ene til kommentarene er faste, laget av analyttkoden og hva kommentaren
 * er, så importen gir det samme hver gang.
 */
import { createHash } from 'node:crypto'
import { analytes, antihypertensivdatasett, dataset } from '../../domain/analytes'
import { bands, decimalsOf } from '../../domain/bands'
import { levelComment } from '../../domain/concentration'
import type { Regelimport } from '../../regler/import'
import type { Intervallregelsett, Regelkommentar } from '../../regler/modell'
import { cutoffInnledning, harCutoffvalg } from '../../domain/valg'
import type { Analyte, Level } from '../../types'

/** En fast UUID for en kommentar i importen. */
export function importId(...deler: string[]): string {
  const h = createHash('md5').update(['intervallregelsett', ...deler].join('/')).digest('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

/** Regelsettet dagens motor gir for analytten. */
export function regelsettFraAnalytt(analyte: Analyte): Intervallregelsett {
  const band = bands(analyte)
  const kommentarId = (niva: Level) => importId(analyte.kode, niva)

  const nivaer = [...new Set(band.map((b) => b.niva))]
  const kommentarer: Regelkommentar[] = nivaer.map((niva) => ({
    id: kommentarId(niva),
    tekst: levelComment(analyte, niva).kommentar,
  }))

  const cutoff = harCutoffvalg(analyte)
    ? { innledning: importId(analyte.kode, 'cutoff'), kommentar: kommentarId('innenfor') }
    : null
  if (cutoff) kommentarer.push({ id: cutoff.innledning, tekst: cutoffInnledning(analyte).trim() })

  return {
    analyttkode: analyte.kode,
    enhet: analyte.enhet,
    desimaler: decimalsOf(analyte),
    skillepunkter: band.slice(1).map((b) => b.fra!),
    intervaller: band.map((b) => ({
      niva: b.niva,
      handling: b.ring ? 'ring_rekvirent' : null,
      kommentar: kommentarId(b.niva),
    })),
    ringegrense: analyte.ringegrense,
    cutoff,
    kommentarer,
  }
}

/** Alle regelsettene importen legger inn, sortert på analyttkode. */
export function regelimport(): Intervallregelsett[] {
  return analytes.map(regelsettFraAnalytt).sort((a, b) => a.analyttkode.localeCompare(b.analyttkode))
}

/** Kilden som føres på den første revisjonen av regelsettet. */
export function importkilde(analyte: Analyte): string {
  const fil = analyte.antihypertensiv ? antihypertensivdatasett.meta.kilde : dataset.meta.kilde
  return `Importert fra ${fil}, via de statiske fortolkningsreglene i OUSFAR`
}

/** Importdatasettet slik dagens motor gir det: hvert regelsett med kilden. */
export function regelimportdata(): Regelimport[] {
  const etterKode = new Map(analytes.map((a) => [a.kode, a]))
  return regelimport().map((regelsett) => ({ kilde: importkilde(etterKode.get(regelsett.analyttkode)!), regelsett }))
}

/** Importdatasettet som tekst, ett regelsett per linje. */
export function regelimportfil(): string {
  return `[\n${regelimportdata().map((i) => JSON.stringify(i)).join(',\n')}\n]\n`
}
