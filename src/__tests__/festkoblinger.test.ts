/**
 * Koblingene mellom stoffsider og virkestoffene i FEST
 * (`src/faginnhold/festkoblinger.ts`): at hver stoffside uten analyttkode har
 * én, at amfetaminsiden har deksamfetamin og lisdeksamfetamin, at THC-siden
 * har dronabinol, at cannabidiolsiden har cannabidiol, at rusmiddelsidene som
 * er legemidler har sine, og at
 * migrasjonene legger dem inn som kortet redigeringen lager, hopper over det
 * de ikke kan koble, og ikke gjør noe når de kjøres igjen. FEST-radene er
 * syntetiske, med ID-ene og navnene fra FEST.
 */
import type { PGlite } from '@electric-sql/pglite'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  AMFETAMIN_FESTKOBLINGER,
  CBD_FESTKOBLINGER,
  FESTKOBLINGSIMPORTER,
  FESTKOBLINGSKILDE,
  festkoblingSql,
  RUSMIDLER_FESTKOBLINGER,
  STOFFSIDE_FESTKOBLINGER,
  THC_FESTKOBLINGER,
} from '../faginnhold/festkoblinger'
import { lagFaginnholdsleser, type Faginnholdsleser } from '../faginnhold/lesing'
import { ELEMENTTYPER, lesLegemiddelkobling } from '../faginnhold/paneler'
import { stoffsideplan } from '../faginnhold/stoffsider'
import { PREPARATPANEL } from '../legemiddeldata/stoffside'
import { stoffslug } from '../domain/stoffregister'
import { faginnholdskall, kjorMigrasjoner, migrasjonsfiler, nyDatabase, opprettBruker } from './hjelp/testdatabase'

const MIGRASJONER = migrasjonsfiler()
const migrasjonsfil = (migrasjon: string) => MIGRASJONER.find((f) => f.endsWith(`_${migrasjon}.sql`))!
const KOBLINGER = FESTKOBLINGSIMPORTER.map((i) => migrasjonsfil(i.migrasjon))
/** Den første migrasjonen som lager sider det kobles til (amfetaminsiden). */
const FORSTE_SIDE = MIGRASJONER.find((f) => /_tdm_referanseomrader_\d+\.sql$/.test(f))!
/**
 * Migrasjonene som ble laget med en tidligere utgave av {@link festkoblingSql}
 * og står som de ble kjørt, med md5-en til teksten prosjektet registrerte.
 */
const KJORT_MED_TIDLIGERE_UTGAVE: Record<string, string> = {
  stoffsider_fest_kobling: '63acee3f8d90a16bb2c8f6661f60bd03',
}
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
/** Navnene FEST gir virkestoffene amfetaminsiden kobles til, i rekkefølge. */
const AMFETAMINNAVN = ['Deksamfetamin', 'Lisdeksamfetamin']
/** Rusmiddelkoblingene der FEST gir virkestoffet et annet navn enn siden. */
const RUSNAVN: Record<string, string> = {
  'ID_4FE84EA2-FC1B-44A6-8D70-2A118B211697': 'Bupropion',
  'ID_7A7394E3-2826-4CDE-8AB1-538BB8DB1AD5': 'Levometadon',
}
const rusnavn = (k: { side: string; fest_id: string }) => RUSNAVN[k.fest_id] ?? k.side
/**
 * Siden psykofarmakaimporten lager, før testen oppretter administratoren; den
 * finnes ikke i testdatabasen, så koblingen hoppes over.
 */
