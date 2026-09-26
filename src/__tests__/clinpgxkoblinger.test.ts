/**
 * Koblingene mellom stoffsider og kjemikaliene i ClinPGx
 * (`src/faginnhold/clinpgxkoblinger.ts`): at hver side får den ClinPGx-ID-en
 * som er kontrollert, at grunnlaget er navnet og minst ett uavhengig kjennetegn
 * til og aldri navnet alene, og at migrasjonene legger dem inn som kortet
 * redigeringen lager: via virkestoffet siden er koblet til i FEST når
 * koblingen har et, ellers uten, uten å røre en kobling redaksjonen alt har
 * laget, og uten å gjøre noe når de kjøres igjen. FEST-radene er syntetiske,
 * med ID-ene fra FEST. Dekningen for alle sidene testes i
 * `clinpgxdekning.test.ts`.
 */
import type { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { beforeAll, describe, expect, it } from 'vitest'
import { FARMAKOGENETIKKPANEL } from '../clinpgx/stoffside'
import { UKOBLEDE_STOFFSIDER } from '../faginnhold/clinpgxdekning'
import {
  ALLE_CLINPGXKOBLINGER,
  CLINPGXKOBLINGSIMPORTER,
  CLINPGXKOBLINGSKILDE,
  clinpgxkoblingSql,
  kjennetegn,
} from '../faginnhold/clinpgxkoblinger'
import { AMFETAMIN_FESTKOBLINGER, STOFFSIDE_FESTKOBLINGER } from '../faginnhold/festkoblinger'
import { lagFaginnholdsleser, type Faginnholdsleser } from '../faginnhold/lesing'
import { ELEMENTTYPER, lesClinpgxkobling } from '../faginnhold/paneler'
import { PREPARATPANEL } from '../legemiddeldata/stoffside'
import {
  faginnholdskall,
  kjorMigrasjoner,
  migrasjonsfiler,
  nyDatabase,
  opprettBruker,
  type Faginnholdskall,
} from './hjelp/testdatabase'

const MIGRASJONER = migrasjonsfiler()
const migrasjonsfil = (migrasjon: string) => MIGRASJONER.find((f) => f.endsWith(`_${migrasjon}.sql`))!
const KOBLINGER = CLINPGXKOBLINGSIMPORTER.map((i) => migrasjonsfil(i.migrasjon))
/** Den første migrasjonen som lager sider det kobles til (amfetaminsiden). */
const FORSTE_SIDE = MIGRASJONER.find((f) => /_tdm_referanseomrader_\d+\.sql$/.test(f))!
const MIGRASJONSMAPPE = new URL('../../supabase/migrations/', import.meta.url)

/**
 * Fasiten: ClinPGx-ID-ene hver stoffside skal få, i rekkefølge, slik de er
 * kontrollert mot ClinPGx. Står her for seg, så en endring i listen må gjøres
 * med vilje begge steder.
 */
const FORVENTET: Record<string, string[]> = {
  Amfetamin: ['PA449269', 'PA164748975'],
  Amisulprid: ['PA162565877'],
  Amitriptylin: ['PA448385'],
  Aripiprazol: ['PA10026'],
  Atomoksetin: ['PA134688071'],
  Brekspiprazol: ['PA166160053'],
  Citalopram: ['PA449015'],
  Doksepin: ['PA449409'],
  Duloksetin: ['PA10066'],
  Escitalopram: ['PA10074'],
  Fenobarbital: ['PA450911'],
  Fenytoin: ['PA450947'],
  Flunitrazepam: ['PA164781320'],
  Fluoksetin: ['PA449673'],
  Flupentiksol: ['PA10268'],
  Fluvoksamin: ['PA449690'],
  Haloperidol: ['PA449841'],
  Hydroksyrisperidon: ['PA163518919'],
  Karbamazepin: ['PA448785'],
  Kariprazin: ['PA166177476'],
  Klomipramin: ['PA449048'],
  Klorprotiksen: ['PA164781400'],
  Klozapin: ['PA449061'],
  Kvetiapin: ['PA451201'],
  Lamotrigin: ['PA450164'],
  Levetiracetam: ['PA450206'],
  Litium: ['PA450243'],
  Lurasidon: ['PA166129557'],
  Metylfenidat: ['PA450464'],
  Mianserin: ['PA134687937'],
  Mirtazapin: ['PA450522'],
  Nortriptylin: ['PA450657'],
  Okskarbazepin: ['PA450732'],
  Olanzapin: ['PA450688'],
  'Paliperidon (hydroksyrisperidon)': ['PA163518919'],
  Paroksetin: ['PA450801'],
  Perfenazin: ['PA450882'],
  Petidin: ['PA450369'],
  Risperidon: ['PA451257'],
  Sertindol: ['PA164784002'],
  Sertralin: ['PA451333'],
  Topiramat: ['PA451728'],
  Trimipramin: ['PA451791'],
  Valproat: ['PA451846'],
  Venlafaksin: ['PA451866'],
  Vortioksetin: ['PA166122595'],
  Ziprasidon: ['PA451974'],
  Zuklopentiksol: ['PA452629'],
  // Koblet da dekningen ble gjennomgått: navnet stemte alene i første runde.
  Gabapentin: ['PA449720'],
  Ketobemidon: ['PA166211241'],
  Levomepromazin: ['PA164743234'],
  'O-desmetylvenlafaksin': ['PA165958374'],
  // Uten FEST-kobling.
  Alprazolam: ['PA448333'],
  Buprenorfin: ['PA448685'],
  Diazepam: ['PA449283'],
  Fentanyl: ['PA449599'],
  Klonazepam: ['PA449050'],
  Kodein: ['PA449088'],
  Metadon: ['PA450401'],
  Morfin: ['PA450550'],
  Nitrazepam: ['PA10242'],
  Oksazepam: ['PA450731'],
  Oksykodon: ['PA450741'],
  Tramadol: ['PA451735'],
  Zolpidem: ['PA451976'],
  Zopiklon: ['PA10236'],
}
/** Sidene som står ukoblet. */
const UKOBLET = UKOBLEDE_STOFFSIDER.map((u) => u.side)

/** ClinPGx-ID-ene per side i en liste av koblinger, i rekkefølge. */
function perSide(koblinger: readonly { side: string; clinpgx_id: string }[]): Record<string, string[]> {
  const sider: Record<string, string[]> = {}
  for (const k of koblinger) (sider[k.side] ??= []).push(k.clinpgx_id)
  return sider
}

describe('koblingene', () => {
  it('gir hver stoffside den kontrollerte ClinPGx-ID-en', () => {
    expect(perSide(ALLE_CLINPGXKOBLINGER)).toEqual(FORVENTET)
  })

  it('bygger hver kobling på navnet og minst ett uavhengig kjennetegn til, aldri navnet alene', () => {
    for (const k of ALLE_CLINPGXKOBLINGER) {
      expect(kjennetegn(k).length, k.side).toBeGreaterThan(0)
      if (k.atc !== null) expect(k.atc, k.side).toMatch(/^[A-Z]\d\d[A-Z]{2}\d\d$/)
      if (k.atc_clinpgx !== undefined) {
        // En annen ATC-kode i ClinPGx er bare godtatt når den er forklart.
        expect(k.atc_clinpgx, k.side).toMatch(/^[A-Z]\d\d[A-Z]{2}\d\d$/)
        expect(k.atc_clinpgx, k.side).not.toBe(k.atc)
        expect(k.merknad?.trim(), k.side).toBeTruthy()
      }
      const { rxnorm, pubchem, chebi } = k.identifikatorer ?? {}
      if (rxnorm !== undefined) expect(rxnorm, k.side).toMatch(/^\d+$/)
      if (pubchem !== undefined) expect(pubchem, k.side).toMatch(/^\d+$/)
      if (chebi !== undefined) expect(chebi, k.side).toMatch(/^CHEBI:\d+$/)
      // Uten FEST-kobling er ATC-koden fra et virkestoff siden ikke er koblet til, så det må være et kjennetegn til.
      if (k.fest_id === null) expect(Object.keys(k.identifikatorer ?? {}).length, k.side).toBeGreaterThan(0)
      else expect(k.fest_id, k.side).toMatch(/^ID_[0-9A-F-]{36}$/)
      // Uten ATC-kode må det være to identifikatorer i andre registre.
      if (k.atc === null) expect(Object.keys(k.identifikatorer ?? {}).length, k.side).toBeGreaterThan(1)
      expect(k.clinpgx_id, k.side).toMatch(/^PA\d+$/)
      if (k.samsvar === 'navn') expect(k.navn, k.side).toBe(k.engelsk.toLowerCase())
      else expect(k.navn, k.side).not.toBe(k.engelsk.toLowerCase())
      if (k.samsvar === 'skrivemåte') expect(k.merknad?.trim(), k.side).toBeTruthy()
    }
  })

  it('kobler ingen av sidene som står ukoblet', () => {
    const koblet = new Set(ALLE_CLINPGXKOBLINGER.map((k) => k.side))
    for (const side of UKOBLET) expect(koblet.has(side), side).toBe(false)
  })

  it('går via det samme virkestoffet som FEST-koblingen siden fikk ved migrasjon', () => {
    const fest = new Map<string, Set<string>>()
    for (const k of [...STOFFSIDE_FESTKOBLINGER, ...AMFETAMIN_FESTKOBLINGER]) {
      fest.set(k.side, (fest.get(k.side) ?? new Set()).add(k.fest_id))
    }
    for (const k of ALLE_CLINPGXKOBLINGER) {
      const virkestoff = fest.get(k.side)
      if (virkestoff) expect(virkestoff.has(k.fest_id ?? ''), k.side).toBe(true)
    }
  })

  it('kobler aldri samme side til samme kjemikalie to ganger', () => {
    const alle = CLINPGXKOBLINGSIMPORTER.flatMap((i) => i.koblinger.map((k) => `${k.side}|${k.clinpgx_id}`))
    expect(new Set(alle).size).toBe(alle.length)
  })

  it('er de samme migrasjonene som koblingene gir', () => {
    for (const [i, { migrasjon, koblinger }] of CLINPGXKOBLINGSIMPORTER.entries()) {
      const tekst = readFileSync(new URL(KOBLINGER[i]!, MIGRASJONSMAPPE), 'utf8')
      expect(tekst, migrasjon).toBe(clinpgxkoblingSql(koblinger, 'peohol'))
    }
  })

})

describe('migrasjonen i databasen', () => {
  let db: PGlite
  let kall: Faginnholdskall
  let leser: Faginnholdsleser
  let redaktor: Faginnholdsleser
  let revisjoner: number

  /** Har ingen FEST-kobling når ClinPGx-koblingen kjøres. */
  const UTEN_FEST = 'Mirtazapin'
  /** Har alt en ClinPGx-kobling redaksjonen har laget, bare som utkast. */
  const REDIGERT = 'Sertralin'
  const REDIGERT_DATA = { kjemikalier: [{ clinpgx_id: 'PA1', navn: 'redaksjonens valg' }] }
  /** Har bare det ene av sine to virkestoff koblet i FEST. */
  const DELVIS = 'Amfetamin'

  const antall = async (sql: string) => (await db.query<{ n: number }>(sql)).rows[0]!.n
  const sideId = async (navn: string) =>
    (
      await db.query<{ id: string }>(
        "select objekt_id as id from public.infosider where tilstand = 'publisert' and navn = $1",
        [navn],
      )
    ).rows[0]?.id
  const koblingen = async (side: string) => {
    const s = await leser.lesStoffside(side, 'publisert')
    return s.elementer.filter((e) => e.innhold.elementtype === ELEMENTTYPER.clinpgxkobling)
  }
  /** Sidene i databasen som har en publisert FEST-kobling. */
  let festkoblet: string[]
  /** De publiserte sidene uten FEST-kobling. */
  let utenFest: string[]

  beforeAll(async () => {
    db = await nyDatabase({ til: FORSTE_SIDE })
    const admin = await opprettBruker(db, { brukernavn: 'peohol', fornavn: 'Rita', etternavn: 'Redaktør', rolle: 'admin' })
    const bruker = await opprettBruker(db, { brukernavn: 'leser', fornavn: 'Lars', etternavn: 'Leser', rolle: 'user' })
    kall = faginnholdskall(db, admin)
    const synk = (
      await db.query<{ id: number }>(
        "insert into legemiddeldata.synkroniseringer (kilde, status, avsluttet_kl) values ('FEST', 'fullfort', now()) returning id",
      )
    ).rows[0]!.id
    const virkestoff = new Map(
      ALLE_CLINPGXKOBLINGER.flatMap((k) => (k.fest_id ? [[k.fest_id, k.virkestoff] as const] : [])),
    )
    for (const [fest_id, navn] of virkestoff) {
      await db.query(
        `insert into legemiddeldata.virkestoff (fest_id, data, hash, forst_sett_kl, sist_endret_kl, sist_sett_synk)
         values ($1, $2, 'x', now(), now(), $3)`,
        [fest_id, { navn, salter: [] }, synk],
      )
    }
    await kjorMigrasjoner(db, { fra: FORSTE_SIDE, til: KOBLINGER[0] })

    // Sidene med analyttkode kobles til FEST i redigeringen, som i produksjonen.
    const allerede = new Set(
      (
        await db.query<{ navn: string }>(
          `select i.navn from public.infosider i join public.innholdselementer e on e.infoside_id = i.objekt_id
           where i.tilstand = 'publisert' and e.tilstand = 'publisert' and e.elementtype = $1`,
          [ELEMENTTYPER.legemiddelkobling],
        )
      ).rows.map((r) => r.navn),
    )
    for (const side of Object.keys(FORVENTET)) {
      const koblinger = ALLE_CLINPGXKOBLINGER.filter((k) => k.side === side && k.fest_id !== null)
      const id = await sideId(side)
      if (!id || allerede.has(side) || side === UTEN_FEST || !koblinger.length) continue
      const kobling = await kall.opprett('innholdselement', {
        infoside: id,
        panel: PREPARATPANEL,
        posisjon: 0,
        elementtype: ELEMENTTYPER.legemiddelkobling,
        data: { virkestoff: koblinger.map((k) => ({ fest_id: k.fest_id, navn: k.virkestoff })) },
      })
      await kall.publiser(kobling.id, kobling.revisjon!)
    }
    await kall.opprett('innholdselement', {
      infoside: (await sideId(REDIGERT))!,
      panel: FARMAKOGENETIKKPANEL,
      posisjon: 0,
      elementtype: ELEMENTTYPER.clinpgxkobling,
      data: REDIGERT_DATA,
    })
    // Deksamfetamin er ikke lenger på amfetaminsidens FEST-kobling.
    redaktor = lagFaginnholdsleser(kall.klientFor(admin))
    const [amfetamin] = (await redaktor.lesStoffside(DELVIS, 'utkast')).elementer.filter(
      (e) => e.innhold.elementtype === ELEMENTTYPER.legemiddelkobling,
    )
    const lagret = await kall.lagre(amfetamin!.id, amfetamin!.revisjon, {
      ...amfetamin!.innhold,
      data: { virkestoff: [{ fest_id: AMFETAMIN_FESTKOBLINGER[1]!.fest_id, navn: 'Lisdeksamfetamin' }] },
    })
    await kall.publiser(amfetamin!.id, lagret.revisjon!)

    festkoblet = (
      await db.query<{ navn: string }>(
        `select distinct i.navn from public.infosider i join public.innholdselementer e on e.infoside_id = i.objekt_id
         where i.tilstand = 'publisert' and e.tilstand = 'publisert' and e.elementtype = $1 and e.panel <> 'fjernet'`,
        [ELEMENTTYPER.legemiddelkobling],
      )
    ).rows.map((r) => r.navn)
    const publiserte = (
      await db.query<{ navn: string }>("select navn from public.infosider where tilstand = 'publisert'")
    ).rows.map((r) => r.navn)
    utenFest = publiserte.filter((s) => !festkoblet.includes(s))

    await kjorMigrasjoner(db, { fra: KOBLINGER[0] })
    leser = lagFaginnholdsleser(kall.klientFor(bruker))
    revisjoner = await antall('select count(*)::int as n from public.objektrevisjoner')
  }, 240_000)

  it('har sidene å koble til i testdatabasen, med og uten FEST-kobling', () => {
    expect(festkoblet.length).toBeGreaterThan(30)
    expect(utenFest.length).toBeGreaterThan(10)
  })

  it('kobler hver side publisert, med den kontrollerte ClinPGx-ID-en, i «Farmakogenetikk»', async () => {
    const sider = [...festkoblet, ...utenFest].filter((s) => s in FORVENTET && ![REDIGERT, DELVIS, UTEN_FEST].includes(s))
    for (const side of sider) {
      const [kobling, ...flere] = await koblingen(side)
      expect(flere, side).toEqual([])
      expect(kobling!.innhold.panel, side).toBe(FARMAKOGENETIKKPANEL)
      expect(kobling!.kilde, side).toBe(CLINPGXKOBLINGSKILDE)
      expect(lesClinpgxkobling(kobling!.innhold.data).kjemikalier.map((k) => k.clinpgx_id), side).toEqual(FORVENTET[side])
      expect(kobling!.innhold.data, side).toEqual({
        kjemikalier: ALLE_CLINPGXKOBLINGER.filter((k) => k.side === side).map((k) => ({
          clinpgx_id: k.clinpgx_id,
          navn: k.navn,
        })),
      })
    }
    // Testdatabasen har ikke alle sidene, men de fleste, og alle sidene uten FEST-kobling.
    expect(sider.length).toBeGreaterThan(50)
    expect(sider).toEqual(expect.arrayContaining(ALLE_CLINPGXKOBLINGER.filter((k) => k.fest_id === null).map((k) => k.side)))
  })

  it('tar bare med kjemikaliene for virkestoffene siden er koblet til i FEST', async () => {
    const [kobling] = await koblingen(DELVIS)
    expect(lesClinpgxkobling(kobling!.innhold.data)).toEqual({
      kjemikalier: [{ clinpgx_id: 'PA164748975', navn: 'lisdexamfetamine' }],
    })
  })

  it('lar en side uten koblingens FEST-virkestoff og sidene som ikke skal kobles, stå ukoblet', async () => {
    expect(await koblingen(UTEN_FEST)).toEqual([])
    for (const side of UKOBLET) expect(await koblingen(side), side).toEqual([])
  })

  it('rører ikke en kobling redaksjonen alt har laget', async () => {
    expect(await koblingen(REDIGERT)).toEqual([])
    const utkast = await redaktor.lesStoffside(REDIGERT, 'utkast')
    const kobling = utkast.elementer.filter((e) => e.innhold.elementtype === ELEMENTTYPER.clinpgxkobling)
    expect(kobling.map((e) => e.innhold.data)).toEqual([REDIGERT_DATA])
  })

  it('gjør ingenting når den kjøres en gang til', async () => {
    await kjorMigrasjoner(db, { bare: KOBLINGER })
    expect(await antall('select count(*)::int as n from public.objektrevisjoner')).toBe(revisjoner)
  })
})
