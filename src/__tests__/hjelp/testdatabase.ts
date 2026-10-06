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
import { utenKommentarer } from '../../faginnhold/sqlsetninger'

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

/**
 * Migrasjonene som bare kan kjøres i produksjon: den første som merket en
 * planlagt oppgave utført, kaller `fullfor_oppgave` for en oppgave som ikke
 * finnes i en ny database. De senere gjør ingenting der (se skillen
 * `utfor-oppgaver`), og kjøres som alle andre. Koblingen av stoffsidene til
 * FEST-virkestoffene ble kjørt direkte i produksjonen og lagt inn her etterpå,
 * slik den ble kjørt; den stopper uten administratoren `peohol`.
 */
const BARE_I_PRODUKSJON = /_(oppgaver_utfort_1_56_0|koble_infosider_til_fest_virkestoff)\.sql$/

/**
 * Navnet en ny monografkuratering skal ha (`docs/monografkuratering.md`):
 * `<versjon>_<stoff>_monografkuratering*.sql`, men ikke hjelpefunksjonene
 * (`*_monografkuratering_hjelpere*.sql`), som alltid kjøres. Gruppen er stoffet.
 */
export const KURATERINGSNAVN = /^\d+_([a-z0-9_]+?)_monografkuratering(?!_hjelpere)(?:_[a-z0-9_]+)?\.sql$/

/**
 * Kurateringer som alt er kjørt i produksjonen uten å følge navnet, med
 * stoffet de gjelder. Migrasjonene endres aldri etterpå, så de står her for
 * godt; listen skal ikke vokse. Den første (`040004`) er fra før
 * hjelpefunksjonene og har sin egen preflight.
 */
export const KURATERINGER_MED_AVVIKENDE_NAVN: Readonly<Record<string, string>> = {
  '20261002040004_kvetiapin_farmakogenetikk_og_typografi.sql': 'kvetiapin',
  '20261004040353_kvetiapin_virkninger_og_avhengighet.sql': 'kvetiapin',
  '20261005173500_kvetiapin_konsentrasjoner_nmol_l.sql': 'kvetiapin',
}

/**
 * Kallene til `intern.<funksjon>(…)` utenfor kommentarene — ikke definisjonen
 * av funksjonen (`create … function`) eller kommentaren på den
 * (`comment on function`) — med det første argumentet når det er en tekst.
 */
function kallTil(funksjon: string, sql: string): { argument?: string }[] {
  if (!sql.toLowerCase().includes(funksjon)) return []
  const kall = new RegExp(String.raw`(?<!\bfunction\s+)\bintern\s*\.\s*${funksjon}\s*\(\s*(?:'([^']*)')?`, 'gi')
  return [...utenKommentarer(sql).matchAll(kall)].map((m) => ({ argument: m[1] }))
}

/** Om migrasjonen kaller `intern.kuratering_start()`, altså er bygd på kuratorhjelperne. */
export const brukerKuratorhjelperne = (sql: string): boolean => kallTil('kuratering_start', sql).length > 0

/**
 * Om migrasjonen selv sjekker om den alt er gjort (`intern.kuratering_utfort()`),
 * og dermed lover å ikke endre noe når den kjøres på nytt.
 */
export const erSelvsjekkende = (sql: string): boolean => kallTil('kuratering_utfort', sql).length > 0

/** Stoffsidene migrasjonen åpner med `intern.kuratering_start('<slug>')`. */
export const kurateringssider = (sql: string): string[] => [
  ...new Set(kallTil('kuratering_start', sql).flatMap((k) => (k.argument === undefined ? [] : [k.argument]))),
]

/**
 * Monografkurateringene: datamigrasjonene som endrer en stoffside etter en
 * kuratering, bundet til tilstanden siden hadde i produksjonen. Kjent igjen på
 * at de kaller `intern.kuratering_start()`, på navnet, eller fordi de står i
 * `KURATERINGER_MED_AVVIKENDE_NAVN`. Uten kuratorprofil gjør de ingenting, og
 * der kjøres de som alle andre. Med kuratoren speiler bare en database som er
 * bygd fra den første importen, produksjonen, så der kjøres de bare når testen
 * ber om det (`kurateringer`, eller filen i `bare`): ellers ville preflighten
 * deres stoppe enhver test som setter opp sider på sin egen måte.
 */
export function erMonografkuratering(fil: string, sql: string): boolean {
  return KURATERINGSNAVN.test(fil) || fil in KURATERINGER_MED_AVVIKENDE_NAVN || brukerKuratorhjelperne(sql)
}

