/**
 * Visningen av CPIC-dataene på stoffsiden: kortene, grupperingen av
 * anbefalingene, referansene og søket. Med ekte rader fra CPIC
 * (`data/cpic-utdrag.json`, samme utdrag som `cpic.test.ts`).
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import type { Litteratur } from '../clinpgx/modell'
import { litteraturId } from '../clinpgx/referanser'
import { lagCpicleser, slaSammenCpicutvalg, type Cpicleser, type Cpicutvalg } from '../cpic/lesing'
import {
  lesAnbefaling,
  lesGen,
  lesGenresultat,
  lesLegemiddel,
  lesPar,
  lesPublikasjon,
  lesRetningslinje,
  type Anbefaling,
  type Lest,
} from '../cpic/modell'
import { cpicForeldet, cpicreferanser, CPIC_KILDE } from '../cpic/referanser'
import {
  betingelsetekst,
  byggCpicvisning,
  CPIC_ANDRE_PAR_KORT,
  CPIC_OPPSLAG_KORT,
  cpicFor,
  cpickort,
  cpictekster,
  delAnbefalinger,
  deltittel,
  grupperAnbefalinger,
  MAKS_RADER_UTEN_DELING,
  sorterAktivitetsverdier,
  harCpic,
  OPPSLAG_TITTEL,
  oppsummerCpic,
  retningslinjeoppsummering,
} from '../cpic/stoffside'
import { indekserKunnskapsbase, lesKunnskapsbase, lesSokeindeks } from '../faginnhold/globaltSok'
import type { Analyttsidedata } from '../faginnhold/lesing'
import { sokeadresse, sokGlobalt } from '../faginnhold/sok'

type Rad = Record<string, unknown>
const UTDRAG = JSON.parse(readFileSync(new URL('./data/cpic-utdrag.json', import.meta.url), 'utf8')) as Record<string, Rad[]>

const AMITRIPTYLIN = 'PA448385'
const ABAKAVIR = 'PA448004'
const WARFARIN = 'PA451906'

function alle<T>(tabell: string, les: (r: Rad) => Lest<T> | null): T[] {
  return UTDRAG[tabell]!.flatMap((r) => les(r)?.data ?? [])
}

/** Hele utdraget i formen `les_cpic` gir, som om alle legemidlene var spurt etter. */
const PUBLIKASJONER = alle('publication', lesPublikasjon)
const HELE: Cpicutvalg = {
  kilde: {
    navn: 'CPIC',
    release: 'v1.60.1',
    release_dato: '2026-08-12T00:00:00Z',
    skjemaversjon: '82',
    endret_kl: '2026-09-22T02:45:00Z',
    kontrollert_kl: '2026-09-22T02:45:00Z',
  },
  legemidler: alle('drug', lesLegemiddel),
  par: alle('pair', lesPar),
  retningslinjer: alle('guideline', lesRetningslinje).map((r) => ({
    ...r,
    publikasjoner: PUBLIKASJONER.filter((p) => p.retningslinje_id === r.id),
  })),
  anbefalinger: alle('recommendation', lesAnbefaling),
  gener: alle('gene', lesGen),
  genresultater: alle('gene_result', lesGenresultat),
}

const visningFor = (...ider: string[]) => byggCpicvisning(cpicFor(HELE, ider))

