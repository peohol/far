/**
 * Importen av psykofarmakasidene (arbeidspakke 4): datasettet, planen og
 * SQL-en, prøvd mot en ekte database.
 *
 * Datasettet i `supabase/import/psykofarmaka/` er hentet fra
 * `originaldata/Psykofarmaka.pdf` og Felleskatalogen. Her kontrolleres at det
 * dekker alle antidepressivene og antipsykotikaene appen kjenner, at det har
 * formen appen leser, og at importen legger det inn slik historikken skal vise
 * det: publisert, ført på administratoren som bestilte den, og med kilden i
 * hver revisjon.
 */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { byggKatalog, FORTOLKNINGSOPPFORINGER } from '../domain/analyttkatalog'
import { byggSidemodell } from '../faginnhold/analyttside'
import {
  byggImportplan,
  doserader,
  Importfeil,
  importmigrasjoner,
  importSql,
  KURSENDRINGSKILDER,
  kursendringSql,
  lit,
  kinetikktittel,
  sidetekst,
  tilDokument,
  type Importfil,
  type Importplan,
} from '../faginnhold/import'
import { lagFaginnholdsleser, type Analyttsidedata } from '../faginnhold/lesing'
import { lesIntervallverdi, lesRiktekst } from '../faginnhold/paneler'
import { PSYKOFARMAKA_FILER, PSYKOFARMAKA_KILDE, PSYKOFARMAKA_REFERANSER, psykofarmakaplan } from '../faginnhold/psykofarmaka'
import {
  faginnholdskall,
  kjorMigrasjoner,
  migrasjonsfiler,
  nyDatabase,
  opprettBruker,
  type Faginnholdskall,
} from './hjelp/testdatabase'

const katalog = byggKatalog(FORTOLKNINGSOPPFORINGER)
const MIGRASJONSMAPPE = new URL('../../supabase/migrations/', import.meta.url)
const FORSTE_IMPORTMIGRASJON = '20260923072247'
/**
 * Den første senere omarbeidingen av sidene. Her prøves importen slik den sto
 * før den; omarbeidingene prøves i `monografomarbeiding.test.ts`.
 */
const FORSTE_OMARBEIDING = migrasjonsfiler().find((f) => f.endsWith('_viktige_data_former.sql'))!

/**
 * Migrasjonene importen og kursendringen ble rullet ut som, med md5-en
 * produksjonen har registrert for dem (`supabase_migrations.schema_migrations`).
 * De er kjørt og skal aldri endres; datasettet kan endre seg etter dem.
 */
const KJORT_I_PRODUKSJONEN: Record<string, string> = {
  '20260923064740_revisjonskilde.sql': 'd878f21f31b80f67459fcb4157c3a327',
  '20260923072247_psykofarmaka_import_01.sql': '693bbd301854bb6fdb21c7900bf30e8c',
  '20260923072458_psykofarmaka_import_02.sql': '9b46c8c37a3ab70e7f4c0360e9a2b59e',
  '20260923072751_psykofarmaka_import_03.sql': 'adeffa7ac56543aa0352c1c8c49d429d',
  '20260923072813_psykofarmaka_import_05.sql': '9f628f5d6df7241198f83060bf07622c',
  '20260923072824_psykofarmaka_import_12.sql': 'ce26f70a05c90fa133720ca53dafe994',
  '20260923073223_psykofarmaka_import_08.sql': '5275b43e4d3629620728930cb0047a41',
  '20260923073243_psykofarmaka_import_04.sql': 'e0fbcc7a18068f38c8db1b01d7b3b62b',
  '20260923073308_psykofarmaka_import_11.sql': 'fd0f66065278a0501093bc7c9a5c45e7',
  '20260923073309_psykofarmaka_import_14.sql': 'c5cce369527890f60f9180bc7aa2ae64',
  '20260923073453_psykofarmaka_import_09.sql': 'd7175855f0c226c9aa95d41daff860e9',
  '20260923073455_psykofarmaka_import_15.sql': 'ae7492d3269983d0f4fd7f765fc33751',
  '20260923073513_psykofarmaka_import_13.sql': 'ec3494ab545b43ddc8655e771a9b0cd2',
  '20260923073520_psykofarmaka_import_06.sql': '00df743f6985e0815d50fc4f02719344',
  '20260923073659_psykofarmaka_import_10.sql': '31566db9719951adc53ef5d81a9bdf05',
  '20260923073743_psykofarmaka_import_07.sql': '39f5bf66cf1b192ddd429a5a00ed3869',
  '20260923085447_psykofarmaka_kursendring.sql': '46294ad63d9de983aaf8d6bdb9d59dfe',
}

