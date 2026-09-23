/**
 * Hvordan innholdet i hver objekttype deles i felt når historikken
 * sammenligner to revisjoner (se `historikk.ts`). Strukturert innhold
 * sammenlignes felt for felt, ikke som én lang tekst.
 */
import { regelsettfelter } from '../regler/visning'
import { jsonfelter, type Felt } from './historikk'
import type { Innhold, Innholdselementinnhold, Objekttype } from './modell'
import { FJERNET, panelFor } from './paneler'
import { formaterReferanse } from './referanser'
import { elementtekster, type Elementtekst } from './sok'

const TEKSTNAVN: Partial<Record<Elementtekst['felt'], string>> = {
  preparat: 'Preparat',
  overskrift: 'Overskrift',
  fritekst: 'Tekst',
  tabell: 'Rad',
  verdi: 'Verdi',
}

function antall(n: number, en: string, flere: string): string {
  return n === 0 ? 'Ingen' : `${n} ${n === 1 ? en : flere}`
}

function elementfelter(innhold: Innholdselementinnhold): Felt[] {
  const panel = innhold.panel === FJERNET ? 'Fjernet fra siden' : (panelFor(innhold.panel)?.tittel ?? innhold.panel)
  const tekster = elementtekster(innhold.elementtype, innhold.data)
  const flere = (felt: Elementtekst['felt']) => tekster.filter((t) => t.felt === felt).length > 1
  const nummer = new Map<string, number>()
  const felter = tekster.map(({ felt, tekst }): Felt => {
    const nr = (nummer.get(felt) ?? 0) + 1
    nummer.set(felt, nr)
    const navn = TEKSTNAVN[felt] ?? felt
    return { nokkel: `${felt}-${nr}`, navn: flere(felt) ? `${navn} ${nr}` : navn, verdi: tekst, tekst: true }
  })
  return [
    { nokkel: 'panel', navn: 'Panel', verdi: panel },
    { nokkel: 'plass', navn: 'Plass i panelet', verdi: String(innhold.posisjon + 1) },
    ...felter,
    { nokkel: 'kilder', navn: 'Kilder for kortet', verdi: antall(innhold.referanser?.length ?? 0, 'kilde', 'kilder') },
  ]
}

const FELTER: { [T in Objekttype]: (innhold: Innhold[T]) => Felt[] } = {
  infoside: (innhold) => [
    { nokkel: 'navn', navn: 'Navn', verdi: innhold.navn },
    ...Object.entries(innhold.panelreferanser ?? {}).map(([nokkel, ider]) => ({
      nokkel: `kilder-${nokkel}`,
      navn: `Kilder for ${panelFor(nokkel)?.tittel ?? nokkel}`,
      verdi: antall(ider.length, 'kilde', 'kilder'),
    })),
  ],
  laboratorieanalytt: (innhold) => jsonfelter(innhold),
  innholdselement: elementfelter,
  referanse: (innhold) => [
    { nokkel: 'referanse', navn: 'Referanse', verdi: formaterReferanse(innhold), tekst: true },
    { nokkel: 'arkivert', navn: 'Arkivert', verdi: innhold.arkivert ? 'Ja' : 'Nei' },
  ],
  intervallregelsett: regelsettfelter,
}

/** Feltene historikken sammenligner for et objekt av typen. */
export function innholdsfelter<T extends Objekttype>(type: T, innhold: Innhold[T]): Felt[] {
  return FELTER[type](innhold)
}
