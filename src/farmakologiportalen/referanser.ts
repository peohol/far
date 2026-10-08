/**
 * Referansen til Farmakologiportalen i seksjonen «Analyse ved norske
 * laboratorier», med når dataene sist ble kontrollert mot portalen.
 * Automatisk, som referansene fra FEST, ClinPGx og PubChem
 * (`src/faginnhold/referanser.ts`): den lages av det siden har hentet, hver
 * gang siden vises.
 */
import type { Automatiskekilder, Referanse } from '../faginnhold/referanser'
import { dato } from '../legemiddeldata/referanser'
import { FP_NETTSTED } from './api'
import { LABPANEL, type Labvisning } from './stoffside'

export const FARMAKOLOGIPORTALEN = 'Farmakologiportalen'

/** ID-en til referansen for portalen selv. */
export const FP_KILDE = 'farmakologiportalen:kilde'

export function fpopphav(visning: Pick<Labvisning, 'kontrollert_kl'>): string {
  const kontrollert = dato(visning.kontrollert_kl)
  return ['Laboratorieanalyser fra Farmakologiportalen', kontrollert && `sist kontrollert ${kontrollert}`].filter(Boolean).join(', ')
}

export function fpkilde(visning: Pick<Labvisning, 'kontrollert_kl'>): Referanse {
  return {
    id: FP_KILDE,
    tittel: 'Farmakologiportalen',
    // Eier og drifter portalen (farmakologiportalen.no/om-portalen).
    forfattere: 'Norsk forening for klinisk farmakologi',
    aar: '',
    lenke: `${FP_NETTSTED}/`,
    automatisk: { kilde: FARMAKOLOGIPORTALEN, opphav: fpopphav(visning) },
  }
}

/** Portalen i referansefeltet til seksjonen, når siden viser analyser derfra. */
export function fpreferanser(visning: Labvisning | null): Automatiskekilder {
  if (!visning?.tabeller.length) return { referanser: [] }
  return { referanser: [fpkilde(visning)], panelreferanser: { [LABPANEL]: [FP_KILDE] } }
}
