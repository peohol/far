/**
 * Referansene som kommer fra legemiddeldataene: FEST selv, som kilden til
 * preparatene og interaksjonene, og referansene DMP oppgir for hver
 * interaksjon.
 *
 * De er automatiske (se `src/faginnhold/referanser.ts`): de lages her av det
 * siden har hentet fra OUSFARs kopi av FEST, hver gang siden vises, og lagres
 * aldri som redaksjonelle referanser. ID-en er stabil og kommer fra kilden —
 * teksten og lenken DMP har gitt referansen — så samme referanse får samme
 * nummer uansett hvor mange interaksjoner som viser til den. Når FEST ikke
 * lenger har den, forsvinner den ved neste synkronisering, uten at noen må
 * slette den.
 *
 * Alt her er rene funksjoner.
 */
import type { Automatiskekilder, Automatiskelement, Referanse } from '../faginnhold/referanser'
import { PANELER, type Panelform } from '../faginnhold/paneler'
import type { Interaksjon, Interaksjonsoversikt } from './interaksjoner'
import type { Legemiddelutvalg } from './lesing'

/** Kilden de automatiske referansene her kommer fra. */
export const FEST = 'FEST'

/** Forstavelsen på ID-ene, så de aldri kan forveksles med en redaksjonell referanse. */
const PREFIKS = 'fest:'

/** ID-en til referansen for FEST selv. */
export const FEST_KILDE = `${PREFIKS}kilde`

const DATO = new Intl.DateTimeFormat('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' })

/** Et tidspunkt som dato på norsk, «11. september 2026». `null` når det mangler eller ikke kan leses. */
export function dato(tidspunkt: string | null): string | null {
  if (!tidspunkt) return null
  const d = new Date(tidspunkt)
  return Number.isNaN(d.getTime()) ? null : DATO.format(d)
}

/**
 * Sporbarheten for kopien siden viser: uttrekket den bygger på, og når den
 * sist ble kontrollert mot FEST. NLOD krever at kilden oppgis.
 */
export function festopphav(utvalg: Pick<Legemiddelutvalg, 'kildedato' | 'kontrollert_kl'>): string {
  const uttrekk = dato(utvalg.kildedato)
  const kontrollert = dato(utvalg.kontrollert_kl)
  return [
    'Legemiddeldata fra FEST',
    uttrekk && `uttrekk fra ${uttrekk}`,
    kontrollert && `sist kontrollert ${kontrollert}`,
  ]
    .filter(Boolean)
    .join(', ')
}

/**
 * Hvor lenge kopien kan stå uten en vellykket kontroll mot FEST før siden sier
 * fra. Synkroniseringen går hver natt, så etter to døgn har minst én natt
 * feilet eller ikke gått.
 */
export const FEST_FORELDET_ETTER_TIMER = 48

/**
 * Meldingen når kopien ikke er kontrollert mot FEST på lenge, ellers `null`.
 * `kontrollert_kl` er siste synkronisering som gikk bra, så både en
 * synkronisering som feiler og en som ikke kjører, gir meldingen.
 */
export function festForeldet(
  utvalg: Pick<Legemiddelutvalg, 'kontrollert_kl'>,
  na: Date = new Date(),
): string | null {
  const kontrollert = utvalg.kontrollert_kl ? new Date(utvalg.kontrollert_kl) : null
  if (!kontrollert || Number.isNaN(kontrollert.getTime())) return null
  if (na.getTime() - kontrollert.getTime() <= FEST_FORELDET_ETTER_TIMER * 3_600_000) return null
  return (
    `Legemiddeldataene ble sist kontrollert mot FEST ${dato(utvalg.kontrollert_kl)}. ` +
    'Den nattlige oppdateringen har ikke gått siden, så nyere endringer i FEST kan mangle.'
  )
}

/** Referansen for FEST selv, med sporbarheten for kopien. */
export function festkilde(utvalg: Pick<Legemiddelutvalg, 'kildedato' | 'kontrollert_kl'>): Referanse {
  return {
    id: FEST_KILDE,
    tittel: 'FEST – Forskrivnings- og ekspedisjonsstøtte',
    forfattere: 'Direktoratet for medisinske produkter',
    aar: '',
    lenke: '',
    automatisk: { kilde: FEST, opphav: festopphav(utvalg) },
  }
}

