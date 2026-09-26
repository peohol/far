/**
 * Oppslaget etter et kjent farmakogenetisk resultat (`src/cpic/oppslag.ts`),
 * med ekte rader fra CPIC (`data/cpic-oppslag-utdrag.json`): fenytoin (CYP2C9
 * på aktivitetsverdi og HLA-B på allelstatus, to populasjoner) og
 * amitriptylin med CYP2C19 Normal Metabolizer (CYP2D6 på aktivitetsverdi),
 * og CPICs resultatliste (`gene_result`) for genene. Hentet fra
 * api.cpicpgx.org 26.09.2026.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { TOM_CPICKILDE, type Cpicutvalg } from '../cpic/lesing'
import { lesAnbefaling, lesGen, lesGenresultat, lesLegemiddel, lesRetningslinje, type Anbefaling, type Lest } from '../cpic/modell'
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
  genresultater: alle('gene_result', lesGenresultat),
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
      { resultat: 'Poor Metabolizer', oppslagsverdier: ['0.0', '0.5'], kontrollert: true },
      { resultat: 'Intermediate Metabolizer', oppslagsverdier: ['1.0', '1.5'], kontrollert: true },
      { resultat: 'Normal Metabolizer', oppslagsverdier: ['2.0'], kontrollert: true },
      { resultat: 'Indeterminate', oppslagsverdier: ['n/a'], kontrollert: true },
      // «No Result» står ikke i resultatlisten, men er selve verdien CPIC slår opp på.
      { resultat: 'No Result', oppslagsverdier: ['No Result'], kontrollert: true },
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
      { populasjon: 'PHT naive', gen: 'CYP2C9', resultat: 'Intermediate Metabolizer', grunn: 'ulike', oppslagsverdier: ['1.0', '1.5'], uten_anbefaling: [] },
      { populasjon: 'PHT use >3mos', gen: 'CYP2C9', resultat: 'Intermediate Metabolizer', grunn: 'ulike', oppslagsverdier: ['1.0', '1.5'], uten_anbefaling: [] },
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
    // Grunnlaget bygges som i appen: verdiene resultatet kan ha, kommer fra CPICs resultatliste.
    const uten = { ...HELE, anbefalinger: HELE.anbefalinger.filter((a) => !(a.legemiddel_id === 'RxNorm:704' && a.oppslagsnokkel.CYP2D6 === '0.5')) }
    const grunnlag = grunnlagFor('amitriptyline', uten)
    expect(grunnlag.gener.find((g) => g.symbol === 'CYP2D6')!.alternativer.find((a) => a.resultat === 'Intermediate Metabolizer')).toEqual({
      resultat: 'Intermediate Metabolizer',
      oppslagsverdier: ['0.25', '0.5', '0.75', '1.0'],
      kontrollert: true,
    })
    const valg = { CYP2C19: { resultat: 'Normal Metabolizer' }, CYP2D6: { resultat: 'Intermediate Metabolizer' } }
    expect(slaOpp(grunnlag, valg)).toEqual({
      treff: [],
      uavklart: [
        {
          populasjon: 'general',
          gen: 'CYP2D6',
          resultat: 'Intermediate Metabolizer',
          grunn: 'mangler',
          oppslagsverdier: ['0.25', '0.5', '0.75', '1.0'],
          uten_anbefaling: ['0.5'],
        },
      ],
      mangler: [],
      ingen: false,
    })
    // Med en verdi CPIC har anbefaling for, vises den; med 0.5 finnes ingen.
    expect(slaOpp(grunnlag, { ...valg, CYP2D6: { resultat: 'Intermediate Metabolizer', oppslagsverdi: '1.0' } }).treff).toHaveLength(1)
    expect(slaOpp(grunnlag, { ...valg, CYP2D6: { resultat: 'Intermediate Metabolizer', oppslagsverdi: '0.5' } })).toMatchObject({ treff: [], ingen: true })
  })

  it('gir aldri anbefalingen uten aktivitetsverdien når resultatlisten ikke kjenner resultatet', () => {
    // Uten CPICs resultatliste kan ikke anbefalingene selv vise at alle verdiene er med.
    const grunnlag = grunnlagFor('amitriptyline', { ...HELE, genresultater: [] })
    const im = grunnlag.gener.find((g) => g.symbol === 'CYP2D6')!.alternativer.find((a) => a.resultat === 'Intermediate Metabolizer')!
    expect(im.kontrollert).toBe(false)
    // Også en fenotype med én verdi i anbefalingene krever verdien.
    const pm = grunnlag.gener.find((g) => g.symbol === 'CYP2D6')!.alternativer.find((a) => a.resultat === 'Poor Metabolizer')!
    expect(pm).toEqual({ resultat: 'Poor Metabolizer', oppslagsverdier: ['0.0'], kontrollert: false })
    const valg = { CYP2C19: { resultat: 'Normal Metabolizer' }, CYP2D6: { resultat: 'Poor Metabolizer' } }
    expect(slaOpp(grunnlag, valg)).toMatchObject({ treff: [], uavklart: [{ gen: 'CYP2D6', grunn: 'ukontrollert' }] })
    expect(slaOpp(grunnlag, { ...valg, CYP2D6: { resultat: 'Poor Metabolizer', oppslagsverdi: '0.0' } }).treff).toHaveLength(1)
    // «No Result» er selve verdien CPIC slår opp på, og trenger ikke listen.
    const ingenResultat = grunnlag.gener.find((g) => g.symbol === 'CYP2D6')!.alternativer.find((a) => a.resultat === 'No Result')!
    expect(ingenResultat.kontrollert).toBe(true)
    expect(slaOpp(grunnlag, { ...valg, CYP2D6: { resultat: 'No Result' } }).treff).toHaveLength(1)
  })

  it('sier fra når CPIC ikke har kombinasjonen, i stedet for å velge en annen', () => {
    // Uten anbefalingen for CYP2D6 Poor Metabolizer finnes ingen for den kombinasjonen.
    const uten = { ...HELE, anbefalinger: HELE.anbefalinger.filter((a) => !(a.legemiddel_id === 'RxNorm:704' && a.oppslagsnokkel.CYP2D6 === '0.0')) }
    const grunnlag = grunnlagFor('amitriptyline', uten)
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

  it('gir en anbefaling uten aktivitetsverdien bare når den dekker hver verdi i CPICs resultatliste', () => {
    for (const grunnlag of [FENYTOIN, AMITRIPTYLIN]) {
      for (const a of grunnlag.anbefalinger) {
        const valg: Valg = Object.fromEntries(a.betingelser.filter((b) => b.gen in a.oppslagsnokkel).map((b) => [b.gen, { resultat: resultatFor(b) }]))
        for (const t of slaOpp(grunnlag, valg).treff) {
          for (const b of t.begrunnelser) {
            if (grunnlag.metoder.get(b.gen) !== 'ACTIVITY_SCORE') continue
            const liste = HELE.genresultater.filter((r) => r.gen === b.gen && r.resultat === b.resultat).map((r) => r.aktivitetsverdi)
            expect(liste.every((v) => b.oppslagsverdier.includes(v!))).toBe(true)
          }
        }
      }
    }
  })
})
