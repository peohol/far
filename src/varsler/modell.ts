/**
 * Varslene: kategoriene og valgene, varslene fra databasen og fra
 * endringsloggen, og tekstene de vises med. Alt her er rene funksjoner;
 * kallene står i `api.ts`, og hvordan databasen lager varslene, i migrasjonen
 * `*_varsler.sql` og i `docs/varsler.md`.
 */
import { sammenlignVersjon, varsles, type Endring } from '../domain/versjon'
import { PANELREKKEFOLGE, panelFor } from '../faginnhold/paneler'
import { erObjekt, tekst, tekstEllerNull } from '../ideer/lesing'
import { lesDiskusjonsside, type Diskusjonsside } from '../diskusjoner/modell'

/* --- Kategoriene ----------------------------------------------------------- */

/**
 * Det kategoriene gjelder, i den rekkefølgen innstillingene viser dem: hver
 * gruppe får sin overskrift, med kategoriene sine under.
 */
export const VARSELGRUPPER = {
  fortolkning: { tittel: 'Fortolkningen' },
  ideer: { tittel: 'Idéer' },
  diskusjoner: { tittel: 'Diskusjoner' },
  favoritter: { tittel: 'Favorittsider' },
  appen: { tittel: 'Appen' },
} as const satisfies Record<string, { tittel: string }>

export type Varselgruppe = keyof typeof VARSELGRUPPER

export const GRUPPEREKKEFOLGE = Object.keys(VARSELGRUPPER) as Varselgruppe[]

export interface Varselkategoridefinisjon {
  /** Hva kategorien gjelder: overskriften den står under i innstillingene. */
  gruppe: Varselgruppe
  /** Det brukeren leser i innstillingene. */
  tittel: string
  forklaring: string
  /** Alle får disse, og de kan ikke slås av. */
  obligatorisk: boolean
  /** Om kategorien er på før brukeren har valgt noe. */
  standard: boolean
}

/**
 * Kategoriene, i den rekkefølgen innstillingene viser dem innenfor gruppen. Alle unntatt
 * `funksjonalitet` lages av databasen (`public.varselkategori`);
 * `funksjonalitet` er nye føringer i endringsloggen.
 */
export const VARSELKATEGORIER = {
  fortolkning: {
    gruppe: 'fortolkning',
    tittel: 'Endringer i fortolkningen',
    forklaring: 'Når en kommentartekst eller reglene for hvilke kommentarer som brukes, er endret.',
    obligatorisk: true,
    standard: true,
  },
  mine_ideer: {
    gruppe: 'ideer',
    tittel: 'Kommentarer til mine idéer og kommentarer',
    forklaring: 'Når noen kommenterer en idé du har skrevet, eller svarer på en kommentar du har skrevet.',
    obligatorisk: true,
    standard: true,
  },
  aktive_ideer: {
    gruppe: 'ideer',
    tittel: 'Kommentarer til idéer jeg har vært aktiv i',
    forklaring: 'Når noen kommenterer en idé du har kommentert, uten at det er et svar til deg.',
    obligatorisk: false,
    standard: true,
  },
  nye_ideer: {
    gruppe: 'ideer',
    tittel: 'Nye idéer',
    forklaring: 'Når noen har skrevet en ny idé.',
    obligatorisk: false,
    standard: false,
  },
  mine_diskusjoner: {
    gruppe: 'diskusjoner',
    tittel: 'Kommentarer i mine diskusjoner',
    forklaring: 'Når noen kommenterer en tråd du har startet, eller svarer på en kommentar du har skrevet i en diskusjon.',
    obligatorisk: true,
    standard: true,
  },
  aktive_diskusjoner: {
    gruppe: 'diskusjoner',
    tittel: 'Kommentarer i diskusjoner jeg har vært aktiv i',
    forklaring: 'Når noen kommenterer en tråd du har kommentert, uten at det er et svar til deg.',
    obligatorisk: false,
    standard: true,
  },
  funksjonalitet: {
    gruppe: 'appen',
    tittel: 'Ny eller endret funksjonalitet i appen',
    forklaring: 'Når appen har fått en ny versjon, med det som står om den i endringsloggen.',
    obligatorisk: false,
    standard: true,
  },
  favoritter: {
    gruppe: 'favoritter',
    tittel: 'Endringer på mine favorittsider',
    forklaring: 'Når noen har publisert endringer på en fagside du har som favoritt.',
    obligatorisk: false,
    standard: false,
  },
  favorittdiskusjoner: {
    gruppe: 'favoritter',
    tittel: 'Nye diskusjoner på mine favorittsider',
    forklaring: 'Når noen starter en ny tråd på en fagside du har som favoritt.',
    obligatorisk: false,
    standard: false,
  },
} as const satisfies Record<string, Varselkategoridefinisjon>

