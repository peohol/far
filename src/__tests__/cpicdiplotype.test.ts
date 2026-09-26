/**
 * Fra diplotype til resultat med CPICs tabell (`src/cpic/diplotype.ts`), og
 * videre til oppslaget etter et kjent resultat (`src/cpic/oppslag.ts`).
 *
 * `data/cpic-diplotype-utdrag.json` er ekte rader fra CPICs API, hentet
 * 26.09.2026: genene CYP2D6, CYP2C19, CYP2C9, DPYD, G6PD og HLA-B med alle
 * resultatene og kombinasjonene deres, et utvalg diplotyper (minst to per
 * kombinasjon, og de testene under bruker) og allelene i dem. Anbefalingene
 * er de ekte radene i `data/cpic-oppslag-utdrag.json` (fenytoin, og
 * amitriptylin med CYP2C19 Normal Metabolizer).
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import {
  kanOversettes,
  lagDiplotypeindeks,
  normaliser,
  oversett,
  sokDiplotyper,
  valgFraOversettelse,
  type Diplotypeindeks,
  type Oversettelse,
} from '../cpic/diplotype'
import { lagCpicleser, lesDiplotypegrunnlag, TOM_CPICKILDE, type Cpicutvalg } from '../cpic/lesing'
import { lesAnbefaling, lesDiplotype, lesGen, lesGenresultat, lesGenresultatoppslag, lesLegemiddel, lesRetningslinje } from '../cpic/modell'
import { oppslagsgrunnlag, slaOpp, type Oppslagsgrunnlag } from '../cpic/oppslag'
import { alle, diplotypegrunnlagFra, type Rad } from './hjelp/cpic'

const les = (fil: string) => JSON.parse(readFileSync(new URL(`./data/${fil}`, import.meta.url), 'utf8')) as Record<string, Rad[]>
const DIPLOTYPER = les('cpic-diplotype-utdrag.json')
const ANBEFALINGER = les('cpic-oppslag-utdrag.json')

const indeks = (symbol: string) => lagDiplotypeindeks(diplotypegrunnlagFra(DIPLOTYPER, symbol))
const CYP2D6 = indeks('CYP2D6')
const CYP2C19 = indeks('CYP2C19')
const CYP2C9 = indeks('CYP2C9')

function oversatt(i: Diplotypeindeks, diplotype: string): Oversettelse {
  const svar = oversett(i, diplotype)
  if (svar.status !== 'oversatt') throw new Error(`${diplotype}: ${svar.status}`)
  return svar.oversettelse
}

const UTVALG: Cpicutvalg = {
  kilde: TOM_CPICKILDE,
  legemidler: alle(ANBEFALINGER.drug!, lesLegemiddel),
  par: [],
  retningslinjer: alle(ANBEFALINGER.guideline!, lesRetningslinje).map((r) => ({ ...r, publikasjoner: [] })),
  anbefalinger: alle(ANBEFALINGER.recommendation!, lesAnbefaling),
  gener: alle(ANBEFALINGER.gene!, lesGen),
  genresultater: [],
}
const grunnlagFor = (navn: string): Oppslagsgrunnlag => oppslagsgrunnlag(UTVALG).find((g) => g.legemiddel.navn === navn)!
const AMITRIPTYLIN = grunnlagFor('amitriptyline')
const FENYTOIN = grunnlagFor('phenytoin')
const gen = (g: Oppslagsgrunnlag, symbol: string) => g.gener.find((x) => x.symbol === symbol)!

describe('hvilke gener som oversettes fra diplotype', () => {
  it('oversetter gener CPIC slår opp på fenotype eller aktivitetsverdi, ikke allelstatus (HLA)', () => {
    expect(kanOversettes('PHENOTYPE')).toBe(true)
    expect(kanOversettes('ACTIVITY_SCORE')).toBe(true)
    expect(kanOversettes('ALLELE_STATUS')).toBe(false)
    expect(kanOversettes(null)).toBe(false)
    // HLA-B: det CPIC har som «diplotype», er allelstatusen, og den er selve resultatet.
    expect(oversett(indeks('HLA-B'), '*57:01 positive')).toEqual({ status: 'ikke aktuelt' })
  })
})

describe('oversettelsen', () => {
  it('følger CPICs tabell: allelene, kombinasjonen og resultatet med aktivitetsverdien', () => {
    const o = oversatt(CYP2D6, '*1/*4')
    expect(o.genresultat).toMatchObject({ gen: 'CYP2D6', resultat: 'Intermediate Metabolizer', aktivitetsverdi: '1.0' })
    expect(o.oppslagsverdi).toBe('1.0')
    expect(o.oppslag).toMatchObject({ funksjon1: 'Normal function', funksjon2: 'No function', total_aktivitetsverdi: '1.0' })
    expect(o.alleler.map((a) => [a.navn, a.klinisk_funksjon, a.aktivitetsverdi])).toEqual([
      ['*1', 'Normal function', '1.0'],
      ['*4', 'No function', '0.0'],
    ])
  })

  it('oversetter kopitall og hybridalleler bare slik CPIC har dem', () => {
    // Samme alleler, men kopitallet står på ulikt allel: ulike resultater i CPIC.
    expect(oversatt(CYP2D6, '*1/*1x2').genresultat).toMatchObject({ resultat: 'Ultrarapid Metabolizer', aktivitetsverdi: '3.0' })
    expect(oversatt(CYP2D6, '*1x2/*4').genresultat).toMatchObject({ resultat: 'Normal Metabolizer', aktivitetsverdi: '2.0' })
    expect(oversatt(CYP2D6, '*1x≥3/*4').oppslagsverdi).toBe('≥3.0')
    expect(oversatt(CYP2D6, '*4/*36+*10').genresultat).toMatchObject({ resultat: 'Intermediate Metabolizer', aktivitetsverdi: '0.25' })
    // En skrivemåte CPIC ikke har, oversettes ikke, selv om den ligner.
    expect(oversett(CYP2D6, '*1/*1xN')).toEqual({ status: 'ukjent' })
    expect(oversett(CYP2D6, '*4/*1')).toEqual({ status: 'ukjent' })
  })

  it('bruker resultatet som oppslagsverdi for gener CPIC slår opp på fenotype', () => {
    const o = oversatt(CYP2C19, '*1/*17')
    expect(o.genresultat.resultat).toBe('Rapid Metabolizer')
    expect(o.oppslagsverdi).toBe('Rapid Metabolizer')
  })

  it('gir Indeterminate der CPIC gjør det, for alleler med usikker funksjon', () => {
    const o = oversatt(CYP2C9, '*1/*41')
    expect(o.genresultat.resultat).toBe('Indeterminate')
    expect(o.oppslagsverdi).toBe('n/a')
  })

  it('oversetter enkeltalleler der CPIC har dem, som hemizygote G6PD, og DPYD-varianter', () => {
    expect(oversatt(indeks('G6PD'), 'B (reference)').genresultat.resultat).toBe('Normal')
    expect(oversatt(indeks('G6PD'), 'A- 202A_376G/B (reference)').genresultat.resultat).toBe('Variable')
    const dpyd = indeks('DPYD')
    expect(oversatt(dpyd, 'c.1905+1G>A (*2A)/Reference').genresultat).toMatchObject({ resultat: 'Intermediate Metabolizer', aktivitetsverdi: '1.0' })
    // CPICs merknad om hvordan DPYD-diplotyper skal leses, følger med.
    expect(dpyd.grunnlag.gen?.merknad_diplotyper).toMatch(/two DPYD variants with the lowest variant activity value/)
  })

  it('oversetter ikke en diplotype CPIC har under flere kombinasjoner, eller uten resultat', () => {
    const g = diplotypegrunnlagFra(DIPLOTYPER, 'CYP2C19')
    const [a, b] = g.oppslag
    const dobbel = lagDiplotypeindeks({ ...g, oppslag: [{ ...a!, diplotyper: ['*1/*1'] }, { ...b!, diplotyper: ['*1/*1'] }] })
    expect(oversett(dobbel, '*1/*1')).toEqual({ status: 'uklar' })
    const utenResultat = lagDiplotypeindeks({ ...g, genresultater: [] })
    expect(oversett(utenResultat, '*1/*1')).toEqual({ status: 'uklar' })
  })

  it('gir hver diplotype i utdraget nøyaktig resultatet CPIC har for kombinasjonen den står under', () => {
    const resultater = new Map(alle(DIPLOTYPER.gene_result!, lesGenresultat).map((r) => [r.id, r]))
    const oppslag = new Map(alle(DIPLOTYPER.gene_result_lookup!, lesGenresultatoppslag).map((o) => [o.id, o]))
    let antall = 0
    for (const d of alle(DIPLOTYPER.gene_result_diplotype!, lesDiplotype)) {
      const forventet = resultater.get(oppslag.get(d.oppslag_id)!.genresultat_id)!
      if (forventet.gen.startsWith('HLA-')) continue
      expect(oversatt(indeks(forventet.gen), d.diplotype).genresultat).toEqual(forventet)
      antall += 1
    }
    expect(antall).toBeGreaterThan(150)
  })
})

describe('søket', () => {
  it('finner diplotypen uansett rekkefølge på allelene, uten stjerner og mellomrom', () => {
    expect(normaliser(' *1 / *4 ')).toBe('1/4')
    expect(normaliser('*1x>=3/*4')).toBe(normaliser('*1x≥3/*4'))
    for (const sok of ['*1/*4', '*4/*1', '1/4', '4 / 1']) {
      expect(sokDiplotyper(CYP2D6, sok).eksakt?.diplotype).toBe('*1/*4')
    }
    expect(sokDiplotyper(CYP2D6, '*1x>=3/*4').eksakt?.diplotype).toBe('*1x≥3/*4')
  })

  it('viser det eksakte treffet først, så de som begynner med det, og sier hvor mange som passer', () => {
    const svar = sokDiplotyper(CYP2D6, '*1/*1', 3)
    expect(svar.treff[0]!.diplotype).toBe('*1/*1')
    expect(svar.treff).toHaveLength(3)
    expect(svar.antall).toBeGreaterThan(3)
    expect(svar.treff.every((o) => o.sammenlign.some((s) => s.startsWith('1/1')))).toBe(true)
  })

  it('har ikke noe eksakt treff for en diplotype CPIC ikke har, og ingen treff for tomt søk', () => {
    expect(sokDiplotyper(CYP2D6, '*1/*999').eksakt).toBeNull()
    expect(sokDiplotyper(CYP2D6, '*1/*999').antall).toBe(0)
    expect(sokDiplotyper(CYP2D6, '  ')).toEqual({ treff: [], antall: 0, eksakt: null })
  })
})

describe('videre til anbefalingen', () => {
  it('velger resultatet og den eksakte aktivitetsverdien, og anbefalingen sier at den kom fra diplotypen', () => {
    const cyp2d6 = valgFraOversettelse(gen(AMITRIPTYLIN, 'CYP2D6'), oversatt(CYP2D6, '*1/*4'))
    const cyp2c19 = valgFraOversettelse(gen(AMITRIPTYLIN, 'CYP2C19'), oversatt(CYP2C19, '*1/*1'))
    expect(cyp2d6).toEqual({
      status: 'valgt',
      valg: { resultat: 'Intermediate Metabolizer', oppslagsverdi: '1.0', diplotype: '*1/*4' },
    })
    expect(cyp2c19).toEqual({ status: 'valgt', valg: { resultat: 'Normal Metabolizer', oppslagsverdi: 'Normal Metabolizer', diplotype: '*1/*1' } })
    if (cyp2d6.status !== 'valgt' || cyp2c19.status !== 'valgt') throw new Error('ikke valgt')

    const svar = slaOpp(AMITRIPTYLIN, { CYP2D6: cyp2d6.valg, CYP2C19: cyp2c19.valg })
    expect(svar.uavklart).toEqual([])
    expect(svar.treff).toHaveLength(1)
    const [treff] = svar.treff
    // Nøyaktig én anbefaling: den med CYP2D6 1.0, ikke de andre for Intermediate Metabolizer.
    expect(treff!.gruppe.anbefalinger).toHaveLength(1)
    const anbefaling = UTVALG.anbefalinger.find((a) => a.id === treff!.gruppe.anbefalinger[0])!
    expect(anbefaling.oppslagsnokkel).toEqual({ CYP2D6: '1.0', CYP2C19: 'Normal Metabolizer' })
    expect(treff!.begrunnelser.find((b) => b.gen === 'CYP2D6')!.valgt.diplotype).toBe('*1/*4')
  })

  it('krever fortsatt hvert gen anbefalingen bygger på: HLA-B fylles ikke inn for fenytoin', () => {
    const cyp2c9 = valgFraOversettelse(gen(FENYTOIN, 'CYP2C9'), oversatt(CYP2C9, '*1/*3'))
    if (cyp2c9.status !== 'valgt') throw new Error('ikke valgt')
    expect(cyp2c9.valg).toMatchObject({ resultat: 'Intermediate Metabolizer', oppslagsverdi: '1.0' })
    const svar = slaOpp(FENYTOIN, { CYP2C9: cyp2c9.valg })
    expect(svar.treff).toEqual([])
    expect(svar.mangler).toEqual(['HLA-B'])
  })

  it('velger ingenting når anbefalingene for legemiddelet ikke har resultatet, eller genet er et annet', () => {
    // Utdraget har amitriptylin bare med CYP2C19 Normal Metabolizer.
    expect(valgFraOversettelse(gen(AMITRIPTYLIN, 'CYP2C19'), oversatt(CYP2C19, '*1/*17'))).toEqual({ status: 'ingen anbefaling' })
    expect(valgFraOversettelse(gen(AMITRIPTYLIN, 'CYP2D6'), oversatt(CYP2C19, '*1/*1'))).toEqual({ status: 'ingen anbefaling' })
  })

  it('bruker hver oversatt aktivitetsverdi slik den står i CPICs anbefalinger for CYP2D6', () => {
    const cyp2d6 = gen(AMITRIPTYLIN, 'CYP2D6')
    const verdier = new Set(cyp2d6.alternativer.flatMap((a) => a.oppslagsverdier))
    for (const o of CYP2D6.oppforinger) {
      const svar = oversett(CYP2D6, o.diplotype)
      if (svar.status !== 'oversatt') throw new Error(o.diplotype)
      expect(verdier.has(svar.oversettelse.oppslagsverdi)).toBe(true)
      expect(valgFraOversettelse(cyp2d6, svar.oversettelse).status).toBe('valgt')
    }
  })
})

describe('lesingen', () => {
  it('henter tabellen for et gen én gang, sender bare gensymbolet, og leser på nytt etter en feil', async () => {
    const grunnlag = diplotypegrunnlagFra(DIPLOTYPER, 'CYP2D6')
    let feil = true
    const rpc = vi.fn(async (_navn: string, _argumenter: Record<string, unknown>) =>
      feil ? { data: null, error: { message: 'Nettverksfeil' } } : { data: grunnlag, error: null },
    )
    const leser = lagCpicleser({ rpc } as never)
    await expect(leser.diplotyper('CYP2D6')).rejects.toThrow('Nettverksfeil')
    feil = false
    const lest = await leser.diplotyper('CYP2D6')
    await leser.diplotyper('CYP2D6')
    expect(rpc).toHaveBeenCalledTimes(2)
    expect(rpc.mock.calls.every(([navn, a]) => navn === 'les_cpic_diplotyper' && JSON.stringify(a) === '{"gensymbol":"CYP2D6"}')).toBe(true)
    expect(lest.oppslag.flatMap((o) => o.diplotyper)).toContain('*1/*4')
  })

  it('leser svaret defensivt', () => {
    expect(lesDiplotypegrunnlag(null)).toMatchObject({ gen: null, genresultater: [], oppslag: [], alleler: [] })
    const lest = lesDiplotypegrunnlag({
      gen: { symbol: 'CYP2D6', oppslagsmetode: 'ACTIVITY_SCORE' },
      oppslag: [{ id: '1', genresultat_id: '2', diplotyper: ['*1/*4', 7, '', null] }, { id: '3' }],
      alleler: [{ navn: '*1' }, { funksjon: 'Normal function' }],
    })
    expect(lest.gen?.symbol).toBe('CYP2D6')
    expect(lest.oppslag.map((o) => o.diplotyper)).toEqual([['*1/*4']])
    expect(lest.alleler.map((a) => a.navn)).toEqual(['*1'])
  })
})
