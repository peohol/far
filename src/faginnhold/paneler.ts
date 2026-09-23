/**
 * Panelene på en informasjonsside og innholdet i dem.
 *
 * Siden er bygd av sju paneler i fast rekkefølge (planen i
 * `docs/analyttsider-og-redigering.md`, del 4). Hvert panel har en form som
 * avgjør hvilke innholdselementer det har, og hver elementtype har en fast
 * form på `data`. Formene står her og ingen andre steder: visningen,
 * redigeringen, søket og nummereringen av referansene leser dem herfra.
 *
 * Det som er data, lagres som data. Referanseområder, halveringstider og
 * serumkonsentrasjoner er strukturerte felt, ikke fritekst; preparatnavnene
 * er en liste. Riktekst brukes til det som faktisk er prosa.
 *
 * Alt som leses fra databasen, går gjennom `les…`-funksjonene her før det
 * brukes. De tåler manglende og feilformede felt, så en side aldri faller
 * sammen av et element som ikke ser ut som ventet.
 */
import { rensDokument, tomtDokument, type Riktekstdokument } from './riktekst'

/* --- Panelene ------------------------------------------------------------- */

/**
 * Hvordan et panel er bygd:
 *
 * - `identitet` — koden, kategorien, navnet og preparatnavnene.
 * - `datakort` — faste kort med ett tall eller område hver.
 * - `tekst` — én riktekst.
 * - `kort` — en ordnet serie kort med overskrift og riktekst.
 * - `tabell` — én tabell med faste kolonner.
 */
export type Panelform = 'identitet' | 'datakort' | 'tekst' | 'kort' | 'tabell'

export interface Paneldefinisjon {
  nokkel: string
  tittel: string
  form: Panelform
}

export const PANELER = [
  { nokkel: 'identitet', tittel: 'Identitet', form: 'identitet' },
  { nokkel: 'viktige_data', tittel: 'Viktige data', form: 'datakort' },
  { nokkel: 'farmakodynamikk', tittel: 'Farmakodynamikk', form: 'tekst' },
  { nokkel: 'dosering', tittel: 'Dosering', form: 'tekst' },
  { nokkel: 'indikasjon', tittel: 'Indikasjon', form: 'tekst' },
  { nokkel: 'farmakokinetikk', tittel: 'Farmakokinetikk', form: 'kort' },
  { nokkel: 'serumkonsentrasjoner', tittel: 'Serumkonsentrasjoner ved ulike doser', form: 'tabell' },
] as const satisfies readonly Paneldefinisjon[]

export type Panelnokkel = (typeof PANELER)[number]['nokkel']

/** Panelene i den rekkefølgen siden viser dem — også rekkefølgen referansene nummereres i. */
export const PANELREKKEFOLGE: readonly string[] = PANELER.map((p) => p.nokkel)

const PANEL_PER_NOKKEL = new Map<string, Paneldefinisjon>(PANELER.map((p) => [p.nokkel, p]))

export function panelFor(nokkel: string): Paneldefinisjon | undefined {
  return PANEL_PER_NOKKEL.get(nokkel)
}

/**
 * Panelet et innholdselement flyttes til når det fjernes fra siden.
 *
 * Et objekt slettes aldri — historikken skal kunne vise og gjenopprette alt.
 * Et kort som tas bort, legges derfor her, utenfor sidens paneler. Det vises
 * ikke, søkes ikke i og telles ikke med i nummereringen av referansene.
 */
export const FJERNET = 'fjernet'

/* --- Elementtypene -------------------------------------------------------- */

export const ELEMENTTYPER = {
  preparater: 'preparater',
  riktekst: 'riktekst',
  kinetikk: 'kinetikkort',
  dosetabell: 'dosetabell',
} as const

/* Panel 1: preparatnavnene. */

export interface Preparatdata {
  /** Preparatnavnene, hvert for seg. Vises alltid alfabetisk. */
  navn: string[]
}

/** Norsk alfabetisk rekkefølge, uten hensyn til store og små bokstaver. */
export function alfabetisk(a: string, b: string): number {
  return a.localeCompare(b, 'nb', { sensitivity: 'base' })
}