export type Varselkategori = keyof typeof VARSELKATEGORIER

export const KATEGORIREKKEFOLGE = Object.keys(VARSELKATEGORIER) as Varselkategori[]

/** Gruppene med kategoriene sine, slik innstillingene viser dem. Grupper uten kategorier er utelatt. */
export function kategorierIGrupper(): { gruppe: Varselgruppe; kategorier: Varselkategori[] }[] {
  return GRUPPEREKKEFOLGE.map((gruppe) => ({
    gruppe,
    kategorier: KATEGORIREKKEFOLGE.filter((k) => VARSELKATEGORIER[k].gruppe === gruppe),
  })).filter((g) => g.kategorier.length > 0)
}

/** Kategoriene databasen lager varsler i. Samme verdier, i samme rekkefølge, som `public.varselkategori`. */
export const DATABASEKATEGORIER = [
  'fortolkning',
  'mine_ideer',
  'aktive_ideer',
  'favoritter',
  'nye_ideer',
  'mine_diskusjoner',
  'aktive_diskusjoner',
  'favorittdiskusjoner',
] as const satisfies readonly Varselkategori[]
export type Databasekategori = (typeof DATABASEKATEGORIER)[number]

function erDatabasekategori(verdi: unknown): verdi is Databasekategori {
  return typeof verdi === 'string' && (DATABASEKATEGORIER as readonly string[]).includes(verdi)
}

/* --- Valgene --------------------------------------------------------------- */

/** Brukerens valg for de valgfrie kategoriene. Det som ikke er valgt, har standarden. */
export type Varselvalg = Partial<Record<Varselkategori, boolean>>

/** Nøkkelen valgene lagres under i brukerinnstillingene. */
export const VALGNOKKEL = 'varsler.valg'

export function lesVarselvalg(verdi: unknown): Varselvalg {
  if (!erObjekt(verdi)) return {}
  const valg: Varselvalg = {}
  for (const kategori of KATEGORIREKKEFOLGE) {
    const pa = verdi[kategori]
    if (typeof pa === 'boolean') valg[kategori] = pa
  }
  return valg
}

/** Om brukeren skal se varsler i kategorien. De obligatoriske er alltid på. */
export function erValgt(kategori: Varselkategori, valg: Varselvalg): boolean {
  const definisjon: Varselkategoridefinisjon = VARSELKATEGORIER[kategori]
  return definisjon.obligatorisk || (valg[kategori] ?? definisjon.standard)
}

/* --- Endringsloggen -------------------------------------------------------- */

/**
 * Hvor langt brukeren er kommet i endringsloggen: føringene til og med `fra`
 * er ikke varsler, og `lest` er de nyere som er lest.
 */
export interface Endringsloggstatus {
  fra: string
  lest: string[]
}

/** Nøkkelen statusen lagres under i brukerinnstillingene. */
export const ENDRINGSLOGGNOKKEL = 'varsler.endringslogg'

/** Hvor lenge et lest varsel blir stående. Samme frist som `intern.varselfrist()`. */
export const VARSELFRIST_DAGER = 30

function erVersjon(verdi: unknown): verdi is string {
  return typeof verdi === 'string' && /^\d+\.\d+\.\d+$/.test(verdi)
}

