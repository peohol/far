/** Navnene på migrasjonsfilene, og spørringen som sammenligner dem med historikken databasen har registrert. */
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { filnavnfeil, historikkSql, KJENTE_AVVIK, lesMigrasjonsfil, md5 } from '../faginnhold/migrasjonshistorikk'
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
  /** Kjører spørringen mot en database med disse radene i historikken. */
  async function avvik(
    filer: Array<[string, string]>,
    historikk: Array<[string, string, string]>,
    kjente: Parameters<typeof historikkSql>[1] = {},
  ) {
    const db = new PGlite()
    await db.exec(`create schema supabase_migrations;
      create table supabase_migrations.schema_migrations (version text primary key, statements text[], name text);`)
    for (const [versjon, navn, tekst] of historikk) {
      await db.query('insert into supabase_migrations.schema_migrations values ($1, array[$2], $3)', [versjon, tekst, navn])
    }
    const { rows } = await db.query<{ versjon: string; navn: string; avvik: string }>(
      historikkSql(filer.map(([fil, innhold]) => lesMigrasjonsfil(fil, innhold)), kjente),
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
    const historikk: Array<[string, string, string]> = [
      ['20261001000001', 'b', 'select 2;'],
      ['20261001000003', 'borte', 'select 4;'],
    ]
    expect(await avvik([['20261001000001_b.sql', 'select 2; -- sperre']], historikk, kjente)).toEqual([])
    expect(await avvik([['20261001000001_b.sql', 'select 2; -- endret igjen']], historikk, kjente)).toEqual([
      { versjon: '20261001000001', navn: 'b', avvik: 'annet innhold enn det som ble kjørt' },
    ])
    expect(await avvik([['20261001000001_b_nytt_navn.sql', 'select 2; -- sperre']], historikk, kjente)).toEqual([
      { versjon: '20261001000001', navn: 'b_nytt_navn', avvik: 'registrert med navnet b' },
    ])
  })
})
