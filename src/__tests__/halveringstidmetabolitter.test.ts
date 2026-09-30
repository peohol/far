/**
 * t½ for moderstoffet og metabolittene øverst på sidene som oppgir begge
 * (`*_halveringstid_metabolitter.sql`), prøvd mot de samme dataene produksjonen
 * har: importen og omarbeidingene kjøres med administratoren, og kortene før og
 * etter sammenlignes.
 */
import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { formaterFormverdier, kontrollerFormverdier, lesFormverdier } from '../faginnhold/paneler'
import { kjorMigrasjoner, migrasjonsfiler, nyDatabase, opprettBruker } from './hjelp/testdatabase'

const FORSTE_IMPORTMIGRASJON = '20260923072247'
const HALVERINGSTID = migrasjonsfiler().find((f) => f.endsWith('_halveringstid_metabolitter.sql'))!

/** Kjører bare migrasjonen `fil`. */
const kjorBare = (db: PGlite, fil: string) => kjorMigrasjoner(db, { fra: fil, til: `${fil}~` })

interface Kort {
  navn: string
  posisjon: number
  data: Record<string, unknown>
  utkast: number
  publisert: number
  kilde: string | null
}

/** t½-kortene i viktige data slik de er publisert, etter side. */
async function halveringstider(db: PGlite): Promise<Map<string, Kort>> {
  const { rows } = await db.query<Kort>(
    `select i.navn, e.posisjon, e.data, u.revisjon as utkast, p.revisjon as publisert, r.kilde
     from public.innholdselementer e
     join public.infosider i on i.objekt_id = e.infoside_id and i.tilstand = e.tilstand
     join public.objekttilstander u on u.objekt_id = e.objekt_id and u.tilstand = 'utkast'
     join public.objekttilstander p on p.objekt_id = e.objekt_id and p.tilstand = 'publisert'
     join public.objektrevisjoner r on r.objekt_id = e.objekt_id and r.revisjon = p.revisjon
     where e.tilstand = 'publisert' and e.panel = 'viktige_data' and e.elementtype = 'halveringstid'`,
  )
  return new Map(rows.map((k) => [k.navn, k]))
}

const vist = (k: Kort | undefined) => k && formaterFormverdier(lesFormverdier(k.data))

describe('t½ for moderstoffet og metabolittene i viktige data', () => {
  let db: PGlite
  let for_: Map<string, Kort>
  let etter: Map<string, Kort>

  beforeAll(async () => {
    db = await nyDatabase({ til: FORSTE_IMPORTMIGRASJON })
    await opprettBruker(db, { brukernavn: 'peohol', fornavn: 'Rita', etternavn: 'Redaktør', rolle: 'admin' })
    await kjorMigrasjoner(db, { fra: FORSTE_IMPORTMIGRASJON, til: HALVERINGSTID })
    for_ = await halveringstider(db)
    await kjorBare(db, HALVERINGSTID)
    etter = await halveringstider(db)
  }, 120_000)

  it('gir de seks sidene som manglet t½-kortet, ett med en verdi per stoff', () => {
    const nye = ['Doksepin', 'Fluoksetin', 'Kariprazin', 'Klomipramin', 'Risperidon', 'Venlafaksin']
    for (const navn of nye) {
      expect(for_.has(navn), navn).toBe(false)
      expect(etter.get(navn)!.publisert, navn).toBe(1)
      expect(etter.get(navn)!.posisjon, navn).toBe(3)
    }
    expect(vist(etter.get('Venlafaksin'))).toBe('Venlafaksin: 5 (3–7) timer · O-desmetylvenlafaksin: 11 timer')
    expect(vist(etter.get('Fluoksetin'))).toBe('Fluoksetin: 0,5–6 døgn · Norfluoksetin: 4–6 døgn')
    expect(vist(etter.get('Kariprazin'))).toBe(
      'Kariprazin: 1–3 dager · Desmetylkariprazin: 1–3 dager · Didesmetylkariprazin: 13–19 dager',
    )
  })

  it('sier på bupropionsiden at halveringstiden er hydroksybupropions, uten å endre tallet', () => {
    const [for_bup, etter_bup] = [for_.get('Bupropion')!, etter.get('Bupropion')!]
    expect(vist(for_bup)).toBe('20 (12–65) timer')
    expect(vist(etter_bup)).toBe('Hydroksybupropion: 20 (12–65) timer')
    expect(etter_bup.publisert).toBe(for_bup.publisert + 1)
  })

  it('lar de andre t½-kortene stå som de var', () => {
    const andre = [...for_.keys()].filter((navn) => navn !== 'Bupropion')
    expect(andre.length).toBeGreaterThan(20)
    for (const navn of andre) expect(etter.get(navn), navn).toEqual(for_.get(navn))
  })

  it('skriver bare gyldige verdier, publisert med en kilde i historikken', () => {
    for (const [navn, k] of etter) {
      if (for_.get(navn) === undefined || navn === 'Bupropion') {
        expect(kontrollerFormverdier(lesFormverdier(k.data)), navn).toBeNull()
        expect(lesFormverdier(k.data).former, navn).toEqual((k.data as { former: unknown[] }).former)
        expect(k.utkast, navn).toBe(k.publisert)
        expect(k.kilde, navn).toMatch(/^(Lagt til|Omgjort): t½/)
      }
    }
  })

  it('gjør ingenting når den kjøres en gang til', async () => {
    await kjorBare(db, HALVERINGSTID)
    expect(await halveringstider(db)).toEqual(etter)
  })
})
