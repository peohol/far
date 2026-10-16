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
import type { Bivirkningsdata } from '../bivirkninger/modell'
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
  const ut: Felt[] = []
  if (side.infoside) {
    for (const felt of innholdsfelter('infoside', side.infoside.innhold)) {
      ut.push({ ...felt, nokkel: `side:${felt.nokkel}`, gruppe: SIDEN })
    }
  }

  for (const kort of sidensKort(side)) {
    const gruppe = kortnavn(kort.innhold)
    for (const felt of innholdsfelter('innholdselement', kort.innhold)) {
      if (felt.nokkel === 'kilder') continue
      ut.push({ ...felt, nokkel: `${kort.id}:${felt.nokkel}`, gruppe })
    }
    const navn = (kort.innhold.referanser ?? []).map((id) => kilder.get(id) ?? 'Ukjent kilde')
    ut.push({ nokkel: `${kort.id}:kildene`, navn: 'Kilder', verdi: navn.join('\n') || 'Ingen', gruppe, tekst: true })
  }

  for (const kilde of bivirkninger?.kilder ?? []) {
    const rader = bivirkninger!.bivirkninger.filter((b) => b.kilde === kilde.id)
    const omtale = [kilde.tittel, kilde.spc_versjon, kilde.revisjonsdato].filter(Boolean).join(' · ')
    ut.push(
      { nokkel: `biv:${kilde.nokkel}`, navn: 'Preparatomtalen', verdi: omtale, gruppe: BIVIRKNINGER },
      {
        nokkel: `biv:${kilde.nokkel}:rader`,
        navn: `Bivirkningene (${rader.length})`,
        verdi: rader.map((b) => b.tekst).join(', '),
        gruppe: BIVIRKNINGER,
        tekst: true,
      },
    )
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
