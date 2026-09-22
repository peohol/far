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
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { INTERN_AUTH_DOMENE } from '@delt/brukernavn'
import type { Rolle } from '@delt/profil'

const MIGRASJONER = fileURLToPath(new URL('../../../supabase/migrations', import.meta.url))

const SUPABASE_GRUNNLAG = /* sql */ `
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

/** En ny, tom database med alle migrasjonene kjørt. */
export async function nyDatabase(): Promise<PGlite> {
  const db = new PGlite()
  await db.exec(SUPABASE_GRUNNLAG)
  for (const fil of migrasjonsfiler()) {
    try {
      await db.exec(readFileSync(`${MIGRASJONER}/${fil}`, 'utf8'))
    } catch (feil) {
      throw new Error(`Migrasjonen ${fil} feilet: ${(feil as Error).message}`)
    }
  }
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