/** En monografkuratering i `supabase/migrations/`. */
export interface Monografkuratering {
  fil: string
  /**
   * Stoffsiden den gjelder: den den åpner med `intern.kuratering_start`,
   * ellers stoffet i navnet. At de to stemmer, kontrolleres i
   * `monografkuratering.test.ts`.
   */
  stoff: string | undefined
  /** Sjekker selv om den alt er gjort, og skal tåle å kjøres på nytt. */
  selvsjekkende: boolean
}

/** Alle monografkurateringene, i den rekkefølgen prosjektet kjører dem. */
export function monografkurateringer(): Monografkuratering[] {
  return migrasjonsfiler().flatMap((fil) => {
    const sql = readFileSync(`${MIGRASJONER}/${fil}`, 'utf8')
    if (!erMonografkuratering(fil, sql)) return []
    const stoff = kurateringssider(sql)[0] ?? KURATERINGER_MED_AVVIKENDE_NAVN[fil] ?? KURATERINGSNAVN.exec(fil)?.[1]
    return [{ fil, stoff, selvsjekkende: erSelvsjekkende(sql) }]
  })
}

/**
 * Referanser en kuratering har skrevet inn med id-en de har i produksjonen, i
 * stedet for å slå dem opp på lenken med `intern.kuratering_referanse`. En
 * database bygd fra importene gir de samme referansene andre id-er, så før en
 * slik kuratering kjøres med kuratoren, byttes id-en mot den publiserte
 * referansen med samme lenke, slik produksjonen har dem (kontrollert der
 * 06.10.2026). Finnes ikke nøyaktig én slik referanse, står id-en, og
 * migrasjonen stopper som den ville gjort i produksjonen.
 */
export const PRODUKSJONSREFERANSER: Readonly<Record<string, string>> = {
  'b06bea10-ecbc-4554-ab46-fa2ec023aa7f': 'https://doi.org/10.3390/jox14040085',
  '4cb30ebd-5b65-4c81-9faa-1db2739c10b9': 'https://doi.org/10.1093/jat/bkv072',
}

async function medTestensReferanser(db: PGlite, sql: string): Promise<string> {
  let ut = sql
  for (const [id, lenke] of Object.entries(PRODUKSJONSREFERANSER)) {
    if (!ut.includes(id)) continue
    const { rows } = await db.query<{ objekt_id: string }>(
      `select objekt_id from public.referanser where tilstand = 'publisert' and lenke = $1`,
      [lenke],
    )
    if (rows.length === 1) ut = ut.replaceAll(id, rows[0]!.objekt_id)
  }
  return ut
}

/**
 * En bivirkningsimport (`docs/bivirkninger.md`) gjelder en fagside som
 * produksjonen har, ofte fra en import eller kuratering som ikke gjør noe i
 * en testdatabase. Uten den siden stopper importen, så den hoppes over der.
 */
const BIVIRKNINGSIMPORT = /^select bivirkninger\.importer\(\$import\$\{\s*"format": "ousfar-bivirkninger\/1",\s*"stoff": "([^"]+)"/m

async function harFagside(db: PGlite, slug: string): Promise<boolean> {
  const { rows } = await db.query<{ finnes: boolean }>(`select exists (select 1 from public.infosider where slug = $1) as finnes`, [slug])
  return rows[0]!.finnes
}

async function harKurator(db: PGlite): Promise<boolean> {
  const { rows } = await db.query<{ finnes: boolean }>(
    `select exists (select 1 from public.profiles where username = 'peohol' and role = 'admin') as finnes`,
  )
  return rows[0]!.finnes
}

/** Migrasjonsfilene, i den rekkefølgen prosjektet kjører dem. */
export function migrasjonsfiler(): string[] {
  return readdirSync(MIGRASJONER)
    .filter((f) => f.endsWith('.sql'))
    .sort()
}

/** En monografkuratering som er kjørt, med revisjonene den la til. */
export interface KjortKuratering {
  fil: string
  /** Alle nye revisjoner, også av referansene. */
  nyeRevisjoner: number
  /**
   * Nye revisjoner av elementene på hver fagside, etter nøkkelen til siden.
   * En kuratering som bare legger inn referanser, endrer ingen side.
   */
  endredeSider: Record<string, number>
}

/** Revisjonene i alt, og revisjonene av elementene på hver fagside. */
async function revisjonstall(db: PGlite): Promise<{ alle: number; sider: Record<string, number> }> {
  const { rows } = await db.query<{ slug: string | null; n: number }>(
    `select s.slug, count(*)::int as n
     from public.objektrevisjoner r
     left join public.innholdselementer e on e.objekt_id = r.objekt_id and e.tilstand = 'utkast'
     left join public.infosider s on s.objekt_id = e.infoside_id and s.tilstand = 'publisert'
     group by s.slug`,
  )
  const sider = Object.fromEntries(rows.flatMap((r) => (r.slug === null ? [] : [[r.slug, r.n]])))
  return { alle: rows.reduce((sum, r) => sum + r.n, 0), sider }
}

