/**
 * Farmakodynamikken som mekanismekort: mekanismetypene med effekten og
 * trafikklysfargen, ikonene, systemfargene på målene, subtypene i navnene,
 * søket og historikken (`docs/farmakodynamikk-ikoner.md`).
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { IKONER, IKONNAVN, type Ikondel } from '../components/ikon/register'
import { mekanismeikon } from '../components/stoffside/panelvisning'
import { innholdsfelter } from '../faginnhold/innholdsfelter'
import {
  INGEN_EFFEKT,
  MEKANISMER,
  SYSTEMER,
  VIRKNINGER,
  mekanismeFor,
  subtypedeler,
  systemFor,
  virkningFor,
  type Mekanisme,
} from '../faginnhold/mekanismer'
import { kontrollerMekanismekort, lesMekanismekort, mekanismekortTilData } from '../faginnhold/paneler'
import { elementtekster, indekserSide, lagSokeindeks, sokGlobalt } from '../faginnhold/sok'
import type { Sidemodell } from '../faginnhold/stoffside'

const css = (fil: string) => readFileSync(new URL(`../styles/${fil}`, import.meta.url), 'utf8')

/* --- Mekanismene -------------------------------------------------------------- */

describe('mekanismene', () => {
  it('gir hver mekanisme en kort effekt og en virkning som trafikklys', () => {
    const virkning = (m: Mekanisme) => mekanismeFor(m)!.virkning
    expect(virkning('agonisme')).toBe('okt')
    expect(virkning('positiv_allosterisk_modulering')).toBe('okt')
    expect(virkning('partiell_agonisme')).toBe('delvis')
    for (const m of ['antagonisme', 'kompetitiv_antagonisme', 'invers_agonisme', 'negativ_allosterisk_modulering', 'reopptakshemming', 'enzymhemming'] as const) {
      expect(virkning(m), m).toBe('redusert')
    }
    for (const m of ['reseptorbinding', 'reseptorpavirkning', 'ionekanalpavirkning', 'transportorpavirkning', INGEN_EFFEKT] as const) {
      expect(virkning(m), m).toBe('noytral')
    }
    // Effekten står i en pille på det lukkede kortet og skal leses med ett blikk.
    for (const m of MEKANISMER) expect(m.effekt.split(' ').length, m.nokkel).toBeLessThanOrEqual(2)
  })

  it('farger pillen med tonene for referanse, toksisk og alvorlig, og nøytralt uten mekanisme', () => {
    expect(VIRKNINGER.map((v) => [v.nokkel, v.merketone])).toEqual([
      ['okt', 'referanse'],
      ['delvis', 'toksisk'],
      ['redusert', 'alvorlig'],
      ['noytral', 'noytral'],
    ])
    expect(virkningFor(null).nokkel).toBe('noytral')
  })

  it('lagrer bare målet, mekanismen og teksten, og lar de eldre feltene falle bort', () => {
    const eldre = { maal: 'D2-reseptor', effekt: 'Antagonist', mekanisme: 'antagonisme', retning: 'ned', kvalifikasjon: 'Potent', merknad: 'x' }
    expect(mekanismekortTilData(lesMekanismekort(eldre))).toEqual({ maal: 'D2-reseptor', mekanisme: 'antagonisme' })
    expect(kontrollerMekanismekort(lesMekanismekort({ maal: ' ', mekanisme: 'antagonisme' }))).toBe('Oppgi målproteinet eller prosessen.')
    expect(kontrollerMekanismekort(lesMekanismekort({ maal: 'D2', mekanisme: 'ukjent' }))).toBe('Velg effekten på målet.')
    expect(kontrollerMekanismekort(lesMekanismekort({ maal: 'D2', mekanisme: 'invers_agonisme' }))).toBeNull()
  })
})

/* --- Ikonene ------------------------------------------------------------------- */

/** Alle delene i et ikon, også de i grupper. */
const deler = (d: readonly Ikondel[]): Ikondel[] => d.flatMap((del) => (del.t === 'g' ? deler(del.kids) : [del]))