const UTEN_SIDE = 'Hydroksybupropion'
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

  it('kobler amfetaminsiden til deksamfetamin og lisdeksamfetamin, ikke racemisk amfetamin', () => {
    expect(AMFETAMIN_FESTKOBLINGER.map((k) => k.side)).toEqual(['Amfetamin', 'Amfetamin'])
    expect(AMFETAMIN_FESTKOBLINGER.map((k) => k.fest_id)).toEqual([
      'ID_94B3D11A-B6E3-4139-8F0E-8FE9B5B12D62',
      'ID_90176257-5082-40EB-9F18-687F7AC07352',
    ])
  })

  it('kobler THC-siden til dronabinol, som er THC i FEST, og ikke til cannabidiol', () => {
    expect(THC_FESTKOBLINGER.map((k) => [k.side, k.fest_id])).toEqual([['THC', 'ID_83377FF5-A0F5-4CB1-9BF3-0606A68958D7']])
  })

  it('kobler cannabidiolsiden til cannabidiol', () => {
    expect(CBD_FESTKOBLINGER.map((k) => [k.side, k.fest_id])).toEqual([['Cannabidiol', 'ID_FFF3536F-BE29-4191-A09A-ABC119C37984']])
  })

  it('kobler rusmiddelsidene som er legemidler, metadon også til levometadon og hydroksybupropion til bupropion', () => {
    const sider = [...new Set(RUSMIDLER_FESTKOBLINGER.map((k) => k.side))]
    expect(sider).toEqual([...sider].sort((a, b) => a.localeCompare(b, 'nb')))
    expect(sider).not.toContain('O-desmetyltramadol')
    expect(sider).not.toContain('N-desmetyldiazepam')
    expect(RUSMIDLER_FESTKOBLINGER.filter((k) => k.side === 'Metadon').map(rusnavn)).toEqual(['Metadon', 'Levometadon'])
    expect(RUSMIDLER_FESTKOBLINGER.filter((k) => k.side === 'Hydroksybupropion').map(rusnavn)).toEqual(['Bupropion'])
    for (const k of RUSMIDLER_FESTKOBLINGER) expect(k.fest_id, k.side).toMatch(/^ID_[0-9A-F-]{36}$/)
  })

  it('kobler aldri samme side til samme virkestoff to ganger', () => {
    const alle = FESTKOBLINGSIMPORTER.flatMap((i) => i.koblinger.map((k) => `${k.side}|${k.fest_id}`))
    expect(new Set(alle).size).toBe(alle.length)
  })

  it('er de samme migrasjonene som koblingene gir', () => {
    for (const [i, { migrasjon, koblinger }] of FESTKOBLINGSIMPORTER.entries()) {
      const tekst = readFileSync(new URL(KOBLINGER[i]!, MIGRASJONSMAPPE), 'utf8')
      const md5 = KJORT_MED_TIDLIGERE_UTGAVE[migrasjon]
      if (md5) expect(createHash('md5').update(tekst).digest('hex'), migrasjon).toBe(md5)
      else expect(tekst, migrasjon).toBe(festkoblingSql(koblinger, 'peohol'))
    }
  })
})

