/**
 * Kurateringsgrenene slik appen ser dem (`docs/kurateringsgrener.md`): det
 * `kuratering_admin` gir tilbake, og navnene og reglene visningen trenger.
 * Databasen avgjør alt; dette er bare formen på svarene og ordene for dem.
 */
import { tidspunkt } from '../faginnhold/historikk'
import type { Stoffsidedata } from '../faginnhold/lesing'

export type Grenstatus =
  | 'arbeid'
  | 'klar'
  | 'tilbakemelding'
  | 'retting'
  | 'godkjent'
  | 'publisert'
  | 'stanset'
  | 'blokkert'
  | 'arkivert'

export type Grenart = 'kuratering' | 'de_novo' | 'gjenoppretting'

export const STATUSNAVN: Record<Grenstatus, string> = {
  arbeid: 'Under arbeid',
  klar: 'Til kontroll',
  tilbakemelding: 'Endringer etterspurt',
  retting: 'Rettes',
  godkjent: 'Godkjent',
  publisert: 'Publisert',
  stanset: 'Stanset',
  blokkert: 'Blokkert',
  arkivert: 'Forkastet',
}

export const ARTSNAVN: Record<Grenart, string> = {
  kuratering: 'Kuratering',
  de_novo: 'De novo-kuratering',
  gjenoppretting: 'Gjenoppretting',
}

/** Hvem som har neste handling i en aktiv gren. */
export const NESTE_HANDLING: Partial<Record<Grenstatus, string>> = {
  arbeid: 'kuratoren arbeider',
  retting: 'kuratoren retter',
  tilbakemelding: 'kuratoren skal rette',
  blokkert: 'kuratoren må oppdatere grenen',
  klar: 'kontrolløren vurderer',
  godkjent: 'klar til publisering',
  stanset: 'en administrator må gjenoppta den',
}

/** Statusene der grenen fortsatt kan endres eller publiseres. */
const AKTIVE: readonly Grenstatus[] = ['arbeid', 'klar', 'tilbakemelding', 'retting', 'godkjent', 'stanset', 'blokkert']

export function erAktiv(status: Grenstatus): boolean {
  return AKTIVE.includes(status)
}

/** Det kuratoren sist sa den gjorde. */
export interface Aktivitet {
  tekst: string
  seksjon?: string
  objekt?: string
  kl: string
}

/** Den lille statusen til en gren (`status`), uten fagtekst: det appen spør etter for å se om noe er nytt. */
export interface Grenstatusdata {
  id: string
  status: Grenstatus
  revisjon: number
  runde: number
  blindfase: boolean
  aktivitet?: Aktivitet
  oppdatert_kl: string
  /** Sist kuratoren gjorde noe i denne grenen. */
  kurator_sist_kl?: string
  apne_sperrer: number
  /** Den siste hendelsen i grenen utenom aktiviteten; øker ved hver revisjon, kommentar, dokument og vurdering. */
  endring: number
}

/** Hva agenten gjør, slik «Følg agenten» viser det. */
export type Agenttilstand = 'aktiv' | 'venter' | 'stanset' | 'avsluttet' | 'brutt'

export const AGENTTILSTANDSNAVN: Record<Agenttilstand, string> = {
  aktiv: 'Agenten arbeider',
  venter: 'Venter',
  stanset: 'Stanset',
  avsluttet: 'Avsluttet',
  brutt: 'Tilkoblingen er brutt',
}

/** Hvor lenge en melding fra kuratoren regnes som tegn på at den arbeider. */
export const AKTIV_I_MINUTTER = 10

/** Statusene der kuratoren har neste handling. */
const KURATORENS_TUR: readonly Grenstatus[] = ['arbeid', 'retting', 'blokkert', 'tilbakemelding']

/**
 * Hva agenten gjør ut fra statusen. «Aktiv» bare med belegg: kuratoren har
 * meldt aktivitet eller gjort noe i denne grenen de siste minuttene, og det
 * er dens tur.
 */
