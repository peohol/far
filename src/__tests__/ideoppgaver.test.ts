/**
 * Arkivet («Ikke aktuelt») og Planlagte oppgaver i databasen: hvem som får
 * arkivere, gjenopprette, overføre og arbeide med oppgavene, at en frosset idé
 * ikke kan endres eller kommenteres, at arkivet ryddes etter 60 dager, og
 * hvordan de gamle statusene føres over — mot en ekte database bygd av
 * migrasjonene.
 */
import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { feilFra, kjorMigrasjoner, nyDatabase, opprettBruker, som } from './hjelp/testdatabase'

const MIGRASJON = '20260929093000_ideer_arkiv_og_oppgaver.sql'
const DOK = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hei' }] }] })

interface Oversiktsrad {
  id: string
  arkivert_kl: string | null
  oppgave: { id: string; status: string; nummer: number | null } | null
}

interface Oppgave {
  id: string
  ide_id: string
  tittel: string
  status: string
  nummer: number | null
  endringslogg: string | null
  har_prompt: boolean
  prompt?: string
  klar_kl: string | null
  utfort_kl: string | null
}

describe('arkivet og de planlagte oppgavene', () => {
  let db: PGlite
  let admin: string
  let ada: string
  let bo: string

  const sql = <T = Record<string, unknown>>(bruker: string | null, tekst: string, parametre: unknown[] = []) =>
    som(db, bruker, async (tx) => (await tx.query<T>(tekst, parametre)).rows)
  const en = async <T>(bruker: string | null, tekst: string, parametre: unknown[] = []) =>
    Object.values((await sql<Record<string, T>>(bruker, tekst, parametre))[0]!)[0] as T

  const nyIde = async (bruker: string, tittel = 'En idé') =>
    en<string>(bruker, `insert into public.ideer (kategori, tittel) values ('fag', $1) returning id`, [tittel])
  const nyKommentar = (bruker: string, ide: string) =>
    en<string>(bruker, 'insert into public.idekommentarer (ide_id, tekst) values ($1, $2) returning id', [ide, DOK])
  const oversikt = async (bruker: string, ide: string) =>
    (await en<Oversiktsrad[]>(bruker, 'select public.ideoversikt()')).find((i) => i.id === ide)
  const overfor = (ide: string) => en<string>(admin, 'select public.overfor_ide($1)', [ide])
  const oppgave = (bruker: string, id: string) => en<Oppgave | null>(bruker, 'select public.oppgave($1)', [id])

  beforeAll(async () => {
    db = await nyDatabase()
    admin = await opprettBruker(db, { brukernavn: 'admin', fornavn: 'Ada', etternavn: 'Admin', rolle: 'admin' })
    ada = await opprettBruker(db, { brukernavn: 'ada.l', fornavn: 'Ada', etternavn: 'Lovelace', rolle: 'user' })
    bo = await opprettBruker(db, { brukernavn: 'bob', fornavn: 'Bo', etternavn: 'Bruker', rolle: 'user' })
  }, 60_000)

  it('lar bare en administrator arkivere og gjenopprette, og fryser idéen imens', async () => {
    const ide = await nyIde(ada)
    const kommentar = await nyKommentar(bo, ide)
    expect(await feilFra(() => sql(ada, 'select public.arkiver_ide($1)', [ide]))).toMatchObject({ code: '42501' })

    await sql(admin, 'select public.arkiver_ide($1)', [ide])
    expect((await oversikt(bo, ide))!.arkivert_kl).toEqual(expect.any(String))
    // Å arkivere er ingen endring av idéen.
    expect((await sql<{ endret_kl: string | null }>(bo, 'select endret_kl from public.ideer where id = $1', [ide]))[0]!.endret_kl).toBeNull()
    expect(await feilFra(() => sql(admin, 'select public.arkiver_ide($1)', [ide]))).toMatchObject({ code: '55000' })

    // Frosset: ingen endringer, kommentarer eller hjerter, og forfatteren kan ikke slette.
    expect(await sql(ada, `update public.ideer set tittel = 'Ny' where id = $1 returning id`, [ide])).toEqual([])
    expect(await sql(ada, 'delete from public.ideer where id = $1 returning id', [ide])).toEqual([])
    expect(await feilFra(() => nyKommentar(ada, ide))).toMatchObject({ code: '42501' })
    expect(await feilFra(() => sql(bo, 'update public.idekommentarer set tekst = $2 where id = $1', [kommentar, DOK]))).toMatchObject({ code: '42501' })
    expect(await feilFra(() => sql(bo, 'delete from public.idekommentarer where id = $1', [kommentar]))).toMatchObject({ code: '42501' })
    expect(await feilFra(() => sql(bo, 'insert into public.idehjerter (ide_id) values ($1)', [ide]))).toMatchObject({ code: '42501' })

    expect(await feilFra(() => sql(ada, 'select public.gjenopprett_ide($1)', [ide]))).toMatchObject({ code: '42501' })
    await sql(admin, 'select public.gjenopprett_ide($1)', [ide])
    expect((await oversikt(bo, ide))!.arkivert_kl).toBeNull()
    await sql(bo, 'insert into public.idehjerter (ide_id) values ($1)', [ide])
    expect(await feilFra(() => sql(admin, 'select public.gjenopprett_ide($1)', [ide]))).toMatchObject({ code: '55000' })
  })

  it('lar en administrator slette en arkivert idé, med tråden', async () => {
    const ide = await nyIde(ada)
    await nyKommentar(bo, ide)
    await sql(admin, 'select public.arkiver_ide($1)', [ide])
    expect(await sql(admin, 'delete from public.ideer where id = $1 returning id', [ide])).toEqual([{ id: ide }])
    expect(await sql(bo, 'select id from public.idekommentarer where ide_id = $1', [ide])).toEqual([])
  })

  it('skjuler og sletter idéer som har stått i arkivet i 60 dager', async () => {
    const gammel = await nyIde(ada, 'Gammel')
    const ny = await nyIde(ada, 'Ny')
    await nyKommentar(bo, gammel)
    await sql(admin, 'select public.arkiver_ide($1)', [gammel])
    await sql(admin, 'select public.arkiver_ide($1)', [ny])
    await db.query(`update public.ideer set arkivert_kl = now() - interval '60 days' where id = $1`, [gammel])
    await db.query(`update public.ideer set arkivert_kl = now() - interval '59 days' where id = $1`, [ny])

    expect(await oversikt(bo, gammel)).toBeUndefined()
    expect(await en(bo, 'select public.idetraad($1)', [gammel])).toBeNull()
    expect(await feilFra(() => sql(admin, 'select public.gjenopprett_ide($1)', [gammel]))).toMatchObject({ code: '55000' })
    expect(await oversikt(bo, ny)).toBeDefined()

    expect(await en<number>(bo, 'select public.rydd_idearkiv()')).toBe(1)
    expect(await db.query('select id from public.ideer where id = $1', [gammel])).toMatchObject({ rows: [] })
    expect(await en<number>(bo, 'select public.rydd_idearkiv()')).toBe(0)
    expect(await feilFra(() => sql(null, 'select public.rydd_idearkiv()'))).toMatchObject({ code: '42501' })
  })

  it('overfører en idé til oppgavene, fryser den og lar den ikke slettes', async () => {
    const ide = await nyIde(ada, 'Mørk modus')
    expect(await feilFra(() => sql(ada, 'select public.overfor_ide($1)', [ide]))).toMatchObject({ code: '42501' })
    const id = await overfor(ide)

    expect((await oversikt(bo, ide))!.oppgave).toEqual({ id, status: 'ikke_paabegynt', nummer: null })
    expect(await oppgave(bo, id)).toMatchObject({ ide_id: ide, tittel: 'Mørk modus', status: 'ikke_paabegynt', prompt: '', har_prompt: false })
    expect((await en<Oppgave[]>(bo, 'select public.oppgaveoversikt()')).find((o) => o.id === id)).not.toHaveProperty('prompt')

    expect(await feilFra(() => overfor(ide))).toMatchObject({ code: '55000' })
    expect(await feilFra(() => sql(admin, 'select public.arkiver_ide($1)', [ide]))).toMatchObject({ code: '55000' })
    expect(await feilFra(() => nyKommentar(bo, ide))).toMatchObject({ code: '42501' })
    expect(await sql(ada, 'delete from public.ideer where id = $1 returning id', [ide])).toEqual([])
    expect(await sql(admin, 'delete from public.ideer where id = $1 returning id', [ide])).toEqual([])

    // Oppgavene kan bare leses direkte, ikke skrives.
    expect(await feilFra(() => sql(admin, `update public.oppgaver set status = 'klar' where id = $1`, [id]))).toMatchObject({ code: '42501' })
    expect(await feilFra(() => sql(admin, 'delete from public.oppgaver where id = $1', [id]))).toMatchObject({ code: '42501' })
  })

  it('setter oppgaven under arbeid ved første endring, og klar bare med prompt', async () => {
    const id = await overfor(await nyIde(ada))
    expect(await feilFra(() => sql(bo, 'select public.lagre_oppgaveprompt($1, $2)', [id, 'Gjør det']))).toMatchObject({ code: '42501' })
    expect(await feilFra(() => sql(admin, 'select public.sett_oppgave_klar($1, true)', [id]))).toMatchObject({ code: '23514' })

    await sql(admin, 'select public.lagre_oppgaveprompt($1, $2)', [id, 'Legg til en knapp.'])
    expect(await oppgave(bo, id)).toMatchObject({ status: 'under_arbeid', prompt: 'Legg til en knapp.', har_prompt: true, klar_kl: null })

    expect(await feilFra(() => sql(bo, 'select public.sett_oppgave_klar($1, true)', [id]))).toMatchObject({ code: '42501' })
    await sql(admin, 'select public.sett_oppgave_klar($1, true)', [id])
    expect(await oppgave(bo, id)).toMatchObject({ status: 'klar', klar_kl: expect.any(String) })
    // En endring i prompten holder den klar; en tom prompt gjør det ikke.
    await sql(admin, 'select public.lagre_oppgaveprompt($1, $2)', [id, 'Legg til to knapper.'])
    expect((await oppgave(bo, id))!.status).toBe('klar')
    await sql(admin, 'select public.lagre_oppgaveprompt($1, $2)', [id, '  '])
    expect(await oppgave(bo, id)).toMatchObject({ status: 'under_arbeid', klar_kl: null })

    await sql(admin, 'select public.lagre_oppgaveprompt($1, $2)', [id, 'Legg til en knapp.'])
    await sql(admin, 'select public.sett_oppgave_klar($1, true)', [id])
    await sql(admin, 'select public.sett_oppgave_klar($1, false)', [id])
    expect(await oppgave(bo, id)).toMatchObject({ status: 'under_arbeid', klar_kl: null })
  })

  it('lar bare en migrering merke en klar oppgave utført, med nummer og endringslogg', async () => {
    const id = await overfor(await nyIde(ada))
    expect(await feilFra(() => db.query(`select public.fullfor_oppgave($1, '1.53.0')`, [id]))).toMatchObject({ code: '55000' })
    await sql(admin, 'select public.lagre_oppgaveprompt($1, $2)', [id, 'Gjør det.'])
    await sql(admin, 'select public.sett_oppgave_klar($1, true)', [id])

    expect(await feilFra(() => sql(admin, `select public.fullfor_oppgave($1, '1.53.0')`, [id]))).toMatchObject({ code: '42501' })
    expect(await feilFra(() => db.query(`select public.fullfor_oppgave($1, 'v1.53')`, [id]))).toMatchObject({ code: '23514' })

    const { rows } = await db.query<{ nummer: number }>(`select public.fullfor_oppgave($1, '1.53.0') as nummer`, [id])
    expect(rows[0]!.nummer).toBeGreaterThan(0)
    expect(await oppgave(bo, id)).toMatchObject({ status: 'utfort', nummer: rows[0]!.nummer, endringslogg: '1.53.0', utfort_kl: expect.any(String) })

    // En utført oppgave står for alltid.
    expect(await feilFra(() => sql(admin, 'select public.flytt_oppgave_tilbake($1)', [id]))).toMatchObject({ code: '55000' })
    expect(await feilFra(() => sql(admin, 'select public.lagre_oppgaveprompt($1, $2)', [id, 'Mer']))).toMatchObject({ code: '55000' })
    expect(await feilFra(() => sql(admin, 'select public.sett_oppgave_klar($1, false)', [id]))).toMatchObject({ code: '55000' })

    // Nummeret øker for hver utførte oppgave.
    const neste = await overfor(await nyIde(ada))
    await sql(admin, 'select public.lagre_oppgaveprompt($1, $2)', [neste, 'Og dette.'])
    await sql(admin, 'select public.sett_oppgave_klar($1, true)', [neste])
    const { rows: andre } = await db.query<{ nummer: number }>(`select public.fullfor_oppgave($1, '1.53.0') as nummer`, [neste])
    expect(andre[0]!.nummer).toBe(rows[0]!.nummer + 1)
  })

  it('flytter en oppgave tilbake til idélista, der den er åpen igjen', async () => {
    const ide = await nyIde(ada)
    const id = await overfor(ide)
    expect(await feilFra(() => sql(bo, 'select public.flytt_oppgave_tilbake($1)', [id]))).toMatchObject({ code: '42501' })
    await sql(admin, 'select public.flytt_oppgave_tilbake($1)', [id])
    expect((await oversikt(bo, ide))!.oppgave).toBeNull()
    expect(await oppgave(bo, id)).toBeNull()
    await nyKommentar(bo, ide)
    expect(await feilFra(() => sql(admin, 'select public.flytt_oppgave_tilbake($1)', [id]))).toMatchObject({ code: '55000' })
  })

  it('gir ikke anonyme noe', async () => {
    for (const kall of ['select public.oppgaveoversikt()', `select public.oppgave(gen_random_uuid())`, 'select public.ideoversikt()']) {
      expect(await feilFra(() => sql(null, kall))).toMatchObject({ code: '42501' })
    }
    expect(await feilFra(() => sql(null, 'select * from public.oppgaver'))).toMatchObject({ code: '42501' })
  })
})