/* --- Datasettet ----------------------------------------------------------- */

describe('datasettet', () => {
  const plan = psykofarmakaplan(katalog)

  it('dekker alle antidepressivene og antipsykotikaene i serum, og lamotrigin', () => {
    const forventet = katalog.oppforinger
      .filter((o) => ['Antidepressiver', 'Antipsykotika'].includes(o.kategori) || o.kode === 'LAM')
      .map((o) => o.kode)
      .sort()
    expect(plan.koder.map((k) => k.kode).sort()).toEqual(forventet)
  })

  it('knytter hver kode til siden og stoffene katalogen sier', () => {
    for (const kode of plan.koder) {
      const oppforing = katalog.finn(kode.kode!)!
      expect(kode.hovedside.navn).toBe(oppforing.sidenavn)
      expect(kode.komponenter.map((k) => k.navn)).toEqual(oppforing.komponenter)
    }
  })

  it('oppgir Felleskatalogen som kilde for indikasjonene, uten en kontrolldato å vedlikeholde', () => {
    const indikasjoner = plan.koder.flatMap((k) => k.elementer.filter((e) => e.panel === 'indikasjon'))
    expect(indikasjoner).toHaveLength(plan.koder.length)
    for (const e of indikasjoner) {
      expect(e.referanser.some((r) => r.startsWith('fk-')), e.panel).toBe(true)
      expect(Object.keys(e.data)).toEqual(['dokument'])
      expect(e.kilde).toBe('Hentet fra Felleskatalogen 23.09.2026')
    }
  })

  it('har ingen preparatnavn: de skal hentes fra offentlige legemiddeldata', () => {
    expect(plan.koder.flatMap((k) => k.elementer).filter((e) => e.panel === 'identitet')).toEqual([])
  })

  it('siterer grunnlaget for toksisitetsdataene på kortene for toksisk og alvorlig intoksikasjon', () => {
    const kort = plan.koder.flatMap((k) =>
      k.elementer.filter((e) => e.elementtype === 'toksisk_omrade' || e.elementtype === 'alvorlig_intoksikasjon'),
    )
    expect(kort.length).toBeGreaterThan(0)
    for (const e of kort) expect(e.referanser).toEqual(expect.arrayContaining(['schulz2020', 'hiemke2017']))
  })

  it('fører innholdet fra PDF-en tilbake til sidene det står på', () => {
    for (const kode of plan.koder) {
      const fil = PSYKOFARMAKA_FILER.find((f) => f.kode === kode.kode)!
      expect(kode.kilde).toBe(`Importert fra Psykofarmaka.pdf, ${sidetekst(fil.sider ?? [])}`)
      for (const e of kode.elementer.filter((e) => e.panel !== 'indikasjon')) {
        expect(e.kilde).toBe(kode.kilde)
      }
    }
  })

  it('tar bare med referansene som faktisk brukes, alle med en gyldig lenke eller tittel', () => {
    const brukt = new Set(plan.koder.flatMap((k) => k.elementer.flatMap((e) => e.referanser)))
    expect(new Set(plan.referanser.map((r) => r.nokkel))).toEqual(brukt)
    for (const { innhold } of plan.referanser) {
      expect(innhold.tittel || innhold.forfattere).not.toBe('')
      if (innhold.lenke) expect(innhold.lenke).toMatch(/^https?:\/\/\S+$/)
    }
  })
})

/* --- Byggesteinene -------------------------------------------------------- */

