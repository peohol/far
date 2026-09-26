/**
 * Referansene som kommer fra CPIC: CPIC selv, med lisensen, releasen og når
 * dataene sist ble kontrollert, og publikasjonene CPIC oppgir for hver
 * retningslinje.
 *
 * De er automatiske, som referansene fra FEST og ClinPGx: de lages av det
 * siden har hentet fra OUSFARs kopi, hver gang siden vises, kan ikke
 * redigeres og lagres aldri som redaksjonelle referanser. En publikasjon
 * ClinPGx alt oppgir på siden (samme PMID eller DOI), får ClinPGx-referansens
 * ID, så den står én gang i referanselisten.
 *
 * Alt her er rene funksjoner.
 */
import type { Automatiskekilder, Automatiskelement, Referanse } from '../faginnhold/referanser'
import { dato } from '../legemiddeldata/referanser'
import type { Litteratur } from '../clinpgx/modell'
import { litteraturId } from '../clinpgx/referanser'
import { FARMAKOGENETIKKPANEL } from '../clinpgx/stoffside'
import type { Cpickilde } from './lesing'
import { CPIC_NETTSTED, pubmedUrl, type Publikasjon } from './modell'
import { cpicversjon, harCpic, type Cpicvisning, type Retningslinjekort } from './stoffside'

/** Kilden de automatiske referansene her kommer fra. */
export const CPIC = 'CPIC'

const PREFIKS = 'cpic:'

/** ID-en til referansen for CPIC selv. */
export const CPIC_KILDE = `${PREFIKS}kilde`

/**
 * Lisensen CPIC-dataene er gitt ut under (`docs/cpic.md`). CPIC ber om å bli
 * kreditert, og om at adressen, datoen og versjonen oppgis.
 */
export const CPIC_LISENS = 'CC0 1.0'

/** Hvor lenge dataene kan stå uten å bli kontrollert før siden sier fra. Synkroniseringen går hver uke. */
export const CPIC_FORELDET_ETTER_DOGN = 10

/** Sporbarheten: kilden, lisensen, releasen og når dataene sist ble kontrollert mot CPIC. */
export function cpicopphav(kilde: Cpickilde): string {
  const kontrollert = dato(kilde.kontrollert_kl ?? kilde.endret_kl)
  return [
    `Strukturerte farmakogenetiske anbefalinger fra ${cpicversjon(kilde, dato)}, lisens ${CPIC_LISENS}`,
    kontrollert && `sist kontrollert ${kontrollert}`,
  ]
    .filter(Boolean)
    .join(', ')
}

export function cpickilde(kilde: Cpickilde): Referanse {
  return {
    id: CPIC_KILDE,
    tittel: 'CPIC – Clinical Pharmacogenetics Implementation Consortium',
    forfattere: '',
    aar: '',
    lenke: CPIC_NETTSTED,
    automatisk: { kilde: CPIC, opphav: cpicopphav(kilde) },
  }
}

/** Meldingen når CPIC-dataene ikke er kontrollert på lenge, ellers `null`. */
export function cpicForeldet(kilde: Pick<Cpickilde, 'kontrollert_kl' | 'endret_kl'>, na: Date = new Date()): string | null {
  const sist = kilde.kontrollert_kl ?? kilde.endret_kl
  if (!sist || Number.isNaN(new Date(sist).getTime())) return null
  if (na.getTime() - new Date(sist).getTime() <= CPIC_FORELDET_ETTER_DOGN * 86_400_000) return null
  return (
    `CPIC-dataene ble sist kontrollert ${dato(sist)}. ` +
    'Den ukentlige oppdateringen har ikke gått siden, så nyere endringer hos CPIC kan mangle.'
  )
}

function publikasjonslenke(p: Publikasjon): string {
  if (p.doi) return `https://doi.org/${p.doi}`
  if (p.pmid) return pubmedUrl(p.pmid)
  return p.url ?? ''
}

export function publikasjonsreferanse(p: Publikasjon): Referanse {
  return {
    id: `${PREFIKS}publikasjon-${p.id}`,
    tittel: p.tittel ?? (p.pmid ? `PMID ${p.pmid}` : 'Publikasjon fra CPIC'),
    forfattere: p.forfattere.length > 3 ? `${p.forfattere.slice(0, 3).join(', ')} mfl.` : p.forfattere.join(', '),
    aar: p.aar === null ? '' : String(p.aar),
    lenke: publikasjonslenke(p),
    automatisk: { kilde: CPIC },
  }
}

/** Samme publikasjon hos ClinPGx: samme PMID eller DOI. */
function iClinpgx(p: Publikasjon, litteratur: readonly Litteratur[]): Litteratur | undefined {
  const doi = p.doi?.toLowerCase()
  return litteratur.find((l) => (p.pmid && l.pmid === p.pmid) || (doi && l.doi?.toLowerCase() === doi))
}

/**
 * Publikasjonene et retningslinjekort siterer, den nyeste først, med ID-en de har på siden. En
 * publikasjon ClinPGx alt oppgir, får ClinPGx-referansens ID og ingen egen
 * referanse; `litteratur` er publikasjonene ClinPGx-dataene på siden oppgir.
 */
export function publikasjonsider(
  kort: Pick<Retningslinjekort, 'retningslinje'>,
  litteratur: readonly Litteratur[],
): { id: string; referanse: Referanse | null }[] {
  const sett = new Map<string, Referanse | null>()
  // Den nyeste først: det er som regel den gjeldende oppdateringen av retningslinjen.
  const publikasjoner = [...kort.retningslinje.publikasjoner].sort((a, b) => (b.aar ?? 0) - (a.aar ?? 0) || a.id.localeCompare(b.id))
  for (const p of publikasjoner) {
    const felles = iClinpgx(p, litteratur)
    const r = felles ? null : publikasjonsreferanse(p)
    const id = felles ? litteraturId(felles) : r!.id
    if (!sett.has(id)) sett.set(id, r)
  }
  return [...sett].map(([id, referanse]) => ({ id, referanse }))
}

/**
 * Alle de automatiske referansene fra CPIC på en side, og hvor de siteres:
 * CPIC i referansefeltet til «Farmakogenetikk», og publikasjonene i
 * detaljkortet til hver retningslinje.
 */
export function cpicreferanser(visning: Cpicvisning | null, litteratur: readonly Litteratur[] = []): Automatiskekilder {
  if (!visning || !harCpic(visning)) return { referanser: [] }
  const referanser = new Map<string, Referanse>([[CPIC_KILDE, cpickilde(visning.kilde)]])
  const elementer: Automatiskelement[] = []
  for (const k of visning.retningslinjer) {
    const publikasjoner = publikasjonsider(k, litteratur)
    for (const { referanse } of publikasjoner) if (referanse && !referanser.has(referanse.id)) referanser.set(referanse.id, referanse)
    if (publikasjoner.length > 0) {
      elementer.push({ panel: FARMAKOGENETIKKPANEL, id: k.kort, referanser: publikasjoner.map((p) => p.id) })
    }
  }
  return {
    referanser: [...referanser.values()],
    panelreferanser: { [FARMAKOGENETIKKPANEL]: [CPIC_KILDE] },
    elementer,
  }
}