describe('ikonene', () => {
  const mekanismeikoner = IKONNAVN.filter((n) => n.startsWith('mek'))

  it('har et ikon for hver mekanisme unntatt «Ingen effekt», og ingen ikoner uten mekanisme', () => {
    expect(new Set(mekanismeikoner)).toEqual(new Set(MEKANISMER.map((m) => mekanismeikon(m.nokkel)).filter(Boolean)))
    expect(mekanismeikon(INGEN_EFFEKT)).toBeUndefined()
    expect(mekanismeikon(null)).toBeUndefined()
    // De spesifikke mekanismene har hvert sitt ikon; de generelle deler familiens.
    for (const m of MEKANISMER.filter((x) => x.spesifikk && x.nokkel !== INGEN_EFFEKT)) {
      expect(MEKANISMER.filter((x) => mekanismeikon(x.nokkel) === mekanismeikon(m.nokkel)), m.nokkel).toHaveLength(1)
    }
  })

  it('tegner stoffet i trafikklysfargen for mekanismen, og målet i systemfargen, ugjennomsiktig', () => {
    const fargePaa = { okt: 'okt', delvis: 'delvis', redusert: 'redusert', noytral: 'noytral' } as const
    for (const m of MEKANISMER) {
      const navn = mekanismeikon(m.nokkel)
      if (!navn) continue
      const alle = deler(IKONER[navn].parts)
      const stoff = alle.filter((d) => d.t !== 'g' && d.role === 'o2')
      // Stoffet er der, og har mekanismens farge (den kompetitive antagonisten skyver også bort en agonist).
      expect(stoff.map((d) => d.t !== 'g' && d.col), m.nokkel).toContain(fargePaa[m.virkning])
      const maal = alle.filter((d) => d.t !== 'g' && d.col === 'system' && d.role !== 'd' && d.role !== 'f2')
      expect(maal.length, m.nokkel).toBeGreaterThan(0)
      for (const d of maal) expect(d.t !== 'g' && d.role, m.nokkel).toBe('o1')
    }
  })

  it('har animasjoner som ender der tegningen står, uten å holde noe', () => {
    const ikon = css('ikon.css')
    expect(ikon).not.toMatch(/animation-fill-mode\s*:|animation:[^;]*\b(forwards|both)\b/)
    for (const navn of ['glidR', 'glidL']) {
      expect(ikon, navn).toMatch(new RegExp(`@keyframes o-${navn} \\{[^}]*\\}[^}]*100% \\{ transform: translateX\\(0\\); \\}`))
    }
  })
})

/* --- Systemene --------------------------------------------------------------------- */

describe('systemene målene hører til', () => {
  it('kjenner igjen systemet i navnene kildene bruker', () => {
    const forventet: Record<string, string | undefined> = {
      'D2-reseptor': 'dopamin',
      'Dopaminreopptak / DAT': 'dopamin',
      'Noradrenalinreopptak / NET': 'noradrenalin',
      'α1-adrenerg reseptor': 'noradrenalin',
      'Presynaptisk α2-autoreseptor': 'noradrenalin',
      'β-adrenerg responsivitet': 'noradrenalin',
      '5-HT2C-reseptor': 'serotonin',
      'Serotoninreopptak / SERT': 'serotonin',
      'H1-reseptor': 'histamin',
      Histaminreseptorer: 'histamin',
      'μ-opioidreseptor': 'opioid',
      'NMDA-reseptor/kanal': 'glutamat',
      'GABA-reopptak': 'gaba',
      'Kolinerge/muskarine reseptorer': 'acetylkolin',
      'M1-reseptor': 'acetylkolin',
      'ACE (angiotensinkonverterende enzym)': 'raas',
      'Angiotensin II AT1-reseptor': 'raas',
      'Aldosteron-/mineralokortikoidreseptor': 'raas',
      Kjønnshormonreseptorer: 'hormon',
      'Spenningsstyrte L-type Ca2+-kanaler': 'ioner',
      'Na+/K+/2Cl−-kotransportør i oppadgående Henles sløyfe': 'ioner',
      Kaliumkanaler: 'ioner',
      'Noe helt annet': undefined,
    }
    for (const [maal, system] of Object.entries(forventet)) expect(systemFor(maal), maal).toBe(system)
  })

  it('har en farge for hvert system i begge temaene, og en klasse som setter den', () => {
    const tokens = css('tokens.css')
    const ikon = css('ikon.css')
    for (const { nokkel } of SYSTEMER) {
      expect(tokens.match(new RegExp(`--system-${nokkel}: #`, 'g')), nokkel).toHaveLength(2)
      expect(ikon, nokkel).toContain(`.system-${nokkel} { --system-farge: var(--system-${nokkel}); }`)
    }
    for (const { nokkel } of VIRKNINGER) expect(tokens.match(new RegExp(`--virkning-${nokkel}:`, 'g')), nokkel).toHaveLength(2)
  })
})

