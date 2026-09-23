/**
 * Flyttingen av kommentarene i de enkle konsentrasjonsreglene over i felles
 * kommentarobjekter, prøvd slik den skjer i produksjon: databasen bygd fram
 * til omleggingen, dagens regler lagt inn av de historiske
 * importmigreringene, og så omleggingen og flyttingen.
 *
 * Fasiten er en database der de samme reglene er importert rett inn i den nye
 * formen. Etter flyttingen skal regelsettene og kommentarobjektene være de
 * samme, med de samme ID-ene og tekstene tegn for tegn, og fortolkningen skal
 * gi nøyaktig det den ga før.
 */
import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { regelsettvalg } from '../domain/valg'
import { lagFaginnholdsleser } from '../faginnhold/lesing'
import { regelimportSql } from '../regler/import'
import { lesPubliserteRegelsett } from '../regler/kommentarer'
import type { Intervallregelsettinnhold } from '../regler/modell'
import { DAGENS_IMPORT, IMPORTDATASETT, dagensRegelsett } from './hjelp/dagensregler'
import {
  faginnholdskall,
  feilFra,
  kjorMigrasjoner,
  migrasjonsfiler,
  nyDatabase,
  opprettBruker,
  type Faginnholdskall,
} from './hjelp/testdatabase'

/** Administratoren de historiske importmigreringene er skrevet for. */
const IMPORTADMIN = { brukernavn: 'peohol', fornavn: 'Ada', etternavn: 'Adminsen', rolle: 'admin' } as const
const IMPORTFILER = migrasjonsfiler().filter((f) => /_importer_intervallregelsett_\d+\.sql$/.test(f))
const OMLEGGING = migrasjonsfiler().find((f) => f.endsWith('_intervallregelsett_kommentarobjekter.sql'))!

interface Regelsettrad {
  id: string
  analyttkode: string
  tilstand: string
  innhold: Intervallregelsettinnhold
}

interface Kommentarrad {
  id: string
  tilstand: string
  navn: string
  tekst: string
  plassholdere: string[]
}

/** En database fram til omleggingen, med dagens regler importert slik de ble i produksjon. */
async function forOmleggingen(): Promise<{ db: PGlite; admin: string }> {
  const db = await nyDatabase({ til: OMLEGGING })
  const admin = await opprettBruker(db, IMPORTADMIN)
  for (const fil of IMPORTFILER) await kjorMigrasjoner(db, { fra: fil, til: `${fil}~` })
  return { db, admin }
}

async function regelsettene(db: PGlite): Promise<Regelsettrad[]> {
  return (
    await db.query<Regelsettrad>(
      `select s.objekt_id as id, s.analyttkode, s.tilstand::text, intern.les_intervallregelsett(s.objekt_id, s.tilstand) as innhold
       from public.intervallregelsett s order by s.analyttkode, s.tilstand`,
    )
  ).rows
}

async function kommentarene(db: PGlite): Promise<Kommentarrad[]> {
  return (
    await db.query<Kommentarrad>(
      `select objekt_id as id, tilstand::text, navn, tekst, plassholdere from public.kommentarer
       order by objekt_id, tilstand`,
    )
  ).rows
}

let flyttet: PGlite
let kall: Faginnholdskall
let fasit: PGlite
let for_: { id: string; analyttkode: string; innhold: Record<string, unknown> }[]

beforeAll(async () => {
  const bygd = await forOmleggingen()
  flyttet = bygd.db
  kall = faginnholdskall(flyttet, bygd.admin)
  for_ = (
    await flyttet.query<{ id: string; analyttkode: string; innhold: Record<string, unknown> }>(
      `select s.objekt_id as id, s.analyttkode, r.innhold
       from public.intervallregelsett s
       join public.objektrevisjoner r on r.objekt_id = s.objekt_id and r.revisjon = 1
       where s.tilstand = 'publisert' order by s.analyttkode`,
    )
  ).rows
  await kjorMigrasjoner(flyttet, { fra: OMLEGGING })

  fasit = await nyDatabase()
  await opprettBruker(fasit, IMPORTADMIN)
  await fasit.exec(regelimportSql(DAGENS_IMPORT, IMPORTADMIN.brukernavn))
}, 120_000)

