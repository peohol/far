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
import type { Byttegruppedata, Kode, Merkevaredata, Pakningsdata, Pakningsinnhold, Styrkedata } from '../legemiddeldata/fest'
import type { Legemiddelutvalg, MedId } from '../legemiddeldata/lesing'
import {
  byggPreparatvisning,
  byttbarhetstekst,
  fordelMerker,
  gyldigByttegruppe,
  oppsummerForm,
  oppsummerPreparatvisning,
  oppsummerStyrke,
  ukartlagteFormer,
  type Preparatvisning,
} from '../legemiddeldata/preparatmodell'
import { formaterTall } from '../faginnhold/paneler'
import { GODKJENNINGSFRITAK, pakningerPerMerkevare, trygLenke } from '../legemiddeldata/preparater'
import { preparatkort, preparattekster } from '../legemiddeldata/stoffside'
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
      ['743', 'Depotkapsel, hard', 'kapsel'],
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

  it('mister ingenting fra FEST: alle merkevarer, pakninger og lenker står i detaljene', () => {
    const nye = [...visning.preparater.values()]
    const pakninger = pakningerPerMerkevare(amitriptylin, '2026-01-01')
    expect(nye.flatMap((p) => p.styrker.flatMap((s) => s.pakninger.map((k) => k.id))).sort()).toEqual(
      [...new Set(amitriptylin.merkevarer.flatMap((m) => (pakninger.get(m.id) ?? []).map((k) => k.id)))].sort(),
    )
    expect(nye.flatMap((p) => p.styrker.flatMap((s) => s.preparatomtaler)).sort()).toEqual(
      [...new Set(amitriptylin.merkevarer.map((m) => trygLenke(m.preparatomtale)).filter((l) => l !== undefined))].sort(),
    )
    expect(nye.flatMap((p) => p.styrker.flatMap((s) => s.merkevarer)).sort()).toEqual(amitriptylin.merkevarer.map((m) => m.id).sort())
    expect(nye.map((p) => p.navn).sort()).toEqual([...new Set(amitriptylin.merkevarer.map((m) => m.varenavn))].sort())
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

  it('gir søket hvert preparatnavn én gang per form, med stedet det står', () => {
    const tekster = preparattekster(visning)
    const tablett = tekster.filter((t) => t.element.tittel === 'Tablett')
    expect(tablett.map((t) => t.tekst)).toEqual(['Amitriptylin Abcur', 'Amitriptylin Orifarm', 'Sarotex', 'Amitriptylin-CT'])
    expect(tablett.every((t) => t.panel === 'preparater' && t.felt === 'preparat' && t.element.id === 'preparater-53')).toBe(true)
    expect(tekster).toHaveLength(7)
    expect(preparatkort('53')).toBe('form-53')
  })

  it('sier hva hver styrke kan byttes med i apotek, etter byttegruppene i FEST', () => {
    const bytte = (navn: string) =>
      visning.preparater.get(navn)!.styrker.map((s) => [s.styrke, s.byttbarhet.map((b) => [b.gruppe, b.med, b.pakninger])])
    expect(bytte('53:Sarotex')).toEqual([
      ['10 mg', [['AMITRIPTYLIN TABLETT 10 MG', ['Amitriptylin Abcur tab 10 mg', 'Amitriptylin Orifarm tab 10 mg'], null]]],
      ['25 mg', [['AMITRIPTYLIN TABLETT 25 MG', ['Amitriptylin Abcur tab 25 mg', 'Amitriptylin Orifarm tab 25 mg'], null]]],
    ])
    // Fritakspreparatet og styrken bare ett preparat har, er ikke i noen byttegruppe.
    expect(bytte('53:Amitriptylin-CT')).toEqual([['25 mg', []]])
    expect(bytte('53:Amitriptylin Abcur')[2]).toEqual(['50 mg', []])
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

function pakning(
  id: string,
  merkevare_id: string,
  byttegrupper: string[] = [],
  storrelse = 100,
  felt: Partial<Pakningsdata> = {},
): MedId<Pakningsdata> {
  return {
    id,
    varenr: id.toUpperCase(),
    navn_form_styrke: '',
    innhold: [
      { merkevare_id, pakningsstorrelse: storrelse, enhet: { kode: 'stk', tekst: 'stykk' }, pakningstype: null, mengde: null, antall: null },
    ],
    merkevarer: [merkevare_id],
    markedsforingsdato: null,
    midlertidig_utgatt_dato: null,
    avregistrert_dato: null,
    byttegrupper,
    ean: [],
    ...felt,
  }
}

function byttegruppe(id: string, felt: Partial<Byttegruppedata> = {}): MedId<Byttegruppedata> {
  return {
    id,
    kode: id,
    tekst: `TESTMIDDEL TABLETT ${id}`,
    merknad_til_byttbarhet: false,
    beskrivelse: null,
    gyldig_fra: '2020-01-01',
    gyldig_til: null,
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
    // Preparatvinduet: fritaket gjelder bare den ene styrken, ikke hele preparatet.
    expect(fordelMerker(v.preparater.get('53:Alfa')!)).toEqual({
      felles: [],
      egne: [[], [{ type: 'godkjenningsfritak', tekst: 'Krever godkj. fritak' }]],
    })
    expect(fordelMerker(v.preparater.get('53:Beta')!)).toEqual({
      felles: [{ type: 'preparattype', tekst: 'Sykehuspreparat' }],
      egne: [[]],
    })
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

/* --- Byttbarhet og særlig overvåkning ------------------------------------- */

describe('byttbarhet i apotek', () => {
  const IDAG = '2026-09-25'
  const tre = [merkevare('m1', 'Alfa', ['s1']), merkevare('m2', 'Beta', ['s1']), merkevare('m3', 'Gamma', ['s1'])]
  const bytte = (u: Legemiddelutvalg, preparat = '53:Alfa', idag = IDAG) =>
    byggPreparatvisning(u, ['mor'], idag).preparater.get(preparat)!.styrker[0]!.byttbarhet

  it('lister de andre preparatene i gruppen, ikke preparatet selv', () => {
    const u = {
      ...utvalg([styrke('s1', 'mor')], tre),
      pakninger: [pakning('p1', 'm1', ['g1']), pakning('p2', 'm2', ['g1']), pakning('p3', 'm3', ['g1'])],
      byttegrupper: [byttegruppe('g1')],
    }
    expect(bytte(u)).toEqual([
      {
        kode: 'g1',
        gruppe: 'TESTMIDDEL TABLETT g1',
        med: ['Beta m2', 'Gamma m3'],
        midlertidig_utgatt: [],
        pakninger: null,
        merknad: null,
      },
    ])
    expect(bytte(u, '53:Gamma').map((b) => b.med)).toEqual([['Alfa m1', 'Beta m2']])
  })

  it('sier hvilke pakninger det gjelder når bare noen av dem er i gruppen', () => {
    const u = {
      ...utvalg([styrke('s1', 'mor')], tre),
      pakninger: [
        pakning('p1', 'm1', ['g1'], 20),
        pakning('p1b', 'm1', ['g2'], 100),
        pakning('p1c', 'm1', [], 30),
        pakning('p2', 'm2', ['g1'], 20),
        pakning('p3', 'm3', ['g2'], 100),
      ],
      byttegrupper: [byttegruppe('g1'), byttegruppe('g2')],
    }
    expect(bytte(u).map((b) => [b.gruppe, b.med, b.pakninger])).toEqual([
      ['TESTMIDDEL TABLETT g1', ['Beta m2'], ['20 stk']],
      ['TESTMIDDEL TABLETT g2', ['Gamma m3'], ['100 stk']],
    ])
  })

  it('viser ikke en gruppe uten andre preparater, og ingenting uten gruppe', () => {
    const u = {
      ...utvalg([styrke('s1', 'mor')], tre),
      // To merkevarer av samme preparat i samme styrke er ikke å bytte med noe annet.
      pakninger: [pakning('p1', 'm1', ['g1']), pakning('p2', 'm2', [])],
      byttegrupper: [byttegruppe('g1')],
    }
    expect(bytte(u)).toEqual([])
    expect(bytte(u, '53:Beta')).toEqual([])
    // Gruppen finnes ikke i utvalget.
    expect(bytte({ ...u, pakninger: [pakning('p1', 'm1', ['g9']), pakning('p2', 'm2', ['g9'])] })).toEqual([])
  })

  it('bruker bare grupper som gjelder i dag, med første og siste gyldige dag', () => {
    const u = (felt: Partial<Byttegruppedata>) => ({
      ...utvalg([styrke('s1', 'mor')], tre),
      pakninger: [pakning('p1', 'm1', ['g1']), pakning('p2', 'm2', ['g1'])],
      byttegrupper: [byttegruppe('g1', felt)],
    })
    expect(bytte(u({ gyldig_fra: IDAG }))).toHaveLength(1)
    expect(bytte(u({ gyldig_fra: '2026-09-26' }))).toEqual([])
    expect(bytte(u({ gyldig_til: IDAG }))).toHaveLength(1)
    expect(bytte(u({ gyldig_til: '2026-09-24' }))).toEqual([])
    expect(bytte(u({ gyldig_fra: null, gyldig_til: null }))).toHaveLength(1)
    expect(gyldigByttegruppe({ gyldig_fra: '2026-09-25T00:00:00', gyldig_til: null }, IDAG)).toBe(true)
  })

  it('regner en pakning med i gruppen først fra dagen FEST sier den går inn i den', () => {
    const u = (fra: string | undefined) => ({
      ...utvalg([styrke('s1', 'mor')], tre),
      pakninger: [
        pakning('p1', 'm1', ['g1']),
        pakning('p2', 'm2', ['g1'], 100, { byttegrupper_fra: fra ? { g1: fra } : {} }),
        pakning('p3', 'm3', ['g1'], 100, { byttegrupper_fra: { g1: '2020-01-01' } }),
      ],
      byttegrupper: [byttegruppe('g1')],
    })
    expect(bytte(u('2026-09-26'))[0]!.med).toEqual(['Gamma m3'])
    expect(bytte(u('2026-09-26'), '53:Beta')).toEqual([])
    expect(bytte(u(IDAG))[0]!.med).toEqual(['Beta m2', 'Gamma m3'])
    expect(bytte(u('2026-09-25T00:00:00'))[0]!.med).toEqual(['Beta m2', 'Gamma m3'])
    // Rader lest før FEST-datoen ble tatt med, har ingen dato: da gjelder gruppen.
    expect(bytte(u(undefined))[0]!.med).toEqual(['Beta m2', 'Gamma m3'])
  })

  it('regner ikke med avregistrerte pakninger, verken som egne eller andres', () => {
    const u = (avregistrert_dato: string) => ({
      ...utvalg([styrke('s1', 'mor')], tre),
      pakninger: [
        pakning('p1', 'm1', ['g1']),
        pakning('p2', 'm2', ['g1'], 100, { avregistrert_dato }),
        pakning('p3', 'm3', ['g1']),
      ],
      byttegrupper: [byttegruppe('g1')],
    })
    expect(bytte(u(IDAG))[0]!.med).toEqual(['Gamma m3'])
    expect(bytte(u('2026-01-01'), '53:Beta')).toEqual([])
    // Er avregistreringen fram i tid, er pakningen fortsatt på markedet.
    expect(bytte(u('2026-09-26'))[0]!.med).toEqual(['Beta m2', 'Gamma m3'])
  })

  it('sier fra når et preparat bare har midlertidig utgåtte pakninger i gruppen', () => {
    const u = {
      ...utvalg([styrke('s1', 'mor')], tre),
      pakninger: [
        pakning('p1', 'm1', ['g1']),
        pakning('p2', 'm2', ['g1'], 100, { midlertidig_utgatt_dato: '2026-09-01' }),
        pakning('p3', 'm3', ['g1'], 100, { midlertidig_utgatt_dato: '2026-09-01' }),
        // Gamma har en annen pakning i gruppen som ikke er utgått.
        pakning('p3b', 'm3', ['g1'], 20),
        // En utgått pakning utenfor gruppen teller ikke.
        pakning('p2b', 'm2', [], 20),
      ],
      byttegrupper: [byttegruppe('g1')],
    }
    const [b] = bytte(u)
    expect(b!.midlertidig_utgatt).toEqual(['Beta m2'])
    expect(byttbarhetstekst(b!)).toBe('Byttbar i apotek med Beta m2 (midlertidig utgått) og Gamma m3.')
    // Fra og med datoen, ikke før: en dato fram i tid er bare meldt.
    expect(bytte(u, '53:Alfa', '2026-09-01')[0]!.midlertidig_utgatt).toEqual(['Beta m2'])
    expect(bytte(u, '53:Alfa', '2026-08-31')[0]!.midlertidig_utgatt).toEqual([])
    const pakninger = (idag: string) =>
      byggPreparatvisning(u, ['mor'], idag).preparater.get('53:Beta')!.styrker[0]!.pakninger.map((p) => p.midlertidig_utgatt)
    expect(pakninger('2026-08-31')).toEqual([null, null])
    expect(pakninger(IDAG)).toEqual([null, '2026-09-01'])
  })

  it('oppgir varenummeret når en pakning utenfor gruppen har samme tekst', () => {
    const u = {
      ...utvalg([styrke('s1', 'mor')], tre),
      pakninger: [
        pakning('p1', 'm1', ['g1'], 20),
        pakning('p1b', 'm1', [], 20),
        pakning('p1c', 'm1', ['g1'], 100),
        pakning('p1d', 'm1', [], 30),
        pakning('p2', 'm2', ['g1'], 20),
      ],
      byttegrupper: [byttegruppe('g1')],
    }
    expect(bytte(u)[0]!.pakninger).toEqual(['20 stk (varenr. P1)', '100 stk'])
  })

  it('tar med FESTs merknad bare når gruppen har merknad til byttbarheten', () => {
    const u = (felt: Partial<Byttegruppedata>) => ({
      ...utvalg([styrke('s1', 'mor')], tre),
      pakninger: [pakning('p1', 'm1', ['g1']), pakning('p2', 'm2', ['g1'])],
      byttegrupper: [byttegruppe('g1', felt)],
    })
    expect(bytte(u({ merknad_til_byttbarhet: true, beskrivelse: 'Gjelder ikke ved oppstart.' }))[0]!.merknad).toBe(
      'Gjelder ikke ved oppstart.',
    )
    expect(bytte(u({ merknad_til_byttbarhet: false, beskrivelse: 'Gammel tekst.' }))[0]!.merknad).toBeNull()
    expect(bytte(u({ merknad_til_byttbarhet: true, beskrivelse: '  ' }))[0]!.merknad).toBeNull()
  })

  it('skriver byttbarheten som en setning', () => {
    expect(byttbarhetstekst({ med: ['Beta tab 25 mg'], pakninger: null })).toBe('Byttbar i apotek med Beta tab 25 mg.')
    expect(byttbarhetstekst({ med: ['A', 'B', 'C'], pakninger: null })).toBe('Byttbar i apotek med A, B og C.')
    expect(byttbarhetstekst({ med: ['A', 'B'], pakninger: ['20 stk'] })).toBe('Pakningen 20 stk er byttbar i apotek med A og B.')
    expect(byttbarhetstekst({ med: ['A'], pakninger: ['20 stk', '100 stk'] })).toBe(
      'Pakningene 20 stk og 100 stk er byttbare i apotek med A.',
    )
    expect(byttbarhetstekst({ med: ['A', 'B'], midlertidig_utgatt: ['A'], pakninger: null })).toBe(
      'Byttbar i apotek med A (midlertidig utgått) og B.',
    )
  })
})

describe('pakningsstørrelsen', () => {
  it('viser FESTs tekst når størrelsen ikke er ett tall, også i byttbarheten', () => {
    const endose = (felt: Partial<Pakningsinnhold>) => {
      const p = pakning('p1', 'm1', ['g1'])
      return { ...p, innhold: [{ ...p.innhold[0]!, pakningsstorrelse: null, antall: 98, mengde: 1, ...felt }] }
    }
    const u = (felt: Partial<Pakningsinnhold>) => ({
      ...utvalg([styrke('s1', 'mor')], [merkevare('m1', 'Alfa', ['s1']), merkevare('m2', 'Beta', ['s1'])]),
      pakninger: [endose(felt), pakning('p1b', 'm1', [], 98), pakning('p2', 'm2', ['g1'])],
      byttegrupper: [byttegruppe('g1')],
    })
    const styrke1 = (felt: Partial<Pakningsinnhold>) =>
      byggPreparatvisning(u(felt), ['mor'], '2026-09-25').preparater.get('53:Alfa')!.styrker[0]!
    const lest = styrke1({ pakningsstorrelse_tekst: '98 x 1' })
    expect(lest.pakninger.map((p) => p.tekst)).toEqual(['98 stk', '98 x 1 stk'])
    expect(byttbarhetstekst(lest.byttbarhet[0]!)).toBe('Pakningen 98 x 1 stk er byttbar i apotek med Beta m2.')
    // Rader lest før teksten ble tatt med: antall og mengde, ikke bare mengden («1 stk»).
    expect(styrke1({}).pakninger.map((p) => p.tekst)).toEqual(['98 stk', '98 x 1 stk'])
    // Uten antall er mengden størrelsen, som før.
    expect(styrke1({ antall: null, mengde: 10 }).pakninger.map((p) => p.tekst)).toEqual(['10 stk', '98 stk'])
  })
})

describe('særlig overvåkning', () => {
  it('merker preparatet i styrkene der FEST har svart trekant', () => {
    const v = byggPreparatvisning(
      utvalg(
        [styrke('s1', 'mor'), styrke('s2', 'mor', { styrke: mengde(50, 'mg') })],
        [
          merkevare('m1', 'Alfa', ['s1'], { svart_trekant: true }),
          merkevare('m2', 'Alfa', ['s2']),
          merkevare('m3', 'Beta', ['s1'], { svart_trekant: true }),
        ],
      ),
      ['mor'],
    )
    const overvaking = { type: 'overvaking', tekst: 'Særlig overvåkning' }
    expect(v.former[0]!.styrker.map((s) => s.preparater.map((p) => [p.navn, p.merker]))).toEqual([
      [
        ['Alfa', [overvaking]],
        ['Beta', [overvaking]],
      ],
      [['Alfa', []]],
    ])
    expect(fordelMerker(v.preparater.get('53:Alfa')!)).toEqual({ felles: [], egne: [[overvaking], []] })
    expect(fordelMerker(v.preparater.get('53:Beta')!)).toEqual({ felles: [overvaking], egne: [[]] })
  })
})