/** Mellomrom samlet, så samme referanse skrevet litt ulikt får samme ID. */
function normalisert(tekst: string): string {
  return tekst.replace(/\s+/g, ' ').trim()
}

/**
 * En kort, stabil kontrollsum av teksten (cyrb53). Den skal bare skille
 * referansene på én side fra hverandre, ikke være hemmelig. Brukes også av
 * de automatiske referansene fra ClinPGx.
 */
export function kontrollsum(tekst: string): string {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < tekst.length; i += 1) {
    const tegn = tekst.charCodeAt(i)
    h1 = Math.imul(h1 ^ tegn, 2654435761)
    h2 = Math.imul(h2 ^ tegn, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
}

type Interaksjonsreferanse = Interaksjon['referanser'][number]

/** Den stabile ID-en til en referanse DMP oppgir for en interaksjon. */
export function interaksjonsreferanseId(referanse: Interaksjonsreferanse): string {
  return `${PREFIKS}${kontrollsum(`${normalisert(referanse.kilde)}\n${referanse.lenke ?? ''}`)}`
}

/**
 * En interaksjonsreferanse som referanse. DMP gir bare én tekst og kanskje en
 * lenke; teksten blir tittelen, og står den bare som lenken, vises lenken én gang.
 */
export function interaksjonsreferanse(referanse: Interaksjonsreferanse): Referanse {
  const kilde = normalisert(referanse.kilde)
  const lenke = referanse.lenke ?? ''
  return {
    id: interaksjonsreferanseId(referanse),
    tittel: kilde === lenke ? '' : kilde,
    forfattere: '',
    aar: '',
    lenke,
    automatisk: { kilde: FEST },
  }
}

/** Referansene DMP har gitt en tekst eller lenke; tomme hoppes over. */
function utfylte(interaksjon: Pick<Interaksjon, 'referanser'>): Interaksjonsreferanse[] {
  return interaksjon.referanser.filter((r) => normalisert(r.kilde) || r.lenke)
}

/** Referanse-ID-ene en interaksjon viser til, i DMPs rekkefølge og uten gjentakelser. */
export function interaksjonsreferanser(interaksjon: Pick<Interaksjon, 'referanser'>): string[] {
  return [...new Set(utfylte(interaksjon).map(interaksjonsreferanseId))]
}

/** Stedet på siden for en interaksjon: detaljkortet, og ankeret inne i det. */
export function interaksjonssted(interaksjon: Pick<Interaksjon, 'id'>): string {
  return `interaksjon-${interaksjon.id}`
}

/** Panelet med en gitt form, slik `PANELER` har det. */
function panelMedForm(form: Panelform): string | undefined {
  return PANELER.find((p) => p.form === form)?.nokkel
}

/**
 * Alle de automatiske referansene fra legemiddeldataene på en side, og hvor
 * de siteres: FEST i referansefeltet til preparatene og interaksjonene, og
 * DMPs referanser i hvert detaljkort med en interaksjon. Uten hentede data
 * er det ingen.
 */
export function festreferanser(
  utvalg: Legemiddelutvalg | null,
  interaksjoner: Interaksjonsoversikt | null,
): Automatiskekilder {
  if (!utvalg) return { referanser: [] }
  const referanser = new Map<string, Referanse>([[FEST_KILDE, festkilde(utvalg)]])
  const panelreferanser: Record<string, string[]> = {}
  const elementer: Automatiskelement[] = []

  const preparater = panelMedForm('legemidler')
  if (preparater) panelreferanser[preparater] = [FEST_KILDE]

  const interaksjonspanel = panelMedForm('interaksjoner')
  if (interaksjoner && interaksjonspanel) {
    for (const interaksjon of interaksjoner.interaksjoner) {
      for (const r of utfylte(interaksjon)) {
        const referanse = interaksjonsreferanse(r)
        if (!referanser.has(referanse.id)) referanser.set(referanse.id, referanse)
      }
      elementer.push({
        panel: interaksjonspanel,
        id: interaksjonssted(interaksjon),
        referanser: interaksjonsreferanser(interaksjon),
      })
    }
    panelreferanser[interaksjonspanel] = [FEST_KILDE]
  }
  return { referanser: [...referanser.values()], panelreferanser, elementer }
}