describe('flyttingen av kommentarene til egne objekter', () => {
  it('startet med dagens regler, med tekstene i regelsettene', () => {
    expect(for_.map((r) => r.analyttkode)).toEqual(IMPORTDATASETT.map((i) => i.regelsett.analyttkode))
    for (const r of for_) expect(r.innhold, r.analyttkode).toEqual(dagensRegelsett(r.analyttkode))
  })

  it('gir de samme regelsettene og kommentarobjektene som en import rett inn i den nye formen', async () => {
    const utenId = (rader: Regelsettrad[]) => rader.map(({ analyttkode, tilstand, innhold }) => ({ analyttkode, tilstand, innhold }))
    expect(utenId(await regelsettene(flyttet))).toEqual(utenId(await regelsettene(fasit)))
    expect(await kommentarene(flyttet)).toEqual(await kommentarene(fasit))
    expect((await regelsettene(flyttet)).length).toBe(2 * IMPORTDATASETT.length)
  })

  it('beholder ID-ene reglene pekte på, og tekstene tegn for tegn', async () => {
    const kommentarer = await kommentarene(flyttet)
    const antall = IMPORTDATASETT.reduce((sum, i) => sum + i.regelsett.kommentarer.length, 0)
    expect(kommentarer).toHaveLength(2 * antall)
    for (const { regelsett } of IMPORTDATASETT) {
      for (const { id, tekst } of regelsett.kommentarer) {
        for (const tilstand of ['utkast', 'publisert']) {
          const rad = kommentarer.find((k) => k.id === id && k.tilstand === tilstand)
          expect(rad?.tekst, `${regelsett.analyttkode} ${tilstand}`).toBe(tekst)
          expect(rad?.plassholdere).toEqual([])
          expect(rad?.navn.startsWith(`${regelsett.analyttkode} – `)).toBe(true)
        }
      }
    }
  })

  it('lagrer regelsettet uten tekstene som en ny, publisert revisjon og lar den første stå', async () => {
    for (const { id, analyttkode, innhold } of for_) {
      const revisjoner = await kall.fasit<{
        revisjon: number
        handling: string
        innhold: Record<string, unknown>
        kilde: string | null
        utfort_av_fornavn: string
      }>('select revisjon, handling, innhold, kilde, utfort_av_fornavn from public.objektrevisjoner where objekt_id = $1 order by revisjon', [id])
      expect(revisjoner.map((r) => [r.revisjon, r.handling]), analyttkode).toEqual([
        [1, 'opprettet'],
        [2, 'endret'],
      ])
      expect(revisjoner[0]!.innhold).toEqual(innhold)
      const { kommentarer: _, ...uten } = innhold
      expect(revisjoner[1]!.innhold).toEqual(uten)
      expect(revisjoner[1]!.kilde).toBe('Kommentarene er flyttet ut i egne kommentarobjekter. Reglene og tekstene er uendret.')
      expect(revisjoner[1]!.utfort_av_fornavn).toBe(IMPORTADMIN.fornavn)
      const [status] = await kall.fasit<{ revisjon: number; publisert_revisjon: number }>(
        'select revisjon, publisert_revisjon from public.objektstatus where id = $1',
        [id],
      )
      expect(status).toEqual({ revisjon: 2, publisert_revisjon: 2 })
      await kall.forventSamsvar(id)
    }
  })

  it('gir hver kommentar en publisert første revisjon med kilden den kom fra', async () => {
    const { regelsett, kilde } = IMPORTDATASETT[0]!
    for (const { id } of regelsett.kommentarer) {
      const [revisjon] = await kall.revisjoner(id)
      const [rad] = await kall.fasit<{ kilde: string }>(
        'select kilde from public.objektrevisjoner where objekt_id = $1 and revisjon = 1',
        [id],
      )
      expect(revisjon!.handling).toBe('opprettet')
      expect(rad!.kilde).toBe(`Flyttet ut av fortolkningsreglene for ${regelsett.analyttkode}, revisjon 1. ${kilde}`)
      const [status] = await kall.fasit<{ publisert_revisjon: number }>(
        'select publisert_revisjon from public.objektstatus where id = $1',
        [id],
      )
      expect(status!.publisert_revisjon).toBe(1)
      await kall.forventSamsvar(id)
    }
  })

  it('gir fortolkningen nøyaktig de samme knappene og kommentarene som før', async () => {
    const bruker = await opprettBruker(flyttet, { brukernavn: 'flytting.bruker', fornavn: 'Vera', etternavn: 'Vanlig', rolle: 'user' })
    const regelsett = await lesPubliserteRegelsett(lagFaginnholdsleser(kall.klientFor(bruker)))
    expect(regelsett).toHaveLength(IMPORTDATASETT.length)
    for (const r of regelsett) {
      expect(regelsettvalg(r), r.analyttkode).toEqual(regelsettvalg(dagensRegelsett(r.analyttkode)))
    }
  })

  it('kan fortsatt gjenopprette revisjonen fra før, uten å ta tekstene inn i regelsettet igjen', async () => {
    const { id } = for_[0]!
    const status = await kall.gjenopprett(id, 2, 1)
    expect(status.revisjon).toBe(3)
    const revisjoner = await kall.revisjoner(id)
    expect(revisjoner[2]!.innhold).toEqual(revisjoner[1]!.innhold)
    await kall.forventSamsvar(id)
  })

  it('har tatt bort den gamle kommentartabellen og funksjonene til den', async () => {
    const [tabell] = await kall.fasit<{ finnes: string | null }>(`select to_regclass('public.regelsettkommentarer')::text as finnes`)
    expect(tabell!.finnes).toBeNull()
    const funksjoner = await kall.fasit<{ proname: string }>(
      `select proname from pg_proc where proname in
       ('skriv_regelsettkommentarer', 'les_regelsettkommentarer', 'krev_brukte_kommentarer')`,
    )
    expect(funksjoner).toEqual([])
  })

  it('stopper uten å endre noe når et regelsett har endringer som ikke er publisert', async () => {
    const { db, admin } = await forOmleggingen()
    const annet = faginnholdskall(db, admin)
    const [forste] = await annet.fasit<{ id: string; innhold: Record<string, unknown> }>(
      `select s.objekt_id as id, intern.les_intervallregelsett(s.objekt_id, 'utkast') as innhold
       from public.intervallregelsett s where s.tilstand = 'utkast' order by s.analyttkode limit 1`,
    )
    await annet.rpc(admin, 'lagre_utkast', { objekt: forste!.id, forventet_revisjon: 1, innhold: { ...forste!.innhold, desimaler: 1 } })
    const feil = await feilFra(() => kjorMigrasjoner(db, { fra: OMLEGGING }))
    expect(feil?.message).toMatch(/endringer som ikke er publisert/)
  }, 60_000)

  it('gjør ingenting i en ny, tom database', async () => {
    const tom = await nyDatabase()
    const [antall] = (await tom.query<{ n: number }>('select count(*)::int as n from public.redigerbare_objekter')).rows
    expect(antall!.n).toBe(0)
  })
})
