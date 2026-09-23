/**
 * En ekte Postgres i minnet, bygd av migrasjonene i `supabase/migrations/`.
 *
 * Testene av databaselaget kjører SQL-en slik den faktisk er skrevet — med
 * radsikkerhet, rettigheter, triggere og funksjoner — i stedet for å lese
 * teksten. Det Supabase har på plass før prosjektets egne migrasjoner kjører,
 * er gjenskapt så nær som mulig nedenfor: API-rollene, standardrettighetene de
 * får i `public`, `auth.uid()` og de tabellene migrasjonene bygger på.
 */
import { PGlite, type Transaction } from '@electric-sql/pglite'
import type { SupabaseClient } from '@supabase/supabase-js'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect } from 'vitest'
import { INTERN_AUTH_DOMENE } from '@delt/brukernavn'
import type { Rolle } from '@delt/profil'
import type { Innhold, Objektstatus, Objekttype } from '../../faginnhold/modell'

const MIGRASJONER = fileURLToPath(new URL('../../../supabase/migrations', import.meta.url))

const SUPABASE_GRUNNLAG = /* sql */ `
  -- Supabase-prosjektet skriver flyttall med 15 gjeldende sifre
  -- (extra_float_digits = 0 i konfigurasjonen), ikke med den korteste eksakte
  -- skrivemåten Postgres ellers bruker. Det som gjør flyttall om til tekst
  -- eller JSON, må derfor selv sørge for alle sifrene.
  set extra_float_digits = 0;

  create role anon nologin noinherit;
  create role authenticated nologin noinherit;
  create role service_role nologin noinherit bypassrls;

  grant usage on schema public to anon, authenticated, service_role;

  -- Nye tabeller og funksjoner i public blir tilgjengelige for alle
  -- API-rollene av seg selv. Migrasjonene må ta det bort der det ikke skal
  -- gjelde, og testene skal merke det om de ikke gjør det.
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

  create schema auth;
  grant usage on schema auth to anon, authenticated, service_role;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')::uuid
  $$;

  create schema storage;
  create table storage.buckets (
    id text primary key,
    name text not null,
    public boolean default false,
    file_size_limit bigint,
    allowed_mime_types text[]
  );
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  create function storage.foldername(name text) returns text[] language sql immutable as $$
    select string_to_array(name, '/')
  $$;

  create schema supabase_migrations;
  create table supabase_migrations.schema_migrations (version text primary key, name text);
`

/** Migrasjonsfilene, i den rekkefølgen prosjektet kjører dem. */
export function migrasjonsfiler(): string[] {
  return readdirSync(MIGRASJONER)
    .filter((f) => f.endsWith('.sql'))
    .sort()
}

/**
 * Kjører migrasjonene fra og med `fra` til, men ikke med, `til` — begge
 * filnavnprefikser. Uten grenser kjøres alle.
 */
export async function kjorMigrasjoner(
  db: PGlite,
  { fra = '', til }: { fra?: string; til?: string } = {},
): Promise<void> {
  for (const fil of migrasjonsfiler()) {
    if (fil < fra || (til !== undefined && fil >= til)) continue
    try {
      await db.exec(readFileSync(`${MIGRASJONER}/${fil}`, 'utf8'))
    } catch (feil) {
      throw new Error(`Migrasjonen ${fil} feilet: ${(feil as Error).message}`)
    }
  }
}

/**
 * En ny, tom database med migrasjonene kjørt — alle, eller bare dem før
 * `til`, for å prøve hvordan en senere migrasjon møter data som alt finnes.
 */
export async function nyDatabase({ til }: { til?: string } = {}): Promise<PGlite> {
  const db = new PGlite()
  await db.exec(SUPABASE_GRUNNLAG)
  await kjorMigrasjoner(db, { til })
  return db
}

export interface Testbruker {
  brukernavn: string
  fornavn: string
  etternavn: string
  rolle: Rolle
}

/**
 * Oppretter en konto slik adminveien gjør det — reservasjon først, så
 * Auth-brukeren — og gir profilen navn og rolle. Returnerer bruker-ID-en.
 */
export async function opprettBruker(db: PGlite, bruker: Testbruker): Promise<string> {
  return db.transaction(async (tx) => {
    await tx.query('insert into public.kontoreservasjoner (username) values ($1)', [bruker.brukernavn])
    const { rows } = await tx.query<{ id: string }>(
      'insert into auth.users (email) values ($1) returning id',
      [`${bruker.brukernavn}@${INTERN_AUTH_DOMENE}`],
    )
    const id = rows[0]!.id
    await tx.query(
      `update public.profiles
       set first_name = $2, last_name = $3, role = $4,
           must_change_password = false, onboarding_completed = true
       where id = $1`,
      [id, bruker.fornavn, bruker.etternavn, bruker.rolle],
    )
    return id
  })
}

/**
 * Kjører arbeidet slik data-API-et gjør det for en innlogget bruker: som
 * rollen `authenticated`, med bruker-ID-en i JWT-kravene. Uten bruker-ID
 * kjøres det som `anon`. Alt skjer i én transaksjon, som ved et kall mot
 * API-et, og en feil ruller den tilbake.
 */
export async function som<T>(
  db: PGlite,
  brukerId: string | null,
  arbeid: (tx: Transaction) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.query(`select set_config('role', $1, true)`, [brukerId ? 'authenticated' : 'anon'])
    await tx.query(`select set_config('request.jwt.claims', $1, true)`, [
      JSON.stringify(brukerId ? { sub: brukerId, role: 'authenticated' } : { role: 'anon' }),
    ])
    return arbeid(tx)
  })
}

