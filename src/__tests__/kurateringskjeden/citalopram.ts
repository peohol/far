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
    expect(tekst(interaksjoner[0]!.data)).toContain('hentes automatisk')
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

  it('bevarer norske konsentrasjonsrammer og beskriver internasjonal TDM som kontekst', async () => {
    const kontekst = tekst(tdm.find((e) => e.data.tittel === 'Konsentrasjon–effekt og internasjonal kontekst')!.data)
    expect(kontekst).toContain('70–350 nmol/L')
    expect(kontekst).toContain('erstatter ikke det norske')

    const toksiskKort = toksisitet.find((e) => e.data.tittel === 'Toksiske konsentrasjoner')!
    const toksiske = tekst(toksiskKort.data)
    expect(toksiske).toContain('700 nmol/L')
    expect(toksiske).toContain('10 000 nmol/L')

    const { rows: toksisitetskilder } = await db().query<{ tittel: string }>(
      `select tittel
       from public.referanser
       where tilstand = 'publisert' and objekt_id = any($1::uuid[])
       order by tittel`,
      [toksiskKort.referanser],
    )
    expect(toksisitetskilder.map((r) => r.tittel)).toEqual(
      expect.arrayContaining([
        'Revisited: Therapeutic and toxic blood concentrations of more than 1100 drugs and other xenobiotics',
        'Consensus Guidelines for Therapeutic Drug Monitoring in Neuropsychopharmacology: Update 2017',
        'Citalopram – behandlingsanbefaling ved forgiftning',
      ]),
    )
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

  it('bruker påstandsnære inline-kilder når teksten er heterogen, og kortkilder når én kilde dekker hele kortet', () => {
    const oppsummering = identitet[0]!
    expect(oppsummering.referanser).toHaveLength(0)
    expect(inlineReferanser(oppsummering.data).length).toBeGreaterThanOrEqual(6)

    const panikk = virkninger.find((e) => e.data.tittel === 'Effekt ved panikklidelse')!
    expect(panikk.referanser).toHaveLength(0)
    expect(new Set(inlineReferanser(panikk.data)).size).toBe(2)

    for (const tittel of ['CYP2C19 og citaloprameksponering', 'Når farmakogenetisk analyse er relevant']) {
      const kort = farmakogenetikk.find((e) => e.data.tittel === tittel)!
      expect(kort.referanser, tittel).toHaveLength(0)
      expect(inlineReferanser(kort.data).length, tittel).toBeGreaterThan(1)
    }

    const tdmKontekst = tdm.find((e) => e.data.tittel === 'Konsentrasjon–effekt og internasjonal kontekst')!
    expect(tdmKontekst.referanser).toHaveLength(0)
    expect(inlineReferanser(tdmKontekst.data).length).toBeGreaterThanOrEqual(5)

    for (const tittel of ['Toksisk dose og eksponering', 'Toksiske konsentrasjoner', 'Toksikokinetiske særtrekk']) {
      const kort = toksisitet.find((e) => e.data.tittel === tittel)!
      expect(kort.referanser, tittel).toHaveLength(0)
      expect(inlineReferanser(kort.data).length, tittel).toBeGreaterThan(1)
    }

    for (const tittel of ['Graviditet', 'Perinatal og neonatal påvirkning', 'Amming']) {
      const kort = graviditet.find((e) => e.data.tittel === tittel)!
      expect(kort.referanser, tittel).toHaveLength(0)
      expect(inlineReferanser(kort.data).length, tittel).toBeGreaterThan(1)
    }

    const fertilitet = graviditet.find((e) => e.data.tittel === 'Fertilitet og reproduksjon')!
    expect(fertilitet.referanser).toHaveLength(1)
    expect(inlineReferanser(fertilitet.data)).toHaveLength(0)

    const toleranse = avhengighet.find((e) => e.data.tittel === 'Toleranseutvikling')!
    expect(toleranse.referanser).toHaveLength(1)
    expect(inlineReferanser(toleranse.data)).toHaveLength(0)

    const seponering = avhengighet.find((e) => e.data.tittel === 'Abstinens, seponeringssyndrom og rebound-effekter')!
    expect(seponering.referanser).toHaveLength(0)
    expect(inlineReferanser(seponering.data).length).toBe(3)

    const addiksjon = avhengighet.find((e) => e.data.tittel === 'Addiksjon')!
    expect(addiksjon.referanser).toHaveLength(0)
    expect(new Set(inlineReferanser(addiksjon.data)).size).toBe(2)
  })

  it('avgrenser CPIC til bruk av et foreliggende CYP2C19-resultat', () => {
    const kort = farmakogenetikk.find((e) => e.data.tittel === 'Når farmakogenetisk analyse er relevant')!
    const innhold = tekst(kort.data)
    expect(innhold).toContain('allerede foreliggende CYP2C19-resultat')
    expect(innhold).toContain('tar ikke stilling til hvem som bør genotypes')
  })

  it('skiller regulatorisk ammeråd fra LactMed/Janusmed-vurderingen', () => {
    const amming = graviditet.find((e) => e.data.tittel === 'Amming')!
    const innhold = tekst(amming.data)
    expect(innhold).toContain('anbefaler forsiktighet')
    expect(innhold).toContain('ikke er grunn til å avslutte amming')
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
      const kildebelegg = e.referanser.length + inlineReferanser(e.data).length
      expect(kildebelegg, String(e.data.tittel ?? e.panel)).toBeGreaterThan(0)
      expect(e.utkast, String(e.data.tittel ?? e.panel)).toBe(e.publisert)
    }
  })
}
