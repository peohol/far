/**
 * Referansene som kommer fra ClinPGx: ClinPGx selv, med lisensen og når
 * dataene sist ble hentet, og publikasjonene ClinPGx oppgir for hver
 * retningslinje og preparatomtale.
 *
 * De er automatiske, som referansene fra FEST (`src/legemiddeldata/referanser.ts`):
 * de lages av det siden har hentet fra OUSFARs kopi, hver gang siden vises,
 * kan ikke redigeres og lagres aldri som redaksjonelle referanser. ID-en til en
 * publikasjon er en kontrollsum av tittelen og lenken, så samme publikasjon
 * får samme nummer uansett hvor mange kort som viser til den.
 *
 * Alt her er rene funksjoner.
 */
import type { Automatiskekilder, Automatiskelement, Referanse } from '../faginnhold/referanser'
import { dato, kontrollsum } from '../legemiddeldata/referanser'
import type { Farmakogenetikkutvalg } from './lesing'
import { CLINPGX_NETTSTED, type Litteratur } from './modell'
import {
  annotasjonskort,
  CLINPGX_FORELDET_ETTER_DOGN,
  FARMAKOGENETIKKPANEL,
  sistHentet,
  type Farmakogenetikkvisning,
} from './stoffside'

/** Kilden de automatiske referansene her kommer fra. */
export const CLINPGX = 'ClinPGx'

const PREFIKS = 'clinpgx:'

/** ID-en til referansen for ClinPGx selv. */
export const CLINPGX_KILDE = `${PREFIKS}kilde`

/** Lisensen ClinPGx-dataene er gitt ut under, og hvor den står. */
export const CLINPGX_LISENS = 'CC BY-SA 4.0'
export const CLINPGX_LISENSLENKE = 'https://creativecommons.org/licenses/by-sa/4.0/'

/**
 * Sporbarheten for kopien siden viser: kilden, lisensen og når dataene sist
 * ble hentet. Lisensen krever at ClinPGx navngis og at lisensen oppgis.
 */
export function clinpgxopphav(utvalg: Pick<Farmakogenetikkutvalg, 'kjemikalier'>): string {
  const hentet = dato(sistHentet(utvalg))
  return [`Farmakogenetiske data fra ClinPGx, lisens ${CLINPGX_LISENS}`, hentet && `sist hentet ${hentet}`]
    .filter(Boolean)
    .join(', ')
}

/** Referansen for ClinPGx selv. */
export function clinpgxkilde(utvalg: Pick<Farmakogenetikkutvalg, 'kjemikalier'>): Referanse {
  return {
    id: CLINPGX_KILDE,
    tittel: 'ClinPGx – PharmGKB, CPIC og PharmCAT',
    forfattere: 'Stanford University',
    aar: '',
    lenke: CLINPGX_NETTSTED,
    automatisk: { kilde: CLINPGX, opphav: clinpgxopphav(utvalg) },
  }
}

/**
 * Meldingen når dataene ikke er hentet fra ClinPGx på lenge, ellers `null`.
 * Gjelder den eldste hentingen blant sidens kjemikalier.
 */
export function clinpgxForeldet(
  utvalg: Pick<Farmakogenetikkutvalg, 'kjemikalier'>,
  na: Date = new Date(),
): string | null {
  const hentet = sistHentet(utvalg)
  if (!hentet) return null
  if (na.getTime() - new Date(hentet).getTime() <= CLINPGX_FORELDET_ETTER_DOGN * 86_400_000) return null
  return (
    `Dataene fra ClinPGx ble sist hentet ${dato(hentet)}. ` +
    'Den ukentlige oppdateringen har ikke gått siden, så nyere endringer i ClinPGx kan mangle.'
  )
}

/** Den stabile ID-en til en publikasjon ClinPGx oppgir. */
export function litteraturId(l: Pick<Litteratur, 'tittel' | 'lenke'>): string {
  return `${PREFIKS}${kontrollsum(`${l.tittel.replace(/\s+/g, ' ').trim()}\n${l.lenke ?? ''}`)}`
}

export function litteraturreferanse(l: Litteratur): Referanse {
  return {
    id: litteraturId(l),
    tittel: l.tittel,
    forfattere: '',
    aar: l.aar === null ? '' : String(l.aar),
    lenke: l.lenke ?? '',
    automatisk: { kilde: CLINPGX },
  }
}

/** Referanse-ID-ene til publikasjonene en annotasjon viser til, uten gjentakelser. */
export function litteraturreferanser(a: { litteratur: readonly Litteratur[] }): string[] {
  return [...new Set(a.litteratur.map(litteraturId))]
}

/**
 * Alle de automatiske referansene fra ClinPGx på en side, og hvor de siteres:
 * ClinPGx i referansefeltet til «Farmakogenetikk», og publikasjonene i
 * detaljkortet til hver retningslinje og preparatomtale. Uten hentede data
 * er det ingen.
 */
export function clinpgxreferanser(
  utvalg: Farmakogenetikkutvalg | null,
  visning: Farmakogenetikkvisning | null,
): Automatiskekilder {
  if (!utvalg || !visning || utvalg.kjemikalier.length === 0) return { referanser: [] }
  const referanser = new Map<string, Referanse>([[CLINPGX_KILDE, clinpgxkilde(utvalg)]])
  const elementer: Automatiskelement[] = []
  for (const a of [...visning.retningslinjer, ...visning.preparatomtaler]) {
    for (const l of a.litteratur) {
      const r = litteraturreferanse(l)
      if (!referanser.has(r.id)) referanser.set(r.id, r)
    }
    const ider = litteraturreferanser(a)
    if (ider.length > 0) elementer.push({ panel: FARMAKOGENETIKKPANEL, id: annotasjonskort(a.id), referanser: ider })
  }
  return {
    referanser: [...referanser.values()],
    panelreferanser: { [FARMAKOGENETIKKPANEL]: [CLINPGX_KILDE] },
    elementer,
  }
}
