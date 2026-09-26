/**
 * Det serverendepunktene for synkroniseringene har felles: hvem som kaller,
 * oppkoblingen mot databasen, og svaret.
 *
 * Vercels cron kaller med `GET` og `Authorization: Bearer <CRON_SECRET>`. En
 * administrator kaller med `POST` og sin egen innlogging; tokenet nettleseren
 * sender, brukes mot databasen, som svarer på `er_admin()` for den
 * innloggede — et token som ikke er gyldig, avvises der.
 *
 * Den hemmelige Supabase-nøkkelen leses fra miljøet her på serveren og
 * forlater den aldri.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export type Miljo = Record<string, string | undefined>

/** Om den innloggede bak et token er administrator. Byttes ut i testene. */
export type Adminsjekk = (token: string, miljo: Miljo) => Promise<boolean>

export function supabaseUrl(miljo: Miljo): string | undefined {
  return miljo.SUPABASE_URL ?? miljo.VITE_SUPABASE_URL
}

/** Spør databasen, som den innloggede, om den innloggede er administrator. */
export const erAdmin: Adminsjekk = async (token, miljo) => {
  const url = supabaseUrl(miljo)
  const nokkel = miljo.SUPABASE_PUBLISHABLE_KEY ?? miljo.VITE_SUPABASE_PUBLISHABLE_KEY
  if (!url || !nokkel) return false
  const klient = createClient(url, nokkel, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data, error } = await klient.rpc('er_admin')
  return !error && data === true
}

export function bearer(foresporsel: Request): string | null {
  const hode = foresporsel.headers.get('authorization') ?? ''
  return /^Bearer\s+(\S+)$/i.exec(hode)?.[1] ?? null
}

/** Vercels cron-kall, eller en innlogget administrator. `null` når ingen av dem. */
export async function hvem(foresporsel: Request, miljo: Miljo, adminsjekk: Adminsjekk): Promise<'cron' | 'manuell' | null> {
  const token = bearer(foresporsel)
  if (!token) return null
  if (foresporsel.method === 'GET') {
    return miljo.CRON_SECRET && token === miljo.CRON_SECRET ? 'cron' : null
  }
  return (await adminsjekk(token, miljo).catch(() => false)) ? 'manuell' : null
}

/** En klient med den hemmelige nøkkelen, eller `null` når oppkoblingen mangler i miljøet. */
export function serverklient(miljo: Miljo): SupabaseClient | null {
  const url = supabaseUrl(miljo)
  const nokkel = miljo.SUPABASE_SECRET_KEY
  if (!url || !nokkel) return null
  return createClient(url, nokkel, { auth: { persistSession: false, autoRefreshToken: false } })
}

export function svar(status: number, innhold: unknown): Response {
  return new Response(JSON.stringify(innhold), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}
