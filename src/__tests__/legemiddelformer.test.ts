/**
 * Ikonregisteret for legemiddelformene og den maskinelle listen over formene
 * de publiserte stoffsidene faktisk bruker.
 *
 * `legemiddelformer-i-bruk.json` lages av `scripts/legemiddelformer-i-bruk.sql`
 * mot produksjonsdatabasen (se `docs/legemiddeldata.md`). Når listen lages på
 * nytt etter en FEST-oppdatering og har fått en ny form, feiler prøven under
 * med navnet og koden på formen, til den er lagt inn i registeret.
 *
 * Spørringen selv prøves her mot en ekte database med utdraget fra FEST, så
 * den ikke kan slutte å virke uten at det merkes.
 */
import { readFileSync } from 'node:fs'
import { beforeAll, describe, expect, it } from 'vitest'
import { lagFaginnholdslager } from '../faginnhold/lagring'
import { ELEMENTTYPER } from '../faginnhold/paneler'
import { FORMKODER, FORMVARIANTER, formikon, GENERISK_FORM } from '../legemiddeldata/legemiddelformer'
import iBruk from '../legemiddeldata/legemiddelformer-i-bruk.json'
import { IKONER } from '../components/ikon/register'
import { AMITRIPTYLIN, KODEIN, synkroniserUtdrag } from './hjelp/fest'
import { faginnholdskall, nyDatabase, opprettBruker } from './hjelp/testdatabase'

const SPORRING = readFileSync(new URL('../../scripts/legemiddelformer-i-bruk.sql', import.meta.url), 'utf8')

interface FormerIBruk {
  hentet: string
  kildedato: string | null
  virkestoff: number
  former: { kode: string | null; tekst: string | null; merkevarer: number }[]
}

describe('ikonregisteret for legemiddelformene', () => {
  it('har et eget ikon for hver form de publiserte stoffsidene bruker', () => {
    const ukartlagte = (iBruk as FormerIBruk).former
      .filter((f) => !formikon(f.kode).kartlagt)
      .map((f) => `${f.tekst ?? 'uten tekst'} (kode ${f.kode ?? 'mangler'})`)
    expect(ukartlagte, 'Nye legemiddelformer i FEST må legges inn i FORMKODER i legemiddelformer.ts').toEqual([])
  })

  it('har listen over formene i bruk hentet fra FEST', () => {
    const liste = iBruk as FormerIBruk
    expect(liste.former.length).toBeGreaterThan(0)
    expect(liste.hentet).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    // Koden er identiteten: hver kode én gang.
    expect(new Set(liste.former.map((f) => f.kode)).size).toBe(liste.former.length)
  })

  it('gir det generiske ikonet for en ukjent eller manglende form, merket som ukartlagt', () => {
    for (const kode of ['999999', '', null, undefined]) {
      expect(formikon(kode)).toEqual({ variant: GENERISK_FORM, ikon: FORMVARIANTER[GENERISK_FORM].ikon, kartlagt: false })
    }
    expect(formikon('53')).toEqual({ variant: 'tablett', ikon: 'tablet', kartlagt: true })
    expect(formikon('25')).toMatchObject({ variant: 'depottablett', ikon: 'depot' })
  })

  it('peker bare på varianter som finnes, og bare på ikoner i ikonregisteret', () => {
    for (const variant of Object.values(FORMKODER)) expect(FORMVARIANTER).toHaveProperty(variant)
    for (const { ikon } of Object.values(FORMVARIANTER)) expect(IKONER).toHaveProperty(ikon)
  })

  it('gir injeksjonene sprøyten, miksturene flasken og dråpene dråpeflasken', () => {
    expect(formikon('816').ikon).toBe('syringe') // Injeksjonsvæske, oppløsning
    expect(formikon('913').ikon).toBe('syringe') // Depotinjeksjonsvæske, suspensjon
    expect(formikon('842').ikon).toBe('bottle') // Mikstur, oppløsning
    expect(formikon('748').ikon).toBe('dropper') // Dråper, oppløsning
    // Ingen form som er i bruk på de publiserte sidene, står igjen med det generiske ikonet.
    for (const { kode } of (iBruk as FormerIBruk).former) expect(formikon(kode).ikon).not.toBe('fallback')
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

  it('gir samme form som filen i repoet', () => {
    expect(Object.keys(resultat).sort()).toEqual(Object.keys(iBruk).sort())
    expect(resultat.hentet).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
