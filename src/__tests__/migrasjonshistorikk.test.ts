/** Navnene på migrasjonsfilene, og spørringen som sammenligner dem med historikken databasen har registrert. */
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  destruktiveSetninger,
  destruktivfeil,
  endringsfeil,
  filnavnfeil,
  historikkSql,
  KJENTE_AVVIK,
  lesMigrasjonsfil,
  md5,
  ventendeMigrasjoner,
} from '../faginnhold/migrasjonshistorikk'
import { migrasjonsfiler } from './hjelp/testdatabase'

const MAPPE = fileURLToPath(new URL('../../supabase/migrations', import.meta.url))

describe('migrasjonsfilene', () => {
  it('heter <versjon>_<navn>.sql, med en versjon hver', () => {
    expect(filnavnfeil(migrasjonsfiler())).toEqual([])
  })

  it('melder feil form og en versjon som brukes to ganger', () => {
    expect(
      filnavnfeil(['20261002070000_a.sql', '20261002070000_b.sql', '2026100207_kort.sql', '20261002070001_Stor.sql']),
    ).toEqual([
      '20261002070000_b.sql: versjonen 20261002070000 brukes også av 20261002070000_a.sql',
      '2026100207_kort.sql: navnet har ikke formen <14 sifre>_<navn>.sql',
      '20261002070001_Stor.sql: navnet har ikke formen <14 sifre>_<navn>.sql',
    ])
  })

  it('har de kjente avvikene akkurat slik de ble avklart', () => {
    for (const [versjon, avvik] of Object.entries(KJENTE_AVVIK)) {
      const fil = migrasjonsfiler().find((f) => f.startsWith(`${versjon}_`))
      expect(fil ? md5(readFileSync(`${MAPPE}/${fil}`, 'utf8')) : null, versjon).toBe(avvik.fil)
    }
  })
})

