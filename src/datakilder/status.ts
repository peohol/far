/**
 * Driftstatusen for datakildene — legemiddeldataene fra FEST og de
 * farmakogenetiske fra ClinPGx og CPIC — slik administratorene ser den: de
 * siste kjøringene, om noe er galt, og hva som er endret siden forrige henting.
 *
 * Endringene i ClinPGx og CPIC oppdages i databasen
 * (`*_datakilder_endringer.sql`, `docs/datakilder.md`); FEST har ingen
 * endringslogg, men hver kjøring teller nye, endrede og utgåtte rader. Alt
 * leses med `datakilder_status()`. Alt her er rene funksjoner, bortsett fra
 * `lagDatakildeleser`.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import vercel from '../../vercel.json'

export const DATAKILDER = ['fest', 'clinpgx', 'cpic'] as const
export type Datakilde = (typeof DATAKILDER)[number]

export interface Kildeoppsett {
  navn: string
  /** Serverendepunktet som synkroniserer kilden, for cron og for administratorer. */
  synk: string
  /** Hva `versjon` i en kjøring er for kilden. */
  versjonsnavn: string
  /** Versjonen slik den vises, når den ikke skal stå som den er. */
  visVersjon?: (versjon: string) => string
  /**
   * Hva som står etter en kjøring som feilet, når kilden ikke byttes inn
   * samlet. `null`: alt byttes inn i én transaksjon, så dataene fra siste
   * vellykkede henting står — med `beholdt` som teksten om det.
   */
  etterFeil: string | null
  beholdt?: string
  /**
   * Om endringene logges i `datakilder.endringer`, som kliniske og metadata.
   * Uten: kjøringen teller bare nye, endrede og utgåtte rader.
   */
  endringslogg: boolean
}

/** «2026-09-08T03:09:06» som «08.09.2026». */
function dato(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso
}

export const KILDEOPPSETT: Record<Datakilde, Kildeoppsett> = {
  // Hele uttrekket byttes inn i én transaksjon (docs/legemiddeldata.md).
  fest: {
    navn: 'FEST',
    synk: '/api/legemiddeldata-synk',
    versjonsnavn: 'Uttrekk fra DMP',
    visVersjon: dato,
    etterFeil: null,
    beholdt: 'OUSFAR bruker fortsatt siste gyldige FEST-data; ingenting fra den feilede hentingen er tatt i bruk.',
    endringslogg: false,
  },
  // Ett kjemikalie om gangen, hvert i sin transaksjon (docs/clinpgx.md).
  clinpgx: {
    navn: 'ClinPGx',
    synk: '/api/clinpgx-synk',
    versjonsnavn: 'Parserversjon',
    etterFeil: 'Kjemikalier som ble hentet før feilen, kan være oppdatert; de andre står som før.',
    endringslogg: true,
  },
  cpic: { navn: 'CPIC', synk: '/api/cpic-synk', versjonsnavn: 'Skjemaversjon', etterFeil: null, endringslogg: true },
}

/* --- Formen fra databasen -------------------------------------------------- */

export type Kjoringsstatus = 'pagar' | 'fullfort' | 'delvis' | 'uendret' | 'feilet'

export interface Endringstall {
  klinisk: number
  metadata: number
  grunnlag: number
}

/** Radene en FEST-kjøring byttet inn, summert over typene. */
export interface Radtall {
  nye: number
  endrede: number
  utgatte: number
}

export interface Kjoring {
  kilde: Datakilde
  id: number
  status: Kjoringsstatus
  utlost_av: 'cron' | 'manuell'
  startet_kl: string
  avsluttet_kl: string | null
  /** CPIC-releasen dataene kom fra. */
  release: string | null
  versjon: string | null
  feil: string | null
  endringer: Endringstall
  /** For kilder uten endringslogg (FEST): radene kjøringen byttet inn. `null` når den ikke byttet inn noe. */
  rader?: Radtall | null
}

export type Endringsart = 'ny' | 'endret' | 'fjernet' | 'grunnlag'
export type Endringsniva = 'klinisk' | 'metadata'

export interface Endring {
  id: number
  kilde: Datakilde
  synk_id: number | null
  type: string
  objekt_id: string
  /** Kjemikaliet i ClinPGx en annotasjon kom til eller forsvant fra. */
  kontekst: string | null
  art: Endringsart
  niva: Endringsniva
  etikett: string
  felt: string[]
  foer: unknown
  etter: unknown
  spor: Record<string, unknown>
  registrert_kl: string
}