export function agenttilstand(status: Grenstatusdata | null, brutt: boolean, naa = Date.now()): Agenttilstand {
  if (brutt) return 'brutt'
  if (!status) return 'venter'
  if (status.status === 'stanset') return 'stanset'
  if (!erAktiv(status.status)) return 'avsluttet'
  const sist = Math.max(Date.parse(status.aktivitet?.kl ?? '') || 0, Date.parse(status.kurator_sist_kl ?? '') || 0)
  return KURATORENS_TUR.includes(status.status) && naa - sist < AKTIV_I_MINUTTER * 60_000 ? 'aktiv' : 'venter'
}

/**
 * Om noe i grenen er endret siden den ble lest, så den må leses på nytt: en
 * ny hendelse (en revisjon, en kommentar, et svar, et dokument, en vurdering)
 * eller en annen status. Aktiviteten alene teller ikke.
 */
export function grenenErEndret(
  gren: Pick<Grensammendrag, 'status' | 'revisjon' | 'runde'> & { traader?: Traad[]; endring?: number },
  status: Grenstatusdata,
): boolean {
  const sperrer = (gren.traader ?? []).filter((t) => t.status === 'apen' && t.art === 'sperrende').length
  return (
    status.endring > (gren.endring ?? 0) ||
    status.revisjon !== gren.revisjon ||
    status.status !== gren.status ||
    status.runde !== gren.runde ||
    status.apne_sperrer !== sperrer
  )
}

/** En KI-agent som kan arbeide i grenene (`agenter`). */
export interface Agentinfo {
  agent: string
  navn: string
  roller: ('kurator' | 'kontrollor')[]
  aktiv: boolean
  har_nokkel: boolean
  nokkel_kl?: string
  sist_sett_kl?: string
}

export const ROLLENAVN: Record<Agentinfo['roller'][number], string> = { kurator: 'Kurator', kontrollor: 'Kontrollør' }

/** Adressene en agent kaller med nøkkelen: HTTP, og MCP med nøkkelen i adressen for klienter som ikke kan sende den som overskrift. */
export function agentadresser(opphav: string, nokkel: string): { http: string; mcp: string } {
  return { http: `${opphav}/api/kuratering`, mcp: `${opphav}/api/kuratering-mcp?nokkel=${encodeURIComponent(nokkel)}` }
}

/** En gren kort, uten fagtekst (`kuratering.sammendrag`). */
export interface Grensammendrag {
  id: string
  stoff: string
  navn?: string
  art: Grenart
  formaal: string
  status: Grenstatus
  status_grunn?: string
  runde: number
  revisjon: number
  blindfase: boolean
  kurator?: string
  opprettet_av?: string
  grunnversjon: number
  konflikt: boolean
  teknisk_ok?: boolean
  aktivitet?: Aktivitet
  opprettet_kl: string
  oppdatert_kl: string
  publisert_kl?: string
  publisert_versjon?: number
}

/** Prøvepubliseringen av en revisjon. */
export interface Teknisk {
  ok: boolean
  feil?: string
  kode?: string
  detalj?: string
  rapport_ok: boolean
  rapportfeil?: string
  seksjoner?: { seksjon: string; art: string }[]
  kontrollert_kl: string
}

/** Fagsiden og bivirkningene slik de blir publisert, i samme form som `les_stoff` og `les_bivirkninger`. */
export interface Forhandsvisning {
  stoff: Partial<Stoffsidedata> | null
  bivirkninger: unknown
}

export interface Grenrevisjon {
  revisjon: number
  fingeravtrykk: string
  melding?: string
  av?: string
  kl: string
  teknisk?: Teknisk
  forhandsvisning?: Forhandsvisning
}

export interface Vurdering {
  revisjon: number
  beslutning: 'godkjent' | 'endringer'
  begrunnelse: string
  av: string
  kl: string
  gjelder_denne: boolean
}

