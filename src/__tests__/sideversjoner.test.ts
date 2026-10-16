/**
 * Sideversjonene (`docs/kurateringsgrener-fremdrift.md`, B1), prøvd mot en
 * ekte database bygd av migrasjonene: at hver publisering som endrer det en
 * fagside viser, gir én ny versjon av hele siden — også når en delt referanse
 * publiseres fra en annen side, et kort flyttes, eller en bivirkningsimport
 * kommer — at en publisering uten endring ikke gir noen, at basisversjonen
 * lages for sidene som fantes, at en eldre versjon kan leses slik den var, og
 * at versjonene ikke kan endres.
 *
 * Innholdet er syntetisk.
 */
import type { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  faginnholdskall,
  feilFra,
  grunnlagsdatabase,
  kjorMigrasjoner,
  migrasjonsfiler,
  opprettBruker,
  type Faginnholdskall,
} from './hjelp/testdatabase'

const MIGRASJON = migrasjonsfiler().find((f) => f.endsWith('_sideversjoner.sql'))!
const DOK = (tekst: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: tekst }] }] })
const MAL = JSON.parse(readFileSync(new URL('../../supabase/maler/bivirkningsimport.json', import.meta.url), 'utf8'))

interface Versjon {
  nr: number
  opphav: string
  fingeravtrykk: string
  endring?: { aktor: string; fornavn?: string }
  antall: { elementer: number; referanser: number; bivirkninger: number }
}

interface Utgave {
  id: string
  revisjon: number
  innhold: Record<string, unknown>
}

interface Lest {
  versjon: { nr: number; opphav: string }
  stoff: { id: string; slug: string; navn: string }
  infoside: Utgave
  elementer: Utgave[]
  referanser: Utgave[]
  bivirkninger: { id: string; nokkel: string }[]
}

let db: PGlite
let admin: string
let leser: string
let kall: Faginnholdskall
let lopenummer = 0

const versjoner = (slug: string, hvem = leser) =>
  kall.rpc<{ les_sideversjoner: Versjon[] }>(hvem, 'les_sideversjoner', { stoff: slug }).then((r) => r.les_sideversjoner)
const versjon = (slug: string, nr: number, hvem = leser) =>
  kall.rpc<{ les_sideversjon: Lest | null }>(hvem, 'les_sideversjon', { stoff: slug, nr }).then((r) => r.les_sideversjon)

const kortinnhold = (side: string, tekst: string, ekstra: Record<string, unknown> = {}) => ({
  infoside: side,
  panel: 'dosering',
  posisjon: 0,
  elementtype: 'riktekst',
  data: { dokument: DOK(tekst) },
  referanser: [] as string[],
  ...ekstra,
})

async function nyFagside(navn = 'Versjonsstoff') {
  lopenummer += 1
  const side = await kall.opprett('infoside', { navn: `${navn} ${lopenummer}` })
  await kall.publiser(side.id, 1)
  const slug = (await kall.fasit<{ slug: string }>('select slug from public.infosider where objekt_id = $1 limit 1', [side.id]))[0]!.slug
  return { side: side.id, slug }
}

async function nyReferanse(tittel: string) {
  lopenummer += 1
  const ref = await kall.opprett('referanse', { tittel, forfattere: 'A', aar: '2026', lenke: `https://example.org/versjon/${lopenummer}` })
  await kall.publiser(ref.id, 1)
  return ref.id
}

beforeAll(async () => {
  db = await grunnlagsdatabase()
  await kjorMigrasjoner(db, { til: MIGRASJON })
  admin = await opprettBruker(db, { brukernavn: 'versjonsadmin', fornavn: 'Vera', etternavn: 'Versjon', rolle: 'admin' })
  leser = await opprettBruker(db, { brukernavn: 'versjonsleser', fornavn: 'Lise', etternavn: 'Leser', rolle: 'user' })
  kall = faginnholdskall(db, admin)
  // En side som er publisert før sideversjonene kom til, og en som ikke er det.
  const gammel = await kall.opprett('infoside', { navn: 'Basisstoff' })
  await kall.publiser(gammel.id, 1)
  await kall.opprett('infoside', { navn: 'Upublisert stoff' })
  await kjorMigrasjoner(db, { fra: MIGRASJON })
}, 120_000)

