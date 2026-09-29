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

const MIGRASJON = '20260929103534_ideer_arkiv_og_oppgaver.sql'
const TITTELMIGRASJON = '20260929113630_oppgavetittel.sql'
const AGENTMIGRASJON = '20260929131000_oppgaver_agentstatus.sql'
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
  tatt_kl: string | null
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
  /** En overført oppgave med prompt, merket klar, og nummeret den fikk. */
  const klarOppgave = async () => {
    const id = await overfor(await nyIde(ada))
    await sql(admin, 'select public.lagre_oppgave($1, $$En oppgave$$, $2)', [id, 'Gjør det.'])
    await sql(admin, 'select public.sett_oppgave_klar($1, true)', [id])
    return { id, nummer: (await oppgave(bo, id))!.nummer! }
  }
  /** Det Claude kjører som migrering: uten innlogget bruker og uten rolle. */
  const migrering = (tekst: string, parametre: unknown[] = []) => db.query(tekst, parametre)

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

    expect((await oversikt(bo, ide))!.oppgave).toEqual({ id, status: 'ikke_paabegynt', nummer: expect.any(Number) })
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
    expect(await feilFra(() => sql(bo, 'select public.lagre_oppgave($1, $$En oppgave$$, $2)', [id, 'Gjør det']))).toMatchObject({ code: '42501' })
    expect(await feilFra(() => sql(admin, 'select public.sett_oppgave_klar($1, true)', [id]))).toMatchObject({ code: '23514' })

    await sql(admin, 'select public.lagre_oppgave($1, $$En oppgave$$, $2)', [id, 'Legg til en knapp.'])
    expect(await oppgave(bo, id)).toMatchObject({ status: 'under_arbeid', prompt: 'Legg til en knapp.', har_prompt: true, klar_kl: null })

    expect(await feilFra(() => sql(bo, 'select public.sett_oppgave_klar($1, true)', [id]))).toMatchObject({ code: '42501' })
    await sql(admin, 'select public.sett_oppgave_klar($1, true)', [id])
    expect(await oppgave(bo, id)).toMatchObject({ status: 'klar', klar_kl: expect.any(String) })
    // En endring i prompten holder den klar; en tom prompt gjør det ikke.
    await sql(admin, 'select public.lagre_oppgave($1, $$En oppgave$$, $2)', [id, 'Legg til to knapper.'])
    expect((await oppgave(bo, id))!.status).toBe('klar')
    await sql(admin, 'select public.lagre_oppgave($1, $$En oppgave$$, $2)', [id, '  '])
    expect(await oppgave(bo, id)).toMatchObject({ status: 'under_arbeid', klar_kl: null })

    await sql(admin, 'select public.lagre_oppgave($1, $$En oppgave$$, $2)', [id, 'Legg til en knapp.'])
    await sql(admin, 'select public.sett_oppgave_klar($1, true)', [id])
    await sql(admin, 'select public.sett_oppgave_klar($1, false)', [id])
    expect(await oppgave(bo, id)).toMatchObject({ status: 'under_arbeid', klar_kl: null })
  })

  it('gir oppgaven idéens overskrift, som bare en administrator kan endre uten at idéen endres', async () => {
    const ide = await nyIde(ada, 'Mørk modus i PDF')
    const id = await overfor(ide)
    expect(await oppgave(bo, id)).toMatchObject({ tittel: 'Mørk modus i PDF' })

    const lagre = (bruker: string, tittel: string, prompt = '') =>
      sql(bruker, 'select public.lagre_oppgave($1, $2, $3)', [id, tittel, prompt])
    expect(await feilFra(() => lagre(bo, 'Nytt navn'))).toMatchObject({ code: '42501' })
    expect(await feilFra(() => lagre(admin, '   '))).toMatchObject({ code: '23514' })
    expect(await feilFra(() => lagre(admin, 'x'.repeat(141)))).toMatchObject({ code: '23514' })

    await lagre(admin, '  Mørkt tema i utskriften  ')
    expect(await oppgave(bo, id)).toMatchObject({ tittel: 'Mørkt tema i utskriften', status: 'under_arbeid' })
    const liste = await en<{ id: string; tittel: string }[]>(bo, 'select public.oppgaveoversikt()')
    expect(liste.find((o) => o.id === id)!.tittel).toBe('Mørkt tema i utskriften')
    expect(await en(bo, 'select tittel from public.ideer where id = $1', [ide])).toBe('Mørk modus i PDF')

    // En ny overskrift holder en klar oppgave klar.
    await lagre(admin, 'Mørkt tema i utskriften', 'Gjør det.')
    await sql(admin, 'select public.sett_oppgave_klar($1, true)', [id])
    await lagre(admin, 'Mørkt tema i PDF-en', 'Gjør det.')
    expect(await oppgave(bo, id)).toMatchObject({ tittel: 'Mørkt tema i PDF-en', status: 'klar' })
  })

  it('gir hver oppgave neste nummer når den overføres, og gir aldri et nummer igjen', async () => {
    const forste = await overfor(await nyIde(ada))
    const nummer = (await oppgave(bo, forste))!.nummer!
    expect(nummer).toBeGreaterThan(0)
    const andre = await overfor(await nyIde(ada))
    expect((await oppgave(bo, andre))!.nummer).toBe(nummer + 1)

    // En oppgave som flyttes tilbake, tar ikke nummeret med seg til en annen.
    await sql(admin, 'select public.flytt_oppgave_tilbake($1)', [andre])
    const tredje = await overfor(await nyIde(ada))
    expect((await oppgave(bo, tredje))!.nummer).toBe(nummer + 2)
  })

  it('lar bare en migrering ta klare oppgaver, alle eller ingen, så to økter ikke tar den samme', async () => {
    const a = await klarOppgave()
    const b = await klarOppgave()
    const ikkeKlar = await overfor(await nyIde(ada))
    const ikkeKlarNummer = (await oppgave(bo, ikkeKlar))!.nummer!

    expect(await feilFra(() => sql(admin, 'select public.ta_oppgaver($1)', [[a.nummer]]))).toMatchObject({ code: '42501' })
    expect(await feilFra(() => migrering('select public.ta_oppgaver($1)', [[]]))).toMatchObject({ code: '22023' })

    // Én som ikke er klar, stopper alle.
    const feil = await feilFra(() => migrering('select public.ta_oppgaver($1)', [[a.nummer, ikkeKlarNummer]]))
    expect(feil).toMatchObject({ code: '55000' })
    expect(feil!.message).toContain(`OPG-${String(ikkeKlarNummer).padStart(3, '0')} (ikke_paabegynt)`)
    expect((await oppgave(bo, a.id))!.status).toBe('klar')

    await migrering('select public.ta_oppgaver($1)', [[a.nummer, b.nummer]])
    expect(await oppgave(bo, a.id)).toMatchObject({ status: 'haandteres', tatt_kl: expect.any(String), klar_kl: expect.any(String) })
    expect((await oppgave(bo, b.id))!.status).toBe('haandteres')
    const liste = await en<Oppgave[]>(bo, 'select public.oppgaveoversikt()')
    expect(liste.find((o) => o.id === a.id)).toMatchObject({ status: 'haandteres', tatt_kl: expect.any(String) })

    // En annen økt får ikke ta dem.
    expect(await feilFra(() => migrering('select public.ta_oppgaver($1)', [[a.nummer]]))).toMatchObject({ code: '55000' })
    expect(await feilFra(() => migrering('select public.ta_oppgaver($1)', [[99999]]))).toMatchObject({ code: '55000' })
  })

  it('låser en oppgave en agent håndterer, til en administrator frigir den', async () => {
    const { id, nummer } = await klarOppgave()
    await migrering('select public.ta_oppgaver($1)', [[nummer]])

    const handteres = { code: '55000', message: 'Oppgaven håndteres av en agent. Frigi den først.' }
    expect(await feilFra(() => sql(admin, 'select public.lagre_oppgave($1, $$Ny$$, $2)', [id, 'Noe annet.']))).toMatchObject(handteres)
    expect(await feilFra(() => sql(admin, 'select public.sett_oppgave_klar($1, false)', [id]))).toMatchObject(handteres)
    expect(await feilFra(() => sql(admin, 'select public.sett_oppgave_klar($1, true)', [id]))).toMatchObject(handteres)
    expect(await feilFra(() => sql(admin, 'select public.flytt_oppgave_tilbake($1)', [id]))).toMatchObject(handteres)
    expect((await oppgave(bo, id))!.prompt).toBe('Gjør det.')

    expect(await feilFra(() => sql(bo, 'select public.frigi_oppgave($1)', [id]))).toMatchObject({ code: '42501' })
    await sql(admin, 'select public.frigi_oppgave($1)', [id])
    expect(await oppgave(bo, id)).toMatchObject({ status: 'klar', tatt_kl: null, nummer })
    expect(await feilFra(() => sql(admin, 'select public.frigi_oppgave($1)', [id]))).toMatchObject({ code: '55000' })

    // Frigitt kan den tas på nytt.
    await migrering('select public.ta_oppgaver($1)', [[nummer]])
    expect((await oppgave(bo, id))!.status).toBe('haandteres')
  })

  it('lar bare en migrering merke en oppgave utført, med endringslogg og nummeret den har', async () => {
    const pabegynt = await overfor(await nyIde(ada))
    const pabegyntNummer = (await oppgave(bo, pabegynt))!.nummer!
    expect(await feilFra(() => migrering(`select public.fullfor_oppgave($1, '1.53.0')`, [pabegyntNummer]))).toMatchObject({ code: '55000' })

    const { id, nummer } = await klarOppgave()
    await migrering('select public.ta_oppgaver($1)', [[nummer]])
    expect(await feilFra(() => sql(admin, `select public.fullfor_oppgave($1, '1.53.0')`, [nummer]))).toMatchObject({ code: '42501' })
    expect(await feilFra(() => migrering(`select public.fullfor_oppgave($1, 'v1.53')`, [nummer]))).toMatchObject({ code: '23514' })

    await migrering(`select public.fullfor_oppgave($1, '1.53.0')`, [nummer])
    expect(await oppgave(bo, id)).toMatchObject({ status: 'utfort', nummer, endringslogg: '1.53.0', utfort_kl: expect.any(String), tatt_kl: expect.any(String) })

    // En utført oppgave står for alltid.
    expect(await feilFra(() => sql(admin, 'select public.flytt_oppgave_tilbake($1)', [id]))).toMatchObject({ code: '55000' })
    expect(await feilFra(() => sql(admin, 'select public.lagre_oppgave($1, $$En oppgave$$, $2)', [id, 'Mer']))).toMatchObject({ code: '55000' })
    expect(await feilFra(() => sql(admin, 'select public.sett_oppgave_klar($1, false)', [id]))).toMatchObject({ code: '55000' })
    expect(await feilFra(() => sql(admin, 'select public.frigi_oppgave($1)', [id]))).toMatchObject({ code: '55000' })
    expect(await feilFra(() => migrering(`select public.fullfor_oppgave($1, '1.53.0')`, [nummer]))).toMatchObject({ code: '55000' })

    // En klar oppgave som ble utført før agentene tok oppgavene, kan fortsatt merkes utført.
    const gammel = await klarOppgave()
    await migrering(`select public.fullfor_oppgave($1, '1.53.0')`, [gammel.nummer])
    expect(await oppgave(bo, gammel.id)).toMatchObject({ status: 'utfort', tatt_kl: expect.any(String) })
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

describe('overskriften på oppgavene som fantes', () => {
  it('blir overskriften på idéen de kom fra', async () => {
    const db = await nyDatabase({ til: TITTELMIGRASJON })
    const ada = await opprettBruker(db, { brukernavn: 'ada.l', fornavn: 'Ada', etternavn: 'Lovelace', rolle: 'user' })
    const { rows } = await db.query<{ id: string }>(`insert into public.ideer (forfatter_id, kategori, tittel) values ($1, 'fag', 'Gammel idé') returning id`, [ada])
    await db.query('insert into public.oppgaver (ide_id) values ($1)', [rows[0]!.id])

    await kjorMigrasjoner(db, { bare: [TITTELMIGRASJON] })

    expect((await db.query('select tittel from public.oppgaver')).rows).toEqual([{ tittel: 'Gammel idé' }])
  }, 60_000)
})

describe('numrene på oppgavene som fantes', () => {
  it('følger rekkefølgen de ble overført i, etter de utførte', async () => {
    const db = await nyDatabase({ til: AGENTMIGRASJON })
    const ada = await opprettBruker(db, { brukernavn: 'ada.l', fornavn: 'Ada', etternavn: 'Lovelace', rolle: 'user' })
    const ny = async (tittel: string, overfort: string) => {
      const { rows } = await db.query<{ id: string }>(
        `insert into public.ideer (forfatter_id, kategori, tittel) values ($1, 'fag', $2) returning id`,
        [ada, tittel],
      )
      await db.query(`insert into public.oppgaver (ide_id, tittel, overfort_kl, prompt) values ($1, $2, $3, 'Gjør det.')`, [rows[0]!.id, tittel, overfort])
    }
    await ny('Utført', '2026-09-29T10:00:00Z')
    await ny('Senere', '2026-09-29T12:00:00Z')
    await ny('Tidligere', '2026-09-29T11:00:00Z')
    await db.query(`update public.oppgaver set status = 'klar', klar_kl = now() where tittel <> 'Tidligere'`)
    await db.query(`select public.fullfor_oppgave(id, '1.56.0') from public.oppgaver where tittel = 'Utført'`)

    await kjorMigrasjoner(db, { bare: [AGENTMIGRASJON] })

    const { rows } = await db.query<{ tittel: string; nummer: number; status: string }>('select tittel, nummer, status from public.oppgaver order by nummer')
    expect(rows).toEqual([
      { tittel: 'Utført', nummer: 1, status: 'utfort' },
      { tittel: 'Tidligere', nummer: 2, status: 'ikke_paabegynt' },
      { tittel: 'Senere', nummer: 3, status: 'klar' },
    ])
    // Neste overføring fortsetter etter det høyeste nummeret.
    const { rows: ide } = await db.query<{ id: string }>(`insert into public.ideer (forfatter_id, kategori, tittel) values ($1, 'fag', 'Ny') returning id`, [ada])
    await db.query(`insert into public.oppgaver (ide_id, tittel, nummer) values ($1, 'Ny', nextval('intern.oppgavenummer'))`, [ide[0]!.id])
    expect((await db.query(`select nummer from public.oppgaver where tittel = 'Ny'`)).rows).toEqual([{ nummer: 4 }])
  }, 60_000)
})

describe('migreringene som tar og fullfører oppgaver', () => {
  it('gjør ingenting i en database uten oppgaver', async () => {
    const db = await nyDatabase()
    await db.exec(`
      select public.ta_oppgaver(array[7, 8]) where exists (select 1 from public.oppgaver);
      select public.fullfor_oppgave(7, '1.58.0') where exists (select 1 from public.oppgaver);
    `)
    expect((await db.query('select count(*)::int as antall from public.oppgaver')).rows).toEqual([{ antall: 0 }])
  }, 60_000)
})