describe('byggesteinene', () => {
  it('gjør tekststykkene om til riktekst med senket skrift, hevet skrift og lenker', () => {
    expect(tilDokument(['t_{1/2} er 10^{3}, se [kilden](https://eksempel.no).', { punkter: ['A', 'B'] }])).toEqual({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 't' },
            { type: 'text', text: '1/2', marks: [{ type: 'subscript' }] },
            { type: 'text', text: ' er 10' },
            { type: 'text', text: '3', marks: [{ type: 'superscript' }] },
            { type: 'text', text: ', se ' },
            { type: 'text', text: 'kilden', marks: [{ type: 'link', attrs: { href: 'https://eksempel.no' } }] },
            { type: 'text', text: '.' },
          ],
        },
        {
          type: 'bulletList',
          content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A' }] }] },
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'B' }] }] },
          ],
        },
      ],
    })
  })

  it('lager én rad per dose i persentiltabellene, og hopper over doser uten tall', () => {
    const rader = doserader({
      tabeller: [
        {
          stoff: 'Testmiddel',
          kilde: 'Nordmann et al. (2020)',
          enhet: 'nmol/L',
          doser: ['10 mg', '20 mg', 'Alle'],
          antall: [5, 1200, 1205],
          p10: [1, null, null],
          median: [2, 2500, null],
          p90: [3, null, null],
        },
      ],
      referanseomradeprosjektet: { doser: '10–20 mg', enhet: 'nmol/L', p10: 4, p90: 5 },
      rader: [{ dose: '30 mg', regime: '1 gang daglig', konsentrasjon: 'Ca. 7 nmol/L', merknad: 'Annen kilde.' }],
    })
    expect(rader).toEqual([
      {
        dose: '10 mg',
        regime: '',
        konsentrasjon: 'Median 2 nmol/L (10.–90. persentil: 1–3)',
        merknad: 'Testmiddel. 5 prøver. Nordmann et al. (2020)',
      },
      // Vanlig mellomrom mellom tusener: et hardt mellomrom er usynlig og kan bli byttet ut på veien.
      { dose: '20 mg', regime: '', konsentrasjon: 'Median 2 500 nmol/L', merknad: 'Testmiddel. 1 200 prøver. Nordmann et al. (2020)' },
      {
        dose: '10–20 mg',
        regime: '',
        konsentrasjon: '10.–90. persentil: 4–5 nmol/L',
        merknad: 'Referanseområdeprosjektet 2005–2008 (Diakonhjemmet/St. Olavs).',
      },
      { dose: '30 mg', regime: '1 gang daglig', konsentrasjon: 'Ca. 7 nmol/L', merknad: 'Annen kilde.' },
    ])
  })

  it('skriver sidene som i historikken', () => {
    expect(sidetekst([7])).toBe('side 7')
    expect(sidetekst([9, 8])).toBe('side 8–9')
    expect(sidetekst([24, 26])).toBe('side 24, 26')
  })

  it('viser overskriftene med senket skrift som på kortene i kilden', () => {
    expect(['tmax', 't1/2', 'tss', 'VD', 'Eliminasjon'].map(kinetikktittel)).toEqual(['tₘₐₓ', 't½', 'tₛₛ', 'Vd', 'Eliminasjon'])
  })

  it('stopper på alle feilene i datasettet samtidig', () => {
    const filer = [
      { kode: 'FINNESIKKE', sider: [1] },
      {
        kode: 'SERT',
        sider: [24],
        ukjent: true,
        preparater: { navn: ['Preparat'] },
        viktige_data: { referanseomrade: { nedre: 20, ovre: 10, enhet: 'nmol/L' } },
        farmakodynamikk: { tekst: ['Tekst'], referanser: ['mangler'] },
        serumkonsentrasjoner: {
          tabeller: [{ stoff: 'S', kilde: 'K', enhet: 'nmol/L', doser: ['1 mg'], antall: [], p10: [], median: [], p90: [] }],
        },
      },
    ] as unknown as Importfil[]
    let feil: string[] = []
    try {
      byggImportplan(filer, {}, katalog, PSYKOFARMAKA_KILDE)
    } catch (e) {
      expect(e).toBeInstanceOf(Importfeil)
      feil = (e as Importfeil).feil
    }
    expect(feil).toEqual(
      expect.arrayContaining([
        'FINNESIKKE: koden finnes ikke i katalogen.',
        'SERT: ukjent felt «ukjent».',
        'SERT: ukjent felt «preparater».',
        'SERT referanseomrade: Nedre grense kan ikke være høyere enn øvre.',
        'SERT farmakodynamikk/riktekst: referansen «mangler» er ikke definert.',
        'SERT serumkonsentrasjoner «S»: kolonnene må ha like mange verdier som dosene.',
      ]),
    )
  })
})

