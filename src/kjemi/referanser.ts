/**
 * Referansen til PubChem i seksjonen «Kjemiske grunndata», med når dataene
 * sist ble kontrollert mot PubChem. Automatisk, som referansene fra FEST og
 * ClinPGx (`src/faginnhold/referanser.ts`): den lages av det siden har hentet,
 * hver gang siden vises.
 */
import type { Automatiskekilder, Referanse } from '../faginnhold/referanser'
import { dato } from '../legemiddeldata/referanser'
import { KJEMIPANEL, type Kjemivisning } from './stoffside'

export const PUBCHEM = 'PubChem'

/** ID-en til referansen for PubChem selv. */
export const PUBCHEM_KILDE = 'pubchem:kilde'

export const PUBCHEM_NETTSTED = 'https://pubchem.ncbi.nlm.nih.gov/'

/** Adressen til forbindelsen hos PubChem. */
export function pubchemUrl(cid: number): string {
  return `${PUBCHEM_NETTSTED}compound/${cid}`
}

export function pubchemopphav(visning: Pick<Kjemivisning, 'kontrollert_kl'>): string {
  const kontrollert = dato(visning.kontrollert_kl)
  return ['Kjemiske grunndata fra PubChem', kontrollert && `sist kontrollert ${kontrollert}`].filter(Boolean).join(', ')
}

export function pubchemkilde(visning: Pick<Kjemivisning, 'kontrollert_kl'>): Referanse {
  return {
    id: PUBCHEM_KILDE,
    tittel: 'PubChem',
    forfattere: 'National Center for Biotechnology Information',
    aar: '',
    lenke: PUBCHEM_NETTSTED,
    automatisk: { kilde: PUBCHEM, opphav: pubchemopphav(visning) },
  }
}

/** PubChem i referansefeltet til seksjonen, når siden viser data derfra. */
export function pubchemreferanser(visning: Kjemivisning | null): Automatiskekilder {
  if (!visning?.rader.some((r) => r.data)) return { referanser: [] }
  return { referanser: [pubchemkilde(visning)], panelreferanser: { [KJEMIPANEL]: [PUBCHEM_KILDE] } }
}
