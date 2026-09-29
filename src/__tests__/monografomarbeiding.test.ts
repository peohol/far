/**
 * Omarbeidingene av de importerte stoffsidene (datamigreringer etter
 * psykofarmakaimporten), prøvd mot de samme dataene produksjonen har: importen
 * kjøres med administratoren som bestilte den, og tilstanden før og etter hver
 * omarbeiding sammenlignes.
 */
import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  formaterFormverdier,
  kontrollerFormverdier,
  lesFormverdier,
} from '../faginnhold/paneler'
import { STOFFREGISTER } from '../domain/stoffregister'
import { kjorMigrasjoner, migrasjonsfiler, nyDatabase, opprettBruker } from './hjelp/testdatabase'

const FORSTE_IMPORTMIGRASJON = '20260923072247'
const migrasjon = (navn: string) => migrasjonsfiler().find((f) => f.endsWith(`_${navn}.sql`))!
const VIKTIGE_DATA = migrasjon('viktige_data_former')
const SEKSJONER = migrasjon('monograf_seksjoner')
const KANONISKE_STOFFSIDER = migrasjon('kanoniske_stoffsider')

/** Importen slik produksjonen har den, med omarbeidingene før `til`. */
async function importert(til: string): Promise<PGlite> {
  const db = await nyDatabase({ til: FORSTE_IMPORTMIGRASJON })
  await opprettBruker(db, { brukernavn: 'peohol', fornavn: 'Rita', etternavn: 'Redaktør', rolle: 'admin' })
  await kjorMigrasjoner(db, { fra: FORSTE_IMPORTMIGRASJON, til })
  return db
}

/** Kjører bare migrasjonen `fil`. */
const kjorBare = (db: PGlite, fil: string) => kjorMigrasjoner(db, { fra: fil, til: `${fil}~` })

interface Kort {
  objekt_id: string
  navn: string
  elementtype: string
  data: Record<string, unknown>
  utkast: number
  publisert: number
  kilde: string | null
}

/** Kortene i viktige data slik de er publisert, etter side og type. */
async function viktigeData(db: PGlite): Promise<Map<string, Kort>> {
  const { rows } = await db.query<Kort>(
    `select e.objekt_id, i.navn, e.elementtype, e.data, u.revisjon as utkast, p.revisjon as publisert, r.kilde
     from public.innholdselementer e
     join public.infosider i on i.objekt_id = e.infoside_id and i.tilstand = e.tilstand
     join public.objekttilstander u on u.objekt_id = e.objekt_id and u.tilstand = 'utkast'
     join public.objekttilstander p on p.objekt_id = e.objekt_id and p.tilstand = 'publisert'
     join public.objektrevisjoner r on r.objekt_id = e.objekt_id and r.revisjon = p.revisjon
     where e.tilstand = 'publisert' and e.panel = 'viktige_data'`,
  )
  return new Map(rows.map((k) => [`${k.navn}/${k.elementtype}`, k]))
}

const FORMVIS = new Set(['halveringstid', 'steady_state'])
const forbehold = (k: Kort) => (typeof k.data.forbehold === 'string' ? k.data.forbehold : '')