describe('basisversjonen', () => {
  it('lages for hver publiserte side som fantes, og ikke for de upubliserte', async () => {
    const basis = await versjoner('basisstoff')
    expect(basis).toHaveLength(1)
    expect(basis[0]).toMatchObject({ nr: 1, opphav: 'basis', antall: { elementer: 0, referanser: 0, bivirkninger: 0 } })
    expect(await versjoner('upublisert-stoff')).toEqual([])
  })
})

describe('publiseringene', () => {
  it('gir én versjon per publisering som endrer siden, og ingen når ingenting er endret', async () => {
    const { side, slug } = await nyFagside()
    expect(await versjoner(slug)).toHaveLength(1)

    const kort = await kall.opprett('innholdselement', kortinnhold(side, 'Første tekst'))
    expect(await versjoner(slug)).toHaveLength(1) // utkast teller ikke
    await kall.publiser(kort.id, 1)
    await kall.publiser(kort.id, 1) // samme revisjon på nytt
    const etter = await versjoner(slug)
    expect(etter.map((v) => v.nr)).toEqual([2, 1])
    expect(etter[0]).toMatchObject({ opphav: 'publisering', antall: { elementer: 1 } })
    expect(etter[0]!.endring).toMatchObject({ aktor: 'bruker', fornavn: 'Vera' })

    await kall.lagre(kort.id, 1, kortinnhold(side, 'Andre tekst'))
    await kall.publiser(kort.id, 2)
    expect((await versjoner(slug)).map((v) => v.nr)).toEqual([3, 2, 1])

    // Den eldre versjonen leses slik den var, også av en vanlig bruker.
    const andre = (await versjon(slug, 2))!
    expect(andre.versjon).toMatchObject({ nr: 2, opphav: 'publisering' })
    expect(andre.stoff).toMatchObject({ id: side, slug })
    expect(andre.elementer).toHaveLength(1)
    expect(andre.elementer[0]).toMatchObject({ id: kort.id, revisjon: 1 })
    expect(JSON.stringify(andre.elementer[0]!.innhold)).toContain('Første tekst')
    const tredje = (await versjon(slug, 3))!
    expect(JSON.stringify(tredje.elementer[0]!.innhold)).toContain('Andre tekst')
    expect(await versjon(slug, 9)).toBeNull()
  })

  it('tar ikke med kort som er fjernet', async () => {
    const { side, slug } = await nyFagside()
    const kort = await kall.opprett('innholdselement', kortinnhold(side, 'Skal bort'))
    await kall.publiser(kort.id, 1)
    await kall.lagre(kort.id, 1, kortinnhold(side, 'Skal bort', { panel: 'fjernet' }))
    await kall.publiser(kort.id, 2)
    const [siste, forrige] = await versjoner(slug)
    expect(siste!.antall.elementer).toBe(0)
    expect(forrige!.antall.elementer).toBe(1)
  })

  it('gir en ny versjon på begge sidene når et kort flyttes', async () => {
    const a = await nyFagside('Flyttefra')
    const b = await nyFagside('Flyttetil')
    const kort = await kall.opprett('innholdselement', kortinnhold(a.side, 'Flyttes'))
    await kall.publiser(kort.id, 1)
    await kall.lagre(kort.id, 1, kortinnhold(b.side, 'Flyttes'))
    await kall.publiser(kort.id, 2)
    expect((await versjoner(a.slug))[0]!.antall.elementer).toBe(0)
    expect((await versjoner(b.slug))[0]!.antall.elementer).toBe(1)
  })

  it('gir en ny versjon på hver side som siterer en delt referanse, når den publiseres', async () => {
    const ref = await nyReferanse('Delt kilde')
    const a = await nyFagside('Deler')
    const b = await nyFagside('Deler')
    for (const s of [a, b]) {
      const kort = await kall.opprett('innholdselement', kortinnhold(s.side, 'Med kilde', { referanser: [ref] }))
      await kall.publiser(kort.id, 1)
    }
    const forA = (await versjoner(a.slug)).length
    const forB = (await versjoner(b.slug)).length

    await kall.lagre(ref, 1, { tittel: 'Delt kilde, ny utgave', forfattere: 'A', aar: '2026', lenke: `https://example.org/versjon/delt` })
    await kall.publiser(ref, 2)

    for (const [s, for_] of [[a, forA], [b, forB]] as const) {
      const liste = await versjoner(s.slug)
      expect(liste).toHaveLength(for_ + 1)
      const lest = (await versjon(s.slug, liste[0]!.nr))!
      expect(lest.referanser).toEqual([expect.objectContaining({ id: ref, revisjon: 2 })])
      const eldre = (await versjon(s.slug, liste[1]!.nr))!
      expect(eldre.referanser).toEqual([expect.objectContaining({ id: ref, revisjon: 1 })])
    }
  })

  it('gir én versjon når siden publiseres i flere steg i samme transaksjon', async () => {
    const { side, slug } = await nyFagside()
    const kort1 = await kall.opprett('innholdselement', kortinnhold(side, 'En'))
    const kort2 = await kall.opprett('innholdselement', kortinnhold(side, 'To', { panel: 'indikasjon' }))
    const for_ = (await versjoner(slug)).length
    await db.transaction(async (tx) => {
      await tx.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: admin, role: 'authenticated' })])
      await tx.query('select public.publiser_utkast($1, 1)', [kort1.id])
      await tx.query('select public.publiser_utkast($1, 1)', [kort2.id])
    })
    const liste = await versjoner(slug)
    expect(liste).toHaveLength(for_ + 1)
    expect(liste[0]!.antall.elementer).toBe(2)
  })

  it('binder bivirkningsimportene, og en ny import gir en ny versjon', async () => {
    const { side, slug } = await nyFagside('Bivirkningsstoff')
    const importer = (tekst: string) => {
      const imp = structuredClone(MAL)
      imp.stoff = slug
      imp.organsystemer[0].frekvenser[0].bivirkninger[0] = tekst
      return db.query<{ id: string }>('select bivirkninger.importer($1::jsonb) as id', [JSON.stringify(imp)]).then((r) => r.rows[0]!.id)
    }
    const forste = await importer('Syntetisk første')
    let liste = await versjoner(slug)
    expect(liste[0]!.antall.bivirkninger).toBe(1)
    expect((await versjon(slug, liste[0]!.nr))!.bivirkninger).toEqual([expect.objectContaining({ id: forste })])

    const andre = await importer('Syntetisk andre')
    liste = await versjoner(slug)
    expect((await versjon(slug, liste[0]!.nr))!.bivirkninger).toEqual([expect.objectContaining({ id: andre })])
    expect((await versjon(slug, liste[1]!.nr))!.bivirkninger).toEqual([expect.objectContaining({ id: forste })])
    expect(side).toBeTruthy()
  })
})