export function lesEndringsloggstatus(verdi: unknown): Endringsloggstatus | null {
  if (!erObjekt(verdi) || !erVersjon(verdi.fra)) return null
  const lest = Array.isArray(verdi.lest) ? verdi.lest.filter(erVersjon) : []
  return { fra: verdi.fra, lest }
}

/**
 * Der en ny bruker begynner: den nyeste føringen som varsles, er et varsel,
 * resten er historie. Da får alle med seg det siste som er gjort, men ikke
 * hele loggen.
 */
export function startstatus(logg: readonly Endring[]): Endringsloggstatus {
  return { fra: logg.filter(varsles)[1]?.versjon ?? '0.0.0', lest: [] }
}

/** En føring som endrer fortolkningen, varsles som det; resten som funksjonalitet. */
export function endringskategori(endring: Endring): 'fortolkning' | 'funksjonalitet' {
  return endring.endrerFortolkning ? 'fortolkning' : 'funksjonalitet'
}

/** Midt på dagen føringen er datert, så den sorteres med dagens andre varsler. */
function endringstid(endring: Endring): string {
  return new Date(`${endring.dato}T12:00:00`).toISOString()
}

function erGammel(endring: Endring, naa: Date): boolean {
  return naa.getTime() - new Date(endringstid(endring)).getTime() > VARSELFRIST_DAGER * 86_400_000
}

export interface Endringsvarsel {
  kilde: 'endringslogg'
  id: string
  kategori: 'fortolkning' | 'funksjonalitet'
  endring: Endring
  oppdatert_kl: string
  lest: boolean
}

/**
 * Føringene som er varsler: de nyere enn `fra` som varsles, uleste, og leste
 * fra de siste 30 dagene.
 */
export function endringsvarsler(logg: readonly Endring[], status: Endringsloggstatus, naa: Date = new Date()): Endringsvarsel[] {
  return logg
    .filter((endring) => varsles(endring) && sammenlignVersjon(endring.versjon, status.fra) > 0)
    .map((endring) => ({
      kilde: 'endringslogg' as const,
      id: `endring:${endring.versjon}`,
      kategori: endringskategori(endring),
      endring,
      oppdatert_kl: endringstid(endring),
      lest: status.lest.includes(endring.versjon),
    }))
    .filter((varsel) => !varsel.lest || !erGammel(varsel.endring, naa))
}

/**
 * Statusen med `versjoner` merket lest. `fra` flyttes forbi de eldste leste (og
 * de som ikke varsles) som har passert fristen, så lista over leste ikke vokser.
 */
export function merkEndringerLest(
  logg: readonly Endring[],
  status: Endringsloggstatus,
  versjoner: readonly string[],
  naa: Date = new Date(),
): Endringsloggstatus {
  const lest = new Set([...status.lest, ...versjoner])
  let fra = status.fra
  const nyere = logg.filter((e) => sammenlignVersjon(e.versjon, fra) > 0).reverse()
  for (const endring of nyere) {
    if ((varsles(endring) && !lest.has(endring.versjon)) || !erGammel(endring, naa)) break
    fra = endring.versjon
  }
  return {
    fra,
    lest: logg.filter((e) => lest.has(e.versjon) && sammenlignVersjon(e.versjon, fra) > 0).map((e) => e.versjon),
  }
}

/* --- Varslene fra databasen ------------------------------------------------ */

/** Et publisert fortolkningsobjekt slik varselet viser det. */
export interface Fortolkningsobjekt {
  id: string
  type: 'kommentar' | 'intervallregelsett' | 'scenarioregelsett' | 'thc_regelsett'
  /** Kommentarens navn, eller analyttkodene regelsettet gjelder. */
  navn: string | null
  /** Koden reglene står under på stoffsiden, når den er kjent. */
  analyttkode: string | null
}

export interface Hendelse {
  kl: string
  /** Hvem som gjorde det. */
  av: string | null
  /** En ny kommentar på idéen eller i diskusjonen, og hvem den svarer. */
  kommentar?: string
  svarTil?: string | null
  /** Det som ble publisert i fortolkningen. */
  objekt?: Fortolkningsobjekt | null
  /** Favorittsiden som ble endret, og delene av den (`SIDENAVN` eller panelnøkler). */
  side?: Favorittside | null
  deler?: string[]
}

