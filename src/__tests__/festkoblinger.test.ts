/**
 * Koblingene mellom stoffsidene uten analyttkode og virkestoffene i FEST
 * (`src/faginnhold/festkoblinger.ts`): at hver side har én, og at migrasjonen
 * legger dem inn som kortet redigeringen lager, hopper over det den ikke kan
 * koble, og ikke gjør noe når den kjøres igjen. FEST-radene er syntetiske,
 * med ID-ene og navnene fra FEST.
 */
import type { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { beforeAll, describe, expect, it } from 'vitest'
import { FESTKOBLINGSKILDE, festkoblingSql, STOFFSIDE_FESTKOBLINGER } from '../faginnhold/festkoblinger'
import { lagFaginnholdsleser, type Faginnholdsleser } from '../faginnhold/lesing'
import { ELEMENTTYPER, lesLegemiddelkobling } from '../faginnhold/paneler'
import { stoffsideplan } from '../faginnhold/stoffsider'
import { PREPARATPANEL } from '../legemiddeldata/stoffside'
import { faginnholdskall, kjorMigrasjoner, migrasjonsfiler, nyDatabase, opprettBruker } from './hjelp/testdatabase'

const MIGRASJONER = migrasjonsfiler()
const KOBLING = MIGRASJONER.find((f) => f.endsWith('_stoffsider_fest_kobling.sql'))!
const FORSTE_STOFFSIDE = MIGRASJONER.find((f) => /_stoffsider_import_\d+\.sql$/.test(f))!
const MIGRASJONSMAPPE = new URL('../../supabase/migrations/', import.meta.url)

/** Navnene FEST gir virkestoffene. */
const FESTNAVN: Record<string, string> = {
  Atomoksetin: 'Atomoksetin',
  Fenobarbital: 'Fenobarbital',
  Fenytoin: 'Fenytoin',
  Flunitrazepam: 'Flunitrazepam',
  Gabapentin: 'Gabapentin',
  Karbamazepin: 'Karbamazepin',
  Ketobemidon: 'Ketobemidon',
  Levetiracetam: 'Levetiracetam',
  Litium: 'Litiumion',
  Metylfenidat: 'Metylfenidat',
  Okskarbazepin: 'Okskarbazepin',
  Petidin: 'Petidin',
  Sertindol: 'Sertindol',
  Topiramat: 'Topiramat',
  Valproat: 'Valproinsyre',
}
/** Mangler i FEST-kopien i testen. */
const MANGLER = 'Fenytoin'
/** Er utgått i FEST-kopien i testen. */
const UTGATT = 'Gabapentin'

describe('koblingene', () => {
  it('kobler hver stoffside uten analyttkode til ett virkestoff, og ingen to til det samme', () => {
    const sider = stoffsideplan().koder.map((k) => k.hovedside.navn)
    expect(STOFFSIDE_FESTKOBLINGER.map((k) => k.side)).toEqual(sider)
    expect(new Set(STOFFSIDE_FESTKOBLINGER.map((k) => k.fest_id)).size).toBe(sider.length)
    for (const k of STOFFSIDE_FESTKOBLINGER) expect(k.fest_id, k.side).toMatch(/^ID_[0-9A-F-]{36}$/)
  })

  it('er den samme migrasjonen som koblingene gir', () => {
    expect(readFileSync(new URL(KOBLING, MIGRASJONSMAPPE), 'utf8')).toBe(festkoblingSql(STOFFSIDE_FESTKOBLINGER, 'peohol'))
  })
})

describe('migrasjonen i databasen', () => {
  let db: PGlite
  let leser: Faginnholdsleser
  let revisjoner: number

  const antall = async (sql: string) => (await db.query<{ n: number }>(sql)).rows[0]!.n
  const koblingen = async (side: string) => {
    const s = await leser.lesStoffside(side, 'publisert')
    return s.elementer.filter((e) => e.innhold.elementtype === ELEMENTTYPER.legemiddelkobling)
  }

  beforeAll(async () => {
    db = await nyDatabase({ til: FORSTE_STOFFSIDE })
    const admin = await opprettBruker(db, { brukernavn: 'peohol', fornavn: 'Rita', etternavn: 'Redaktør', rolle: 'admin' })
    const bruker = await opprettBruker(db, { brukernavn: 'leser', fornavn: 'Lars', etternavn: 'Leser', rolle: 'user' })
    const synk = (
      await db.query<{ id: number }>(
        "insert into legemiddeldata.synkroniseringer (kilde, status, avsluttet_kl) values ('FEST', 'fullfort', now()) returning id",
      )
    ).rows[0]!.id
    for (const k of STOFFSIDE_FESTKOBLINGER) {
      if (k.side === MANGLER) continue
      await db.query(
        `insert into legemiddeldata.virkestoff (fest_id, data, hash, forst_sett_kl, sist_endret_kl, sist_sett_synk, utgatt_kl)
         values ($1, $2, 'x', now(), now(), $3, $4)`,
        [k.fest_id, { navn: FESTNAVN[k.side], salter: [] }, synk, k.side === UTGATT ? new Date() : null],
      )
    }
    await kjorMigrasjoner(db, { fra: FORSTE_STOFFSIDE })
    leser = lagFaginnholdsleser(faginnholdskall(db, admin).klientFor(bruker))
    revisjoner = await antall('select count(*)::int as n from public.objektrevisjoner')
  }, 180_000)

  it('kobler sidene publisert, med FESTs ID og navn, i panelet «Preparater»', async () => {
    for (const k of STOFFSIDE_FESTKOBLINGER) {
      if (k.side === MANGLER || k.side === UTGATT) continue
      const [kobling, ...flere] = await koblingen(k.side)
      expect(flere, k.side).toEqual([])
      expect(kobling!.innhold.panel, k.side).toBe(PREPARATPANEL)
      expect(kobling!.kilde, k.side).toBe(FESTKOBLINGSKILDE)
      expect(lesLegemiddelkobling(kobling!.innhold.data), k.side).toEqual({
        virkestoff: [{ fest_id: k.fest_id, navn: FESTNAVN[k.side] }],
      })
    }
  })

  it('hopper over et virkestoff som mangler eller er utgått i FEST', async () => {
    expect(await koblingen(MANGLER)).toEqual([])
    expect(await koblingen(UTGATT)).toEqual([])
  })

  it('gjør ingenting når den kjøres en gang til', async () => {
    await kjorMigrasjoner(db, { bare: [KOBLING] })
    expect(await antall('select count(*)::int as n from public.objektrevisjoner')).toBe(revisjoner)
  })
})