async function kjor(db: PGlite, fil: string, sql: string): Promise<void> {
  try {
    await db.exec(sql)
  } catch (feil) {
    throw new Error(`Migrasjonen ${fil} feilet: ${(feil as Error).message}`)
  }
}

/** Kjører en monografkuratering og måler hva den endret (`KjortKuratering`). */
export async function kjorKuratering(db: PGlite, fil: string, sql: string): Promise<KjortKuratering> {
  const for_ = await revisjonstall(db)
  await kjor(db, fil, sql)
  const etter = await revisjonstall(db)
  const endredeSider = Object.fromEntries(
    Object.entries(etter.sider).flatMap(([slug, n]) => (n > (for_.sider[slug] ?? 0) ? [[slug, n - (for_.sider[slug] ?? 0)]] : [])),
  )
  return { fil, nyeRevisjoner: etter.alle - for_.alle, endredeSider }
}

/**
 * Kjører migrasjonene fra og med `fra` til, men ikke med, `til` — begge
 * filnavnprefikser — eller bare filene i `bare`. Uten grenser kjøres alle.
 * Monografkurateringene hoppes over når kuratoren finnes, med mindre
 * `kurateringer` er satt (se `erMonografkuratering`), og en bivirkningsimport
 * når fagsiden den gjelder, ikke finnes (se `BIVIRKNINGSIMPORT`). Gir
 * kurateringene som ble kjørt, med det hver endret (`kjorKuratering`).
 */
export async function kjorMigrasjoner(
  db: PGlite,
  {
    fra = '',
    til,
    bare,
    kurateringer = false,
  }: { fra?: string; til?: string; bare?: readonly string[]; kurateringer?: boolean } = {},
): Promise<KjortKuratering[]> {
  const kjort: KjortKuratering[] = []
  for (const fil of migrasjonsfiler()) {
    if (BARE_I_PRODUKSJON.test(fil)) continue
    if (bare ? !bare.includes(fil) : fil < fra || (til !== undefined && fil >= til)) continue
    let sql = readFileSync(`${MIGRASJONER}/${fil}`, 'utf8')
    const kuratering = erMonografkuratering(fil, sql)
    if (kuratering) {
      if (!bare && !kurateringer) {
        if (await harKurator(db)) continue
      } else sql = await medTestensReferanser(db, sql)
    }
    const importert = !bare && BIVIRKNINGSIMPORT.exec(sql)?.[1]
    if (importert && !(await harFagside(db, importert))) continue
    if (kuratering) kjort.push(await kjorKuratering(db, fil, sql))
    else await kjor(db, fil, sql)
  }
  return kjort
}

/** En tom database med det Supabase har på plass før migrasjonene. */
export async function grunnlagsdatabase(): Promise<PGlite> {
  const db = new PGlite()
  await db.exec(SUPABASE_GRUNNLAG)
  return db
}

/**
 * En ny, tom database med migrasjonene kjørt — alle, eller bare dem før
 * `til`, for å prøve hvordan en senere migrasjon møter data som alt finnes.
 */
export async function nyDatabase({ til }: { til?: string } = {}): Promise<PGlite> {
  const db = await grunnlagsdatabase()
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
  const typerEtterFunksjon = new Map<string, Promise<Map<string, string>>>()

  /** Typene til argumentene en funksjon i `public` tar, etter navn. */
  function argumenttyper(funksjon: string): Promise<Map<string, string>> {
    let typer = typerEtterFunksjon.get(funksjon)
    if (!typer) {
      typer = db
        .query<{ navn: string; type: string }>(
          `select a.navn, format_type(a.typ, null) as type
           from pg_proc p, unnest(p.proargnames, p.proargtypes::oid[]) a(navn, typ)
           where p.proname = $1 and p.pronamespace = 'public'::regnamespace`,
          [funksjon],
        )
        .then(({ rows }) => new Map(rows.map((r) => [r.navn, r.type])))
      typerEtterFunksjon.set(funksjon, typer)
    }
    return typer
  }

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
    // Et jsonb-argument sendes som JSON, også når det er en liste; andre
    // lister er tabellargumenter (som `text[]`) og sendes som lister, slik
    // data-API-et gjør det om for funksjonen.
    const typer = await argumenttyper(funksjon)
    const verdier = Object.entries(argumenter).map(([n, v]) =>
      v !== null && typeof v === 'object' && (typer.get(n) === 'jsonb' || !Array.isArray(v)) ? JSON.stringify(v) : v,
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
