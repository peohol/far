import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, expect, it } from 'vitest'
import { type Element, elementer, inlineReferanser, tekst } from '../hjelp/kurateringskjeden'

export default function lurasidon(db: () => PGlite): void {
  let virkninger: Element[]
  let bivirkninger: Element[]
  let farmakodynamikk: Element[]
  let indikasjon: Element[]
  let dosering: Element[]
  let farmakokinetikk: Element[]
  let farmakogenetikk: Element[]
  let interaksjoner: Element[]
  let tdm: Element[]
  let toksisitet: Element[]
  let graviditet: Element[]
  let avhengighet: Element[]

  beforeAll(async () => {
    const panel = (navn: string) => elementer(db(), 'lurasidon', navn)
    virkninger = await panel('virkninger')
    bivirkninger = await panel('bivirkninger')
    farmakodynamikk = await panel('farmakodynamikk')
    indikasjon = await panel('indikasjon')
    dosering = await panel('dosering')
    farmakokinetikk = await panel('farmakokinetikk')
    farmakogenetikk = await panel('farmakogenetikk')
    interaksjoner = await panel('interaksjoner')
    tdm = await panel('tdm')
    toksisitet = await panel('toksisitet_forgiftning')
    graviditet = await panel('graviditet_amming')
    avhengighet = await panel('avhengighet_toleranse')
  })

  it('har de nye redaksjonelle kortene i forventet rekkefølge', () => {
    expect(virkninger.map((e) => e.data.tittel)).toEqual([
      'Akutt effekt ved schizofreni',
      'Tilbakefallsforebygging',
    ])
    expect(bivirkninger.map((e) => e.data.tittel)).toEqual([
      'Akatisi og ekstrapyramidale symptomer',
      'Metabolsk, prolaktin- og hjerterisiko',
    ])
    expect(tdm.map((e) => e.data.tittel)).toEqual([
      'Når TDM er nyttig',
      'Prøvetaking og tolkning',
      'Usikkert internasjonalt referansegrunnlag',
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
      'Perinatal og neonatal påvirkning',
      'Amming',
      'Fertilitet og reproduksjon',
    ])
    expect(avhengighet.map((e) => e.data.tittel)).toEqual([
      'Abstinens, seponeringssyndrom og rebound-effekter',
      'Addiksjon',
    ])
  })

  it('retter indikasjon, dosering og biotilgjengelighet', () => {
    expect(tekst(indikasjon[0]!.data)).toContain('fra og med 13 år')
    expect(tekst(indikasjon[0]!.data)).not.toContain('ungdom >13')
    expect(tekst(dosering[0]!.data)).toContain('37-148 mg/døgn')
    const biotilgjengelighet = farmakokinetikk.find((e) => e.data.tittel === 'Biotilgjengelighet')!
    expect(tekst(biotilgjengelighet.data)).toContain('9-19 %')
    expect(tekst(biotilgjengelighet.data)).not.toContain('50 %')
    expect(tekst(farmakokinetikk.find((e) => e.data.tittel === 'Matpåvirkning')!.data)).toContain('350 kcal')
  })

  it('bevarer norsk referanseområde og konstruerer ikke toksiske grenser', async () => {
    const { rows } = await db().query<{ elementtype: string; nedre: number | null; ovre: number | null }>(
      `select e.elementtype, (e.data->>'nedre')::numeric as nedre, (e.data->>'ovre')::numeric as ovre
       from public.innholdselementer e
       join public.infosider s on s.objekt_id=e.infoside_id and s.tilstand='publisert' and s.slug='lurasidon'
       where e.tilstand='publisert' and e.panel='viktige_data'
       order by e.elementtype`,
    )
    expect(rows).toContainEqual({ elementtype: 'referanseomrade', nedre: 5, ovre: 60 })
    expect(rows.some((r) => r.elementtype === 'toksisk_konsentrasjon')).toBe(false)
    expect(rows.some((r) => r.elementtype === 'alvorlig_konsentrasjon')).toBe(false)
    expect(rows.some((r) => r.elementtype === 'dodelig_konsentrasjon')).toBe(false)
    expect(tekst(toksisitet.find((e) => e.data.tittel === 'Toksiske konsentrasjoner')!.data)).toContain('ingen validert')
  })

  it('bevarer sentrale estimater og deres begrensninger', () => {
    const effekt = virkninger.map((e) => tekst(e.data)).join(' ')
    expect(effekt).toContain('SMD -0,34')
    expect(effekt).toContain('p=0,050')
    expect(effekt).toContain('HR 0,663')
    expect(effekt).toContain('Berikelses- og seponeringsdesignet')
    expect(tekst(bivirkninger[0]!.data)).toContain('OR 3,74')
    expect(tekst(graviditet[0]!.data)).toContain('134 eksponerte')
    expect(tekst(graviditet[2]!.data)).toContain('1,16 %')
  })

  it('har separate, kildefidele SPC-tabeller for voksne og ungdom', async () => {
    const { rows } = await db().query<{ nokkel: string; antall: number }>(
      `select ko.nokkel, count(b.id)::int as antall
       from bivirkninger.kilder k
       join public.infosider s on s.objekt_id=k.infoside and s.tilstand='publisert' and s.slug='lurasidon'
       join bivirkninger.kontekster ko on ko.kilde=k.id
       left join bivirkninger.bivirkninger b on b.kilde=k.id and b.kontekst=ko.id
       where k.erstattet_av is null and k.trukket_kl is null
         and k.nokkel='lurasidone-accord-tabletter'
       group by ko.id,ko.nokkel,ko.posisjon
       order by ko.posisjon`,
    )
    expect(rows).toEqual([
      { nokkel: 'voksne', antall: 81 },
      { nokkel: 'ungdom', antall: 138 },
    ])
  })

  it('har kildebelegg og ingen upubliserte kuraterte elementer', () => {
    const d2 = farmakodynamikk.find((e) => e.data.maal === 'D2-reseptor')!
    const nyeOgEndrede = [
      ...virkninger,
      ...bivirkninger,
      d2,
      ...indikasjon,
      ...dosering,
      ...farmakokinetikk.filter((e) => ['Biotilgjengelighet', 'Matpåvirkning'].includes(String(e.data.tittel))),
      ...farmakogenetikk.filter((e) => e.data.tittel === 'Farmakogenetisk handlingsgrunnlag'),
      ...interaksjoner,
      ...tdm,
      ...toksisitet,
      ...graviditet,
      ...avhengighet,
    ]
    for (const e of nyeOgEndrede) {
      expect(e.referanser.length + inlineReferanser(e.data).length, String(e.data.tittel ?? e.panel)).toBeGreaterThan(0)
      expect(e.utkast, String(e.data.tittel ?? e.panel)).toBe(e.publisert)
    }
  })
}
