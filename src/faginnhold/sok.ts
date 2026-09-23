/**
 * Søket i faginnholdet.
 *
 * Det finnes to søk (planen, del 17): søket på den åpne siden, som finner og
 * fremhever tekst der den står, og — senere — søket i hele kunnskapsbasen,
 * som finner sider og peker til riktig nivå, f.eks. «Sertralin ›
 * Farmakokinetikk › Metabolisme».
 *
 * Begge bygger på det samme her:
 *
 * - {@link indekserSide} gjør én side om til søkedokumenter: ett per tekst,
 *   med stedet det står (siden, panelet, kortet) og hva slags felt det er.
 *   Det globale søket indekserer alle publiserte sider på samme måte og slår
 *   sammen dokumentene; ingenting her vet om én eller mange sider.
 * - {@link sok} finner dokumentene der alle ordene i søket står, rangert, med
 *   et utdrag rundt treffet.
 * - {@link treffIntervaller} finner ordene i en tekst, som fremhevingen
 *   på siden bruker.
 *
 * Sammenligningen ser bort fra store og små bokstaver og aksenter, og leser
 * æ, ø og å som a, o og a — som søket etter analytter i `src/domain/search.ts`.
 * Hvert tegn gjøres om til nøyaktig ett tegn, så treffene kan pekes tilbake
 * på den opprinnelige teksten.
 */
import type { Sidemodell, Sideelement } from './analyttside'
import {
  DATAKORT,
  DOSEKOLONNER,
  ELEMENTTYPER,
  PANELREKKEFOLGE,
  datakortFor,
  formaterIntervall,
  lesDosetabell,
  lesIntervallverdi,
  lesKinetikk,
  lesRiktekst,
  panelFor,
} from './paneler'
import { formaterReferanse } from './referanser'
import { klartekst } from './riktekst'

/* --- Sammenligningen ------------------------------------------------------ */

const ERSTATNINGER: Record<string, string> = { æ: 'a', ø: 'o', å: 'a' }

function foldTegn(tegn: string): string {
  const liten = tegn.toLowerCase()
  const erstattet = ERSTATNINGER[liten]
  if (erstattet) return erstattet
  const uten = liten.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  return uten.length === 1 ? uten : liten.length === 1 ? liten : tegn
}

/** Teksten slik søket sammenligner den. Like lang som originalen, tegn for tegn. */
export function fold(tekst: string): string {
  let ut = ''
  for (const tegn of tekst) ut += tegn.length === 1 ? foldTegn(tegn) : tegn
  return ut
}

/** Ordene i et søk, slik de sammenlignes. */
export function sokeord(sporring: string): string[] {
  return [...new Set(fold(sporring).split(/\s+/).filter(Boolean))]
}

/**
 * Hvor ordene står i teksten, som [start, slutt) i originalen, sortert og
 * uten overlapp.
 */
export function treffIntervaller(tekst: string, ord: readonly string[]): [number, number][] {
  if (ord.length === 0 || !tekst) return []
  const foldet = fold(tekst)
  const intervaller: [number, number][] = []
  for (const o of ord) {
    let fra = foldet.indexOf(o)
    while (fra !== -1) {
      intervaller.push([fra, fra + o.length])
      fra = foldet.indexOf(o, fra + o.length)
    }
  }
  intervaller.sort((a, b) => a[0] - b[0] || b[1] - a[1])
  const samlet: [number, number][] = []
  for (const [start, slutt] of intervaller) {
    const siste = samlet[samlet.length - 1]
    if (siste && start <= siste[1]) siste[1] = Math.max(siste[1], slutt)
    else samlet.push([start, slutt])
  }
  return samlet
}

/* --- Dokumentene ---------------------------------------------------------- */

/** Hva slags tekst et dokument er. Avgjør hvor sterkt et treff teller. */
export type Sokefelt =
  | 'navn'
  | 'kode'
  | 'komponent'
  | 'preparat'
  | 'overskrift'
  | 'verdi'
  | 'fritekst'
  | 'tabell'
  | 'referanse'

/** Hvor sterkt et treff i feltet teller; lavere er bedre. */
const VEKT: Record<Sokefelt, number> = {
  kode: 0,
  navn: 0,
  komponent: 1,
  preparat: 1,
  overskrift: 2,
  verdi: 3,
  tabell: 4,
  fritekst: 5,
  referanse: 6,
}

