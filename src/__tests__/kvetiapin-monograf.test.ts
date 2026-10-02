/** Kvetiapin-monografkurateringen: fersk kildevurdering av farmakodynamikk, dosering og farmakokinetikk. */
import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { kjorMigrasjoner, migrasjonsfiler, nyDatabase, opprettBruker } from './hjelp/testdatabase'

const FORSTE_KURATERING = migrasjonsfiler().find((f) => f.endsWith('_kvetiapin_monografkuratering.sql'))!
const KORRIGERING = migrasjonsfiler().find((f) => f.endsWith('_kvetiapin_monografkuratering_korrigering.sql'))!
const TILLEGG = migrasjonsfiler().find((f) => f.endsWith('_kvetiapin_farmakogenetikk_og_typografi.sql'))!
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
      kjorMigrasjoner(tom, { bare: [FORSTE_KURATERING, KORRIGERING, TILLEGG] }),
    ).resolves.toBeUndefined()
    await tom.close()
  }, 240_000)
})

describe('kvetiapin-monografkuratering', () => {
  let db: PGlite
  let farmakodynamikk: Element[]
  let dosering: Element[]
  let farmakokinetikk: Element[]
  let farmakogenetikk: Element[]

  beforeAll(async () => {
    db = await nyDatabase({ til: FORSTE_IMPORTMIGRASJON })
    await opprettBruker(db, { brukernavn: 'peohol', fornavn: 'Rita', etternavn: 'Redaktør', rolle: 'admin' })
    await kjorMigrasjoner(db, { fra: FORSTE_IMPORTMIGRASJON, til: TILLEGG })

    // Begge kvetiapinoppdateringene skal tåle å kjøres på nytt.
    await kjorMigrasjoner(db, { bare: [KORRIGERING] })
    await kjorMigrasjoner(db, { bare: [TILLEGG] })
    await kjorMigrasjoner(db, { bare: [TILLEGG] })

    farmakodynamikk = await elementer(db, 'farmakodynamikk')
    dosering = await elementer(db, 'dosering')
    farmakokinetikk = await elementer(db, 'farmakokinetikk')
    farmakogenetikk = await elementer(db, 'farmakogenetikk')
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
    const { rows } = await db.query<{ maal: string; panel: string; kilde: string | null }>(
      `select e.data->>'maal' as maal, e.panel, r.kilde
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
        kilde: 'Monografikuratering av kvetiapin 02.10.2026: 5-HT2C-antagonisme lagt til etter funksjonelle data',
      },
      {
        maal: 'D1-reseptor',
        panel: 'fjernet',
        kilde: 'Monografikuratering av kvetiapin 02.10.2026: D1-kort utelatt etter ny evidensvurdering',
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

  it('tilbakefører farmakogenetikk og interaksjoner til tilstanden før første kuratering', async () => {
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
