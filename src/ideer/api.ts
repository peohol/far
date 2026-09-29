/**
 * Kallene idéene gjør mot Supabase. Lesingen går gjennom `ideoversikt()` og
 * `idetraad()`, som teller opp hjertene og kommentarene; skrivingen går rett
 * mot tabellene, der radsikkerheten avgjør hvem som får gjøre hva.
 */
import { hentInnstilling, lagreInnstilling } from '../auth/innstillinger'
import { klient } from '../auth/klient'
import type { Riktekstdokument } from '../faginnhold/riktekst'
import {
  SORTERINGSNOKKEL,
  lesIdeoversikt,
  lesIdetraad,
  lesSortering,
  type Ide,
  type Idekategori,
  type Idetraad,
  type Sortering,
} from './modell'
import { lesOppgave, lesOppgaveoversikt, type Oppgave, type Oppgavedetaljer } from './oppgaver'

const FEIL = 'Noe gikk galt. Prøv igjen.'

/** Kaster en lesbar feil når Supabase svarte med en. */
function sjekk<T>({ data, error }: { data: T; error: unknown }): T {
  if (error) throw new Error(FEIL)
  return data
}

export async function hentIdeer(): Promise<Ide[]> {
  return lesIdeoversikt(sjekk(await klient().rpc('ideoversikt')))
}

export async function hentIdetraad(id: string): Promise<Idetraad | null> {
  return lesIdetraad(sjekk(await klient().rpc('idetraad', { ide: id })))
}

/**
 * Merker idéen som sett slik tråden var da den ble lest, så kommentarene i den
 * ikke lenger er nye. En kommentar som kom etterpå, forblir ny.
 */
export async function merkIdeSett(traad: Pick<Idetraad, 'id' | 'lest_kl'>): Promise<void> {
  if (!traad.lest_kl) return
  sjekk(await klient().rpc('merk_ide_sett', { ide: traad.id, lest_kl: traad.lest_kl }))
}

/** Hvor mange idéer som har kommentarer den innloggede ikke har sett. */
export async function hentIdeerMedNytt(): Promise<number> {
  const antall = sjekk(await klient().rpc('ideer_med_nytt'))
  return typeof antall === 'number' ? antall : 0
}

/* --- Arkivet og oppgavene: databasen avviser andre enn administratorer ------- */

/** «Ikke aktuelt»: idéen legges i arkivet. */
export async function arkiverIde(id: string): Promise<void> {
  sjekk(await klient().rpc('arkiver_ide', { ide: id }))
}

/** Henter idéen tilbake fra arkivet. */
export async function gjenopprettIde(id: string): Promise<void> {
  sjekk(await klient().rpc('gjenopprett_ide', { ide: id }))
}

/** Sletter idéer som har stått i arkivet lenger enn fristen. */
export async function ryddIdearkiv(): Promise<void> {
  sjekk(await klient().rpc('rydd_idearkiv'))
}

/** Gjør idéen til en planlagt oppgave og gir ID-en til oppgaven. */
export async function overforIde(id: string): Promise<string> {
  const oppgave = sjekk(await klient().rpc('overfor_ide', { ide: id }))
  if (typeof oppgave !== 'string') throw new Error(FEIL)
  return oppgave
}

/** Flytter oppgaven tilbake til idélista. */
export async function flyttOppgaveTilbake(id: string): Promise<void> {
  sjekk(await klient().rpc('flytt_oppgave_tilbake', { oppgave: id }))
}

export async function hentOppgaver(): Promise<Oppgave[]> {
  return lesOppgaveoversikt(sjekk(await klient().rpc('oppgaveoversikt')))
}

export async function hentOppgave(id: string): Promise<Oppgavedetaljer | null> {
  return lesOppgave(sjekk(await klient().rpc('oppgave', { oppgave: id })))
}

export async function lagreOppgaveprompt(id: string, prompt: string): Promise<void> {
  sjekk(await klient().rpc('lagre_oppgaveprompt', { oppgave: id, prompt }))
}

/** Klar til implementering, eller tilbake til under arbeid. */
export async function settOppgaveKlar(id: string, klar: boolean): Promise<void> {
  sjekk(await klient().rpc('sett_oppgave_klar', { oppgave: id, klar }))
}

export interface Ideinnhold {
  kategori: Idekategori
  tittel: string
  tekst: Riktekstdokument | null
}

/** Lagrer en ny idé og gir ID-en tilbake. */
export async function opprettIde(innhold: Ideinnhold): Promise<string> {
  const rad = sjekk(await klient().from('ideer').insert(innhold).select('id').single())
  return (rad as { id: string }).id
}

export async function endreIde(id: string, innhold: Ideinnhold): Promise<void> {
  sjekk(await klient().from('ideer').update(innhold).eq('id', id))
}

export async function slettIde(id: string): Promise<void> {
  sjekk(await klient().from('ideer').delete().eq('id', id))
}

export async function opprettKommentar(ide: string, forelder: string | null, tekst: Riktekstdokument): Promise<void> {
  sjekk(await klient().from('idekommentarer').insert({ ide_id: ide, forelder_id: forelder, tekst }))
}

export async function endreKommentar(id: string, tekst: Riktekstdokument): Promise<void> {
  sjekk(await klient().from('idekommentarer').update({ tekst }).eq('id', id))
}

/** En kommentar med svar står igjen uten tekst; databasen avgjør det. */
export async function slettKommentar(id: string): Promise<void> {
  sjekk(await klient().from('idekommentarer').delete().eq('id', id))
}

/**
 * Gir eller tar tilbake hjertet på en idé, eller på en kommentar i den. Et
 * hjerte som alt står der (fra en annen fane), er ingen feil.
 */
export async function settHjerte(
  ide: string,
  kommentar: string | null,
  bruker: string,
  gitt: boolean,
): Promise<void> {
  const tabell = klient().from('idehjerter')
  if (gitt) {
    const { error } = await tabell.insert({ ide_id: ide, kommentar_id: kommentar })
    if (error && (error as { code?: string }).code !== '23505') throw new Error(FEIL)
    return
  }
  const slett = tabell.delete().eq('ide_id', ide).eq('bruker_id', bruker)
  sjekk(await (kommentar ? slett.eq('kommentar_id', kommentar) : slett.is('kommentar_id', null)))
}

export async function hentSortering(): Promise<Sortering> {
  return lesSortering(await hentInnstilling(SORTERINGSNOKKEL).catch(() => null))
}

export function lagreSortering(sortering: Sortering): Promise<void> {
  return lagreInnstilling(SORTERINGSNOKKEL, sortering)
}