/** En fagside slik et favorittvarsel viser den: navnet og stoffets nøkkel. */
export interface Favorittside {
  id: string
  navn: string
  stoff: string
}

export interface Databasevarsel {
  kilde: 'database'
  id: string
  kategori: Databasekategori
  ide: { id: string; tittel: string; forfatterId: string | null } | null
  /** Tråden varselet gjelder, i kategoriene for diskusjonene. */
  diskusjon?: Varseldiskusjon | null
  /** Eldste først. */
  hendelser: Hendelse[]
  oppdatert_kl: string
  lest: boolean
}

/** En tråd slik et varsel viser den: overskriften, og siden den står på. */
export interface Varseldiskusjon {
  id: string
  tittel: string
  side: Diskusjonsside
  forfatterId: string | null
}

export type Varsel = Databasevarsel | Endringsvarsel

export interface Varselliste {
  /** Når lista ble lest: varslene merkes lest slik de var da. */
  lest_kl: string
  varsler: Databasevarsel[]
}

const OBJEKTTYPER = ['kommentar', 'intervallregelsett', 'scenarioregelsett', 'thc_regelsett'] as const

function lesObjekt(verdi: unknown): Fortolkningsobjekt | null {
  if (!erObjekt(verdi) || !(OBJEKTTYPER as readonly unknown[]).includes(verdi.type)) return null
  return {
    id: tekst(verdi.id),
    type: verdi.type as Fortolkningsobjekt['type'],
    navn: tekstEllerNull(verdi.navn),
    analyttkode: tekstEllerNull(verdi.analyttkode),
  }
}

function lesSide(verdi: unknown): Favorittside | null {
  if (!erObjekt(verdi)) return null
  const side = { id: tekst(verdi.id), navn: tekst(verdi.navn), stoff: tekst(verdi.stoff) }
  return side.id && side.stoff ? side : null
}

function lesHendelse(verdi: unknown): Hendelse | null {
  if (!erObjekt(verdi)) return null
  const hendelse: Hendelse = { kl: tekst(verdi.kl), av: tekstEllerNull(verdi.av) }
  // Idéene sier `kommentar`, diskusjonene `innlegg`: begge er en ny kommentar.
  const kommentar = 'kommentar' in verdi ? verdi.kommentar : 'innlegg' in verdi ? verdi.innlegg : undefined
  if (kommentar !== undefined) {
    hendelse.kommentar = tekst(kommentar)
    hendelse.svarTil = tekstEllerNull(verdi.svar_til)
  }
  if ('objekt' in verdi) hendelse.objekt = lesObjekt(verdi.objekt)
  if ('side' in verdi) {
    hendelse.side = lesSide(verdi.side)
    hendelse.deler = Array.isArray(verdi.deler) ? verdi.deler.filter((d): d is string => typeof d === 'string') : []
  }
  return hendelse
}

function lesDatabasevarsel(verdi: unknown): Databasevarsel | null {
  if (!erObjekt(verdi) || !erDatabasekategori(verdi.kategori)) return null
  const hendelser = (Array.isArray(verdi.hendelser) ? verdi.hendelser : [])
    .map(lesHendelse)
    .filter((h): h is Hendelse => h !== null)
  if (hendelser.length === 0) return null
  const ide = erObjekt(verdi.ide)
    ? { id: tekst(verdi.ide.id), tittel: tekst(verdi.ide.tittel), forfatterId: tekstEllerNull(verdi.ide.forfatter_id) }
    : null
  const side = erObjekt(verdi.diskusjon) ? lesDiskusjonsside(verdi.diskusjon.side) : null
  const diskusjon =
    erObjekt(verdi.diskusjon) && side
      ? { id: tekst(verdi.diskusjon.id), tittel: tekst(verdi.diskusjon.tittel), side, forfatterId: tekstEllerNull(verdi.diskusjon.forfatter_id) }
      : null
  return {
    kilde: 'database',
    id: tekst(verdi.id),
    kategori: verdi.kategori,
    ide,
    diskusjon,
    hendelser,
    oppdatert_kl: tekst(verdi.oppdatert_kl),
    lest: verdi.lest_kl != null,
  }
}

