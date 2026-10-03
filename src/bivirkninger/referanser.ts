/**
 * Kildene til bivirkningene som automatiske referanser (se
 * `src/faginnhold/referanser.ts`): hver preparatomtale siden har bivirkninger
 * fra, står i referansefeltet til seksjonen «Bivirkninger», med sporbarheten —
 * versjonen, revisjonsdatoen, når den ble importert og kontrollert — for seg
 * under referansen. De lages av dataene hver gang siden vises, kan ikke
 * redigeres, og forsvinner når kilden erstattes eller trekkes tilbake.
 *
 * Alt her er rene funksjoner.
 */
import type { Automatiskekilder, Referanse } from '../faginnhold/referanser'
import { dato } from '../legemiddeldata/referanser'
import type { Panelnokkel } from '../faginnhold/paneler'
import type { Bivirkningsdata, Bivirkningskilde } from './modell'

/** Panelet bivirkningene står i. */
export const BIVIRKNINGSPANEL = 'bivirkninger' satisfies Panelnokkel

/** Navnet på kilden de automatiske referansene her kommer fra. */
export const PREPARATOMTALE = 'Preparatomtale (SPC)'

/** ID-en til referansen for en kilde. Forstavelsen skiller den fra de redaksjonelle. */
export function bivirkningsreferanseId(kilde: Pick<Bivirkningskilde, 'id'>): string {
  return `bivirkning:${kilde.id}`
}

/** Sporbarheten for en kilde: versjonen, revisjonen, importen og kontrollen, med merknaden til slutt. */
export function bivirkningsopphav(kilde: Bivirkningskilde): string {
  const revidert = dato(kilde.revisjonsdato)
  const importert = dato(kilde.importert_kl)
  const kontrollert = dato(kilde.kontrollert)
  return [
    kilde.spc_versjon && `versjon ${kilde.spc_versjon}`,
    revidert && `revidert ${revidert}`,
    importert && `importert ${importert}${kilde.importert_av ? ` av ${kilde.importert_av}` : ''}`,
    kontrollert && `kontrollert ${kontrollert}${kilde.kontrollert_av ? ` av ${kilde.kontrollert_av}` : ''}`,
    kilde.merknad,
  ]
    .filter(Boolean)
    .join(', ')
}

/** En kilde som referanse. */
export function bivirkningsreferanse(kilde: Bivirkningskilde): Referanse {
  return {
    id: bivirkningsreferanseId(kilde),
    tittel: kilde.tittel,
    forfattere: kilde.innehaver ?? '',
    aar: kilde.revisjonsdato?.slice(0, 4) ?? '',
    lenke: kilde.lenke ?? '',
    automatisk: { kilde: PREPARATOMTALE, opphav: bivirkningsopphav(kilde) },
  }
}

/** Referansene for kildene siden viser bivirkninger fra, i referansefeltet til seksjonen. */
export function bivirkningsreferanser(data: Bivirkningsdata | null): Automatiskekilder {
  if (!data || data.kilder.length === 0) return { referanser: [] }
  const referanser = data.kilder.map(bivirkningsreferanse)
  return { referanser, panelreferanser: { [BIVIRKNINGSPANEL]: referanser.map((r) => r.id) } }
}
