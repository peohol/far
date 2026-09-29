/**
 * Varslene i databasen: hvem som får varsel når noen kommenterer en idé eller
 * publiserer noe i fortolkningen, at uleste varsler om det samme slås sammen,
 * at de merkes lest, og at ingen ser andres — mot en ekte database bygd av
 * migrasjonene.
 */
import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { faginnholdskall, feilFra, nyDatabase, opprettBruker, som, type Faginnholdskall } from './hjelp/testdatabase'

const DOK = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hei' }] }] })

interface Hendelse {
  kl: string
  av: string
  kommentar?: string
  svar_til?: string | null
  objekt?: { id: string; type: string; navn: string | null; analyttkode: string | null }
  side?: { id: string; navn: string; stoff: string }
  deler?: string[]
}

interface Varsel {
  id: string
  kategori: string
  ide: { id: string; tittel: string; forfatter_id: string } | null
  hendelser: Hendelse[]
  lest_kl: string | null
}

describe('varslene', () => {
  let db: PGlite
  let admin: string
  let ada: string
  let bo: string
  let cy: string
  let kall: Faginnholdskall

  const sql = <T = Record<string, unknown>>(bruker: string | null, tekst: string, parametre: unknown[] = []) =>
    som(db, bruker, async (tx) => (await tx.query<T>(tekst, parametre)).rows)
  const en = async <T>(bruker: string | null, tekst: string, parametre: unknown[] = []) =>
    Object.values((await sql<Record<string, T>>(bruker, tekst, parametre))[0]!)[0] as T

  const nyIde = (bruker: string, tittel = 'En idé') =>
    en<string>(bruker, `insert into public.ideer (kategori, tittel) values ('fag', $1) returning id`, [tittel])
  const nyKommentar = (bruker: string, ide: string, forelder: string | null = null) =>
    en<string>(bruker, 'insert into public.idekommentarer (ide_id, forelder_id, tekst) values ($1, $2, $3) returning id', [
      ide,
      forelder,
      DOK,
    ])
  const mine = (bruker: string) => en<{ lest_kl: string; varsler: Varsel[] }>(bruker, 'select public.mine_varsler()')
  const varsler = async (bruker: string) => (await mine(bruker)).varsler
  const uleste = (bruker: string) => en<Record<string, number>>(bruker, 'select public.uleste_varsler()')
  const merkLest = (bruker: string, ider: string[] | null, til: string) =>
    sql(bruker, 'select public.merk_varsler_lest($1, $2)', [ider, til])
  const omIde = async (bruker: string, ide: string) => (await varsler(bruker)).filter((v) => v.ide?.id === ide)

  beforeAll(async () => {
    db = await nyDatabase()
    admin = await opprettBruker(db, { brukernavn: 'admin', fornavn: 'Ada', etternavn: 'Admin', rolle: 'admin' })
    ada = await opprettBruker(db, { brukernavn: 'ada.l', fornavn: 'Ada', etternavn: 'Lovelace', rolle: 'user' })
    bo = await opprettBruker(db, { brukernavn: 'bob', fornavn: 'Bo', etternavn: 'Bruker', rolle: 'user' })
    cy = await opprettBruker(db, { brukernavn: 'cyclark', fornavn: 'Cy', etternavn: 'Clark', rolle: 'user' })
    kall = faginnholdskall(db, admin)
  }, 60_000)

  it('varsler den som skrev idéen, den som fikk svar og de andre i tråden, men ikke den som skrev', async () => {
    const ide = await nyIde(ada, 'Mørk modus')
    const fraBo = await nyKommentar(bo, ide)

    // Ada skrev idéen; Bo skrev selv og får ingenting.
    expect(await omIde(ada, ide)).toMatchObject([
      { kategori: 'mine_ideer', ide: { id: ide, tittel: 'Mørk modus', forfatter_id: ada }, hendelser: [{ av: bo, kommentar: fraBo, svar_til: null }] },
    ])
    expect(await omIde(bo, ide)).toEqual([])

    // Cy svarer Bo: Bo har fått svar, Ada eier idéen. Ingen av dem er bare «aktive».
    const svar = await nyKommentar(cy, ide, fraBo)
    expect(await omIde(bo, ide)).toMatchObject([{ kategori: 'mine_ideer', hendelser: [{ av: cy, kommentar: svar, svar_til: bo }] }])
    expect((await omIde(ada, ide)).map((v) => v.kategori)).toEqual(['mine_ideer'])
    expect((await omIde(ada, ide))[0]!.hendelser).toHaveLength(2)

    // Ada kommenterer sin egen idé: Bo og Cy har kommentert der, uten at det er svar til dem.
    await nyKommentar(ada, ide)
    expect(await omIde(bo, ide)).toMatchObject([
      { kategori: 'aktive_ideer', hendelser: [{ av: ada }] },
      { kategori: 'mine_ideer' },
    ])
    expect(await omIde(cy, ide)).toMatchObject([{ kategori: 'aktive_ideer', hendelser: [{ av: ada }] }])
    expect(await omIde(admin, ide)).toEqual([])
    expect(await uleste(bo)).toMatchObject({ aktive_ideer: 1, mine_ideer: 1 })
  })

  it('slår sammen uleste varsler om samme idé, og begynner på et nytt når det er lest', async () => {
    const ide = await nyIde(ada)
    await nyKommentar(bo, ide)
    await nyKommentar(cy, ide)
    const [forste] = await omIde(ada, ide)
    expect(forste!.hendelser.map((h) => h.av)).toEqual([bo, cy])

    const { lest_kl } = await mine(ada)
    await merkLest(ada, [forste!.id], lest_kl)
    expect((await omIde(ada, ide))[0]!.lest_kl).toEqual(expect.any(String))

    await nyKommentar(bo, ide)
    const etter = await omIde(ada, ide)
    expect(etter.map((v) => [v.lest_kl === null, v.hendelser.length])).toEqual([
      [true, 1],
      [false, 2],
    ])
  })

  it('lar et varsel som har fått noe nytt etter at det ble lest, stå ulest', async () => {
    const ide = await nyIde(ada)
    await nyKommentar(bo, ide)
    const { lest_kl, varsler: lest } = await mine(ada)
    const id = lest.find((v) => v.ide?.id === ide)!.id
    await db.query(`update public.varsler set oppdatert_kl = $2::timestamptz + interval '1 second' where id = $1`, [id, lest_kl])
    await merkLest(ada, null, lest_kl)
    expect((await omIde(ada, ide))[0]!.lest_kl).toBeNull()
  })

  it('merker varslene om en idé lest når idéen åpnes', async () => {
    const ide = await nyIde(ada)
    await nyKommentar(bo, ide)
    const lest = await en<{ lest_kl: string }>(ada, 'select public.idetraad($1)', [ide])
    await sql(ada, 'select public.merk_ide_sett($1, $2)', [ide, lest.lest_kl])
    expect((await omIde(ada, ide))[0]!.lest_kl).toEqual(expect.any(String))
  })

  it('tar bort en kommentar som er slettet, og varselet når ingen er igjen', async () => {
    const ide = await nyIde(ada)
    const k = await nyKommentar(bo, ide)
    expect(await omIde(ada, ide)).toHaveLength(1)
    await sql(bo, 'delete from public.idekommentarer where id = $1', [k])
    expect(await omIde(ada, ide)).toEqual([])
  })

  it('sletter varslene med idéen', async () => {
    const ide = await nyIde(ada)
    await nyKommentar(bo, ide)
    await sql(ada, 'delete from public.ideer where id = $1', [ide])
    expect(await db.query('select id from public.varsler where ide_id = $1', [ide])).toMatchObject({ rows: [] })
  })

  it('varsler alle andre når fortolkningen publiseres, med navnet og koden, én gang per objekt', async () => {
    const tekst = await kall.opprett('kommentar', { navn: 'AMIS – innenfor', tekst: 'Innenfor.', plassholdere: [] })
    await kall.publiser(tekst.id, 1)
    const regler = await kall.opprett('intervallregelsett', {
      analyttkode: 'AMIS',
      enhet: 'nmol/L',
      desimaler: 0,
      skillepunkter: [10],
      intervaller: [
        { niva: 'innenfor', handling: null, kommentar: tekst.id },
        { niva: 'over', handling: null, kommentar: tekst.id },
      ],
      ringegrense: null,
      cutoff: null,
    } as never)
    await kall.publiser(regler.id, 1)
    const endret = await kall.lagre(tekst.id, 1, { navn: 'AMIS – innenfor', tekst: 'Innenfor, endret.', plassholdere: [] } as never)
    await kall.publiser(tekst.id, endret.revisjon!)

    const fortolkning = (bruker: string) => varsler(bruker).then((v) => v.filter((x) => x.kategori === 'fortolkning'))
    // Publisereren får ikke varsel.
    expect(await fortolkning(admin)).toEqual([])
    const [varsel] = await fortolkning(bo)
    expect(varsel!.hendelser.map((h) => h.objekt)).toEqual([
      { id: regler.id, type: 'intervallregelsett', navn: 'AMIS', analyttkode: 'AMIS' },
      { id: tekst.id, type: 'kommentar', navn: 'AMIS – innenfor', analyttkode: 'AMIS' },
    ])
    expect(varsel!.hendelser.every((h) => h.av === admin)).toBe(true)
    expect(await uleste(cy)).toMatchObject({ fortolkning: 1 })

    // Noe annet enn fortolkningen varsler ingen.
    const side = await kall.opprett('infoside', { navn: 'Ikke fortolkning' })
    await kall.publiser(side.id, 1)
    expect((await fortolkning(bo))[0]!.hendelser).toHaveLength(2)
  })

  it('varsler dem som har siden som favoritt når den publiseres, med delene som er endret, samlet per side', async () => {
    const favoritt = (bruker: string, stoff: string) =>
      sql(bruker, 'select public.sett_stoffavoritt($1, true)', [stoff])
    const omSide = async (bruker: string, side: string) =>
      (await varsler(bruker)).filter((v) => v.kategori === 'favoritter' && v.hendelser[0]?.side?.id === side)
    const element = (side: string, panel: string, ekstra: Record<string, unknown> = {}) =>
      ({ infoside: side, panel, posisjon: 0, elementtype: 'tekst', data: {}, ...ekstra }) as never

    await favoritt(ada, 'favorittstoff')
    await favoritt(admin, 'favorittstoff')
    const side = await kall.opprett('infoside', { navn: 'Favorittstoff' })
    await kall.publiser(side.id, 1)
    // En ny side uten innhold har ikke endret noe å si fra om ennå.
    expect(await omSide(ada, side.id)).toEqual([])

    const ref = await kall.opprett('referanse', { tittel: 'Kilde', forfattere: 'Nordmann O', aar: '2020', lenke: 'https://example.org' } as never)
    await kall.publiser(ref.id, 1)
    const dosering = await kall.opprett('innholdselement', element(side.id, 'dosering', { referanser: [ref.id] }))
    await kall.publiser(dosering.id, 1)
    const kinetikk = await kall.opprett('innholdselement', element(side.id, 'farmakokinetikk'))
    await kall.publiser(kinetikk.id, 1)

    // Ada har siden som favoritt; admin publiserte selv, og Bo har den ikke.
    const [varsel] = await omSide(ada, side.id)
    expect(varsel!.hendelser.map((h) => [h.av, h.side, h.deler])).toEqual([
      [admin, { id: side.id, navn: 'Favorittstoff', stoff: 'favorittstoff' }, ['dosering']],
      [admin, { id: side.id, navn: 'Favorittstoff', stoff: 'favorittstoff' }, ['farmakokinetikk']],
    ])
    expect(await omSide(admin, side.id)).toEqual([])
    expect(await omSide(bo, side.id)).toEqual([])
    expect(await uleste(ada)).toMatchObject({ favoritter: 1 })

    // Et kort som fjernes, er en endring i panelet det sto i; navnet og en
    // referanse som er rettet, er endringer der de står. Alt i det samme uleste varselet.
    await kall.publiser((await kall.lagre(kinetikk.id, 1, element(side.id, 'fjernet'))).id, 2)
    await kall.publiser((await kall.lagre(side.id, 1, { navn: 'Favorittstoffet' } as never)).id, 2)
    await kall.publiser((await kall.lagre(ref.id, 1, { tittel: 'Kilden', forfattere: 'Nordmann O', aar: '2020', lenke: 'https://example.org' } as never)).id, 2)
    const [samlet] = await omSide(ada, side.id)
    expect(samlet!.id).toBe(varsel!.id)
    expect(samlet!.hendelser.slice(2).map((h) => h.deler)).toEqual([['farmakokinetikk'], ['navn'], ['dosering']])
    // Nøkkelen står når navnet endres, så favoritten følger siden.
    expect(samlet!.hendelser.at(-1)!.side).toEqual({ id: side.id, navn: 'Favorittstoffet', stoff: 'favorittstoff' })

    // Når varselet er lest, begynner neste endring på et nytt.
    const { lest_kl } = await mine(ada)
    await merkLest(ada, [varsel!.id], lest_kl)
    await kall.publiser((await kall.lagre(dosering.id, 1, element(side.id, 'dosering', { posisjon: 1, referanser: [ref.id] }))).id, 2)
    expect((await omSide(ada, side.id)).map((v) => [v.lest_kl === null, v.hendelser.length])).toEqual([
      [true, 1],
      [false, 5],
    ])
  })

  it('viser bare den innloggedes egne varsler, og bare gjennom funksjonene', async () => {
    const ide = await nyIde(ada)
    await nyKommentar(bo, ide)
    expect((await sql<{ mottaker_id: string }>(bo, 'select mottaker_id from public.varsler')).every((r) => r.mottaker_id === bo)).toBe(
      true,
    )
    expect(await feilFra(() => sql(bo, `update public.varsler set lest_kl = now()`))).toMatchObject({ code: '42501' })
    expect(await feilFra(() => sql(bo, `insert into public.varsler (mottaker_id, kategori, gruppe, hendelser) values ($1, 'fortolkning', 'x', '[{}]')`, [bo]))).toMatchObject({ code: '42501' })
    expect(await feilFra(() => sql(null, 'select public.mine_varsler()'))).toMatchObject({ code: '42501' })
    expect(await feilFra(() => sql(null, 'select public.merk_varsler_lest(null, now())'))).toMatchObject({ code: '42501' })

    // Å merke alle sine egne lest rører ikke andres.
    const { lest_kl } = await mine(bo)
    await merkLest(bo, null, lest_kl)
    expect(await uleste(bo)).toEqual({})
    expect((await omIde(ada, ide))[0]!.lest_kl).toBeNull()
  })

  it('varsler begge sidene når et kort flyttes fra én side til en annen', async () => {
    const element = (side: string, panel: string) =>
      ({ infoside: side, panel, posisjon: 0, elementtype: 'tekst', data: {} }) as never
    const nySide = async (navn: string) => {
      const side = await kall.opprett('infoside', { navn })
      await kall.publiser(side.id, 1)
      return side.id
    }
    const fra = await nySide('Flyttefra')
    const til = await nySide('Flyttetil')
    await sql(ada, 'select public.sett_stoffavoritt($1, true)', ['flyttefra'])
    await sql(bo, 'select public.sett_stoffavoritt($1, true)', ['flyttetil'])
    const kort = await kall.opprett('innholdselement', element(fra, 'dosering'))
    await kall.publiser(kort.id, 1)
    await kall.publiser((await kall.lagre(kort.id, 1, element(til, 'farmakokinetikk'))).id, 2)

    const deler = async (bruker: string, side: string) =>
      (await varsler(bruker))
        .filter((v) => v.kategori === 'favoritter' && v.hendelser[0]?.side?.id === side)
        .flatMap((v) => v.hendelser.map((h) => h.deler))
    expect(await deler(ada, fra)).toEqual([['dosering'], ['dosering']])
    expect(await deler(bo, til)).toEqual([['farmakokinetikk']])
  })

  it('tar med alle uleste også når det er flere enn 200 leste', async () => {
    const ny = await opprettBruker(db, { brukernavn: 'mange', fornavn: 'Mia', etternavn: 'Mange', rolle: 'user' })
    await db.query(
      `insert into public.varsler (mottaker_id, kategori, gruppe, hendelser, oppdatert_kl, lest_kl)
       select $1, 'fortolkning', 'lest:' || n, '[{"kl": "x", "av": null}]', now() - interval '1 hour' + n * interval '1 second', now()
       from generate_series(1, 210) n`,
      [ny],
    )
    await db.query(
      `insert into public.varsler (mottaker_id, kategori, gruppe, hendelser, oppdatert_kl)
       values ($1, 'fortolkning', 'ulest', '[{"kl": "x", "av": null}]', now() - interval '2 days')`,
      [ny],
    )
    expect(await uleste(ny)).toEqual({ fortolkning: 1 })
    expect((await varsler(ny)).filter((v) => v.lest_kl === null)).toHaveLength(1)
  })

  it('rydder bort leste varsler etter 30 dager', async () => {
    const ide = await nyIde(ada)
    await nyKommentar(bo, ide)
    const { lest_kl } = await mine(ada)
    await merkLest(ada, null, lest_kl)
    await db.query(`update public.varsler set lest_kl = now() - interval '31 days' where ide_id = $1`, [ide])
    expect(await omIde(ada, ide)).toEqual([])
    await merkLest(ada, null, lest_kl)
    expect(await db.query('select id from public.varsler where ide_id = $1', [ide])).toMatchObject({ rows: [] })
  })
})
