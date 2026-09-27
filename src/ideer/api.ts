/**
 * Kallene idéene gjør mot Supabase. Lesingen går gjennom `ideoversikt()` og
 * `idetraad()`, som teller opp hjertene og kommentarene; skrivingen går rett
 * mot tabellene, der radsikkerheten avgjør hvem som får gjøre hva.
 */
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
  const { data, error } = await klient()
    .from('brukerinnstillinger')
    .select('verdi')
    .eq('nokkel', SORTERINGSNOKKEL)
    .maybeSingle()
  return lesSortering(error ? null : (data as { verdi?: unknown } | null)?.verdi)
}

export async function lagreSortering(sortering: Sortering): Promise<void> {
  sjekk(
    await klient()
      .from('brukerinnstillinger')
      .upsert({ nokkel: SORTERINGSNOKKEL, verdi: sortering }, { onConflict: 'bruker_id,nokkel' }),
  )
}