/** Det siste som er kjent om en kilde, også når siste kjøring ikke fikk det oppgitt. */
export interface Kildefakta {
  release: string | null
  versjon: string | null
  /** Når siste vellykkede henting var, også når den er eldre enn kjøringene som følger med. */
  sist_vellykket_kl?: string | null
}

export interface Datakildestatus {
  kjoringer: Kjoring[]
  /** Nyest først; høyst `antall` per kilde. */
  endringer: Endring[]
  kilder?: Partial<Record<Datakilde, Kildefakta>>
}

export const TOM_DATAKILDESTATUS: Datakildestatus = { kjoringer: [], endringer: [], kilder: {} }

/* --- Lesingen --------------------------------------------------------------- */

function erObjekt(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function tekst(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

function tall(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}

function blant<T extends string>(verdier: readonly T[], v: unknown): T | null {
  return verdier.find((x) => x === v) ?? null
}

const STATUSER: readonly Kjoringsstatus[] = ['pagar', 'fullfort', 'delvis', 'uendret', 'feilet']
const ARTER: readonly Endringsart[] = ['ny', 'endret', 'fjernet', 'grunnlag']

/** `antall` fra en FEST-kjøring, `{ type: { nye, endrede, utgatte } }`, summert. */
function lesRader(antall: unknown): Radtall | null {
  if (!erObjekt(antall)) return null
  const typer = Object.values(antall).filter(erObjekt)
  if (typer.length === 0) return null
  const sum = (felt: keyof Radtall) => typer.reduce((n, t) => n + tall(t[felt]), 0)
  return { nye: sum('nye'), endrede: sum('endrede'), utgatte: sum('utgatte') }
}

function lesKjoring(o: unknown): Kjoring | null {
  if (!erObjekt(o)) return null
  const kilde = blant(DATAKILDER, o.kilde)
  const status = blant(STATUSER, o.status)
  const startet = tekst(o.startet_kl)
  if (!kilde || !status || !startet || typeof o.id !== 'number') return null
  const e = erObjekt(o.endringer) ? o.endringer : {}
  return {
    kilde,
    id: o.id,
    status,
    utlost_av: o.utlost_av === 'manuell' ? 'manuell' : 'cron',
    startet_kl: startet,
    avsluttet_kl: tekst(o.avsluttet_kl),
    release: tekst(o.release),
    versjon: tekst(o.versjon),
    feil: tekst(o.feil),
    endringer: { klinisk: tall(e.klinisk), metadata: tall(e.metadata), grunnlag: tall(e.grunnlag) },
    ...(!KILDEOPPSETT[kilde].endringslogg && { rader: lesRader(o.antall) }),
  }
}

function lesEndring(o: unknown): Endring | null {
  if (!erObjekt(o)) return null
  const kilde = blant(DATAKILDER, o.kilde)
  const art = blant(ARTER, o.art)
  const type = tekst(o.type)
  const objekt = tekst(o.objekt_id)
  const registrert = tekst(o.registrert_kl)
  if (!kilde || !art || !type || !objekt || !registrert || typeof o.id !== 'number') return null
  return {
    id: o.id,
    kilde,
    synk_id: typeof o.synk_id === 'number' ? o.synk_id : null,
    type,
    objekt_id: objekt,
    kontekst: tekst(o.kontekst),
    art,
    niva: o.niva === 'metadata' ? 'metadata' : 'klinisk',
    etikett: tekst(o.etikett) ?? objekt,
    felt: Array.isArray(o.felt) ? o.felt.filter((f): f is string => typeof f === 'string') : [],
    foer: o.foer ?? null,
    etter: o.etter ?? null,
    spor: erObjekt(o.spor) ? o.spor : {},
    registrert_kl: registrert,
  }
}

/** Svaret fra `datakilder_status()`, lest defensivt: det som ikke kan leses, hoppes over. */
export function lesDatakildestatus(svar: unknown): Datakildestatus {
  if (!erObjekt(svar)) return TOM_DATAKILDESTATUS
  const liste = <T>(v: unknown, les: (o: unknown) => T | null) =>
    (Array.isArray(v) ? v : []).map(les).filter((x): x is T => x !== null)
  const kilder: Partial<Record<Datakilde, Kildefakta>> = {}
  if (erObjekt(svar.kilder)) {
    for (const kilde of DATAKILDER) {
      const k = svar.kilder[kilde]
      if (erObjekt(k)) {
        kilder[kilde] = { release: tekst(k.release), versjon: tekst(k.versjon), sist_vellykket_kl: tekst(k.sist_vellykket_kl) }
      }
    }
  }
  return { kjoringer: liste(svar.kjoringer, lesKjoring), endringer: liste(svar.endringer, lesEndring), kilder }
}

/* --- Vurderingen ------------------------------------------------------------ */

const DOGN_MS = 24 * 60 * 60 * 1000

/** Kjøringer som har byttet inn eller kontrollert data. En delvis kjøring har gjort det for noe. */
const VELLYKKET: readonly Kjoringsstatus[] = ['fullfort', 'delvis', 'uendret']

/** En kjøring som har stått så lenge uten å bli ferdig, har mistet forbindelsen (som i migrasjonene). */
const HENGER_ETTER_MS = 30 * 60 * 1000

/**
 * Hvor mange døgn det skal gå mellom kjøringene, lest av cron-uttrykket i
 * `vercel.json`: ukentlig når ukedagen er satt, daglig ellers. `null` når
 * uttrykket ikke kan leses så enkelt.
 */
export function intervallDogn(uttrykk: string): number | null {
  const [minutt, time, dag, maaned, ukedag] = uttrykk.trim().split(/\s+/)
  if (!minutt || !time || !dag || !maaned || !ukedag || dag !== '*' || maaned !== '*') return null
  if (/^\d$/.test(ukedag)) return 7
  return ukedag === '*' ? 1 : null
}

/** Intervallet for hver kilde, fra Vercels cron-oppsett. */
export function kildeintervaller(crons: readonly { path: string; schedule: string }[] = vercel.crons): Partial<Record<Datakilde, number>> {
  const intervaller: Partial<Record<Datakilde, number>> = {}
  for (const kilde of DATAKILDER) {
    const cron = crons.find((c) => c.path === KILDEOPPSETT[kilde].synk)
    const dogn = cron ? intervallDogn(cron.schedule) : null
    if (dogn) intervaller[kilde] = dogn
  }
  return intervaller
}

export type Tilstand = 'ok' | 'advarsel' | 'feil'

export interface Kildevurdering {
  kilde: Datakilde
  navn: string
  tilstand: Tilstand
  /** Én setning om hvordan det står til. */
  melding: string
  siste: Kjoring | null
  sisteVellykkede: Kjoring | null
  /** Når siste vellykkede henting var, også når den er eldre enn kjøringene som er med. */
  sistVellykketKl: string | null
  /** Siste kjente release og versjon, fra en vellykket kjøring. */
  release: string | null
  versjon: string | null
  /** Døgn mellom de planlagte kjøringene, fra `vercel.json`. */
  intervall: number | null
  /** Nyest først. */
  kjoringer: Kjoring[]
  /** Nyest først. */
  endringer: Endring[]
}

function dogn(ms: number): string {
  const antall = Math.floor(ms / DOGN_MS)
  return antall === 1 ? '1 døgn' : `${antall} døgn`
}

/** «Nattlig jobb», «Ukentlig jobb»: hva som kjører kilden når ingen ber om det. */
export function jobbnavn(intervall: number | null): string {
  return intervall === 1 ? 'Nattlig jobb' : intervall === 7 ? 'Ukentlig jobb' : 'Planlagt jobb'
}

/** Feilteksten uten punktum til slutt, så den kan stå inne i en setning. */
function setning(tekst: string): string {
  return tekst.replace(/[\s.]+$/, '')
}

function flertall(antall: number, en: string, flere: string): string {
  return `${antall} ${antall === 1 ? en : flere}`
}

/** Hva en vellykket kjøring fant, for en kilde med endringslogg eller bare radtall. */
function funnet(kjoring: Kjoring, endringslogg: boolean): string {
  if (!endringslogg) {
    const r = kjoring.rader
    if (kjoring.status === 'uendret' || !r || r.nye + r.endrede + r.utgatte === 0) return 'Siste henting fant ingen endringer.'
    return `Siste henting byttet inn et nytt uttrekk (rader nye: ${r.nye}, endrede: ${r.endrede}, utgåtte: ${r.utgatte}).`
  }
  const { klinisk, metadata } = kjoring.endringer
  if (kjoring.status === 'uendret' || (klinisk === 0 && metadata === 0)) return 'Siste henting fant ingen endringer.'
  return klinisk > 0
    ? `Siste henting fant ${flertall(klinisk, 'klinisk endring', 'kliniske endringer')}.`
    : 'Siste henting fant bare endringer i metadata.'
}

/**
 * Hvordan det står til med hver kilde: feil når siste kjøring feilet, en
 * advarsel når den var delvis, henger, eller når det har gått mer enn
 * intervallet og ett døgn til siden siste vellykkede kjøring.
 */
export function vurderKilder(
  status: Datakildestatus,
  na: number = Date.now(),
  intervaller: Partial<Record<Datakilde, number>> = kildeintervaller(),
): Kildevurdering[] {
  return DATAKILDER.map((kilde) => {
    const { navn, etterFeil, beholdt: beholdtTekst, endringslogg } = KILDEOPPSETT[kilde]
    const intervall = intervaller[kilde] ?? null
    const kjoringer = status.kjoringer.filter((k) => k.kilde === kilde).sort((a, b) => b.id - a.id)
    const endringer = status.endringer.filter((e) => e.kilde === kilde)
    const siste = kjoringer[0] ?? null
    const vellykkede = kjoringer.filter((k) => VELLYKKET.includes(k.status))
    const sisteVellykkede = vellykkede[0] ?? null
    const kjent = (felt: 'release' | 'versjon') =>
      status.kilder?.[kilde]?.[felt] ?? vellykkede.find((k) => k[felt])?.[felt] ?? null
    const release = kjent('release')
    const versjon = kjent('versjon')
    const sistVellykketKl = sisteVellykkede
      ? (sisteVellykkede.avsluttet_kl ?? sisteVellykkede.startet_kl)
      : (status.kilder?.[kilde]?.sist_vellykket_kl ?? null)
    const vurdering = (tilstand: Tilstand, melding: string): Kildevurdering => ({
      kilde, navn, tilstand, melding, siste, sisteVellykkede, sistVellykketKl, release, versjon, intervall, kjoringer, endringer,
    })

    if (!siste) return vurdering('advarsel', `Ingen henting fra ${navn} er logget ennå.`)
    const beholdt =
      etterFeil ??
      (sistVellykketKl ? (beholdtTekst ?? 'Dataene fra siste vellykkede henting står.') : 'Ingen henting har lyktes ennå.')
    if (siste.status === 'feilet') {
      return vurdering('feil', `Siste henting feilet: ${setning(siste.feil ?? 'ukjent feil')}. ${beholdt}`)
    }
    if (siste.status === 'pagar') {
      return na - Date.parse(siste.startet_kl) > HENGER_ETTER_MS
        ? vurdering('advarsel', 'En henting har stått uferdig i over en halvtime og regnes som avbrutt ved neste start.')
        : vurdering('ok', 'Henter nå.')
    }

    const alder = sistVellykketKl ? na - Date.parse(sistVellykketKl) : Infinity
    if (intervall && alder > (intervall + 1) * DOGN_MS) {
      return vurdering('advarsel', `Ingen vellykket henting på ${dogn(alder)}; ${navn} hentes hver ${intervall === 7 ? 'uke' : 'natt'}.`)
    }
    if (siste.status === 'delvis') {
      const delvis = 'Siste henting var delvis: det som feilet eller ble utsatt, står med dataene fra før.'
      return vurdering('advarsel', siste.feil ? `${delvis} Feil: ${setning(siste.feil)}.` : delvis)
    }
    return vurdering('ok', funnet(siste, endringslogg))
  })
}

/* --- Visningen av en endring ------------------------------------------------ */

const ARTSNAVN: Record<Endringsart, string> = {
  ny: 'Ny',
  endret: 'Endret',
  fjernet: 'Fjernet',
  grunnlag: 'Første henting',
}

/** Hva typene heter på norsk, for kildene som har dem. Ukjente typer står som de er. */
const TYPENAVN: Record<string, string> = {
  kjemikalie: 'Legemiddel',
  retningslinje: 'Retningslinje',
  preparatomtale: 'Preparatomtale',
  klinisk: 'Klinisk annotasjon',
  legemiddel: 'Legemiddel',
  gen: 'Gen',
  par: 'Gen–legemiddel-par',
  anbefaling: 'Anbefaling',
  genresultat: 'Genresultat',
  genresultat_oppslag: 'Oppslag til genresultat',
  diplotype: 'Diplotype',
  allel: 'Allel',
  alleldefinisjon: 'Alleldefinisjon',
  publikasjon: 'Publikasjon',
  term: 'Term',
  endring: 'CPICs endringslogg',
}

/** «Endret · Anbefaling», «Ny · Retningslinje». */
export function endringstittel(e: Pick<Endring, 'art' | 'type'>): string {
  return `${ARTSNAVN[e.art]} · ${TYPENAVN[e.type] ?? e.type}`
}

/** Feltnavnet slik det vises: «annen veiledning», «rådata: history». */
export function feltnavn(felt: string): string {
  return felt.startsWith('raa.') ? `rådata: ${felt.slice(4)}` : felt.replace(/_/g, ' ')
}

/** Én linje om hvor endringen kom fra: kjøringen, kildens egen merknad, CPICs versjon for raden. */
export function sporlinje(e: Endring): string {
  const deler: string[] = []
  if (e.kontekst) deler.push(`for ${e.kontekst}`)
  const notat = erObjekt(e.spor.kildenotat) ? e.spor.kildenotat : null
  if (notat) {
    const dato = tekst(notat.dato)?.slice(0, 10)
    deler.push(['ClinPGx:', tekst(notat.merknad) ?? tekst(notat.type), dato && `(${dato})`].filter(Boolean).join(' '))
  }
  const versjon = e.spor.cpic_versjon
  if (erObjekt(versjon)) deler.push(`CPIC-versjon ${String(versjon.foer ?? '–')} → ${String(versjon.etter ?? '–')}`)
  else if (typeof versjon === 'number') deler.push(`CPIC-versjon ${versjon}`)
  if (typeof e.spor.antall === 'number') deler.push(`${e.spor.antall} rader`)
  return deler.join(' · ')
}

/** En verdi fra kilden som kort, lesbar tekst. */
export function visVerdi(verdi: unknown, maks = 400): string {
  if (verdi === null || verdi === undefined) return '–'
  const t = typeof verdi === 'string' ? verdi : JSON.stringify(verdi)
  return t.length > maks ? `${t.slice(0, maks - 1)}…` : t
}

/** Verdiene før og etter, felt for felt, for en endret føring. */
export function feltendringer(e: Endring): { felt: string; foer: string; etter: string }[] {
  if (e.art !== 'endret') return []
  const foer = erObjekt(e.foer) ? e.foer : {}
  const etter = erObjekt(e.etter) ? e.etter : {}
  return e.felt.map((felt) => {
    const nokkel = felt.startsWith('raa.') ? felt.slice(4) : felt
    return { felt: feltnavn(felt), foer: visVerdi(foer[nokkel]), etter: visVerdi(etter[nokkel]) }
  })
}

/* --- Kallene ---------------------------------------------------------------- */

export interface Hentingssvar {
  status: string
  feil?: string
}

export interface Datakildeleser {
  status(): Promise<Datakildestatus>
  /** Ber serveren hente fra kilden nå, med administratorens innlogging. */
  hentNa(kilde: Datakilde): Promise<Hentingssvar>
}

export function lagDatakildeleser(klient: SupabaseClient, hent: typeof fetch = (...a) => fetch(...a)): Datakildeleser {
  return {
    status: async () => {
      const { data, error } = await klient.rpc('datakilder_status', {})
      if (error) throw new Error(error.message)
      return lesDatakildestatus(data)
    },
    hentNa: async (kilde) => {
      const { data } = await klient.auth.getSession()
      const token = data.session?.access_token
      if (!token) throw new Error('Du må være logget inn.')
      const res = await hent(KILDEOPPSETT[kilde].synk, { method: 'POST', headers: { authorization: `Bearer ${token}` } })
      const svar = (await res.json().catch(() => null)) as Hentingssvar | { feil?: string } | null
      if (svar && 'status' in svar && typeof svar.status === 'string') return svar
      throw new Error((svar && 'feil' in svar && svar.feil) || `Serveren svarte ${res.status}.`)
    },
  }
}
