/**
 * Idéene i databasen: hvem som får lese, skrive, endre og slette, kommentar-
 * trådene med svar i svar, hjertene og brukerinnstillingene — mot en ekte
 * database bygd av migrasjonene.
 */
import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { feilFra, nyDatabase, opprettBruker, som } from './hjelp/testdatabase'

const DOK = (tekst: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: tekst }] }] })

describe('idéene i databasen', () => {
  let db: PGlite
  let admin: string
  let ada: string
  let bo: string

  /** Kjører én spørring som brukeren og gir radene tilbake. */
  const sql = <T = Record<string, unknown>>(bruker: string | null, tekst: string, parametre: unknown[] = []) =>
    som(db, bruker, async (tx) => (await tx.query<T>(tekst, parametre)).rows)

  const nyIde = async (bruker: string, tittel = 'En idé', kategori = 'fag') =>
    (await sql<{ id: string }>(bruker, 'insert into public.ideer (kategori, tittel) values ($1, $2) returning id', [kategori, tittel]))[0]!.id

  const nyKommentar = async (bruker: string, ide: string, forelder: string | null = null, tekst = 'Svar') =>
    (
      await sql<{ id: string }>(
        bruker,
        'insert into public.idekommentarer (ide_id, forelder_id, tekst) values ($1, $2, $3) returning id',
        [ide, forelder, JSON.stringify(DOK(tekst))],
      )
    )[0]!.id

  const traad = async (bruker: string, ide: string) =>
    (await sql<{ idetraad: Traad | null }>(bruker, 'select public.idetraad($1)', [ide]))[0]!.idetraad

  interface Traad {
    tittel: string
    status: string | null
    sist_sett: string | null
    lest_kl: string
    hjerter: number
    mitt_hjerte: boolean
    kommentarer: { id: string; forelder_id: string | null; forfatter_id: string | null; slettet: boolean; tekst: unknown; hjerter: number }[]
  }

  beforeAll(async () => {
    db = await nyDatabase()
    admin = await opprettBruker(db, { brukernavn: 'admin', fornavn: 'Ada', etternavn: 'Admin', rolle: 'admin' })
    ada = await opprettBruker(db, { brukernavn: 'ada.l', fornavn: 'Ada', etternavn: 'Lovelace', rolle: 'user' })
    bo = await opprettBruker(db, { brukernavn: 'bob', fornavn: 'Bo', etternavn: 'Bruker', rolle: 'user' })
  }, 60_000)

  it('lar alle innloggede skrive idéer som forfatter og lese alle, men ikke anonyme', async () => {
    const id = await nyIde(ada, 'Mørk modus i PDF-en', 'funksjonalitet')
    const [rad] = await sql<{ forfatter_id: string; endret_kl: string | null }>(bo, 'select * from public.ideer where id = $1', [id])
    expect(rad).toMatchObject({ forfatter_id: ada, endret_kl: null })
    expect(await feilFra(() => sql(null, 'select * from public.ideer'))).toMatchObject({ code: '42501' })

    // Forfatteren settes av databasen og kan ikke velges.
    const juks = await feilFra(() =>
      sql(bo, `insert into public.ideer (kategori, tittel, forfatter_id) values ('fag', 'Juks', $1)`, [ada]),
    )
    expect(juks).toMatchObject({ code: '42501' })
  })

  it('krever kategori og en trimmet overskrift', async () => {
    expect(await feilFra(() => sql(ada, `insert into public.ideer (tittel) values ('Uten kategori')`))).toMatchObject({ code: '23502' })
    expect(await feilFra(() => sql(ada, `insert into public.ideer (kategori, tittel) values ('fag', '')`))).toMatchObject({ code: '23514' })
    expect(await feilFra(() => sql(ada, `insert into public.ideer (kategori, tittel) values ('fag', ' mellomrom ')`))).toMatchObject({ code: '23514' })
    expect(await feilFra(() => sql(ada, `insert into public.ideer (kategori, tittel) values ('ukjent', 'x')`))).toMatchObject({ code: '22P02' })
  })

  it('lar bare forfatteren endre, og forfatteren eller en administrator slette', async () => {
    const id = await nyIde(ada, 'Før')
    expect(await sql(bo, `update public.ideer set tittel = 'Kapret' where id = $1 returning id`, [id])).toEqual([])
    expect(await sql(admin, `update public.ideer set tittel = 'Kapret' where id = $1 returning id`, [id])).toEqual([])
    const [endret] = await sql<{ tittel: string; endret_kl: string | null }>(
      ada,
      `update public.ideer set tittel = 'Etter' where id = $1 returning tittel, endret_kl`,
      [id],
    )
    expect(endret).toMatchObject({ tittel: 'Etter', endret_kl: expect.anything() })

    expect(await sql(bo, 'delete from public.ideer where id = $1 returning id', [id])).toEqual([])
    expect(await sql(admin, 'delete from public.ideer where id = $1 returning id', [id])).toHaveLength(1)

    const egen = await nyIde(bo)
    expect(await sql(bo, 'delete from public.ideer where id = $1 returning id', [egen])).toHaveLength(1)
  })

  it('tar vare på svarene når en kommentar med svar slettes, og rydder når det siste svaret går', async () => {
    const ide = await nyIde(ada)
    const topp = await nyKommentar(ada, ide, null, 'Topp')
    const svar = await nyKommentar(bo, ide, topp, 'Svar')
    const svarPaaSvar = await nyKommentar(ada, ide, svar, 'Svar på svar')
    await sql(bo, 'insert into public.idehjerter (ide_id, kommentar_id) values ($1, $2)', [ide, topp])

    // Ada sletter toppkommentaren: den står igjen uten tekst, forfatter og hjerter.
    await sql(ada, 'delete from public.idekommentarer where id = $1', [topp])
    let kommentarer = (await traad(bo, ide))!.kommentarer
    expect(kommentarer.map((k) => [k.id, k.slettet, k.forfatter_id, k.tekst, k.hjerter])).toEqual([
      [topp, true, null, null, 0],
      [svar, false, bo, DOK('Svar'), 0],
      [svarPaaSvar, false, ada, DOK('Svar på svar'), 0],
    ])
    // Heller ikke raden selv røper hvem som skrev den.
    expect(await sql(bo, 'select forfatter_id, tekst from public.idekommentarer where id = $1', [topp])).toEqual([
      { forfatter_id: null, tekst: null },
    ])

    // Det svares ikke på en slettet kommentar, og den kan ikke endres eller få hjerter.
    expect(await feilFra(() => nyKommentar(bo, ide, topp))).toMatchObject({ code: '23503' })
    expect(await sql(ada, `update public.idekommentarer set tekst = '{}' where id = $1 returning id`, [topp])).toEqual([])
    expect(
      await feilFra(() => sql(bo, 'insert into public.idehjerter (ide_id, kommentar_id) values ($1, $2)', [ide, topp])),
    ).toMatchObject({ code: '23503' })

    // Bo sletter svaret sitt, som har et svar under seg: også det står igjen.
    await sql(bo, 'delete from public.idekommentarer where id = $1', [svar])
    kommentarer = (await traad(bo, ide))!.kommentarer
    expect(kommentarer.map((k) => k.slettet)).toEqual([true, true, false])

    // Når det siste svaret slettes, ryddes hele den tomme grenen bort.
    await sql(ada, 'delete from public.idekommentarer where id = $1', [svarPaaSvar])
    expect((await traad(bo, ide))!.kommentarer).toEqual([])
  })

  it('lar bare forfatteren endre en kommentar, og en administrator slette andres', async () => {
    const ide = await nyIde(ada)
    const k = await nyKommentar(bo, ide)
    expect(await sql(ada, `update public.idekommentarer set tekst = $2 where id = $1 returning id`, [k, DOK('x')])).toEqual([])
    expect(await sql(ada, 'delete from public.idekommentarer where id = $1 returning id', [k])).toEqual([])
    const [endret] = await sql<{ endret_kl: string | null }>(
      bo,
      'update public.idekommentarer set tekst = $2 where id = $1 returning endret_kl',
      [k, DOK('Rettet')],
    )
    expect(endret!.endret_kl).not.toBeNull()
    expect(await sql(admin, 'delete from public.idekommentarer where id = $1 returning id', [k])).toHaveLength(1)
  })

  it('holder svarene under samme idé', async () => {
    const en = await nyIde(ada)
    const annen = await nyIde(ada)
    const k = await nyKommentar(ada, en)
    expect(await feilFra(() => nyKommentar(bo, annen, k))).toMatchObject({ code: '23503' })
  })

  it('sletter hele tråden med idéen, også grener med svar', async () => {
    const ide = await nyIde(bo)
    const a = await nyKommentar(ada, ide)
    const b = await nyKommentar(bo, ide, a)
    await nyKommentar(ada, ide, b)
    await sql(ada, 'insert into public.idehjerter (ide_id, kommentar_id) values ($1, $2)', [ide, b])
    await sql(bo, 'delete from public.ideer where id = $1', [ide])
    const [igjen] = await db.query<{ n: number }>(
      `select (select count(*) from public.idekommentarer where ide_id = $1)
            + (select count(*) from public.idehjerter where ide_id = $1) as n`,
      [ide],
    )
      .then((r) => r.rows)
    expect(Number(igjen!.n)).toBe(0)
  })

  it('gir ett hjerte per bruker, og bare brukeren selv kan ta det tilbake', async () => {
    const ide = await nyIde(ada)
    await sql(bo, 'insert into public.idehjerter (ide_id) values ($1)', [ide])
    expect(await feilFra(() => sql(bo, 'insert into public.idehjerter (ide_id) values ($1)', [ide]))).toMatchObject({ code: '23505' })
    expect(
      await feilFra(() => sql(bo, 'insert into public.idehjerter (ide_id, bruker_id) values ($1, $2)', [ide, ada])),
    ).toMatchObject({ code: '42501' })
    await sql(ada, 'insert into public.idehjerter (ide_id) values ($1)', [ide])

    const oversikt = async (bruker: string) =>
      (await sql<{ ideoversikt: { id: string; hjerter: number; mitt_hjerte: boolean; kommentarer: number }[] }>(
        bruker,
        'select public.ideoversikt()',
      ))[0]!.ideoversikt.find((i) => i.id === ide)
    expect(await oversikt(bo)).toMatchObject({ hjerter: 2, mitt_hjerte: true, kommentarer: 0 })

    expect(await sql(ada, 'delete from public.idehjerter where ide_id = $1 and bruker_id = $2 returning 1', [ide, bo])).toEqual([])
    await sql(bo, 'delete from public.idehjerter where ide_id = $1 and bruker_id = $2', [ide, bo])
    expect(await oversikt(bo)).toMatchObject({ hjerter: 1, mitt_hjerte: false })
    expect(await oversikt(ada)).toMatchObject({ hjerter: 1, mitt_hjerte: true })
  })

  it('teller bare kommentarer som ikke er slettet i oversikten, og gir tråden uten beskrivelse der', async () => {
    const ide = await nyIde(ada, 'Talt')
    await sql(ada, 'update public.ideer set tekst = $2 where id = $1', [ide, DOK('Beskrivelse')])
    const a = await nyKommentar(bo, ide)
    await nyKommentar(ada, ide, a)
    await sql(bo, 'delete from public.idekommentarer where id = $1', [a])
    const [{ ideoversikt }] = (await sql<{ ideoversikt: Record<string, unknown>[] }>(bo, 'select public.ideoversikt()')) as [
      { ideoversikt: Record<string, unknown>[] },
    ]
    const rad = ideoversikt.find((i) => i.id === ide)!
    expect(rad).toMatchObject({ tittel: 'Talt', kommentarer: 1, forfatter_id: ada })
    expect(rad).not.toHaveProperty('tekst')
    expect((await traad(bo, ide))!.tittel).toBe('Talt')
    expect(await traad(bo, '00000000-0000-0000-0000-000000000001')).toBeNull()
  })

  it('lar bare en administrator gi status, uten at idéen regnes som endret', async () => {
    const ide = await nyIde(ada, 'Med status')
    const status = async () =>
      (await sql<{ status: string | null; endret_kl: string | null; status_kl: string | null }>(
        bo,
        'select status, endret_kl, status_kl from public.ideer where id = $1',
        [ide],
      ))[0]!
    expect(await feilFra(() => sql(ada, `select public.sett_idestatus($1, 'planlagt')`, [ide]))).toMatchObject({ code: '42501' })
    expect(await feilFra(() => sql(ada, `update public.ideer set status = 'planlagt' where id = $1`, [ide]))).toMatchObject({ code: '42501' })

    await sql(admin, `select public.sett_idestatus($1, 'under_arbeid')`, [ide])
    expect(await status()).toMatchObject({ status: 'under_arbeid', endret_kl: null, status_kl: expect.anything() })
    expect((await traad(bo, ide))!.status).toBe('under_arbeid')

    await sql(admin, 'select public.sett_idestatus($1, null)', [ide])
    expect((await status()).status).toBeNull()
  })

  it('teller kommentarer fra andre som nye til idéen er åpnet', async () => {
    const ide = await nyIde(ada, 'Nytt')
    const nye = async (bruker: string) =>
      ((await sql<{ ideoversikt: { id: string; nye_kommentarer: number }[] }>(bruker, 'select public.ideoversikt()'))[0]!
        .ideoversikt.find((i) => i.id === ide)!).nye_kommentarer
    const medNytt = async (bruker: string) =>
      (await sql<{ ideer_med_nytt: number }>(bruker, 'select public.ideer_med_nytt()'))[0]!.ideer_med_nytt

    await nyKommentar(ada, ide, null, 'Egen')
    expect(await nye(ada)).toBe(0)
    const fra = await medNytt(ada)

    const bos = await nyKommentar(bo, ide, null, 'Fra Bo')
    expect(await nye(ada)).toBe(1)
    expect(await medNytt(ada)).toBe(fra + 1)
    // Svar i tråden teller også.
    await nyKommentar(bo, ide, bos, 'Svar')
    expect(await nye(ada)).toBe(2)

    const lest = (await traad(ada, ide))!
    expect(lest.sist_sett).toBeNull()
    // En kommentar som kommer etter at tråden ble lest, er fortsatt ny når den merkes som sett.
    await nyKommentar(bo, ide, null, 'Imellom')
    await sql(ada, 'select public.merk_ide_sett($1, $2)', [ide, lest.lest_kl])
    expect(await nye(ada)).toBe(1)
    expect(await medNytt(ada)).toBe(fra + 1)

    const igjen = (await traad(ada, ide))!
    expect(igjen.sist_sett).toEqual(expect.any(String))
    await sql(ada, 'select public.merk_ide_sett($1, $2)', [ide, igjen.lest_kl])
    expect(await nye(ada)).toBe(0)
    expect(await medNytt(ada)).toBe(fra)
    // Et gammelt tidspunkt flytter ikke «sett» bakover, og et i framtiden gjelder ikke.
    await sql(ada, 'select public.merk_ide_sett($1, $2)', [ide, lest.lest_kl])
    await sql(ada, `select public.merk_ide_sett($1, now() + interval '1 day')`, [ide])
    expect(await nye(ada)).toBe(0)
    const [{ sett_kl }] = (await sql<{ sett_kl: string }>(ada, 'select sett_kl::text from public.idebesok where ide_id = $1', [ide])) as [{ sett_kl: string }]
    expect(Date.parse(sett_kl)).toBeLessThanOrEqual(Date.now() + 1000)

    // Besøkene er private, og settes bare gjennom funksjonen.
    expect(await sql(bo, 'select * from public.idebesok where bruker_id = $1', [ada])).toEqual([])
    expect(
      await feilFra(() => sql(bo, 'insert into public.idebesok (bruker_id, ide_id) values ($1, $2)', [bo, ide])),
    ).toMatchObject({ code: '42501' })
  })

  it('lagrer brukerinnstillinger for brukeren selv, og bare der', async () => {
    const lagre = (bruker: string, verdi: unknown) =>
      sql(
        bruker,
        `insert into public.brukerinnstillinger (nokkel, verdi) values ('ideer.sortering', $1)
         on conflict (bruker_id, nokkel) do update set nokkel = excluded.nokkel, verdi = excluded.verdi`,
        [JSON.stringify(verdi)],
      )
    await lagre(ada, { forst: 'bruker', deretter: 'kategori' })
    await lagre(ada, { forst: 'kategori', deretter: 'bruker' })
    await lagre(bo, { forst: 'kategori', deretter: 'tid' })
    const les = (bruker: string) => sql<{ bruker_id: string; verdi: unknown }>(bruker, 'select bruker_id, verdi from public.brukerinnstillinger')
    expect(await les(ada)).toEqual([{ bruker_id: ada, verdi: { forst: 'kategori', deretter: 'bruker' } }])
    expect(await les(bo)).toEqual([{ bruker_id: bo, verdi: { forst: 'kategori', deretter: 'tid' } }])
    expect(
      await feilFra(() => sql(bo, `insert into public.brukerinnstillinger (bruker_id, nokkel, verdi) values ($1, 'x', '1')`, [ada])),
    ).toMatchObject({ code: '42501' })
  })
})