// Hver sammenligning starter en egen database i minnet, som tar et par sekunder når hele samlingen kjører.
describe('sammenligningen med historikken', { timeout: 30_000 }, () => {
  /** En rad i historikken: én tekst, som `apply_migration` lagrer, eller setningene CLI-en lagret. */
  type Rad = [versjon: string, navn: string, tekst: string | string[]]

  async function historikk(rader: Rad[]) {
    const db = new PGlite()
    await db.exec(`create schema supabase_migrations;
      create table supabase_migrations.schema_migrations (version text primary key, statements text[], name text, created_by text);`)
    for (const [versjon, navn, tekst] of rader) {
      // CLI-en (db push) fører ikke created_by; apply_migration fører hvem som kjørte den.
      await db.query('insert into supabase_migrations.schema_migrations values ($1, $2, $3, $4)', [
        versjon,
        Array.isArray(tekst) ? tekst : [tekst],
        navn,
        Array.isArray(tekst) ? null : 'peder@example.com',
      ])
    }
    return db
  }

  /** Kjører spørringen mot en database med disse radene i historikken. */
  async function avvik(
    filer: Array<[string, string]>,
    rader: Rad[],
    kjente: Parameters<typeof historikkSql>[1] = {},
    valg: Parameters<typeof historikkSql>[2] = {},
  ) {
    const db = await historikk(rader)
    const { rows } = await db.query<{ versjon: string; navn: string; avvik: string }>(
      historikkSql(filer.map(([fil, innhold]) => lesMigrasjonsfil(fil, innhold)), kjente, valg),
    )
    await db.close()
    return rows
  }

  it('gir ingen rader når versjoner, navn og innhold stemmer', async () => {
    expect(
      await avvik(
        [['20261001000000_a.sql', 'select 1;\n'], ['20261001000001_b.sql', 'select 2;']],
        [['20261001000000', 'a', 'select 1;'], ['20261001000001', 'b', 'select 2;']],
      ),
    ).toEqual([])
  })

  it('melder feil versjon, manglende filer, nye filer, annet navn og annet innhold', async () => {
    expect(
      await avvik(
        [
          ['20261001000000_a.sql', 'select 1;'],
          ['20261001000001_b.sql', 'select 2; -- endret etterpå'],
          ['20261001000002_c.sql', 'select 3;'],
          ['20261001000005_omdopes.sql', 'select 5;'],
          ['20261001000009_ny.sql', 'select 9;'],
        ],
        [
          ['20261001000000', 'a', 'select 1;'],
          ['20261001000001', 'b', 'select 2;'],
          ['20261001000002', 'c_annet', 'select 3;'],
          ['20261001000003', 'borte', 'select 4;'],
          ['20261001000007', 'omdopes', 'select 5;'],
        ],
      ),
    ).toEqual([
      { versjon: '20261001000001', navn: 'b', avvik: 'annet innhold enn det som ble kjørt' },
      { versjon: '20261001000002', navn: 'c', avvik: 'registrert med navnet c_annet' },
      { versjon: '20261001000003', navn: 'borte', avvik: 'mangler i repoet' },
      { versjon: '20261001000005', navn: 'omdopes', avvik: 'registrert med en annen versjon: 20261001000007' },
      { versjon: '20261001000007', navn: 'omdopes', avvik: 'filen har en annen versjon: 20261001000005' },
      { versjon: '20261001000009', navn: 'ny', avvik: 'ikke kjørt i databasen' },
    ])
  })

  it('skjuler et kjent avvik bare så lenge filen og teksten står slik de ble avklart', async () => {
    const kjente = {
      '20261001000001': { db: md5('select 2;'), fil: md5('select 2; -- sperre'), hvorfor: 'test' },
      '20261001000003': { db: md5('select 4;'), fil: null, hvorfor: 'test' },
    }
    const rader: Rad[] = [
      ['20261001000001', 'b', 'select 2;'],
      ['20261001000003', 'borte', 'select 4;'],
    ]
    expect(await avvik([['20261001000001_b.sql', 'select 2; -- sperre']], rader, kjente)).toEqual([])
    expect(await avvik([['20261001000001_b.sql', 'select 2; -- endret igjen']], rader, kjente)).toEqual([
      { versjon: '20261001000001', navn: 'b', avvik: 'annet innhold enn det som ble kjørt' },
    ])
    expect(await avvik([['20261001000001_b_nytt_navn.sql', 'select 2; -- sperre']], rader, kjente)).toEqual([
      { versjon: '20261001000001', navn: 'b_nytt_navn', avvik: 'registrert med navnet b' },
    ])
  })

  it('kjenner igjen setningene CLI-en lagret, men ikke et annet innhold', async () => {
    const fil = '-- Kommentar; med semikolon\ncreate table a (t text);\n\ndo $$ begin insert into a values (\'x;\'); end $$;\n'
    const cli = ['-- Kommentar; med semikolon\ncreate table a (t text)', "do $$ begin insert into a values ('x;'); end $$"]
    expect(await avvik([['20261001000000_a.sql', fil]], [['20261001000000', 'a', cli]])).toEqual([])
    expect(
      await avvik([['20261001000000_a.sql', fil.replace("'x;'", "'y;'")]], [['20261001000000', 'a', cli]]),
    ).toEqual([{ versjon: '20261001000000', navn: 'a', avvik: 'annet innhold enn det som ble kjørt' }])
    // Én tekst fra apply_migration sammenlignes som før, ikke i CLI-formen.
    expect(await avvik([['20261001000000_a.sql', 'select  1;']], [['20261001000000', 'a', 'select 1;']])).toEqual([
      { versjon: '20261001000000', navn: 'a', avvik: 'annet innhold enn det som ble kjørt' },
    ])
  })

  it('godtar filer som ikke er kjørt ennå bare før utrullingen', async () => {
    const filer: Array<[string, string]> = [['20261001000000_a.sql', 'select 1;'], ['20261001000001_ny.sql', 'select 2;']]
    const rader: Rad[] = [['20261001000000', 'a', 'select 1;']]
    expect(await avvik(filer, rader, {}, { ventende: true })).toEqual([])
    expect(await avvik(filer, rader)).toEqual([{ versjon: '20261001000001', navn: 'ny', avvik: 'ikke kjørt i databasen' }])
    // En fil som er kjørt med en annen versjon, er et avvik også før utrullingen: den ville blitt kjørt to ganger.
    expect(await avvik([['20261001000002_a.sql', 'select 1;']], rader, {}, { ventende: true })).toEqual([
      { versjon: '20261001000000', navn: 'a', avvik: 'filen har en annen versjon: 20261001000002' },
      { versjon: '20261001000002', navn: 'a', avvik: 'registrert med en annen versjon: 20261001000000' },
    ])
  })

  it('stopper med avvikene i feilmeldingen når utrullingen ber om det', async () => {
    const filer = [lesMigrasjonsfil('20261001000000_a.sql', 'select 1;')]
    const db = await historikk([['20261001000000', 'a', 'select 1;']])
    await expect(db.exec(historikkSql(filer, {}, { stopp: true }))).resolves.toBeDefined()
    await db.exec(`update supabase_migrations.schema_migrations set statements = array['select 2;']`)
    await expect(db.exec(historikkSql(filer, {}, { stopp: true }))).rejects.toThrow(
      /stemmer ikke med repoet:\n20261001000000 a: annet innhold enn det som ble kjørt/,
    )
    await db.close()
  })
})

