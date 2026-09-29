/**
 * En stoffside satt sammen av det databasen gir: elementene sortert i
 * panelene sine, referansene nummerert, og rekkefølgen endringene må
 * publiseres i.
 *
 * Alt her er rene funksjoner. Visningen, redigeringen og søket bygger på den
 * samme modellen, så de kan ikke se ulike utgaver av siden.
 */
import type { Regeldata, Stoffsidedata, Utgave } from './lesing'
import type { Innholdselementinnhold, Referanseinnhold } from './modell'
import { FJERNET, PANELREKKEFOLGE, panelFor } from './paneler'
import {
  feltreferanser,
  INGEN_AUTOMATISKE,
  sidereferanser,
  type Automatiskekilder,
  type Nummerering,
  type Referanse,
  type Referanseoppforing,
  type Sidegrunnlag,
} from './referanser'

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
  /** Numrene de redaksjonelle referansene har når siden står uten de automatiske. */
  nummerering: Nummerering
  /** Referanselisten nederst på siden, med bare de redaksjonelle. */
  referanseliste: Referanseoppforing[]
}

/**
 * Hele referanseuniverset på siden: de redaksjonelle og de automatiske
 * referansene nummerert sammen, listen nederst, og hva hvert panels
 * referansefelt viser.
 */
export interface Referanseunivers {
  referanser: Referanse[]
  nummerering: Nummerering
  liste: Referanseoppforing[]
  /** Panelnøkkel → referansene i panelets referansefelt. Paneler uten er utelatt. */
  panelreferanser: Readonly<Record<string, readonly string[]>>
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
export function byggSidemodell(data: Stoffsidedata): Sidemodell {
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

  const panelreferanser = bareKjentePaneler(data.infoside?.innhold.panelreferanser ?? {})
  const referanser = data.referanser.map(tilReferanse)
  const modell = { paneler, panelreferanser, referanser }
  const { nummerering, liste } = referanseunivers(modell)
  return { ...modell, nummerering, referanseliste: liste }
}

function bareKjentePaneler<T>(perPanel: Readonly<Record<string, T>>): Record<string, T> {
  return Object.fromEntries(Object.entries(perPanel).filter(([panel]) => panelFor(panel)))
}

/**
 * Referanseuniverset for siden, med de automatiske referansene fra data
 * OUSFAR henter (se `src/legemiddeldata/referanser.ts`). Som for de
 * redaksjonelle er bare paneler siden kjenner, med.
 */
export function referanseunivers(
  modell: Pick<Sidemodell, 'paneler' | 'panelreferanser' | 'referanser'>,
  automatiske: Automatiskekilder = INGEN_AUTOMATISKE,
): Referanseunivers {
  const side: Sidegrunnlag = {
    panelreferanser: modell.panelreferanser,
    elementer: [...modell.paneler.values()].flat(),
    automatiske: {
      panelreferanser: bareKjentePaneler(automatiske.panelreferanser ?? {}),
      elementer: (automatiske.elementer ?? []).filter((e) => panelFor(e.panel)),
    },
  }
  const referanser = [...modell.referanser, ...automatiske.referanser]
  const { nummerering, liste } = sidereferanser(side, referanser, PANELREKKEFOLGE)
  const panelreferanser = Object.fromEntries(
    PANELREKKEFOLGE.map((panel) => [panel, feltreferanser(side, panel)] as const).filter(([, ider]) => ider.length > 0),
  )
  return { referanser, nummerering, liste, panelreferanser }
}

/* --- Publiseringen -------------------------------------------------------- */

export type Publiseringsslag =
  | 'referanse'
  | 'infoside'
  | 'innholdselement'
  | 'kommentar'
  | 'intervallregelsett'
  | 'scenarioregelsett'
  | 'thc_regelsett'

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

/** Etter ID, så rekkefølgen ikke avhenger av hvordan databasen ga dem. */
function etterId<T extends { id: string }>(liste: readonly T[]): T[] {
  return [...liste].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

/**
 * Det som må publiseres for at stoffsiden og reglene den viser skal bli slik
 * utkastet viser dem, i den rekkefølgen databasen krever: det publiserte kan
 * bare peke på det som også er publisert. Referansene først, så siden og
 * innholdselementene. Til sist regelsettene, hvert etter kommentarene det
 * peker på.
 *
 * `side` og `regler` er utkastet. Bare det som faktisk har upubliserte
 * endringer, er med. Referansene som er med, er dem siden siterer.
 */
export function publiseringsplan(side: Stoffsidedata, regler: Regeldata): Publiseringssteg[] {
  const steg: Publiseringssteg[] = []
  const sett = new Set<string>()
  const legg = (slag: Publiseringsslag, utgave: Utgave<unknown> | null | undefined) => {
    if (!utgave || sett.has(utgave.id) || !upublisert(utgave)) return
    sett.add(utgave.id)
    steg.push({ slag, id: utgave.id, revisjon: utgave.revisjon })
  }
  const leggRegelsett = (
    slag: Publiseringsslag,
    utgave: { regelsett: Utgave<unknown>; kommentarer: Utgave<unknown>[] } | null | undefined,
  ) => {
    for (const kommentar of utgave?.kommentarer ?? []) legg('kommentar', kommentar)
    legg(slag, utgave?.regelsett)
  }

  for (const referanse of side.referanser) legg('referanse', referanse)
  legg('infoside', side.infoside)
  for (const element of etterId(side.elementer)) legg('innholdselement', element)
  for (const kode of Object.keys(regler.regelsett).sort()) leggRegelsett('intervallregelsett', regler.regelsett[kode])
  for (const modul of Object.keys(regler.scenarioregelsett).sort()) {
    leggRegelsett('scenarioregelsett', regler.scenarioregelsett[modul])
  }
  leggRegelsett('thc_regelsett', regler.thcregelsett)
  return steg
}
