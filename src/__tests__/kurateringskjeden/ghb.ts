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
    const pk = farmakokinetikk.map((e) => tekst(e.data)).join(' ')
    expect(pk).toContain('Cmax med 58 %')
    expect(pk).toContain('AUC med 37 %')
    expect(pk).toContain('3,8 ganger')
    expect(tekst(avhengighet[0]!.data)).toContain('Terapeutisk bruk')
    expect(tekst(avhengighet[1]!.data)).toContain('53 % delirium')
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
