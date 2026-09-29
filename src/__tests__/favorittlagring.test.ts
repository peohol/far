/**
 * Favorittene i databasen: hver bruker ser og endrer bare sine egne, merkingen
 * tåler å bli gjentatt, og favorittene følger fagsiden når den publiseres med
 * ny nøkkel. Stoffene og navnene er syntetiske.
 */
import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { lagFavorittlager } from '../favoritter/lagring'
import { faginnholdskall, feilFra, nyDatabase, opprettBruker, som, type Faginnholdskall } from './hjelp/testdatabase'

describe('favorittene i databasen', () => {
  let db: PGlite
  let kall: Faginnholdskall
  let admin: string
  let ada: string
  let bo: string

  const sql = <T = Record<string, unknown>>(bruker: string | null, tekst: string, parametre: unknown[] = []) =>
    som(db, bruker, async (tx) => (await tx.query<T>(tekst, parametre)).rows)

  beforeAll(async () => {
    db = await nyDatabase()
    admin = await opprettBruker(db, { brukernavn: 'admin', fornavn: 'Rita', etternavn: 'Redaktør', rolle: 'admin' })
    ada = await opprettBruker(db, { brukernavn: 'ada.l', fornavn: 'Ada', etternavn: 'Lovelace', rolle: 'user' })
    bo = await opprettBruker(db, { brukernavn: 'bob', fornavn: 'Bo', etternavn: 'Bruker', rolle: 'user' })
    kall = faginnholdskall(db, admin)
  }, 60_000)

  it('lar hver bruker legge til, lese og fjerne sine egne, i den rekkefølgen de ble lagt til', async () => {
    const lager = lagFavorittlager(kall.klientFor(ada))
    await lager.sett('teststoff-b', true)
    await lager.sett('teststoff-a', true)
    // Et trykk til på den samme gir ingen feil og ingen ny rad.
    await lager.sett('teststoff-b', true)
    expect(await lager.hent()).toEqual(['teststoff-b', 'teststoff-a'])

    // Bo ser ingenting av Adas favoritter.
    expect(await lagFavorittlager(kall.klientFor(bo)).hent()).toEqual([])
    expect(await sql(bo, 'select * from public.stoffavoritter')).toEqual([])

    await lager.sett('teststoff-b', false)
    await lager.sett('teststoff-b', false)
    expect(await lager.hent()).toEqual(['teststoff-a'])
  })

  it('lar ingen skrive eller fjerne andres favoritter, og anonyme ingenting', async () => {
    await lagFavorittlager(kall.klientFor(ada)).sett('ada-sitt', true)

    // Brukeren settes av databasen og kan ikke velges.
    expect(
      await feilFra(() => sql(bo, 'insert into public.stoffavoritter (bruker_id, stoff) values ($1, $2)', [ada, 'juks'])),
    ).toMatchObject({ code: '42501' })
    await sql(bo, 'delete from public.stoffavoritter where stoff = $1', ['ada-sitt'])
    await lagFavorittlager(kall.klientFor(bo)).sett('ada-sitt', false)
    expect(await lagFavorittlager(kall.klientFor(ada)).hent()).toContain('ada-sitt')

    expect(await feilFra(() => sql(null, 'select * from public.stoffavoritter'))).toMatchObject({ code: '42501' })
    expect(await feilFra(() => kall.rpc(null, 'les_stoffavoritter', {}))).toMatchObject({ code: '42501' })
  })

  it('avviser en nøkkel som ikke har formen til en stoffnøkkel', async () => {
    await expect(lagFavorittlager(kall.klientFor(ada)).sett('Ikke en nøkkel', true)).rejects.toThrow()
  })

  it('flytter favorittene når den publiserte siden får ny nøkkel, men ikke for et upublisert utkast', async () => {
    const side = (await kall.opprett('infoside', { navn: 'Flyttestoff' })).id
    await kall.publiser(side, 1)
    await lagFavorittlager(kall.klientFor(ada)).sett('flyttestoff', true)
    // Bo har alt den nye nøkkelen, og beholder én favoritt.
    await lagFavorittlager(kall.klientFor(bo)).sett('flyttestoff', true)
    await lagFavorittlager(kall.klientFor(bo)).sett('nytt-flyttestoff', true)

    await kall.lagre(side, 1, { navn: 'Flyttestoff', slug: 'nytt-flyttestoff', panelreferanser: {} })
    expect(await lagFavorittlager(kall.klientFor(ada)).hent()).toContain('flyttestoff')

    await kall.publiser(side, 2)
    const ada_ = await lagFavorittlager(kall.klientFor(ada)).hent()
    expect(ada_).toContain('nytt-flyttestoff')
    expect(ada_).not.toContain('flyttestoff')
    expect(await lagFavorittlager(kall.klientFor(bo)).hent()).toEqual(['nytt-flyttestoff'])
  })
})
