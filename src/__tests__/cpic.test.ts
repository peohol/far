/**
 * De strukturerte farmakogenetiske dataene fra CPIC: lesingen av radene,
 * kallene mot API-et, synkroniseringen inn i en ekte database bygd av
 * migrasjonene, lesingen appen gjør, og endepunktet.
 *
 * Utdraget i `data/cpic-utdrag.json` er ekte rader fra CPICs API (release
 * v1.60.1), kortet ned til amitriptylin, abakavir og warfarin med genene,
 * resultatene, noen diplotyper og alleler som hører til.
 */
import type { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { lagCpicApi, totalFraContentRange, type CpicApi, type Kildeinfo } from '../cpic/api'
import { behandleCpicSynk } from '../cpic/endepunkt'
import { lagCpiclager } from '../cpic/lager'
import { lesCpicutvalg, lesDiplotypegrunnlag, TOMT_CPICUTVALG, type Diplotypegrunnlag } from '../cpic/lesing'
import {
  ENTITETER,
  KILDETABELLER,
  lesAnbefaling,
  lesDiplotype,
  lesGen,
  lesLegemiddel,
  lesPar,
} from '../cpic/modell'
import { kontrollsum, lesTabell, synkroniserCpic } from '../cpic/synk'
import { diplotypegrunnlagFra } from './hjelp/cpic'
import { kallSom } from './hjelp/fest'
import { feilFra, nyDatabase } from './hjelp/testdatabase'

type Rad = Record<string, unknown>
const UTDRAG = JSON.parse(readFileSync(new URL('./data/cpic-utdrag.json', import.meta.url), 'utf8')) as Record<string, Rad[]>

const AMITRIPTYLIN = 'PA448385'
const ABAKAVIR = 'PA448004'
const WARFARIN = 'PA451906'

const KILDE: Kildeinfo = { release: 'v1.60.1', release_dato: '2026-08-12T21:00:00Z', skjemaversjon: '82', skjema_kl: '2026-08-12T22:08:18' }

/** Rader fra CPIC, med endringer for en test: en tabell byttet ut, eller en feil. */
function falskApi(endringer: Record<string, Rad[] | Error> = {}, kilde: Kildeinfo = KILDE): CpicApi & { kall: string[] } {
  const kall: string[] = []
  return {
    kall,
    tabell: async (tabell) => {
      kall.push(tabell)
      const endret = endringer[tabell]
      if (endret instanceof Error) throw endret
      return structuredClone(endret ?? UTDRAG[tabell] ?? [])
    },
    kildeinfo: async () => kilde,
  }
}

function rad(tabell: string, finn: (r: Rad) => boolean): Rad {
  const r = UTDRAG[tabell]!.find(finn)
  if (!r) throw new Error(`Fant ikke raden i ${tabell}.`)
  return r
}

/* --- Lesingen av radene --------------------------------------------------- */

describe('lesingen av radene fra CPIC', () => {
  it('leser legemiddelet med identifikatorene CPIC oppgir', () => {
    const lest = lesLegemiddel(rad('drug', (r) => r.name === 'amitriptyline'))
    expect(lest).toMatchObject({
      id: 'RxNorm:704',
      data: { navn: 'amitriptyline', clinpgx_id: AMITRIPTYLIN, rxnorm: '704', atc: ['N06AA09', 'N06CA01'], retningslinje_id: '100414' },
    })
    expect(lest!.versjon).toEqual(expect.any(Number))
  })

  it('leser en anbefaling for to gener med ulike typer resultat, uoversatt', () => {
    const a = lesAnbefaling(
      rad('recommendation', (r) => {
        const k = r.lookupkey as Record<string, string>
        return r.drugid === 'RxNorm:704' && k.CYP2D6 === '1.0' && k.CYP2C19 === 'Poor Metabolizer'
      }),
    )!.data
    expect(a.betingelser.map((b) => b.gen)).toEqual(['CYP2C19', 'CYP2D6'])
    // CYP2D6 slås opp på aktivitetsverdien, CYP2C19 på fenotypen, som CPIC gjør.
    expect(a.betingelser[0]).toMatchObject({ gen: 'CYP2C19', oppslagsverdi: 'Poor Metabolizer', fenotype: 'Poor Metabolizer' })
    expect(a.betingelser[1]).toMatchObject({ gen: 'CYP2D6', oppslagsverdi: '1.0', aktivitetsverdi: '1.0' })
    expect(a.oppslagsnokkel).toEqual({ CYP2C19: 'Poor Metabolizer', CYP2D6: '1.0' })
    expect(a.klassifisering).toEqual(expect.any(String))
    expect(a.anbefaling).toEqual(expect.any(String))
    expect(a.retningslinje_id).toBe('100414')
  })

  it('leser en HLA-anbefaling som allelstatus, ikke som metaboliseringsfenotype', () => {
    const a = lesAnbefaling(rad('recommendation', (r) => (r.lookupkey as Record<string, string>)['HLA-B'] === '*57:01 positive'))!.data
    expect(a.betingelser).toEqual([
      expect.objectContaining({ gen: 'HLA-B', oppslagsverdi: '*57:01 positive', allelstatus: 'HLA-B*57:01 positive', fenotype: null, aktivitetsverdi: null }),
    ])
    expect(a.klassifisering).toBe('Strong')
  })

  it('forkaster rader uten det de må ha, og tåler felt med feil type', () => {
    expect(lesAnbefaling({ id: 1, guidelineid: 2 })).toBeNull()
    expect(lesPar({ pairid: 3, drugid: 'RxNorm:1' })).toBeNull()
    expect(lesDiplotype({ id: 4, diplotype: '*1/*2' })).toBeNull()
    const gen = lesGen({ symbol: 'CYP2C19', lookupmethod: 'NOE_NYTT', chr: 12 })!.data
    expect(gen).toMatchObject({ symbol: 'CYP2C19', oppslagsmetode: null, kromosom: '12' })
    const a = lesAnbefaling({ id: 5, guidelineid: 6, drugid: 'RxNorm:7', lookupkey: 'tull', phenotypes: { CYP2C9: 3, X: null } })!.data
    expect(a.betingelser).toEqual([expect.objectContaining({ gen: 'CYP2C9', fenotype: '3', oppslagsverdi: null })])
  })

  it('leser hele utdraget, uten dubletter, og forkaster bare det som ikke kan leses', () => {
    for (const entitet of KILDETABELLER) {
      const radene = UTDRAG[entitet.tabell]!
      const { rader, forkastet } = lesTabell(entitet, [...radene, radene[0], { tull: true }, 'tekst'])
      expect(rader, entitet.tabell).toHaveLength(radene.length)
      expect(forkastet, entitet.tabell).toBe(3)
      expect(rader.every((r) => (entitet.raa ? r.raa !== undefined : r.raa === undefined))).toBe(true)
    }
    // Endringsloggen har ingen ID i CPIC; samme føring får alltid samme ID.
    const endring = KILDETABELLER.find((e) => e.navn === 'endring')!
    expect(lesTabell(endring, UTDRAG.change_log!).rader.map((r) => r.id)).toEqual(
      lesTabell(endring, [...UTDRAG.change_log!].reverse()).rader.map((r) => r.id),
    )
  })

  it('gir samme kontrollsum for samme innhold, uansett rekkefølge', () => {
    const entitet = KILDETABELLER.find((e) => e.navn === 'anbefaling')!
    const radene = UTDRAG.recommendation!
    const sum = kontrollsum(lesTabell(entitet, radene).rader)
    expect(kontrollsum(lesTabell(entitet, [...radene].reverse()).rader)).toBe(sum)
    const endret = radene.map((r, i) => (i === 0 ? { ...r, drugrecommendation: 'Endret' } : r))
    expect(kontrollsum(lesTabell(entitet, endret).rader)).not.toBe(sum)
  })
})

/* --- Kallene mot API-et --------------------------------------------------- */

describe('kallene mot CPICs API', () => {
  function side(rader: unknown[], fra: number, total: number | '*', status = 200): Response {
    return new Response(JSON.stringify(rader), {
      status,
      headers: { 'content-range': `${fra}-${fra + rader.length - 1}/${total}` },
    })
  }

  it('henter en tabell i sider, sortert, og kontrollerer antallet', async () => {
    const alle = Array.from({ length: 5 }, (_, i) => ({ id: i }))
    const urler: URL[] = []
    const hent = vi.fn(async (url: string | URL | Request) => {
      const u = new URL(String(url))
      urler.push(u)
      const fra = Number(u.searchParams.get('offset'))
      return side(alle.slice(fra, fra + 2), fra, 5)
    }) as unknown as typeof fetch
    const api = lagCpicApi({ hent, sidestorrelse: 2, vent: async () => {} })
    expect(await api.tabell('pair', { rekkefolge: 'pairid' })).toEqual(alle)
    expect(urler.map((u) => u.searchParams.get('offset'))).toEqual(['0', '2', '4'])
    expect(urler[0]!.searchParams.get('order')).toBe('pairid')
    expect(urler[0]!.searchParams.get('select')).toBe('*')
  })

  it('avviser et uttrekk som ikke er fullstendig, eller der antallet endrer seg underveis', async () => {
    const kort = lagCpicApi({ hent: (async () => side([{ id: 1 }], 0, 3)) as unknown as typeof fetch, sidestorrelse: 5, vent: async () => {} })
    await expect(kort.tabell('drug', { rekkefolge: 'drugid' })).rejects.toThrow(/ufullstendig: 1 av 3/)

    let n = 0
    const vokser = lagCpicApi({
      hent: (async () => side([{ id: n }], n, 2 + n++)) as unknown as typeof fetch,
      sidestorrelse: 1,
      vent: async () => {},
    })
    await expect(vokser.tabell('drug', { rekkefolge: 'drugid' })).rejects.toThrow(/endret seg/)

    const uten = lagCpicApi({ hent: (async () => new Response('[]')) as unknown as typeof fetch, vent: async () => {} })
    await expect(uten.tabell('drug', { rekkefolge: 'drugid' })).rejects.toThrow(/oppga ikke/)
    expect(totalFraContentRange('0-24999/112820')).toBe(112820)
    expect(totalFraContentRange('*/0')).toBe(0)
  })

  it('prøver igjen etter 429 og serverfeil, og gir opp etter noen forsøk', async () => {
    const svarene = [new Response('', { status: 429, headers: { 'retry-after': '2' } }), new Response('', { status: 503 }), side([{ id: 1 }], 0, 1)]
    const ventet: number[] = []
    const api = lagCpicApi({ hent: (async () => svarene.shift()!) as unknown as typeof fetch, vent: async (ms) => void ventet.push(ms) })
    expect(await api.tabell('term', { rekkefolge: 'id' })).toEqual([{ id: 1 }])
    expect(ventet).toContain(2000)

    const nede = lagCpicApi({ hent: (async () => new Response('', { status: 500 })) as unknown as typeof fetch, vent: async () => {} })
    await expect(nede.tabell('term', { rekkefolge: 'id' })).rejects.toThrow('CPIC svarte 500 for term.')
  })

  it('leser skjemaversjonen og releasen, og klarer seg uten releasen', async () => {
    const hent = (async (url: string | URL | Request) =>
      String(url).includes('flyway')
        ? new Response(JSON.stringify(UTDRAG.flyway_schema_history))
        : new Response(JSON.stringify({ tag_name: 'v1.60.1', published_at: '2026-08-12T21:00:00Z' }))) as unknown as typeof fetch
    expect(await lagCpicApi({ hent, vent: async () => {} }).kildeinfo()).toEqual({
      release: 'v1.60.1',
      release_dato: '2026-08-12T21:00:00Z',
      skjemaversjon: '82',
      skjema_kl: expect.stringMatching(/^2026-08-12/),
    })

    const utenRelease = (async (url: string | URL | Request) => {
      if (String(url).includes('github')) throw new Error('nede')
      return new Response(JSON.stringify(UTDRAG.flyway_schema_history))
    }) as unknown as typeof fetch
    expect(await lagCpicApi({ hent: utenRelease, vent: async () => {} }).kildeinfo()).toMatchObject({ release: null, skjemaversjon: '82' })
  })
})

/* --- Synkroniseringen og lesingen ----------------------------------------- */

describe('synkroniseringen', () => {
  let db: PGlite
  const lager = () => lagCpiclager(kallSom(db, 'service_role'))
  const les = async (ider: string[]) => lesCpicutvalg(await kallSom(db, 'authenticated')('les_cpic', { clinpgx_ider: ider }))
  const logg = async () =>
    (await db.query<{ status: string; feil: string | null; release: string | null; antall: Record<string, Record<string, number | boolean>> }>(
      'select status, feil, release, antall from cpic.synkroniseringer order by id',
    )).rows

  beforeAll(async () => {
    db = await nyDatabase()
  }, 60_000)

  beforeEach(async () => {
    const tabeller = ENTITETER.map((e) => `cpic.${e}`).join(', ')
    await db.exec(`truncate ${tabeller}, cpic.innlasting, cpic.synkroniseringer cascade`)
    await db.exec('update cpic.entiteter set sha256 = null, parserversjon = null')
  })

  it('har de samme typene i koden og i databasen', async () => {
    const { rows } = await db.query<{ navn: string }>('select navn from cpic.entiteter order by navn')
    expect(rows.map((r) => r.navn)).toEqual([...ENTITETER].sort())
    expect(KILDETABELLER.map((e) => e.navn)).toEqual([...ENTITETER])
  })

  it('bytter inn hele uttrekket, og appen leser det for et legemiddel uten rådataene', async () => {
    const resultat = await synkroniserCpic({ lager: lager(), api: falskApi() })
    expect(resultat).toMatchObject({ status: 'fullfort', release: 'v1.60.1' })
    if (resultat.status === 'feilet') throw new Error(resultat.feil)
    expect(resultat.antall.anbefaling).toMatchObject({ inn: UTDRAG.recommendation!.length, nye: UTDRAG.recommendation!.length, utgatte: 0 })
    expect(resultat.antall.diplotype).toMatchObject({ inn: UTDRAG.gene_result_diplotype!.length })

    const utvalg = await les([AMITRIPTYLIN])
    expect(utvalg.kilde).toMatchObject({ navn: 'CPIC', release: 'v1.60.1', skjemaversjon: '82' })
    expect(utvalg.kilde.kontrollert_kl).not.toBeNull()
    expect(utvalg.legemidler.map((l) => l.navn)).toEqual(['amitriptyline'])
    expect(utvalg.retningslinjer.map((r) => r.id)).toEqual(['100414'])
    expect(utvalg.retningslinjer[0]!.publikasjoner.length).toBeGreaterThan(0)
    expect(utvalg.anbefalinger.length).toBeGreaterThan(0)
    expect(utvalg.anbefalinger.every((a) => a.legemiddel_id === 'RxNorm:704')).toBe(true)
    expect(utvalg.gener.map((g) => g.symbol)).toEqual(expect.arrayContaining(['CYP2C19', 'CYP2D6']))
    expect(utvalg.genresultater.some((r) => r.gen === 'CYP2C19' && r.resultat === 'Poor Metabolizer')).toBe(true)
    expect(utvalg.par.every((p) => p.legemiddel_id === 'RxNorm:704')).toBe(true)
    // Rådataene går aldri til nettleseren.
    expect(JSON.stringify(utvalg)).not.toMatch(/"drugrecommendation"|"lookupkey"/)

    // Rådataene ligger ved siden av, for feilsøking; ikke for diplotypene.
    const { rows } = await db.query<{ med: number; uten: number }>(
      `select (select count(*) from cpic.anbefaling where raa is not null)::int as med,
              (select count(*) from cpic.diplotype where raa is not null)::int as uten`,
    )
    expect(rows[0]).toEqual({ med: UTDRAG.recommendation!.length, uten: 0 })
  })

  it('viser et legemiddel med retningslinje, men uten anbefalinger, og et uten CPIC-data', async () => {
    await synkroniserCpic({ lager: lager(), api: falskApi() })
    const warfarin = await les([WARFARIN])
    expect(warfarin.retningslinjer[0]!.bruksmerknad).toMatch(/does not follow simple diplotype to phenotype/)
    expect(warfarin.anbefalinger).toEqual([])
    expect(warfarin.par.length).toBeGreaterThan(0)
    expect(await les(['PA999999'])).toMatchObject({ legemidler: [], anbefalinger: [], par: [] })
    expect(lesCpicutvalg(null)).toEqual(TOMT_CPICUTVALG)
  })

  it('gjør betingelsene for flere gener og for HLA søkbare, én rad per gen', async () => {
    await synkroniserCpic({ lager: lager(), api: falskApi() })
    const { rows } = await db.query<{ gen: string; oppslagsverdi: string; allelstatus: string | null }>(
      `select b.gen, b.oppslagsverdi, b.allelstatus from cpic.anbefalingsbetingelser b
       join cpic.legemiddel l on l.cpic_id = b.legemiddel_id
       where l.clinpgx_id = $1 order by b.oppslagsverdi`,
      [ABAKAVIR],
    )
    expect(rows).toEqual([
      { gen: 'HLA-B', oppslagsverdi: '*57:01 negative', allelstatus: 'HLA-B*57:01 negative' },
      { gen: 'HLA-B', oppslagsverdi: '*57:01 positive', allelstatus: 'HLA-B*57:01 positive' },
    ])
    // Diplotypene henger sammen med genresultatet sitt.
    const { rows: diplo } = await db.query<{ resultat: string }>(
      `select r.data ->> 'resultat' as resultat
       from cpic.diplotype d
       join cpic.genresultat_oppslag o on o.cpic_id = d.oppslag_id
       join cpic.genresultat r on r.cpic_id = o.genresultat_id
       where d.diplotype = '*1/*17' and r.gen = 'CYP2C19'`,
    )
    expect(diplo.map((d) => d.resultat)).toEqual(['Rapid Metabolizer'])
  })

  it('gir CPICs tabell fra diplotype til resultat for ett gen, uten rådataene', async () => {
    await synkroniserCpic({ lager: lager(), api: falskApi() })
    // Rekkefølgen i svaret er databasens; innholdet skal være det samme.
    const etter = <T,>(liste: T[], nokkel: (x: T) => string) => [...liste].sort((a, b) => nokkel(a).localeCompare(nokkel(b)))
    const ordnet = (g: Diplotypegrunnlag) => ({
      ...g,
      kilde: null,
      genresultater: etter(g.genresultater, (r) => r.id),
      oppslag: etter(g.oppslag, (o) => o.id),
      alleler: etter(g.alleler, (a) => a.navn),
    })
    const les = async (gensymbol: string) => lesDiplotypegrunnlag(await kallSom(db, 'authenticated')('les_cpic_diplotyper', { gensymbol }))
    for (const gen of ['CYP2C19', 'HLA-B']) {
      const lest = await les(gen)
      expect(lest.kilde).toMatchObject({ navn: 'CPIC', release: 'v1.60.1' })
      expect(ordnet(lest)).toEqual(ordnet(diplotypegrunnlagFra(UTDRAG, gen)))
    }
    const cyp2c19 = await les('CYP2C19')
    expect(cyp2c19.gen).toMatchObject({ symbol: 'CYP2C19', oppslagsmetode: 'PHENOTYPE' })
    expect(cyp2c19.oppslag.flatMap((o) => o.diplotyper)).toEqual(expect.arrayContaining(['*1/*17', '*17/*17']))
    expect(cyp2c19.alleler.map((a) => a.navn)).toEqual(expect.arrayContaining(['*1', '*17']))
    expect(JSON.stringify(cyp2c19)).not.toMatch(/"functionphenotypeid"|"diplotypekey"|"citations"/)
    // Et gen CPIC ikke har, gir ingenting, ikke en feil.
    expect(await les('FINNES-IKKE')).toMatchObject({ gen: null, genresultater: [], oppslag: [], alleler: [] })
  })

  it('laster ikke inn det som er uendret, og merker endrede og borte rader', async () => {
    await synkroniserCpic({ lager: lager(), api: falskApi() })
    const innlastet = vi.fn()
    const telleLager = { ...lager(), lastInn: async (...a: Parameters<ReturnType<typeof lager>['lastInn']>) => {
      innlastet(a[1])
      return lager().lastInn(...a)
    } }
    expect(await synkroniserCpic({ lager: telleLager, api: falskApi() })).toMatchObject({ status: 'uendret' })
    expect(innlastet).not.toHaveBeenCalled()

    const anbefalinger = UTDRAG.recommendation!
    const endret = anbefalinger.slice(1).map((r, i) => (i === 0 ? { ...r, drugrecommendation: 'Endret tekst', version: 2 } : r))
    const resultat = await synkroniserCpic({ lager: telleLager, api: falskApi({ recommendation: endret }) })
    expect(resultat).toMatchObject({ status: 'fullfort', antall: { anbefaling: { endrede: 1, utgatte: 1, nye: 0 }, legemiddel: { uendret: true } } })
    expect(innlastet.mock.calls.map((k) => k[0])).toEqual(['anbefaling'])

    const { rows } = await db.query<{ utgatt: number; versjon: number }>(
      `select (select count(*) from cpic.anbefaling where utgatt_kl is not null)::int as utgatt,
              (select cpic_versjon from cpic.anbefaling where data ->> 'anbefaling' = 'Endret tekst') as versjon`,
    )
    expect(rows[0]).toEqual({ utgatt: 1, versjon: 2 })
    // Den utgåtte vises ikke.
    const utvalg = await les([AMITRIPTYLIN, ABAKAVIR])
    expect(utvalg.anbefalinger).toHaveLength(anbefalinger.length - 1)
    expect((await logg()).map((l) => l.status)).toEqual(['fullfort', 'uendret', 'fullfort'])
  })

  it('oppgir releasen fra siste vellykkede kjøring, også når dataene var uendret', async () => {
    await synkroniserCpic({ lager: lager(), api: falskApi({}, { ...KILDE, release: null }) })
    expect((await les([AMITRIPTYLIN])).kilde.release).toBeNull()
    const nyRelease = { ...KILDE, release: 'v1.61.0', skjemaversjon: '83' }
    expect(await synkroniserCpic({ lager: lager(), api: falskApi({}, nyRelease) })).toMatchObject({ status: 'uendret' })
    // En kjøring der GitHub ikke svarte, visker ikke ut releasen som er kjent.
    await synkroniserCpic({ lager: lager(), api: falskApi({}, { ...nyRelease, release: null }) })
    const { kilde } = await les([AMITRIPTYLIN])
    expect(kilde).toMatchObject({ release: 'v1.61.0', skjemaversjon: '83' })
    const [forste] = await logg()
    expect(forste!.status).toBe('fullfort')
    expect(kilde.endret_kl! < kilde.kontrollert_kl!).toBe(true)
  })

  it('beholder siste gyldige datasett når CPIC feiler, uttrekket er for lite eller ikke henger sammen', async () => {
    await synkroniserCpic({ lager: lager(), api: falskApi() })
    const foer = await les([AMITRIPTYLIN, ABAKAVIR])

    const nede = await synkroniserCpic({ lager: lager(), api: falskApi({ allele: new Error('CPIC svarte 500 for allele.') }) })
    expect(nede).toMatchObject({ status: 'feilet', feil: 'CPIC svarte 500 for allele.' })

    const for_lite = await synkroniserCpic({ lager: lager(), api: falskApi({ recommendation: UTDRAG.recommendation!.slice(0, 2) }) })
    expect(for_lite).toMatchObject({ status: 'feilet' })
    expect((for_lite as { feil: string }).feil).toMatch(/ser ufullstendig ut: 2 rader av typen anbefaling/)

    const uten_gen = UTDRAG.gene!.filter((g) => g.symbol !== 'HLA-B')
    const brutt = await synkroniserCpic({ lager: lager(), api: falskApi({ gene: uten_gen }) })
    expect((brutt as { feil: string }).feil).toMatch(/henger ikke sammen: \d+ rader av typen (allel|genresultat|par) viser til gen/)

    const etter = await les([AMITRIPTYLIN, ABAKAVIR])
    expect(etter.anbefalinger).toEqual(foer.anbefalinger)
    expect(etter.gener).toEqual(foer.gener)
    expect((await logg()).map((l) => l.status)).toEqual(['fullfort', 'feilet', 'feilet', 'feilet'])
    // Mellomlageret er tomt etter en feilet kjøring.
    expect((await db.query<{ n: number }>('select count(*)::int as n from cpic.innlasting')).rows[0]!.n).toBe(0)
  })

  it('godtar ikke en type meldt uendret når kontrollsummen ikke stemmer, eller en ufullstendig innlasting', async () => {
    await synkroniserCpic({ lager: lager(), api: falskApi() })
    const synk = await lager().start('manuell')
    const forrige = await lager().forrige()
    const entiteter = Object.fromEntries(
      ENTITETER.map((e) => [e, { antall: 1, sha256: forrige.entiteter[e]!, lastet: false, forkastet: 0 }]),
    ) as Parameters<ReturnType<typeof lager>['fullfor']>[1]['entiteter']
    const innhold = { ...KILDE, parserversjon: 1, entiteter }
    const falsk = { ...innhold, entiteter: { ...entiteter, gen: { ...entiteter.gen, sha256: 'annen' } } }
    expect((await feilFra(() => lager().fullfor(synk, falsk)))?.message).toMatch(/meldt uendret/)
    const halv = { ...innhold, entiteter: { ...entiteter, term: { antall: 3, sha256: 'ny', lastet: true, forkastet: 0 } } }
    expect((await feilFra(() => lager().fullfor(synk, halv)))?.message).toMatch(/ufullstendig: 0 rader, mot 3 meldt/)
    await lager().avbryt(synk, 'Stoppet i testen')
  })

  describe('endringsloggen', () => {
    type Rad = { art: string; niva: string; type: string; objekt_id: string; felt: string[]; etikett: string; spor: Record<string, unknown>; synk_id: number | null }
    const endringer = async () =>
      (await db.query<Rad>(
        `select art, niva, type, objekt_id, felt, etikett, spor, synk_id from datakilder.endringer
         where kilde = 'cpic' order by id`,
      )).rows

    beforeEach(async () => {
      await db.exec('truncate datakilder.endringer')
    })

    it('logger første innlasting som ett grunnlag per type, og ingenting når intet er endret', async () => {
      const forste = await synkroniserCpic({ lager: lager(), api: falskApi() })
      const logget = await endringer()
      expect(logget.map((e) => e.type).sort()).toEqual([...ENTITETER].sort())
      expect(logget.every((e) => e.art === 'grunnlag' && e.synk_id === forste.synk)).toBe(true)
      expect(logget.find((e) => e.type === 'diplotype')!.spor).toEqual({ antall: UTDRAG.gene_result_diplotype!.length })

      await db.exec('truncate datakilder.endringer')
      await synkroniserCpic({ lager: lager(), api: falskApi() })
      expect(await endringer()).toEqual([])
    })

    it('skiller en endret anbefaling fra en ny publikasjonstittel, og logger det som er borte', async () => {
      await synkroniserCpic({ lager: lager(), api: falskApi() })
      await db.exec('truncate datakilder.endringer')

      const anbefalinger = UTDRAG.recommendation!
      const endret = anbefalinger.slice(1).map((r, i) => (i === 0 ? { ...r, drugrecommendation: 'Endret tekst', version: Number(r.version) + 1 } : r))
      const publikasjoner = UTDRAG.publication!.map((r, i) => (i === 0 ? { ...r, title: 'Ny tittel' } : r))
      const resultat = await synkroniserCpic({ lager: lager(), api: falskApi({ recommendation: endret, publication: publikasjoner }) })

      const logget = await endringer()
      expect(logget.every((e) => e.synk_id === resultat.synk)).toBe(true)
      const [anbefaling] = logget.filter((e) => e.type === 'anbefaling' && e.art === 'endret')
      expect(anbefaling).toMatchObject({ niva: 'klinisk', objekt_id: String(anbefalinger[1]!.id), felt: ['anbefaling'] })
      expect(anbefaling!.spor).toEqual({ cpic_versjon: { foer: anbefalinger[1]!.version, etter: Number(anbefalinger[1]!.version) + 1 } })
      // Etiketten sier hvilket legemiddel og hvilke genresultater anbefalingen gjelder.
      expect(anbefaling!.etikett).toMatch(/^(amitriptyline|abacavir) · /)
      expect(logget.filter((e) => e.art === 'fjernet')).toEqual([
        expect.objectContaining({ type: 'anbefaling', niva: 'klinisk', objekt_id: String(anbefalinger[0]!.id) }),
      ])
      expect(logget.filter((e) => e.type === 'publikasjon')).toEqual([
        expect.objectContaining({ art: 'endret', niva: 'metadata', felt: ['tittel'], etikett: 'Ny tittel' }),
      ])

      // Kommer den tilbake, er den ny igjen.
      await db.exec('truncate datakilder.endringer')
      await synkroniserCpic({ lager: lager(), api: falskApi({ recommendation: [anbefalinger[0]!, ...endret], publication: publikasjoner }) })
      expect(await endringer()).toEqual([
        expect.objectContaining({ art: 'ny', type: 'anbefaling', niva: 'klinisk', objekt_id: String(anbefalinger[0]!.id), spor: expect.objectContaining({ tilbake: true }) }),
      ])
    })

    it('logger en endring bare i rådataene som metadata, og ingenting fra en avvist kjøring', async () => {
      await synkroniserCpic({ lager: lager(), api: falskApi() })
      await db.exec('truncate datakilder.endringer')
      const gener = UTDRAG.gene!.map((g, i) => (i === 0 ? { ...g, frequencymethods: 'Ny metode' } : g))
      await synkroniserCpic({ lager: lager(), api: falskApi({ gene: gener }) })
      expect(await endringer()).toEqual([
        expect.objectContaining({ art: 'endret', niva: 'metadata', type: 'gen', felt: ['raa.frequencymethods'] }),
      ])

      await db.exec('truncate datakilder.endringer')
      const endret = UTDRAG.recommendation!.map((r) => ({ ...r, drugrecommendation: 'Alt endret' }))
      const brutt = await synkroniserCpic({ lager: lager(), api: falskApi({ recommendation: endret, gene: UTDRAG.gene!.filter((g) => g.symbol !== 'HLA-B') }) })
      expect(brutt).toMatchObject({ status: 'feilet' })
      expect(await endringer()).toEqual([])
    })
  })

  it('kjører én synkronisering om gangen', async () => {
    const forste = await lager().start('cron')
    expect((await feilFra(() => lager().start('manuell')))?.message).toContain('pågår allerede')
    await lager().avbryt(forste, 'Stoppet i testen')
    expect(await lager().start('manuell')).toBeGreaterThan(forste)
  })

  it('lar bare serveren skrive, og bare innloggede lese', async () => {
    const innlogget = kallSom(db, 'authenticated')
    const anonym = kallSom(db, 'anon')
    expect((await feilFra(() => innlogget('cpic_start_synk', { utlost_av: 'cron' })))?.code).toBe('42501')
    expect((await feilFra(() => innlogget('cpic_forrige_synk', {})))?.code).toBe('42501')
    expect((await feilFra(() => anonym('les_cpic', { clinpgx_ider: [AMITRIPTYLIN] })))?.code).toBe('42501')
    expect((await feilFra(() => anonym('cpic_status', {})))?.code).toBe('42501')
    expect(await innlogget('les_cpic', { clinpgx_ider: [AMITRIPTYLIN] })).toMatchObject({ kilde: { navn: 'CPIC' } })
    expect(await innlogget('cpic_status', {})).toEqual(expect.any(Array))
    expect((await feilFra(() => anonym('les_cpic_diplotyper', { gensymbol: 'CYP2C19' })))?.code).toBe('42501')
    expect(await innlogget('les_cpic_diplotyper', { gensymbol: 'CYP2C19' })).toMatchObject({ kilde: { navn: 'CPIC' } })
    for (const sporring of ['select * from cpic.anbefaling', 'select * from cpic.anbefalingsbetingelser']) {
      const tabell = await feilFra(() =>
        db.transaction(async (tx) => {
          await tx.query(`select set_config('role', 'authenticated', true)`)
          await tx.query(sporring)
        }),
      )
      expect(tabell?.code).toBe('42501')
    }
  })
})

/* --- Endepunktet ----------------------------------------------------------- */

describe('endepunktet', () => {
  const MILJO = { CRON_SECRET: 'hemmelig', SUPABASE_URL: 'https://db.example', SUPABASE_SECRET_KEY: 'sb_secret_x' }
  const ferdig = { status: 'fullfort' as const, synk: 1, release: 'v1.60.1', antall: {} }

  function foresporsel(metode: string, token?: string) {
    return new Request('https://ousfar.example/api/cpic-synk', {
      method: metode,
      headers: token ? { authorization: `Bearer ${token}` } : {},
    })
  }

  it('synkroniserer for Vercels ukentlige kall og for en administrator', async () => {
    const synkroniser = vi.fn(async (_valg: object) => ferdig)
    const valg = { synkroniser, adminsjekk: async (t: string) => t === 'admin-token', api: falskApi() }
    expect((await behandleCpicSynk(foresporsel('GET', 'hemmelig'), MILJO, valg)).status).toBe(200)
    expect(synkroniser).toHaveBeenLastCalledWith(expect.objectContaining({ utlostAv: 'cron' }))
    expect((await behandleCpicSynk(foresporsel('POST', 'admin-token'), MILJO, valg)).status).toBe(200)
    expect(synkroniser).toHaveBeenLastCalledWith(expect.objectContaining({ utlostAv: 'manuell' }))
  })

  it('avviser kall uten tilgang og uten oppkoblingen mot databasen, og gjør en feilet kjøring synlig', async () => {
    const synkroniser = vi.fn(async () => ferdig)
    const valg = { synkroniser, adminsjekk: async (t: string) => t === 'admin-token', api: falskApi() }
    expect((await behandleCpicSynk(foresporsel('GET'), MILJO, valg)).status).toBe(401)
    expect((await behandleCpicSynk(foresporsel('POST', 'hemmelig'), MILJO, valg)).status).toBe(401)
    expect((await behandleCpicSynk(foresporsel('GET', 'admin-token'), MILJO, valg)).status).toBe(401)
    expect((await behandleCpicSynk(foresporsel('DELETE', 'admin-token'), MILJO, valg)).status).toBe(405)
    expect((await behandleCpicSynk(foresporsel('GET', 'hemmelig'), { CRON_SECRET: 'hemmelig' }, valg)).status).toBe(500)
    expect(synkroniser).not.toHaveBeenCalled()
    const feilet = vi.fn(async () => ({ status: 'feilet' as const, synk: 2, feil: 'nede' }))
    expect((await behandleCpicSynk(foresporsel('GET', 'hemmelig'), MILJO, { ...valg, synkroniser: feilet })).status).toBe(502)
  })
})