describe('destruktive migrasjoner', () => {
  it('finner setningene som kan gi vanskelig reversibelt tap eller åpne tilgang', () => {
    expect(destruktiveSetninger('drop table if exists public.a;')).toEqual(['drop table'])
    expect(destruktiveSetninger('alter table a drop column b, drop  column c;\ntruncate public.x;')).toEqual([
      'drop column',
      'truncate',
    ])
    expect(destruktiveSetninger('DROP SCHEMA s CASCADE; alter table a disable row level security;')).toEqual([
      'drop schema',
      'disable row level security',
    ])
  })

  it('lar vanlige migrasjoner være, også triggere for truncate', () => {
    const vanlig = `create table a (id int);
      create trigger t before truncate on a for each statement execute function f();
      create trigger u after insert or truncate on a execute function f();
      drop function if exists f(); drop policy p on a; delete from a where id = 1;`
    expect(destruktiveSetninger(vanlig)).toEqual([])
  })

  it('slipper gjennom en destruktiv migrasjon bare med godkjenningsmerket', () => {
    const fil = (innhold: string) => lesMigrasjonsfil('20261001000000_rydd.sql', innhold)
    expect(destruktivfeil([fil('drop table a;')])).toEqual([expect.stringContaining('20261001000000_rydd.sql: inneholder drop table')])
    expect(destruktivfeil([fil('-- destruktiv-godkjent: Peder 2026-10-05, tom tabell\ndrop table a;')])).toEqual([])
    expect(destruktivfeil([fil('-- destruktiv-godkjent:\ndrop table a;')])).toHaveLength(1)
  })
})

describe('endringene i en PR', () => {
  const fil = (navn: string, innhold = `select '${navn}';`) => lesMigrasjonsfil(navn, innhold)
  const grunn = [fil('20261001000000_a.sql'), fil('20261001000001_b.sql')]

  it('godtar nye migrasjoner etter de eksisterende', () => {
    expect(endringsfeil(grunn, [...grunn, fil('20261001000002_c.sql')], { kjente: {} })).toEqual([])
  })

  it('stopper endrede, fjernede og omdøpte migrasjoner og nye med eldre versjon', () => {
    expect(
      endringsfeil(
        grunn,
        [fil('20261001000000_a.sql', 'select 2;'), fil('20261001000001_b_nytt.sql'), fil('20261001000001_c.sql')],
        { kjente: {} },
      ),
    ).toEqual([
      '20261001000000_a.sql: er endret, men er kjørt i produksjonen; en retting er en ny migrasjon',
      '20261001000001_b.sql: er fjernet eller omdøpt, men er kjørt i produksjonen',
      '20261001000001_b_nytt.sql: versjonen er ikke nyere enn den nyeste migrasjonen på grenen (20261001000001); gi fila et nytt tidspunkt',
      '20261001000001_c.sql: versjonen er ikke nyere enn den nyeste migrasjonen på grenen (20261001000001); gi fila et nytt tidspunkt',
    ])
  })

  it('godtar en endring bare når den står som kjent avvik med akkurat det innholdet', () => {
    const endret = [fil('20261001000000_a.sql', 'select 2; -- sperre'), grunn[1]!]
    const kjente = { '20261001000000': { db: md5("select '20261001000000_a.sql';"), fil: md5('select 2; -- sperre'), hvorfor: 'test' } }
    expect(endringsfeil(grunn, endret, { kjente })).toEqual([])
    expect(endringsfeil(grunn, [fil('20261001000000_a.sql', 'select 3;'), grunn[1]!], { kjente })).toHaveLength(1)
  })

  it('lar en migrasjon som er slått sammen, men ikke rullet ut, rettes', () => {
    const rettet = [grunn[0]!, fil('20261001000001_b.sql', 'select 22;')]
    expect(endringsfeil(grunn, rettet, { utrullet: [grunn[0]!], kjente: {} })).toEqual([])
    expect(endringsfeil(grunn, [grunn[0]!], { utrullet: [grunn[0]!], kjente: {} })).toEqual([])
    expect(endringsfeil(grunn, [grunn[0]!, fil('20261001000001_b.sql', 'drop table a;')], { utrullet: [grunn[0]!], kjente: {} })).toEqual([
      expect.stringContaining('20261001000001_b.sql: inneholder drop table'),
    ])
  })

  it('stopper en ny destruktiv migrasjon uten godkjenning', () => {
    expect(endringsfeil(grunn, [...grunn, fil('20261001000002_c.sql', 'truncate a;')], { kjente: {} })).toEqual([
      expect.stringContaining('20261001000002_c.sql: inneholder truncate'),
    ])
  })
})

describe('ventende migrasjoner', () => {
  it('er filene produksjonen ikke har kjørt, og versjoner uten fil meldes', () => {
    const filer = ['20261001000000_a.sql', '20261001000001_b.sql', '20261001000002_c.sql'].map((f) => lesMigrasjonsfil(f, ''))
    const { ventende, utenFil } = ventendeMigrasjoner(filer, ['20261001000000', '20261001000002', '20260901000000'])
    expect(ventende.map((f) => f.versjon)).toEqual(['20261001000001'])
    expect(utenFil).toEqual(['20260901000000'])
  })
})
