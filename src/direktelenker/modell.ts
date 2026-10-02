/**
 * Det en direktelenke peker på, slik databasen beskriver det
 * (`direktelenke()`), og navnet lenkebrikken i en tekst står med. Alt her er
 * rene funksjoner; oppslaget står i `api.ts`, og formen på lenkene i `mal.ts`.
 */
import { visningsnavn } from '@delt/profil'
import { UKATEGORISERTE, lesDiskusjonsside, type Diskusjonsside } from '../diskusjoner/modell'
import { klartekst, rensDokument } from '../faginnhold/riktekst'
import { KATEGORINAVN, erKategori, type Idekategori } from '../ideer/modell'
import { erObjekt, tall, tekst, tekstEllerNull } from '../ideer/lesing'
import type { Lenkemal } from './mal'

/** En kommentar lenken peker på, med det forhåndsvisningen viser. */
export interface Lenkekommentar {
  /** Navnet til den som skrev den, eller `null` når den er slettet. */
  forfatter: string | null
  opprettet_kl: string
  /** Begynnelsen av teksten. Tom når kommentaren er slettet eller skjult. */
  utdrag: string
  slettet: boolean
  skjult: boolean
}

interface Felles {
  mal: Lenkemal
  tittel: string
  forfatter: string | null
  opprettet_kl: string
  /** Begynnelsen av det første innlegget eller beskrivelsen. */
  utdrag: string
  /** En administrator har skjult det første innlegget (bare diskusjonene). */
  skjult: boolean
  arkivert: boolean
  /** Kommentarene som står, uten de slettede. */
  kommentarer: number
  /** Kommentaren lenken peker på, når den peker på en. */
  kommentar: Lenkekommentar | null
}

export type Lenkemaal =
  | (Felles & {
      slag: 'diskusjon'
      side: Diskusjonsside
      /** Kategorien i tråden; «Ukategoriserte» når den ikke har noen. */
      kategori: { navn: string; emoji: string }
    })
  | (Felles & { slag: 'ide'; idekategori: Idekategori; overfort: boolean })

/** Lengste utdrag forhåndsvisningen viser. */
export const UTDRAG_MEST = 280

/** Teksten i en riktekst på én linje, kortet ned til `mest` tegn. */
export function utdrag(verdi: unknown, mest = UTDRAG_MEST): string {
  const linje = klartekst(rensDokument(verdi)).replace(/\s+/g, ' ').trim()
  return linje.length > mest ? `${linje.slice(0, mest - 1).trimEnd()}…` : linje
}

function forfatternavn(verdi: unknown): string | null {
  if (!erObjekt(verdi)) return null
  const navn = visningsnavn({ first_name: tekst(verdi.first_name), last_name: tekst(verdi.last_name), username: tekst(verdi.username) })
  return navn || null
}

function lesKommentar(verdi: unknown): Lenkekommentar | null {
  if (!erObjekt(verdi)) return null
  const slettet = verdi.slettet === true
  const skjult = !slettet && verdi.skjult === true
  return {
    forfatter: slettet ? null : forfatternavn(verdi.forfatter),
    opprettet_kl: tekst(verdi.opprettet_kl),
    utdrag: slettet || skjult ? '' : utdrag(verdi.tekst),
    slettet,
    skjult,
  }
}

/**
 * Svaret fra `direktelenke()`, lest. `null` når det ikke har formen, ikke er
 * det målet ba om, eller når målet var en kommentar og den mangler.
 */
export function lesLenkemaal(mal: Lenkemal, verdi: unknown): Lenkemaal | null {
  if (!erObjekt(verdi) || verdi.slag !== mal.slag || tekst(verdi.id).toLowerCase() !== mal.id) return null
  const kommentar = mal.kommentar ? lesKommentar(verdi.kommentar) : null
  if (mal.kommentar && !kommentar) return null
  const skjult = verdi.skjult === true
  const felles: Felles = {
    mal,
    tittel: tekst(verdi.tittel),
    forfatter: forfatternavn(verdi.forfatter),
    opprettet_kl: tekst(verdi.opprettet_kl),
    utdrag: skjult ? '' : utdrag(verdi.tekst),
    skjult,
    arkivert: tekstEllerNull(verdi.arkivert_kl) !== null,
    kommentarer: tall(verdi.kommentarer),
    kommentar,
  }
  if (mal.slag === 'diskusjon') {
    const side = lesDiskusjonsside(verdi.side)
    if (!side) return null
    const kategori = erObjekt(verdi.kategori) ? { navn: tekst(verdi.kategori.navn), emoji: tekst(verdi.kategori.emoji) } : null
    return { ...felles, slag: 'diskusjon', side, kategori: kategori?.navn && kategori.emoji ? kategori : UKATEGORISERTE }
  }
  if (!erKategori(verdi.idekategori)) return null
  return { ...felles, slag: 'ide', idekategori: verdi.idekategori, overfort: verdi.overfort === true }
}

/** Det lenkebrikken viser, i biter: hvor, kategorien, overskriften og kommentaren. */
export interface Lenkedeler {
  /** Siden tråden står på, eller «Idéer». */
  sted: string
  /** Emojien til kategorien i en diskusjon. */
  emoji: string | null
  /** Kategorien, til forhåndsvisningen. */
  kategori: string
  tittel: string
  /** «kommentar fra …» når lenken peker på en kommentar. */
  kommentar: string | null
}

export function lenkedeler(maal: Lenkemaal, sidenavn: string): Lenkedeler {
  const kommentar = maal.kommentar
    ? maal.kommentar.slettet
      ? 'slettet kommentar'
      : `kommentar fra ${maal.kommentar.forfatter ?? 'ukjent bruker'}`
    : null
  return maal.slag === 'diskusjon'
    ? { sted: sidenavn, emoji: maal.kategori.emoji, kategori: maal.kategori.navn, tittel: maal.tittel, kommentar }
    : { sted: 'Idéer', emoji: null, kategori: KATEGORINAVN[maal.idekategori], tittel: maal.tittel, kommentar }
}

/**
 * Navnet lenkebrikken lagres med: «Bupropion · 💊 Maksdose ved nyresvikt»,
 * med «· kommentar fra Kari Nordmann» etter når den peker på en kommentar.
 * Det er dette som står når brikken ikke kan slås opp, i søket og i prompten
 * til en oppgave.
 */
export function lenkeetikett(deler: Lenkedeler): string {
  return [deler.sted, deler.emoji ? `${deler.emoji} ${deler.tittel}` : deler.tittel, deler.kommentar].filter(Boolean).join(' · ')
}

/** Hva lenken er, til skjermlesere og forhåndsvisningen: «Diskusjon», «Kommentar i en idé» … */
export function lenkeslagnavn(mal: Lenkemal): string {
  if (mal.kommentar) return mal.slag === 'diskusjon' ? 'Kommentar i en diskusjon' : 'Kommentar til en idé'
  return mal.slag === 'diskusjon' ? 'Diskusjon' : 'Idé'
}
