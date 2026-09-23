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
import { readdirSync, readFileSync } from 'node:fs'
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
  lit,
  kinetikktittel,
  sidetekst,
  tilDokument,
  type Importfil,
  type Importplan,
} from '../faginnhold/import'
import { lagFaginnholdsleser, type Analyttsidedata } from '../faginnhold/lesing'
import { lesIntervallverdi, lesPreparater, lesRiktekst } from '../faginnhold/paneler'
import { PSYKOFARMAKA_FILER, PSYKOFARMAKA_KILDE, PSYKOFARMAKA_REFERANSER, psykofarmakaplan } from '../faginnhold/psykofarmaka'
import { faginnholdskall, nyDatabase, opprettBruker, type Faginnholdskall } from './hjelp/testdatabase'

const katalog = byggKatalog(FORTOLKNINGSOPPFORINGER)

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
      const oppforing = katalog.finn(kode.kode)!
      expect(kode.hovedside.navn).toBe(oppforing.sidenavn)
      expect(kode.komponenter.map((k) => k.navn)).toEqual(oppforing.komponenter)
    }
  })

  it('oppgir kilden til alt som kommer fra Felleskatalogen, med datoen det ble kontrollert', () => {
    const fraFelleskatalogen = plan.koder.flatMap((k) =>
      k.elementer.filter((e) => e.panel === 'identitet' || e.panel === 'indikasjon'),
    )
    expect(fraFelleskatalogen.length).toBeGreaterThan(0)
    for (const e of fraFelleskatalogen) {
      expect(e.referanser.some((r) => r.startsWith('fk-')), `${e.panel}`).toBe(true)
      expect(e.data.kontrollert).toBe(PSYKOFARMAKA_KILDE.felleskatalogen)
      expect(e.kilde).toBe('Hentet fra Felleskatalogen 23.09.2026')
    }
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
      expect(kode.kilde).toBe(`Importert fra Psykofarmaka.pdf, ${sidetekst(fil.sider)}`)
      for (const e of kode.elementer.filter((e) => e.panel !== 'identitet' && e.panel !== 'indikasjon')) {
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

  beforeAll(async () => {
    db = await nyDatabase()
    admin = await opprettBruker(db, { brukernavn: 'redaktor', fornavn: 'Rita', etternavn: 'Redaktør', rolle: 'admin' })
    bruker = await opprettBruker(db, { brukernavn: 'leser', fornavn: 'Lars', etternavn: 'Leser', rolle: 'user' })
    kall = faginnholdskall(db, admin)
    plan = psykofarmakaplan(katalog)
    // Slik den rulles ut: som migrasjoner.
    for (const migrasjon of importmigrasjoner(plan, 'redaktor')) await db.exec(migrasjon)

    const leser = lagFaginnholdsleser(kall.klientFor(bruker))
    sider = new Map()
    for (const { kode } of plan.koder) sider.set(kode, await leser.lesAnalyttside(kode, 'publisert'))
  }, 120_000)

  it('publiserer hver side med alt innholdet, synlig for vanlige brukere', () => {
    for (const kode of plan.koder) {
      const side = sider.get(kode.kode)!
      expect(side.analytt?.innhold.kode, kode.kode).toBe(kode.kode)
      expect(side.infoside?.innhold.navn).toBe(kode.hovedside.navn)
      expect(side.komponenter.map((k) => k.innhold.navn)).toEqual(kode.komponenter.map((k) => k.navn))
      expect(side.elementer).toHaveLength(kode.elementer.length)
    }
  })

  it('legger inn verdiene slik datasettet har dem', () => {
    const side = sider.get('AMTNORSUM')!
    const element = (type: string) => side.elementer.find((e) => e.innhold.elementtype === type)!
    expect(lesIntervallverdi(element('referanseomrade').innhold.data)).toEqual({
      nedre: 400,
      ovre: 900,
      enhet: 'nmol/L',
      forbehold: 'Amitriptylin + nortriptylin.',
    })
    expect(lesPreparater(element('preparater').innhold.data)).toEqual({
      navn: ['Amitriptylin Abcur', 'Amitriptylin Orifarm', 'Sarotex'],
      kontrollert: '2026-09-23',
    })
    const indikasjon = side.elementer.find((e) => e.innhold.panel === 'indikasjon')!
    expect(lesRiktekst(indikasjon.innhold.data).kontrollert).toBe('2026-09-23')
  })

  it('viser kilden i historikken: siden i PDF-en, eller Felleskatalogen med dato', () => {
    const side = sider.get('AMTNORSUM')!
    for (const e of side.elementer) {
      const fraFelleskatalogen = e.innhold.panel === 'identitet' || e.innhold.panel === 'indikasjon'
      expect(e.kilde).toBe(fraFelleskatalogen ? 'Hentet fra Felleskatalogen 23.09.2026' : 'Importert fra Psykofarmaka.pdf, side 7')
      expect([e.endret_av_fornavn, e.endret_av_etternavn]).toEqual(['Rita', 'Redaktør'])
    }
    expect(side.infoside?.kilde).toBe('Importert fra Psykofarmaka.pdf, side 7')
  })

  it('fører alt på administratoren som opprettet, og publiserer den første revisjonen', async () => {
    const rader = await kall.fasit<{ utfort_av: string; handling: string; revisjon: number; kilde: string | null }>(
      'select utfort_av, handling, revisjon, kilde from public.objektrevisjoner',
    )
    expect(rader.length).toBeGreaterThan(0)
    for (const rad of rader) expect(rad).toMatchObject({ utfort_av: admin, handling: 'opprettet', revisjon: 1 })
    expect(rader.every((r) => r.kilde !== null)).toBe(true)
    const upublisert = await kall.fasit(
      "select 1 from public.redigerbare_objekter o where not exists (select 1 from public.objekttilstander t where t.objekt_id = o.id and t.tilstand = 'publisert')",
    )
    expect(upublisert).toEqual([])
  })

  it('bruker samme side for et stoff som både har en egen kode og er komponent i en sumanalyse', () => {
    const nortriptylin = sider.get('NOR')!.infoside!.id
    expect(sider.get('AMTNORSUM')!.komponenter.map((k) => k.id)).toContain(nortriptylin)
  })

  it('legger hver referanse inn én gang, og nummererer dem på siden', async () => {
    const [antall] = await kall.fasit<{ n: number }>(
      "select count(*)::int as n from public.referanser where tilstand = 'publisert'",
    )
    expect(antall?.n).toBe(plan.referanser.length)
    const liste = byggSidemodell(sider.get('AMTNORSUM')!).referanseliste
    expect(liste.map((r) => r.referanse.tittel)).toContain(PSYKOFARMAKA_REFERANSER.reis2009!.tittel)
  })

  it('kan kjøres igjen uten å legge inn noe to ganger', async () => {
    const for_ = await antallObjekter()
    for (const blokk of importSql(plan, 'redaktor')) await db.exec(blokk)
    expect(await antallObjekter()).toBe(for_)
  })

  it('krever en administrator', async () => {
    await expect(db.exec(importSql(plan, 'leser')[0]!)).rejects.toThrow('Fant ingen administrator med brukernavnet leser.')
  })

  it('får tekster inn i databasen tegn for tegn, også usynlige tegn og lange tekster', async () => {
    const tekster = ["O'Brien \\ 1\u00a0026", 'x'.repeat(401) + '\u00a0' + "'".repeat(3), '']
    for (const tekst of tekster) {
      const [rad] = await kall.fasit<{ t: string }>(`select ${lit(tekst)} as t`)
      expect(rad!.t).toBe(tekst)
    }
  })

  it('gjør ingenting som migrasjon der administratoren ikke finnes', async () => {
    const for_ = await antallObjekter()
    await db.exec(importmigrasjoner(plan, 'leser')[0]!)
    expect(await antallObjekter()).toBe(for_)
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

  it('er det som ligger i migrasjonene, fil for fil', () => {
    const mappe = new URL('../../supabase/migrations/', import.meta.url)
    const filer = readdirSync(mappe)
      .filter((f) => /^\d+_psykofarmaka_import_\d+\.sql$/.test(f))
      .sort((a, b) => a.split('_').at(-1)!.localeCompare(b.split('_').at(-1)!))
    expect(filer.map((f) => readFileSync(new URL(f, mappe), 'utf8'))).toEqual(importmigrasjoner(plan, 'peohol'))
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
