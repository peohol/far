/** Kvetiapin-monografkurateringen: fersk kildevurdering av farmakodynamikk, dosering og farmakokinetikk. */
import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { faginnholdskall, kjorMigrasjoner, migrasjonsfiler, nyDatabase, opprettBruker } from './hjelp/testdatabase'

const FORSTE_KURATERING = migrasjonsfiler().find((f) => f.endsWith('_kvetiapin_monografkuratering.sql'))!
const KORRIGERING = migrasjonsfiler().find((f) => f.endsWith('_kvetiapin_monografkuratering_korrigering.sql'))!
const TILLEGG = migrasjonsfiler().find((f) => f.endsWith('_kvetiapin_farmakogenetikk_og_typografi.sql'))!
const VIRKNINGER_OG_AVHENGIGHET = migrasjonsfiler().find((f) => f.endsWith('_kvetiapin_virkninger_og_avhengighet.sql'))!
const FULLFORING = migrasjonsfiler().find((f) => f.endsWith('_kvetiapin_monografkuratering_fullforing.sql'))!
const BIVIRKNINGER = migrasjonsfiler().find((f) => f.endsWith('_seroquel_depot_bivirkninger.sql'))!
const FORSTE_IMPORTMIGRASJON = '20260923072247'

interface Element {
  objekt_id: string
  panel: string
  elementtype: string
  data: Record<string, unknown>
  referanser: string[]
  utkast: number
  publisert: number
}

async function elementer(db: PGlite, panel: string): Promise<Element[]> {
  const { rows } = await db.query<Element>(
    `select e.objekt_id, e.panel, e.elementtype, e.data,
       coalesce(r.innhold->'referanser', '[]'::jsonb) as referanser,
       u.revisjon as utkast, p.revisjon as publisert
     from public.innholdselementer e
     join public.infosider s on s.objekt_id = e.infoside_id and s.tilstand = 'publisert' and s.slug = 'kvetiapin'
     join public.objekttilstander u on u.objekt_id = e.objekt_id and u.tilstand = 'utkast'
     join public.objekttilstander p on p.objekt_id = e.objekt_id and p.tilstand = 'publisert'
     join public.objektrevisjoner r on r.objekt_id = e.objekt_id and r.revisjon = p.revisjon
     where e.tilstand = 'publisert' and e.panel = $1
     order by e.posisjon, e.objekt_id`,
    [panel],
  )
  return rows
}

const tekst = (data: Record<string, unknown>) => JSON.stringify(data)

function inlineReferanser(verdi: unknown): string[] {
  if (Array.isArray(verdi)) return verdi.flatMap(inlineReferanser)
  if (!verdi || typeof verdi !== 'object') return []
  const node = verdi as Record<string, unknown>
  if (node.type === 'sitering') {
    const attrs = node.attrs
    if (!attrs || typeof attrs !== 'object') return []
    const referanser = (attrs as Record<string, unknown>).referanser
    return Array.isArray(referanser) ? referanser.filter((id): id is string => typeof id === 'string') : []
  }
  return Object.values(node).flatMap(inlineReferanser)
}

describe('kvetiapinmigrasjoner uten kuratorprofil', () => {
  it('hopper over fagoppdateringene på en helt fersk database', async () => {
    const tom = await nyDatabase({ til: FORSTE_KURATERING })
    await expect(
      kjorMigrasjoner(tom, { bare: [FORSTE_KURATERING, KORRIGERING, TILLEGG, VIRKNINGER_OG_AVHENGIGHET, FULLFORING] }),
    ).resolves.toBeUndefined()
    await tom.close()
  }, 240_000)
})

