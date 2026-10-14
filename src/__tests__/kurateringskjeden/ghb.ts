import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, expect, it } from 'vitest'
import { type Element, elementer, inlineReferanser, tekst } from '../hjelp/kurateringskjeden'

export default function ghb(db: () => PGlite): void {
  let identitet: Element[]
  let virkninger: Element[]
  let farmakodynamikk: Element[]
  let indikasjon: Element[]
  let dosering: Element[]
  let farmakokinetikk: Element[]
  let interaksjoner: Element[]
  let toksisitet: Element[]
  let graviditet: Element[]
  let avhengighet: Element[]

  beforeAll(async () => {
    const panel = (navn: string) => elementer(db(), 'ghb', navn)
    identitet = await panel('identitet')
    virkninger = await panel('virkninger')
    farmakodynamikk = await panel('farmakodynamikk')
    indikasjon = await panel('indikasjon')
    dosering = await panel('dosering')
    farmakokinetikk = await panel('farmakokinetikk')
    interaksjoner = await panel('interaksjoner')
    toksisitet = await panel('toksisitet_forgiftning')
    graviditet = await panel('graviditet_amming')
    avhengighet = await panel('avhengighet_toleranse')
  })

  it('har den fullstendige redaksjonelle GHB-monografien', () => {
    expect(identitet).toHaveLength(1)
    expect(virkninger.map((e) => e.data.tittel)).toEqual([
      'Narkolepsi med katapleksi',
      'Doseavhengige akutte effekter',
    ])
    expect(farmakodynamikk.map((e) => e.data.maal)).toEqual(['GABA-B-reseptoren'])
    expect(indikasjon).toHaveLength(1)
    expect(dosering).toHaveLength(1)
    expect(interaksjoner).toHaveLength(1)
    expect(farmakokinetikk.map((e) => e.data.tittel)).toEqual([
      'Biotilgjengelighet og mat',
      'tₘₐₓ',
      't½',
      'Ikke-lineær eksponering',
      'Distribusjon og proteinbinding',
      'Metabolisme',
      'Eliminasjon og leverfunksjon',
    ])
    expect(toksisitet.map((e) => e.data.tittel)).toEqual([
      'Toksisk dose og eksponering',
      'Toksiske konsentrasjoner',
      'Klinisk forgiftningsbilde',
      'Alvorlige komplikasjoner',
      'Toksikokinetiske særtrekk',
      'Behandling ved forgiftning',
    ])
    expect(graviditet.map((e) => e.data.tittel)).toEqual([
      'Graviditet',
      'Amming',
      'Fertilitet og reproduksjon',
    ])
    expect(avhengighet.map((e) => e.data.tittel)).toEqual([
      'Toleranseutvikling',
      'Abstinens, seponeringssyndrom og rebound-effekter',
      'Addiksjon',
    ])
  })

  it('bevarer usikkerhet og konstruerer ikke serumgrenser', async () => {
    const { rows } = await db().query<{ elementtype: string; data: Record<string, unknown> }>(
      `select e.elementtype, e.data
       from public.innholdselementer e
       join public.infosider s on s.objekt_id=e.infoside_id and s.tilstand='publisert' and s.slug='ghb'
       where e.tilstand='publisert' and e.panel='viktige_data'
       order by e.elementtype`,
    )
    expect(rows).toEqual([
      {
        elementtype: 'halveringstid',
        data: { former: [{ form: '', typisk: 0.75, min: 0.5, maks: 1, enhet: 'timer' }] },
      },
    ])
    expect(await elementer(db(), 'ghb', 'serumkonsentrasjoner')).toHaveLength(0)
    const toksiske = tekst(toksisitet.find((e) => e.data.tittel === 'Toksiske konsentrasjoner')!.data)
    expect(toksiske).toContain('45–295 mg/L')
    expect(toksiske).toContain('ikke en universell')
  })

  it('kvantifiserer effekt, kinetikk og sentrale risikoforskjeller', () => {
    const effekt = tekst(virkninger[0]!.data)
    expect(effekt).toContain('8,5')
    expect(effekt).toContain('5,18 minutter')
    expect(effekt).toContain('RR 2,42')
    expect(effekt).toContain('2 studier')
    expect(effekt).toContain('3 studier')
    const akutteEffekter = tekst(virkninger[1]!.data)
    expect(akutteEffekter).toContain('20 og 35 mg/kg')
    expect(akutteEffekter).not.toContain('25 og 35 mg/kg')
    const pk = farmakokinetikk.map((e) => tekst(e.data)).join(' ')
    expect(pk).toContain('Cmax med 58 %')
    expect(pk).toContain('AUC med 37 %')
    expect(pk).toContain('3,8 ganger')
    expect(pk).toContain('20 og 35 mg/kg')
    expect(pk).not.toContain('25 og 35 mg/kg')
    const barnedose = tekst(dosering[0]!.data)
    expect(barnedose).toContain('15 til <20 kg')
    expect(barnedose).toContain('0,2 g/kg/dag')
    expect(barnedose).toContain('9 g/dag')
    const kontraindikasjoner = tekst(interaksjoner[0]!.data)
    expect(kontraindikasjoner).toContain('alvorlig depresjon')
    expect(kontraindikasjoner).toContain('suksinsemialdehyddehydrogenasemangel')
    expect(kontraindikasjoner).toContain('opioider eller barbiturater')
    expect(tekst(avhengighet[0]!.data)).toContain('Terapeutisk bruk')
    expect(tekst(avhengighet[1]!.data)).toContain('53 % delirium')
  })

  it('har PMID-korrekt bibliografi for de feilidentifiserte kildene', async () => {
    const { rows } = await db().query<{ lenke: string; tittel: string; forfattere: string; aar: string }>(
      `select r.lenke, r.tittel, r.forfattere, r.aar
       from public.referanser r
       where r.tilstand='publisert' and not r.arkivert and r.lenke in (
         'https://pubmed.ncbi.nlm.nih.gov/12827115/',
         'https://pubmed.ncbi.nlm.nih.gov/27581664/',
         'https://pubmed.ncbi.nlm.nih.gov/30307336/',
         'https://pubmed.ncbi.nlm.nih.gov/28004314/',
         'https://pubmed.ncbi.nlm.nih.gov/39225220/'
       )
       order by r.lenke`,
    )
    expect(rows).toEqual([
      {
        lenke: 'https://pubmed.ncbi.nlm.nih.gov/12827115/',
        tittel: 'Gamma-hydroxybutyrate serum levels and clinical syndrome after severe overdose',
        forfattere: 'Karl A Sporer, Rachel L Chin, Jo Ellen Dyer, Ryan Lamb',
        aar: '2003',
      },
      {
        lenke: 'https://pubmed.ncbi.nlm.nih.gov/27581664/',
        tittel: 'Presentations to an urban emergency department in Switzerland due to acute γ-hydroxybutyrate toxicity',
        forfattere: 'Evangelia Liakoni, Fabio Walther, Christian H Nickel, Matthias E Liechti',
        aar: '2016',
      },
      {
        lenke: 'https://pubmed.ncbi.nlm.nih.gov/28004314/',
        tittel: 'Pharmacological Treatment in γ-Hydroxybutyrate (GHB) and γ-Butyrolactone (GBL) Dependence: Detoxification and Relapse Prevention',
        forfattere: 'Rama M Kamal, Martijn S van Noorden, Wim Wannet, Harmen Beurmanjer, Boukje A G Dijkstra, Arnt Schellekens',
        aar: '2017',
      },
      {
        lenke: 'https://pubmed.ncbi.nlm.nih.gov/30307336/',
        tittel: 'Interpreting γ-hydroxybutyrate concentrations for clinical and forensic purposes',
        forfattere: 'Francesco Paolo Busardò, Alan Wayne Jones',
        aar: '2019',
      },
      {
        lenke: 'https://pubmed.ncbi.nlm.nih.gov/39225220/',
        tittel: 'Long-term Efficacy and Safety of Sodium Oxybate in Treating Alcohol Use Disorder: A Systematic Review and Meta-Analysis',
        forfattere: 'Letizia Biso, Andrea Spini, Francesco Petragnano, Roberto Maggio, Marco Scarselli, Marco Carli',
        aar: '2025',
      },
    ])
  })

  it('har tre selvstendige, kildefidele SPC-importer', async () => {
    const { rows } = await db().query<{ nokkel: string; antall: number }>(
      `select k.nokkel, count(b.id)::int as antall
       from bivirkninger.kilder k
       join public.infosider s on s.objekt_id=k.infoside and s.tilstand='publisert' and s.slug='ghb'
       left join bivirkninger.bivirkninger b on b.kilde=k.id
       where k.erstattet_av is null and k.trukket_kl is null
       group by k.id,k.nokkel
       order by k.nokkel`,
    )
    expect(rows).toEqual([
      { nokkel: 'natriumoksybat-kalceks-mikstur', antall: 89 },
      { nokkel: 'oxiore-mikstur', antall: 90 },
      { nokkel: 'xyrem-mikstur', antall: 90 },
    ])
  })

  it('har kildebelegg og ingen upubliserte redaksjonelle elementer', () => {
    for (const e of [
      ...identitet,
      ...virkninger,
      ...farmakodynamikk,
      ...indikasjon,
      ...dosering,
      ...farmakokinetikk,
      ...interaksjoner,
      ...toksisitet,
      ...graviditet,
      ...avhengighet,
    ]) {
      expect(e.referanser.length + inlineReferanser(e.data).length, String(e.data.tittel ?? e.panel)).toBeGreaterThan(0)
      expect(e.utkast, String(e.data.tittel ?? e.panel)).toBe(e.publisert)
    }
  })
}
