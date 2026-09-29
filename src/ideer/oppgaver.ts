/**
 * Planlagte oppgaver: idéer en administrator har overført, med prompten en
 * språkmodell skal utføre dem etter. Rene funksjoner; kallene står i `api.ts`
 * og reglene i migrasjonen `*_ideer_arkiv_og_oppgaver.sql`.
 */
import { ENDRINGSLOGG } from '../data/endringslogg'
import { erObjekt, tallEllerNull, tekst, tekstEllerNull } from './lesing'
import { erKategori, erOppgavestatus, type Idekategori, type Oppgavestatus } from './modell'

/** En oppgave slik lista viser den, uten prompten. */
export interface Oppgave {
  id: string
  ide_id: string
  /** Overskriften på idéen oppgaven kom fra. */
  tittel: string
  kategori: Idekategori
  forfatter_id: string
  status: Oppgavestatus
  /** Settes når oppgaven er utført, og vises som «OPG-001». */
  nummer: number | null
  /** Versjonen i endringsloggen der det står hva som ble gjort. */
  endringslogg: string | null
  har_prompt: boolean
  overfort_kl: string
  endret_kl: string | null
  klar_kl: string | null
  utfort_kl: string | null
}

export interface Oppgavedetaljer extends Oppgave {
  prompt: string
}

/** Statusene som er arbeid som gjenstår, i den rekkefølgen lista viser dem. */
export const AKTIVE_STATUSER = ['ikke_paabegynt', 'under_arbeid', 'klar'] as const satisfies readonly Oppgavestatus[]

/** Lengste prompt. Samme grense som databasen setter. */
export const PROMPT_MEST = 50_000

function lesOppgaverad(rad: unknown): Oppgave | null {
  if (!erObjekt(rad) || !erOppgavestatus(rad.status) || !erKategori(rad.kategori)) return null
  const id = tekst(rad.id)
  const ideId = tekst(rad.ide_id)
  if (!id || !ideId) return null
  return {
    id,
    ide_id: ideId,
    tittel: tekst(rad.tittel),
    kategori: rad.kategori,
    forfatter_id: tekst(rad.forfatter_id),
    status: rad.status,
    nummer: tallEllerNull(rad.nummer),
    endringslogg: tekstEllerNull(rad.endringslogg),
    har_prompt: rad.har_prompt === true,
    overfort_kl: tekst(rad.overfort_kl),
    endret_kl: tekstEllerNull(rad.endret_kl),
    klar_kl: tekstEllerNull(rad.klar_kl),
    utfort_kl: tekstEllerNull(rad.utfort_kl),
  }
}

/** Oppgavelista fra `oppgaveoversikt()`. Rader som ikke har formen, utelates. */
export function lesOppgaveoversikt(data: unknown): Oppgave[] {
  return Array.isArray(data) ? data.flatMap((rad) => lesOppgaverad(rad) ?? []) : []
}

/** Én oppgave fra `oppgave()`, eller `null` når den ikke finnes. */
export function lesOppgave(data: unknown): Oppgavedetaljer | null {
  const oppgave = lesOppgaverad(data)
  return oppgave && erObjekt(data) ? { ...oppgave, prompt: tekst(data.prompt) } : null
}

export interface Oppgavegrupper {
  /** De tre statusene med arbeid igjen, også de uten oppgaver. */
  aktive: { status: (typeof AKTIVE_STATUSER)[number]; oppgaver: Oppgave[] }[]
  /** De utførte, de sist utførte først. */
  utforte: Oppgave[]
}

/**
 * Oppgavene under statusene. Arbeidet som gjenstår, står med de eldste
 * først, i den rekkefølgen de ble overført; de utførte med de nyeste først.
 */
export function grupperOppgaver(oppgaver: readonly Oppgave[]): Oppgavegrupper {
  const eldstForst = [...oppgaver].sort((a, b) => Date.parse(a.overfort_kl) - Date.parse(b.overfort_kl) || a.id.localeCompare(b.id))
  return {
    aktive: AKTIVE_STATUSER.map((status) => ({ status, oppgaver: eldstForst.filter((o) => o.status === status) })),
    utforte: eldstForst
      .filter((o) => o.status === 'utfort')
      .sort((a, b) => Date.parse(b.utfort_kl ?? '') - Date.parse(a.utfort_kl ?? '') || (b.nummer ?? 0) - (a.nummer ?? 0)),
  }
}

/**
 * Om versjonen står i endringsloggen appen har. En oppgave kan være merket
 * utført før versjonen er publisert; da finnes ingen føring å vise ennå.
 */
export function iEndringsloggen(versjon: string | null): versjon is string {
  return versjon !== null && ENDRINGSLOGG.some((e) => e.versjon === versjon)
}
