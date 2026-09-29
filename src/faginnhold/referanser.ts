/**
 * Referansene på en stoffside: siteringer, nummerering, piller og
 * referanseliste.
 *
 * Siteringene lagrer bare referanse-ID-er. Numrene regnes ut her, hver gang
 * siden vises, etter første forekomst i leserekkefølgen på akkurat den siden.
 * Flyttes et kort eller endres en tekst, blir numrene riktige av seg selv, og
 * samme referanse kan ha nummer 2 på én side og 7 på en annen.
 *
 * Leserekkefølgen er panelrekkefølgen, så kortrekkefølgen i panelet, så
 * forekomsten i innholdet. Referansene som gjelder en hel beholder, kommer
 * etter det som står i den: teksten i kortet før kortets referanser, kortene
 * før panelets — slik de også vises, i referansefeltet nederst i beholderen.
 *
 * Referansene har to opphav i samme univers. De redaksjonelle er objekter i
 * databasen, med historikk, og redigeres i OUSFAR. De automatiske lages av
 * data OUSFAR henter fra andre (FEST, se `src/legemiddeldata/referanser.ts`),
 * med en stabil ID fra kilden: de kan ikke redigeres eller slettes, og
 * forsvinner av seg selv når kilden ikke lenger har dem. Begge nummereres,
 * vises og listes likt.
 *
 * Alt her er rene funksjoner uten DOM og uten database, samme modell som
 * `src/domain/references.ts` i Slaids.
 */
import type { Referanseinnhold } from './modell'

/** Nodetypen for en inline-sitering i rikteksten. Samme navn som i databasen. */
export const SITERING = 'sitering'

/** Skilletegnet i referanseformatet, som i planen. */
const SKILLE = ' · '

/** En lenke som hører til sporbarheten, som lisensen eller bruksvilkårene. */
export interface Opphavslenke {
  tekst: string
  lenke: string
}

/**
 * Hvor en automatisk referanse kommer fra. `kilde` er dataene den er laget av,
 * f.eks. «FEST». `opphav` er sporbarheten — uttrekket og kontrollen — når
 * referansen er selve datakilden; den står for seg, ikke i referanseteksten.
 * `lenker` er det kilden krever lenke til, som lisensen, og står under
 * referansen i listen.
 */
export interface Automatiskopphav {
  kilde: string
  opphav?: string
  lenker?: readonly Opphavslenke[]
}

/**
 * En referanse med den stabile ID-en sin. `automatisk` skiller de automatiske
 * fra de redaksjonelle; uten er referansen redaksjonell.
 */
export interface Referanse extends Referanseinnhold {
  id: string
  automatisk?: Automatiskopphav
}

/** Sant for en referanse som kommer fra data OUSFAR henter, og som ikke kan redigeres. */
export function erAutomatisk(referanse: Pick<Referanse, 'automatisk'>): boolean {
  return referanse.automatisk !== undefined
}

/** Referanse-ID → nummeret den har på siden. */
export type Nummerering = ReadonlyMap<string, number>

/* --- Formatet ------------------------------------------------------------- */

/** «Tittel · Forfatter(e) · År», uten lenken, og uten tomme ledd. */
export function referansetekst(referanse: Referanseinnhold): string {
  return [referanse.tittel, referanse.forfattere, referanse.aar]
    .map((del) => del.trim())
    .filter(Boolean)
    .join(SKILLE)
}

/** Hele referansen: «Tittel · Forfatter(e) · År · Lenke», uten tomme ledd. */
export function formaterReferanse(referanse: Referanseinnhold): string {
  return [referansetekst(referanse), referanse.lenke.trim()].filter(Boolean).join(SKILLE)
}

/* --- Siteringene i innholdet ---------------------------------------------- */

/**
 * ID-ene i en siteringsnode, eller `null` når noden ikke er en sitering.
 * Formen er `{ type: 'sitering', attrs: { referanser: [...] } }`.
 */
