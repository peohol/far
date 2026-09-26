/**
 * Oppslaget etter et kjent farmakogenetisk resultat (`src/cpic/oppslag.ts`),
 * med ekte rader fra CPIC (`data/cpic-oppslag-utdrag.json`): fenytoin (CYP2C9
 * på aktivitetsverdi og HLA-B på allelstatus, to populasjoner) og
 * amitriptylin med CYP2C19 Normal Metabolizer (CYP2D6 på aktivitetsverdi).
 * Hentet fra api.cpicpgx.org 26.09.2026.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { TOM_CPICKILDE, type Cpicutvalg } from '../cpic/lesing'
import { lesAnbefaling, lesGen, lesLegemiddel, lesRetningslinje, type Anbefaling, type Lest } from '../cpic/modell'
import { oppslagsgrunnlag, slaOpp, type Oppslagsgrunnlag, type Valg } from '../cpic/oppslag'
import { resultatFor } from '../cpic/stoffside'

type Rad = Record<string, unknown>
const UTDRAG = JSON.parse(readFileSync(new URL('./data/cpic-oppslag-utdrag.json', import.meta.url), 'utf8')) as Record<string, Rad[]>

function alle<T>(tabell: string, les: (r: Rad) => Lest<T> | null): T[] {
  return UTDRAG[tabell]!.flatMap((r) => les(r)?.data ?? [])
}

const HELE: Cpicutvalg = {
  kilde: TOM_CPICKILDE,
  legemidler: alle('drug', lesLegemiddel),
  par: [],
  retningslinjer: alle('guideline', lesRetningslinje).map((r) => ({ ...r, publikasjoner: [] })),
  anbefalinger: alle('recommendation', lesAnbefaling),
  gener: alle('gene', lesGen),
  genresultater: [],
}

function grunnlagFor(navn: string, utvalg: Cpicutvalg = HELE): Oppslagsgrunnlag {
  return oppslagsgrunnlag(utvalg).find((g) => g.legemiddel.navn === navn)!
}

const FENYTOIN = grunnlagFor('phenytoin')
const AMITRIPTYLIN = grunnlagFor('amitriptyline')

describe('grunnlaget', () => {
  it('har ett grunnlag per legemiddel, med genene i retningslinjens rekkefølge og populasjonene', () => {
    expect(oppslagsgrunnlag(HELE).map((g) => g.legemiddel.navn)).toEqual(['amitriptyline', 'phenytoin'])
    expect(FENYTOIN.gener.map((g) => [g.symbol, g.resultattype])).toEqual([
      ['CYP2C9', 'aktivitetsverdi'],
      ['HLA-B', 'allelstatus'],
    ])
    expect(FENYTOIN.populasjoner).toEqual(['PHT naive', 'PHT use >3mos'])
    expect(FENYTOIN.anbefalinger).toHaveLength(40)
  })

  it('har resultatene CPIC bruker, med verdiene CPIC slår opp på, etter aktivitetsverdien', () => {
    const cyp2c9 = FENYTOIN.gener.find((g) => g.symbol === 'CYP2C9')!
    expect(cyp2c9.alternativer).toEqual([
      { resultat: 'Poor Metabolizer', oppslagsverdier: ['0.0', '0.5'] },
      { resultat: 'Intermediate Metabolizer', oppslagsverdier: ['1.0', '1.5'] },
      { resultat: 'Normal Metabolizer', oppslagsverdier: ['2.0'] },
      { resultat: 'Indeterminate', oppslagsverdier: ['n/a'] },
      { resultat: 'No Result', oppslagsverdier: ['No Result'] },
    ])
    const hlab = FENYTOIN.gener.find((g) => g.symbol === 'HLA-B')!
    expect(hlab.alternativer.map((a) => a.resultat)).toEqual(
      expect.arrayContaining(['HLA-B*15:02 negative', 'HLA-B*15:02 positive']),
    )
    expect(hlab.alternativer.find((a) => a.resultat === 'HLA-B*15:02 positive')!.oppslagsverdier).toEqual(['*15:02 positive'])
    const cyp2d6 = AMITRIPTYLIN.gener.find((g) => g.symbol === 'CYP2D6')!
    expect(cyp2d6.alternativer.find((a) => a.resultat === 'Ultrarapid Metabolizer')!.oppslagsverdier).toEqual([
      '2.5',
      '2.75',
      '3.0',
      '≥3.0',
      '≥3.25',
      '≥3.5',
      '≥3.75',
      '4.0',
      '≥4.0',
      '≥5.0',
      '≥6.0',
    ])
  })
})

describe('oppslaget', () => {
  it('gir ingen anbefaling før hvert gen anbefalingen bygger på er valgt, og fyller ikke inn det som mangler', () => {
    expect(slaOpp(FENYTOIN, {})).toEqual({ treff: [], uavklart: [], mangler: ['CYP2C9', 'HLA-B'], ingen: false })
    const svar = slaOpp(FENYTOIN, { 'HLA-B': { resultat: 'HLA-B*15:02 positive' } })
    expect(svar.treff).toEqual([])
    expect(svar.mangler).toEqual(['CYP2C9'])
  })

  it('gir anbefalingen for hver populasjon for nøyaktig kombinasjonen, med hvorfor', () => {
    const svar = slaOpp(FENYTOIN, {
      'HLA-B': { resultat: 'HLA-B*15:02 negative' },
      CYP2C9: { resultat: 'Intermediate Metabolizer', oppslagsverdi: '1.0' },
    })
    expect(svar.uavklart).toEqual([])
    expect(svar.mangler).toEqual([])
    expect(svar.treff.map((t) => t.populasjon)).toEqual(['PHT naive', 'PHT use >3mos'])
    for (const t of svar.treff) {
      expect(t.gruppe.anbefalinger).toHaveLength(1)
      const a = FENYTOIN.anbefalinger.find((x) => x.id === t.gruppe.anbefalinger[0])!
      expect(a.oppslagsnokkel).toEqual({ 'HLA-B': '*15:02 negative', CYP2C9: '1.0' })
      expect(a.populasjon).toBe(t.populasjon)
      expect(t.gruppe.klassifisering).toBe('Moderate')
      expect(t.gruppe.anbefaling).toMatch(/^For first dose, use typical initial or loading dose\./)
      expect(t.begrunnelser).toEqual([
        { gen: 'CYP2C9', valgt: { resultat: 'Intermediate Metabolizer', oppslagsverdi: '1.0' }, resultat: 'Intermediate Metabolizer', oppslagsverdier: ['1.0'] },
        { gen: 'HLA-B', valgt: { resultat: 'HLA-B*15:02 negative' }, resultat: 'HLA-B*15:02 negative', oppslagsverdier: ['*15:02 negative'] },
      ])
      expect(t.ubrukte).toEqual([])
    }
  })

  it('krever aktivitetsverdien når CPIC har ulike anbefalinger for fenotypen', () => {
    // CYP2C9 Intermediate Metabolizer er aktivitetsverdi 1.0 eller 1.5, med ulike anbefalinger.
    const svar = slaOpp(FENYTOIN, {
      'HLA-B': { resultat: 'HLA-B*15:02 negative' },
      CYP2C9: { resultat: 'Intermediate Metabolizer' },
    })
    expect(svar.treff).toEqual([])
    expect(svar.uavklart).toEqual([
      { populasjon: 'PHT naive', gen: 'CYP2C9', resultat: 'Intermediate Metabolizer', oppslagsverdier: ['1.0', '1.5'], uten_anbefaling: [] },
      { populasjon: 'PHT use >3mos', gen: 'CYP2C9', resultat: 'Intermediate Metabolizer', oppslagsverdier: ['1.0', '1.5'], uten_anbefaling: [] },
    ])
  })

  it('gir anbefalingen uten aktivitetsverdien bare når CPIC har den samme for alle verdiene', () => {
    const svar = slaOpp(AMITRIPTYLIN, {
      CYP2C19: { resultat: 'Normal Metabolizer' },
      CYP2D6: { resultat: 'Intermediate Metabolizer' },
    })
    expect(svar.uavklart).toEqual([])
    expect(svar.treff).toHaveLength(1)
    const [t] = svar.treff
    expect(t!.gruppe.anbefalinger).toHaveLength(4)
    expect(t!.gruppe.klassifisering).toBe('Moderate')
    expect(t!.begrunnelser.find((b) => b.gen === 'CYP2D6')!.oppslagsverdier).toEqual(['0.25', '0.5', '0.75', '1.0'])
  })

  it('bruker ikke anbefalingen uten aktivitetsverdien når CPIC mangler den for en av verdiene', () => {
    // De andre verdiene for CYP2D6 Intermediate Metabolizer har samme anbefaling, men 0.5 har ingen.
    const uten = { ...HELE, anbefalinger: HELE.anbefalinger.filter((a) => !(a.legemiddel_id === 'RxNorm:704' && a.oppslagsnokkel.CYP2D6 === '0.5')) }
    const grunnlag = { ...grunnlagFor('amitriptyline', uten), gener: AMITRIPTYLIN.gener }
    const valg = { CYP2C19: { resultat: 'Normal Metabolizer' }, CYP2D6: { resultat: 'Intermediate Metabolizer' } }
    expect(slaOpp(grunnlag, valg)).toEqual({
      treff: [],
      uavklart: [
        { populasjon: 'general', gen: 'CYP2D6', resultat: 'Intermediate Metabolizer', oppslagsverdier: ['0.25', '0.5', '0.75', '1.0'], uten_anbefaling: ['0.5'] },
      ],
      mangler: [],
      ingen: false,
    })
    // Med en verdi CPIC har anbefaling for, vises den; med 0.5 finnes ingen.
    expect(slaOpp(grunnlag, { ...valg, CYP2D6: { resultat: 'Intermediate Metabolizer', oppslagsverdi: '1.0' } }).treff).toHaveLength(1)
    expect(slaOpp(grunnlag, { ...valg, CYP2D6: { resultat: 'Intermediate Metabolizer', oppslagsverdi: '0.5' } })).toMatchObject({ treff: [], ingen: true })
  })

  it('sier fra når CPIC ikke har kombinasjonen, i stedet for å velge en annen', () => {
    // Uten anbefalingen for CYP2D6 Poor Metabolizer finnes ingen for den kombinasjonen.
    const uten = { ...HELE, anbefalinger: HELE.anbefalinger.filter((a) => !(a.legemiddel_id === 'RxNorm:704' && a.oppslagsnokkel.CYP2D6 === '0.0')) }
    const grunnlag = { ...grunnlagFor('amitriptyline', uten), gener: AMITRIPTYLIN.gener }
    expect(
      slaOpp(grunnlag, { CYP2C19: { resultat: 'Normal Metabolizer' }, CYP2D6: { resultat: 'Poor Metabolizer' } }),
    ).toEqual({ treff: [], uavklart: [], mangler: [], ingen: true })
    expect(slaOpp(AMITRIPTYLIN, { CYP2C19: { resultat: 'Poor Metabolizer' } })).toMatchObject({ treff: [], ingen: true })
  })

  it('gir for hver kombinasjon bare anbefalinger CPIC har for nøyaktig den, og finner hver anbefaling', () => {
    for (const grunnlag of [FENYTOIN, AMITRIPTYLIN]) {
      for (const a of grunnlag.anbefalinger) {
        const valg: Valg = Object.fromEntries(
          Object.entries(a.oppslagsnokkel).map(([gen, verdi]) => {
            const b = a.betingelser.find((x) => x.gen === gen)!
            return [gen, { resultat: resultatFor(b), oppslagsverdi: verdi }]
          }),
        )
        const svar = slaOpp(grunnlag, valg)
        expect(svar.uavklart).toEqual([])
        const ider = svar.treff.flatMap((t) => t.gruppe.anbefalinger)
        expect(ider).toContain(a.id)
        for (const id of ider) {
          const funnet = grunnlag.anbefalinger.find((x) => x.id === id) as Anbefaling
          expect(funnet.oppslagsnokkel).toEqual(a.oppslagsnokkel)
        }
        // Én per populasjon: CPIC har aldri to for samme kombinasjon og populasjon.
        expect(new Set(svar.treff.map((t) => t.populasjon)).size).toBe(svar.treff.length)
      }
    }
  })
})
