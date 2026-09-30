/**
 * Stoffsidene uten analyttkode fra kildene om serumkonsentrasjoner
 * (`supabase/import/stoffsider/`): datasettet, og migrasjonene kjørt med
 * administratoren som bestilte dem. Databasen bygges bare til og med
 * importen, før sidene fikk stoffets nøkkel, så sidene leses etter navnet med
 * funksjonene appen brukte da (`hjelp/historisklesing.ts`).
 */
import type { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { beforeAll, describe, expect, it } from 'vitest'
import { byggKatalog, FORTOLKNINGSOPPFORINGER } from '../domain/analyttkatalog'
import { byggImportplan, importmigrasjoner, type Importfil } from '../faginnhold/import'
import { lesKinetikk } from '../faginnhold/paneler'
import { klartekst } from '../faginnhold/riktekst'
import { STOFFSIDE_DATASETT, stoffsideplan } from '../faginnhold/stoffsider'
import { TDM_KILDE } from '../faginnhold/tdm'
import { historiskSidenavn } from '../faginnhold/historiskesider'
import { STOFFREGISTER } from '../domain/stoffregister'
import { lesSideEtterNavn, lesSidenavnUtenKode } from './hjelp/historisklesing'
import {
  faginnholdskall,
  kjorMigrasjoner,
  migrasjonsfiler,
  nyDatabase,
  opprettBruker,
  type Faginnholdskall,
} from './hjelp/testdatabase'

const katalog = byggKatalog(FORTOLKNINGSOPPFORINGER)
const plan = stoffsideplan(katalog)
const MIGRASJONER = migrasjonsfiler().filter((f) => /_stoffsider_import_\d+\.sql$/.test(f))
const MIGRASJONSMAPPE = new URL('../../supabase/migrations/', import.meta.url)

const STOFFER = [
  'Atomoksetin',
  'Fenobarbital',
  'Fenytoin',
  'Flunitrazepam',
  'Gabapentin',
  'Karbamazepin',
  'Ketobemidon',
  'Levetiracetam',
  'Litium',
  'Metylfenidat',
  'Okskarbazepin',
  'Petidin',
  'Sertindol',
  'Topiramat',
  'Valproat',
]

const stoff = (navn: string) => plan.koder.find((k) => k.hovedside.navn === navn)!
const verdi = (navn: string, type = 'referanseomrade') => stoff(navn).elementer.find((e) => e.elementtype === type)?.data
const tekst = (navn: string, tittel: string) =>
  klartekst(lesKinetikk(stoff(navn).elementer.find((e) => lesKinetikk(e.data).tittel === tittel)!.data).dokument)
const tittel = (nokkel: string) => STOFFSIDE_DATASETT.referanser[nokkel]?.tittel ?? plan.referanser.find((r) => r.nokkel === nokkel)!.innhold.tittel

describe('datasettet', () => {
  it('har én side uten analyttkode for hvert av de 15 stoffene', () => {
    expect(plan.koder.map((k) => k.hovedside.navn)).toEqual(STOFFER)
    for (const k of plan.koder) {
      expect(k.kode, k.hovedside.navn).toBeNull()
      expect(k.komponenter, k.hovedside.navn).toEqual([])
      // Ingen analyttkode hadde siden som sin …
      expect(
        katalog.oppforinger.filter((o) => historiskSidenavn(o) === k.hovedside.navn).map((o) => o.kode),
        k.hovedside.navn,
      ).toEqual([])
      // … og i stoffregisteret er stoffet et stoff uten laboratorieanalytt.
      expect(STOFFREGISTER.kanonisk(k.hovedside.navn)?.navn, k.hovedside.navn).toBe(k.hovedside.navn)
      expect(STOFFREGISTER.analytterFor(STOFFREGISTER.kanonisk(k.hovedside.navn)!.slug), k.hovedside.navn).toEqual([])
    }
  })

  it('har referanseområdet og prøvetakingstidspunktet øverst i TDM for hvert stoff, og en kilde på hvert kort', () => {
    for (const k of plan.koder) {
      expect(verdi(k.hovedside.navn), k.hovedside.navn).toBeTruthy()
      const forste = k.elementer.find((e) => e.panel === 'tdm' && e.posisjon === 0)
      expect(lesKinetikk(forste?.data).tittel, k.hovedside.navn).toBe('Prøvetakingstidspunkt')
      for (const e of k.elementer) expect(e.referanser.length, `${k.hovedside.navn} ${e.panel}`).toBeGreaterThan(0)
    }
  })

  it('har verdiene fra kildene, med grensene som avgjør tolkningen', () => {
    expect(verdi('Valproat')).toEqual({ nedre: 300, ovre: 700, enhet: 'µmol/L', forbehold: '' })
    expect(verdi('Levetiracetam')).toMatchObject({ nedre: 30, ovre: 240, enhet: 'µmol/L' })
    expect(verdi('Karbamazepin')).toMatchObject({ nedre: 15, ovre: 45 })
    expect(verdi('Sertindol')).toMatchObject({ nedre: 30, ovre: 200, enhet: 'nmol/L' })
    expect(verdi('Litium')).toMatchObject({ nedre: 0.5, ovre: 1, enhet: 'mmol/L' })
    expect(verdi('Litium', 'toksisk_omrade')).toMatchObject({ nedre: 1.6, ovre: null, enhet: 'mmol/L' })
    expect(verdi('Litium', 'alvorlig_intoksikasjon')).toMatchObject({ nedre: 3.5, ovre: null, enhet: 'mmol/L' })
    // De nasjonale områdene fra 2019, ikke rapportens fra 2008.
    expect(verdi('Atomoksetin')).toMatchObject({ nedre: 300, ovre: 4000, enhet: 'nmol/L' })
    expect(verdi('Metylfenidat')).toMatchObject({ nedre: 1000, ovre: 4000, enhet: 'nmol/L' })
    // Opioidene og flunitrazepam har bare en øvre grense.
    expect(verdi('Ketobemidon')).toMatchObject({ nedre: null, ovre: 300 })
    expect(verdi('Petidin')).toMatchObject({ nedre: null, ovre: 2800 })
    expect(verdi('Flunitrazepam')).toMatchObject({ nedre: null, ovre: 20 })
  })

  it('sier hva som måles der området ikke gjelder stoffet alene, og når prøven skal tas', () => {
    expect(tekst('Metylfenidat', 'Grunnlag for referanseområdet')).toMatch(/^Referanseområdet gjelder metabolitten ritalinsyre/)
    expect(tekst('Karbamazepin', 'Grunnlag for referanseområdet')).toMatch(/^Referanseområdet gjelder summen av karbamazepin og .* karbamazepinepoksid/)
    expect(tekst('Okskarbazepin', 'Grunnlag for referanseområdet')).toMatch(/^Referanseområdet gjelder den aktive metabolitten monohydroksyokskarbazepin \(MHD\)/)
    expect(tekst('Levetiracetam', 'Prøvetakingstidspunkt')).toContain('12 ± 1 time')
    expect(tekst('Litium', 'Prøvetakingstidspunkt')).toContain('12 timer ± 30 minutter')
    expect(tekst('Flunitrazepam', 'Prøvetakingstidspunkt')).toContain('minst 12 timer etter inntak')
    expect(tekst('Atomoksetin', 'Prøvetakingstidspunkt')).toMatch(/^4–8 timer etter siste perorale inntak/)
  })

  it('sier på antiepileptikasidene at nyere nasjonale områder finnes', () => {
    for (const navn of ['Fenobarbital', 'Fenytoin', 'Gabapentin', 'Karbamazepin', 'Levetiracetam', 'Okskarbazepin', 'Topiramat', 'Valproat']) {
      expect(tekst(navn, 'Nyere nasjonale referanseområder'), navn).toContain('etablert i 2017')
    }
  })

  it('viser hvor innholdet er hentet fra', () => {
    expect(stoff('Sertindol').kilde).toBe(`Importert fra ${TDM_KILDE.dokument}, side 26, 41, 45`)
    expect(stoff('Petidin').kilde).toBe('Importert fra Serumkonsentrasjonsmålinger av vanedannende legemidler.pdf, side 1–2')
    expect(plan.referanser.map((r) => r.nokkel).sort()).toEqual(['frost2019', 'giftinfo-litium', 'helland2016', 'referanseomradeprosjektet'])
  })

  it('avviser et stoff som har en side for en kode, og en fil med både kode og side', () => {
    const med = (fil: Partial<Importfil>): Importfil => ({ sider: [1], tdm: [{ tittel: 'Tolkning', tekst: ['a'] }], ...fil })
    expect(() => byggImportplan([med({ side: 'Amitriptylin' })], {}, katalog, TDM_KILDE)).toThrow(/har en side for en analyttkode/)
    expect(() => byggImportplan([med({ side: 'Teststoff', kode: 'MOR' })], {}, katalog, TDM_KILDE)).toThrow(/bare én av «kode», «side» og «stoff»/)
    expect(() => byggImportplan([med({ side: ' Teststoff' })], {}, katalog, TDM_KILDE)).toThrow(/«side» må være navnet/)
    expect(() => byggImportplan([med({ side: 'Teststoff' }), med({ side: 'teststoff' })], {}, katalog, TDM_KILDE)).toThrow(/siden står i flere filer/)
  })

  it('er de samme migrasjonene som datasettet gir', () => {
    const filer = importmigrasjoner(plan, 'peohol', 55_000, 'utvid')
    expect(MIGRASJONER).toHaveLength(filer.length)
    MIGRASJONER.forEach((fil, i) => expect(readFileSync(new URL(fil, MIGRASJONSMAPPE), 'utf8'), fil).toBe(filer[i]))
  })
})

describe('migrasjonene i databasen', () => {
  let db: PGlite
  let kall: Faginnholdskall
  let bruker: string
  let revisjoner: number

  const antall = async (sql: string) => (await db.query<{ n: number }>(sql)).rows[0]!.n

  beforeAll(async () => {
    db = await nyDatabase({ til: MIGRASJONER[0] })
    const admin = await opprettBruker(db, { brukernavn: 'peohol', fornavn: 'Rita', etternavn: 'Redaktør', rolle: 'admin' })
    bruker = await opprettBruker(db, { brukernavn: 'leser', fornavn: 'Lars', etternavn: 'Leser', rolle: 'user' })
    // Bare til og med stoffsideimporten: senere importer (som indikasjonene) utvider sidene.
    await kjorMigrasjoner(db, { bare: migrasjonsfiler().filter((f) => f >= MIGRASJONER[0]! && f <= MIGRASJONER.at(-1)!) })
    kall = faginnholdskall(db, admin)
    revisjoner = await antall('select count(*)::int as n from public.objektrevisjoner')
  }, 180_000)

  it('legger inn stoffsidene publisert, uten noen laboratorieanalytt', async () => {
    expect(await lesSidenavnUtenKode(kall, bruker, 'publisert')).toEqual(STOFFER)
    expect(await antall('select count(*)::int as n from public.laboratorieanalytter')).toBe(0)
  })

  it('viser kortene datasettet har, med kildene, på hver side', async () => {
    for (const k of plan.koder) {
      const side = await lesSideEtterNavn(kall, bruker, k.hovedside.navn, 'publisert')
      expect(side.analytt, k.hovedside.navn).toBeNull()
      const vist = side.elementer
        .map((e) => ({
          panel: e.innhold.panel,
          posisjon: e.innhold.posisjon,
          elementtype: e.innhold.elementtype,
          data: e.innhold.data,
          referanser: (e.innhold.referanser ?? []).map((id) => side.referanser.find((r) => r.id === id)!.innhold.tittel),
          kilde: e.kilde,
        }))
        .sort((a, b) => a.panel.localeCompare(b.panel) || a.posisjon - b.posisjon || a.elementtype.localeCompare(b.elementtype))
      const forventet = k.elementer
        .map((e) => ({
          panel: e.panel,
          posisjon: e.posisjon,
          elementtype: e.elementtype,
          data: e.data,
          referanser: e.referanser.map(tittel),
          kilde: e.kilde,
        }))
        .sort((a, b) => a.panel.localeCompare(b.panel) || a.posisjon - b.posisjon || a.elementtype.localeCompare(b.elementtype))
      expect(vist, k.hovedside.navn).toEqual(forventet)
    }
  })

  it('gjør ingenting når de kjøres en gang til', async () => {
    await kjorMigrasjoner(db, { bare: MIGRASJONER })
    expect(await antall('select count(*)::int as n from public.objektrevisjoner')).toBe(revisjoner)
  })
})
