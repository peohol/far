/**
 * En analyttside satt sammen av det databasen gir: elementene sortert i
 * panelene sine, referansene nummerert, og rekkefølgen endringene må
 * publiseres i.
 *
 * Alt her er rene funksjoner. Visningen, redigeringen og søket bygger på den
 * samme modellen, så de kan ikke se ulike utgaver av siden.
 */
import type { Analyttsidedata, Utgave } from './lesing'
import type { Innholdselementinnhold, Referanseinnhold } from './modell'
import { FJERNET, PANELREKKEFOLGE, panelFor } from './paneler'
import { sidereferanser, type Nummerering, type Referanse, type Referanseoppforing } from './referanser'

/** Et innholdselement på siden. */
export interface Sideelement {
  id: string
  panel: string
  posisjon: number
  elementtype: string
  data: Record<string, unknown>
  referanser: string[]
  utgave: Utgave<Innholdselementinnhold>
}

export interface Sidemodell {
  /** Elementene per panel, i rekkefølge. Bare panelene siden har. */
  paneler: ReadonlyMap<string, Sideelement[]>
  /** Referansene som gjelder et helt panel. */
  panelreferanser: Readonly<Record<string, readonly string[]>>
  /** Referansene siden kan vise, med ID. */
  referanser: Referanse[]
  nummerering: Nummerering
  /** Referanselisten nederst på siden. */
  referanseliste: Referanseoppforing[]
}

function sammenlign(a: Sideelement, b: Sideelement): number {
  return a.posisjon - b.posisjon || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
}

export function tilReferanse(utgave: Utgave<Referanseinnhold>): Referanse {
  return { ...utgave.innhold, id: utgave.id }
}

/**
 * Modellen for siden. Elementer i paneler siden ikke har — også de som er
 * fjernet — er ikke med, verken i panelene eller i nummereringen.
 */
export function byggSidemodell(data: Analyttsidedata): Sidemodell {
  const paneler = new Map<string, Sideelement[]>()
  for (const utgave of data.elementer) {
    const { panel, posisjon, elementtype, data: innhold, referanser } = utgave.innhold
    if (panel === FJERNET || !panelFor(panel)) continue
    const liste = paneler.get(panel) ?? []
    liste.push({
      id: utgave.id,
      panel,
      posisjon,
      elementtype,
      data: innhold ?? {},
      referanser: referanser ?? [],
      utgave,
    })
    paneler.set(panel, liste)
  }
  for (const liste of paneler.values()) liste.sort(sammenlign)

  const panelreferanser = Object.fromEntries(
    Object.entries(data.infoside?.innhold.panelreferanser ?? {}).filter(([panel]) => panelFor(panel)),
  )
  const referanser = data.referanser.map(tilReferanse)
  const { nummerering, liste } = sidereferanser(
    { panelreferanser, elementer: [...paneler.values()].flat() },
    referanser,
    PANELREKKEFOLGE,
  )

  return { paneler, panelreferanser, referanser, nummerering, referanseliste: liste }
}

/* --- Publiseringen -------------------------------------------------------- */

export type Publiseringsslag =
  | 'referanse'
  | 'komponent'
  | 'infoside'
  | 'laboratorieanalytt'
  | 'innholdselement'
  | 'kommentar'
  | 'intervallregelsett'

export interface Publiseringssteg {
  slag: Publiseringsslag
  id: string
  /** Revisjonen som publiseres — utkastet slik brukeren så det. */
  revisjon: number
}

/** Sant når utkastet har endringer som ikke er publisert. */
export function upublisert(utgave: Utgave<unknown>): boolean {
  return utgave.publisert_revisjon !== utgave.revisjon
}

/**
 * Det som må publiseres for at siden skal bli slik utkastet viser den, i den
 * rekkefølgen databasen krever: det publiserte kan bare peke på det som også
 * er publisert. Referansene først, så sidene — komponentsidene før
 * hovedsiden — så laboratorieanalytten og innholdselementene. Til sist
 * kommentarene regelsettet peker på, og så regelsettet.
 *
 * `data` er utkastet. Bare det som faktisk har upubliserte endringer, er med.
 * Referansene som er med, er dem siden siterer.
 */
export function publiseringsplan(data: Analyttsidedata): Publiseringssteg[] {
  const steg: Publiseringssteg[] = []
  const sett = new Set<string>()
  const legg = (slag: Publiseringsslag, utgave: Utgave<unknown> | null) => {
    if (!utgave || sett.has(utgave.id) || !upublisert(utgave)) return
    sett.add(utgave.id)
    steg.push({ slag, id: utgave.id, revisjon: utgave.revisjon })
  }

  for (const referanse of data.referanser) legg('referanse', referanse)
  for (const komponent of data.komponenter) {
    if (komponent.id !== data.infoside?.id) legg('komponent', komponent)
  }
  legg('infoside', data.infoside)
  legg('laboratorieanalytt', data.analytt)
  for (const element of [...data.elementer].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    legg('innholdselement', element)
  }
  for (const kommentar of data.regelsett?.kommentarer ?? []) legg('kommentar', kommentar)
  legg('intervallregelsett', data.regelsett?.regelsett ?? null)
  return steg
}
