/** Kvetiapin-monografkurateringen: kildebelegg og faglige presiseringer i de kuraterte panelene. */
import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { kjorMigrasjoner, migrasjonsfiler, nyDatabase, opprettBruker } from './hjelp/testdatabase'

const MIGRASJON = migrasjonsfiler().find((f) => f.endsWith('_kvetiapin_monografkuratering.sql'))!
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

describe('kvetiapin-monografkuratering', () => {
  let db: PGlite
  let farmakodynamikk: Element[]
  let dosering: Element[]
  let farmakokinetikk: Element[]
  let farmakogenetikk: Element[]
  let interaksjoner: Element[]

  beforeAll(async () => {
    db = await nyDatabase({ til: FORSTE_IMPORTMIGRASJON })
    await opprettBruker(db, { brukernavn: 'peohol', fornavn: 'Rita', etternavn: 'Redaktør', rolle: 'admin' })
    await kjorMigrasjoner(db, { fra: FORSTE_IMPORTMIGRASJON, til: MIGRASJON })
    await kjorMigrasjoner(db, { bare: [MIGRASJON] })
    farmakodynamikk = await elementer(db, 'farmakodynamikk')
    dosering = await elementer(db, 'dosering')
    farmakokinetikk = await elementer(db, 'farmakokinetikk')
    farmakogenetikk = await elementer(db, 'farmakogenetikk')
    interaksjoner = await elementer(db, 'interaksjoner')
  }, 240_000)

  it('har ni kildebelagte mekanismekort med funksjon skilt fra ren binding', () => {
    expect(farmakodynamikk).toHaveLength(9)
    const mekanismer = new Map(farmakodynamikk.map((e) => [String(e.data.maal), e]))
    expect([...mekanismer].map(([maal]) => maal)).toEqual([
      '5-HT2A-reseptor',
      'D1-reseptor',
      'D2-reseptor',
      'H1-reseptor',
      'α1-adrenerg reseptor',
      'α2-adrenerg reseptor',
      'M1-, M3- og M5-reseptorer (norkvetiapin)',
      'Noradrenalintransportør / NET (norkvetiapin)',
      '5-HT1A-reseptor (norkvetiapin)',
    ])
    expect(mekanismer.get('5-HT2A-reseptor')?.data.mekanisme).toBe('antagonisme')
    expect(mekanismer.get('D2-reseptor')?.data.mekanisme).toBe('antagonisme')
    for (const maal of ['D1-reseptor', 'H1-reseptor', 'α1-adrenerg reseptor', 'α2-adrenerg reseptor']) {
      expect(mekanismer.get(maal)?.data.mekanisme, maal).toBe('reseptorbinding')
    }
    expect(mekanismer.get('M1-, M3- og M5-reseptorer (norkvetiapin)')?.data.mekanisme).toBe('antagonisme')
    expect(mekanismer.get('Noradrenalintransportør / NET (norkvetiapin)')?.data.mekanisme).toBe('reopptakshemming')
    expect(mekanismer.get('5-HT1A-reseptor (norkvetiapin)')?.data.mekanisme).toBe('agonisme')
    expect(tekst(mekanismer.get('5-HT1A-reseptor (norkvetiapin)')!.data)).toContain('assayavhengig')
    for (const e of farmakodynamikk) {
      expect(e.elementtype).toBe('mekanismekort')
      expect(e.referanser.length, String(e.data.maal)).toBeGreaterThan(0)
      expect(e.utkast, String(e.data.maal)).toBe(e.publisert)
    }
  })

  it('erstatter den gamle doselinjen med indikasjonsspesifikk IR- og depotdosering', () => {
    expect(dosering).toHaveLength(1)
    const [e] = dosering
    expect(e!.elementtype).toBe('riktekst')
    const s = tekst(e!.data)
    expect(s).toContain('Umiddelbar frisetting (IR)')
    expect(s).toContain('150–750 mg/døgn')
    expect(s).toContain('Tilleggsbehandling ved unipolar depresjon')
    expect(s).toContain('plasmaclearance er i gjennomsnitt 30–50 % lavere')
    expect(s).toContain('"level":2')
    expect(s).toContain('"type":"horizontalRule"')
    expect(s).toContain('"type":"bulletList"')
    expect(e!.referanser).toHaveLength(2)
    expect(e!.utkast).toBe(e!.publisert)
  })

  it('kildebelegger hvert farmakokinetikkort og fjerner det uspesifikke Annet-kortet fra panelet', async () => {
    expect(farmakokinetikk.map((e) => String(e.data.tittel))).toEqual([
      'Absorpsjon og formulering',
      'tₘₐₓ',
      't½',
      'tₛₛ',
      'Proteinbinding',
      'Vd',
      'Metabolisme og utskillelse',
    ])
    for (const e of farmakokinetikk) {
      expect(e.elementtype).toBe('kinetikkort')
      expect(e.referanser.length, String(e.data.tittel)).toBeGreaterThan(0)
      expect(e.utkast, String(e.data.tittel)).toBe(e.publisert)
    }
    expect(tekst(farmakokinetikk.find((e) => e.data.tittel === 't½')!.data)).toContain('Norkvetiapin: ca. 12 timer')
    expect(tekst(farmakokinetikk.find((e) => e.data.tittel === 'tₛₛ')!.data)).toContain('48 timer')
    expect(tekst(farmakokinetikk.find((e) => e.data.tittel === 'Vd')!.data)).toContain('672 ± 394 L')

    const { rows } = await db.query<{ n: number }>(
      `select count(*)::int as n
       from public.innholdselementer e
       join public.infosider s on s.objekt_id = e.infoside_id and s.tilstand = 'publisert' and s.slug = 'kvetiapin'
       where e.tilstand = 'publisert' and e.panel = 'fjernet' and e.data->>'tittel' = 'Annet'`,
    )
    expect(rows[0]!.n).toBe(1)
  })

  it('oppdaterer CYP-kortet der det faktisk står i Farmakogenetikk', () => {
    const kort = farmakogenetikk.filter((e) => e.elementtype === 'kinetikkort')
    const koblinger = farmakogenetikk.filter((e) => e.elementtype === 'clinpgxkobling')
    expect(kort).toHaveLength(1)
    expect(koblinger).toHaveLength(1)
    const [e] = kort
    expect(e!.elementtype).toBe('kinetikkort')
    expect(e!.data.tittel).toBe('CYP3A4 og CYP2D6')
    const s = tekst(e!.data)
    expect(s).toContain('CYP3A4 er hovedenzymet')
    expect(s).toContain('CYP2D6')
    expect(s).toContain('norkvetiapin')
    expect(s).toContain('ClinPGx')
    expect(s).toContain('CYP3A4 poor metabolizer')
    expect(s).toContain('30 % av normaldosen')
    expect(s).toContain('ingen dose- eller behandlingsendring for CYP2D6')
    expect(e!.referanser.length).toBeGreaterThanOrEqual(5)
    expect(e!.utkast).toBe(e!.publisert)
  })

  it('oppdaterer den redaksjonelle interaksjonsteksten i Interaksjoner-panelet', () => {
    expect(interaksjoner).toHaveLength(1)
    const [e] = interaksjoner
    expect(e!.elementtype).toBe('riktekst')
    expect(tekst(e!.data)).toContain('Sterke CYP3A4-hemmere')
    expect(e!.referanser).toHaveLength(2)
    expect(e!.utkast).toBe(e!.publisert)
  })

  it('oppretter eller gjenbruker de kuraterte referansene uten dubletter', async () => {
    const { rows } = await db.query<{ tittel: string; n: number }>(
      `select tittel, count(*)::int as n from public.referanser
       where tilstand = 'publisert' and tittel in (
         'Quetiapine Teva – preparatomtale',
         'Quetiapine Accord – preparatomtale',
         'N-desalkylquetiapine, a potent norepinephrine reuptake inhibitor and partial 5-HT1A agonist, as a putative mediator of quetiapine''s antidepressant activity',
         'Quetiapine and its metabolite norquetiapine: translation from in vitro pharmacology to in vivo efficacy in rodent models',
         'Clinical pharmacokinetics of quetiapine: an atypical antipsychotic',
         'Pharmacokinetic profiles of extended release quetiapine fumarate compared with quetiapine immediate release',
         'Multiple dose pharmacokinetics of quetiapine and some of its metabolites in Chinese suffering from schizophrenia',
         'Quetiapine Pathway, Pharmacokinetics',
         'Metabolism of the active metabolite of quetiapine, N-desalkylquetiapine in vitro',
         'Dutch Pharmacogenetics Working Group (DPWG) guideline for the gene-drug interaction between CYP2D6, CYP3A4 and CYP1A2 and antipsychotics'
       ) group by tittel`,
    )
    expect(rows).toHaveLength(10)
    for (const r of rows) expect(r.n, r.tittel).toBe(1)
  })
})
