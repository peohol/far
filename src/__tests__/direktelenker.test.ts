/**
 * Direktelenkene i databasen: `direktelenke()` slår opp det en lenke peker
 * på — en diskusjon, en idé eller en kommentar i en av dem — og gir null når
 * det ikke finnes; lenkebrikkene blir navnet sitt i prompten til en oppgave.
 * Mot en ekte database bygd av migrasjonene.
 */
import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { feilFra, nyDatabase, opprettBruker, som } from './hjelp/testdatabase'

const DOK = (tekst: string) => JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: tekst }] }] })

interface Maal {
  slag: string
  id: string
  side?: string
  tittel: string
  kategori?: { navn: string; emoji: string } | null
  idekategori?: string
  forfatter: { first_name: string; last_name: string; username: string } | null
  tekst: unknown
  skjult?: boolean
  arkivert_kl: string | null
  overfort?: boolean
  kommentarer: number
  kommentar: { id: string; forfatter: unknown; tekst: unknown; slettet: boolean; skjult: boolean } | null
}

describe('direktelenkene i databasen', () => {
  let db: PGlite
  let admin: string
  let ada: string
  let bo: string

  const sql = <T = Record<string, unknown>>(bruker: string | null, tekst: string, parametre: unknown[] = []) =>
    som(db, bruker, async (tx) => (await tx.query<T>(tekst, parametre)).rows)
  const en = async <T>(bruker: string | null, tekst: string, parametre: unknown[] = []) =>
    Object.values((await sql<Record<string, T>>(bruker, tekst, parametre))[0]!)[0] as T
  const slaOpp = (bruker: string | null, slag: string, id: string, kommentar: string | null = null) =>
    en<Maal | null>(bruker, 'select public.direktelenke($1, $2, $3)', [slag, id, kommentar])

  const nyTraad = async (bruker: string, side: string, tittel: string) => {
    const kategori = await en<string>(bruker, 'select public.opprett_diskusjonskategori($1, $2, $3)', [side, 'Dosering', '💊'])
    return en<string>(bruker, 'select public.opprett_diskusjon($1, $2, $3, $4)', [side, kategori, tittel, DOK('Første innlegg')])
  }
  const nyDiskusjonskommentar = (bruker: string, traad: string, forelder: string | null = null) =>
    en<string>(bruker, 'insert into public.diskusjonskommentarer (diskusjon_id, forelder_id, tekst) values ($1, $2, $3) returning id', [
      traad,
      forelder,
      DOK('En kommentar'),
    ])
  const nyIde = (bruker: string, tittel: string, tekst: string | null = null) =>
    en<string>(bruker, 'insert into public.ideer (kategori, tittel, tekst) values ($1, $2, $3) returning id', ['fag', tittel, tekst])
  const nyIdekommentar = (bruker: string, ide: string, forelder: string | null = null) =>
    en<string>(bruker, 'insert into public.idekommentarer (ide_id, forelder_id, tekst) values ($1, $2, $3) returning id', [
      ide,
      forelder,
      DOK('En kommentar'),
    ])

  beforeAll(async () => {
    db = await nyDatabase()
    admin = await opprettBruker(db, { brukernavn: 'admin', fornavn: 'Ada', etternavn: 'Admin', rolle: 'admin' })
    ada = await opprettBruker(db, { brukernavn: 'ada.l', fornavn: 'Ada', etternavn: 'Lovelace', rolle: 'user' })
    bo = await opprettBruker(db, { brukernavn: 'bob', fornavn: '', etternavn: '', rolle: 'user' })
  }, 60_000)

  it('slår opp en tråd med siden, kategorien, forfatteren og antall kommentarer', async () => {
    const id = await nyTraad(ada, 'stoff:bupropion', 'Maksdose ved nyresvikt')
    await nyDiskusjonskommentar(bo, id)
    expect(await slaOpp(bo, 'diskusjon', id)).toMatchObject({
      slag: 'diskusjon',
      id,
      side: 'stoff:bupropion',
      tittel: 'Maksdose ved nyresvikt',
      kategori: { navn: 'Dosering', emoji: '💊' },
      forfatter: { first_name: 'Ada', last_name: 'Lovelace', username: 'ada.l' },
      tekst: JSON.parse(DOK('Første innlegg')),
      skjult: false,
      arkivert_kl: null,
      kommentarer: 1,
      kommentar: null,
    })
  })

  it('slår opp en kommentar bare i tråden den står i', async () => {
    const id = await nyTraad(ada, 'fortolkning:hbup', 'Tolkning')
    const annen = await nyTraad(ada, 'stoff:kvetiapin', 'En annen')
    const kommentar = await nyDiskusjonskommentar(bo, id)
    expect(await slaOpp(ada, 'diskusjon', id, kommentar)).toMatchObject({
      side: 'fortolkning:hbup',
      kommentar: { id: kommentar, forfatter: { username: 'bob' }, slettet: false, skjult: false },
    })
    expect(await slaOpp(ada, 'diskusjon', annen, kommentar)).toBeNull()
    expect(await slaOpp(ada, 'ide', id)).toBeNull()
  })

  it('viser at en kommentar er slettet eller skjult, uten teksten eller hvem som skrev den', async () => {
    const id = await nyTraad(ada, 'stoff:litium', 'Nivåer')
    const forelder = await nyDiskusjonskommentar(bo, id)
    await nyDiskusjonskommentar(ada, id, forelder)
    await sql(bo, 'delete from public.diskusjonskommentarer where id = $1', [forelder])
    expect((await slaOpp(ada, 'diskusjon', id, forelder))!.kommentar).toMatchObject({ slettet: true, forfatter: null, tekst: null })

    const skjules = await nyDiskusjonskommentar(bo, id)
    await sql(admin, 'select public.skjul_i_diskusjon($1, $2)', [id, skjules])
    expect((await slaOpp(ada, 'diskusjon', id, skjules))!.kommentar).toMatchObject({ skjult: true, tekst: null })
    expect((await slaOpp(ada, 'diskusjon', id))!.kommentarer).toBe(2)
  })

  it('slår opp en idé og en kommentar under den, også når den er overført', async () => {
    const ide = await nyIde(bo, 'Mørk modus', DOK('Om kvelden'))
    const kommentar = await nyIdekommentar(ada, ide)
    expect(await slaOpp(ada, 'ide', ide, kommentar)).toMatchObject({
      slag: 'ide',
      tittel: 'Mørk modus',
      idekategori: 'fag',
      forfatter: { username: 'bob' },
      tekst: JSON.parse(DOK('Om kvelden')),
      overfort: false,
      kommentarer: 1,
      kommentar: { id: kommentar, forfatter: { first_name: 'Ada' }, slettet: false, skjult: false },
    })
    await sql(admin, 'select public.overfor_ide($1)', [ide])
    expect(await slaOpp(ada, 'ide', ide)).toMatchObject({ overfort: true })
  })

  it('gir null for det som ikke finnes, en idé forbi arkivfristen og et ukjent slag', async () => {
    expect(await slaOpp(ada, 'diskusjon', '00000000-0000-4000-8000-000000000000')).toBeNull()
    const ide = await nyIde(bo, 'Gammel idé')
    await sql(admin, 'select public.arkiver_ide($1)', [ide])
    expect(await slaOpp(ada, 'ide', ide)).toMatchObject({ arkivert_kl: expect.any(String) })
    await db.query(`update public.ideer set arkivert_kl = now() - interval '60 days' where id = $1`, [ide])
    expect(await slaOpp(ada, 'ide', ide)).toBeNull()
    expect(await slaOpp(ada, 'noe-annet', ide)).toBeNull()

    const id = await nyTraad(ada, 'stoff:sertralin', 'Slettes')
    await sql(ada, 'select public.slett_diskusjon($1)', [id])
    expect(await slaOpp(ada, 'diskusjon', id)).toBeNull()
  })

  it('er bare for innloggede', async () => {
    const id = await nyTraad(ada, 'stoff:diazepam', 'Hemmelig')
    expect(await feilFra(() => slaOpp(null, 'diskusjon', id))).toMatchObject({ code: '42501' })
  })

  it('gir lenkebrikkene navnet sitt når en idé blir til en oppgave', async () => {
    const tekst = JSON.stringify({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Se ' },
            { type: 'direktelenke', attrs: { slag: 'diskusjon', id: 'x', kommentar: null, etikett: 'Bupropion · 💊 Maksdose' } },
            { type: 'text', text: ' først.' },
          ],
        },
      ],
    })
    const ide = await nyIde(bo, 'Lenker', tekst)
    const oppgave = await en<string>(admin, 'select public.overfor_ide($1)', [ide])
    expect(await en<{ prompt: string }>(admin, 'select public.oppgave($1)', [oppgave])).toMatchObject({
      prompt: 'Se Bupropion · 💊 Maksdose først.',
    })
  })
})
