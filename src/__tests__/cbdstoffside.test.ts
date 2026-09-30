/**
 * Cannabidiolsiden får navnet «CBD» og nøkkelen «cbd», som THC-siden
 * (`*_cbd_stoffside.sql`), prøvd mot importene slik produksjonen har dem.
 */
import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { STOFFREGISTER } from '../domain/stoffregister'
import { kjorMigrasjoner, migrasjonsfiler, nyDatabase, opprettBruker } from './hjelp/testdatabase'

const FORSTE_IMPORTMIGRASJON = '20260923072247'
const CBD_STOFFSIDE = migrasjonsfiler().find((f) => f.endsWith('_cbd_stoffside.sql'))!

interface Side {
  objekt_id: string
  tilstand: string
  navn: string
  slug: string
}

describe('CBD-siden', () => {
  let db: PGlite
  let administrator: string
  let for_: Side[]
  let panelerFor: string[]

  const sider = async (): Promise<Side[]> =>
    (
      await db.query<Side>(
        `select objekt_id, tilstand, navn, slug from public.infosider
         where lower(navn) in ('cannabidiol', 'cbd') order by tilstand::text`,
      )
    ).rows

  const paneler = async (): Promise<string[]> =>
    (
      await db.query<{ panel: string }>(
        `select e.panel from public.innholdselementer e
         join public.infosider i on i.objekt_id = e.infoside_id and i.tilstand = e.tilstand
         where e.tilstand = 'publisert' and lower(i.navn) in ('cannabidiol', 'cbd') order by e.panel`,
      )
    ).rows.map((r) => r.panel)

  const revisjoner = async () =>
    (await db.query<{ n: number }>('select count(*)::int as n from public.objektrevisjoner')).rows[0]!.n

  beforeAll(async () => {
    db = await nyDatabase({ til: FORSTE_IMPORTMIGRASJON })
    administrator = await opprettBruker(db, { brukernavn: 'peohol', fornavn: 'Rita', etternavn: 'Redaktør', rolle: 'admin' })
    await kjorMigrasjoner(db, { fra: FORSTE_IMPORTMIGRASJON, til: CBD_STOFFSIDE })
    for_ = await sider()
    panelerFor = await paneler()
    await db.query('insert into public.stoffavoritter (bruker_id, stoff) values ($1, $2)', [administrator, 'cannabidiol'])
    await kjorMigrasjoner(db, { fra: CBD_STOFFSIDE, til: `${CBD_STOFFSIDE}~` })
  }, 300_000)

  it('fantes som «Cannabidiol» før migrasjonen', () => {
    expect(for_.map((s) => [s.tilstand, s.navn, s.slug])).toEqual([
      ['publisert', 'Cannabidiol', 'cannabidiol'],
      ['utkast', 'Cannabidiol', 'cannabidiol'],
    ])
  })

  it('beholder sideobjektet og gir det registerets navn og nøkkel, publisert', async () => {
    const cbd = STOFFREGISTER.finn('cbd')!
    expect(cbd.navn).toBe('CBD')
    expect((await sider()).map((s) => [s.objekt_id, s.tilstand, s.navn, s.slug])).toEqual([
      [for_[0]!.objekt_id, 'publisert', cbd.navn, cbd.slug],
      [for_[0]!.objekt_id, 'utkast', cbd.navn, cbd.slug],
    ])
  })

  it('er lesbar etter den nye nøkkelen, med innholdet siden hadde', async () => {
    const { rows } = await db.query<{ side: { stoff: { slug: string; navn: string }; elementer: { innhold: { panel: string } }[] } }>(
      `select public.les_stoff('cbd', 'publisert') as side`,
    )
    expect(rows[0]!.side.stoff).toMatchObject({ slug: 'cbd', navn: 'CBD' })
    expect(panelerFor).toContain('indikasjon')
    expect(rows[0]!.side.elementer.map((e) => e.innhold.panel).sort()).toEqual(panelerFor)
  })

  it('lar favorittene følge den nye nøkkelen', async () => {
    const { rows } = await db.query<{ stoff: string }>('select stoff from public.stoffavoritter where bruker_id = $1', [administrator])
    expect(rows).toEqual([{ stoff: 'cbd' }])
  })

  it('gjør ingenting når migrasjonen kjøres igjen', async () => {
    const n = await revisjoner()
    await kjorMigrasjoner(db, { fra: CBD_STOFFSIDE, til: `${CBD_STOFFSIDE}~` })
    expect(await revisjoner()).toBe(n)
  })
})