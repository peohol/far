/**
 * Indikasjonene hentet fra Felleskatalogen (`supabase/import/indikasjoner/`),
 * for stoffsidene uten analyttkode og for amfetaminsiden: datasettet, og
 * migrasjonene kjørt på sidene som finnes, lest slik appen leser dem.
 */
import type { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { beforeAll, describe, expect, it } from 'vitest'
import { filnokkel, importmigrasjoner } from '../faginnhold/import'
import { INDIKASJONSDATASETT, INDIKASJONSIMPORTER, indikasjonskilde, indikasjonsplan, NYE_STOFFSIDER } from '../faginnhold/indikasjoner'
import { lagFaginnholdsleser, type Faginnholdsleser } from '../faginnhold/lesing'
import { ELEMENTTYPER, lesRiktekst } from '../faginnhold/paneler'
import { klartekst } from '../faginnhold/riktekst'
import { stoffsideplan } from '../faginnhold/stoffsider'
import { faginnholdskall, kjorMigrasjoner, migrasjonsfiler, nyDatabase, opprettBruker } from './hjelp/testdatabase'

/** Kilden revisjonene får, med datoen omgangen ble hentet. */
const fkkilde = (hentet: string) => `Hentet fra Felleskatalogen ${hentet.split('-').reverse().join('.')}`
const omgang = (migrasjon: string) => INDIKASJONSIMPORTER.find((i) => i.migrasjon === migrasjon)!
const plan = indikasjonsplan(omgang('stoffsider_indikasjoner'))
const amfetamin = indikasjonsplan(omgang('amfetamin_indikasjoner'))
const nye = indikasjonsplan(omgang('ghb_ketamin_indikasjoner'))
const PLANER = INDIKASJONSIMPORTER.map((i) => ({ migrasjon: i.migrasjon, plan: indikasjonsplan(i), kilde: fkkilde(i.hentet) }))
const migrasjonene = (migrasjon: string) => migrasjonsfiler().filter((f) => new RegExp(`_${migrasjon}_\\d+\\.sql$`).test(f))
const MIGRASJONER = PLANER.flatMap((p) => migrasjonene(p.migrasjon))
/** Den første migrasjonen som lager sider indikasjonene legges på (amfetaminsiden). */
const FORSTE_SIDE = migrasjonsfiler().find((f) => /_tdm_referanseomrader_\d+\.sql$/.test(f))!
const MIGRASJONSMAPPE = new URL('../../supabase/migrations/', import.meta.url)
const FK_KILDE = fkkilde('2026-09-25')
/** Stoffene Felleskatalogen ikke har noen preparatomtale for. */
const UTEN_OMTALE = ['Flunitrazepam', 'Ketobemidon']

const tekst = (navn: string, p = plan) =>
  klartekst(lesRiktekst(p.koder.find((k) => k.hovedside.navn === navn)!.elementer[0]!.data).dokument)

describe('datasettet', () => {
  it('legger hver fil inn i nøyaktig én omgang', () => {
    const iOmganger = INDIKASJONSIMPORTER.flatMap((i) => i.filer)
    expect([...iOmganger].sort()).toEqual(INDIKASJONSDATASETT.filer.map(filnokkel).sort())
    expect(new Set(iOmganger).size).toBe(iOmganger.length)
  })

  it('har ett indikasjonskort, og ikke noe annet, for hver stoffside uten analyttkode', () => {
    expect(plan.koder.map((k) => k.hovedside.navn)).toEqual(stoffsideplan().koder.map((k) => k.hovedside.navn))
    for (const k of plan.koder) {
      expect(k.kode, k.hovedside.navn).toBeNull()
      expect(k.elementer.map((e) => [e.panel, e.elementtype]), k.hovedside.navn).toEqual([['indikasjon', ELEMENTTYPER.riktekst]])
      expect(k.elementer[0]!.kilde, k.hovedside.navn).toBe(FK_KILDE)
    }
  })

  it('siterer preparatomtalene i Felleskatalogen, og sier fra der det ikke finnes noen', () => {
    for (const { plan: p, kilde } of PLANER) {
      for (const r of p.referanser) {
        expect(r.nokkel).toMatch(/^fk-/)
        expect(r.kilde, r.nokkel).toBe(kilde)
        expect(r.innhold).toMatchObject({ forfattere: 'Felleskatalogen', lenke: expect.stringMatching(/^https:\/\/www\.felleskatalogen\.no\/medisin\/[a-z0-9-]+-\d{6}$/) })
      }
    }
    for (const k of plan.koder) {
      const navn = k.hovedside.navn
      if (UTEN_OMTALE.includes(navn)) {
        expect(k.elementer[0]!.referanser, navn).toEqual([])
        expect(tekst(navn), navn).toBe(`Felleskatalogen har ingen preparatomtale for ${navn.toLocaleLowerCase('nb')}.`)
      } else {
        expect(k.elementer[0]!.referanser.length, navn).toBeGreaterThan(0)
      }
    }
    expect(Object.keys(INDIKASJONSDATASETT.referanser)).toEqual([])
  })

  it('har aldersgrensene og forbeholdene fra preparatomtalene', () => {
    expect(tekst('Gabapentin')).toContain('Voksne og barn ≥6 år: tilleggsbehandling')
    expect(tekst('Gabapentin')).toContain('Voksne og ungdom ≥12 år: monoterapi')
    expect(tekst('Levetiracetam')).toContain('Voksne og ungdom >16 år med nylig diagnostisert epilepsi: monoterapi')
    expect(tekst('Levetiracetam')).toContain('spedbarn >1 måned')
    expect(tekst('Levetiracetam')).toContain('barn >4 år')
    expect(tekst('Topiramat')).toContain('Voksne, ungdom og barn >6 år: monoterapi')
    expect(tekst('Topiramat')).toContain('Voksne, ungdom og barn ≥2 år: tilleggsbehandling')
    expect(tekst('Okskarbazepin')).toContain('voksne og barn >6 år')
    expect(tekst('Fenytoin')).toMatch(/^Felleskatalogen har ingen preparatomtale for fenytoin\./)
    expect(tekst('Fenytoin')).toContain('fosfenytoin, et prodrug som omdannes til fenytoin')
    expect(tekst('Litium')).toContain('Carblit (voksne ≥18 år)')
    expect(tekst('Valproat')).toContain('når litium er kontraindisert eller ikke tolereres')
    expect(tekst('Sertindol')).toContain('intolerante overfor minst ett annet antipsykotisk legemiddel')
    expect(tekst('Metylfenidat')).toContain('Tuzulby (6–17 år)')
  })

  it('legger indikasjonene for deksamfetamin og lisdeksamfetamin på amfetaminsiden', () => {
    const [k, ...flere] = amfetamin.koder
    expect(flere).toEqual([])
    expect(k!.kode).toBe('AMF1')
    expect(k!.hovedside.navn).toBe('Amfetamin')
    expect(k!.elementer.map((e) => [e.panel, e.elementtype, e.kilde])).toEqual([['indikasjon', ELEMENTTYPER.riktekst, FK_KILDE]])
    const t = tekst('Amfetamin', amfetamin)
    expect(t).toContain('Deksamfetamin (Attentin, Dexatin, Dexfarm): barn og ungdom 6–17 år med ADHD')
    expect(t).toContain('Elvanse, Balidax og Dexhility: barn ≥6 år')
    expect(t).toContain('Silarosa: bare barn ≥6 år')
    expect(t).toContain('Aduvanz og Volidax: bare voksne.')
    expect(k!.elementer[0]!.referanser).toEqual([
      'fk-attentin', 'fk-dexatin', 'fk-dexfarm', 'fk-elvanse', 'fk-balidax', 'fk-dexhility', 'fk-silarosa', 'fk-aduvanz', 'fk-volidax',
    ])
  })

  it('lager GHB- og ketaminsidene med indikasjonene for natriumoksybat, racemisk ketamin og esketamin', () => {
    expect(nye.koder.map((k) => [k.kode, k.hovedside.navn])).toEqual(NYE_STOFFSIDER.map((navn) => [null, navn]))
    for (const k of nye.koder) {
      expect(k.elementer.map((e) => [e.panel, e.elementtype, e.kilde]), k.hovedside.navn).toEqual([
        ['indikasjon', ELEMENTTYPER.riktekst, fkkilde('2026-09-27')],
      ])
    }
    expect(indikasjonskilde(omgang('ghb_ketamin_indikasjoner')).felleskatalogen).toBe('2026-09-27')
    const ghb = tekst('GHB', nye)
    expect(ghb).toContain('det samme stoffet som natriumoksybat')
    expect(ghb).toContain('narkolepsi med katapleksi')
    expect(ghb).toContain('Xyrem og Oxiore: voksne, ungdom og barn ≥7 år.')
    const ketamin = tekst('Ketamin', nye)
    expect(ketamin).toContain('Racemisk ketamin (Ketalar, Ketamin Abcur)')
    expect(ketamin).toContain('Esketamin som injeksjon (Ketanest)')
    expect(ketamin).toContain('Esketamin som nesespray (Spravato)')
    expect(ketamin).toContain('behandlingsresistent depresjon')
    expect(nye.koder.find((k) => k.hovedside.navn === 'Ketamin')!.elementer[0]!.referanser).toEqual([
      'fk-ketalar', 'fk-ketamin-abcur', 'fk-ketanest', 'fk-spravato',
    ])
  })

  it('er de samme migrasjonene som datasettet gir', () => {
    for (const p of PLANER) {
      const filer = importmigrasjoner(p.plan, 'peohol', 55_000, 'utvid')
      const kjorte = migrasjonene(p.migrasjon)
      expect(kjorte, p.migrasjon).toHaveLength(filer.length)
      kjorte.forEach((fil, i) => expect(readFileSync(new URL(fil, MIGRASJONSMAPPE), 'utf8'), fil).toBe(filer[i]))
    }
  })
})

describe('migrasjonene i databasen', () => {
  let db: PGlite
  let leser: Faginnholdsleser
  let revisjoner: number
  let sider: number
  const elementerFor = new Map<string, number>()

  const antall = async (sql: string) => (await db.query<{ n: number }>(sql)).rows[0]!.n
  const utkast = () => antall("select count(*)::int as n from public.infosider where tilstand = 'utkast'")

  beforeAll(async () => {
    db = await nyDatabase({ til: FORSTE_SIDE })
    const admin = await opprettBruker(db, { brukernavn: 'peohol', fornavn: 'Rita', etternavn: 'Redaktør', rolle: 'admin' })
    const bruker = await opprettBruker(db, { brukernavn: 'leser', fornavn: 'Lars', etternavn: 'Leser', rolle: 'user' })
    await kjorMigrasjoner(db, { fra: FORSTE_SIDE, til: MIGRASJONER[0] })
    leser = lagFaginnholdsleser(faginnholdskall(db, admin).klientFor(bruker))
    for (const k of PLANER.flatMap((p) => p.plan.koder)) {
      elementerFor.set(k.hovedside.navn, (await leser.lesStoffside(k.hovedside.navn, 'publisert')).elementer.length)
    }
    sider = await utkast()
    // Bare indikasjonene, så senere migrasjoner som legger til kort, ikke telles med.
    await kjorMigrasjoner(db, { bare: MIGRASJONER })
    revisjoner = await antall('select count(*)::int as n from public.objektrevisjoner')
  }, 180_000)

  it('legger indikasjonen publisert på sidene, med kildene, og lar resten av siden stå', async () => {
    for (const { plan: p, kilde } of PLANER) {
      for (const k of p.koder) {
        const navn = k.hovedside.navn
        const side = await leser.lesStoffside(navn, 'publisert')
        const [indikasjon, ...flere] = side.elementer.filter((e) => e.innhold.panel === 'indikasjon')
        expect(flere, navn).toEqual([])
        expect(indikasjon!.innhold.data, navn).toEqual(k.elementer[0]!.data)
        expect(indikasjon!.kilde, navn).toBe(kilde)
        const titler = (indikasjon!.innhold.referanser ?? []).map((id) => side.referanser.find((r) => r.id === id)!.innhold.tittel)
        expect(titler, navn).toEqual(k.elementer[0]!.referanser.map((n) => p.referanser.find((r) => r.nokkel === n)!.innhold.tittel))
        // GHB og ketamin får siden sin av importen; de andre fantes med kort fra før.
        if (NYE_STOFFSIDER.includes(navn)) expect(elementerFor.get(navn), navn).toBe(0)
        else expect(elementerFor.get(navn), navn).toBeGreaterThan(0)
        expect(side.elementer.length, navn).toBe(elementerFor.get(navn)! + 1)
      }
    }
    expect(await utkast()).toBe(sider + NYE_STOFFSIDER.length)
  })

  it('gjør ingenting når de kjøres en gang til', async () => {
    await kjorMigrasjoner(db, { bare: MIGRASJONER })
    expect(await antall('select count(*)::int as n from public.objektrevisjoner')).toBe(revisjoner)
  })
})