/** Svaret fra `mine_varsler()`. */
export function lesVarselliste(data: unknown): Varselliste {
  if (!erObjekt(data)) return { lest_kl: new Date().toISOString(), varsler: [] }
  return {
    lest_kl: tekst(data.lest_kl) || new Date().toISOString(),
    varsler: (Array.isArray(data.varsler) ? data.varsler : [])
      .map(lesDatabasevarsel)
      .filter((v): v is Databasevarsel => v !== null),
  }
}

export type Ulesttall = Partial<Record<Databasekategori, number>>

/** Svaret fra `uleste_varsler()`. */
export function lesUleste(data: unknown): Ulesttall {
  const uleste: Ulesttall = {}
  if (!erObjekt(data)) return uleste
  for (const kategori of DATABASEKATEGORIER) {
    const antall = Number(data[kategori])
    if (Number.isFinite(antall) && antall > 0) uleste[kategori] = antall
  }
  return uleste
}

/* --- Samlet ---------------------------------------------------------------- */

/** Varslene brukeren har valgt, de uleste først, og ellers de nyeste først. */
export function samleVarsler(varsler: readonly Varsel[], valg: Varselvalg): Varsel[] {
  return varsler
    .filter((v) => erValgt(v.kategori, valg))
    .sort((a, b) => Number(a.lest) - Number(b.lest) || Date.parse(b.oppdatert_kl) - Date.parse(a.oppdatert_kl))
}

/** Tallet på bjella: de uleste i kategoriene brukeren har valgt. */
export function antallUleste(uleste: Ulesttall, endringer: readonly Endringsvarsel[], valg: Varselvalg): number {
  const fraDatabasen = DATABASEKATEGORIER.reduce((sum, k) => sum + (erValgt(k, valg) ? (uleste[k] ?? 0) : 0), 0)
  return fraDatabasen + endringer.filter((e) => !e.lest && erValgt(e.kategori, valg)).length
}

/** Tallet slik merket viser det: over ni står det «9+». */
export function merketall(antall: number): string {
  return antall > 9 ? '9+' : String(antall)
}

/* --- Tekstene -------------------------------------------------------------- */

/** «A», «A og B», «A, B og C». */
export function oppramsing(ledd: readonly string[]): string {
  return ledd.length <= 1 ? (ledd[0] ?? '') : `${ledd.slice(0, -1).join(', ')} og ${ledd.at(-1)}`
}

/** «Ada», «Ada og Bo», «Ada, Bo og Cy», «Ada, Bo og 2 andre». */
export function navneliste(navn: readonly string[]): string {
  return navn.length <= 3 ? oppramsing(navn) : `${navn.slice(0, 2).join(', ')} og ${navn.length - 2} andre`
}

/** Hvem som står bak hendelsene, den siste først, hver én gang. */
export function aktorer(hendelser: readonly Hendelse[]): string[] {
  const ider: string[] = []
  for (const h of [...hendelser].reverse()) if (h.av && !ider.includes(h.av)) ider.push(h.av)
  return ider
}

/**
 * Hva som har skjedd i en tråd — en idé eller en diskusjon — med navnene
 * foran: «Ada og Bo kommenterte idéen din», «Bo svarte på kommentaren din».
 */
function kommentartekst(
  varsel: Databasevarsel,
  forfatterId: string | null | undefined,
  meg: string,
  navn: (id: string) => string,
  ord: { egen: string; aktiv: string },
): string {
  const hvem = navneliste(aktorer(varsel.hendelser).map(navn))
  if (varsel.kategori === 'aktive_ideer' || varsel.kategori === 'aktive_diskusjoner') return `${hvem} ${ord.aktiv}`
  const barSvar = varsel.hendelser.every((h) => h.svarTil === meg)
  return forfatterId !== meg || barSvar ? `${hvem} svarte på kommentaren din` : `${hvem} ${ord.egen}`
}