describe('viktige data: forbeholdene tas bort, og t½ og tss står per legemiddelform', () => {
  let db: PGlite
  let for_: Map<string, Kort>
  let etter: Map<string, Kort>
  const endret = () => [...for_.values()].filter((k) => FORMVIS.has(k.elementtype) || forbehold(k))

  beforeAll(async () => {
    db = await importert(VIKTIGE_DATA)
    for_ = await viktigeData(db)
    await kjorBare(db, VIKTIGE_DATA)
    etter = await viktigeData(db)
  }, 120_000)

  it('møter de samme kortene som produksjonen, så sjekksummen stemmer og alt blir skrevet om', () => {
    expect(endret()).toHaveLength(103)
    for (const k of endret()) expect(etter.get(`${k.navn}/${k.elementtype}`)!.publisert, k.navn).toBe(k.publisert + 1)
  })

  it('gjør «33 ± 4 timer» om til 33 (29–37) timer', () => {
    expect(etter.get('Citalopram/halveringstid')!.data).toEqual({
      former: [{ form: '', typisk: 33, min: 29, maks: 37, enhet: 'timer' }],
    })
    expect(formaterFormverdier(lesFormverdier(etter.get('Citalopram/halveringstid')!.data))).toBe('33 (29–37) timer')
  })

  it('gir hver legemiddelform sin egen verdi der forbeholdet nevnte flere', () => {
    const vist = (navn: string) => formaterFormverdier(lesFormverdier(etter.get(navn)!.data))
    expect(vist('Haloperidol/steady_state')).toBe('Peroralt: 5 døgn · Depotinjeksjon: 2–4 måneder')
    expect(vist('Haloperidol/halveringstid')).toBe('Peroralt: 24 timer · Injeksjon i.m.: 21 timer')
    expect(vist('Zuklopentiksol/halveringstid')).toBe(
      'Peroralt: 12–26 timer · Injeksjon (Acutard): 18–24 timer · Depotinjeksjon: 19 dager',
    )
  })

  it('beholder verdien uendret på kortene uten et forbehold som sa noe mer', () => {
    const uten = endret().filter((k) => FORMVIS.has(k.elementtype) && ['', 'Omtrentlig.'].includes(forbehold(k)))
    expect(uten.length).toBeGreaterThan(20)
    for (const k of uten) {
      expect(etter.get(`${k.navn}/${k.elementtype}`)!.data, k.navn).toEqual(lesFormverdier(k.data))
    }
  })

  it('tar bare bort forbeholdet på konsentrasjonskortene', () => {
    const konsentrasjoner = endret().filter((k) => !FORMVIS.has(k.elementtype))
    expect(konsentrasjoner.length).toBeGreaterThan(0)
    for (const k of konsentrasjoner) {
      const { forbehold: _, ...uten } = k.data
      expect(etter.get(`${k.navn}/${k.elementtype}`)!.data, k.navn).toEqual(uten)
    }
  })

  it('etterlater ingen forbehold, og bare gyldige verdier per form', () => {
    for (const k of etter.values()) {
      // Et tomt forbehold på et kort som ellers ikke endres, får stå: det vises ikke.
      expect(forbehold(k), k.navn).toBe('')
      if (!FORMVIS.has(k.elementtype)) continue
      expect(Object.keys(k.data), k.navn).toEqual(['former'])
      expect(kontrollerFormverdier(lesFormverdier(k.data)), `${k.navn} ${k.elementtype}`).toBeNull()
      expect(lesFormverdier(k.data).former, k.navn).toEqual((k.data as { former: unknown[] }).former)
    }
  })

  it('publiserer hver endring med en kilde i historikken, så det som sto før, kan hentes tilbake', () => {
    for (const k of endret()) {
      const ny = etter.get(`${k.navn}/${k.elementtype}`)!
      expect(ny.utkast, k.navn).toBe(ny.publisert)
      expect(ny.kilde, k.navn).toBe(
        FORMVIS.has(k.elementtype)
          ? 'Omgjort: forbeholdet er tatt bort, og verdien står som typisk, minimum og maksimum per legemiddelform'
          : 'Tatt bort: forbeholdet under verdien',
      )
    }
  })

  it('gjør ingenting når kortene er endret siden, som når den kjøres en gang til', async () => {
    await kjorBare(db, VIKTIGE_DATA)
    expect(await viktigeData(db)).toEqual(etter)
  })

  it('gjør ingenting i en database uten administratoren', async () => {
    const tom = await nyDatabase()
    const { rows } = await tom.query<{ n: number }>('select count(*)::int as n from public.objektrevisjoner')
    expect(rows[0]!.n).toBe(0)
  })
})