describe('kvetiapinkorrigering med parallelle redaksjonelle kort', () => {
  it('oppdaterer bare kortene fra den verifiserte første kurateringen', async () => {
    const testdb = await nyDatabase({ til: FORSTE_IMPORTMIGRASJON })
    const admin = await opprettBruker(testdb, {
      brukernavn: 'peohol',
      fornavn: 'Rita',
      etternavn: 'Redaktør',
      rolle: 'admin',
    })
    await kjorMigrasjoner(testdb, { fra: FORSTE_IMPORTMIGRASJON, til: KORRIGERING, kurateringer: true })

    const { rows: sider } = await testdb.query<{ objekt_id: string }>(
      `select objekt_id from public.infosider where tilstand='publisert' and slug='kvetiapin'`,
    )
    const side = sider[0]!.objekt_id
    const kall = faginnholdskall(testdb, admin)

    const ekstraPd = await kall.opprett('innholdselement', {
      infoside: side,
      panel: 'farmakodynamikk',
      posisjon: 99,
      elementtype: 'mekanismekort',
      data: {
        maal: 'D2-reseptor',
        mekanisme: 'antagonisme',
        dokument: {
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Redaksjonelt ekstra D2-kort' }] }],
        },
      },
      referanser: [],
    })
    await kall.publiser(ekstraPd.id, 1)

    const ekstraPk = await kall.opprett('innholdselement', {
      infoside: side,
      panel: 'farmakokinetikk',
      posisjon: 99,
      elementtype: 'kinetikkort',
      data: {
        tittel: 't½',
        dokument: {
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Redaksjonelt ekstra PK-kort' }] }],
        },
      },
      referanser: [],
    })
    await kall.publiser(ekstraPk.id, 1)

    await kjorMigrasjoner(testdb, { bare: [KORRIGERING] })

    const { rows } = await testdb.query<{ objekt_id: string; tekst: string; kilde: string | null }>(
      `select e.objekt_id, r.innhold::text as tekst, r.kilde
       from public.innholdselementer e
       join public.objekttilstander p on p.objekt_id=e.objekt_id and p.tilstand='publisert'
       join public.objektrevisjoner r on r.objekt_id=e.objekt_id and r.revisjon=p.revisjon
       where e.tilstand='publisert' and e.objekt_id in ($1, $2)
       order by e.objekt_id`,
      [ekstraPd.id, ekstraPk.id],
    )
    expect(rows).toHaveLength(2)
    expect(rows.find((r) => r.objekt_id === ekstraPd.id)?.tekst).toContain('Redaksjonelt ekstra D2-kort')
    expect(rows.find((r) => r.objekt_id === ekstraPk.id)?.tekst).toContain('Redaksjonelt ekstra PK-kort')
    expect(rows.every((r) => r.kilde === null)).toBe(true)

    await testdb.close()
  }, 240_000)
})

