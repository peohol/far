/**
 * Panelene på en informasjonsside og innholdet i dem.
 *
 * Siden er bygd av panelene i fast rekkefølge (`docs/ux-reimagination.md`,
 * del 8): identiteten, viktige data, og så seksjonene. Hvert panel har en form som
 * avgjør hvilke innholdselementer det har, og hver elementtype har en fast
 * form på `data`. Formene står her og ingen andre steder: visningen,
 * redigeringen, søket og nummereringen av referansene leser dem herfra.
 *
 * Det som er data, lagres som data. Referanseområder, halveringstider og
 * serumkonsentrasjoner er strukturerte felt, ikke fritekst. Riktekst brukes
 * til det som faktisk er prosa. Preparatene er ikke OUSFARs eget innhold: de
 * kommer fra legemiddeldataene (`src/legemiddeldata/`), og det som lagres her,
 * er bare hvilke virkestoff siden er koblet til.
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
 * - `identitet` — koden, kategorien og navnet.
 * - `legemidler` — preparatene fra legemiddeldataene, etter koblingen siden har.
 * - `interaksjoner` — interaksjonene i legemiddeldataene, for de samme preparatene.
 * - `datakort` — faste kort med ett tall eller område hver.
 * - `tekst` — én riktekst.
 * - `kort` — en ordnet serie kort med overskrift og riktekst.
 * - `tabell` — én tabell med faste kolonner.
 */
export type Panelform = 'identitet' | 'legemidler' | 'interaksjoner' | 'datakort' | 'tekst' | 'kort' | 'tabell'

export interface Paneldefinisjon {
  nokkel: string
  tittel: string
  form: Panelform
}

/**
 * Panelene i den rekkefølgen siden viser dem. Identiteten og viktige data står
 * alltid fram øverst og er ikke seksjoner; tittelen på viktige data vises
 * ikke, men brukes av skjermlesere, søket og publiseringen.
 */
export const PANELER = [
  { nokkel: 'identitet', tittel: 'Identitet', form: 'identitet' },
  { nokkel: 'viktige_data', tittel: 'Viktige data', form: 'datakort' },
  { nokkel: 'farmakodynamikk', tittel: 'Farmakodynamikk', form: 'tekst' },
  { nokkel: 'indikasjon', tittel: 'Indikasjon', form: 'tekst' },
  { nokkel: 'preparater', tittel: 'Preparater', form: 'legemidler' },
  { nokkel: 'dosering', tittel: 'Dosering', form: 'tekst' },
  { nokkel: 'farmakokinetikk', tittel: 'Farmakokinetikk', form: 'kort' },
  { nokkel: 'farmakogenetikk', tittel: 'Farmakogenetikk', form: 'kort' },
  { nokkel: 'interaksjoner', tittel: 'Interaksjoner', form: 'interaksjoner' },
  { nokkel: 'tdm', tittel: 'Terapeutisk legemiddelmonitorering (TDM)', form: 'kort' },
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
  legemiddelkobling: 'legemiddelkobling',
  clinpgxkobling: 'clinpgxkobling',
  riktekst: 'riktekst',
  kinetikk: 'kinetikkort',
  dosetabell: 'dosetabell',
} as const

/* Panelet «Preparater»: koblingen til legemiddeldataene. */

/** Et virkestoff i legemiddeldataene, med FESTs ID og navnet det hadde da det ble valgt. */
export interface KobletVirkestoff {
  fest_id: string
  navn: string
}

/**
 * Virkestoffene siden viser preparatene for. Koblingen er til FESTs ID, ikke
 * til navnet; navnet er med så koblingen kan leses også om stoffet forsvinner
 * fra FEST.
 */
export interface Legemiddelkoblingdata {
  virkestoff: KobletVirkestoff[]
}

/** Norsk alfabetisk rekkefølge, uten hensyn til store og små bokstaver. */
export function alfabetisk(a: string, b: string): number {
  return a.localeCompare(b, 'nb', { sensitivity: 'base' })
}

