/**
 * Felles for prøvene som bruker legemiddeldataene fra FEST: utdraget i
 * `data/fest-utdrag.xml`, ID-ene i det, og en database med utdraget
 * synkronisert inn og lest slik appen leser det.
 */
import type { PGlite } from '@electric-sql/pglite'
import type { SupabaseClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { crc32, deflateRawSync } from 'node:zlib'
import { lagLegemiddellager, type Databasekall } from '../../legemiddeldata/lager'
import { lagLegemiddelleser, type Legemiddelleser } from '../../legemiddeldata/lesing'
import { synkroniserFest } from '../../legemiddeldata/synk'

export const UTDRAG = readFileSync(new URL('../data/fest-utdrag.xml', import.meta.url), 'utf8')

export const AMITRIPTYLIN = 'ID_0A1B24EF-A7F8-488B-97B8-8023193E976D'
export const AMITRIPTYLINHYDROKLORID = 'ID_070A7B5D-46F1-44DC-AAB8-B51BE5A49270'
export const AMITRIPTYLIN_ABCUR_50 = 'ID_012C7C0D-77BC-4F3D-BEBE-663743B03C1F'
export const KODEIN = 'ID_82E89E1B-9C06-4E57-BB4D-AB3DA8B33FD4'
export const TERBINAFIN_AMITRIPTYLIN = 'ID_43E3CEDF-77A1-4D0D-844A-9F8A01267559'

/** Et zip-arkiv med én fil, slik DMP pakker FEST. */
export function lagZip(navn: string, innhold: string): Buffer {
  const data = Buffer.from(innhold, 'utf8')
  const komprimert = deflateRawSync(data)
  const navnBuf = Buffer.from(navn)
  const sum = crc32(data)
  const lokal = Buffer.alloc(30)
  lokal.writeUInt32LE(0x04034b50, 0)
  lokal.writeUInt16LE(20, 4)
  lokal.writeUInt16LE(8, 8)
  lokal.writeUInt32LE(sum, 14)
  lokal.writeUInt32LE(komprimert.length, 18)
  lokal.writeUInt32LE(data.length, 22)
  lokal.writeUInt16LE(navnBuf.length, 26)
  const sentral = Buffer.alloc(46)
  sentral.writeUInt32LE(0x02014b50, 0)
  sentral.writeUInt16LE(20, 4)
  sentral.writeUInt16LE(20, 6)
  sentral.writeUInt16LE(8, 10)
  sentral.writeUInt32LE(sum, 16)
  sentral.writeUInt32LE(komprimert.length, 20)
  sentral.writeUInt32LE(data.length, 24)
  sentral.writeUInt16LE(navnBuf.length, 28)
  sentral.writeUInt32LE(0, 42)
  const katalogStart = lokal.length + navnBuf.length + komprimert.length
  const slutt = Buffer.alloc(22)
  slutt.writeUInt32LE(0x06054b50, 0)
  slutt.writeUInt16LE(1, 8)
  slutt.writeUInt16LE(1, 10)
  slutt.writeUInt32LE(sentral.length + navnBuf.length, 12)
  slutt.writeUInt32LE(katalogStart, 16)
  return Buffer.concat([lokal, navnBuf, komprimert, sentral, navnBuf, slutt])
}

export function kallSom(db: PGlite, rolle: 'service_role' | 'authenticated' | 'anon'): Databasekall {
  return (funksjon, argumenter) =>
    db.transaction(async (tx) => {
      await tx.query(`select set_config('role', $1, true)`, [rolle])
      await tx.query(`select set_config('request.jwt.claims', $1, true)`, [
        JSON.stringify(rolle === 'authenticated' ? { sub: '00000000-0000-0000-0000-000000000001', role: rolle } : { role: rolle }),
      ])
      const navn = Object.keys(argumenter)
      const verdier = Object.values(argumenter).map((v) =>
        v !== null && typeof v === 'object' && !(Array.isArray(v) && v.every((x) => typeof x === 'string')) ? JSON.stringify(v) : v,
      )
      const { rows } = await tx.query<{ r: unknown }>(
        `select public.${funksjon}(${navn.map((n, i) => `${n} => $${i + 1}`).join(', ')}) as r`,
        verdier,
      )
      return rows[0]?.r ?? null
    })
}

export function svar(body: string | Buffer | null, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(typeof body === 'string' || body === null ? body : new Uint8Array(body), { status, headers })
}

/** Utdraget synkronisert inn i databasen, som den nattlige jobben gjør det. */
export async function synkroniserUtdrag(db: PGlite): Promise<void> {
  await synkroniserFest({
    lager: lagLegemiddellager(kallSom(db, 'service_role')),
    hent: async () => svar(lagZip('fest251.xml', UTDRAG), 200, { etag: '"a"' }),
  })
}

/** Leseren appen bruker, mot en klient som kaller databasen som en innlogget. */
export function innloggetLeser(db: PGlite): Legemiddelleser {
  const innlogget = kallSom(db, 'authenticated')
  const klient = {
    rpc: async (funksjon: string, argumenter: Record<string, unknown>) => {
      try {
        return { data: await innlogget(funksjon, argumenter), error: null }
      } catch (e) {
        return { data: null, error: { message: (e as Error).message } }
      }
    },
  } as unknown as SupabaseClient
  return lagLegemiddelleser(klient)
}
