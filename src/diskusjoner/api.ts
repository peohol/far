/**
 * Kallene diskusjonene gjør mot Supabase. Trådene og kategoriene endres bare
 * gjennom funksjonene i databasen, som håndhever reglene (ingen sletting,
 * unike navn og emojier, arkivet som fryser); kommentarene og hjertene går
 * rett mot tabellene, der radsikkerheten avgjør hvem som får gjøre hva.
 */
import { hentInnstilling, lagreInnstilling } from '../auth/innstillinger'
import { klient } from '../auth/klient'
import type { Riktekstdokument } from '../faginnhold/riktekst'
import {
  lesDiskusjonsoversikt,
  lesDiskusjonstekster,
  lesDiskusjonstraad,
  type Diskusjonsoversikt,
  type Diskusjonsside,
  type Diskusjonstekster,
  type Diskusjonstraad,
} from './modell'

const FEIL = 'Noe gikk galt. Prøv igjen.'

interface Databasefeil {
  code?: string
  message?: string
}

/** Unike navn og emojier: brudd på dem sies med det samme som skjemaet sier. */
const UNIKE: Record<string, string> = {
  diskusjonskategorier_navn_idx: 'En annen kategori på siden har det navnet.',
  diskusjonskategorier_emoji_idx: 'En annen kategori på siden har den emojien.',
}

/**
 * Feilen gjort om til noe som kan vises. Funksjonene i databasen skriver
 * meldingene sine på norsk, med stor forbokstav; Postgres' egne meldinger
 * begynner med liten, og er ikke skrevet for brukeren.
 */
export function tilFeil(feil: Databasefeil): Error {
  const melding = feil.message ?? ''
  if (feil.code === '23505') {
    const brudd = Object.keys(UNIKE).find((indeks) => melding.includes(indeks))
    if (brudd) return new Error(UNIKE[brudd])
  }
  if (feil.code === '23514') return new Error('Det som ble skrevet, ble ikke godtatt. Kontroller feltene og prøv igjen.')
  return new Error(/^\p{Lu}/u.test(melding) ? melding : FEIL)
}

function sjekk<T>({ data, error }: { data: T; error: Databasefeil | null }): T {
  if (error) throw tilFeil(error)
  return data
}

function id(verdi: unknown): string {
  if (typeof verdi !== 'string') throw new Error(FEIL)
  return verdi
}

/* --- Lesing ------------------------------------------------------------------ */

export async function hentDiskusjoner(side: Diskusjonsside): Promise<Diskusjonsoversikt> {
  return lesDiskusjonsoversikt(sjekk(await klient().rpc('diskusjonsoversikt', { side })))
}

export async function hentDiskusjonstraad(diskusjon: string): Promise<Diskusjonstraad | null> {
  return lesDiskusjonstraad(sjekk(await klient().rpc('diskusjonstraad', { diskusjon })))
}

export async function hentDiskusjonstekster(side: Diskusjonsside): Promise<Diskusjonstekster[]> {
  return lesDiskusjonstekster(sjekk(await klient().rpc('diskusjonstekster', { side })))
}

/** Merker tråden som sett slik den var da den ble lest. */
export async function merkDiskusjonSett(traad: Pick<Diskusjonstraad, 'id' | 'lest_kl'>): Promise<void> {
  if (!traad.lest_kl) return
  sjekk(await klient().rpc('merk_diskusjon_sett', { diskusjon: traad.id, lest_kl: traad.lest_kl }))
}

/* --- Kategoriene ------------------------------------------------------------- */

export async function opprettKategori(side: Diskusjonsside, navn: string, emoji: string): Promise<string> {
  return id(sjekk(await klient().rpc('opprett_diskusjonskategori', { side, navn: navn.trim(), emoji: emoji.trim() })))
}

export async function endreKategori(kategori: string, navn: string, emoji: string): Promise<void> {
  sjekk(await klient().rpc('endre_diskusjonskategori', { kategori, navn: navn.trim(), emoji: emoji.trim() }))
}

export async function flyttKategoriTil(kategori: string, indeks: number): Promise<void> {
  sjekk(await klient().rpc('flytt_diskusjonskategori', { kategori, indeks }))
}

/** Sletter kategorien. Trådene i den havner under «Ukategoriserte». */
export async function losOppKategori(kategori: string): Promise<void> {
  sjekk(await klient().rpc('los_opp_diskusjonskategori', { kategori }))
}

