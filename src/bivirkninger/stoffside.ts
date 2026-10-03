/**
 * Bivirkningene slik seksjonen «Bivirkninger» på fagsiden viser dem: de to
 * visningene av det samme datasettet, tabell for tabell, oppsummeringene, og
 * tekstene søket på siden finner. Alt her er rene funksjoner.
 */
import { antall, ramsOpp } from '../faginnhold/oppsummering'
import type { Tilleggstekst } from '../faginnhold/sok'
import { BIVIRKNINGSPANEL } from './referanser'
import {
  grupper,
  gruppeid,
  gruppenavn,
  tabeller,
  tabellid,
  TABELLFORSTAVELSE,
  undergruppeid,
  VISNINGER,
  type Bivirkningsdata,
  type Gruppe,
  type Tabell,
  type Undergruppe,
  type Visning,
} from './modell'

/**
 * En tabell slik siden viser den, gruppert begge veier. `id` står foran
 * ID-ene til kortene når siden har flere tabeller. `navn` skiller tabellen fra
 * de andre og er `null` når det ikke trengs (én kilde og én tabell uten navn),
 * så seksjonen da er like enkel som om tabellene ikke fantes.
 */
export interface Bivirkningstabell extends Tabell {
  id: string | null
  navn: string | null
  grupper: Readonly<Record<Visning, Gruppe[]>>
}

/** Dataene for siden, delt i tabeller og gruppert begge veier, så det ikke skjer på nytt hver gang visningen byttes. */
export interface Bivirkningsvisning {
  data: Bivirkningsdata
  tabeller: Bivirkningstabell[]
  /** Sant når bivirkningene kommer fra mer enn én kilde; da står kilden ved hver tabell. */
  flereKilder: boolean
}

/** Navnet som skiller en tabell fra de andre: preparatet når kildene er flere, og tabellens navn når den har et. */
function tabellnavn(tabell: Tabell, flereKilder: boolean): string | null {
  const kilde = flereKilder ? (tabell.kilde.preparat ?? tabell.kilde.tittel) : null
  return [kilde, tabell.kontekst?.navn].filter(Boolean).join(' – ') || null
}

export function byggBivirkningsvisning(data: Bivirkningsdata): Bivirkningsvisning {
  const alle = tabeller(data)
  const flereKilder = new Set(alle.map((t) => t.kilde.id)).size > 1
  return {
    data,
    flereKilder,
    tabeller: alle.map((t) => ({
      ...t,
      id: alle.length > 1 ? tabellid(t) : null,
      navn: tabellnavn(t, flereKilder),
      grupper: { frekvens: grupper(t.bivirkninger, 'frekvens'), organsystem: grupper(t.bivirkninger, 'organsystem') },
    })),
  }
}

/**
 * Oppsummeringen av seksjonen: hvor mange bivirkninger og organsystemer, og
 * hvor mange tabeller når de er flere. Den samme i begge visningene.
 */
export function oppsummerBivirkninger(data: Bivirkningsdata): string {
  if (data.bivirkninger.length === 0) return ''
  const organsystemer = new Set(data.bivirkninger.map((b) => b.organsystem)).size
  const antallTabeller = tabeller(data).length
  return ramsOpp([
    antall(data.bivirkninger.length, 'bivirkning', 'bivirkninger'),
    antall(organsystemer, 'organsystem', 'organsystemer'),
    antallTabeller > 1 && antall(antallTabeller, 'tabell', 'tabeller'),
  ])
}

/** Oppsummeringen av en gruppe: kombinasjonene i den, med navnene. */
export function gruppeoppsummering(gruppe: Gruppe): string {
  return ramsOpp(gruppe.undergrupper.map((u) => gruppenavn(u.nokkel)))
}

/** Oppsummeringen av en kombinasjon i lukket kort: bivirkningene, etter hverandre. */
export function undergruppeoppsummering(under: Undergruppe): string {
  return ramsOpp(under.bivirkninger.map((b) => b.tekst))
}

/**
 * Tekstene søket på siden finner i bivirkningene, med kortet de står i i
 * visningen som står: bivirkningene, fotnotene og navnene på kombinasjonene.
 */
export function bivirkningstekster(visning: Bivirkningsvisning, valgt: Visning): Tilleggstekst[] {
  return visning.tabeller.flatMap((tabell) =>
    tabell.grupper[valgt].flatMap((gruppe) =>
      gruppe.undergrupper.flatMap((under): Tilleggstekst[] => {
        const element = { id: undergruppeid(gruppe.nokkel, under.nokkel, tabell.id), tittel: gruppenavn(under.nokkel) }
        const sted = { panel: BIVIRKNINGSPANEL, element, detaljkort: gruppeid(gruppe.nokkel, tabell.id) }
        return [
          { ...sted, felt: 'overskrift', tekst: gruppenavn(under.nokkel) },
          ...under.bivirkninger.flatMap((b): Tilleggstekst[] => [
            { ...sted, felt: 'fritekst', tekst: b.tekst },
            ...(b.fotnote ? [{ ...sted, felt: 'fritekst' as const, tekst: b.fotnote }] : []),
          ]),
        ]
      }),
    ),
  )
}

/**
 * Visningen et kort i seksjonen hører til, ut fra ID-en (`gruppeid`, med
 * eller uten tabellen foran), så en lenke til en gruppe i den andre visningen
 * bytter visning. `null` når ID-en ikke er en gruppe.
 */
export function visningForKort(id: string | undefined): Visning | null {
  const kort = id?.replace(TABELLFORSTAVELSE, '')
  return VISNINGER.find((v) => kort?.startsWith(`${v.kode}-`))?.kode ?? null
}
