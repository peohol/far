/**
 * Diskusjonene i databasen: kategoriene og trådene på hver side, rekkefølgen,
 * å løse opp en kategori, arkivet som fryser en tråd, kommentarene med
 * sletting og skjuling, det som er nytt, varslene og at trådene følger en
 * fagside som får ny nøkkel — mot en ekte database bygd av migrasjonene.
 */
import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { faginnholdskall, feilFra, nyDatabase, opprettBruker, som } from './hjelp/testdatabase'

const DOK = (tekst: string) => JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: tekst }] }] })

interface Oversikt {
  kategorier: { id: string; navn: string; emoji: string; posisjon: number }[]
  diskusjoner: {
    id: string
    kategori_id: string | null
    tittel: string
    posisjon: number
    arkivert_kl: string | null
    kommentarer: number
    nye_kommentarer: number
    usett: boolean
    hjerter: number
  }[]
}

interface Traad {
  id: string
  tittel: string
  tekst: unknown
  skjult: boolean
  endret_kl: string | null
  lest_kl: string
  sist_sett: string | null
  kommentarer: { id: string; forfatter_id: string | null; tekst: unknown; slettet: boolean; skjult: boolean }[]
}

interface Varsel {
  kategori: string
  diskusjon: { id: string; tittel: string; side: string; forfatter_id: string } | null
  hendelser: { av: string; innlegg?: string; svar_til?: string | null }[]
  lest_kl: string | null
}