/* --- Importen i databasen ------------------------------------------------- */

describe('importen i databasen', () => {
  let db: PGlite
  let admin: string
  let bruker: string
  let kall: Faginnholdskall
  let plan: Importplan
  let sider: Map<string, Analyttsidedata>

  const antallObjekter = async () =>
    (await kall.fasit<{ n: number }>('select count(*)::int as n from public.redigerbare_objekter'))[0]!.n
  const antallRevisjoner = async () =>
    (await kall.fasit<{ n: number }>('select count(*)::int as n from public.objektrevisjoner'))[0]!.n
  const synlige = (side: Analyttsidedata) => side.elementer.filter((e) => e.innhold.panel !== 'fjernet')

  beforeAll(async () => {
    // Slik produksjonen fikk den: administratoren fantes da importen og
    // kursendringen ble rullet ut, som migrasjonene de er lagret som.
    db = await nyDatabase({ til: FORSTE_IMPORTMIGRASJON })
    admin = await opprettBruker(db, { brukernavn: 'peohol', fornavn: 'Rita', etternavn: 'Redaktør', rolle: 'admin' })
    bruker = await opprettBruker(db, { brukernavn: 'leser', fornavn: 'Lars', etternavn: 'Leser', rolle: 'user' })
    await kjorMigrasjoner(db, { fra: FORSTE_IMPORTMIGRASJON, til: FORSTE_OMARBEIDING })
    kall = faginnholdskall(db, admin)
    plan = psykofarmakaplan(katalog)

    const leser = lagFaginnholdsleser(kall.klientFor(bruker))
    sider = new Map()
    for (const { kode } of plan.koder) sider.set(kode!, await leser.lesAnalyttside(kode!, 'publisert'))
  }, 120_000)

  it('viser nøyaktig det datasettet har, side for side, synlig for vanlige brukere', () => {
    const referanse = new Map(plan.referanser.map((r) => [r.nokkel, r.innhold]))
    const sortert = <T extends { panel: string; elementtype: string; posisjon: number }>(liste: T[]) =>
      [...liste].sort((a, b) => `${a.panel}/${a.elementtype}/${a.posisjon}`.localeCompare(`${b.panel}/${b.elementtype}/${b.posisjon}`))
    for (const kode of plan.koder) {
      const side = sider.get(kode.kode!)!
      expect(side.analytt?.innhold.kode, kode.kode!).toBe(kode.kode)
      expect(side.infoside?.innhold.navn).toBe(kode.hovedside.navn)
      expect(side.komponenter.map((k) => k.innhold.navn)).toEqual(kode.komponenter.map((k) => k.navn))
      const iDatabasen = new Map(side.referanser.map((r) => [r.id, r.innhold]))
      const vist = synlige(side).map(({ innhold: { panel, posisjon, elementtype, data, referanser = [] } }) => ({
        panel,
        posisjon,
        elementtype,
        data,
        referanser: referanser.map((id) => iDatabasen.get(id)),
      }))
      const forventet = kode.elementer.map(({ panel, posisjon, elementtype, data, referanser }) => ({
        panel,
        posisjon,
        elementtype,
        data,
        referanser: referanser.map((n) => expect.objectContaining(referanse.get(n))),
      }))
      expect(sortert(vist), kode.kode!).toEqual(sortert(forventet))
    }
  })

  it('legger inn verdiene slik datasettet har dem', () => {
    const side = sider.get('AMTNORSUM')!
    const element = (type: string) => synlige(side).find((e) => e.innhold.elementtype === type)!
    expect(lesIntervallverdi(element('referanseomrade').innhold.data)).toEqual({
      nedre: 400,
      ovre: 900,
      enhet: 'nmol/L',
      forbehold: 'Amitriptylin + nortriptylin.',
    })
    const indikasjon = synlige(side).find((e) => e.innhold.panel === 'indikasjon')!
    expect(lesRiktekst(indikasjon.innhold.data).dokument.content?.length).toBeGreaterThan(0)
  })

  it('viser kilden i historikken: siden i PDF-en, eller hva kursendringen gjorde', () => {
    const side = sider.get('AMTNORSUM')!
    for (const e of synlige(side)) {
      expect(e.kilde).toBe(e.innhold.panel === 'indikasjon' ? KURSENDRINGSKILDER.kontrolldato : 'Importert fra Psykofarmaka.pdf, side 7')
      expect([e.endret_av_fornavn, e.endret_av_etternavn]).toEqual(['Rita', 'Redaktør'])
    }
    expect(side.infoside?.kilde).toBe('Importert fra Psykofarmaka.pdf, side 7')
  })

  it('tok bort preparatnavnene og kontrolldatoen i nye revisjoner, så de står i historikken', async () => {
    for (const kode of plan.koder) {
      const side = sider.get(kode.kode!)!
      const preparater = side.elementer.filter((e) => e.innhold.elementtype === 'preparater')
      expect(preparater, kode.kode!).toHaveLength(1)
      expect(preparater[0]).toMatchObject({ revisjon: 2, publisert_revisjon: 2, kilde: KURSENDRINGSKILDER.preparater })
      expect(preparater[0]!.innhold.panel).toBe('fjernet')
      const indikasjon = synlige(side).find((e) => e.innhold.panel === 'indikasjon')!
      expect(indikasjon).toMatchObject({ revisjon: 2, publisert_revisjon: 2, kilde: KURSENDRINGSKILDER.kontrolldato })
      for (const e of synlige(side).filter((e) => e.id !== indikasjon.id)) expect(e.revisjon).toBe(1)
    }
    const forste = await kall.fasit<{ data: Record<string, unknown> }>(
      "select innhold->'data' as data from public.objektrevisjoner where revisjon = 1 and innhold->>'panel' = 'indikasjon'",
    )
    expect(forste).toHaveLength(plan.koder.length)
    for (const { data } of forste) expect(data.kontrollert).toBe(PSYKOFARMAKA_KILDE.felleskatalogen)
  })

  it('fører alt på administratoren som opprettet, og publiserer hver revisjon', async () => {
    const rader = await kall.fasit<{ utfort_av: string; handling: string; revisjon: number; kilde: string | null }>(
      'select utfort_av, handling, revisjon, kilde from public.objektrevisjoner',
    )
    expect(rader.length).toBeGreaterThan(0)
    for (const rad of rader) {
      expect(rad.utfort_av).toBe(admin)
      if (rad.revisjon === 1) expect(rad).toMatchObject({ handling: 'opprettet' })
      else expect(rad).toMatchObject({ handling: 'endret', revisjon: 2, kilde: expect.stringMatching(/^Tatt bort: /) })
    }
    expect(rader.every((r) => r.kilde !== null)).toBe(true)
    const upublisert = await kall.fasit(
      "select 1 from public.objekttilstander u join public.objekttilstander p on p.objekt_id = u.objekt_id and p.tilstand = 'publisert' where u.tilstand = 'utkast' and u.revisjon <> p.revisjon",
    )
    expect(upublisert).toEqual([])
  })

  it('bruker samme side for et stoff som både har en egen kode og er komponent i en sumanalyse', () => {
    const nortriptylin = sider.get('NOR')!.infoside!.id
    expect(sider.get('AMTNORSUM')!.komponenter.map((k) => k.id)).toContain(nortriptylin)
  })

  it('legger hver referanse inn én gang, og nummererer dem på siden', async () => {
    const referanser = await kall.fasit<{ tittel: string }>(
      "select tittel from public.referanser where tilstand = 'publisert'",
    )
    for (const { innhold } of plan.referanser) {
      expect(referanser.filter((r) => r.tittel === innhold.tittel), innhold.tittel).toHaveLength(1)
    }
    const liste = byggSidemodell(sider.get('AMTNORSUM')!).referanseliste
    expect(liste.map((r) => r.referanse.tittel)).toContain(PSYKOFARMAKA_REFERANSER.reis2009!.tittel)
  })

  it('kan kjøres igjen uten å legge inn noe to ganger', async () => {
    const for_ = await antallObjekter()
    for (const blokk of importSql(plan, 'peohol')) await db.exec(blokk)
    await db.exec(kursendringSql('peohol'))
    expect(await antallObjekter()).toBe(for_)
  })

  it('krever en administrator', async () => {
    await expect(db.exec(importSql(plan, 'leser')[0]!)).rejects.toThrow('Fant ingen administrator med brukernavnet leser.')
  })

  it('får tekster inn i databasen tegn for tegn, også usynlige tegn og lange tekster', async () => {
    const tekster = ["O'Brien \\ 1 026", 'x'.repeat(401) + ' ' + "'".repeat(3), '']
    for (const tekst of tekster) {
      const [rad] = await kall.fasit<{ t: string }>(`select ${lit(tekst)} as t`)
      expect(rad!.t).toBe(tekst)
    }
  })

  it('gjør ingenting som migrasjon der administratoren ikke finnes', async () => {
    const [objekter, revisjoner] = [await antallObjekter(), await antallRevisjoner()]
    await db.exec(importmigrasjoner(plan, 'leser')[0]!)
    await db.exec(kursendringSql('leser'))
    expect([await antallObjekter(), await antallRevisjoner()]).toEqual([objekter, revisjoner])
  })

  it('gir vanlige endringer i appen ingen kilde', async () => {
    const element = sider.get('AMTNORSUM')!.elementer.find((e) => e.innhold.elementtype === 'referanseomrade')!
    await kall.lagre(element.id, 1, { ...element.innhold, data: { ...element.innhold.data, forbehold: 'Endret.' } })
    const [rad] = await kall.fasit<{ kilde: string | null }>(
      'select kilde from public.objektrevisjoner where objekt_id = $1 and revisjon = 2',
      [element.id],
    )
    expect(rad!.kilde).toBeNull()
    const utkast = await lagFaginnholdsleser(kall.klientFor(admin)).lesAnalyttside('AMTNORSUM', 'utkast')
    expect(utkast.elementer.find((e) => e.id === element.id)).not.toHaveProperty('kilde')
  })
})