/* --- Trådene ------------------------------------------------------------------ */

export interface Nydiskusjon {
  tittel: string
  tekst: Riktekstdokument | null
  /** En kategori på siden, eller en ny, som lages sammen med tråden. */
  kategori: { id: string } | { navn: string; emoji: string }
}

/** Lager tråden, og kategorien den skal i når den er ny. Gir ID-en til tråden. */
export async function opprettDiskusjon(side: Diskusjonsside, ny: Nydiskusjon): Promise<string> {
  const kategori = 'id' in ny.kategori ? { kategori: ny.kategori.id } : { kategori: null, ny_kategori: ny.kategori.navn.trim(), ny_emoji: ny.kategori.emoji.trim() }
  return id(sjekk(await klient().rpc('opprett_diskusjon', { side, tittel: ny.tittel.trim(), tekst: ny.tekst, ...kategori })))
}

/** Ny overskrift. Alle kan endre den. */
export async function settTittel(diskusjon: string, tittel: string): Promise<void> {
  sjekk(await klient().rpc('sett_diskusjonstittel', { diskusjon, tittel: tittel.trim() }))
}

/** Nytt første innlegg. Bare den som skrev tråden. */
export async function settTekst(diskusjon: string, tekst: Riktekstdokument | null): Promise<void> {
  sjekk(await klient().rpc('sett_diskusjonstekst', { diskusjon, tekst }))
}

export async function flyttDiskusjonTil(diskusjon: string, kategori: string, indeks: number): Promise<void> {
  sjekk(await klient().rpc('flytt_diskusjon', { diskusjon, kategori, indeks }))
}

/** Legger tråden i arkivet, eller henter den tilbake (sist i kategorien sin). */
export async function arkiverDiskusjon(diskusjon: string, arkivert: boolean): Promise<void> {
  sjekk(await klient().rpc('arkiver_diskusjon', { diskusjon, arkivert }))
}

/** En administrator fjerner teksten i det første innlegget, eller i en kommentar, for godt. */
export async function skjulInnhold(diskusjon: string, kommentar: string | null): Promise<void> {
  sjekk(await klient().rpc('skjul_i_diskusjon', { diskusjon, kommentar }))
}

/* --- Kommentarene og hjertene ---------------------------------------------------- */

export async function opprettKommentar(diskusjon: string, forelder: string | null, tekst: Riktekstdokument): Promise<void> {
  sjekk(await klient().from('diskusjonskommentarer').insert({ diskusjon_id: diskusjon, forelder_id: forelder, tekst }))
}

export async function endreKommentar(kommentar: string, tekst: Riktekstdokument): Promise<void> {
  sjekk(await klient().from('diskusjonskommentarer').update({ tekst }).eq('id', kommentar))
}

/** Bare forfatteren. En kommentar med svar står igjen som «Slettet»; databasen avgjør det. */
export async function slettKommentar(kommentar: string): Promise<void> {
  sjekk(await klient().from('diskusjonskommentarer').delete().eq('id', kommentar))
}

/** Gir eller tar tilbake hjertet på tråden eller en kommentar i den. Et hjerte som alt står der, er ingen feil. */
export async function settHjerte(diskusjon: string, kommentar: string | null, bruker: string, gitt: boolean): Promise<void> {
  const tabell = klient().from('diskusjonshjerter')
  if (gitt) {
    const { error } = await tabell.insert({ diskusjon_id: diskusjon, kommentar_id: kommentar })
    if (error && error.code !== '23505') throw tilFeil(error)
    return
  }
  const slett = tabell.delete().eq('diskusjon_id', diskusjon).eq('bruker_id', bruker)
  sjekk(await (kommentar ? slett.eq('kommentar_id', kommentar) : slett.is('kommentar_id', null)))
}

/* --- Menyen ------------------------------------------------------------------------ */

/** Nøkkelen i brukerinnstillingene for om menyen holdes åpen. */
export const LAASNOKKEL = 'diskusjoner.laast'

export async function hentLaast(): Promise<boolean | null> {
  const verdi = await hentInnstilling(LAASNOKKEL)
  return typeof verdi === 'boolean' ? verdi : null
}

export function lagreLaast(laast: boolean): Promise<void> {
  return lagreInnstilling(LAASNOKKEL, laast)
}
