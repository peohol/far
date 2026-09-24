/**
 * Visningsmodellen for Preparater: legemiddelform → styrke → preparater →
 * preparatdetalj (`src/legemiddeldata/preparatmodell.ts`).
 *
 * Første del bruker det ekte FEST-utdraget, lest slik appen leser det. Andre
 * del bygger små syntetiske utvalg for tilfellene der to styrker kan se like
 * ut uten å være det: salter, kombinasjoner, nevnere, intervaller og
 * operatorer. Navnene der er oppdiktet.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import type { Kode, Merkevaredata, Styrkedata } from '../legemiddeldata/fest'
import type { Legemiddelutvalg, MedId } from '../legemiddeldata/lesing'
import {
  byggPreparatvisning,
  oppsummerForm,
  oppsummerPreparatvisning,
  oppsummerStyrke,
  ukartlagteFormer,
  type Preparatvisning,
} from '../legemiddeldata/preparatmodell'
import { formaterTall } from '../faginnhold/paneler'
import { byggPreparatoversikt, GODKJENNINGSFRITAK } from '../legemiddeldata/preparater'
import { AMITRIPTYLIN, innloggetLeser, KODEIN, synkroniserUtdrag } from './hjelp/fest'
import { nyDatabase } from './hjelp/testdatabase'

describe('preparatmodellen med utdraget fra FEST', () => {
  let amitriptylin: Legemiddelutvalg
  let kodein: Legemiddelutvalg
  let visning: Preparatvisning

  beforeAll(async () => {
    const db = await nyDatabase()
    await synkroniserUtdrag(db)
    const leser = innloggetLeser(db)
    amitriptylin = await leser.les([AMITRIPTYLIN])
    kodein = await leser.les([KODEIN])
    visning = byggPreparatvisning(amitriptylin, [AMITRIPTYLIN])
  })

  it('grupperer etter form og styrke, med fritakene i samme lister', () => {
    expect(visning.former.map((f) => [f.id, f.form, f.ikon.variant])).toEqual([
      ['743', 'Depotkapsel, hard', 'depotkapsel'],
      ['842', 'Mikstur, oppløsning', 'mikstur'],
      ['53', 'Tablett', 'tablett'],
    ])
    const tablett = visning.former.find((f) => f.id === '53')!
    expect(tablett.styrker.map((s) => [s.styrke, s.preparater.map((p) => p.navn)])).toEqual([
      ['10 mg', ['Amitriptylin Abcur', 'Amitriptylin Orifarm', 'Sarotex']],
      ['25 mg', ['Amitriptylin Abcur', 'Amitriptylin Orifarm', 'Amitriptylin-CT', 'Sarotex']],
      ['50 mg', ['Amitriptylin Abcur']],
    ])
    // Godkjenningsfritaket er et merke på preparatet i styrken, ikke en egen gruppe.
    const ct = tablett.styrker[1]!.preparater.find((p) => p.navn === 'Amitriptylin-CT')!
    expect(ct.merker).toEqual([{ type: 'godkjenningsfritak', tekst: expect.any(String) }])
    expect(tablett.styrker[1]!.preparater.filter((p) => p.merker.length === 0)).toHaveLength(3)
  })

  it('oppsummerer seksjonen, formene og styrkene', () => {
    expect(oppsummerPreparatvisning(visning)).toBe('7 preparater · 3 legemiddelformer · 5 styrker · 4 med godkjenningsfritak')
    expect(visning.former.map(oppsummerForm)).toEqual([
      '1 styrke · 50 mg · 1 preparat',
      '2 styrker · 10–50 mg/5 ml · 2 preparater',
      '3 styrker · 10–50 mg · 4 preparater',
    ])
    expect(oppsummerStyrke(visning.former[2]!.styrker[1]!)).toBe('4 preparater')
    expect(oppsummerPreparatvisning(byggPreparatvisning({ ...amitriptylin, merkevarer: [] }, [AMITRIPTYLIN]))).toBe('')
  })

  it('har hele preparatet i detaljen, med alle styrkene og det FEST sier om dem', () => {
    const abcur = visning.preparater.get('53:Amitriptylin Abcur')!
    expect(abcur).toMatchObject({
      navn: 'Amitriptylin Abcur',
      form: 'Tablett',
      langform: ['Tablett, filmdrasjert'],
      virkestoff: ['Amitriptylin'],
      administrasjonsveier: ['Oral bruk'],
      reseptgrupper: ['Reseptgruppe C'],
      produsenter: ['Abcur AB'],
      atc: [{ kode: 'N06AA09', tekst: 'Amitriptylin' }],
      merker: [],
    })
    // Styrkene står i samme rekkefølge som i formen, og peker på styrkekortene der.
    const tablett = visning.former.find((f) => f.id === '53')!
    expect(abcur.styrker.map((s) => s.styrke_id)).toEqual(tablett.styrker.map((s) => s.id))
    expect(abcur.styrker.map((s) => [s.styrke, s.preparatomtaler.length, s.pakninger.length > 0])).toEqual([
      ['10 mg', 1, true],
      ['25 mg', 1, true],
      ['50 mg', 1, true],
    ])

    const retard = visning.preparater.get('743:Saroten Retard')!
    expect(retard.styrker[0]!.handtering.knusing).toEqual({ status: 'nei', tekst: 'Kan ikke knuses' })
    expect(retard.merker.map((m) => m.type)).toEqual(['godkjenningsfritak'])
  })

  it('mister ingenting av det dagens visning har: alle merkevarer, pakninger og lenker', () => {
    const gammel = byggPreparatoversikt(amitriptylin, [AMITRIPTYLIN])
    const gamle = [...gammel.former.flatMap((f) => f.preparater), ...gammel.godkjenningsfritak]
    const nye = [...visning.preparater.values()]
    const alt = (liste: { styrker: { pakninger: { id: string }[]; preparatomtaler: string[] }[] }[]) => ({
      pakninger: liste.flatMap((p) => p.styrker.flatMap((s) => s.pakninger.map((k) => k.id))).sort(),
      omtaler: liste.flatMap((p) => p.styrker.flatMap((s) => s.preparatomtaler)).sort(),
    })
    expect(alt(nye)).toEqual(alt(gamle))
    expect(nye.flatMap((p) => p.styrker.flatMap((s) => s.merkevarer)).sort()).toEqual(amitriptylin.merkevarer.map((m) => m.id).sort())
    expect(nye.map((p) => p.navn).sort()).toEqual(gamle.map((p) => p.navn).sort())
  })

  it('viser kombinasjonen med alle virkestoffene og merker den', () => {
    const v = byggPreparatvisning(kodein, [KODEIN])
    expect(v.former.map((f) => f.form)).toEqual(['Tablett'])
    const [styrke] = v.former[0]!.styrker
    expect(styrke).toMatchObject({
      styrke: 'kodein 9,6 mg + acetylsalisylsyre 500 mg + magnesiumoksid 150 mg',
      kombinasjon: true,
      mengde: null,
    })
    expect(styrke!.ledd.map((l) => [l.virkestoff, l.egen])).toEqual([
      ['Kodein', true],
      ['Acetylsalisylsyre', false],
      ['Magnesiumoksid', false],
    ])
    const [kodimagnyl] = v.preparater.values()
    expect(kodimagnyl!.merker.map((m) => m.type)).toEqual(['godkjenningsfritak', 'kombinasjon'])
    expect(kodimagnyl!.kombinasjon).toEqual(['Acetylsalisylsyre', 'Magnesiumoksid'])
  })

  it('gir de samme, adressetrygge ID-ene hver gang', () => {
    const igjen = byggPreparatvisning({ ...amitriptylin, merkevarer: [...amitriptylin.merkevarer].reverse() }, [AMITRIPTYLIN])
    const ider = (v: Preparatvisning) => v.former.flatMap((f) => f.styrker.map((s) => s.id))
    expect(ider(igjen)).toEqual(ider(visning))
    for (const id of ider(visning)) expect(id).toMatch(/^[a-z0-9-]+$/)
  })
})

/* --- Styrker som kan se like ut ------------------------------------------- */