describe('migrasjonen i databasen', () => {
  let db: PGlite
  let leser: Faginnholdsleser
  let revisjoner: number

  const antall = async (sql: string) => (await db.query<{ n: number }>(sql)).rows[0]!.n
  /** Koblingene på siden med dette navnet, lest som appen gjør: etter nøkkelen navnet gir. */
  const koblingen = async (side: string) => {
    const s = await leser.lesStoffside(stoffslug(side), 'publisert')
    return s.elementer.filter((e) => e.innhold.elementtype === ELEMENTTYPER.legemiddelkobling)
  }

  beforeAll(async () => {
    db = await nyDatabase({ til: FORSTE_SIDE })
    const admin = await opprettBruker(db, { brukernavn: 'peohol', fornavn: 'Rita', etternavn: 'Redaktør', rolle: 'admin' })
    const bruker = await opprettBruker(db, { brukernavn: 'leser', fornavn: 'Lars', etternavn: 'Leser', rolle: 'user' })
    const synk = (
      await db.query<{ id: number }>(
        "insert into legemiddeldata.synkroniseringer (kilde, status, avsluttet_kl) values ('FEST', 'fullfort', now()) returning id",
      )
    ).rows[0]!.id
    const virkestoff = [
      ...STOFFSIDE_FESTKOBLINGER.filter((k) => k.side !== MANGLER).map((k) => [k.fest_id, FESTNAVN[k.side], k.side === UTGATT] as const),
      ...AMFETAMIN_FESTKOBLINGER.map((k, i) => [k.fest_id, AMFETAMINNAVN[i], false] as const),
      ...THC_FESTKOBLINGER.map((k) => [k.fest_id, 'Dronabinol', false] as const),
      ...CBD_FESTKOBLINGER.map((k) => [k.fest_id, 'Cannabidiol', false] as const),
      ...RUSMIDLER_FESTKOBLINGER.map((k) => [k.fest_id, rusnavn(k), false] as const),
    ]
    for (const [fest_id, navn, utgatt] of virkestoff) {
      await db.query(
        `insert into legemiddeldata.virkestoff (fest_id, data, hash, forst_sett_kl, sist_endret_kl, sist_sett_synk, utgatt_kl)
         values ($1, $2, 'x', now(), now(), $3, $4)`,
        [fest_id, { navn, salter: [] }, synk, utgatt ? new Date() : null],
      )
    }
    await kjorMigrasjoner(db, { fra: FORSTE_SIDE })
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

  it('kobler amfetaminsiden til begge virkestoffene på ett kort, og lar resten av siden stå', async () => {
    const [kobling, ...flere] = await koblingen('Amfetamin')
    expect(flere).toEqual([])
    expect(kobling!.innhold.panel).toBe(PREPARATPANEL)
    expect(kobling!.kilde).toBe(FESTKOBLINGSKILDE)
    expect(lesLegemiddelkobling(kobling!.innhold.data)).toEqual({
      virkestoff: AMFETAMIN_FESTKOBLINGER.map((k, i) => ({ fest_id: k.fest_id, navn: AMFETAMINNAVN[i] })),
    })
    const side = await leser.lesStoffside('amfetamin', 'publisert')
    expect(side.stoff).toMatchObject({ slug: 'amfetamin', navn: 'Amfetamin' })
    expect(side.elementer.some((e) => e.innhold.panel === 'tdm')).toBe(true)
  })

  it('kobler THC-siden, som indikasjonsimporten lager, til dronabinol', async () => {
    const [kobling, ...flere] = await koblingen('THC')
    expect(flere).toEqual([])
    expect(kobling!.innhold.panel).toBe(PREPARATPANEL)
    expect(lesLegemiddelkobling(kobling!.innhold.data)).toEqual({
      virkestoff: [{ fest_id: THC_FESTKOBLINGER[0]!.fest_id, navn: 'Dronabinol' }],
    })
    const side = await leser.lesStoffside('thc', 'publisert')
    expect(side.stoff).toMatchObject({ slug: 'thc', navn: 'THC' })
    expect(side.elementer.map((e) => e.innhold.panel).sort()).toEqual(['indikasjon', PREPARATPANEL].sort())
  })

  it('kobler cannabidiolsiden, som indikasjonsimporten lager og som nå heter CBD, til cannabidiol', async () => {
    const [kobling, ...flere] = await koblingen('CBD')
    expect(flere).toEqual([])
    expect(kobling!.innhold.panel).toBe(PREPARATPANEL)
    expect(lesLegemiddelkobling(kobling!.innhold.data)).toEqual({
      virkestoff: [{ fest_id: CBD_FESTKOBLINGER[0]!.fest_id, navn: 'Cannabidiol' }],
    })
  })

  it('kobler rusmiddelsidene, også tapentadolsiden som indikasjonsimporten lager, med ett kort per side', async () => {
    for (const side of new Set(RUSMIDLER_FESTKOBLINGER.map((k) => k.side))) {
      if (side === UTEN_SIDE) continue
      const [kobling, ...flere] = await koblingen(side)
      expect(flere, side).toEqual([])
      expect(kobling!.innhold.panel, side).toBe(PREPARATPANEL)
      expect(lesLegemiddelkobling(kobling!.innhold.data), side).toEqual({
        virkestoff: RUSMIDLER_FESTKOBLINGER.filter((k) => k.side === side).map((k) => ({ fest_id: k.fest_id, navn: rusnavn(k) })),
      })
    }
  })

  it('hopper over et virkestoff som mangler eller er utgått i FEST, og en side som ikke finnes', async () => {
    expect(await koblingen(MANGLER)).toEqual([])
    expect(await koblingen(UTGATT)).toEqual([])
    expect(await koblingen(UTEN_SIDE)).toEqual([])
  })

  it('gjør ingenting når den kjøres en gang til', async () => {
    await kjorMigrasjoner(db, { bare: KOBLINGER })
    expect(await antall('select count(*)::int as n from public.objektrevisjoner')).toBe(revisjoner)
  })
})
