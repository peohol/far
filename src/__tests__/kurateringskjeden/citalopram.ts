import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, expect, it } from 'vitest'
import { type Element, elementer, inlineReferanser, tekst } from '../hjelp/kurateringskjeden'

export default function citalopram(db: () => PGlite): void {
  let identitet: Element[]
  let virkninger: Element[]
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
    const panel = (navn: string) => elementer(db(), 'citalopram', navn)
    identitet = await panel('identitet')
    virkninger = await panel('virkninger')
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

  it('har en fullstendig redaksjonell citalopram-monografi', () => {
    expect(identitet).toHaveLength(1)
    expect(virkninger.map((e) => String(e.data.tittel))).toEqual([
      'Antidepressiv effekt',
      'Effekt ved panikklidelse',
      'Effekt ved tvangslidelse',
      'Doseavhengig QT-forlengelse',
    ])
    expect(farmakodynamikk).toHaveLength(7)
    expect(indikasjon).toHaveLength(1)
    expect(dosering).toHaveLength(1)
    expect(farmakokinetikk.map((e) => String(e.data.tittel))).toEqual([
      'Biotilgjengelighet',
      'tₘₐₓ',
      't½',
      'tₛₛ',
      'Proteinbinding',
      'Vd',
      'Eliminasjon',
    ])
    expect(farmakogenetikk.map((e) => String(e.data.tittel))).toEqual([
      'CYP-enzymer (substrat)',
      'CYP2C19 og citaloprameksponering',
      'Når farmakogenetisk analyse er relevant',
    ])
    expect(interaksjoner).toHaveLength(1)
    expect(tekst(interaksjoner[0].data)).toContain('hentes automatisk')
    expect(tdm.map((e) => String(e.data.tittel))).toEqual([
      'Prøvetakingstidspunkt',
      'Grunnlag for referanseområdet',
      'Konsentrasjon–effekt og internasjonal kontekst',
    ])
    expect(toksisitet.map((e) => String(e.data.tittel))).toEqual([
      'Toksisk dose og eksponering',
      'Toksiske konsentrasjoner',
      'Klinisk forgiftningsbilde',
      'Alvorlige komplikasjoner',
      'Toksikokinetiske særtrekk',
      'Behandling ved forgiftning',
    ])
    expect(graviditet.map((e) => String(e.data.tittel))).toEqual([
      'Graviditet',
      'Perinatal og neonatal påvirkning',
      'Amming',
      'Fertilitet og reproduksjon',
    ])
    expect(avhengighet.map((e) => String(e.data.tittel))).toEqual([
      'Toleranseutvikling',
      'Abstinens, seponeringssyndrom og rebound-effekter',
      'Addiksjon',
    ])
    expect(avhengighet.some((e) => e.data.tittel === 'Lært mestringsavhengighet')).toBe(false)
  })

  it('bevarer norske konsentrasjonsrammer og beskriver internasjonal TDM som kontekst', () => {
    const kontekst = tekst(tdm.find((e) => e.data.tittel === 'Konsentrasjon–effekt og internasjonal kontekst')!.data)
    expect(kontekst).toContain('70–350 nmol/L')
    expect(kontekst).toContain('erstatter ikke det norske')

    const toksiske = tekst(toksisitet.find((e) => e.data.tittel === 'Toksiske konsentrasjoner')!.data)
    expect(toksiske).toContain('700 nmol/L')
    expect(toksiske).toContain('10 000 nmol/L')
  })

  it('bevarer norske konsentrasjonsgrenser og synkroniserer PK-nøkkeltall med SPC', async () => {
    const { rows } = await db().query<{ elementtype: string; data: Record<string, unknown> }>(
      `select e.elementtype, e.data
       from public.innholdselementer e
       join public.infosider s on s.objekt_id=e.infoside_id and s.tilstand='publisert' and s.slug='citalopram'
       where e.tilstand='publisert' and e.panel='viktige_data'
         and e.elementtype in ('referanseomrade','toksisk_omrade','alvorlig_intoksikasjon','halveringstid','steady_state')
       order by e.elementtype`,
    )
    const perType = new Map(rows.map((r) => [r.elementtype, r.data]))

    expect(perType.get('referanseomrade')).toMatchObject({ nedre: 70, ovre: 350, enhet: 'nmol/L' })
    expect(perType.get('toksisk_omrade')).toMatchObject({ nedre: 700, ovre: null, enhet: 'nmol/L' })
    expect(perType.get('alvorlig_intoksikasjon')).toMatchObject({ nedre: 10000, ovre: null, enhet: 'nmol/L' })
    expect(perType.get('halveringstid')).toMatchObject({
      former: [{ form: '', typisk: 36, min: 28, maks: 42, enhet: 'timer' }],
    })
    expect(perType.get('steady_state')).toMatchObject({
      former: [{ form: '', typisk: null, min: 1, maks: 2, enhet: 'uker' }],
    })

    const serum = await elementer(db(), 'citalopram', 'serumkonsentrasjoner')
    expect(serum).toHaveLength(1)
    const serumtekst = tekst(serum[0]!.data)
    expect(serumtekst).toContain('Median 70 nmol/L')
    expect(serumtekst).toContain('Median 297 nmol/L')
    expect(serumtekst).toContain('10.–90. persentil: 64–328 nmol/L')
  })

  it('bruker norsk enzymaktivitetsterminologi og avgrenser PGx klinisk', () => {
    const pgx = farmakogenetikk.map((e) => tekst(e.data)).join(' ')
    expect(pgx).toContain('manglende enzymaktivitet')
    expect(pgx).toContain('økt enzymaktivitet')
    expect(pgx).toContain('SLC6A4')
    expect(pgx).toContain('HTR2A')
    expect(pgx).not.toMatch(/\b(PM|IM|NM|UM)\b/)
  })

  it('har samsvarende kort- og inline-kilder i de faste nye seksjonene', () => {
    for (const e of [...toksisitet, ...graviditet, ...avhengighet]) {
      const inline = inlineReferanser(e.data)
      expect(inline.length, String(e.data.tittel)).toBeGreaterThan(0)
      expect(new Set(inline), String(e.data.tittel)).toEqual(new Set(e.referanser))
    }
  })

  it('har kildebelegg og ingen upubliserte redaksjonelle elementer', () => {
    for (const e of [
      ...identitet,
      ...virkninger,
      ...farmakodynamikk,
      ...indikasjon,
      ...dosering,
      ...farmakokinetikk,
      ...farmakogenetikk,
      ...interaksjoner,
      ...tdm,
      ...toksisitet,
      ...graviditet,
      ...avhengighet,
    ]) {
      expect(e.referanser.length, String(e.data.tittel ?? e.panel)).toBeGreaterThan(0)
      expect(e.utkast, String(e.data.tittel ?? e.panel)).toBe(e.publisert)
    }
  })
}