export interface Grenhendelse {
  hendelse: string
  fra?: Grenstatus
  til?: Grenstatus
  revisjon: number
  av?: string
  data?: Record<string, unknown>
  kl: string
}

/** Det en kommentartråd er festet til. */
export interface Anker {
  objekt?: string
  felt?: string
  seksjon?: string
  referanse?: string
  kilde?: string
  dokument?: string
}

export interface Kommentar {
  id: string
  handling: 'kommentar' | 'lukket' | 'gjenapnet'
  tekst: string
  revisjon: number
  av?: string
  /** Skrevet av kuratoren av grenen. */
  kurator?: boolean
  kl: string
}

/** En kommentartråd i en gren (`kuratering.traader`). */
export interface Traad {
  id: string
  art: 'merknad' | 'sperrende'
  anker?: Anker
  revisjon: number
  status: 'apen' | 'lukket'
  venter_pa_kurator?: boolean
  apnet_av?: string
  kommentarer: Kommentar[]
}

/** En gren i sin helhet (`kuratering.detaljer`). */
export interface Grendetaljer extends Grensammendrag {
  grenrevisjon: Grenrevisjon | null
  /** Grunnversjonen i samme form som `les_sideversjon`. */
  grunnlag: Sideversjonsdata | null
  vurderinger: Vurdering[]
  hendelser: Grenhendelse[]
  dokumenter: { art: string; versjon: number; kl: string }[]
  hindringer: string[]
  manglende_dokumenter: string[]
  /** Hvor langt grenen var kommet da den ble lest (`Grenstatusdata.endring`). */
  endring?: number
  /** Bare når grenen nettopp er laget av en gjenoppretting. */
  merknader?: string[]
  /** Kommentartrådene, sperrende og åpne først. */
  traader?: Traad[]
}

/** Hvem som sto for en versjon, slik endringsloggen viser det. */
export interface Versjonsendring {
  aktor?: string
  art?: string
  agent?: string
  fornavn?: string
  etternavn?: string
  oppsummering?: string
}

export type Versjonsopphav = 'basis' | 'publisering' | 'gren' | 'gjenoppretting'

export const OPPHAVSNAVN: Record<Versjonsopphav, string> = {
  basis: 'Utgangspunkt',
  publisering: 'Publisering',
  gren: 'Kuratering',
  gjenoppretting: 'Gjenoppretting',
}

/** Én versjon i lista (`les_sideversjoner`). */
export interface Versjonsinfo {
  nr: number
  opphav: Versjonsopphav
  opprettet_kl: string
  fingeravtrykk: string
  endring?: Versjonsendring
  antall?: { elementer: number; referanser: number; bivirkninger: number }
}

/** Én versjon med innholdet (`les_sideversjon`). */
export interface Sideversjonsdata extends Partial<Stoffsidedata> {
  versjon: Versjonsinfo
}

/** Hvem en versjon kom fra, til visning: agenten, eller personen. */
export function versjonensOpphav(endring: Versjonsendring | undefined): string {
  if (!endring) return ''
  if (endring.agent) return endring.agent
  return [endring.fornavn, endring.etternavn].filter(Boolean).join(' ')
}

/** Kort om en versjon: opphavet, når og hvem. */
export function versjonslinje(v: Versjonsinfo): string {
  return [OPPHAVSNAVN[v.opphav], tidspunkt(v.opprettet_kl), versjonensOpphav(v.endring)].filter(Boolean).join(' · ')
}

/** Om en administrator kan publisere grenen nå. */
export function kanPubliseres(gren: Pick<Grendetaljer, 'status' | 'art' | 'hindringer'>): boolean {
  const status = gren.status === 'godkjent' || (gren.art === 'gjenoppretting' && gren.status === 'arbeid')
  return status && gren.hindringer.length === 0
}