/** Navnene renset: uten tomme, uten gjentakelser, alfabetisk. */
export function ryddPreparater(navn: readonly string[]): string[] {
  const sett = new Map<string, string>()
  for (const n of navn.map((x) => x.trim()).filter(Boolean)) {
    const nokkel = n.toLocaleLowerCase('nb')
    if (!sett.has(nokkel)) sett.set(nokkel, n)
  }
  return [...sett.values()].sort(alfabetisk)
}

export function lesPreparater(data: unknown): Preparatdata {
  const navn = erObjekt(data) && Array.isArray(data.navn) ? data.navn : []
  return { navn: ryddPreparater(navn.filter((n): n is string => typeof n === 'string')) }
}

/* Panel 2: datakortene. */

/**
 * Et tall eller et område med enhet. `nedre` og `ovre` er `null` når de ikke
 * er oppgitt; begge oppgitt er et område, én av dem er en grense. Forbehold
 * lagres for seg og vises under tallet.
 */
export interface Intervallverdi {
  nedre: number | null
  ovre: number | null
  enhet: string
  forbehold: string
}

export interface Datakortdefinisjon {
  /** Elementtypen kortet lagres som. */
  type: string
  tittel: string
  /**
   * Kortform ved siden av tittelen, f.eks. «t½». Det som står etter `_`,
   * er senket skrift: «t_ss» vises som t med «ss» senket.
   */
  symbol?: string
}

/** Kortene i panelet «Viktige data», i den rekkefølgen de står. */
export const DATAKORT = [
  { type: 'referanseomrade', tittel: 'Referanseområde' },
  { type: 'toksisk_omrade', tittel: 'Toksisk område' },
  { type: 'alvorlig_intoksikasjon', tittel: 'Alvorlig/dødelig intoksikasjon' },
  { type: 'halveringstid', tittel: 'Halveringstid', symbol: 't½' },
  { type: 'steady_state', tittel: 'Tid til steady state', symbol: 't_ss' },
] as const satisfies readonly Datakortdefinisjon[]

const DATAKORT_PER_TYPE = new Map<string, Datakortdefinisjon>(DATAKORT.map((k) => [k.type, k]))

export function datakortFor(type: string): Datakortdefinisjon | undefined {
  return DATAKORT_PER_TYPE.get(type)
}

export const TOM_INTERVALLVERDI: Intervallverdi = { nedre: null, ovre: null, enhet: '', forbehold: '' }

function tallEllerNull(verdi: unknown): number | null {
  return typeof verdi === 'number' && Number.isFinite(verdi) ? verdi : null
}

function tekst(verdi: unknown): string {
  return typeof verdi === 'string' ? verdi.trim() : ''
}

export function lesIntervallverdi(data: unknown): Intervallverdi {
  if (!erObjekt(data)) return { ...TOM_INTERVALLVERDI }
  return {
    nedre: tallEllerNull(data.nedre),
    ovre: tallEllerNull(data.ovre),
    enhet: tekst(data.enhet),
    forbehold: tekst(data.forbehold),
  }
}

export function harVerdi(verdi: Intervallverdi): boolean {
  return verdi.nedre !== null || verdi.ovre !== null
}

const TALLFORMAT = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 6 })

/** Et tall på norsk form: desimalkomma og hardt mellomrom mellom tusener. */
export function formaterTall(tall: number): string {
  return TALLFORMAT.format(tall)
}

/**
 * Verdien slik kortet viser den: «10–300 nmol/L», eller «fra 10» og
 * «opptil 300» når bare den ene grensen er oppgitt. Tom når ingen er det.
 *
 * Formuleringene sier bevisst ikke om grensen er med eller ikke — det er ikke
 * lagret, og skal ikke leses inn i tallet.
 */