interface Element {
  objekt_id: string
  navn: string
  panel: string
  posisjon: number
  elementtype: string
  data: Record<string, unknown>
  referanser: string[]
  utkast: number
  publisert: number
  kilde: string | null
}

/** De publiserte elementene i panelene som flyttes, med kortkildene i rekkefølge. */
async function elementer(db: PGlite): Promise<Element[]> {
  const { rows } = await db.query<Element>(
    `select e.objekt_id, i.navn, e.panel, e.posisjon, e.elementtype, e.data,
            coalesce((select array_agg(k.referanse_id::text order by k.nr) from public.referansekoblinger k
                      where k.objekt_id = e.objekt_id and k.tilstand = e.tilstand and k.niva = 'element'), '{}') as referanser,
            u.revisjon as utkast, p.revisjon as publisert, r.kilde
     from public.innholdselementer e
     join public.infosider i on i.objekt_id = e.infoside_id and i.tilstand = e.tilstand
     join public.objekttilstander u on u.objekt_id = e.objekt_id and u.tilstand = 'utkast'
     join public.objekttilstander p on p.objekt_id = e.objekt_id and p.tilstand = 'publisert'
     join public.objektrevisjoner r on r.objekt_id = e.objekt_id and r.revisjon = p.revisjon
     where e.tilstand = 'publisert'
       and e.panel in ('farmakokinetikk', 'farmakogenetikk', 'interaksjoner', 'serumkonsentrasjoner')`,
  )
  return rows
}

/** Panelkildene til serumkonsentrasjonene per side, med revisjonen og kilden til siden. */
async function panelkilder(db: PGlite): Promise<Map<string, { referanser: string[]; kilde: string | null }>> {
  const { rows } = await db.query<{ navn: string; referanser: string[]; kilde: string | null }>(
    `select i.navn, r.kilde,
            coalesce((select array_agg(k.referanse_id::text order by k.nr) from public.referansekoblinger k
                      where k.objekt_id = i.objekt_id and k.tilstand = i.tilstand and k.niva = 'panel'
                        and k.panel = 'serumkonsentrasjoner'), '{}') as referanser
     from public.infosider i
     join public.objekttilstander p on p.objekt_id = i.objekt_id and p.tilstand = 'publisert'
     join public.objektrevisjoner r on r.objekt_id = i.objekt_id and r.revisjon = p.revisjon
     where i.tilstand = 'publisert'`,
  )
  return new Map(rows.map(({ navn, ...resten }) => [navn, resten]))
}

