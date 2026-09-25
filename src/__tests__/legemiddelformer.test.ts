/**
 * Ikonregisteret for legemiddelformene og den maskinelle listen over formene
 * de publiserte stoffsidene faktisk bruker.
 *
 * `legemiddelformer-i-bruk.json` lages av `scripts/legemiddelformer-i-bruk.sql`
 * mot produksjonsdatabasen (se `docs/legemiddeldata.md`). Den har alle formene
 * i FEST og formene de publiserte stoffsidene bruker. Når listen lages på nytt
 * etter en FEST-oppdatering og har fått en form ingen regel passer for, feiler
 * prøven under med navnet og koden på formen, til reglene fanger den.
 *
 * Spørringen selv prøves her mot en ekte database med utdraget fra FEST, så
 * den ikke kan slutte å virke uten at det merkes.
 */
import { readFileSync } from 'node:fs'
import { beforeAll, describe, expect, it } from 'vitest'
import { lagFaginnholdslager } from '../faginnhold/lagring'
import { ELEMENTTYPER } from '../faginnhold/paneler'
import { FORMKODER, FORMREGLER, FORMVARIANTER, formikon, GENERISK_FORM } from '../legemiddeldata/legemiddelformer'
import iBruk from '../legemiddeldata/legemiddelformer-i-bruk.json'
import { IKONER } from '../components/ikon/register'
import { AMITRIPTYLIN, KODEIN, synkroniserUtdrag } from './hjelp/fest'
import { faginnholdskall, nyDatabase, opprettBruker } from './hjelp/testdatabase'

const SPORRING = readFileSync(new URL('../../scripts/legemiddelformer-i-bruk.sql', import.meta.url), 'utf8')

interface Form {
  kode: string | null
  tekst: string | null
  merkevarer: number
}

interface FormerIBruk {
  hentet: string
  kildedato: string | null
  virkestoff: number
  former: Form[]
  alle: Form[]
}

const liste = iBruk as FormerIBruk
const ukartlagte = (former: Form[]) =>
  former.filter((f) => !formikon(f.kode, f.tekst).kartlagt).map((f) => `${f.tekst ?? 'uten tekst'} (kode ${f.kode ?? 'mangler'})`)

describe('ikonregisteret for legemiddelformene', () => {
  it('har et ikon for hver form i FEST', () => {
    expect(ukartlagte(liste.alle), 'Nye legemiddelformer i FEST må fanges av FORMREGLER i legemiddelformer.ts').toEqual([])
    // Den eneste som står igjen med det generiske ikonet, er valgt med vilje.
    const generiske = liste.alle.filter((f) => formikon(f.kode, f.tekst).ikon === 'fallback').map((f) => f.tekst)
    expect(generiske).toEqual(['Medisinsk blodigle'])
  })

  it('har et eget ikon for hver form de publiserte stoffsidene bruker', () => {
    expect(ukartlagte(liste.former)).toEqual([])
    for (const { kode, tekst } of liste.former) expect(formikon(kode, tekst).ikon, tekst ?? '').not.toBe('fallback')
  })

  it('har listene over formene hentet fra FEST', () => {
    expect(liste.former.length).toBeGreaterThan(0)
    expect(liste.alle.length).toBeGreaterThanOrEqual(liste.former.length)
    expect(liste.hentet).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    // Koden er identiteten: hver kode én gang, og formene i bruk finnes i FEST.
    for (const former of [liste.former, liste.alle]) expect(new Set(former.map((f) => f.kode)).size).toBe(former.length)
    const alle = new Set(liste.alle.map((f) => f.kode))
    for (const { kode } of liste.former) expect(alle).toContain(kode)
  })

  it('gir det generiske ikonet for en ukjent eller manglende form, merket som ukartlagt', () => {
    for (const [kode, tekst] of [
      ['999999', 'Ukjent form'],
      ['', ''],
      [null, null],
      [undefined, undefined],
    ] as const) {
      expect(formikon(kode, tekst)).toEqual({ variant: GENERISK_FORM, ikon: FORMVARIANTER[GENERISK_FORM].ikon, kartlagt: false })
    }
    expect(formikon('53', 'Tablett')).toEqual({ variant: 'tablett', ikon: 'tablet', kartlagt: true })
    expect(formikon('25', 'Depottablett')).toMatchObject({ variant: 'depottablett', ikon: 'depot' })
  })

  it('lar en FEST-kode i FORMKODER gå foran reglene', () => {
    expect(formikon('531', 'Medisinsk blodigle')).toEqual({ variant: 'generisk', ikon: 'fallback', kartlagt: true })
  })

  it('peker bare på varianter som finnes, og bare på ikoner i ikonregisteret', () => {
    for (const variant of [...Object.values(FORMKODER), ...FORMREGLER.map((r) => r.variant)]) {
      expect(FORMVARIANTER).toHaveProperty(variant)
    }
    for (const { ikon } of Object.values(FORMVARIANTER)) expect(IKONER).toHaveProperty(ikon)
  })

  it.each([
    ['Tablett', 'tablet'],
    ['Smeltetablett', 'tablet'],
    ['Oppløselig tablett', 'tablet'],
    ['Munnsmeltende film', 'tablet'],
    ['Depottablett', 'depot'],
    ['Tablett med modifisert frisetting', 'depot'],
    ['Depottyggetablett', 'depot'],
    ['Kapsel med modifisert frisetting, hard', 'capsule'],
    ['Granulat i kapsel som åpnes', 'capsule'],
    ['Mikstur, oppløsning', 'bottle'],
    ['Konsentrat til mikstur', 'bottle'],
    ['Granulat til mikstur, suspensjon', 'bottle'],
    ['Sirup', 'bottle'],
    ['Dråper, oppløsning', 'dropper'],
    ['Depotøyedråper, oppløsning', 'dropper'],
    ['Oppløsning til prikktest', 'dropper'],
    ['Injeksjonsvæske, oppløsning', 'syringe'],
    ['Injeksjons-/infusjonsvæske, oppløsning', 'syringe'],
    ['Pulver og væske til depotinjeksjonsvæske, suspensjon', 'syringe'],
    ['Preparasjonssett til radioaktive legemidler', 'syringe'],
    ['Infusjonsvæske, oppløsning', 'infusion'],
    ['Konsentrat til infusjonsvæske, oppløsning', 'infusion'],
    ['Pulver til konsentrat til infusjonsvæske, oppløsning', 'infusion'],
    ['Peritonealdialysevæske', 'infusion'],
    ['Inhalasjonspulver, hard kapsel', 'inhaler'],
    ['Væske til inhalasjonsdamp', 'inhaler'],
    ['Nesespray, oppløsning', 'spray'],
    ['Rektalskum', 'spray'],
    ['Krem', 'tube'],
    ['Øyesalve', 'tube'],
    ['Oralgel', 'tube'],
    ['Depotplaster', 'patch'],
    ['Plaster til provokasjonstest', 'patch'],
    ['Granulat', 'sachet'],
    ['Depotgranulat', 'sachet'],
    ['Granulat, filmdrasjert', 'sachet'],
    ['Pulver', 'sachet'],
    ['Stikkpille', 'suppository'],
    ['Vagitorie', 'suppository'],
    ['Implantat', 'implant'],
    ['Intrauterint innlegg', 'implant'],
    ['Medisinsk gass, komprimert', 'gas'],
    ['Rektalvæske, oppløsning', 'bottle'],
    ['Tablett og væske til rektalvæske, suspensjon', 'bottle'],
  ])('gir «%s» ikonet %s', (tekst, ikon) => {
    expect(formikon(null, tekst)).toMatchObject({ ikon, kartlagt: true })
  })

  it.each([
    ['Peroralt', 'tablet'],
    ['Oralt', 'tablet'],
    ['Depotinjeksjon (Xeplion)', 'syringe'],
    ['Depot', 'syringe'],
    ['Intravenøst', 'syringe'],
    ['i.v.', 'syringe'],
    ['Infusjon', 'infusion'],
    ['Mikstur', 'bottle'],
    ['Depottablett', 'depot'],
  ])('gir redaktørens navn «%s» ikonet %s', (tekst, ikon) => {
    expect(formikon(null, tekst).ikon).toBe(ikon)
  })
})

