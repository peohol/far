/**
 * Migrasjonene som gjør farmakodynamikktekstene om til mekanismekort, prøvd
 * mot de samme dataene produksjonen har: importene kjøres med administratoren
 * som bestilte dem, så omgjøringen. To sider er endret i appen først, og skal
 * stå urørt. Til sist redigeres, publiseres og gjenopprettes et kort, som i
 * appen.
 */
import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { FARMAKODYNAMIKK, farmakodynamikkplan, KORTKILDE, TEKSTKILDE } from '../faginnhold/farmakodynamikk'
import type { Innhold } from '../faginnhold/modell'
import { ELEMENTTYPER, FJERNET } from '../faginnhold/paneler'
import { STOFFREGISTER } from '../domain/stoffregister'
import { faginnholdskall, kjorMigrasjoner, migrasjonsfiler, nyDatabase, opprettBruker, type Faginnholdskall } from './hjelp/testdatabase'

const FORSTE_IMPORTMIGRASJON = '20260923072247'
const OMGJORING = migrasjonsfiler().filter((f) => /_farmakodynamikk_mekanismekort_\d+\.sql$/.test(f))
const PLAN = farmakodynamikkplan()
/** Endret og publisert i appen etter importen. */
const ENDRET = 'amisulprid'
/** Har et upublisert utkast. */
const UTKAST = 'citalopram'

interface Element {
  objekt_id: string
  slug: string
  panel: string
  posisjon: number
  elementtype: string
  data: Record<string, unknown>
  referanser: string[] | null
  utkast: number
  publisert: number
  kilde: string | null
}

/** Elementene i farmakodynamikken, og de som er flyttet derfra, per side. */
async function elementer(db: PGlite, ider: readonly string[] = []): Promise<Element[]> {
  const { rows } = await db.query<Element>(
    `select e.objekt_id, s.slug, e.panel, e.posisjon, e.elementtype, e.data, r.innhold->'referanser' as referanser,
       u.revisjon as utkast, p.revisjon as publisert, r.kilde
     from public.innholdselementer e
     join public.infosider s on s.objekt_id = e.infoside_id and s.tilstand = 'publisert'
     join public.objekttilstander u on u.objekt_id = e.objekt_id and u.tilstand = 'utkast'
     join public.objekttilstander p on p.objekt_id = e.objekt_id and p.tilstand = 'publisert'
     join public.objektrevisjoner r on r.objekt_id = e.objekt_id and r.revisjon = p.revisjon
     where e.tilstand = 'publisert' and (e.panel = $1 or e.objekt_id = any($2::uuid[]))
     order by s.slug, e.posisjon, e.objekt_id`,
    [FARMAKODYNAMIKK, ider],
  )
  return rows
}

const antall = async (db: PGlite, sql: string) => (await db.query<{ n: number }>(sql)).rows[0]!.n