/** Feilen et kall ga, med SQLSTATE-koden — eller `null` når det gikk bra. */
export async function feilFra(
  kall: () => Promise<unknown>,
): Promise<{ code: string; message: string; detail?: string } | null> {
  try {
    await kall()
    return null
  } catch (feil) {
    return feil as { code: string; message: string; detail?: string }
  }
}

/* --- Faginnholdet --------------------------------------------------------- */

/** Én revisjon slik den ligger i `objektrevisjoner`. */
export interface Revisjon {
  revisjon: number
  handling: string
  innhold: Record<string, unknown>
  gjenopprettet_fra: number | null
  utfort_av: string
  utfort_av_fornavn: string
  utfort_av_etternavn: string
}

/**
 * Kallene testene av faginnholdet gjør mot databasen, slik data-API-et gjør
 * dem. `admin` er brukeren som endrer når ingen annen er oppgitt.
 */
export function faginnholdskall(db: PGlite, admin: string) {
  /**
   * Kaller en funksjon slik data-API-et gjør det: med navngitte argumenter,
   * som den oppgitte brukeren, i én transaksjon.
   */
  async function rpc<T = Objektstatus>(
    brukerId: string | null,
    funksjon: string,
    argumenter: Record<string, unknown>,
  ): Promise<T> {
    const navn = Object.keys(argumenter)
    // Objekter er jsonb-argumenter og sendes som JSON; lister er
    // tabellargumenter (som `text[]`) og sendes som lister, slik data-API-et
    // gjør det om for funksjonen.
    const verdier = Object.values(argumenter).map((v) =>
      v !== null && typeof v === 'object' && !Array.isArray(v) ? JSON.stringify(v) : v,
    )
    return som(db, brukerId, async (tx) => {
      const { rows } = await tx.query<T>(
        `select * from public.${funksjon}(${navn.map((n, i) => `${n} => $${i + 1}`).join(', ')})`,
        verdier,
      )
      return rows[0]!
    })
  }

  /** Leser som den oppgitte brukeren. */
  async function les<T>(brukerId: string | null, sql: string, parametre: unknown[] = []) {
    return som(db, brukerId, async (tx) => (await tx.query<T>(sql, parametre)).rows)
  }

  /** Leser uten radsikkerhet — det som faktisk ligger i databasen. */
  async function fasit<T>(sql: string, parametre: unknown[] = []) {
    return (await db.query<T>(sql, parametre)).rows
  }

  function opprett<T extends Objekttype>(type: T, innhold: Innhold[T], av = admin) {
    return rpc(av, 'opprett_utkast', { objekttype: type, innhold })
  }

  function lagre<T extends Objekttype>(id: string, forventet: number, innhold: Innhold[T], av = admin) {
    return rpc(av, 'lagre_utkast', { objekt: id, forventet_revisjon: forventet, innhold })
  }

  function gjenopprett(id: string, forventet: number, fra: number, av = admin) {
    return rpc(av, 'gjenopprett_revisjon', { objekt: id, forventet_revisjon: forventet, fra_revisjon: fra })
  }

  function publiser(id: string, forventet: number, av = admin) {
    return rpc(av, 'publiser_utkast', { objekt: id, forventet_revisjon: forventet })
  }

  function revisjoner(id: string, som_: string | null = null) {
    const sql = 'select * from public.objektrevisjoner where objekt_id = $1 order by revisjon'
    return som_ === null ? fasit<Revisjon>(sql, [id]) : les<Revisjon>(som_, sql, [id])
  }

  /**
   * Radene i hver tilstand skal være nøyaktig øyeblikksbildet i revisjonen
   * tilstanden peker på. Kontrolleres etter hver operasjon som endrer noe.
   */
  async function forventSamsvar(id: string) {
    const rader = await fasit<{ tilstand: string; lik: boolean }>(
      `select t.tilstand, intern.les(o.type, o.id, t.tilstand) = r.innhold as lik
       from public.objekttilstander t
       join public.redigerbare_objekter o on o.id = t.objekt_id
       join public.objektrevisjoner r on r.objekt_id = t.objekt_id and r.revisjon = t.revisjon
       where t.objekt_id = $1`,
      [id],
    )
    expect(rader.length).toBeGreaterThan(0)
    for (const rad of rader) expect(rad.lik, rad.tilstand).toBe(true)
  }

  /**
   * En klient som svarer som data-API-et, med databasen bak seg. Som der gis
   * en funksjon som returnerer én verdi, tilbake som verdien selv, og ikke som
   * en rad.
   */
  function klientFor(brukerId: string): SupabaseClient {
    return {
      rpc: async (funksjon: string, argumenter: Record<string, unknown>) => {
        try {
          const rad = await rpc<Record<string, unknown>>(brukerId, funksjon, argumenter)
          const kolonner = rad ? Object.keys(rad) : []
          const data = kolonner.length === 1 && kolonner[0] === funksjon ? rad[funksjon] : rad
          return { data, error: null }
        } catch (feil) {
          const { code, message, detail } = feil as { code: string; message: string; detail?: string }
          return { data: null, error: { code, message, details: detail ?? null, hint: null } }
        }
      },
    } as unknown as SupabaseClient
  }

  return {
    rpc,
    les,
    fasit,
    opprett,
    lagre,
    gjenopprett,
    publiser,
    revisjoner,
    forventSamsvar,
    klientFor,
  }
}

export type Faginnholdskall = ReturnType<typeof faginnholdskall>