/** Hvor en tekst står, fra siden og innover. */
export interface Sokested {
  side: { kode: string; navn: string }
  panel?: { nokkel: string; tittel: string }
  /** Kortet teksten står i, med overskriften når kortet har en. */
  element?: { id: string; tittel?: string }
}

export interface Sokedokument {
  sted: Sokested
  felt: Sokefelt
  tekst: string
}

/** Stien til stedet, f.eks. «Sertralin › Farmakokinetikk › Metabolisme». */
export function sti(sted: Sokested): string[] {
  return [sted.side.navn, sted.panel?.tittel, sted.element?.tittel].filter((d): d is string => !!d)
}

/** Det siden er, uavhengig av innholdet i panelene. */
export interface Sideidentitet {
  kode: string
  navn: string
  /** Stoffene analysen omfatter. */
  komponenter: readonly string[]
  /** Andre navn siden er kjent under. */
  aliaser?: readonly string[]
}

/** Én tekst i et innholdselement, med hva slags felt det er og kortets overskrift. */
export interface Elementtekst {
  felt: Sokefelt
  tekst: string
  tittel?: string
}

/**
 * Tekstene i et innholdselement, slik de leses: fritekst uten formatering,
 * radene i tabellen og verdien i et datakort. Tomme tekster er utelatt.
 * Søket og historikken bruker de samme.
 */
export function elementtekster(elementtype: string, data: unknown): Elementtekst[] {
  const tekst = (felt: Sokefelt, t: string, tittel?: string): Elementtekst[] =>
    t.trim() ? [{ felt, tekst: t, ...(tittel && { tittel }) }] : []

  switch (elementtype) {
    case ELEMENTTYPER.riktekst:
      return tekst('fritekst', klartekst(lesRiktekst(data).dokument))
    case ELEMENTTYPER.kinetikk: {
      const { tittel, dokument } = lesKinetikk(data)
      return [...tekst('overskrift', tittel, tittel), ...tekst('fritekst', klartekst(dokument), tittel)]
    }
    case ELEMENTTYPER.dosetabell:
      return lesDosetabell(data).rader.flatMap((rad) =>
        tekst('tabell', DOSEKOLONNER.map(({ felt }) => rad[felt]).filter(Boolean).join(' · ')),
      )
    default: {
      const kort = datakortFor(elementtype)
      if (!kort) return []
      const verdi = lesIntervallverdi(data)
      return tekst('verdi', [formaterIntervall(verdi), verdi.forbehold].filter(Boolean).join(' — '), kort.tittel)
    }
  }
}

function elementdokumenter(side: Sokested['side'], element: Sideelement): Sokedokument[] {
  const panelDef = panelFor(element.panel)
  const panel = panelDef && { nokkel: panelDef.nokkel, tittel: panelDef.tittel }
  return elementtekster(element.elementtype, element.data).map(({ felt, tekst, tittel }) => ({
    sted: { side, ...(panel && { panel }), element: { id: element.id, ...(tittel && { tittel }) } },
    felt,
    tekst,
  }))
}

/**
 * Tekst som står i et panel uten å være faginnhold på siden, som preparatene
 * fra legemiddeldataene. `element` er stedet teksten står, med ankeret
 * `elementAnker(id)` på siden.
 */
export interface Tilleggstekst {
  panel: string
  element: { id: string; tittel?: string }
  felt: Sokefelt
  tekst: string
}

/**
 * Søkedokumentene for én side: navnet, koden, komponentene og aliasene, og
 * alt innholdet i panelene — overskrifter, verdier, tabeller og fritekst —
 * sammen med tilleggstekstene, panel for panel. Referansene siden bruker, er
 * med som egne dokumenter.
 */