describe('utvalget for en side', () => {
  it('tar med bare legemidlene siden er koblet til, og det som hører til dem', () => {
    const utvalg = cpicFor(HELE, [ABAKAVIR])
    expect(utvalg.legemidler.map((l) => l.navn)).toEqual(['abacavir'])
    expect(utvalg.par.map((p) => p.gen)).toEqual(['HLA-B'])
    expect(utvalg.retningslinjer.map((r) => r.id)).toEqual(['100421'])
    expect(utvalg.anbefalinger.every((a) => a.legemiddel_id === 'RxNorm:190521')).toBe(true)
    expect(utvalg.gener.map((g) => g.symbol)).toEqual(['HLA-B'])
    expect(utvalg.genresultater.every((r) => r.gen === 'HLA-B')).toBe(true)
    expect(cpicFor(HELE, ['PA0'])).toMatchObject({ legemidler: [], par: [], anbefalinger: [], retningslinjer: [] })
  })

  it('legger sammen utvalg lest i deler, uten gjentakelser', () => {
    const samlet = slaSammenCpicutvalg([cpicFor(HELE, [ABAKAVIR]), cpicFor(HELE, [ABAKAVIR, AMITRIPTYLIN])])
    expect(samlet.legemidler.map((l) => l.navn).sort()).toEqual(['abacavir', 'amitriptyline'])
    expect(samlet.anbefalinger).toHaveLength(cpicFor(HELE, [ABAKAVIR, AMITRIPTYLIN]).anbefalinger.length)
    expect(samlet.kilde.release).toBe('v1.60.1')
  })

  it('leser flere legemidler enn databasen tar i ett kall i deler', async () => {
    const rpc = vi.fn(async (_navn: string, { clinpgx_ider }: { clinpgx_ider: string[] }) => ({
      data: { kilde: HELE.kilde, legemidler: cpicFor(HELE, clinpgx_ider).legemidler },
      error: null,
    }))
    const leser = lagCpicleser({ rpc } as never)
    const ider = [...Array.from({ length: 250 }, (_, i) => `PA-${i}`), ABAKAVIR]
    const utvalg = await leser.les(ider)
    expect(rpc).toHaveBeenCalledTimes(2)
    expect(rpc.mock.calls.every(([, a]) => a.clinpgx_ider.length <= 200)).toBe(true)
    expect(utvalg.legemidler.map((l) => l.navn)).toEqual(['abacavir'])
  })
})

describe('kortene', () => {
  it('gir amitriptylin ett kort for retningslinjen, med to gener og hva hvert slås opp på', () => {
    const visning = visningFor(AMITRIPTYLIN)
    expect(visning.retningslinjer.map((k) => k.kort)).toEqual([cpickort('100414')])
    const [k] = visning.retningslinjer
    expect(k!.retningslinje.navn).toBe('CYP2D6, CYP2C19 and Tricyclic Antidepressants')
    expect(k!.gener.map((g) => [g.symbol, g.resultattype])).toEqual([
      ['CYP2C19', 'fenotype'],
      ['CYP2D6', 'aktivitetsverdi'],
    ])
    expect(k!.gener.find((g) => g.symbol === 'CYP2C19')!.resultater).toEqual(expect.arrayContaining(['Normal Metabolizer', 'Poor Metabolizer']))
    expect(k!.par.map((p) => [p.gen, p.cpic_niva])).toEqual([
      ['CYP2C19', 'A'],
      ['CYP2D6', 'A'],
    ])
    expect(k!.antall_anbefalinger).toBe(HELE.anbefalinger.filter((a) => a.legemiddel_id === 'RxNorm:704').length)
    expect(k!.klassifiseringer).toEqual(expect.arrayContaining(['Strong', 'Moderate', 'Optional']))
    expect(retningslinjeoppsummering(k!)).toMatch(/^CYP2C19 \(fenotype\), CYP2D6 \(aktivitetsverdi\) · \d+ anbefalinger · /)
    expect(visning.andre_par).toEqual([])
    expect(oppsummerCpic(visning)).toBe(`${k!.antall_anbefalinger} CPIC-anbefalinger`)
  })

  it('viser betingelsene for begge genene i hver anbefaling, med CPICs egne verdier', () => {
    const [k] = visningFor(AMITRIPTYLIN).retningslinjer
    const gruppe = k!.grupper.find((g) => g.anbefalinger.includes('8479820'))!
    expect(gruppe.betingelser.map(betingelsetekst)).toEqual(['CYP2C19 Normal Metabolizer', 'CYP2D6 Poor Metabolizer, aktivitetsverdi 0.0'])
    expect(gruppe.klassifisering).toBe('Strong')
    expect(gruppe.anbefaling).toMatch(/^Avoid amitriptyline use\./)
    expect(gruppe.betingelser.find((b) => b.gen === 'CYP2D6')!.implikasjon).toMatch(/^Greatly reduced metabolism of TCAs/)
  })

  it('gir abakavir et HLA-kort på allelstatus, uten en CYP-modell', () => {
    const [k] = visningFor(ABAKAVIR).retningslinjer
    expect(k!.gener).toEqual([{ symbol: 'HLA-B', resultattype: 'allelstatus', resultater: ['HLA-B*57:01 negative', 'HLA-B*57:01 positive'] }])
    const positiv = k!.grupper.find((g) => g.anbefalinger.includes('8479702'))!
    expect(positiv.betingelser.map(betingelsetekst)).toEqual(['HLA-B*57:01 positive'])
    expect(positiv.anbefaling).toBe('Abacavir is not recommended')
    // «n/a» er CPICs verdi for ingen kommentar, og vises ikke som en kommentar.
    expect(positiv.kommentarer).toBeNull()
  })

  it('gir warfarin et kort uten strukturerte anbefalinger, med CPICs merknad, og parene uten retningslinje for seg', () => {
    const visning = visningFor(WARFARIN)
    const [k] = visning.retningslinjer
    expect(k!.grupper).toEqual([])
    expect(k!.retningslinje.bruksmerknad).toMatch(/^Warfarin recommendation does not follow simple diplotype to phenotype translation/)
    expect(k!.gener.map((g) => g.symbol)).toEqual(['CYP2C9', 'CYP4F2', 'VKORC1'])
    expect(retningslinjeoppsummering(k!)).toContain('ingen strukturerte anbefalinger')
    expect(visning.andre_par.map((p) => [p.gen, p.cpic_niva])).toEqual([
      ['CALU', 'D'],
      ['GGCX', 'D'],
      ['PROC', 'D'],
      ['PROS1', 'D'],
    ])
    expect(oppsummerCpic(visning)).toBe('1 CPIC-retningslinje')
  })

  it('har ingenting når CPIC ikke har legemiddelet', () => {
    const visning = visningFor('PA0')
    expect(harCpic(visning)).toBe(false)
    expect(oppsummerCpic(visning)).toBe('')
    expect(cpicreferanser(visning)).toEqual({ referanser: [] })
  })
})

