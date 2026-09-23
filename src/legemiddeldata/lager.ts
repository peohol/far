/**
 * Legemiddeldataene i databasen: kallene synkroniseringen gjør for å skrive,
 * og det stoffsidene gjør for å lese.
 *
 * Skrivingen krever den hemmelige nøkkelen og skjer bare på serveren.
 * Funksjonene er beskrevet i migrasjonen `*_legemiddeldata.sql`.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Entitetnavn } from './fest'
import type { Filinfo, ForrigeSynk, Innlastingsrad, Legemiddellager, Opptelling } from './synk'

/** Et kall til en databasefunksjon med navngitte argumenter. Kaster ved feil. */
export type Databasekall = (funksjon: string, argumenter: Record<string, unknown>) => Promise<unknown>

export function kallMot(klient: SupabaseClient): Databasekall {
  return async (funksjon, argumenter) => {
    const { data, error } = await klient.rpc(funksjon, argumenter)
    if (error) throw new Error(`${funksjon}: ${error.message}`)
    return data
  }
}

export function lagLegemiddellager(kall: Databasekall): Legemiddellager {
  return {
    forrige: async (kilde) => ((await kall('legemiddeldata_forrige_synk', { kilde })) as ForrigeSynk | null) ?? null,
    start: async (kilde) => Number(await kall('legemiddeldata_start_synk', { kilde })),
    lastInn: async (synk: number, entitet: Entitetnavn, rader: Innlastingsrad[]) => {
      await kall('legemiddeldata_last_inn', { synk, entitet, rader })
    },
    fullfor: async (synk: number, fil: Filinfo) =>
      (await kall('legemiddeldata_fullfor_synk', { synk, fil })) as Opptelling,
    uendret: async (synk: number, fil: Filinfo) => {
      await kall('legemiddeldata_uendret_synk', { synk, fil })
    },
    avbryt: async (synk: number, feil: string) => {
      await kall('legemiddeldata_avbryt_synk', { synk, feil })
    },
  }
}
