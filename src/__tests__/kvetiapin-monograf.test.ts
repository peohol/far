/** Kvetiapin-monografkurateringen: kildebelegg og faglige presiseringer i de tre kuraterte panelene. */
import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { kjorMigrasjoner, migrasjonsfiler, nyDatabase, opprettBruker } from './hjelp/testdatabase'

const MIGRASJON = migrasjonsfiler().find((f) => f.endsWith('_kvetiapin_monografkuratering.sql'))!

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

  beforeAll(async () => {
    db = await nyDatabase({ til: MIGRASJON })
    await opprettBruker(db, { brukernavn: 'peohol', fornavn: 'Rita', etternavn: 'Redaktør', rolle: 'admin' })
    await kjorMigrasjoner(db, { bare: [MIGRASJON] })
    farmakodynamikk = await elementer(db, 'farmakodynamikk')
    dosering = await elementer(db, 'dosering')
    farmakokinetikk = await elementer(db, 'farmakokinetikk')
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
      'CYP3A4',
      'CYP3A4-interaksjoner',
    ])
    for (const e of farmakokinetikk) {
      expect(e.elementtype).toBe('kinetikkort')
      expect(e.referanser.length, String(e.data.tittel)).toBeGreaterThan(0)
      expect(e.utkast, String(e.data.tittel)).toBe(e.publisert)
    }
    expect(tekst(farmakokinetikk.find((e) => e.data.tittel === 't½')!.data)).toContain('Norkvetiapin: ca. 12 timer')
    expect(tekst(farmakokinetikk.find((e) => e.data.tittel === 'CYP3A4')!.data)).not.toContain('3A4 (2D6)')

    const { rows } = await db.query<{ n: number }>(
      `select count(*)::int as n
       from public.innholdselementer e
       join public.infosider s on s.objekt_id = e.infoside_id and s.tilstand = 'publisert' and s.slug = 'kvetiapin'
       where e.tilstand = 'publisert' and e.panel = 'fjernet' and e.data->>'tittel' = 'Annet'`,
    )
    expect(rows[0]!.n).toBe(1)
  })

  it('oppretter eller gjenbruker de kuraterte referansene uten dubletter', async () => {
    const { rows } = await db.query<{ tittel: string; n: number }>(
      `select tittel, count(*)::int as n from public.referanser
       where tilstand = 'publisert' and tittel in (
         'Seroquel «Cheplapharm»',
         'Seroquel Depot «Cheplapharm»',
         'N-desalkylquetiapine, a potent norepinephrine reuptake inhibitor and partial 5-HT1A agonist, as a putative mediator of quetiapine''s antidepressant activity',
         'Quetiapine and its metabolite norquetiapine: translation from in vitro pharmacology to in vivo efficacy in rodent models',
         'Clinical pharmacokinetics of quetiapine: an atypical antipsychotic',
         'Pharmacokinetic profiles of extended release quetiapine fumarate compared with quetiapine immediate release',
         'Quetiapine tablet, film coated – prescribing information'
       ) group by tittel`,
    )
    expect(rows).toHaveLength(7)
    for (const r of rows) expect(r.n, r.tittel).toBe(1)
  })
})
