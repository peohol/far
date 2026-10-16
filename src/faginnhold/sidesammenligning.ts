/**
 * Sammenligningen av to utgaver av en hel fagside: en versjon mot den
 * gjeldende, eller en kurateringsgren mot versjonen den bygger på.
 *
 * Hele siden deles i felt med de samme reglene som historikken bruker for ett
 * objekt (`innholdsfelter`), gruppert per kort, og sammenlignes felt for felt
 * (`sammenlignFelter`). Kortene kjennes igjen på ID-en, så et kort som er
 * flyttet, står som flyttet og ikke som fjernet og nytt. Kildene til et kort
 * står med navnene, og bivirkningene per preparatomtale.
 */
import { frekvens, FREKVENSER, INGEN_BIVIRKNINGER, organsystem, ORGANSYSTEMER, tabeller, type Bivirkning, type Bivirkningsdata } from '../bivirkninger/modell'
import { sammenlignFelter, type Felt, type Feltendring } from './historikk'
import { innholdsfelter } from './innholdsfelter'
import type { Stoffsidedata } from './lesing'
import type { Innholdselementinnhold } from './modell'
import { FJERNET, PANELER, panelFor } from './paneler'
import { formaterReferanse } from './referanser'

/** En utgave av siden slik sammenligningen ser den. */
export interface Sideutgave {
  side: Stoffsidedata
  bivirkninger?: Bivirkningsdata
}

const SIDEN = 'Siden'
const BIVIRKNINGER = 'Bivirkninger fra preparatomtalene'
const PANELPLASS = new Map<string, number>(PANELER.map((p, i) => [p.nokkel, i]))
const ORGANPLASS = new Map<string, number>(ORGANSYSTEMER.map((o, i) => [o.kode, i]))
const FREKVENSPLASS = new Map<string, number>(FREKVENSER.map((f, i) => [f.kode, i]))

/** Én bivirkning med alt som skiller den fra en annen: organsystemet, frekvensen, teksten og fotnoten. */
const bivirkningslinje = (b: Bivirkning) => `${organsystem(b.organsystem).navn} · ${frekvens(b.frekvens).navn}: ${b.tekst}${b.fotnote ? ` (${b.fotnote})` : ''}`

/** I tabellens rekkefølge, så en flyttet rad også er en endring. */
const iRekkefolge = (a: Bivirkning, b: Bivirkning) =>
  (ORGANPLASS.get(a.organsystem) ?? 0) - (ORGANPLASS.get(b.organsystem) ?? 0) ||
  (FREKVENSPLASS.get(a.frekvens) ?? 0) - (FREKVENSPLASS.get(b.frekvens) ?? 0) ||
  a.posisjon - b.posisjon

/** Navnet på et kort på siden, som «Dosering · kort 1». */
export function kortnavn(innhold: Pick<Innholdselementinnhold, 'panel' | 'posisjon'>): string {
  return `${panelFor(innhold.panel)?.tittel ?? innhold.panel} · kort ${innhold.posisjon + 1}`
}

/** Kortene på siden i sidens rekkefølge: panelene, så plassen. Fjernede kort er utelatt. */
export function sidensKort(side: Stoffsidedata): Stoffsidedata['elementer'] {
  return side.elementer
    .filter((e) => e.innhold.panel !== FJERNET)
    .sort(
      (a, b) =>
        (PANELPLASS.get(a.innhold.panel) ?? PANELER.length) - (PANELPLASS.get(b.innhold.panel) ?? PANELER.length) ||
        a.innhold.posisjon - b.innhold.posisjon ||
        a.id.localeCompare(b.id),
    )
}

/** Feltene på hele siden, i sidens rekkefølge. */
export function sidefelter({ side, bivirkninger }: Sideutgave): Felt[] {
  const kilder = new Map(side.referanser.map((r) => [r.id, formaterReferanse(r.innhold)]))
  // Kildene står med navnene, så en kilde som byttes ut med en annen, er en endring.
  const kildenavn = (ider: readonly string[] = []) => ider.map((id) => kilder.get(id) ?? 'Ukjent kilde').join('\n') || 'Ingen'
  const ut: Felt[] = []
  if (side.infoside) {
    const panelkilder = side.infoside.innhold.panelreferanser ?? {}
    for (const felt of innholdsfelter('infoside', side.infoside.innhold)) {
      const panel = felt.nokkel.startsWith('kilder-') ? felt.nokkel.slice('kilder-'.length) : null
      ut.push({
        ...felt,
        ...(panel === null ? {} : { verdi: kildenavn(panelkilder[panel]), tekst: true }),
        nokkel: `side:${felt.nokkel}`,
        gruppe: SIDEN,
      })
    }
  }

  for (const kort of sidensKort(side)) {
    const gruppe = kortnavn(kort.innhold)
    for (const felt of innholdsfelter('innholdselement', kort.innhold)) {
      if (felt.nokkel === 'kilder') continue
      ut.push({ ...felt, nokkel: `${kort.id}:${felt.nokkel}`, gruppe })
    }
    ut.push({ nokkel: `${kort.id}:kildene`, navn: 'Kilder', verdi: kildenavn(kort.innhold.referanser), gruppe, tekst: true })
  }

  for (const kilde of bivirkninger?.kilder ?? []) {
    const omtale = [kilde.tittel, kilde.spc_versjon, kilde.revisjonsdato].filter(Boolean).join(' · ')
    ut.push({ nokkel: `biv:${kilde.nokkel}`, navn: 'Preparatomtalen', verdi: omtale, gruppe: BIVIRKNINGER })
  }
  // Én linje per bivirkning, per tabell, så en endret frekvens, et nytt
  // organsystem, en fotnote eller en ny plass vises, ikke bare en ny tekst.
  for (const { kilde, kontekst, bivirkninger: rader } of tabeller(bivirkninger ?? INGEN_BIVIRKNINGER)) {
    const tabell = kontekst ? [kontekst.navn, kontekst.frekvensgrunnlag].filter(Boolean).join(', ') : null
    ut.push({
      nokkel: `biv:${kilde.nokkel}:${kontekst ? `tabell:${kontekst.nokkel}` : 'rader'}`,
      navn: `Bivirkningene${tabell ? ` (${tabell})` : ''}: ${rader.length}`,
      verdi: [...rader].sort(iRekkefolge).map(bivirkningslinje).join('\n'),
      gruppe: BIVIRKNINGER,
      tekst: true,
    })
  }
  return ut
}

/** Forskjellene fra `for_` til `etter`, felt for felt. */
export function sammenlignSider(for_: Sideutgave, etter: Sideutgave): Feltendring[] {
  return sammenlignFelter(sidefelter(for_), sidefelter(etter))
}

/** Hvor mange felt som er endret, lagt til eller fjernet. */
export function antallForskjeller(endringer: readonly Feltendring[]): number {
  return endringer.filter((e) => e.endret).length
}
