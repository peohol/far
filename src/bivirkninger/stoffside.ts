/**
 * Bivirkningene slik seksjonen «Bivirkninger» på fagsiden viser dem: de to
 * visningene av det samme datasettet, oppsummeringene, og tekstene søket på
 * siden finner. Alt her er rene funksjoner.
 */
import { antall, kuttes, ramsOpp } from '../faginnhold/oppsummering'
import type { Tilleggstekst } from '../faginnhold/sok'
import { BIVIRKNINGSPANEL } from './referanser'
import {
  grupper,
  gruppeid,
  gruppenavn,
  undergruppeid,
  VISNINGER,
  type Bivirkningsdata,
  type Gruppe,
  type Undergruppe,
  type Visning,
} from './modell'

/** Dataene for siden, gruppert begge veier, så det ikke skjer på nytt hver gang visningen byttes. */
export interface Bivirkningsvisning {
  data: Bivirkningsdata
  grupper: Readonly<Record<Visning, Gruppe[]>>
  /** Sant når bivirkningene kommer fra mer enn én kilde; da står kilden ved hver. */
  flereKilder: boolean
}

export function byggBivirkningsvisning(data: Bivirkningsdata): Bivirkningsvisning {
  return {
    data,
    grupper: { frekvens: grupper(data.bivirkninger, 'frekvens'), organsystem: grupper(data.bivirkninger, 'organsystem') },
    flereKilder: new Set(data.bivirkninger.map((b) => b.kilde)).size > 1,
  }
}

/** Oppsummeringen av seksjonen: hvor mange bivirkninger og organsystemer. Den samme i begge visningene. */
export function oppsummerBivirkninger(data: Bivirkningsdata): string {
  if (data.bivirkninger.length === 0) return ''
  const organsystemer = new Set(data.bivirkninger.map((b) => b.organsystem)).size
  return ramsOpp([
    antall(data.bivirkninger.length, 'bivirkning', 'bivirkninger'),
    antall(organsystemer, 'organsystem', 'organsystemer'),
  ])
}

/** Oppsummeringen av en gruppe: kombinasjonene i den, med navnene. */
export function gruppeoppsummering(gruppe: Gruppe): string {
  return ramsOpp(gruppe.undergrupper.map((u) => gruppenavn(u.nokkel)))
}

/** Oppsummeringen av en kombinasjon: bivirkningene, etter hverandre. */
export function undergruppeoppsummering(under: Undergruppe): string {
  return ramsOpp(under.bivirkninger.map((b) => b.tekst))
}

/**
 * Om kortet for en kombinasjon har mer å vise enn oppsummeringen. Får alle
 * bivirkningene plass i den, og ingen har fotnote eller kilde ved seg, er
 * kortet fast og viser lista rett under tittelen (se `docs/seksjoner.md`).
 */
export function undergruppeHarMer(under: Undergruppe, flereKilder: boolean): boolean {
  return flereKilder || under.bivirkninger.some((b) => b.fotnote) || kuttes(undergruppeoppsummering(under))
}

/**
 * Tekstene søket på siden finner i bivirkningene, med kortet de står i i
 * visningen som står: bivirkningene, fotnotene og navnene på kombinasjonene.
 */
export function bivirkningstekster(visning: Bivirkningsvisning, valgt: Visning): Tilleggstekst[] {
  return visning.grupper[valgt].flatMap((gruppe) =>
    gruppe.undergrupper.flatMap((under): Tilleggstekst[] => {
      const element = { id: undergruppeid(gruppe.nokkel, under.nokkel), tittel: gruppenavn(under.nokkel) }
      const sted = { panel: BIVIRKNINGSPANEL, element, detaljkort: gruppeid(gruppe.nokkel) }
      return [
        { ...sted, felt: 'overskrift', tekst: gruppenavn(under.nokkel) },
        ...under.bivirkninger.flatMap((b): Tilleggstekst[] => [
          { ...sted, felt: 'fritekst', tekst: b.tekst },
          ...(b.fotnote ? [{ ...sted, felt: 'fritekst' as const, tekst: b.fotnote }] : []),
        ]),
      ]
    }),
  )
}

/**
 * Visningen et kort i seksjonen hører til, ut fra ID-en (`gruppeid`), så en
 * lenke til en gruppe i den andre visningen bytter visning. `null` når ID-en
 * ikke er en gruppe.
 */
export function visningForKort(id: string | undefined): Visning | null {
  return VISNINGER.find((v) => id?.startsWith(`${v.kode}-`))?.kode ?? null
}