export function lesLegemiddelkobling(data: unknown): Legemiddelkoblingdata {
  const liste = erObjekt(data) && Array.isArray(data.virkestoff) ? data.virkestoff : []
  const sett = new Map<string, KobletVirkestoff>()
  for (const v of liste.filter(erObjekt)) {
    const fest_id = tekst(v.fest_id)
    if (fest_id && !sett.has(fest_id)) sett.set(fest_id, { fest_id, navn: tekst(v.navn) })
  }
  return { virkestoff: [...sett.values()] }
}

/* Panelet «Farmakogenetikk»: koblingen til ClinPGx. */

/** Et kjemikalie i ClinPGx, med ClinPGx' accession-ID og navnet det hadde da det ble valgt. */
export interface KobletKjemikalie {
  clinpgx_id: string
  navn: string
}

/**
 * Kjemikaliene i ClinPGx siden viser farmakogenetikken for. Koblingen er til
 * ClinPGx' stabile ID (PA…), ikke til navnet; navnet er med så koblingen kan
 * leses også om kjemikaliet forsvinner fra ClinPGx.
 */
export interface Clinpgxkoblingdata {
  kjemikalier: KobletKjemikalie[]
}

export function lesClinpgxkobling(data: unknown): Clinpgxkoblingdata {
  const liste = erObjekt(data) && Array.isArray(data.kjemikalier) ? data.kjemikalier : []
  const sett = new Map<string, KobletKjemikalie>()
  for (const k of liste.filter(erObjekt)) {
    const clinpgx_id = tekst(k.clinpgx_id)
    if (/^PA\d+$/.test(clinpgx_id) && !sett.has(clinpgx_id)) sett.set(clinpgx_id, { clinpgx_id, navn: tekst(k.navn) })
  }
  return { kjemikalier: [...sett.values()] }
}

/* «Viktige data»: datakortene. */

/**
 * Et tall eller et område med enhet: konsentrasjonskortene. `nedre` og `ovre`
 * er `null` når de ikke er oppgitt; begge oppgitt er et område, én av dem er
 * en grense.
 *
 * `forbehold` er en tekst som tidligere sto under tallet. Den vises og
 * redigeres ikke lenger, og migrasjonen `viktige_data_former` tok den bort
 * fra de publiserte kortene; den leses fortsatt fordi importen av
 * Psykofarmaka (`import.ts`) skrev den.
 */
export interface Intervallverdi {
  nedre: number | null
  ovre: number | null
  enhet: string
  forbehold: string
}

/**
 * Gruppene kortene i «Viktige data» står i, i rekkefølge: konsentrasjonene i
 * serum for seg, de kinetiske nøkkeltallene for seg.
 */
export const DATAKORTGRUPPER = [
  { nokkel: 'konsentrasjon', tittel: 'Konsentrasjoner i serum' },
  { nokkel: 'kinetikk', tittel: 'Kinetikk' },
] as const

export type Datakortgruppe = (typeof DATAKORTGRUPPER)[number]['nokkel']

export interface Datakortdefinisjon {
  /** Elementtypen kortet lagres som. */
  type: string
  tittel: string
  gruppe: Datakortgruppe
  /**
   * Formen på verdien: ett tall eller område (`intervall`, se
   * {@link Intervallverdi}), eller typisk verdi, minimum og maksimum for én
   * eller flere legemiddelformer (`formvis`, se {@link Formverdier}).
   */
  verdi: 'intervall' | 'formvis'
  /**
   * Symbolet kortet vises med, f.eks. t₁/₂. Det som står etter `_`, er senket
   * skrift: «t_ss» vises som t med «ss» senket. Tittelen er fortsatt det
   * skjermlesere leser.
   */
  symbol?: string
}