describe('tilgangen', () => {
  it('kan ikke endres, slettes eller skrives fra API-et', async () => {
    const { slug } = await nyFagside()
    expect((await feilFra(() => db.query('update public.sideversjoner set nr = nr + 100')))?.code).toBe('42501')
    expect((await feilFra(() => db.query('delete from public.sideversjoner')))?.code).toBe('42501')
    expect(
      (await feilFra(() => kall.les(admin, `insert into public.sideversjoner (infoside, nr, opphav, manifest, fingeravtrykk)
        select infoside, 99, 'basis', manifest, fingeravtrykk from public.sideversjoner limit 1`)))?.code,
    ).toBe('42501')
    expect(await versjoner(slug)).toHaveLength(1)
  })

  it('slettes med siden når den slettes for godt', async () => {
    const { side } = await nyFagside('Papirkurvstoff')
    await db.transaction(async (tx) => {
      await tx.query(`select set_config('intern.sletter_stoffside', $1, true)`, [side])
      await tx.query('delete from public.objektpubliseringer where objekt_id = $1', [side])
      await tx.query('delete from public.objekttilstander where objekt_id = $1', [side])
      await tx.query('delete from public.objektrevisjoner where objekt_id = $1', [side])
      await tx.query('delete from public.redigerbare_objekter where id = $1', [side])
    })
    expect(await kall.fasit('select 1 from public.sideversjoner where infoside = $1', [side])).toEqual([])
  })
})