describe('kvetiapin-monografkuratering', () => {
  let db: PGlite
  let farmakodynamikk: Element[]
  let dosering: Element[]
  let farmakokinetikk: Element[]
  let farmakogenetikk: Element[]
  let identitet: Element[]
  let virkninger: Element[]
  let avhengighet: Element[]
  let toksisitet: Element[]
  let graviditet: Element[]
  let indikasjon: Element[]
  let interaksjoner: Element[]

  beforeAll(async () => {
    db = await nyDatabase({ til: FORSTE_IMPORTMIGRASJON })
    await opprettBruker(db, { brukernavn: 'peohol', fornavn: 'Rita', etternavn: 'Redaktør', rolle: 'admin' })
    await kjorMigrasjoner(db, { fra: FORSTE_IMPORTMIGRASJON, til: BIVIRKNINGER, kurateringer: true })

    // Begge kvetiapinoppdateringene skal tåle å kjøres på nytt.
    await kjorMigrasjoner(db, { bare: [KORRIGERING] })
    await kjorMigrasjoner(db, { bare: [TILLEGG] })
    await kjorMigrasjoner(db, { bare: [TILLEGG] })
    await kjorMigrasjoner(db, { bare: [VIRKNINGER_OG_AVHENGIGHET] })
    await kjorMigrasjoner(db, { bare: [FULLFORING] })

    farmakodynamikk = await elementer(db, 'farmakodynamikk')
    dosering = await elementer(db, 'dosering')
    farmakokinetikk = await elementer(db, 'farmakokinetikk')
    farmakogenetikk = await elementer(db, 'farmakogenetikk')
    identitet = await elementer(db, 'identitet')
    virkninger = await elementer(db, 'virkninger')
    avhengighet = await elementer(db, 'avhengighet_toleranse')
    toksisitet = await elementer(db, 'toksisitet_forgiftning')
    graviditet = await elementer(db, 'graviditet_amming')
    indikasjon = await elementer(db, 'indikasjon')
    interaksjoner = await elementer(db, 'interaksjoner')
  }, 240_000)

  it('har ni kildebelagte mekanismekort uten et eget D1-kort', () => {
    expect(farmakodynamikk).toHaveLength(9)

    const mekanismer = new Map(farmakodynamikk.map((e) => [String(e.data.maal), e]))
    expect([...mekanismer].map(([maal]) => maal)).toEqual([
      '5-HT2A-reseptor',
      '5-HT2C-reseptor',
      'D2-reseptor',
      'Histamin H1-reseptor',
      'α1-adrenerg reseptor',
      'α2-adrenerg reseptor',
      'M1-, M3- og M5-reseptorer (norkvetiapin)',
      'Noradrenalintransportør / NET (norkvetiapin)',
      '5-HT1A-reseptor (kvetiapin og norkvetiapin)',
    ])

    expect(mekanismer.has('D1-reseptor')).toBe(false)
    expect(mekanismer.get('5-HT2A-reseptor')?.data.mekanisme).toBe('antagonisme')
    expect(mekanismer.get('5-HT2C-reseptor')?.data.mekanisme).toBe('antagonisme')
    expect(mekanismer.get('D2-reseptor')?.data.mekanisme).toBe('antagonisme')
    expect(mekanismer.get('Histamin H1-reseptor')?.data.mekanisme).toBe('antagonisme')
    expect(mekanismer.get('α1-adrenerg reseptor')?.data.mekanisme).toBe('antagonisme')
    expect(mekanismer.get('α2-adrenerg reseptor')?.data.mekanisme).toBe('antagonisme')
    expect(mekanismer.get('M1-, M3- og M5-reseptorer (norkvetiapin)')?.data.mekanisme).toBe('antagonisme')
    expect(mekanismer.get('Noradrenalintransportør / NET (norkvetiapin)')?.data.mekanisme).toBe('reopptakshemming')
    expect(mekanismer.get('5-HT1A-reseptor (kvetiapin og norkvetiapin)')?.data.mekanisme).toBe('agonisme')

    expect(tekst(mekanismer.get('5-HT2C-reseptor')!.data)).toContain('kliniske betydningen er ikke fastslått')
    expect(tekst(mekanismer.get('5-HT1A-reseptor (kvetiapin og norkvetiapin)')!.data)).toContain('assayavhengig')
    expect(tekst(mekanismer.get('Histamin H1-reseptor')!.data)).toContain('56–81 %')

    for (const e of farmakodynamikk) {
      expect(e.elementtype).toBe('mekanismekort')
      expect(e.referanser.length, String(e.data.maal)).toBeGreaterThan(0)
      expect(e.utkast, String(e.data.maal)).toBe(e.publisert)
    }
  })

  it('bruker senket tekst for reseptorsubtyper i farmakodynamisk brødtekst', () => {
    const medSubtype = farmakodynamikk.filter(
      (e) => String(e.data.maal) !== 'Noradrenalintransportør / NET (norkvetiapin)',
    )
    expect(medSubtype).toHaveLength(8)
    for (const e of medSubtype) {
      const dokument = JSON.stringify(e.data.dokument)
      expect(dokument, String(e.data.maal)).toContain('"type":"subscript"')
      expect(dokument, String(e.data.maal)).not.toMatch(/5-HT[0-9]|D[0-9]|H[0-9]|M[0-9]|α[0-9]/)
    }
  })

  it('bevarer D1-kortets historikk og oppretter 5-HT2C som et nytt objekt', async () => {
    const { rows } = await db.query<{ maal: string; panel: string; kilde: string | null; opprettet: string | null }>(
      `select e.data->>'maal' as maal, e.panel, r.kilde,
         (select r1.kilde from public.objektrevisjoner r1 where r1.objekt_id = e.objekt_id and r1.revisjon = 1) as opprettet
       from public.innholdselementer e
       join public.infosider s on s.objekt_id = e.infoside_id and s.tilstand = 'publisert' and s.slug = 'kvetiapin'
       join public.objekttilstander p on p.objekt_id = e.objekt_id and p.tilstand = 'publisert'
       join public.objektrevisjoner r on r.objekt_id = e.objekt_id and r.revisjon = p.revisjon
       where e.tilstand = 'publisert'
         and e.data->>'maal' in ('D1-reseptor', '5-HT2C-reseptor')
       order by e.data->>'maal'`,
    )

    expect(rows).toEqual([
      {
        maal: '5-HT2C-reseptor',
        panel: 'farmakodynamikk',
        // Opprettet som et nytt objekt, og senere gitt senket skrift av tillegget.
        kilde: 'Monografikuratering av kvetiapin 02.10.2026: reseptorsubtyper formatert med senket tekst',
        opprettet: 'Monografikuratering av kvetiapin 02.10.2026: 5-HT2C-antagonisme lagt til etter funksjonelle data',
      },
      {
        maal: 'D1-reseptor',
        panel: 'fjernet',
        kilde: 'Monografikuratering av kvetiapin 02.10.2026: D1-kort utelatt etter ny evidensvurdering',
        opprettet:
          'Farmakodynamikken strukturert som mekanismekort etter kartleggingen i docs/farmakodynamikk-kort-kartlegging.md',
      },
    ])
  })

  it('har indikasjonsspesifikk IR- og depotdosering med inline-kilder', () => {
    expect(dosering).toHaveLength(1)
    const [e] = dosering
    expect(e!.elementtype).toBe('riktekst')

    const s = tekst(e!.data)
    expect(s).toContain('Umiddelbar frisetting (IR)')
    expect(s).toContain('150–750 mg/døgn')
    expect(s).toContain('Depot (XR)')
    expect(s).toContain('Tilleggsbehandling ved unipolar depresjon')
    expect(s).toContain('tidligst dag 22')
    expect(s).toContain('minst 1–2 uker')
    expect(s).toContain('"type":"horizontalRule"')
    expect(s).toContain('"type":"bulletList"')

    const inline = inlineReferanser(e!.data)
    expect(new Set(inline).size).toBe(2)
    expect(inline.length).toBeGreaterThan(10)
    expect(e!.referanser).toHaveLength(0)
    expect(e!.utkast).toBe(e!.publisert)
  })

  it('kildebelegger åtte klinisk relevante farmakokinetikkort', () => {
    expect(farmakokinetikk.map((e) => String(e.data.tittel))).toEqual([
      'Absorpsjon og formulering',
      'tₘₐₓ',
      't½',
      'tₛₛ',
      'Proteinbinding',
      'Distribusjonsvolum',
      'Metabolisme og utskillelse',
      'Særpopulasjoner',
    ])

    for (const e of farmakokinetikk) {
      expect(e.elementtype).toBe('kinetikkort')
      expect(e.referanser.length, String(e.data.tittel)).toBeGreaterThan(0)
      expect(e.utkast, String(e.data.tittel)).toBe(e.publisert)
    }

    expect(tekst(farmakokinetikk.find((e) => e.data.tittel === 't½')!.data)).toContain('Norkvetiapin: ca. 12 timer')
    expect(tekst(farmakokinetikk.find((e) => e.data.tittel === 'tₛₛ')!.data)).toContain('48 timer')
    expect(tekst(farmakokinetikk.find((e) => e.data.tittel === 'Distribusjonsvolum')!.data)).toContain('672 ± 394 L')

    const metabolisme = tekst(farmakokinetikk.find((e) => e.data.tittel === 'Metabolisme og utskillelse')!.data)
    expect(metabolisme).toContain('CYP3A4')
    expect(metabolisme).toContain('CYP2D6')
    expect(metabolisme).toContain('norkvetiapin')
    expect(metabolisme).toContain('veiavhengig')

    const saerpopulasjoner = tekst(farmakokinetikk.find((e) => e.data.tittel === 'Særpopulasjoner')!.data)
    expect(saerpopulasjoner).toContain('30–50 % lavere')
    expect(saerpopulasjoner).toContain('alvorlig nedsatt nyrefunksjon')
    expect(saerpopulasjoner).toContain('stabil alkoholisk cirrhose')
  })

  it('fullfører oppsummering, virkninger, avhengighet, toksisitet og reproduksjon uten å erstatte etablerte seksjoner', () => {
    expect(identitet).toHaveLength(1)
    expect(virkninger.map((e) => String(e.data.tittel))).toEqual([
      'Antipsykotisk effekt',
      'Antimanisk effekt',
      'Antidepressiv effekt',
      'Sedasjon og søvnighet',
    ])
    expect(avhengighet.map((e) => String(e.data.tittel))).toEqual([
      'Toleranseutvikling',
      'Abstinens, seponeringssyndrom og rebound-effekter',
      'Addiksjon',
    ])
    expect(avhengighet.some((e) => e.data.tittel === 'Lært mestringsavhengighet')).toBe(false)

    expect(toksisitet.map((e) => String(e.data.tittel))).toEqual([
      'Toksisk dose og eksponering',
      'Toksiske konsentrasjoner',
      'Klinisk forgiftningsbilde',
      'Alvorlige komplikasjoner',
      'Toksikokinetiske særtrekk',
      'Behandling ved forgiftning',
    ])
    expect(tekst(toksisitet.find((e) => e.data.tittel === 'Toksiske konsentrasjoner')!.data)).toContain('postmortemspesifikke')
    expect(tekst(toksisitet.find((e) => e.data.tittel === 'Toksiske konsentrasjoner')!.data)).toContain('ikke en universell toksisitetsgrense')

    expect(graviditet.map((e) => String(e.data.tittel))).toEqual([
      'Graviditet',
      'Perinatal og neonatal påvirkning',
      'Amming',
      'Fertilitet og reproduksjon',
    ])
    expect(tekst(graviditet.find((e) => e.data.tittel === 'Graviditet')!.data)).toContain('13 090')
    expect(tekst(graviditet.find((e) => e.data.tittel === 'Amming')!.data)).toContain('0,16 %')

    const sedasjon = virkninger.find((e) => e.data.tittel === 'Sedasjon og søvnighet')!
    expect(JSON.stringify(sedasjon.data)).toContain('"marks":[{"type":"subscript"}]')
    expect(JSON.stringify(sedasjon.data)).not.toContain('"type":"subscript","content"')

    expect(indikasjon).toHaveLength(1)
    expect(tekst(indikasjon[0]!.data)).toContain('unipolar depresjon')
    expect(indikasjon[0]!.referanser.length).toBeGreaterThan(0)
    expect(interaksjoner).toHaveLength(1)
    expect(tekst(interaksjoner[0]!.data)).toContain('CYP3A4-substrat')
    expect(interaksjoner[0]!.referanser.length).toBeGreaterThan(0)

    for (const e of [...virkninger, ...avhengighet, ...toksisitet, ...graviditet, ...indikasjon, ...interaksjoner]) {
      expect(e.utkast, String(e.data.tittel ?? e.panel)).toBe(e.publisert)
    }

    expect(farmakodynamikk).toHaveLength(9)
    expect(dosering).toHaveLength(1)
    expect(farmakokinetikk).toHaveLength(8)
  })

  it('har en kort farmakogenetisk fritekst om når testing er relevant', () => {
    const fritekst = farmakogenetikk.find((e) => e.elementtype === 'riktekst')
    expect(fritekst).toBeDefined()
    expect(fritekst!.referanser).toHaveLength(3)

    const s = tekst(fritekst!.data)
    expect(s).toContain('ikke rutinemessig anbefalt')
    expect(s).toContain('manglende CYP3A4-enzymaktivitet')
    expect(s).toContain('redusert og manglende CYP2D6-enzymaktivitet')
    expect(s).toContain('mest relevant selektivt')
    expect(s).toContain('TDM-resultat')
    expect(s).not.toMatch(/intermediate metabolizer|poor metabolizer|ultrarapid metabolizer|\\bIM\\b|\\bPM\\b|\\bUM\\b/i)

    const enzymkort = farmakogenetikk.find(
      (e) => e.elementtype === 'kinetikkort' && e.data.tittel === 'CYP-enzymer (substrat)',
    )
    expect(enzymkort).toBeDefined()
  })

  it('bevarer tilbakeført farmakogenetikk og kildebelegger interaksjonsteksten på nytt', async () => {
    const { rows } = await db.query<{ panel: string; tittel: string | null; kilde: string | null }>(
      `select e.panel, e.data->>'tittel' as tittel, r.kilde
       from public.innholdselementer e
       join public.infosider s on s.objekt_id = e.infoside_id and s.tilstand = 'publisert' and s.slug = 'kvetiapin'
       join public.objekttilstander p on p.objekt_id = e.objekt_id and p.tilstand = 'publisert'
       join public.objektrevisjoner r on r.objekt_id = e.objekt_id and r.revisjon = p.revisjon
       where e.tilstand = 'publisert'
         and (
           (e.panel = 'farmakogenetikk' and e.elementtype = 'kinetikkort' and e.data->>'tittel' = 'CYP-enzymer (substrat)')
           or (e.panel = 'interaksjoner' and e.elementtype = 'riktekst')
         )
       order by e.panel`,
    )

    const farmakogenetikk = rows.find((r) => r.panel === 'farmakogenetikk')
    const interaksjoner = rows.find((r) => r.panel === 'interaksjoner')

    expect(farmakogenetikk).toMatchObject({
      tittel: 'CYP-enzymer (substrat)',
      kilde: 'Korrigering etter fersk monografikuratering: farmakogenetikk tilbakeført til tilstanden før kvetiapinkurateringen',
    })
    expect(interaksjoner?.kilde).toBe(
      'Korrigering etter fersk monografikuratering: interaksjoner tilbakeført til tilstanden før kvetiapinkurateringen',
    )
  })

  it('oppretter eller gjenbruker de kuraterte referansene uten dubletter', async () => {
    const lenker = [
      'https://produktinformasjon.legemiddelsok.no/preparatomtaler/07-5148.pdf',
      'https://produktinformasjon.legemiddelsok.no/preparatomtaler/07-5214.pdf',
      'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=b519b924-2348-46ac-b9a2-c9c198257ea4',
      'https://doi.org/10.1038/sj.npp.1301646',
      'https://doi.org/10.1111/bph.13346',
      'https://doi.org/10.1007/s00213-015-4002-2',
      'https://doi.org/10.1016/S0924-977X(00)00133-4',
      'https://doi.org/10.2165/00003088-200140070-00003',
      'https://doi.org/10.1016/j.pnpbp.2008.09.026',
      'https://pubmed.ncbi.nlm.nih.gov/15000896/',
      'https://doi.org/10.1515/DMDI.2006.21.3-4.187',
      'https://doi.org/10.1124/dmd.112.045237',
      'https://doi.org/10.1038/s41431-023-01347-3',
      'https://doi.org/10.1097/JCP.0000000000000070',
      'https://doi.org/10.1111/bcp.15849',
      'https://doi.org/10.1192/bjp.bp.114.154377',
      'https://doi.org/10.1038/s41380-021-01334-4',
      'https://doi.org/10.2147/DDDT.S63779',
      'https://doi.org/10.1177/0004867420965693',
      'https://doi.org/10.1080/10826084.2019.1668013',
      'https://doi.org/10.2147/DHPS.S296515',
      'https://doi.org/10.3390/jox14040085',
      'https://doi.org/10.1093/jat/bkv072',
      'https://doi.org/10.1097/JCP.0000000000002127',
      'https://www.ncbi.nlm.nih.gov/books/NBK501087/',
      'https://doi.org/10.1097/JCP.0000000000000905',
      'https://doi.org/10.1111/j.1365-2125.2005.02507.x',
    ]

    const { rows } = await db.query<{ lenke: string; n: number }>(
      `select lenke, count(*)::int as n
       from public.referanser
       where tilstand = 'publisert' and lenke = any($1::text[])
       group by lenke`,
      [lenker],
    )

    expect(rows).toHaveLength(lenker.length)
    for (const r of rows) expect(r.n, r.lenke).toBe(1)
  })
})