/** Kortene i panelet «Viktige data», i den rekkefølgen de står. */
export const DATAKORT = [
  { type: 'referanseomrade', tittel: 'Referanseområde', gruppe: 'konsentrasjon', verdi: 'intervall' },
  { type: 'toksisk_omrade', tittel: 'Toksisk område', gruppe: 'konsentrasjon', verdi: 'intervall' },
  { type: 'alvorlig_intoksikasjon', tittel: 'Alvorlig/dødelig intoksikasjon', gruppe: 'konsentrasjon', verdi: 'intervall' },
  { type: 'halveringstid', tittel: 'Halveringstid', gruppe: 'kinetikk', symbol: 't_1/2', verdi: 'formvis' },
  { type: 'steady_state', tittel: 'Tid til steady state', gruppe: 'kinetikk', symbol: 't_ss', verdi: 'formvis' },
] as const satisfies readonly Datakortdefinisjon[]

export type Datakorttype = (typeof DATAKORT)[number]['type']

const DATAKORT_PER_TYPE = new Map<string, Datakortdefinisjon>(DATAKORT.map((k) => [k.type, k]))

export function datakortFor(type: string): Datakortdefinisjon | undefined {
  return DATAKORT_PER_TYPE.get(type)
}

/**
 * Analyttkoden et datakort gjelder, på en side flere koder deler — når en
 * metabolitt er slått sammen med moderstoffet, har den egne tall:
 * O-desmetyltramadol har sitt eget referanseområde på tramadolsiden. Står i
 * `data.gjelder`. `null` for kortene til hovedkoden, og på alle andre sider.
 * Hvert datakort kan stå én gang per kode; databasen håndhever det
 * (`innholdselementer_enkeltelement_idx`), og `les_referanseomrader` gir hver
 * kode sitt kort.
 */