describe('overgangen fra statusene', () => {
  it('gjør planlagte og påbegynte idéer til oppgaver og legger «ikke aktuelt» i arkivet', async () => {
    const db = await nyDatabase({ til: MIGRASJON })
    const ada = await opprettBruker(db, { brukernavn: 'ada.l', fornavn: 'Ada', etternavn: 'Lovelace', rolle: 'user' })
    const ide = async (tittel: string, status: string | null) =>
      (
        await db.query<{ id: string }>(
          `insert into public.ideer (forfatter_id, kategori, tittel, status, status_kl)
           values ($1, 'fag', $2, $3, case when $3::public.idestatus is null then null else '2026-09-28T10:00:00Z'::timestamptz end) returning id`,
          [ada, tittel, status],
        )
      ).rows[0]!.id
    const planlagt = await ide('Planlagt', 'planlagt')
    const underArbeid = await ide('Under arbeid', 'under_arbeid')
    const gjennomfort = await ide('Gjennomført', 'gjennomfort')
    const ikkeAktuelt = await ide('Ikke aktuelt', 'ikke_aktuelt')
    const uten = await ide('Uten', null)

    await kjorMigrasjoner(db, { bare: [MIGRASJON] })

    const { rows: oppgaver } = await db.query<{ ide_id: string; status: string; overfort_kl: Date }>('select ide_id, status, overfort_kl from public.oppgaver')
    expect(new Map(oppgaver.map((o) => [o.ide_id, o.status]))).toEqual(
      new Map([
        [planlagt, 'ikke_paabegynt'],
        [underArbeid, 'under_arbeid'],
        [gjennomfort, 'under_arbeid'],
      ]),
    )
    expect(oppgaver[0]!.overfort_kl.toISOString()).toBe('2026-09-28T10:00:00.000Z')
    const { rows: ideer } = await db.query<{ id: string; arkivert_kl: Date | null }>('select id, arkivert_kl from public.ideer')
    expect(ideer.find((i) => i.id === ikkeAktuelt)!.arkivert_kl?.toISOString()).toBe('2026-09-28T10:00:00.000Z')
    expect(ideer.find((i) => i.id === uten)!.arkivert_kl).toBeNull()
    expect(await db.query(`select 1 from pg_type where typname = 'idestatus'`)).toMatchObject({ rows: [] })
  }, 60_000)
})