describe('omgjøringen i databasen', () => {
  let db: PGlite
  let kall: Faginnholdskall
  let for_: Element[]
  let etter: Element[]
  const tekstFor = (slug: string) => for_.find((e) => e.slug === slug && e.elementtype === ELEMENTTYPER.riktekst)!
  const paSiden = (slug: string) => etter.filter((e) => e.slug === slug)

  beforeAll(async () => {
    db = await nyDatabase({ til: FORSTE_IMPORTMIGRASJON })
    const admin = await opprettBruker(db, { brukernavn: 'peohol', fornavn: 'Rita', etternavn: 'Redaktør', rolle: 'admin' })
    await kjorMigrasjoner(db, { fra: FORSTE_IMPORTMIGRASJON, til: OMGJORING[0] })
    kall = faginnholdskall(db, admin)
    for_ = await elementer(db)

    // En redaktør har endret teksten på én side, og begynt på et utkast på en annen.
    const innhold = async (id: string) =>
      (await kall.fasit<{ innhold: Innhold['innholdselement'] }>('select innhold from public.objektrevisjoner where objekt_id = $1 and revisjon = 1', [id]))[0]!.innhold
    const endret = tekstFor(ENDRET)
    await kall.lagre(endret.objekt_id, 1, { ...(await innhold(endret.objekt_id)), data: { dokument: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Endret i appen.' }] }] } } })
    await kall.publiser(endret.objekt_id, 2)
    const utkast = tekstFor(UTKAST)
    await kall.lagre(utkast.objekt_id, 1, { ...(await innhold(utkast.objekt_id)), posisjon: 1 })

    await kjorMigrasjoner(db, { bare: OMGJORING })
    etter = await elementer(db, for_.map((e) => e.objekt_id))
  }, 300_000)

  it('har en importert tekst å gjøre om på hver side i datasettet, og bare der', () => {
    const tekster = for_.filter((e) => e.elementtype === ELEMENTTYPER.riktekst)
    expect(tekster.map((e) => e.slug).sort()).toEqual(PLAN.map((k) => k.stoff).sort())
    for (const k of PLAN) expect(tekstFor(k.stoff).data.dokument, k.stoff).toEqual(k.fra)
    expect(for_.filter((e) => e.elementtype === ELEMENTTYPER.mekanisme)).toEqual([])
  })

  it('gir hver side kortene fra kartleggingen, i rekkefølge, publisert med kildene til teksten', () => {
    for (const k of PLAN.filter((x) => x.stoff !== ENDRET && x.stoff !== UTKAST)) {
      const kort = paSiden(k.stoff).filter((e) => e.panel === FARMAKODYNAMIKK)
      expect(kort.map((e) => e.elementtype), k.stoff).toEqual(k.kort.map(() => ELEMENTTYPER.mekanisme))
      expect(kort.map((e) => e.data), k.stoff).toEqual(k.kort)
      expect(kort.map((e) => e.posisjon), k.stoff).toEqual(k.kort.map((_, i) => i))
      for (const e of kort) {
        expect([e.utkast, e.publisert, e.kilde], k.stoff).toEqual([1, 1, KORTKILDE])
        expect(e.referanser, k.stoff).toEqual(tekstFor(k.stoff).referanser)
      }
    }
    expect(paSiden('enalapril').find((e) => e.panel === FARMAKODYNAMIKK)!.referanser!.length).toBeGreaterThan(0)
  })

  it('tar den gamle teksten bort fra siden, men beholder den i historikken', () => {
    for (const k of PLAN.filter((x) => x.stoff !== ENDRET && x.stoff !== UTKAST)) {
      const tekst = etter.find((e) => e.objekt_id === tekstFor(k.stoff).objekt_id)!
      expect(tekst.panel, k.stoff).toBe(FJERNET)
      expect(tekst.data.dokument, k.stoff).toEqual(k.fra)
      expect([tekst.utkast, tekst.publisert, tekst.kilde], k.stoff).toEqual([2, 2, TEKSTKILDE])
      expect(paSiden(k.stoff).filter((e) => e.panel === FARMAKODYNAMIKK && e.elementtype === ELEMENTTYPER.riktekst), k.stoff).toEqual([])
    }
  })

  it('lar en tekst som er endret i appen, eller har et utkast, stå urørt og uten kort', () => {
    for (const slug of [ENDRET, UTKAST]) {
      const side = paSiden(slug)
      expect(side.map((e) => e.elementtype), slug).toEqual([ELEMENTTYPER.riktekst])
      expect(side[0]!.panel, slug).toBe(FARMAKODYNAMIKK)
    }
    expect(paSiden(ENDRET)[0]!.publisert).toBe(2)
    expect([paSiden(UTKAST)[0]!.utkast, paSiden(UTKAST)[0]!.publisert]).toEqual([2, 1])
  })

  it('gir ingen kort til stoffene uten farmakodynamikktekst', async () => {
    const medKort = new Set(etter.filter((e) => e.elementtype === ELEMENTTYPER.mekanisme).map((e) => e.slug))
    expect(medKort.size).toBe(PLAN.length - 2)
    const utenTekst = STOFFREGISTER.stoffer.map((s) => s.slug).filter((s) => !PLAN.some((k) => k.stoff === s))
    expect(utenTekst).toHaveLength(39)
    for (const slug of utenTekst) expect(paSiden(slug), slug).toEqual([])
    expect(await antall(db, `select count(*)::int as n from public.innholdselementer where tilstand = 'publisert' and elementtype = 'mekanismekort'`)).toBe(
      PLAN.filter((k) => k.stoff !== ENDRET && k.stoff !== UTKAST).reduce((sum, k) => sum + k.kort.length, 0),
    )
  })

  it('gjør ingenting når den kjøres en gang til', async () => {
    const revisjoner = await antall(db, 'select count(*)::int as n from public.objektrevisjoner')
    await kjorMigrasjoner(db, { bare: OMGJORING })
    expect(await antall(db, 'select count(*)::int as n from public.objektrevisjoner')).toBe(revisjoner)
  })

  it('lar en redaktør endre et kort som utkast, publisere det og hente fram den gamle revisjonen', async () => {
    const kort = paSiden('atenolol').find((e) => e.panel === FARMAKODYNAMIKK)!
    const [forste] = await kall.revisjoner(kort.objekt_id)
    const innhold = forste!.innhold as unknown as Innhold['innholdselement']
    const nytt = { ...innhold, data: { ...innhold.data, kvalifikasjon: 'Syntetisk kvalifikasjon' } }

    await kall.lagre(kort.objekt_id, 1, nytt)
    await kall.forventSamsvar(kort.objekt_id)
    // Utkastet vises ikke før det publiseres.
    expect((await elementer(db)).find((e) => e.objekt_id === kort.objekt_id)!.data).toEqual(kort.data)
    await kall.publiser(kort.objekt_id, 2)
    expect((await elementer(db)).find((e) => e.objekt_id === kort.objekt_id)!.data).toMatchObject({ kvalifikasjon: 'Syntetisk kvalifikasjon' })

    await kall.gjenopprett(kort.objekt_id, 2, 1)
    await kall.publiser(kort.objekt_id, 3)
    expect((await elementer(db)).find((e) => e.objekt_id === kort.objekt_id)!.data).toEqual(kort.data)
    expect((await kall.revisjoner(kort.objekt_id)).map((r) => r.revisjon)).toEqual([1, 2, 3])
  })
})