describe('farmakogenetikk, interaksjoner og kildene i serumkonsentrasjonene', () => {
  let db: PGlite
  let for_: Element[]
  let etter: Map<string, Element>
  let sider: Map<string, { referanser: string[]; kilde: string | null }>
  const tittel = (e: Element) => (e.data as { tittel?: string }).tittel
  const etterFor = (e: Element) => etter.get(e.objekt_id)!

  beforeAll(async () => {
    db = await importert(SEKSJONER)
    for_ = await elementer(db)
    await kjorBare(db, SEKSJONER)
    etter = new Map((await elementer(db)).map((e) => [e.objekt_id, e]))
    sider = await panelkilder(db)
  }, 120_000)

  it('flytter «CYP-enzymer (substrat)» til farmakogenetikken, med tekst og kilder', () => {
    const cyp = for_.filter((e) => tittel(e) === 'CYP-enzymer (substrat)')
    expect(cyp).toHaveLength(33)
    for (const e of cyp) {
      expect(etterFor(e), e.navn).toMatchObject({
        panel: 'farmakogenetikk',
        posisjon: 0,
        elementtype: 'kinetikkort',
        data: e.data,
        referanser: e.referanser,
        publisert: e.publisert + 1,
        kilde: 'Flyttet: fra farmakokinetikken til farmakogenetikken',
      })
    }
    expect(cyp.some((e) => e.referanser.length > 0)).toBe(true)
  })

  it('gjør kortet «Interaksjoner» til teksten øverst i interaksjonene', () => {
    const interaksjoner = for_.filter((e) => tittel(e) === 'Interaksjoner')
    expect(interaksjoner).toHaveLength(32)
    for (const e of interaksjoner) {
      expect(etterFor(e), e.navn).toMatchObject({
        panel: 'interaksjoner',
        posisjon: 0,
        elementtype: 'riktekst',
        data: { dokument: e.data.dokument },
        referanser: e.referanser,
        publisert: e.publisert + 1,
      })
    }
  })

  it('lar de andre kortene i farmakokinetikken stå som de var', () => {
    const andre = for_.filter((e) => e.panel === 'farmakokinetikk' && !['CYP-enzymer (substrat)', 'Interaksjoner'].includes(tittel(e)!))
    expect(andre.length).toBeGreaterThan(200)
    for (const e of andre) expect(etterFor(e), e.navn).toEqual(e)
  })

  it('gir panelet kildene tabellen hadde, i samme rekkefølge, og tar dem bort fra tabellen', () => {
    const tabeller = for_.filter((e) => e.panel === 'serumkonsentrasjoner')
    expect(tabeller).toHaveLength(31)
    expect(tabeller.every((e) => e.referanser.length > 0)).toBe(true)
    for (const e of tabeller) {
      expect(sider.get(e.navn), e.navn).toEqual({
        referanser: e.referanser,
        kilde: 'Flyttet: kildene til tabellen over serumkonsentrasjoner gjelder nå hele panelet',
      })
      expect(etterFor(e), e.navn).toMatchObject({ data: e.data, referanser: [], publisert: e.publisert + 1 })
    }
  })

  it('publiserer alt den endrer', () => {
    for (const e of etter.values()) expect(e.utkast, e.navn).toBe(e.publisert)
  })

  it('gjør ingenting når den kjøres en gang til', async () => {
    await kjorBare(db, SEKSJONER)
    expect(new Map((await elementer(db)).map((e) => [e.objekt_id, e]))).toEqual(etter)
    expect(await panelkilder(db)).toEqual(sider)
  })
})