const TABLETT: Kode = { kode: '53', tekst: 'Tablett' }
const MIKSTUR: Kode = { kode: '842', tekst: 'Mikstur, oppløsning' }

function mengde(verdi: number, enhet: string) {
  return { verdi, enhet }
}

function styrke(id: string, virkestoff_id: string, felt: Partial<Styrkedata> = {}): MedId<Styrkedata> {
  return {
    id,
    virkestoff_id,
    styrke: mengde(25, 'mg'),
    nevner: null,
    ovre: null,
    operator: { kode: 'L', tekst: 'Lik' },
    alternativ_styrke: null,
    alternativ_nevner: null,
    ...felt,
  }
}

function merkevare(id: string, varenavn: string, styrker: string[], felt: Partial<Merkevaredata> = {}): MedId<Merkevaredata> {
  return {
    id,
    varenavn,
    navn_form_styrke: `${varenavn} ${id}`,
    legemiddelform: TABLETT,
    legemiddelform_lang: null,
    atc: null,
    reseptgruppe: null,
    preparattype: { kode: '7', tekst: 'Legemiddel' },
    administrasjonsveier: [],
    deling: null,
    kan_knuses: null,
    kan_apnes: null,
    produsent: null,
    referanseprodukt: null,
    preparatomtale: null,
    svart_trekant: false,
    virkestoff_med_styrke: styrker,
    virkestoff_uten_styrke: [],
    ...felt,
  }
}

