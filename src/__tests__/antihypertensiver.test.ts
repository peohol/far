/**
 * Antihypertensivsidene fra oversikten over serumkonsentrasjoner av
 * antihypertensiver (`supabase/import/antihypertensiver/`): datasettet, at en
 * importfil kan peke på stoffet i stoffregisteret, og migrasjonene kjørt med
 * administratoren som bestilte dem. Sidene leses etter stoffets nøkkel, som
 * appen gjør.
 */
import type { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { beforeAll, describe, expect, it } from 'vitest'
import { byggKatalog, FORTOLKNINGSOPPFORINGER } from '../domain/analyttkatalog'
import { STOFFREGISTER } from '../domain/stoffregister'
import { ANTIHYPERTENSIV_DATASETT, ANTIHYPERTENSIV_KILDE, antihypertensivplan } from '../faginnhold/antihypertensiver'
import { byggImportplan, importmigrasjoner, type Importfil } from '../faginnhold/import'
import { lagFaginnholdsleser, type Faginnholdsleser } from '../faginnhold/lesing'
import { lesDosetabell, lesKinetikk } from '../faginnhold/paneler'
import { klartekst } from '../faginnhold/riktekst'
import { faginnholdskall, kjorMigrasjoner, migrasjonsfiler, nyDatabase, opprettBruker } from './hjelp/testdatabase'

const katalog = byggKatalog(FORTOLKNINGSOPPFORINGER)
const plan = antihypertensivplan(katalog)
const MIGRASJONER = migrasjonsfiler().filter((f) => /_antihypertensiver_import_\d+\.sql$/.test(f))
const MIGRASJONSMAPPE = new URL('../../supabase/migrations/', import.meta.url)

/** Panelene hver side har, som sidene om antidepressiva. */
const PANELER = [
  'viktige_data',
  'farmakodynamikk',
  'indikasjon',
  'dosering',
  'interaksjoner',
  'farmakokinetikk',
  'tdm',
  'serumkonsentrasjoner',
]

/** Stoffene der oversikten ikke oppgir noen kilde for toksisiteten. */
const UTEN_TOKSISITETSKILDE = ['bumetanid', 'doksazosin', 'eplerenon', 'spironolakton']

const side = (slug: string) => plan.koder.find((k) => k.hovedside.slug === slug)!
const verdi = (slug: string, type = 'referanseomrade') => side(slug).elementer.find((e) => e.elementtype === type)?.data
const kort = (slug: string, panel: string, tittel: string) => {
  const e = side(slug).elementer.find((e) => e.panel === panel && lesKinetikk(e.data).tittel === tittel)
  return e && klartekst(lesKinetikk(e.data).dokument)
}
const rader = (slug: string) => lesDosetabell(side(slug).elementer.find((e) => e.panel === 'serumkonsentrasjoner')!.data).rader
const tittel = (nokkel: string) => plan.referanser.find((r) => r.nokkel === nokkel)!.innhold.tittel

describe('datasettet', () => {
  it('har én side for hvert av de 25 stoffene, med navnet og nøkkelen fra stoffregisteret', () => {
    expect(plan.koder).toHaveLength(25)
    for (const k of plan.koder) {
      const stoff = STOFFREGISTER.finn(k.hovedside.slug!)
      expect(stoff, k.hovedside.navn).toBeDefined()
      expect(k.hovedside.navn).toBe(stoff!.navn)
      expect(k.kode, k.hovedside.navn).toBeNull()
      expect(k.komponenter, k.hovedside.navn).toEqual([])
    }
  })

  it('gir hver side de samme panelene som antidepressiva, med en kilde på hver tekst', () => {
    for (const k of plan.koder) {
      const paneler = new Set(k.elementer.map((e) => e.panel))
      for (const panel of PANELER) expect(paneler.has(panel), `${k.hovedside.navn} ${panel}`).toBe(true)
      const forste = k.elementer.find((e) => e.panel === 'tdm' && e.posisjon === 0)
      expect(lesKinetikk(forste?.data).tittel, k.hovedside.navn).toBe('Prøvetakingstidspunkt')
      for (const e of k.elementer) {
        if (e.panel === 'viktige_data' && e.elementtype !== 'referanseomrade') continue
        // Oversikten har ingen annen kilde for toksisiteten til disse stoffene enn seg selv.
        if (UTEN_TOKSISITETSKILDE.includes(k.hovedside.slug!) && lesKinetikk(e.data).tittel === 'Toksisitet') continue
        expect(e.referanser.length, `${k.hovedside.navn} ${e.panel} ${e.posisjon}`).toBeGreaterThan(0)
      }
    }
  })

  it('har referanseområdene fra oversikten, og sier hva som måles der det er en metabolitt', () => {
    expect(verdi('amlodipin')).toMatchObject({ nedre: 10, ovre: 70, enhet: 'nmol/L' })
    expect(verdi('enalapril')).toMatchObject({ nedre: 10, ovre: 300, forbehold: 'Gjelder enalaprilat, som laboratoriet måler.' })
    expect(verdi('enalapril', 'toksisk_omrade')).toMatchObject({ nedre: 1200, ovre: null })
    expect(verdi('doksazosin', 'toksisk_omrade')).toMatchObject({ nedre: 320 })
    for (const slug of ['ramipril', 'spironolakton', 'losartan']) expect(verdi(slug), slug).toHaveProperty('forbehold', expect.stringMatching(/^Gjelder \w+, som laboratoriet måler\.$/))
    expect(verdi('furosemid')).toMatchObject({ forbehold: 'Gjelder Cmaks.' })
  })

  it('har halveringstiden per stoff, og steady state der oversikten oppgir det', () => {
    for (const k of plan.koder) expect(verdi(k.hovedside.slug!, 'halveringstid'), k.hovedside.navn).toHaveProperty('former')
    expect(verdi('enalapril', 'steady_state')).toEqual({ former: [{ form: '', typisk: 4, min: null, maks: null, enhet: 'dager' }] })
  })

  it('har de beregnede og målte serumkonsentrasjonene, med kilden i merknaden', () => {
    expect(rader('amlodipin').some((r) => r.merknad.startsWith('Beregnet fra clearance'))).toBe(true)
    for (const slug of ['bumetanid', 'furosemid']) {
      // Bare gjennomsnittet ved steady state: de andre beregnede verdiene er for lave til å brukes.
      const beregnet = rader(slug).filter((r) => r.merknad.includes('Beregnet'))
      expect(beregnet.map((r) => r.regime), slug).toEqual(beregnet.map(() => 'Gjennomsnitt ved steady state'))
    }
    expect(rader('enalapril').every((r) => r.merknad.startsWith('Enalaprilat.') || r.merknad.startsWith('Målt'))).toBe(true)
  })

  it('har toksisitet og CYP-enzymene der oversikten har dem', () => {
    expect(kort('doksazosin', 'tdm', 'Toksisitet')).toContain('4 × øvre grense')
    expect(kort('metoprolol', 'farmakogenetikk', 'CYP-enzymer (substrat)')).toBe('2D6')
    expect(kort('lisinopril', 'farmakogenetikk', 'CYP-enzymer (substrat)')).toBeUndefined()
  })

  it('bruker felles referanser og preparatomtalen for hvert stoff', () => {
    expect(ANTIHYPERTENSIV_DATASETT.filer.every((f) => f.kilde === ANTIHYPERTENSIV_KILDE.dokument)).toBe(true)
    expect(tittel('rognstad2021')).toBe('Establishing Serum Reference Ranges for Antihypertensive Drugs')
    expect(side('enalapril').elementer.find((e) => e.panel === 'farmakodynamikk')!.referanser).toContain('spc-enalapril')
  })

  it('avviser et stoff som ikke finnes i stoffregisteret, og en fil med både stoff og side', () => {
    const med = (fil: Partial<Importfil>): Importfil => ({ sider: [1], tdm: [{ tittel: 'Tolkning', tekst: ['a'] }], ...fil })
    const bygg = (fil: Partial<Importfil>) => byggImportplan([med(fil)], {}, katalog, ANTIHYPERTENSIV_KILDE)
    expect(() => bygg({ stoff: 'finnes-ikke' })).toThrow(/stoffet finnes ikke i stoffregisteret/)
    expect(() => bygg({ stoff: 'amlodipin', side: 'Amlodipin' })).toThrow(/bare én av «kode», «side» og «stoff»/)
    expect(bygg({ stoff: 'amlodipin' }).koder[0]!.hovedside).toMatchObject({ navn: 'Amlodipin', slug: 'amlodipin' })
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
    db = await nyDatabase({ til: MIGRASJONER[0] })
    const admin = await opprettBruker(db, { brukernavn: 'peohol', fornavn: 'Rita', etternavn: 'Redaktør', rolle: 'admin' })
    const bruker = await opprettBruker(db, { brukernavn: 'leser', fornavn: 'Lars', etternavn: 'Leser', rolle: 'user' })
    await kjorMigrasjoner(db, { bare: MIGRASJONER })
    leser = lagFaginnholdsleser(faginnholdskall(db, admin).klientFor(bruker))
    revisjoner = await antall('select count(*)::int as n from public.objektrevisjoner')
  }, 180_000)

  it('lager sidene publisert, med navnet og nøkkelen fra stoffregisteret, og kortene datasettet har', async () => {
    const rekkefolge = <T extends { panel: string; posisjon: number; elementtype: string }>(a: T, b: T) =>
      a.panel.localeCompare(b.panel) || a.posisjon - b.posisjon || a.elementtype.localeCompare(b.elementtype)
    for (const k of plan.koder) {
      const s = await leser.lesStoffside(k.hovedside.slug!, 'publisert')
      expect(s.stoff, k.hovedside.navn).toMatchObject({ slug: k.hovedside.slug, navn: k.hovedside.navn })
      const vist = s.elementer
        .map((e) => ({
          panel: e.innhold.panel,
          posisjon: e.innhold.posisjon,
          elementtype: e.innhold.elementtype,
          data: e.innhold.data,
          referanser: (e.innhold.referanser ?? []).map((id) => s.referanser.find((r) => r.id === id)!.innhold.tittel),
          kilde: e.kilde,
        }))
        .sort(rekkefolge)
      const forventet = k.elementer
        .map((e) => ({
          panel: e.panel,
          posisjon: e.posisjon,
          elementtype: e.elementtype,
          data: e.data,
          referanser: e.referanser.map(tittel),
          kilde: e.kilde,
        }))
        .sort(rekkefolge)
      expect(vist, k.hovedside.navn).toEqual(forventet)
    }
  })

  it('gjør ingenting når de kjøres en gang til', async () => {
    await kjorMigrasjoner(db, { bare: MIGRASJONER })
    expect(await antall('select count(*)::int as n from public.objektrevisjoner')).toBe(revisjoner)
  })
})