describe('importen som migrasjoner', () => {
  const plan = psykofarmakaplan(katalog)

  it('har alle blokkene, i samme rekkefølge, i filer under grensen', () => {
    const blokker = importSql(plan, 'peohol', 'hopp over')
    const filer = importmigrasjoner(plan, 'peohol', 40_000)
    expect(filer.join('\n\n')).toBe(blokker.join('\n\n'))
    for (const fil of filer) expect(fil.length <= 40_000 || blokker.includes(fil)).toBe(true)
    expect(filer.length).toBeLessThan(blokker.length)
  })

  it('lar migrasjonene som er kjørt i produksjonen, stå byte for byte som de ble kjørt', () => {
    const kjorte = migrasjonsfiler().filter((f) => /_(revisjonskilde|psykofarmaka_\w+)\.sql$/.test(f))
    const avtrykk = Object.fromEntries(
      kjorte.map((f) => [f, createHash('md5').update(readFileSync(new URL(f, MIGRASJONSMAPPE))).digest('hex')]),
    )
    expect(avtrykk).toEqual(KJORT_I_PRODUKSJONEN)
  })

  it('har kursendringen i sin egen migrasjon', () => {
    const filer = migrasjonsfiler().filter((f) => /^\d+_psykofarmaka_kursendring\.sql$/.test(f))
    expect(filer.map((f) => readFileSync(new URL(f, MIGRASJONSMAPPE), 'utf8'))).toEqual([kursendringSql('peohol')])
  })

  it('har ingen usynlige tegn, som kan bli byttet ut på veien inn i databasen', () => {
    for (const fil of importmigrasjoner(plan, 'peohol')) expect(fil).not.toMatch(/[\u00a0\u00ad\u2000-\u200f\u2028-\u202f\ufeff]/)
  })

  it('stopper ikke når administratoren mangler, men hopper over', () => {
    const [blokk] = importmigrasjoner(plan, 'peohol')
    expect(blokk).toContain('importen hoppes over')
    expect(blokk).not.toContain('raise exception \'Fant ingen administrator')
  })
})
