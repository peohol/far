/**
 * Indikasjonene for stoffsidene uten analyttkode, hentet fra Felleskatalogen
 * (`supabase/import/indikasjoner/`): datasettet, og migrasjonene kjørt på
 * sidene stoffsideimporten la inn, lest slik appen leser dem.
 */
import type { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { beforeAll, describe, expect, it } from 'vitest'
import { importmigrasjoner } from '../faginnhold/import'
import { INDIKASJONSDATASETT, indikasjonsplan } from '../faginnhold/indikasjoner'
import { lagFaginnholdsleser, type Faginnholdsleser } from '../faginnhold/lesing'
import { ELEMENTTYPER, lesRiktekst } from '../faginnhold/paneler'
import { klartekst } from '../faginnhold/riktekst'
import { stoffsideplan } from '../faginnhold/stoffsider'
import { faginnholdskall, kjorMigrasjoner, migrasjonsfiler, nyDatabase, opprettBruker } from './hjelp/testdatabase'

const plan = indikasjonsplan()
const MIGRASJONER = migrasjonsfiler().filter((f) => /_stoffsider_indikasjoner_\d+\.sql$/.test(f))
const FORSTE_STOFFSIDE = migrasjonsfiler().find((f) => /_stoffsider_import_\d+\.sql$/.test(f))!
const MIGRASJONSMAPPE = new URL('../../supabase/migrations/', import.meta.url)
const FK_KILDE = 'Hentet fra Felleskatalogen 25.09.2026'
/** Stoffene Felleskatalogen ikke har noen preparatomtale for. */
const UTEN_OMTALE = ['Flunitrazepam', 'Ketobemidon']

const stoff = (navn: string) => plan.koder.find((k) => k.hovedside.navn === navn)!
const tekst = (navn: string) => klartekst(lesRiktekst(stoff(navn).elementer[0]!.data).dokument)

describe('datasettet', () => {
  it('har ett indikasjonskort, og ikke noe annet, for hver stoffside uten analyttkode', () => {
    expect(plan.koder.map((k) => k.hovedside.navn)).toEqual(stoffsideplan().koder.map((k) => k.hovedside.navn))
    for (const k of plan.koder) {
      expect(k.kode, k.hovedside.navn).toBeNull()
      expect(k.elementer.map((e) => [e.panel, e.elementtype]), k.hovedside.navn).toEqual([['indikasjon', ELEMENTTYPER.riktekst]])
      expect(k.elementer[0]!.kilde, k.hovedside.navn).toBe(FK_KILDE)
    }
  })

  it('siterer preparatomtalene i Felleskatalogen, og sier fra der det ikke finnes noen', () => {
    for (const r of plan.referanser) {
      expect(r.nokkel).toMatch(/^fk-/)
      expect(r.kilde, r.nokkel).toBe(FK_KILDE)
      expect(r.innhold).toMatchObject({ forfattere: 'Felleskatalogen', lenke: expect.stringMatching(/^https:\/\/www\.felleskatalogen\.no\/medisin\/[a-z0-9-]+-\d{6}$/) })
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

  it('er de samme migrasjonene som datasettet gir', () => {
    const filer = importmigrasjoner(plan, 'peohol', 55_000, 'utvid')
    expect(MIGRASJONER).toHaveLength(filer.length)
    MIGRASJONER.forEach((fil, i) => expect(readFileSync(new URL(fil, MIGRASJONSMAPPE), 'utf8'), fil).toBe(filer[i]))
  })
})

describe('migrasjonene i databasen', () => {
  let db: PGlite
  let leser: Faginnholdsleser
  let revisjoner: number

  const antall = async (sql: string) => (await db.query<{ n: number }>(sql)).rows[0]!.n

  beforeAll(async () => {
    db = await nyDatabase({ til: FORSTE_STOFFSIDE })
    const admin = await opprettBruker(db, { brukernavn: 'peohol', fornavn: 'Rita', etternavn: 'Redaktør', rolle: 'admin' })
    const bruker = await opprettBruker(db, { brukernavn: 'leser', fornavn: 'Lars', etternavn: 'Leser', rolle: 'user' })
    await kjorMigrasjoner(db, { fra: FORSTE_STOFFSIDE })
    leser = lagFaginnholdsleser(faginnholdskall(db, admin).klientFor(bruker))
    revisjoner = await antall('select count(*)::int as n from public.objektrevisjoner')
  }, 180_000)

  it('legger indikasjonen publisert på sidene som finnes, med kildene, og lar resten av siden stå', async () => {
    const stoffsider = stoffsideplan()
    for (const k of plan.koder) {
      const navn = k.hovedside.navn
      const side = await leser.lesStoffside(navn, 'publisert')
      const [indikasjon, ...flere] = side.elementer.filter((e) => e.innhold.panel === 'indikasjon')
      expect(flere, navn).toEqual([])
      expect(indikasjon!.innhold.data, navn).toEqual(k.elementer[0]!.data)
      expect(indikasjon!.kilde, navn).toBe(FK_KILDE)
      const titler = (indikasjon!.innhold.referanser ?? []).map((id) => side.referanser.find((r) => r.id === id)!.innhold.tittel)
      expect(titler, navn).toEqual(k.elementer[0]!.referanser.map((n) => plan.referanser.find((r) => r.nokkel === n)!.innhold.tittel))
      const ovrige = stoffsider.koder.find((s) => s.hovedside.navn === navn)!.elementer.length
      expect(side.elementer.length, navn).toBe(ovrige + 1)
    }
    expect(await antall('select count(*)::int as n from public.infosider where tilstand = \'utkast\'')).toBe(plan.koder.length)
  })

  it('gjør ingenting når de kjøres en gang til', async () => {
    await kjorMigrasjoner(db, { bare: MIGRASJONER })
    expect(await antall('select count(*)::int as n from public.objektrevisjoner')).toBe(revisjoner)
  })
})