export function indekserSide(
  identitet: Sideidentitet,
  modell: Sidemodell,
  tillegg: readonly Tilleggstekst[] = [],
): Sokedokument[] {
  const side = { kode: identitet.kode, navn: identitet.navn }
  const dokumenter: Sokedokument[] = [
    { sted: { side }, felt: 'navn', tekst: identitet.navn },
    { sted: { side }, felt: 'kode', tekst: identitet.kode },
    ...identitet.komponenter.map((tekst): Sokedokument => ({ sted: { side }, felt: 'komponent', tekst })),
    ...(identitet.aliaser ?? []).map((tekst): Sokedokument => ({ sted: { side }, felt: 'navn', tekst })),
  ]

  const perPanel = new Map<string, Sokedokument[]>()
  const iPanel = (panel: string) => perPanel.get(panel) ?? perPanel.set(panel, []).get(panel)!

  // Datakortene står i fast rekkefølge, resten i den rekkefølgen panelet har.
  const datakortplass = new Map<string, number>(DATAKORT.map((k, i) => [k.type, i]))
  for (const [panel, elementer] of modell.paneler) {
    const ordnet = [...elementer].sort(
      (a, b) => (datakortplass.get(a.elementtype) ?? 0) - (datakortplass.get(b.elementtype) ?? 0),
    )
    for (const element of ordnet) iPanel(panel).push(...elementdokumenter(side, element))
  }
  for (const { panel, element, felt, tekst } of tillegg) {
    const definisjon = panelFor(panel)
    if (!definisjon || !tekst.trim()) continue
    iPanel(panel).push({ sted: { side, panel: { nokkel: panel, tittel: definisjon.tittel }, element }, felt, tekst })
  }
  for (const [, panel] of [...perPanel].sort(([a], [b]) => panelplass(a) - panelplass(b))) dokumenter.push(...panel)

  for (const { referanse } of modell.referanseliste) {
    dokumenter.push({ sted: { side }, felt: 'referanse', tekst: formaterReferanse(referanse) })
  }
  return dokumenter
}

function panelplass(nokkel: string): number {
  const plass = PANELREKKEFOLGE.indexOf(nokkel)
  return plass === -1 ? Number.MAX_SAFE_INTEGER : plass
}

/* --- Søket ---------------------------------------------------------------- */

/** Tegn på hver side av treffet i utdraget. */
const UTDRAGSLENGDE = 60

export interface Utdrag {
  /** Teksten, med `…` der den er kuttet. */
  tekst: string
  /** Treffene i utdraget, som [start, slutt). */
  treff: [number, number][]
}

export interface Soketreff {
  dokument: Sokedokument
  utdrag: Utdrag
  poeng: number
}

/** Et kort utdrag rundt det første treffet. */
export function utdrag(tekst: string, ord: readonly string[]): Utdrag {
  const flat = tekst.replace(/\s+/g, ' ').trim()
  const alle = treffIntervaller(flat, ord)
  const forste = alle[0]
  if (!forste) return { tekst: flat.slice(0, UTDRAGSLENGDE * 2), treff: [] }
  const start = Math.max(0, forste[0] - UTDRAGSLENGDE)
  const slutt = Math.min(flat.length, forste[1] + UTDRAGSLENGDE)
  const foran = start > 0 ? '…' : ''
  const bak = slutt < flat.length ? '…' : ''
  const flytt = foran.length - start
  return {
    tekst: `${foran}${flat.slice(start, slutt)}${bak}`,
    treff: alle
      .filter(([a, b]) => a >= start && b <= slutt)
      .map(([a, b]): [number, number] => [a + flytt, b + flytt]),
  }
}

/**
 * Dokumentene der alle ordene i søket står, best først: treff i navn og kode
 * foran treff i fritekst, og treff som begynner et ord foran treff inne i et.
 */
export function sok(dokumenter: readonly Sokedokument[], sporring: string, maks = 50): Soketreff[] {
  const ord = sokeord(sporring)
  if (ord.length === 0) return []
  const treff: Soketreff[] = []
  for (const dokument of dokumenter) {
    const foldet = fold(dokument.tekst)
    if (!ord.every((o) => foldet.includes(o))) continue
    const ordstart = ord.every((o) => new RegExp(`(^|[^\\p{L}\\p{N}])${escape(o)}`, 'u').test(foldet))
    treff.push({ dokument, utdrag: utdrag(dokument.tekst, ord), poeng: VEKT[dokument.felt] * 2 + (ordstart ? 0 : 1) })
  }
  return treff.sort((a, b) => a.poeng - b.poeng).slice(0, maks)
}

function escape(tekst: string): string {
  return tekst.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