export function datakortGjelder(data: unknown): string | null {
  return erObjekt(data) && typeof data.gjelder === 'string' && data.gjelder.trim() !== '' ? data.gjelder.trim() : null
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

/** Verdien i delene kortet viser hver for seg. Tomme deler er `''`. */
export interface Intervalldeler {
  /** «>» eller «opptil» når bare den ene grensen er oppgitt. */
  forledd: '' | typeof OVER | 'opptil'
  tall: string
  enhet: string
}

/** Tegnet foran en nedre grense uten øvre: «> 1 800 nmol/L». */
export const OVER = '>'

/**
 * Verdien delt opp: «>» og «opptil» når bare den ene grensen er oppgitt,
 * tallet eller området, og enheten. `null` når ingen grense er oppgitt.
 *
 * Tegnet og ordet sier bevisst ikke mer om grensen er med eller ikke enn
 * kilden gjør — det er ikke lagret, og skal ikke leses inn i tallet.
 */
export function delIntervall(verdi: Intervallverdi): Intervalldeler | null {
  const { nedre, ovre, enhet } = verdi
  if (nedre !== null && ovre !== null) {
    const tall = nedre === ovre ? formaterTall(nedre) : `${formaterTall(nedre)}–${formaterTall(ovre)}`
    return { forledd: '', tall, enhet }
  }
  if (nedre !== null) return { forledd: OVER, tall: formaterTall(nedre), enhet }
  if (ovre !== null) return { forledd: 'opptil', tall: formaterTall(ovre), enhet }
  return null
}

/**
 * Verdien slik den leses og søkes i: «10–300 nmol/L», eller «> 10» og
 * «opptil 300» når bare den ene grensen er oppgitt. Tom når ingen er det.
 * Delene står med mellomrom imellom, i samme rekkefølge som på kortet.
 */
export function formaterIntervall(verdi: Intervallverdi): string {
  const deler = delIntervall(verdi)
  return deler ? [deler.forledd, deler.tall, deler.enhet].filter(Boolean).join(' ') : ''
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

/* «Viktige data»: t₁/₂ og tₛₛ, per legemiddelform. */

/**
 * Verdien for én legemiddelform: en typisk verdi, et område fra minimum til
 * maksimum, eller begge. `form` er det formen heter på kortet («Peroralt»,
 * «Depotinjeksjon»), og tom når verdien ikke gjelder en bestemt form.
 */
export interface Formverdi {
  form: string
  typisk: number | null
  min: number | null
  maks: number | null
  enhet: string
}

/** Verdiene på et formvis datakort, én per legemiddelform, i rekkefølgen de står. */
export interface Formverdier {
  former: Formverdi[]
}

export function tomFormverdi(): Formverdi {
  return { form: '', typisk: null, min: null, maks: null, enhet: '' }
}

function harFormverdi(verdi: Formverdi): boolean {
  return verdi.typisk !== null || verdi.min !== null || verdi.maks !== null
}

/**
 * Verdiene på et formvis datakort. Kortene ble tidligere lagret som ett område
 * ({@link Intervallverdi}); det leses som én verdi uten form — et område når
 * grensene er ulike, ellers den typiske verdien.
 */
export function lesFormverdier(data: unknown): Formverdier {
  if (!erObjekt(data)) return { former: [] }
  if (Array.isArray(data.former)) {
    return {
      former: data.former
        .filter(erObjekt)
        .map((f) => ({
          form: tekst(f.form),
          typisk: tallEllerNull(f.typisk),
          min: tallEllerNull(f.min),
          maks: tallEllerNull(f.maks),
          enhet: tekst(f.enhet),
        }))
        .filter(harFormverdi),
    }
  }
  const { nedre, ovre, enhet } = lesIntervallverdi(data)
  if (nedre === null && ovre === null) return { former: [] }
  const omrade = nedre !== null && ovre !== null && nedre !== ovre
  return {
    former: [
      omrade
        ? { form: '', typisk: null, min: nedre, maks: ovre, enhet }
        : { form: '', typisk: nedre ?? ovre, min: null, maks: null, enhet },
    ],
  }
}

/** Om et datakort har noe å vise, uansett formen på verdien. */
export function datakortHarVerdi(kort: Pick<Datakortdefinisjon, 'verdi'>, data: unknown): boolean {
  return kort.verdi === 'formvis' ? lesFormverdier(data).former.length > 0 : harVerdi(lesIntervallverdi(data))
}

/** Tallene i en formverdi hver for seg: den typiske verdien og området. Tomme deler er `''`. */
export interface Formverdideler {
  typisk: string
  /** «29–37», uten parentes. */
  omrade: string
  enhet: string
}

/**
 * «33 (29–37) timer» deles i den typiske verdien, området og enheten. Står
 * bare den ene av dem, er den andre tom. `null` når ingenting er oppgitt.
 */
export function delFormverdi(verdi: Formverdi): Formverdideler | null {
  if (!harFormverdi(verdi)) return null
  const { typisk, min, maks, enhet } = verdi
  const omrade = min !== null && maks !== null ? `${formaterTall(min)}–${formaterTall(maks)}` : ''
  return { typisk: typisk === null ? '' : formaterTall(typisk), omrade, enhet }
}

/** Tallet slik det står på kortet: «33 (29–37)», «33» eller «29–37». */
export function formverditall({ typisk, omrade }: Formverdideler): string {
  return typisk && omrade ? `${typisk} (${omrade})` : typisk || omrade
}

/**
 * Verdiene slik de leses og søkes i: «33 (29–37) timer», og med formene
 * foran når det er flere: «Peroralt: 5 døgn · Depotinjeksjon: 2–4 måneder».
 */
export function formaterFormverdier({ former }: Formverdier): string {
  return former
    .map((f) => {
      const deler = delFormverdi(f)!
      const verdi = [formverditall(deler), deler.enhet].filter(Boolean).join(' ')
      return f.form ? `${f.form}: ${verdi}` : verdi
    })
    .join(' · ')
}

/**
 * «33 ± 4» som typisk verdi og område: 33 (29–37). Kilder som oppgir et
 * standardavvik eller en usikkerhet slik, skrives om til den formen kortene
 * har.
 */
export function fraPlussMinus(midt: number, avvik: number): Pick<Formverdi, 'typisk' | 'min' | 'maks'> {
  const rund = (tall: number) => Number(tall.toFixed(6))
  return { typisk: midt, min: rund(midt - avvik), maks: rund(midt + avvik) }
}

/** Feilen i verdiene som skal lagres, eller `null` når de er gyldige. */
export function kontrollerFormverdier({ former }: Formverdier): string | null {
  for (const [i, f] of former.entries()) {
    const hvor = former.length > 1 ? `${f.form || `Rad ${i + 1}`}: ` : ''
    if (!harFormverdi(f)) return `${hvor}Oppgi en typisk verdi, et område eller begge.`
    if ((f.min === null) !== (f.maks === null)) return `${hvor}Oppgi både minimum og maksimum, eller ingen av dem.`
    if (f.min !== null && f.maks !== null && f.min > f.maks) return `${hvor}Minimum kan ikke være høyere enn maksimum.`
    if (f.typisk !== null && f.min !== null && f.maks !== null && (f.typisk < f.min || f.typisk > f.maks)) {
      return `${hvor}Den typiske verdien må ligge mellom minimum og maksimum.`
    }
    if (!f.enhet) return `${hvor}Oppgi enheten.`
    if (former.length > 1 && !f.form) return `Rad ${i + 1}: Oppgi legemiddelformen når kortet har flere.`
  }
  const navn = former.map((f) => f.form.toLocaleLowerCase('nb'))
  const dobbel = navn.find((n, i) => navn.indexOf(n) !== i)
  if (dobbel !== undefined) return `Legemiddelformen «${former[navn.indexOf(dobbel)]!.form}» står to ganger.`
  return null
}

/**
 * Formene redaktøren får som forslag. Fri tekst er lov; ikonet på kortet
 * velges etter ordene i navnet (`administrasjonsikon`).
 */
export const FORSLAG_LEGEMIDDELFORMER = ['Peroralt', 'Injeksjon', 'Depotinjeksjon', 'Mikstur', 'Dråper'] as const

/* Farmakodynamikk, indikasjon og dosering: riktekst. */

export interface Rikteksdata {
  dokument: Riktekstdokument
}

export function lesRiktekst(data: unknown): Rikteksdata {
  return { dokument: rensDokument(erObjekt(data) ? data.dokument : undefined) }
}

/* Farmakokinetikken, kort for kort. */

export interface Kinetikkdata {
  tittel: string
  dokument: Riktekstdokument
}

export function lesKinetikk(data: unknown): Kinetikkdata {
  if (!erObjekt(data)) return { tittel: '', dokument: tomtDokument() }
  return { tittel: tekst(data.tittel), dokument: rensDokument(data.dokument) }
}

/* Serumkonsentrasjonene. */

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

/* --- Kort som bare kan finnes én gang ------------------------------------ */

/**
 * Elementtypene som står én gang i panelet sitt: koblingene til
 * legemiddeldataene og ClinPGx, hvert datakort (én gang per kode, se
 * {@link datakortGjelder}), rikteksten i tekstpanelene og tabellen.
 * Farmakokinetikken kan ha mange kort.
 *
 * Databasen håndhever det samme (`innholdselementer_enkeltelement_idx` i
 * migrasjonen `legemiddelkobling`), så to som oppretter det samme kortet
 * samtidig, ikke begge får det lagret; `clinpgxkobling` kom til i migrasjonen
 * `clinpgx`. Testene kontrollerer at listene stemmer.
 */
export const ENKELTELEMENTER: readonly string[] = [
  ELEMENTTYPER.legemiddelkobling,
  ELEMENTTYPER.clinpgxkobling,
  ELEMENTTYPER.riktekst,
  ELEMENTTYPER.dosetabell,
  ...DATAKORT.map((k) => k.type),
]

export function erEnkeltelement(elementtype: string): boolean {
  return ENKELTELEMENTER.includes(elementtype)
}

/* --- Felles --------------------------------------------------------------- */

function erObjekt(verdi: unknown): verdi is Record<string, unknown> {
  return typeof verdi === 'object' && verdi !== null && !Array.isArray(verdi)
}
