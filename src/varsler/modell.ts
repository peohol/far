/**
 * Varslene: kategoriene og valgene, varslene fra databasen og fra
 * endringsloggen, og tekstene de vises med. Alt her er rene funksjoner;
 * kallene står i `api.ts`, og hvordan databasen lager varslene, i migrasjonen
 * `*_varsler.sql` og i `docs/varsler.md`.
 */
import { sammenlignVersjon, type Endring } from '../domain/versjon'
import { erObjekt, tekst, tekstEllerNull } from '../ideer/lesing'

/* --- Kategoriene ----------------------------------------------------------- */

export interface Varselkategoridefinisjon {
  /** Det brukeren leser i innstillingene. */
  tittel: string
  forklaring: string
  /** Alle får disse, og de kan ikke slås av. */
  obligatorisk: boolean
  /** Om kategorien er på før brukeren har valgt noe. */
  standard: boolean
  /** Vises ikke i innstillingene ennå, fordi ingenting kan gi slike varsler. */
  skjult?: boolean
}

/**
 * Kategoriene, i den rekkefølgen innstillingene viser dem. Alle unntatt
 * `funksjonalitet` lages av databasen (`public.varselkategori`);
 * `funksjonalitet` er nye føringer i endringsloggen.
 */
export const VARSELKATEGORIER = {
  fortolkning: {
    tittel: 'Endringer i fortolkningen',
    forklaring: 'Når en kommentartekst eller reglene for hvilke kommentarer som brukes, er endret.',
    obligatorisk: true,
    standard: true,
  },
  mine_ideer: {
    tittel: 'Kommentarer til mine idéer og kommentarer',
    forklaring: 'Når noen kommenterer en idé du har skrevet, eller svarer på en kommentar du har skrevet.',
    obligatorisk: true,
    standard: true,
  },
  aktive_ideer: {
    tittel: 'Kommentarer til idéer jeg har vært aktiv i',
    forklaring: 'Når noen kommenterer en idé du har kommentert, uten at det er et svar til deg.',
    obligatorisk: false,
    standard: true,
  },
  funksjonalitet: {
    tittel: 'Ny eller endret funksjonalitet i appen',
    forklaring: 'Når appen har fått en ny versjon, med det som står om den i endringsloggen.',
    obligatorisk: false,
    standard: true,
  },
  favoritter: {
    tittel: 'Endringer på mine favorittsider',
    forklaring: 'Når en side du har som favoritt, er endret.',
    obligatorisk: false,
    standard: false,
    skjult: true,
  },
} as const satisfies Record<string, Varselkategoridefinisjon>

export type Varselkategori = keyof typeof VARSELKATEGORIER

export const KATEGORIREKKEFOLGE = Object.keys(VARSELKATEGORIER) as Varselkategori[]

/** Kategoriene databasen lager varsler i. Samme verdier som `public.varselkategori`. */
export const DATABASEKATEGORIER = ['fortolkning', 'mine_ideer', 'aktive_ideer', 'favoritter'] as const satisfies readonly Varselkategori[]
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
 * Der en ny bruker begynner: den nyeste føringen er et varsel, resten er
 * historie. Da får alle med seg det siste som er gjort, men ikke hele loggen.
 */
export function startstatus(logg: readonly Endring[]): Endringsloggstatus {
  return { fra: logg[1]?.versjon ?? '0.0.0', lest: [] }
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
 * Føringene som er varsler: de nyere enn `fra`, uleste, og leste fra de
 * siste 30 dagene.
 */
export function endringsvarsler(logg: readonly Endring[], status: Endringsloggstatus, naa: Date = new Date()): Endringsvarsel[] {
  return logg
    .filter((endring) => sammenlignVersjon(endring.versjon, status.fra) > 0)
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
 * Statusen med `versjoner` merket lest. `fra` flyttes forbi de eldste leste som
 * har passert fristen, så lista over leste ikke vokser.
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
    if (!lest.has(endring.versjon) || !erGammel(endring, naa)) break
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
  /** En ny kommentar på idéen, og hvem den svarer. */
  kommentar?: string
  svarTil?: string | null
  /** Det som ble publisert i fortolkningen. */
  objekt?: Fortolkningsobjekt | null
}

export interface Databasevarsel {
  kilde: 'database'
  id: string
  kategori: Databasekategori
  ide: { id: string; tittel: string; forfatterId: string | null } | null
  /** Eldste først. */
  hendelser: Hendelse[]
  oppdatert_kl: string
  lest: boolean
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

function lesHendelse(verdi: unknown): Hendelse | null {
  if (!erObjekt(verdi)) return null
  const hendelse: Hendelse = { kl: tekst(verdi.kl), av: tekstEllerNull(verdi.av) }
  if ('kommentar' in verdi) {
    hendelse.kommentar = tekst(verdi.kommentar)
    hendelse.svarTil = tekstEllerNull(verdi.svar_til)
  }
  if ('objekt' in verdi) hendelse.objekt = lesObjekt(verdi.objekt)
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
  return {
    kilde: 'database',
    id: tekst(verdi.id),
    kategori: verdi.kategori,
    ide,
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

/** «Ada», «Ada og Bo», «Ada, Bo og Cy», «Ada, Bo og 2 andre». */
export function navneliste(navn: readonly string[]): string {
  if (navn.length <= 1) return navn[0] ?? ''
  if (navn.length <= 3) return `${navn.slice(0, -1).join(', ')} og ${navn.at(-1)}`
  return `${navn.slice(0, 2).join(', ')} og ${navn.length - 2} andre`
}

/** Hvem som står bak hendelsene, den siste først, hver én gang. */
export function aktorer(hendelser: readonly Hendelse[]): string[] {
  const ider: string[] = []
  for (const h of [...hendelser].reverse()) if (h.av && !ider.includes(h.av)) ider.push(h.av)
  return ider
}

/** Hva som har skjedd med idéen, med navnene foran: «Ada og Bo kommenterte idéen din». */
export function idetekst(varsel: Databasevarsel, meg: string, navn: (id: string) => string): string {
  const hvem = navneliste(aktorer(varsel.hendelser).map(navn))
  if (varsel.kategori === 'aktive_ideer') return `${hvem} kommenterte en idé du har kommentert`
  const egen = varsel.ide?.forfatterId === meg
  const barSvar = varsel.hendelser.every((h) => h.svarTil === meg)
  return !egen || barSvar ? `${hvem} svarte på kommentaren din` : `${hvem} kommenterte idéen din`
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