export function formaterIntervall(verdi: Intervallverdi): string {
  const { nedre, ovre, enhet } = verdi
  let tall: string
  if (nedre !== null && ovre !== null) {
    tall = nedre === ovre ? formaterTall(nedre) : `${formaterTall(nedre)}–${formaterTall(ovre)}`
  } else if (nedre !== null) tall = `fra ${formaterTall(nedre)}`
  else if (ovre !== null) tall = `opptil ${formaterTall(ovre)}`
  else return ''
  return enhet ? `${tall} ${enhet}` : tall
}

/**
 * Et tall slik det tastes: komma eller punktum som desimaltegn, mellomrom
 * mellom tusener. `null` for et tomt felt, `undefined` for noe som ikke er
 * et tall.
 */
export function lesTallfelt(tekst: string): number | null | undefined {
  const renset = tekst.replace(/[\s\u00a0\u202f]/g, '').replace(',', '.')
  if (renset === '') return null
  if (!/^-?\d+(\.\d+)?$/.test(renset)) return undefined
  return Number(renset)
}

/** Et tall slik det står i et felt som skal redigeres. */
export function tallTilFelt(tall: number | null): string {
  return tall === null ? '' : String(tall).replace('.', ',')
}

/** Feilen i en verdi som skal lagres, eller `null` når den er gyldig. */
export function kontrollerIntervall(verdi: Intervallverdi): string | null {
  if (verdi.nedre !== null && verdi.ovre !== null && verdi.nedre > verdi.ovre) {
    return 'Nedre grense kan ikke være høyere enn øvre.'
  }
  if (harVerdi(verdi) && !verdi.enhet) return 'Oppgi enheten.'
  if (!harVerdi(verdi) && verdi.enhet) return 'Oppgi minst én grense, eller fjern enheten.'
  return null
}

/* Panel 3–5: riktekst. */

export interface Rikteksdata {
  dokument: Riktekstdokument
}

export function lesRiktekst(data: unknown): Rikteksdata {
  return { dokument: rensDokument(erObjekt(data) ? data.dokument : undefined) }
}

/* Panel 6: farmakokinetikken, kort for kort. */

export interface Kinetikkdata {
  tittel: string
  dokument: Riktekstdokument
}

export function lesKinetikk(data: unknown): Kinetikkdata {
  if (!erObjekt(data)) return { tittel: '', dokument: tomtDokument() }
  return { tittel: tekst(data.tittel), dokument: rensDokument(data.dokument) }
}

/* Panel 7: serumkonsentrasjonene. */

/** Én rad i tabellen over serumkonsentrasjoner ved ulike doser. */
export interface Doserad {
  dose: string
  regime: string
  konsentrasjon: string
  merknad: string
}

/** Kolonnene i tabellen, i den rekkefølgen de står. */
export const DOSEKOLONNER = [
  { felt: 'dose', tittel: 'Dose' },
  { felt: 'regime', tittel: 'Doseringsregime' },
  { felt: 'konsentrasjon', tittel: 'Serumkonsentrasjon' },
  { felt: 'merknad', tittel: 'Betingelser og merknader' },
] as const satisfies readonly { felt: keyof Doserad; tittel: string }[]

export interface Dosetabelldata {
  rader: Doserad[]
}

export function tomDoserad(): Doserad {
  return { dose: '', regime: '', konsentrasjon: '', merknad: '' }
}

function erTomRad(rad: Doserad): boolean {
  return DOSEKOLONNER.every(({ felt }) => rad[felt] === '')
}

export function lesDosetabell(data: unknown): Dosetabelldata {
  const rader = erObjekt(data) && Array.isArray(data.rader) ? data.rader : []
  return {
    rader: rader
      .filter(erObjekt)
      .map((rad) => ({
        dose: tekst(rad.dose),
        regime: tekst(rad.regime),
        konsentrasjon: tekst(rad.konsentrasjon),
        merknad: tekst(rad.merknad),
      }))
      .filter((rad) => !erTomRad(rad)),
  }
}

/* --- Felles --------------------------------------------------------------- */

function erObjekt(verdi: unknown): verdi is Record<string, unknown> {
  return typeof verdi === 'object' && verdi !== null && !Array.isArray(verdi)
}