function siteringsider(node: Record<string, unknown>): string[] | null {
  if (node.type !== SITERING) return null
  const attrs = node.attrs
  if (!attrs || typeof attrs !== 'object') return []
  const ider = (attrs as Record<string, unknown>).referanser
  return Array.isArray(ider) ? ider.filter((id): id is string => typeof id === 'string') : []
}

/**
 * Inline-siteringene i et innholdselements data, i dokumentrekkefølge. Hver
 * sitering er én gruppe, slik den vises som én pille.
 *
 * Lister gås gjennom i rekkefølge. Feltene i et objekt gås gjennom sortert på
 * navn, så rekkefølgen er den samme uansett hvordan objektet ble bygd — lest
 * fra databasen eller laget i editoren. Rikteksten selv ligger i lister.
 */
export function siteringer(data: unknown): string[][] {
  const grupper: string[][] = []
  const besok = (verdi: unknown): void => {
    if (Array.isArray(verdi)) {
      for (const del of verdi) besok(del)
      return
    }
    if (!verdi || typeof verdi !== 'object') return
    const node = verdi as Record<string, unknown>
    const ider = siteringsider(node)
    if (ider) {
      if (ider.length > 0) grupper.push(ider)
      return
    }
    for (const felt of Object.keys(node).sort()) besok(node[felt])
  }
  besok(data)
  return grupper
}

/* --- Leserekkefølgen på en side ------------------------------------------- */

/** Et innholdselement slik nummereringen trenger det. */
export interface Sideelement {
  id: string
  panel: string
  posisjon: number
  referanser?: readonly string[]
  data: unknown
}

/** Et sted med automatiske referanser, som et detaljkort med en interaksjon fra FEST. */
export interface Automatiskelement {
  panel: string
  id: string
  referanser: readonly string[]
}

/**
 * Det automatiske innholdet på en side siterer. Elementene kommer etter de
 * redaksjonelle i panelet, i den rekkefølgen de står her, og panelreferansene
 * etter panelets redaksjonelle.
 */
export interface Automatiskegrunnlag {
  panelreferanser?: Readonly<Record<string, readonly string[]>>
  elementer?: readonly Automatiskelement[]
}

/** De automatiske referansene på en side, og hvor de siteres. */
export interface Automatiskekilder extends Automatiskegrunnlag {
  referanser: readonly Referanse[]
}

export const INGEN_AUTOMATISKE: Automatiskekilder = { referanser: [] }

/**
 * De automatiske referansene fra flere kilder på samme side, som FEST og
 * ClinPGx, slått sammen: hver referanse én gang, panelreferansene i kildenes
 * rekkefølge og elementene etter hverandre.
 */
export function slaSammenAutomatiske(...kilder: readonly Automatiskekilder[]): Automatiskekilder {
  const referanser = new Map<string, Referanse>()
  const panelreferanser: Record<string, string[]> = {}
  const elementer: Automatiskelement[] = []
  for (const k of kilder) {
    for (const r of k.referanser) if (!referanser.has(r.id)) referanser.set(r.id, r)
    for (const [panel, ider] of Object.entries(k.panelreferanser ?? {})) {
      panelreferanser[panel] = [...new Set([...(panelreferanser[panel] ?? []), ...ider])]
    }
    elementer.push(...(k.elementer ?? []))
  }
  return { referanser: [...referanser.values()], panelreferanser, elementer }
}

/** Det på en side som kan sitere referanser. */
export interface Sidegrunnlag {
  panelreferanser?: Readonly<Record<string, readonly string[]>>
  elementer: readonly Sideelement[]
  automatiske?: Automatiskegrunnlag
}

/** Én forekomst i leserekkefølgen: det som vises som én pille. */
export interface Forekomst {
  panel: string
  /** Elementet forekomsten står i, eller `null` for panelets referanser. */
  element: string | null
  /** Sant når det er automatisk innhold som siterer. */
  automatisk?: boolean
  niva: 'panel' | 'element' | 'inline'
  ider: string[]
}