function utvalg(styrker: MedId<Styrkedata>[], merkevarer: MedId<Merkevaredata>[]): Legemiddelutvalg {
  return {
    kilde: 'FEST',
    kontrollert_kl: null,
    kildedato: null,
    virkestoff: [
      { id: 'mor', navn: 'Testmiddel', navn_engelsk: null, salter: ['salt'], utgatt: false },
      { id: 'salt', navn: 'Testmiddelhydroklorid', navn_engelsk: null, salter: [], utgatt: false },
      { id: 'annet', navn: 'Hjelpestoff', navn_engelsk: null, salter: [], utgatt: false },
    ],
    styrker,
    merkevarer,
    pakninger: [],
    byttegrupper: [],
  }
}

const styrkerI = (v: Preparatvisning, form = 0) => v.former[form]!.styrker.map((s) => [s.styrke, s.presisering])

describe('styrker som ser like ut, men ikke er det', () => {
  it('skiller et salt fra moderstoffet, og sier hvilket som er hvilket', () => {
    const v = byggPreparatvisning(
      utvalg(
        [styrke('s1', 'mor'), styrke('s2', 'salt')],
        [merkevare('m1', 'Alfa', ['s1']), merkevare('m2', 'Beta', ['s2'])],
      ),
      ['mor'],
    )
    expect(styrkerI(v)).toEqual([
      ['25 mg', 'testmiddel'],
      ['25 mg', 'testmiddelhydroklorid'],
    ])
    expect(v.former[0]!.styrker[1]!.ledd[0]).toMatchObject({ salt: true, egen: true })
    expect(v.preparater.get('53:Beta')!.salter).toEqual(['Testmiddelhydroklorid'])
  })

  it('skiller mg, mg/ml og mg/5 ml', () => {
    const v = byggPreparatvisning(
      utvalg(
        [
          styrke('s1', 'mor', { styrke: mengde(10, 'mg') }),
          styrke('s2', 'mor', { styrke: mengde(10, 'mg'), nevner: mengde(1, 'ml') }),
          styrke('s3', 'mor', { styrke: mengde(10, 'mg'), nevner: mengde(5, 'ml') }),
        ],
        [
          merkevare('m1', 'Alfa', ['s1'], { legemiddelform: MIKSTUR }),
          merkevare('m2', 'Alfa', ['s2'], { legemiddelform: MIKSTUR }),
          merkevare('m3', 'Alfa', ['s3'], { legemiddelform: MIKSTUR }),
        ],
      ),
      ['mor'],
    )
    expect(styrkerI(v)).toEqual([
      ['10 mg', null],
      ['10 mg/5 ml', null],
      ['10 mg/ml', null],
    ])
    // Ett preparat med tre styrker.
    expect(v.preparater.get('842:Alfa')!.styrker).toHaveLength(3)
  })

  it('skiller en kombinasjon fra enkeltstoffet, uansett rekkefølgen i FEST', () => {
    const v = byggPreparatvisning(
      utvalg(
        [styrke('s1', 'mor'), styrke('s2', 'annet', { styrke: mengde(5, 'mg') })],
        [
          merkevare('m1', 'Alfa', ['s1']),
          merkevare('m2', 'Kombi', ['s1', 's2']),
          merkevare('m3', 'Kombi omvendt', ['s2', 's1']),
        ],
      ),
      ['mor'],
    )
    expect(v.former[0]!.styrker.map((s) => [s.styrke, s.preparater.map((p) => p.navn)])).toEqual([
      ['25 mg', ['Alfa']],
      ['testmiddel 25 mg + hjelpestoff 5 mg', ['Kombi', 'Kombi omvendt']],
    ])
  })

  it('skiller intervaller, operatorer og alternative styrker', () => {
    const v = byggPreparatvisning(
      utvalg(
        [
          styrke('s1', 'mor', { styrke: mengde(5, 'mg') }),
          styrke('s2', 'mor', { styrke: mengde(5, 'mg'), ovre: mengde(10, 'mg'), operator: { kode: 'I', tekst: 'Intervall' } }),
          styrke('s3', 'mor', { styrke: mengde(5, 'mg'), operator: { kode: 'M', tekst: 'Mindre enn' } }),
          styrke('s4', 'mor', { styrke: mengde(5, 'mg'), alternativ_styrke: mengde(1000, 'IE') }),
        ],
        [
          merkevare('m1', 'Alfa', ['s1']),
          merkevare('m2', 'Beta', ['s2']),
          merkevare('m3', 'Gamma', ['s3']),
          merkevare('m4', 'Delta', ['s4']),
        ],
      ),
      ['mor'],
    )
    expect(styrkerI(v)).toEqual([
      ['< 5 mg', null],
      ['5 mg', null],
      ['5 mg', `tilsvarer ${formaterTall(1000)} IE`],
      ['5–10 mg', null],
    ])
    expect(new Set(v.former[0]!.styrker.map((s) => s.id)).size).toBe(4)
  })

  it('slår sammen merkevarer for samme preparat og styrke, og sier fra når FEST sier ulikt', () => {
    const v = byggPreparatvisning(
      utvalg(
        [styrke('s1', 'mor'), styrke('s1b', 'mor')],
        [
          merkevare('m1', 'Alfa', ['s1'], { kan_knuses: { kode: '1', tekst: 'Ja' }, produsent: 'Firma A' }),
          // En annen styrkeoppføring i FEST med de samme verdiene er samme styrke.
          merkevare('m2', 'Alfa', ['s1b'], { kan_knuses: { kode: '2', tekst: 'Nei' }, produsent: 'Firma B' }),
        ],
      ),
      ['mor'],
    )
    const [s] = v.preparater.get('53:Alfa')!.styrker
    expect(s!.merkevarer).toEqual(['m1', 'm2'])
    expect(s!.produsenter).toEqual(['Firma A', 'Firma B'])
    expect(s!.handtering.knusing).toEqual({ status: 'varierer', tekst: 'Kan knuses / Kan ikke knuses' })
    expect(s!.handtering.deling).toEqual({ status: 'ukjent', tekst: null })
  })

  it('merker fritak og andre preparattyper på preparatet i styrken der de gjelder', () => {
    const v = byggPreparatvisning(
      utvalg(
        [styrke('s1', 'mor'), styrke('s2', 'mor', { styrke: mengde(50, 'mg') })],
        [
          merkevare('m1', 'Alfa', ['s1']),
          merkevare('m2', 'Alfa', ['s2'], { preparattype: { kode: GODKJENNINGSFRITAK, tekst: 'Krever godkj. fritak' } }),
          merkevare('m3', 'Beta', ['s1'], { preparattype: { kode: '15', tekst: 'Sykehuspreparat' } }),
        ],
      ),
      ['mor'],
    )
    expect(v.former[0]!.styrker.map((s) => s.preparater.map((p) => [p.navn, p.merker.map((m) => m.tekst)]))).toEqual([
      [
        ['Alfa', []],
        ['Beta', ['Sykehuspreparat']],
      ],
      [['Alfa', ['Krever godkj. fritak']]],
    ])
    expect(v.preparater.get('53:Alfa')!.merker).toEqual([{ type: 'godkjenningsfritak', tekst: 'Krever godkj. fritak' }])
  })

  it('gir en ukjent form det generiske ikonet og lister den som ukartlagt', () => {
    const v = byggPreparatvisning(
      utvalg([styrke('s1', 'mor')], [merkevare('m1', 'Alfa', ['s1'], { legemiddelform: { kode: '99999', tekst: 'Ny form' } })]),
      ['mor'],
    )
    expect(v.former[0]!.ikon).toMatchObject({ variant: 'generisk', kartlagt: false })
    expect(ukartlagteFormer(v)).toEqual([{ kode: '99999', tekst: 'Ny form' }])
  })
})