describe('kanoniske stoffsider skiller virkestoff fra laboratorieanalytt', () => {
  let db: PGlite
  let sideider: Record<string, string>

  const hovedsider = async () =>
    (
      await db.query<{ kode: string; objekt_id: string; navn: string; slug: string }>(
        `select a.kode, i.objekt_id, i.navn, i.slug
         from public.laboratorieanalytter a
         join public.infosider i on i.objekt_id = a.hovedside_id and i.tilstand = a.tilstand
         where a.tilstand = 'publisert' and a.kode in ('HBUP', 'PALI')
         order by a.kode`,
      )
    ).rows

  beforeAll(async () => {
    db = await importert(KANONISKE_STOFFSIDER)
    const for_ = await hovedsider()
    expect(for_.map((r) => [r.kode, r.navn])).toEqual([
      ['HBUP', 'Hydroksybupropion'],
      ['PALI', 'Paliperidon (hydroksyrisperidon)'],
    ])
    sideider = Object.fromEntries(for_.map((r) => [r.kode, r.objekt_id]))
    await kjorBare(db, KANONISKE_STOFFSIDER)
  }, 180_000)

  it('beholder sideobjektene og gir dem stoffets navn og nøkkel', async () => {
    expect(await hovedsider()).toEqual([
      { kode: 'HBUP', objekt_id: sideider.HBUP, navn: 'Bupropion', slug: 'bupropion' },
      { kode: 'PALI', objekt_id: sideider.PALI, navn: 'Paliperidon', slug: 'paliperidon' },
    ])
  })

  it('gjør sidene lesbare etter stoffets nøkkel, ikke etter analytten', async () => {
    const { rows } = await db.query<{ side: { stoff: { id: string; slug: string; navn: string } } }>(
      `select public.les_stoff('bupropion', 'publisert') as side`,
    )
    expect(rows[0]!.side.stoff).toEqual({ id: sideider.HBUP, slug: 'bupropion', navn: 'Bupropion' })
  })

  it('lar HBUP fortsatt måle hydroksybupropion, som et eget objekt fra Bupropion-siden', async () => {
    const { rows } = await db.query<{ navn: string; objekt_id: string; tilstand: string }>(
      `select i.navn, i.objekt_id, a.tilstand
       from public.laboratorieanalytter a
       join public.analyttkomponenter k on k.analytt_id = a.objekt_id and k.tilstand = a.tilstand
       join public.infosider i on i.objekt_id = k.infoside_id and i.tilstand = a.tilstand
       where a.kode = 'HBUP'
       order by a.tilstand, k.posisjon`,
    )
    expect(rows.map((r) => [r.tilstand, r.navn])).toEqual([
      ['utkast', 'Hydroksybupropion'],
      ['publisert', 'Hydroksybupropion'],
    ])
    expect(rows[0]!.objekt_id).toBe(rows[1]!.objekt_id)
    expect(rows[0]!.objekt_id).not.toBe(sideider.HBUP)
  })

  it('gir de gamle lesefunksjonene riktig hovedside og målt komponent', async () => {
    type Utgave = { id: string; innhold: { navn: string } }
    const side = async (kode: string) =>
      (
        await db.query<{ side: { infoside: Utgave; komponenter: Utgave[] } }>(
          `select public.les_analyttside($1, 'publisert') as side`,
          [kode],
        )
      ).rows[0]!.side
    const hbup = await side('HBUP')
    expect(hbup.infoside).toMatchObject({ id: sideider.HBUP, innhold: { navn: 'Bupropion' } })
    expect(hbup.komponenter.map((k) => k.innhold.navn)).toEqual(['Hydroksybupropion'])
    expect(hbup.komponenter[0]!.id).not.toBe(sideider.HBUP)
    // PALI måler paliperidon, som er hydroksyrisperidon: komponenten er stoffet selv.
    const pali = await side('PALI')
    expect(pali.infoside).toMatchObject({ id: sideider.PALI, innhold: { navn: 'Paliperidon' } })
    expect(pali.komponenter.map((k) => [k.id, k.innhold.navn])).toEqual([[sideider.PALI, 'Paliperidon']])
  })

  it('lar komponentsiden være et annet navn på Bupropion i stoffregisteret, ikke et eget stoff', async () => {
    const { rows } = await db.query<{ slug: string }>(
      `select slug from public.infosider where tilstand = 'publisert' and navn = 'Hydroksybupropion'`,
    )
    expect(rows.map((r) => r.slug)).toEqual(['hydroksybupropion'])
    expect(STOFFREGISTER.finn('hydroksybupropion')).toBeUndefined()
    expect(STOFFREGISTER.kanonisk('hydroksybupropion')?.slug).toBe('bupropion')
  })

  it('beholder faginnholdet på de samme sideobjektene', async () => {
    for (const kode of ['HBUP', 'PALI']) {
      const { rows } = await db.query<{ n: number }>(
        `select count(*)::int as n
         from public.innholdselementer
         where tilstand = 'publisert' and infoside_id = $1`,
        [sideider[kode]],
      )
      expect(rows[0]!.n, kode).toBeGreaterThan(0)
    }
  })

  it('gjør ingenting når migrasjonen kjøres igjen', async () => {
    const for_ = (
      await db.query<{ n: number }>('select count(*)::int as n from public.objektrevisjoner')
    ).rows[0]!.n
    await kjorBare(db, KANONISKE_STOFFSIDER)
    const etter = (
      await db.query<{ n: number }>('select count(*)::int as n from public.objektrevisjoner')
    ).rows[0]!.n
    expect(etter).toBe(for_)
  })
})