/* --- Subtypene ------------------------------------------------------------------- */

describe('subtypene i navnet på målet', () => {
  const vis = (maal: string) => subtypedeler(maal).map((d) => (d.senket ? `_${d.tekst}_` : d.tekst)).join('')

  it('senker subtypen etter reseptorfamilien', () => {
    expect(vis('D1-reseptor')).toBe('D_1_-reseptor')
    expect(vis('Angiotensin II AT1-reseptor')).toBe('Angiotensin II AT_1_-reseptor')
    expect(vis('5-HT2C-reseptor')).toBe('5-HT_2C_-reseptor')
    expect(vis('5-HT1A-reseptor (norkvetiapin)')).toBe('5-HT_1A_-reseptor (norkvetiapin)')
    expect(vis('α1- og β2-adrenerge reseptorer')).toBe('α_1_- og β_2_-adrenerge reseptorer')
    expect(vis('Histamin H1-reseptor')).toBe('Histamin H_1_-reseptor')
    expect(vis('GABAA-reseptor')).toBe('GABA_A_-reseptor')
  })

  it('lar navn uten subtype, enzymer og ioner stå som de er', () => {
    for (const maal of ['CYP2D6', 'Spenningsstyrte L-type Ca2+-kanaler', 'Na+/K+/2Cl−-kotransportør', 'NMDA-reseptor/kanal', 'Dopaminreopptak / DAT', 'GABA-reopptak']) {
      expect(vis(maal), maal).toBe(maal)
    }
  })
})

/* --- Søket og historikken --------------------------------------------------------- */

const ATENOLOL = [
  { maal: 'β1-adrenerg reseptor', mekanisme: 'kompetitiv_antagonisme', dokument: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Reduserer oksygenbehovet i hjertet.' }] }] } },
  { maal: 'β2-adrenerge reseptorer', mekanisme: 'ingen_effekt', dokument: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Bronkodilatasjon blokkeres ikke.' }] }] } },
]

describe('søket', () => {
  it('finner målet, effekten og den utdypende teksten', () => {
    const tekster = elementtekster('mekanismekort', ATENOLOL[0])
    expect(tekster.map((t) => [t.navn, t.tekst])).toEqual([
      ['Mål', 'β1-adrenerg reseptor'],
      ['Effekt', 'Kompetitiv antagonist'],
      ['Utdypende tekst', 'Reduserer oksygenbehovet i hjertet.'],
    ])
  })

  it('går til riktig mekanismekort fra det globale søket', () => {
    const elementer = ATENOLOL.map((data, i) => ({ id: `k${i}`, panel: 'farmakodynamikk', posisjon: i, elementtype: 'mekanismekort', data, referanser: [] }))
    const modell = { paneler: new Map([['farmakodynamikk', elementer]]), panelreferanser: {}, referanseliste: [] } as unknown as Sidemodell
    const indeks = lagSokeindeks(indekserSide({ stoff: 'atenolol', navn: 'Atenolol' } as Parameters<typeof indekserSide>[0], modell))
    for (const [sporring, id] of [
      ['β1-adrenerg', 'k0'],
      ['bronkodilatasjon', 'k1'],
      ['oksygenbehovet', 'k0'],
    ] as const) {
      const [treff] = sokGlobalt(indeks, sporring)
      expect(treff?.dokument.sted, sporring).toMatchObject({ panel: { nokkel: 'farmakodynamikk' }, detaljkort: id })
    }
  })
})

describe('historikken', () => {
  it('sammenligner et mekanismekort felt for felt', () => {
    const innhold = { infoside: 's', panel: 'farmakodynamikk', posisjon: 1, elementtype: 'mekanismekort', data: ATENOLOL[1]!, referanser: ['r'] }
    expect(innholdsfelter('innholdselement', innhold).map((f) => [f.nokkel, f.verdi])).toEqual([
      ['panel', 'Farmakodynamikk'],
      ['plass', '2'],
      ['Mål', 'β2-adrenerge reseptorer'],
      ['Effekt', 'Ingen effekt'],
      ['Utdypende tekst', 'Bronkodilatasjon blokkeres ikke.'],
      ['kilder', '1 kilde'],
    ])
  })
})
