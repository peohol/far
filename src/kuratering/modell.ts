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
  /** Bare når grenen nettopp er laget av en gjenoppretting. */
  merknader?: string[]
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