describe('grupperingen av anbefalingene', () => {
  const metoder = new Map([
    ['CYP2D6', 'ACTIVITY_SCORE' as const],
    ['CYP2C19', 'PHENOTYPE' as const],
    ['HLA-B', 'ALLELE_STATUS' as const],
  ])
  const amitriptylin = HELE.anbefalinger.filter((a) => a.legemiddel_id === 'RxNorm:704')

  /** En syntetisk kopi av en anbefaling med en annen aktivitetsverdi og ellers likt innhold. */
  function medAktivitetsverdi(a: Anbefaling, id: string, verdi: string): Anbefaling {
    return {
      ...a,
      id,
      betingelser: a.betingelser.map((b) => (b.gen === 'CYP2D6' ? { ...b, aktivitetsverdi: verdi, oppslagsverdi: verdi } : b)),
    }
  }

  it('står for hver anbefaling nøyaktig én gang, og lager ingen som ikke finnes', () => {
    const grupper = grupperAnbefalinger(amitriptylin, metoder)
    expect(grupper.flatMap((g) => g.anbefalinger).sort()).toEqual(amitriptylin.map((a) => a.id).sort())
  })

  it('slår sammen anbefalinger som bare skiller seg i aktivitetsverdien, og lister verdiene', () => {
    const im = amitriptylin.find((a) => a.id === '8479814')!
    const grupper = grupperAnbefalinger([im, medAktivitetsverdi(im, 'syntetisk-1', '0.5'), medAktivitetsverdi(im, 'syntetisk-2', '0.25')], metoder)
    expect(grupper).toHaveLength(1)
    expect(grupper[0]!.anbefalinger).toEqual(['8479814', 'syntetisk-1', 'syntetisk-2'])
    expect(grupper[0]!.betingelser.map(betingelsetekst)).toEqual([
      'CYP2C19 Normal Metabolizer',
      'CYP2D6 Intermediate Metabolizer, aktivitetsverdi 0.25, 0.5 eller 1.0',
    ])
  })

  it('holder dem atskilt når noe annet enn aktivitetsverdien er ulikt', () => {
    const im = amitriptylin.find((a) => a.id === '8479814')!
    const annen = { ...medAktivitetsverdi(im, 'syntetisk-3', '0.5'), klassifisering: 'Optional' }
    const annenTekst = { ...medAktivitetsverdi(im, 'syntetisk-4', '0.5'), anbefaling: 'Syntetisk annen anbefaling.' }
    expect(grupperAnbefalinger([im, annen, annenTekst], metoder)).toHaveLength(3)
  })

  it('slår aldri sammen på et gen som ikke slås opp på aktivitetsverdi', () => {
    const im = amitriptylin.find((a) => a.id === '8479814')!
    const annen = {
      ...im,
      id: 'syntetisk-5',
      betingelser: im.betingelser.map((b) => (b.gen === 'CYP2C19' ? { ...b, oppslagsverdi: 'Syntetisk annen verdi' } : b)),
    }
    expect(grupperAnbefalinger([im, annen], metoder)).toHaveLength(2)
  })
})

