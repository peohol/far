import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, expect, it } from 'vitest'
import { lesLabutvalg } from '../../farmakologiportalen/lesing'
import { byggLabvisning } from '../../farmakologiportalen/stoffside'
import { lesKjemiutvalg } from '../../kjemi/lesing'
import { byggKjemivisning } from '../../kjemi/stoffside'
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
    expect(farmakodynamikk.map((e) => String(e.data.maal))).toEqual(['Serotoninreopptak / SERT'])
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
      'Abstinens, seponeringssyndrom og rebound-effekter',
      'Addiksjon',
    ])
    expect(avhengighet.some((e) => e.data.tittel === 'Toleranseutvikling')).toBe(false)
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
      [inlineReferanser(toksiskKort.data)],
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

  it('viser direkte citalopramevidens og sentrale begrensninger', () => {
    const sert = tekst(farmakodynamikk[0]!.data)
    expect(sert).toContain('4 nmol/L')
    expect(sert).toContain('1414 nmol/L')
    expect(sert).toContain('35 ganger')
    expect(sert).not.toContain('alloster')

    const depresjon = tekst(virkninger.find((e) => e.data.tittel === 'Antidepressiv effekt')!.data)
    expect(depresjon).toContain('RR 1,42')
    expect(depresjon).toContain('Hedges g -0,27')
    expect(depresjon).toContain('upubliserte studier inngikk ikke')

    const panikk = tekst(virkninger.find((e) => e.data.tittel === 'Effekt ved panikklidelse')!.data)
    expect(panikk).toContain('258 inngikk i effektanalysen')
    expect(panikk).toContain('RR 0,82')
    expect(panikk).toContain('to studier, n=628')
    expect(panikk).toContain('manglende remisjon (RR 0,95')
    expect(panikk).toContain('ingen sikker forskjell fra placebo')

    const ocd = tekst(virkninger.find((e) => e.data.tittel === 'Effekt ved tvangslidelse')!.data)
    expect(ocd).toContain('60 mg/døgn overstiger dagens maksimale anbefalte dose')
  })

  it('bygger egne kjemi- og laboratorievisninger for begge citalopramforbindelsene', () => {
    const kjemi = byggKjemivisning(
      'citalopram',
      lesKjemiutvalg({
        kilde: 'PubChem',
        forbindelser: [
          {
            cid: 2771,
            data: {
              cid: 2771,
              tittel: 'Citalopram',
              formel: 'C20H21FN2O',
              molvekt: '324.4',
              inchikey: 'WSEQXVZVJXJVFP-UHFFFAOYSA-N',
              ladning: 0,
              enheter: 1,
              stereo: {},
            },
            sist_hentet_kl: '2026-10-13T00:00:00Z',
          },
          {
            cid: 162180,
            data: {
              cid: 162180,
              tittel: 'Desmethylcitalopram',
              formel: 'C19H19FN2O',
              molvekt: '310.4',
              inchikey: 'PTJADDMMFYXMMG-UHFFFAOYSA-N',
              ladning: 0,
              enheter: 1,
              stereo: {},
            },
            sist_hentet_kl: '2026-10-13T00:00:00Z',
          },
        ],
      }),
    )
    expect(kjemi.rader.map((r) => [r.forbindelse.nokkel, r.status, r.data?.molvekt])).toEqual([
      ['citalopram', 'hentet', '324.4'],
      ['desmetylcitalopram', 'hentet', '310.4'],
    ])

    const laboratorier = byggLabvisning(
      'citalopram',
      lesLabutvalg({
        kilde: { kontrollert_kl: '2026-10-13T00:00:00Z', endret_kl: null },
        komponenter: [
          { id: '536', data: { navn: 'Citalopram', gruppe: [], molvekt: { original: '324,39', verdi: 324.39 } } },
          { id: '795', data: { navn: 'Desmetylcitalopram', gruppe: [], molvekt: { original: null, verdi: null } } },
        ],
        analyser: [
          {
            id: 'cit-serum',
            data: {
              komponent_id: '536',
              navn: 'Citalopram',
              laboratorium_id: 'lab-1',
              laboratorium: 'Klinisk farmakologi',
              institusjon_id: 'inst-1',
              institusjon: 'Norsk sykehus',
              provemateriale: { original: 'Serum', matrise: 'serum_plasma' },
              metode: 'LC-MS/MS',
              maleomrade: { nedre: null, ovre: null, enhet: { original: 'nmol/L', enhet: 'nmol/L' } },
              svarenhet: { original: 'nmol/L', enhet: 'nmol/L' },
              status: 'active',
              synlighet: 'visible',
            },
          },
          {
            id: 'dcit-serum',
            data: {
              komponent_id: '795',
              navn: 'Desmetylcitalopram',
              laboratorium_id: 'lab-1',
              laboratorium: 'Klinisk farmakologi',
              institusjon_id: 'inst-1',
              institusjon: 'Norsk sykehus',
              provemateriale: { original: 'Serum', matrise: 'serum_plasma' },
              metode: 'LC-MS/MS',
              maleomrade: { nedre: null, ovre: null, enhet: { original: 'nmol/L', enhet: 'nmol/L' } },
              svarenhet: { original: 'nmol/L', enhet: 'nmol/L' },
              status: 'active',
              synlighet: 'visible',
            },
          },
        ],
        laboratorier: [
          { id: 'lab-1', data: { navn: 'Klinisk farmakologi', aktiv: true, institusjon_id: 'inst-1', institusjon: 'Norsk sykehus' } },
        ],
        institusjoner: [{ id: 'inst-1', data: { navn: 'Norsk sykehus' } }],
      }),
      kjemi,
    )
    expect(laboratorier.usikre).toHaveLength(0)
    expect(laboratorier.tabeller.map((t) => t.tittel)).toEqual(['Serum · Citalopram', 'Serum · Desmetylcitalopram'])
    expect(laboratorier.tabeller.flatMap((t) => t.rader).map((r) => r.forbindelse?.nokkel)).toEqual([
      'citalopram',
      'desmetylcitalopram',
    ])
  })

  it('angir norsk preanalytikk for serumprøven', () => {
    const prove = tekst(tdm.find((e) => e.data.tittel === 'Prøvetakingstidspunkt')!.data)
    expect(prove).toContain('uten gel')
    expect(prove).toContain('12–24 timer etter siste dose')
    expect(prove).toContain('tidspunkt for siste dose og prøvetaking')
  })

  it('bruker påstandsnære inline-kilder når teksten er heterogen, og kortkilder når én kilde dekker hele kortet', () => {
    const oppsummering = identitet[0]!
    expect(oppsummering.referanser).toHaveLength(0)
    expect(inlineReferanser(oppsummering.data).length).toBeGreaterThanOrEqual(6)

    const panikk = virkninger.find((e) => e.data.tittel === 'Effekt ved panikklidelse')!
    expect(panikk.referanser).toHaveLength(0)
    expect(new Set(inlineReferanser(panikk.data)).size).toBe(3)

    for (const tittel of ['CYP-enzymer (substrat)', 'CYP2C19 og citaloprameksponering', 'Når farmakogenetisk analyse er relevant']) {
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

  it('beskriver absoluttrisiko i svangerskapet og klinisk oppfølging ved amming', () => {
    const gravid = tekst(graviditet.find((e) => e.data.tittel === 'Graviditet')!.data)
    expect(gravid).toContain('1,3 %')
    expect(gravid).toContain('rundt 1 %')

    const perinatal = tekst(graviditet.find((e) => e.data.tittel === 'Perinatal og neonatal påvirkning')!.data)
    expect(perinatal).toContain('to til tre av ti')
    expect(perinatal).toContain('under 0,4 %')

    const amming = graviditet.find((e) => e.data.tittel === 'Amming')!
    const innhold = tekst(amming.data)
    expect(innhold).toContain('3–6 %')
    expect(innhold).toContain('ikke i seg selv grunn til å avslutte amming')
    expect(innhold).toContain('matinntak og vektutvikling')
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
