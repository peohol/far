/**
 * Kallene stoffregisteret gjør mot Supabase. Inndelingen, arkivet og
 * papirkurven endres bare gjennom funksjonene i databasen, som håndhever
 * reglene (to nivåer, unike navn, hvem som får slette hva).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { lesbarFeil, type Databasefeil } from '../auth/databasefeil'
import type { Tilstand } from '../faginnhold/modell'
import { lesRegisterdatabase, type Registerdatabase } from './modell'

const UNIKE: Record<string, string> = {
  stoffkategorier_navn_idx: 'Det finnes alt en kategori med det navnet her.',
}

/** Funksjonen finnes ikke: migrasjonen er ikke rullet ut mot databasen appen er koblet til. */
const MANGLER = 'PGRST202'

function tilFeil(feil: Databasefeil): Error {
  if (feil.code === MANGLER) return new Error('Stoffregisteret er ikke satt opp i databasen ennå.')
  return lesbarFeil(feil, UNIKE)
}

export interface Registerlager {
  /** Fagsidene og inndelingen. Utkastet bare for administratorer; andre får det publiserte. */
  les(tilstand: Tilstand): Promise<Registerdatabase>
  /** En ny kategori sist blant søsknene, øverst eller under `forelder`. Gir ID-en. */
  opprettKategori(navn: string, forelder: string | null): Promise<string>
  endreKategori(kategori: string, navn: string): Promise<void>
  /** Til plassen `indeks` (fra 0) øverst, eller under `forelder`. */
  flyttKategori(kategori: string, forelder: string | null, indeks: number): Promise<void>
  arkiverKategori(kategori: string, arkivert: boolean): Promise<void>
  slettKategori(kategori: string): Promise<void>
  /** Fra én kategori til en annen; uten `fra` i tillegg, uten `til` ut. */
  plasserStoff(stoff: string, fra: string | null, til: string | null): Promise<void>
  arkiverStoff(stoff: string, arkivert: boolean): Promise<void>
  /** Legger fagsiden i papirkurven. */
  slettStoff(stoff: string): Promise<void>
  gjenopprettStoff(stoff: string): Promise<void>
  slettStoffForGodt(stoff: string): Promise<void>
  /** Sletter alt i papirkurven for godt, utenom det noe annet peker på. Gir antallet. */
  tomPapirkurven(): Promise<number>
  /** Sletter det som har ligget i papirkurven i mer enn 30 dager. Gir antallet. */
  rydd(): Promise<number>
}

export function lagRegisterlager(klient: SupabaseClient): Registerlager {
  const kall = async <T = unknown>(funksjon: string, argumenter: Record<string, unknown> = {}): Promise<T> => {
    const { data, error } = await klient.rpc(funksjon, argumenter)
    if (error) throw tilFeil(error)
    return data as T
  }
  const ingenting = async (funksjon: string, argumenter: Record<string, unknown>) => {
    await kall(funksjon, argumenter)
  }
  const antall = async (funksjon: string) => {
    const svar = await kall(funksjon)
    return typeof svar === 'number' ? svar : 0
  }
  return {
    les: async (sidetilstand) => lesRegisterdatabase(await kall('les_stoffregister', { sidetilstand })),
    async opprettKategori(navn, forelder) {
      const id = await kall('opprett_stoffkategori', { navn: navn.trim(), forelder })
      if (typeof id !== 'string') throw new Error('Kategorien ble ikke laget. Prøv igjen.')
      return id
    },
    endreKategori: (kategori, navn) => ingenting('endre_stoffkategori', { kategori, navn: navn.trim() }),
    flyttKategori: (kategori, forelder, indeks) => ingenting('flytt_stoffkategori', { kategori, forelder, indeks }),
    arkiverKategori: (kategori, arkivert) => ingenting('arkiver_stoffkategori', { kategori, arkivert }),
    slettKategori: (kategori) => ingenting('slett_stoffkategori', { kategori }),
    plasserStoff: (stoff, fra, til) => ingenting('plasser_stoff', { stoff, fra, til }),
    arkiverStoff: (stoff, arkivert) => ingenting('arkiver_stoff', { stoff, arkivert }),
    slettStoff: (stoff) => ingenting('slett_stoff', { stoff }),
    gjenopprettStoff: (stoff) => ingenting('gjenopprett_stoff', { stoff }),
    slettStoffForGodt: (stoff) => ingenting('slett_stoff_for_godt', { stoff }),
    tomPapirkurven: () => antall('tom_stoffpapirkurven'),
    rydd: () => antall('rydd_stoffpapirkurven'),
  }
}