describe('lange kort', () => {
  it('sorterer aktivitetsverdiene stigende, med «≥» etter samme tall', () => {
    expect(sorterAktivitetsverdier(['2.0', '1.75', '≥3.0', '3.0', '0.25', 'n/a'])).toEqual(['0.25', '1.75', '2.0', '3.0', '≥3.0', 'n/a'])
  })

  it('deler et langt kort etter genet med færrest ulike resultater, og beholder hver rad', () => {
    const [k] = visningFor(AMITRIPTYLIN).retningslinjer
    // Utdraget har få anbefalinger; mange syntetiske rader med ulik CYP2D6-fenotype gjør kortet langt.
    const fenotyper = ['Poor Metabolizer', 'Normal Metabolizer', 'Ultrarapid Metabolizer']
    const grupper = Array.from({ length: MAKS_RADER_UTEN_DELING + 1 }, (_, i) => ({
      ...k!.grupper[0]!,
      id: `syntetisk-${i}`,
      anbefalinger: [`syntetisk-${i}`],
      betingelser: [
        { gen: 'CYP2C19', resultat: `Syntetisk ${i}`, aktivitetsverdier: [], implikasjon: null },
        { gen: 'CYP2D6', resultat: fenotyper[i % 3]!, aktivitetsverdier: [], implikasjon: null },
      ],
    }))
    expect(delAnbefalinger(grupper.slice(0, MAKS_RADER_UTEN_DELING))).toBeNull()
    const deler = delAnbefalinger(grupper)!
    expect(deler.map(deltittel)).toEqual(['CYP2D6 Poor Metabolizer', 'CYP2D6 Normal Metabolizer', 'CYP2D6 Ultrarapid Metabolizer'])
    expect(deler.flatMap((d) => d.grupper.map((g) => g.id)).sort()).toEqual(grupper.map((g) => g.id).sort())
    // En rad uten genet står i en egen del til sist.
    const uten = { ...grupper[0]!, id: 'uten', betingelser: [grupper[0]!.betingelser[0]!] }
    expect(deltittel(delAnbefalinger([uten, ...grupper])!.at(-1)!)).toBe('Uten CYP2D6')
  })
})

describe('referansene fra CPIC', () => {
  it('oppgir CPIC med lisensen, releasen og når dataene ble kontrollert, og publikasjonene i kortet', () => {
    const visning = visningFor(AMITRIPTYLIN)
    const kilder = cpicreferanser(visning)
    const cpic = kilder.referanser.find((r) => r.id === CPIC_KILDE)!
    expect(cpic.lenke).toBe('https://cpicpgx.org')
    expect(cpic.automatisk).toEqual({
      kilde: 'CPIC',
      opphav:
        'Utdrag av strukturerte farmakogenetiske anbefalinger fra CPIC, release v1.60.1 av 12. august 2026, omformet av OUSFAR, lisens CC0 1.0, sist kontrollert 22. september 2026',
      lenker: [
        { tekst: 'Lisens: CC0 1.0', lenke: 'https://creativecommons.org/publicdomain/zero/1.0/' },
        { tekst: 'Bruksvilkår hos ClinPGx (CPIC-delen)', lenke: 'https://www.clinpgx.org/page/dataUsagePolicy' },
      ],
    })
    expect(kilder.panelreferanser).toEqual({ farmakogenetikk: [CPIC_KILDE] })
    expect(kilder.elementer).toEqual([
      { panel: 'farmakogenetikk', id: cpickort('100414'), referanser: ['cpic:publikasjon-110004', 'cpic:publikasjon-110011'] },
    ])
    const artikkel = kilder.referanser.find((r) => r.id === 'cpic:publikasjon-110004')!
    expect(artikkel).toMatchObject({ aar: '2016', lenke: 'https://doi.org/10.1002/cpt.597', automatisk: { kilde: 'CPIC' } })
  })

  it('bruker ClinPGx-referansen for en publikasjon ClinPGx alt oppgir på siden', () => {
    const felles: Litteratur = { tittel: 'Samme artikkel hos ClinPGx', aar: 2016, lenke: null, pmid: '27997040', doi: null }
    const kilder = cpicreferanser(visningFor(AMITRIPTYLIN), [felles])
    expect(kilder.elementer![0]!.referanser).toEqual([litteraturId(felles), 'cpic:publikasjon-110011'])
    expect(kilder.referanser.some((r) => r.id === 'cpic:publikasjon-110004')).toBe(false)
  })

  it('sier fra når dataene ikke er kontrollert på over ti døgn', () => {
    expect(cpicForeldet(HELE.kilde, new Date('2026-09-30T00:00:00Z'))).toBeNull()
    expect(cpicForeldet(HELE.kilde, new Date('2026-10-03T00:00:00Z'))).toMatch(/^CPIC-dataene ble sist kontrollert 22\. september 2026\./)
  })
})