describe('diskusjonene i databasen', () => {
  let db: PGlite
  let admin: string
  let ada: string
  let bo: string
  let cy: string
  let sideteller = 0

  const sql = <T = Record<string, unknown>>(bruker: string | null, tekst: string, parametre: unknown[] = []) =>
    som(db, bruker, async (tx) => (await tx.query<T>(tekst, parametre)).rows)
  const en = async <T>(bruker: string | null, tekst: string, parametre: unknown[] = []) =>
    Object.values((await sql<Record<string, T>>(bruker, tekst, parametre))[0]!)[0] as T

  /** En side ingen annen test bruker. */
  const nySide = () => `stoff:testside-${++sideteller}`
  const nyKategori = (bruker: string, side: string, navn: string, emoji: string) =>
    en<string>(bruker, 'select public.opprett_diskusjonskategori($1, $2, $3)', [side, navn, emoji])
  const nyTraad = (bruker: string, side: string, kategori: string, tittel = 'En tråd', tekst: string | null = DOK('Første innlegg')) =>
    en<string>(bruker, 'select public.opprett_diskusjon($1, $2, $3, $4)', [side, kategori, tittel, tekst])
  const nyKommentar = (bruker: string, traad: string, forelder: string | null = null, tekst = 'Svar') =>
    en<string>(bruker, 'insert into public.diskusjonskommentarer (diskusjon_id, forelder_id, tekst) values ($1, $2, $3) returning id', [
      traad,
      forelder,
      DOK(tekst),
    ])
  const oversikt = (bruker: string, side: string) => en<Oversikt>(bruker, 'select public.diskusjonsoversikt($1)', [side])
  const traad = (bruker: string, id: string) => en<Traad | null>(bruker, 'select public.diskusjonstraad($1)', [id])
  const flytt = (bruker: string, id: string, kategori: string | null, indeks: number) =>
    sql(bruker, 'select public.flytt_diskusjon($1, $2, $3)', [id, kategori, indeks])
  const arkiver = (bruker: string, id: string, arkivert = true) => sql(bruker, 'select public.arkiver_diskusjon($1, $2)', [id, arkivert])
  const rekkefolge = async (bruker: string, side: string, kategori: string | null) =>
    (await oversikt(bruker, side)).diskusjoner.filter((d) => d.kategori_id === kategori && !d.arkivert_kl).map((d) => d.tittel)
  const varsler = async (bruker: string) => (await en<{ varsler: Varsel[] }>(bruker, 'select public.mine_varsler()')).varsler
  const omTraad = async (bruker: string, id: string) => (await varsler(bruker)).filter((v) => v.diskusjon?.id === id)

  beforeAll(async () => {
    db = await nyDatabase()
    admin = await opprettBruker(db, { brukernavn: 'admin', fornavn: 'Ada', etternavn: 'Admin', rolle: 'admin' })
    ada = await opprettBruker(db, { brukernavn: 'ada.l', fornavn: 'Ada', etternavn: 'Lovelace', rolle: 'user' })
    bo = await opprettBruker(db, { brukernavn: 'bob', fornavn: 'Bo', etternavn: 'Bruker', rolle: 'user' })
    cy = await opprettBruker(db, { brukernavn: 'cyrus', fornavn: 'Cy', etternavn: 'Brukersen', rolle: 'user' })
  }, 60_000)

  it('lar innloggede lage kategorier og tråder, men ikke anonyme', async () => {
    const side = nySide()
    const kategori = await nyKategori(ada, side, 'Dosering', '💊')
    const id = await nyTraad(bo, side, kategori, 'Maksdose ved nyresvikt')
    const liste = await oversikt(cy, side)
    expect(liste.kategorier).toMatchObject([{ id: kategori, navn: 'Dosering', emoji: '💊', posisjon: 0 }])
    expect(liste.diskusjoner).toMatchObject([{ id, kategori_id: kategori, tittel: 'Maksdose ved nyresvikt', posisjon: 0 }])

    expect(await feilFra(() => nyKategori(null as unknown as string, side, 'Anonym', '🙈'))).toMatchObject({ code: '42501' })
    expect(await feilFra(() => sql(null, 'select * from public.diskusjoner'))).toMatchObject({ code: '42501' })
    // Trådene skrives bare gjennom funksjonene.
    expect(
      await feilFra(() => sql(ada, `insert into public.diskusjoner (side, kategori_id, tittel) values ($1, $2, 'Juks')`, [side, kategori])),
    ).toMatchObject({ code: '42501' })
    expect(await feilFra(() => sql(ada, `update public.diskusjoner set tittel = 'Juks' where id = $1`, [id]))).toMatchObject({ code: '42501' })
    expect(await feilFra(() => sql(ada, 'delete from public.diskusjoner where id = $1', [id]))).toMatchObject({ code: '42501' })
  })

  it('krever navn og emoji som er ledige på siden, men ikke på tvers av sider', async () => {
    const side = nySide()
    await nyKategori(ada, side, 'Bivirkninger', '⚠️')
    expect(await feilFra(() => nyKategori(bo, side, 'bivirkninger', '🩺'))).toMatchObject({ code: '23505' })
    expect(await feilFra(() => nyKategori(bo, side, 'Annet', '⚠️'))).toMatchObject({ code: '23505' })
    await expect(nyKategori(bo, nySide(), 'Bivirkninger', '⚠️')).resolves.toBeTruthy()

    // Navnet og emojien til «Ukategoriserte» er reservert, og emojien må være en emoji.
    expect(await feilFra(() => nyKategori(bo, side, 'Ukategoriserte', '📦'))).toMatchObject({ code: '23514' })
    expect(await feilFra(() => nyKategori(bo, side, 'Bobler', '🫧'))).toMatchObject({ code: '23514' })
    expect(await feilFra(() => nyKategori(bo, side, 'Uten emoji', 'A'))).toMatchObject({ code: '23514' })
    expect(await feilFra(() => nyKategori(bo, side, '', '📦'))).toMatchObject({ code: '23514' })
    // En side som ikke er en side, avvises.
    expect(await feilFra(() => nyKategori(bo, 'side:tull', 'Tull', '📦'))).toMatchObject({ code: '23514' })
  })

  it('lar alle gi kategorien nytt navn og ny emoji', async () => {
    const side = nySide()
    const kategori = await nyKategori(ada, side, 'Gammel', '📁')
    await nyKategori(ada, side, 'Opptatt', '📌')
    await sql(bo, 'select public.endre_diskusjonskategori($1, $2, $3)', [kategori, 'Ny', '🆕'])
    expect((await oversikt(bo, side)).kategorier[0]).toMatchObject({ navn: 'Ny', emoji: '🆕' })
    expect(
      await feilFra(() => sql(bo, 'select public.endre_diskusjonskategori($1, $2, $3)', [kategori, 'Opptatt', '🆕'])),
    ).toMatchObject({ code: '23505' })
  })

  it('lager tråden sammen med en ny kategori, men aldri uten kategori', async () => {
    const side = nySide()
    const id = await en<string>(ada, 'select public.opprett_diskusjon($1, null, $2, null, $3, $4)', [side, 'Ny tråd', 'Interaksjoner', '🔀'])
    const liste = await oversikt(ada, side)
    expect(liste.kategorier).toMatchObject([{ navn: 'Interaksjoner', emoji: '🔀' }])
    expect(liste.diskusjoner).toMatchObject([{ id, kategori_id: liste.kategorier[0]!.id }])

    expect(await feilFra(() => sql(ada, 'select public.opprett_diskusjon($1, null, $2, null)', [side, 'Uten kategori']))).toMatchObject({
      code: '23503',
    })
    // En kategori på en annen side er ingen kategori her.
    const annen = await nyKategori(ada, nySide(), 'Annen side', '🧭')
    expect(await feilFra(() => nyTraad(ada, side, annen))).toMatchObject({ code: '23503' })
  })

  it('flytter tråder innen og mellom kategorier, og kategoriene innbyrdes', async () => {
    const side = nySide()
    const a = await nyKategori(ada, side, 'A', '🅰️')
    const b = await nyKategori(ada, side, 'B', '🅱️')
    const t1 = await nyTraad(ada, side, a, 'En')
    const t2 = await nyTraad(ada, side, a, 'To')
    const t3 = await nyTraad(ada, side, a, 'Tre')
    expect(await rekkefolge(ada, side, a)).toEqual(['En', 'To', 'Tre'])

    await flytt(bo, t3, a, 0)
    expect(await rekkefolge(ada, side, a)).toEqual(['Tre', 'En', 'To'])
    await flytt(bo, t3, a, 9)
    expect(await rekkefolge(ada, side, a)).toEqual(['En', 'To', 'Tre'])

    await flytt(bo, t1, b, 0)
    await flytt(bo, t2, b, 0)
    expect(await rekkefolge(ada, side, a)).toEqual(['Tre'])
    expect(await rekkefolge(ada, side, b)).toEqual(['To', 'En'])
    expect((await oversikt(ada, side)).diskusjoner.map((d) => d.posisjon).sort()).toEqual([0, 0, 1])

    await sql(cy, 'select public.flytt_diskusjonskategori($1, 0)', [b])
    expect((await oversikt(ada, side)).kategorier.map((k) => k.navn)).toEqual(['B', 'A'])

    // En kategori på en annen side tar ikke imot tråden.
    const annen = await nyKategori(ada, nySide(), 'Annen', '🧭')
    expect(await feilFra(() => flytt(bo, t1, annen, 0))).toMatchObject({ code: '23503' })
  })

  it('løser opp en kategori: trådene står sist under «Ukategoriserte», og kan flyttes ut, men ikke inn', async () => {
    const side = nySide()
    const a = await nyKategori(ada, side, 'A', '🍎')
    const b = await nyKategori(ada, side, 'B', '🍐')
    const c = await nyKategori(ada, side, 'C', '🍋')
    await nyTraad(ada, side, a, 'A1')
    await nyTraad(ada, side, a, 'A2')
    const b1 = await nyTraad(ada, side, b, 'B1')

    await sql(bo, 'select public.los_opp_diskusjonskategori($1)', [a])
    await sql(bo, 'select public.los_opp_diskusjonskategori($1)', [b])
    const liste = await oversikt(ada, side)
    expect(liste.kategorier).toMatchObject([{ id: c, posisjon: 0 }])
    expect(await rekkefolge(ada, side, null)).toEqual(['A1', 'A2', 'B1'])

    await flytt(cy, b1, c, 0)
    expect(await rekkefolge(ada, side, null)).toEqual(['A1', 'A2'])
    expect(await rekkefolge(ada, side, c)).toEqual(['B1'])
    expect(await feilFra(() => flytt(cy, b1, null, 0))).toMatchObject({ code: '23503' })
  })

  it('lar alle endre overskriften, men bare forfatteren det første innlegget', async () => {
    const side = nySide()
    const id = await nyTraad(ada, side, await nyKategori(ada, side, 'K', '🔑'), 'Før')
    await sql(bo, 'select public.sett_diskusjonstittel($1, $2)', [id, 'Etter'])
    expect(await traad(ada, id)).toMatchObject({ tittel: 'Etter', endret_kl: null })

    expect(await feilFra(() => sql(bo, 'select public.sett_diskusjonstekst($1, $2)', [id, DOK('Kapret')]))).toMatchObject({ code: '42501' })
    expect(await feilFra(() => sql(admin, 'select public.sett_diskusjonstekst($1, $2)', [id, DOK('Kapret')]))).toMatchObject({ code: '42501' })
    await sql(ada, 'select public.sett_diskusjonstekst($1, $2)', [id, DOK('Rettet')])
    const etter = await traad(bo, id)
    expect(JSON.stringify(etter!.tekst)).toContain('Rettet')
    expect(etter!.endret_kl).not.toBeNull()
  })

  it('fryser en arkivert tråd til den er gjenopprettet sist i kategorien', async () => {
    const side = nySide()
    const kategori = await nyKategori(ada, side, 'K', '🧊')
    const id = await nyTraad(ada, side, kategori, 'Arkiveres')
    await nyTraad(ada, side, kategori, 'Blir')
    const kommentar = await nyKommentar(bo, id)

    await arkiver(cy, id)
    expect((await oversikt(ada, side)).diskusjoner.find((d) => d.id === id)!.arkivert_kl).not.toBeNull()
    expect(await rekkefolge(ada, side, kategori)).toEqual(['Blir'])

    expect(await feilFra(() => nyKommentar(bo, id))).toMatchObject({ code: '42501' })
    expect(await sql(bo, 'update public.diskusjonskommentarer set tekst = $2 where id = $1 returning id', [kommentar, DOK('Endret')])).toEqual([])
    expect(await sql(bo, 'delete from public.diskusjonskommentarer where id = $1 returning id', [kommentar])).toEqual([])
    expect(await feilFra(() => sql(bo, 'insert into public.diskusjonshjerter (diskusjon_id) values ($1)', [id]))).toMatchObject({ code: '42501' })
    expect(await feilFra(() => sql(bo, 'select public.sett_diskusjonstittel($1, $2)', [id, 'Nei']))).toMatchObject({ code: '42501' })
    expect(await feilFra(() => flytt(bo, id, kategori, 0))).toMatchObject({ code: '42501' })

    await arkiver(bo, id, false)
    expect(await rekkefolge(ada, side, kategori)).toEqual(['Blir', 'Arkiveres'])
    await expect(nyKommentar(bo, id)).resolves.toBeTruthy()
  })

  it('lar bare forfatteren slette sin kommentar, og står igjen som «Slettet» med svar', async () => {
    const side = nySide()
    const id = await nyTraad(ada, side, await nyKategori(ada, side, 'K', '🗑️'))
    const forelder = await nyKommentar(bo, id)
    const svar = await nyKommentar(cy, id, forelder)

    // Ingen andre, heller ikke en administrator.
    expect(await sql(admin, 'delete from public.diskusjonskommentarer where id = $1 returning id', [forelder])).toEqual([])
    expect(await sql(ada, 'delete from public.diskusjonskommentarer where id = $1 returning id', [forelder])).toEqual([])
    expect(await sql(ada, 'update public.diskusjonskommentarer set tekst = $2 where id = $1 returning id', [forelder, DOK('Kapret')])).toEqual([])

    await sql(bo, 'delete from public.diskusjonskommentarer where id = $1', [forelder])
    let kommentarer = (await traad(ada, id))!.kommentarer
    expect(kommentarer.find((k) => k.id === forelder)).toMatchObject({ slettet: true, forfatter_id: null, tekst: null })

    await sql(cy, 'delete from public.diskusjonskommentarer where id = $1', [svar])
    kommentarer = (await traad(ada, id))!.kommentarer
    expect(kommentarer).toEqual([])
  })

  it('lar bare en administrator skjule innholdet, og da er teksten borte', async () => {
    const side = nySide()
    const id = await nyTraad(ada, side, await nyKategori(ada, side, 'K', '🙈'), 'Tråd', DOK('Noe som ikke skulle stått her'))
    const kommentar = await nyKommentar(bo, id, null, 'Heller ikke dette')

    expect(await feilFra(() => sql(ada, 'select public.skjul_i_diskusjon($1, null)', [id]))).toMatchObject({ code: '42501' })
    await sql(admin, 'select public.skjul_i_diskusjon($1, null)', [id])
    await sql(admin, 'select public.skjul_i_diskusjon($1, $2)', [id, kommentar])

    const etter = await traad(cy, id)
    expect(etter).toMatchObject({ tekst: null, skjult: true })
    expect(etter!.kommentarer).toMatchObject([{ id: kommentar, skjult: true, tekst: null, forfatter_id: bo }])
    const [rad] = await sql<{ tekst: unknown }>(admin, 'select tekst from public.diskusjonskommentarer where id = $1', [kommentar])
    expect(rad!.tekst).toBeNull()

    // En skjult kommentar kan ikke skrives inn igjen av forfatteren.
    expect(await sql(bo, 'update public.diskusjonskommentarer set tekst = $2 where id = $1 returning id', [kommentar, DOK('Tilbake')])).toEqual([])
    // Forfatteren kan skrive det første innlegget på nytt.
    await sql(ada, 'select public.sett_diskusjonstekst($1, $2)', [id, DOK('Ny tekst')])
    expect(await traad(cy, id)).toMatchObject({ skjult: false })
  })

  it('lar den som startet tråden slette den før andre har skrevet i den, og en administrator alltid', async () => {
    const side = nySide()
    const kategori = await nyKategori(ada, side, 'K', '🧹')
    const slett = (bruker: string, id: string) => sql(bruker, 'select public.slett_diskusjon($1)', [id])
    const forste = await nyTraad(ada, side, kategori, 'Første')
    const egen = await nyTraad(ada, side, kategori, 'Egen')
    const tredje = await nyTraad(ada, side, kategori, 'Tredje')

    // Egne kommentarer hindrer ikke, og andre kan ikke slette den.
    await nyKommentar(ada, egen)
    expect(await feilFra(() => slett(bo, egen))).toMatchObject({ code: '42501' })
    await slett(ada, egen)
    expect(await traad(bo, egen)).toBeNull()
    expect(await rekkefolge(ada, side, kategori)).toEqual(['Første', 'Tredje'])
    expect((await oversikt(ada, side)).diskusjoner.map((d) => d.posisjon)).toEqual([0, 1])

    // Når noen andre har skrevet, er det for sent, til de har slettet det selv.
    const bos = await nyKommentar(bo, forste)
    expect(await feilFra(() => slett(ada, forste))).toMatchObject({ code: '42501' })
    await sql(bo, 'delete from public.diskusjonskommentarer where id = $1', [bos])
    // Et svar fra andre under en egen kommentar teller også; «Slettet» teller ikke.
    const adas = await nyKommentar(ada, forste)
    const cys = await nyKommentar(cy, forste, adas)
    await sql(ada, 'delete from public.diskusjonskommentarer where id = $1', [adas])
    expect(await feilFra(() => slett(ada, forste))).toMatchObject({ code: '42501' })
    await sql(cy, 'delete from public.diskusjonskommentarer where id = $1', [cys])
    await slett(ada, forste)

    // En arkivert tråd sletter bare en administrator, også med andres innlegg.
    await nyKommentar(bo, tredje)
    await arkiver(ada, tredje)
    const nyEgen = await nyTraad(ada, side, kategori, 'Arkivert')
    await arkiver(ada, nyEgen)
    expect(await feilFra(() => slett(ada, nyEgen))).toMatchObject({ code: '42501' })
    await slett(admin, tredje)
    await slett(admin, nyEgen)
    expect((await oversikt(ada, side)).diskusjoner).toEqual([])
    expect(await sql(admin, 'select 1 from public.diskusjonskommentarer k where k.diskusjon_id = any($1)', [[tredje, nyEgen]])).toEqual([])

    expect(await feilFra(() => slett(admin, tredje))).toMatchObject({ code: 'P0002' })
    expect(await feilFra(() => sql(null, 'select public.slett_diskusjon($1)', [forste]))).toMatchObject({ code: '42501' })
  })

  it('flytter tråden sist i en kategori på en annen side, med kommentarene', async () => {
    const fra = nySide()
    const til = nySide()
    const kategori = await nyKategori(ada, fra, 'Feil stoff', '🧭')
    const id = await nyTraad(ada, fra, kategori, 'Flyttes')
    await nyTraad(ada, fra, kategori, 'Blir')
    const der = await nyKategori(bo, til, 'Der', '🛬')
    await nyTraad(bo, til, der, 'Var der')
    const kommentar = await nyKommentar(cy, id)
    const flyttTil = (bruker: string, side: string, kategori: string | null, ny: [string, string] | null = null) =>
      sql(bruker, 'select public.flytt_diskusjon_til_side($1, $2, $3, $4, $5)', [id, side, kategori, ny?.[0] ?? null, ny?.[1] ?? null])

    // Kategorien må være på siden tråden flyttes til, og siden må være en annen.
    expect(await feilFra(() => flyttTil(bo, til, kategori))).toMatchObject({ code: '23503' })
    expect(await feilFra(() => flyttTil(bo, til, null))).toMatchObject({ code: '23503' })
    expect(await feilFra(() => flyttTil(bo, fra, kategori))).toMatchObject({ code: '22023' })
    expect(await feilFra(() => sql(null, 'select public.flytt_diskusjon_til_side($1, $2, $3)', [id, til, der]))).toMatchObject({ code: '42501' })

    await flyttTil(bo, til, der)
    expect(await rekkefolge(ada, fra, kategori)).toEqual(['Blir'])
    expect((await oversikt(ada, fra)).diskusjoner[0]).toMatchObject({ posisjon: 0 })
    expect(await rekkefolge(ada, til, der)).toEqual(['Var der', 'Flyttes'])
    expect((await traad(ada, id))!.kommentarer.map((k) => k.id)).toEqual([kommentar])

    // Tilbake, i en ny kategori der.
    await flyttTil(ada, fra, null, ['Riktig stoff', '🎯'])
    const liste = await oversikt(ada, fra)
    const ny = liste.kategorier.find((k) => k.navn === 'Riktig stoff')!
    expect(ny).toMatchObject({ emoji: '🎯', posisjon: 1 })
    expect(await rekkefolge(ada, fra, ny.id)).toEqual(['Flyttes'])
    expect(await rekkefolge(ada, til, der)).toEqual(['Var der'])
    // Navnet må fortsatt være ledig der.
    expect(await feilFra(() => flyttTil(ada, til, null, ['der', '🆕']))).toMatchObject({ code: '23505' })

    // En arkivert tråd flyttes ikke.
    await arkiver(ada, id)
    expect(await feilFra(() => flyttTil(ada, til, der))).toMatchObject({ code: '42501' })
  })

  it('viser hva som er nytt til tråden er åpnet', async () => {
    const side = nySide()
    const kategori = await nyKategori(ada, side, 'K', '🆕')
    const id = await nyTraad(ada, side, kategori)
    expect((await oversikt(bo, side)).diskusjoner[0]).toMatchObject({ usett: true, nye_kommentarer: 0 })
    expect((await oversikt(ada, side)).diskusjoner[0]).toMatchObject({ usett: false })

    const lest = await traad(bo, id)
    await sql(bo, 'select public.merk_diskusjon_sett($1, $2)', [id, lest!.lest_kl])
    expect((await oversikt(bo, side)).diskusjoner[0]).toMatchObject({ usett: false })

    await nyKommentar(cy, id)
    await nyKommentar(bo, id)
    expect((await oversikt(bo, side)).diskusjoner[0]).toMatchObject({ usett: true, nye_kommentarer: 1, kommentarer: 2 })
  })

  it('varsler forfatteren, den som får svar, de aktive og dem som har siden som favoritt', async () => {
    await sql(cy, `select public.sett_stoffavoritt('varselstoff', true)`)
    await sql(ada, `select public.sett_stoffavoritt('varselstoff', true)`)
    const side = 'stoff:varselstoff'
    const id = await nyTraad(ada, side, await nyKategori(ada, side, 'K', '🔔'), 'Varsler')

    // Ny tråd på en favorittside: alle som har den som favoritt, unntatt forfatteren.
    expect(await omTraad(cy, id)).toMatchObject([{ kategori: 'favorittdiskusjoner', diskusjon: { id, tittel: 'Varsler', side } }])
    expect(await omTraad(ada, id)).toEqual([])

    const bosKommentar = await nyKommentar(bo, id)
    expect((await omTraad(ada, id)).map((v) => v.kategori)).toEqual(['mine_diskusjoner'])

    await nyKommentar(admin, id, bosKommentar)
    expect((await omTraad(bo, id)).map((v) => v.kategori)).toEqual(['mine_diskusjoner'])

    await nyKommentar(ada, id)
    expect((await omTraad(bo, id)).map((v) => v.kategori).sort()).toEqual(['aktive_diskusjoner', 'mine_diskusjoner'])

    // Å åpne tråden merker varslene om den lest.
    const lest = await traad(bo, id)
    await sql(bo, 'select public.merk_diskusjon_sett($1, $2)', [id, lest!.lest_kl])
    expect((await omTraad(bo, id)).every((v) => v.lest_kl !== null)).toBe(true)
  })

  it('lar tråder og kategorier følge fagsiden når den får ny nøkkel', async () => {
    const kall = faginnholdskall(db, admin)
    const side = (await kall.opprett('infoside', { navn: 'Flyttestoff' })).id as string
    await kall.publiser(side, 1)
    const kategori = await nyKategori(ada, 'stoff:flyttestoff', 'Følger med', '🧳')
    const id = await nyTraad(ada, 'stoff:flyttestoff', kategori)
    // Den nye nøkkelen har alt en kategori med samme navn: trådene slås sammen der.
    const der = await nyKategori(ada, 'stoff:nytt-flyttestoff', 'Følger med', '🧭')
    await nyTraad(ada, 'stoff:nytt-flyttestoff', der, 'Var der fra før')

    await kall.lagre(side, 1, { navn: 'Flyttestoff', slug: 'nytt-flyttestoff', panelreferanser: {} })
    await kall.publiser(side, 2)

    expect((await oversikt(ada, 'stoff:flyttestoff')).diskusjoner).toEqual([])
    const liste = await oversikt(ada, 'stoff:nytt-flyttestoff')
    expect(liste.kategorier).toMatchObject([{ id: der, navn: 'Følger med' }])
    expect(await rekkefolge(ada, 'stoff:nytt-flyttestoff', der)).toEqual(['Var der fra før', 'En tråd'])
    expect(liste.diskusjoner.find((d) => d.id === id)).toMatchObject({ kategori_id: der })
  })
})