describe('spørringen som lager listen', () => {
  let resultat: FormerIBruk

  beforeAll(async () => {
    const db = await nyDatabase()
    await synkroniserUtdrag(db)
    const admin = await opprettBruker(db, { brukernavn: 'redaktor', fornavn: 'Rita', etternavn: 'Redaktør', rolle: 'admin' })
    const lager = lagFaginnholdslager(faginnholdskall(db, admin).klientFor(admin))

    const kobling = async (side: string, fest_id: string, navn: string) =>
      lager.opprettUtkast('innholdselement', {
        infoside: side,
        panel: 'preparater',
        posisjon: 0,
        elementtype: ELEMENTTYPER.legemiddelkobling,
        data: { virkestoff: [{ fest_id, navn }] },
      })

    // En publisert side koblet til amitriptylin …
    const publisert = await lager.opprettUtkast('infoside', { navn: 'Amitriptylin' })
    const publisertKobling = await kobling(publisert.id, AMITRIPTYLIN, 'Amitriptylin')
    await lager.publiserUtkast(publisert.id, publisert.revisjon!)
    await lager.publiserUtkast(publisertKobling.id, publisertKobling.revisjon!)
    // … og et utkast koblet til kodein, som ikke skal telle.
    const utkast = await lager.opprettUtkast('infoside', { navn: 'Kodein' })
    await kobling(utkast.id, KODEIN, 'Kodein')

    const { rows } = await db.query<{ legemiddelformer: FormerIBruk }>(SPORRING)
    resultat = rows[0]!.legemiddelformer
  })

  it('finner formene til preparatene på de publiserte sidene, med salter og fritak', () => {
    expect(resultat.virkestoff).toBe(1)
    expect(resultat.former).toEqual([
      // Kodimagnyl (tablett) fra kodeinutkastet er ikke med: 8 tabletter er amitriptylin.
      { kode: '53', tekst: 'Tablett', merkevarer: 8 },
      { kode: '743', tekst: 'Depotkapsel, hard', merkevarer: 1 },
      { kode: '842', tekst: 'Mikstur, oppløsning', merkevarer: 2 },
    ])
  })

  it('finner alle formene i FEST, også de ingen publisert side bruker', () => {
    const koder = resultat.alle.map((f) => f.kode)
    expect(koder).toEqual(expect.arrayContaining(resultat.former.map((f) => f.kode)))
    // Kodimagnyl (tablett) fra kodeinutkastet teller med her.
    const tabletter = resultat.alle.find((f) => f.kode === '53')!
    expect(tabletter.merkevarer).toBeGreaterThan(8)
  })

  it('gir samme form som filen i repoet', () => {
    expect(Object.keys(resultat).sort()).toEqual(Object.keys(iBruk).sort())
    expect(resultat.hentet).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