describe('søket', () => {
  it('peker på kortet for retningslinjen, med betingelsene og anbefalingene', () => {
    const tekster = cpictekster(visningFor(AMITRIPTYLIN, WARFARIN))
    expect(new Set(tekster.map((t) => t.detaljkort))).toEqual(
      new Set([CPIC_OPPSLAG_KORT, cpickort('100414'), cpickort('100425'), CPIC_ANDRE_PAR_KORT]),
    )
    expect(tekster.every((t) => t.panel === 'farmakogenetikk' && t.element.id === t.detaljkort)).toBe(true)
    // Oppslaget finnes med navnet og genene det slår opp på, bare når det er anbefalinger å slå opp.
    expect(tekster.find((t) => t.detaljkort === CPIC_OPPSLAG_KORT)!.tekst).toBe(`${OPPSLAG_TITTEL} · CPIC · CYP2C19 · CYP2D6`)
    expect(cpictekster(visningFor(WARFARIN)).some((t) => t.detaljkort === CPIC_OPPSLAG_KORT)).toBe(false)
    expect(tekster.some((t) => t.detaljkort === cpickort('100414') && t.tekst.includes('CYP2D6 Poor Metabolizer, aktivitetsverdi 0.0'))).toBe(true)
    expect(tekster.some((t) => t.detaljkort === CPIC_ANDRE_PAR_KORT && t.tekst.includes('GGCX'))).toBe(true)
  })

  /** En side koblet til amitriptylin i ClinPGx, uten annet innhold. */
  function amitriptylinside(): Analyttsidedata {
    const utgave = <T,>(id: string, innhold: T) => ({
      id,
      revisjon: 1,
      publisert_revisjon: 1,
      innhold,
      endret_av_fornavn: '',
      endret_av_etternavn: '',
      endret_kl: '',
    })
    return {
      analytt: utgave('analytt-AMI', { kode: 'AMI', hovedside: 'side-ami', komponenter: ['side-ami'] }),
      infoside: utgave('side-ami', { navn: 'Amitriptylin' }),
      elementer: [
        utgave('pgx', {
          infoside: 'side-ami',
          panel: 'farmakogenetikk',
          posisjon: 0,
          elementtype: 'clinpgxkobling',
          data: { kjemikalier: [{ clinpgx_id: AMITRIPTYLIN, navn: 'amitriptyline' }] },
        }),
      ],
      komponenter: [],
      referanser: [],
      regelsett: null,
      thcregelsett: null,
      scenarioregelsett: null,
    }
  }

  it('finner anbefalingene i hele kunnskapsbasen, og peker på seksjonen og kortet', async () => {
    const les = vi.fn(async (ider: readonly string[]) => cpicFor(HELE, ider))
    const cpic: Cpicleser = { les, hent: async () => ({ status: 'uendret' }) }
    const sideleser = { lesAnalyttsider: async () => [amitriptylinside()], lesStoffsider: async () => [] }
    const indeks = await lesSokeindeks(sideleser, null, { cpic })
    expect(les).toHaveBeenCalledWith([AMITRIPTYLIN])
    const [treff] = sokGlobalt(indeks, 'CYP2D6 poor metabolizer')
    expect(sokeadresse(treff!.dokument.sted)).toBe(`#/analytt/AMI/farmakogenetikk/${cpickort('100414')}`)
  })

  it('indekserer faginnholdet også når CPIC-dataene ikke kan leses', async () => {
    const nede: Cpicleser = {
      les: async () => {
        throw new Error('CPIC-kopien svarer ikke')
      },
      hent: async () => ({ status: 'feilet' }),
    }
    const sideleser = { lesAnalyttsider: async () => [amitriptylinside()], lesStoffsider: async () => [] }
    const base = await lesKunnskapsbase(sideleser, null, 'publisert', null, nede)
    expect(base.cpicfeil).toBe('CPIC-kopien svarer ikke')
    expect(indekserKunnskapsbase(base).some((d) => d.tekst.includes('Metabolizer'))).toBe(false)
  })
})
