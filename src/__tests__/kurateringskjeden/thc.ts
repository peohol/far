import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, expect, it } from 'vitest'
import { type Element, elementer, inlineReferanser, tekst } from '../hjelp/kurateringskjeden'

/**
 * Full redaksjonell THC-kuratering. Tester også at innholdet ikke forveksler
 * THC med THC-COOH, cannabis som helprodukt eller Sativex (THC + CBD).
 *
 * Norsk Sativex-SPC fra 28.05.2026 er også importert som strukturert bivirkningskilde,
 * med klinisk datagrunnlag adskilt fra isolert THC.
 */
export default function thc(db: () => PGlite): void {
  let alle: Element[]
  const panel = async (navn: string) => elementer(db(), 'thc', navn)

  beforeAll(async () => {
    alle = await elementer(db(), 'thc')
  })

  it('har konsis oppsummering, CB1/CB2 og de dokumenterte redaksjonelle kortene', async () => {
    expect(await panel('identitet')).toHaveLength(1)
    expect((await panel('farmakodynamikk')).map((x) => x.data.maal)).toEqual([
      'CB₁-reseptor',
      'CB₂-reseptor',
    ])
    const virkninger = await panel('virkninger')
    expect(virkninger.map((x) => x.data.tittel)).toEqual([
      'Akutt rus og subjektive virkninger',
      'Kognisjon og psykomotorikk',
      'Psykotomimetiske virkninger',
      'Spastisitet ved multippel sklerose',
      'Appetittstimulering',
      'Antiemetisk effekt',
      'Analgetisk effekt',
      'Kardiovaskulære virkninger',
    ])
    const smerte = tekst(virkninger.find((x) => x.data.tittel === 'Analgetisk effekt')!.data)
    expect(smerte).toContain('Cochrane-oversikt fra 2026')
    expect(smerte).toContain('ikke sikker dokumentasjon')
    const appetitt = tekst(virkninger.find((x) => x.data.tittel === 'Appetittstimulering')!.data)
    expect(appetitt).toContain('amerikansk indikasjon')
    expect(await panel('dosering')).toHaveLength(1)
    expect(await panel('indikasjon')).toHaveLength(1) // den eldre kildebelagte indikasjonen bevares
    expect(await panel('bivirkninger')).toHaveLength(1)
    expect(await panel('farmakokinetikk')).toHaveLength(4)
    const pk = (await panel('farmakokinetikk')).map((e) => tekst(e.data)).join(' ')
    expect(pk).toContain('13 nmol/L')
    expect(pk).not.toContain('ng/mL')
    expect(await panel('farmakogenetikk')).toHaveLength(2)
    expect(await panel('interaksjoner')).toHaveLength(1)
    expect(await panel('tdm')).toHaveLength(1)
  })

  it('har faste toksisitets-, graviditets- og avhengighetskort uten å fylle dokumentasjonshull', async () => {
    expect((await panel('toksisitet_forgiftning')).map((x) => x.data.tittel)).toEqual([
      'Toksisk dose og eksponering',
      'Toksiske konsentrasjoner',
      'Klinisk forgiftningsbilde',
      'Alvorlige komplikasjoner',
      'Toksikokinetiske særtrekk',
      'Behandling ved forgiftning',
    ])
    expect((await panel('graviditet_amming')).map((x) => x.data.tittel)).toEqual([
      'Graviditet', 'Perinatal og neonatal påvirkning', 'Amming', 'Fertilitet og reproduksjon',
    ])
    expect((await panel('avhengighet_toleranse')).map((x) => x.data.tittel)).toEqual([
      'Toleranseutvikling', 'Abstinens, seponeringssyndrom og rebound-effekter', 'Addiksjon',
    ])
  })

  it('bevarer Sativex-bivirkninger fra norsk SPC, inkludert frekvens og fotnoter', async () => {
    const { rows } = await db().query<{
      totalt: number
      organsystemer: number
      svaert_vanlige: number
      vanlige: number
      mindre_vanlige: number
      fotnoter: number
      revisjonsdato: string | null
    }>(`
      select count(*)::integer as totalt,
        count(distinct b.organsystem)::integer as organsystemer,
        count(*) filter (where b.frekvens = 'svaert_vanlige')::integer as svaert_vanlige,
        count(*) filter (where b.frekvens = 'vanlige')::integer as vanlige,
        count(*) filter (where b.frekvens = 'mindre_vanlige')::integer as mindre_vanlige,
        count(*) filter (where b.fotnote is not null)::integer as fotnoter,
        max(k.revisjonsdato)::text as revisjonsdato
      from bivirkninger.bivirkninger b
      join bivirkninger.kilder k on k.id = b.kilde
      join public.infosider s on s.objekt_id = k.infoside and s.tilstand = 'publisert'
      where s.slug = 'thc'
        and k.nokkel = 'sativex-munnspray-11-8809'
        and k.erstattet_av is null and k.trukket_kl is null
    `)
    expect(rows[0]).toEqual({
      totalt: 53,
      organsystemer: 13,
      svaert_vanlige: 2,
      vanlige: 37,
      mindre_vanlige: 14,
      fotnoter: 3,
      revisjonsdato: '2026-05-28',
    })
  })

  it('skiller mellom molekyl, aktiv og inaktiv metabolitt, matriser og preparatkilder', async () => {
    const identitet = tekst((await panel('identitet'))[0]!.data)
    expect(identitet).toContain('11-OH-THC')
    expect(identitet).toContain('THC-COOH')
    expect(identitet).toContain('THC alene')
    const tdm = tekst((await panel('tdm'))[0]!.data)
    expect(tdm).toContain('fullblod')
    expect(tdm).toContain('THC-COOH')
    expect(tdm).toContain('ikke ett allment validert')
    const dose = tekst((await panel('dosering'))[0]!.data)
    expect(dose).toContain('2,7 mg THC og 2,5 mg CBD')
    expect(dose).toContain('12 sprayer')
    expect(dose).toContain('ikke brukes som generell doseanbefaling')
    const graviditet = tekst((await panel('graviditet_amming')).find((x) => x.data.tittel === 'Graviditet')!.data)
    expect(graviditet).toContain('assosiasjoner')
    expect(graviditet).toContain('ikke presenteres som THC-spesifikke kausale risikoer')
  })

  it('kobler alle redaksjonelle påstander til publiserte referanser ved påstanden', async () => {
    const nyePaneler = new Set([
      'identitet', 'farmakodynamikk', 'virkninger', 'bivirkninger',
      'toksisitet_forgiftning', 'dosering', 'farmakokinetikk',
      'farmakogenetikk', 'interaksjoner', 'tdm',
      'graviditet_amming', 'avhengighet_toleranse',
    ])
    const nye = alle.filter((x) => nyePaneler.has(x.panel))
    expect(nye.length).toBeGreaterThan(20)
    for (const x of nye) {
      expect(x.utkast, String(x.data.tittel ?? x.panel)).toBe(x.publisert)
      expect(x.referanser, String(x.data.tittel ?? x.panel)).toHaveLength(0)
      const ids = inlineReferanser(x.data)
      expect(ids.length, String(x.data.tittel ?? x.panel)).toBeGreaterThan(0)
      const { rows } = await db().query<{ n: number }>(
        "select count(*)::integer as n from public.referanser where tilstand='publisert' and objekt_id = any($1::uuid[])",
        [ids],
      )
      expect(rows[0]!.n, String(x.data.tittel ?? x.panel)).toBe(new Set(ids).size)
    }
  })

  it('bevarer den særskilte THC-syre-fortolkningen og eksisterende datalag uendret', async () => {
    const { rows: koblinger } = await db().query<{ kode: string }>(
      "select distinct kode from public.laboratorieanalytter where kode in ('THC','IRCAK')",
    )
    // Labkodekoblingene er uavhengige av monografiens redaksjonelle kort.
    expect(koblinger.map((r) => r.kode)).toEqual(expect.arrayContaining(['THC']))
    const toksisk = tekst((await panel('toksisitet_forgiftning')).find((x) => x.data.tittel === 'Toksiske konsentrasjoner')!.data)
    expect(toksisk).toContain('ikke en validert universell toksisitetsgrense')
  })
}
