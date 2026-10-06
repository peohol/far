/**
 * Monografkurateringene kjørt slik produksjonen kjørte dem: hele kjeden én
 * gang, i rekkefølge, med kuratoren (`hjelp/kurateringskjeden.ts`). For hvert
 * stoff kontrolleres at hver kuratering faktisk endret siden, og at siden står
 * uten upubliserte utkast og bare peker på referanser som finnes, én per
 * lenke. Sluttresultatet for et stoff valideres i `kurateringskjeden/<stoff>.ts`.
 * Til slutt kjøres kurateringene som selv sjekker om de alt er gjort, på nytt,
 * hver for seg, og skal ikke endre noe.
 */
import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { elementer, inlineReferanser, kuratertDatabase, type Stoffvalidering } from './hjelp/kurateringskjeden'
import { type KjortKuratering, kjorMigrasjoner, monografkurateringer } from './hjelp/testdatabase'

const KURATERINGER = monografkurateringer()
const STOFFER = [...new Set(KURATERINGER.map((k) => k.stoff!))]

/** Det stoffspesifikke, etter filnavnet i `kurateringskjeden/`. */
const VALIDERINGER: Record<string, Stoffvalidering> = Object.fromEntries(
  Object.entries(import.meta.glob<Stoffvalidering>('./kurateringskjeden/*.ts', { eager: true, import: 'default' })).map(
    ([fil, valider]) => [fil.replace(/^.*\/|\.ts$/g, ''), valider],
  ),
)

let db: PGlite
let kjort: KjortKuratering[]

beforeAll(async () => {
  ;({ db, kjort } = await kuratertDatabase())
}, 240_000)

describe('kurateringskjeden', () => {
  it('kjører hver monografkuratering én gang, i rekkefølge', () => {
    expect(KURATERINGER.length).toBeGreaterThan(0)
    expect(kjort.map((k) => k.fil)).toEqual(KURATERINGER.map((k) => k.fil))
  })

  it('har stoffspesifikk validering bare for stoffer som er kuratert', () => {
    expect(Object.keys(VALIDERINGER).length).toBeGreaterThan(0)
    for (const stoff of Object.keys(VALIDERINGER)) expect(STOFFER).toContain(stoff)
  })
})

describe.each(STOFFER)('%s', (stoff) => {
  const filer = KURATERINGER.filter((k) => k.stoff === stoff).map((k) => k.fil)

  it.each(filer)('%s endrer siden når kuratoren finnes', (fil) => {
    expect(kjort.find((k) => k.fil === fil)?.nyeRevisjoner).toBeGreaterThan(0)
  })

  it('står uten upubliserte utkast', async () => {
    const side = await elementer(db, stoff)
    expect(side.length).toBeGreaterThan(0)
    for (const e of side) expect(e.utkast, `${e.panel} ${e.objekt_id}`).toBe(e.publisert)
  })

  it('peker bare på publiserte referanser som finnes, og bare én med hver lenke', async () => {
    const ider = [...new Set((await elementer(db, stoff)).flatMap((e) => [...e.referanser, ...inlineReferanser(e.data)]))]
    const { rows } = await db.query<{ objekt_id: string; lenke: string | null; like: number }>(
      `select r.objekt_id, r.lenke,
         (select count(*)::int from public.referanser a where a.tilstand = 'publisert' and a.lenke = r.lenke) as like
       from public.referanser r
       where r.tilstand = 'publisert' and r.objekt_id::text = any($1::text[])`,
      [ider],
    )
    expect(rows.map((r) => r.objekt_id).sort()).toEqual([...ider].sort())
    // En referanse uten lenke (fra importene) slås ikke opp på lenken.
    for (const r of rows) if (r.lenke?.trim()) expect(r.like, r.lenke).toBe(1)
  })

  VALIDERINGER[stoff]?.(() => db)
})

// Sist, siden den kjører migrasjoner på nytt. Bare kurateringene som selv
// sjekker `intern.kuratering_utfort` lover å tåle det.
describe('kurateringene som sjekker om de alt er gjort', () => {
  const selvsjekkende = KURATERINGER.filter((k) => k.selvsjekkende).map((k) => k.fil)

  it.each(selvsjekkende)('%s endrer ingenting når den kjøres på nytt', async (fil) => {
    expect(await kjorMigrasjoner(db, { bare: [fil] })).toEqual([{ fil, nyeRevisjoner: 0 }])
  })
})