function sammenlignTekst(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/**
 * Alle forekomstene på siden, i leserekkefølge.
 *
 * `panelrekkefolge` er panelene slik siden viser dem. Paneler som ikke står
 * der, kommer etter, sortert på nøkkelen, så ingenting faller ut og
 * rekkefølgen alltid er den samme. I et panel står kortene etter posisjon og
 * deretter ID — samme rekkefølge som databasen bruker — og så de automatiske.
 * Et kort siterer teksten sin før kortets egne referanser, og panelets
 * referanser kommer etter kortene: referansefeltet står nederst.
 */
export function forekomster(side: Sidegrunnlag, panelrekkefolge: readonly string[] = []): Forekomst[] {
  const panelreferanser = side.panelreferanser ?? {}
  const automatiskePanel = side.automatiske?.panelreferanser ?? {}
  const perPanel = gruppert(side.elementer)
  const automatiskePerPanel = gruppert(side.automatiske?.elementer ?? [])

  const kjente = new Set(panelrekkefolge)
  const ovrige = [
    ...new Set([
      ...Object.keys(panelreferanser),
      ...Object.keys(automatiskePanel),
      ...perPanel.keys(),
      ...automatiskePerPanel.keys(),
    ]),
  ]
    .filter((panel) => !kjente.has(panel))
    .sort(sammenlignTekst)

  const resultat: Forekomst[] = []
  const legg = (forekomst: Forekomst) => {
    if (forekomst.ider.length > 0) resultat.push(forekomst)
  }
  for (const panel of [...new Set(panelrekkefolge), ...ovrige]) {
    const elementer = [...(perPanel.get(panel) ?? [])].sort(
      (a, b) => a.posisjon - b.posisjon || sammenlignTekst(a.id, b.id),
    )
    for (const element of elementer) {
      for (const ider of siteringer(element.data)) legg({ panel, element: element.id, niva: 'inline', ider })
      legg({ panel, element: element.id, niva: 'element', ider: [...(element.referanser ?? [])] })
    }
    for (const element of automatiskePerPanel.get(panel) ?? []) {
      legg({ panel, element: element.id, niva: 'element', ider: [...element.referanser], automatisk: true })
    }
    legg({ panel, element: null, niva: 'panel', ider: [...(panelreferanser[panel] ?? [])] })
    legg({ panel, element: null, niva: 'panel', ider: [...(automatiskePanel[panel] ?? [])], automatisk: true })
  }
  return resultat
}

function gruppert<T extends { panel: string }>(elementer: readonly T[]): Map<string, T[]> {
  const perPanel = new Map<string, T[]>()
  for (const element of elementer) {
    const liste = perPanel.get(element.panel) ?? []
    liste.push(element)
    perPanel.set(element.panel, liste)
  }
  return perPanel
}

/**
 * Referansene et panel viser i referansefeltet sitt: de redaksjonelle først,
 * så de automatiske, uten gjentakelser.
 */
export function feltreferanser(side: Pick<Sidegrunnlag, 'panelreferanser' | 'automatiske'>, panel: string): string[] {
  return [
    ...new Set([...(side.panelreferanser?.[panel] ?? []), ...(side.automatiske?.panelreferanser?.[panel] ?? [])]),
  ]
}

/* --- Nummereringen -------------------------------------------------------- */

/**
 * Numrene på siden: 1 for den første referansen som forekommer, 2 for den
 * neste nye, og så videre. En referanse som går igjen, beholder nummeret fra
 * første gang. ID-er som ikke er blant `kjente` — en referanse brukeren ikke
 * har tilgang til, eller som ikke finnes — får ikke nummer og hopper ikke over
 * noe.
 */
export function nummerer(
  grupper: Iterable<{ ider: readonly string[] } | readonly string[]>,
  kjente?: ReadonlySet<string>,
): Nummerering {
  const numre = new Map<string, number>()
  for (const gruppe of grupper) {
    const ider = 'ider' in gruppe ? gruppe.ider : gruppe
    for (const id of ider) {
      if (numre.has(id) || (kjente && !kjente.has(id))) continue
      numre.set(id, numre.size + 1)
    }
  }
  return numre
}

/**
 * Numrene i en pille, komprimert som i Slaids: sammenhengende serier på minst
 * tre blir et intervall, to på rad står hver for seg. `1, 2, 3, 5, 9, 10, 11`
 * blir «1–3, 5, 9–11».
 */
export function komprimer(numre: Iterable<number>): string {
  const sortert = [...new Set(numre)].sort((a, b) => a - b)
  const deler: string[] = []
  let start = 0
  while (start < sortert.length) {
    let slutt = start
    while (slutt + 1 < sortert.length && sortert[slutt + 1] === sortert[slutt]! + 1) slutt += 1
    if (slutt - start >= 2) deler.push(`${sortert[start]}–${sortert[slutt]}`)
    else for (let i = start; i <= slutt; i += 1) deler.push(String(sortert[i]))
    start = slutt + 1
  }
  return deler.join(', ')
}

/** Numrene en gruppe med ID-er har på siden, stigende og uten gjentakelser. */
export function numreFor(ider: readonly string[], nummerering: Nummerering): number[] {
  const numre = ider.map((id) => nummerering.get(id)).filter((n): n is number => n !== undefined)
  return [...new Set(numre)].sort((a, b) => a - b)
}

/** Teksten i pillen, f.eks. «1–3, 5». Tom når ingen av ID-ene har nummer. */
export function pilletekst(ider: readonly string[], nummerering: Nummerering): string {
  return komprimer(numreFor(ider, nummerering))
}

/* --- Referanselisten ------------------------------------------------------ */

export interface Referanseoppforing {
  nummer: number
  referanse: Referanse
}

/**
 * Referansene i nummerrekkefølge, med nummeret de har. Listen er alltid det
 * nummereringen gir; den redigeres aldri for hånd.
 */
export function referanseoppforinger(
  nummerering: Nummerering,
  referanser: Iterable<Referanse>,
): Referanseoppforing[] {
  const perId = new Map<string, Referanse>()
  for (const referanse of referanser) perId.set(referanse.id, referanse)
  return [...nummerering]
    .flatMap(([id, nummer]) => {
      const referanse = perId.get(id)
      return referanse ? [{ nummer, referanse }] : []
    })
    .sort((a, b) => a.nummer - b.nummer)
}

/**
 * Alt en side trenger for å vise referansene sine: forekomstene i
 * leserekkefølge, numrene og listen nederst. Bare referansene i `referanser`
 * får nummer — det er dem brukeren kan se.
 */
export function sidereferanser(
  side: Sidegrunnlag,
  referanser: readonly Referanse[],
  panelrekkefolge: readonly string[] = [],
) {
  const alle = forekomster(side, panelrekkefolge)
  const nummerering = nummerer(alle, new Set(referanser.map((r) => r.id)))
  return {
    forekomster: alle,
    nummerering,
    liste: referanseoppforinger(nummerering, referanser),
  }
}

/* --- Kortform ------------------------------------------------------------- */

/**
 * En kort betegnelse på referansen, der numrene ennå ikke er regnet ut — i
 * editoren, for eksempel: første forfatters etternavn og året («Nordmann
 * 2021»), ellers begynnelsen av tittelen eller lenken.
 */
export function kortnavn(referanse: Referanseinnhold): string {
  const forste = referanse.forfattere.split(/[,;]/)[0]?.trim() ?? ''
  const etternavn = forste.split(/\s+/)[0] ?? ''
  const aar = referanse.aar.trim()
  if (etternavn) return aar ? `${etternavn} ${aar}` : etternavn
  const tittel = referanse.tittel.trim() || referanse.lenke.trim()
  const kort = tittel.length > 40 ? `${tittel.slice(0, 39)}…` : tittel
  return aar ? `${kort} ${aar}` : kort
}