/** Hva som har skjedd med idéen, med navnene foran: «Ada og Bo kommenterte idéen din». */
export function idetekst(varsel: Databasevarsel, meg: string, navn: (id: string) => string): string {
  if (varsel.kategori === 'nye_ideer') return `${navneliste(aktorer(varsel.hendelser).map(navn))} skrev en ny idé`
  return kommentartekst(varsel, varsel.ide?.forfatterId, meg, navn, {
    egen: 'kommenterte idéen din',
    aktiv: 'kommenterte en idé du har kommentert',
  })
}

/** Hva som har skjedd i diskusjonen: «Ada kommenterte tråden din», «Bo startet en ny tråd på en favorittside». */
export function diskusjonstekst(varsel: Databasevarsel, meg: string, navn: (id: string) => string): string {
  if (varsel.kategori === 'favorittdiskusjoner') {
    return `${navneliste(aktorer(varsel.hendelser).map(navn))} startet en ny tråd på en favorittside`
  }
  return kommentartekst(varsel, varsel.diskusjon?.forfatterId, meg, navn, {
    egen: 'kommenterte tråden din',
    aktiv: 'kommenterte en tråd du har kommentert',
  })
}

/** Om varselet gjelder en diskusjon. */
export function erDiskusjonsvarsel(varsel: Databasevarsel): boolean {
  return varsel.kategori === 'mine_diskusjoner' || varsel.kategori === 'aktive_diskusjoner' || varsel.kategori === 'favorittdiskusjoner'
}

/** «Kommentaren «AMIS – innenfor»» eller «Reglene for AMIS». */
export function objekttekst(objekt: Fortolkningsobjekt): string {
  const navn = objekt.navn ?? 'uten navn'
  return objekt.type === 'kommentar' ? `Kommentaren «${navn}»` : `Reglene for ${navn}`
}

/** De publiserte objektene i et fortolkningsvarsel, det sist publiserte først. */
export function fortolkningsobjekter(varsel: Databasevarsel): Fortolkningsobjekt[] {
  return [...varsel.hendelser]
    .reverse()
    .map((h) => h.objekt)
    .filter((o): o is Fortolkningsobjekt => o != null)
}

/** Delen av en favorittside som står for sidens navn og nøkkel (`intern.endrede_sidedeler`). */
export const SIDENAVN = 'navn'

/** Favorittsiden varselet gjelder, slik den heter nå. */
export function favorittside(varsel: Databasevarsel): Favorittside | null {
  return [...varsel.hendelser].reverse().find((h) => h.side)?.side ?? null
}

/** Delene av siden som er endret i varselet, hver én gang: navnet først, så panelene i sidens rekkefølge. */
export function endredeDeler(varsel: Databasevarsel): string[] {
  const rekkefolge = [SIDENAVN, ...PANELREKKEFOLGE]
  const plass = (del: string) => (rekkefolge.includes(del) ? rekkefolge.indexOf(del) : rekkefolge.length)
  return [...new Set(varsel.hendelser.flatMap((h) => h.deler ?? []))].sort((a, b) => plass(a) - plass(b) || a.localeCompare(b))
}

/** «Navnet», eller tittelen på panelet. */
export function deltittel(del: string): string {
  return del === SIDENAVN ? 'Navnet' : (panelFor(del)?.tittel ?? del)
}

/** «Navnet, Dosering og Farmakokinetikk». */
export function deletekst(deler: readonly string[]): string {
  return oppramsing(deler.map(deltittel))
}

/**
 * Stedet på siden varselet leder til: den første endrede delen som er et sted
 * på siden (navnet og identiteten står øverst uansett), eller toppen.
 */
export function favorittsted(deler: readonly string[]): string[] {
  const del = deler.find((d) => d !== SIDENAVN && panelFor(d)?.form !== 'identitet')
  return del ? [del] : []
}
