/**
 * Det serverendepunktene for synkroniseringene har felles: hvem som kaller,
 * oppkoblingen mot databasen, og svaret.
 *
 * Vercels cron kaller med `GET` og `Authorization: Bearer <CRON_SECRET>`. En
 * administrator kaller med `POST` og sin egen innlogging; tokenet nettleseren
 * sender, brukes mot databasen, som svarer på `er_admin()` for den
 * innloggede — et token som ikke er gyldig, avvises der.
 *
 * En jobb i GitHub Actions kaller med `POST` og et OIDC-token GitHub har
 * utstedt for kjøringen (`githubkjoring`): ingen hemmelighet å lagre, og
 * tokenet gjelder bare den ene arbeidsflyten på `main`.
 *
 * Den hemmelige Supabase-nøkkelen leses fra miljøet her på serveren og
 * forlater den aldri.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createRemoteJWKSet, decodeJwt, jwtVerify } from 'jose'

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

export type Utlost = 'cron' | 'manuell'

/** Hvem GitHub sier kjører, når tokenet er et gyldig OIDC-token for arbeidsflyten. Byttes ut i testene. */
export type Githubsjekk = (token: string, arbeidsflyt: string) => Promise<Utlost | null>

export const GITHUB_OIDC = {
  utsteder: 'https://token.actions.githubusercontent.com',
  /** Publikummet arbeidsflyten ber om tokenet for (`core.getIDToken('ousfar')`). */
  publikum: 'ousfar',
  repo: 'peohol/far',
  gren: 'refs/heads/main',
}

const githubNokler = createRemoteJWKSet(new URL(`${GITHUB_OIDC.utsteder}/.well-known/jwks`))

/**
 * Hvem kravene i et kontrollert OIDC-token fra GitHub sier kjører: repoet,
 * grenen og arbeidsflyten (`.github/workflows/<fil>`) må stemme. Arbeidsflyten
 * står i `workflow_ref`; `job_workflow_ref` er der bare når jobben kjører en
 * gjenbrukt arbeidsflyt, og må da være den samme. Den planlagte kjøringen er
 * `cron`, en kjøring noen startet for hånd, `manuell`.
 */
export function githubkrav(krav: Record<string, unknown>, arbeidsflyt: string): Utlost | null {
  const ventet = `${GITHUB_OIDC.repo}/${arbeidsflyt}@${GITHUB_OIDC.gren}`
  if (krav.repository !== GITHUB_OIDC.repo || krav.ref !== GITHUB_OIDC.gren || krav.workflow_ref !== ventet) return null
  if (krav.job_workflow_ref !== undefined && krav.job_workflow_ref !== ventet) return null
  return krav.event_name === 'schedule' ? 'cron' : 'manuell'
}

/**
 * Et OIDC-token fra GitHub Actions, kontrollert mot GitHubs nøkler (utsteder
 * og publikum) og deretter med `githubkrav`. Et token fra noen annen utsteder
 * avvises uten nettverkskall.
 */
export const githubkjoring: Githubsjekk = async (token, arbeidsflyt) => {
  let utsteder: unknown
  try {
    utsteder = decodeJwt(token).iss
  } catch {
    return null
  }
  if (utsteder !== GITHUB_OIDC.utsteder) return null
  const { payload } = await jwtVerify(token, githubNokler, { issuer: GITHUB_OIDC.utsteder, audience: GITHUB_OIDC.publikum })
  return githubkrav(payload, arbeidsflyt)
}

/** Arbeidsflyten i GitHub Actions som kan kalle endepunktet, og kontrollen av tokenet. */
export interface Githubtilgang {
  arbeidsflyt: string
  sjekk?: Githubsjekk
}

/**
 * Vercels cron-kall, en jobb i GitHub Actions (når endepunktet tar imot
 * det), eller en innlogget administrator. `null` når ingen av dem.
 */
export async function hvem(
  foresporsel: Request,
  miljo: Miljo,
  adminsjekk: Adminsjekk,
  github?: Githubtilgang,
): Promise<Utlost | null> {
  const token = bearer(foresporsel)
  if (!token) return null
  if (foresporsel.method === 'GET') {
    return miljo.CRON_SECRET && token === miljo.CRON_SECRET ? 'cron' : null
  }
  if (github) {
    const kjoring = await (github.sjekk ?? githubkjoring)(token, github.arbeidsflyt).catch(() => null)
    if (kjoring) return kjoring
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
