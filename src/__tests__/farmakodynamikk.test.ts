/**
 * Farmakodynamikken som mekanismekort: datasettet
 * (`supabase/import/farmakodynamikk/`) mot fasiten i
 * `docs/farmakodynamikk-kort-kartlegging.md`, kontrollen som sikrer at ingen
 * tekst går tapt eller kommer til, migrasjonene, ikonene, fargene og søket.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { IKONNAVN } from '../components/ikon/register'
import { mekanismeikon } from '../components/stoffside/panelvisning'
import { STOFFREGISTER } from '../domain/stoffregister'
import {
  farmakodynamikkfiler,
  farmakodynamikkmigrasjoner,
  farmakodynamikkplan,
  kontrollerKartlegging,
  setninger,
  type Kartleggingsfil,
} from '../faginnhold/farmakodynamikk'
import { Importfeil, type Importfil } from '../faginnhold/import'
import { innholdsfelter } from '../faginnhold/innholdsfelter'
import { INGEN_EFFEKT, MEKANISMER, retningFor, type Mekanisme, type Retning } from '../faginnhold/mekanismer'
import { lesMekanismekort } from '../faginnhold/paneler'
import { elementtekster, indekserSide, lagSokeindeks, sokGlobalt } from '../faginnhold/sok'
import type { Sidemodell } from '../faginnhold/stoffside'
import { migrasjonsfiler } from './hjelp/testdatabase'

const DOKUMENT = readFileSync(new URL('../../docs/farmakodynamikk-kort-kartlegging.md', import.meta.url), 'utf8')
const MIGRASJONSMAPPE = new URL('../../supabase/migrations/', import.meta.url)
const FILER = farmakodynamikkfiler()
const KARTLAGT = kontrollerKartlegging(FILER)
const PER_STOFF = new Map(KARTLAGT.map((f) => [f.stoff, f]))

/* --- Fasiten, lest fra kartleggingen ---------------------------------------- */

interface Rad {
  maal: string
  effekt: string
  kategori: string
  retning: string
  forbehold: string
}

interface Kartlagt {
  navn: string
  kilde: string
  rader: Rad[]
}

/** Seksjonene under en overskrift på nivå 2, som `### Navn` og teksten under. */
function seksjoner(overskrift: string): { navn: string; tekst: string }[] {
  const del = DOKUMENT.split(/\n## /).find((d) => d.startsWith(overskrift))!
  return del
    .split(/\n### /)
    .slice(1)
    .map((s) => ({ navn: s.split('\n')[0]!.trim(), tekst: s }))
}

const MED_TEKST: Kartlagt[] = seksjoner('Stoffer med kartlagt farmakodynamikk').map(({ navn, tekst }) => ({
  navn,
  kilde: /_Kildegrunnlag: [^:]+: supabase\/import\/(\S+)_/.exec(tekst)![1]!,
  rader: tekst
    .split('\n')
    .filter((l) => l.startsWith('| ') && !l.startsWith('| Målprotein') && !l.startsWith('| ---'))
    .map((l) => {
      const [maal, effekt, kategori, retning, forbehold] = l.slice(1, -1).split('|').map((c) => c.trim())
      return { maal: maal!, effekt: effekt!, kategori: kategori!, retning: retning!, forbehold: forbehold! }
    }),
}))
const UTEN_TEKST = seksjoner('Stoffer uten farmakodynamikktekst').map((s) => s.navn)

/** Kategoriene i kartleggingen, som mekanismetypene i appen. */
const KATEGORIER: Record<string, Mekanisme> = {
  'Reseptormodulering → antagonisme (subtype ikke angitt)': 'antagonisme',
  'Reseptormodulering → kompetitiv antagonisme': 'kompetitiv_antagonisme',
  'Reseptormodulering → agonisme (grad/full agonisme ikke angitt)': 'agonisme',
  'Reseptormodulering → partiell agonisme': 'partiell_agonisme',
  'Reseptormodulering → funksjonell effekt ikke angitt': 'reseptorbinding',
  'Reseptormodulering → effektretning ikke eksplisitt angitt': 'reseptorpavirkning',
  'Reseptormodulering → funksjonell retning ikke angitt': 'reseptorpavirkning',
  'Reseptormodulering → mekanisme ikke spesifisert': 'reseptorpavirkning',
  'Reseptormodulering → målprotein og subtype ikke spesifisert': 'reseptorpavirkning',
  'Ionekanalmodulering → kanalblokkering': 'kanalblokkering',
  'Ionekanalmodulering → bruks-/frekvensavhengig blokkering': 'bruksavhengig_blokkering',
  'Ionekanalmodulering → retning ikke angitt i teksten': 'ionekanalpavirkning',
  'Transportører, pumper og exchangere → reopptakshemming': 'reopptakshemming',
  'Transportører, pumper og exchangere → transporterhemming': 'transporterhemming',
  'Transportører, pumper og exchangere → hemming/modulering av kotransportører': 'kotransporterhemming',
  'Transportører, pumper og exchangere → funksjonell effekt ikke angitt': 'transportorpavirkning',
  'Transportører, pumper og exchangere → påvirkning for liten til å spesifisere sikkert': 'transportorpavirkning',
  'Enzymmodulering → enzymhemming (subtype ikke angitt)': 'enzymhemming',
  'Ingen effekt': 'ingen_effekt',
}

const RETNINGSSYMBOLER: Record<string, Retning> = { '↓': 'ned', '↑': 'opp', '0': 'ingen', '?': 'ukjent' }

/** Stoffet i registeret et navn i kartleggingen gjelder. */
const stoffFor = (navn: string) => STOFFREGISTER.kanonisk(navn)

/** Forbeholdet i kartleggingen, med liten forbokstav i hvert ledd: kortet skriver merknaden med stor. */
const ledd = (tekst: string) => (tekst ? tekst.split('; ').map((l) => l.charAt(0).toLowerCase() + l.slice(1)) : [])

/* --- Datasettet mot kartleggingen -------------------------------------------- */

describe('datasettet mot kartleggingen', () => {
  it('har med hvert stoff i kartleggingen: 60 med tekst og 39 uten', () => {
    expect(MED_TEKST).toHaveLength(60)
    expect(UTEN_TEKST).toHaveLength(39)
    expect(KARTLAGT.map((f) => f.stoff).sort()).toEqual(MED_TEKST.map((k) => stoffFor(k.navn)!.slug).sort())
    // Hvert stoff i registeret står i kartleggingen, med tekst eller uten.
    const kartlagt = [...MED_TEKST.map((k) => k.navn), ...UTEN_TEKST].map((n) => stoffFor(n)?.slug)
    expect(kartlagt).not.toContain(undefined)
    expect(new Set(kartlagt)).toEqual(new Set(STOFFREGISTER.stoffer.map((s) => s.slug)))
  })

  it('har ingen kort for stoffene uten farmakodynamikktekst, og heller ingen tekst å gjøre om', () => {
    for (const navn of UTEN_TEKST) {
      const slug = stoffFor(navn)!.slug
      expect(PER_STOFF.has(slug), navn).toBe(false)
      const kilder = Object.values(FILER).filter((f) => (f as Importfil).stoff === slug)
      for (const kilde of kilder) expect((kilde as Importfil).farmakodynamikk, navn).toBeUndefined()
    }
  })

  it('bygger hvert stoff på filen kartleggingen oppgir', () => {
    for (const k of MED_TEKST) expect(PER_STOFF.get(stoffFor(k.navn)!.slug)!.kilde, k.navn).toBe(k.kilde)
  })

  it('har kortene i kartleggingens rekkefølge, med mål, effekt, mekanisme og retning som der', () => {
    let kort = 0
    for (const k of MED_TEKST) {
      const fil = PER_STOFF.get(stoffFor(k.navn)!.slug)!
      expect(fil.kort.length, k.navn).toBe(k.rader.length)
      k.rader.forEach((rad, i) => {
        const hvor = `${k.navn}, ${rad.maal}`
        const kortet = fil.kort[i]!
        expect(kortet.maal, hvor).toBe(rad.maal)
        expect(kortet.effekt, hvor).toBe(rad.effekt)
        expect(KATEGORIER[rad.kategori], `${hvor}: ukjent kategori «${rad.kategori}»`).toBeDefined()
        expect(kortet.mekanisme, hvor).toBe(KATEGORIER[rad.kategori])
        expect(kortet.retning, hvor).toBe(RETNINGSSYMBOLER[rad.retning])
        kort++
      })
    }
    expect(kort).toBe(224)
  })

  it('fører forbeholdet i kartleggingen inn som kvalifikasjonen og merknaden, uten å legge til noe', () => {
    for (const k of MED_TEKST) {
      const fil = PER_STOFF.get(stoffFor(k.navn)!.slug)!
      k.rader.forEach((rad, i) => {
        const { kvalifikasjon, merknad } = fil.kort[i]!
        expect(ledd([kvalifikasjon, merknad].filter(Boolean).join('; ')), `${k.navn}, ${rad.maal}`).toEqual(ledd(rad.forbehold))
      })
    }
  })

  it('beholder målene kilden sier uttrykkelig at stoffet ikke virker på, som egne kort uten effekt', () => {
    const ingen = KARTLAGT.flatMap((f) => f.kort.filter((k) => k.mekanisme === INGEN_EFFEKT).map((k) => `${f.stoff}: ${k.maal}`))
    expect(ingen).toHaveLength(50)
    expect(ingen).toEqual(expect.arrayContaining(['amisulprid: D1-reseptor', 'amisulprid: Kolinerge reseptorer']))
    for (const f of KARTLAGT) {
      for (const k of f.kort.filter((x) => x.mekanisme === INGEN_EFFEKT)) expect(k.retning, `${f.stoff}: ${k.maal}`).toBe('ingen')
    }
  })

  it('gjør ikke en generell antagonist eller ACE-hemmer mer presis enn kilden', () => {
    const kort = (stoff: string, maal: string) => PER_STOFF.get(stoff)!.kort.find((k) => k.maal === maal)
    expect(PER_STOFF.get('enalapril')!.kort.map((k) => k.mekanisme)).toEqual(['enzymhemming'])
    expect(kort('amisulprid', 'D2-reseptor')!.mekanisme).toBe('antagonisme')
    expect(kort('atenolol', 'β1-adrenerg reseptor')!.mekanisme).toBe('kompetitiv_antagonisme')
  })
})

/* --- Ingen tekst går tapt, og ingen kommer til ------------------------------- */

describe('teksten på kortene', () => {
  it('har hver setning fra den gamle teksten på et kort eller i kortfeltene, og ingen nye setninger', () => {
    for (const fil of KARTLAGT) {
      const kilde = setninger((FILER[fil.kilde] as Importfil).farmakodynamikk!.tekst)
      const paaKortene = setninger(fil.kort.flatMap((k) => k.utdyping ?? []))
      expect([...paaKortene, ...(fil.dekket ?? [])].sort(), fil.stoff).toEqual([...kilde].sort())
    }
  })

  describe('kontrollen', () => {
    const sti = 'farmakodynamikk/atenolol.json'
    const atenolol = FILER[sti] as Kartleggingsfil
    const feil = (fil: Kartleggingsfil): string[] => {
      try {
        kontrollerKartlegging({ ...FILER, [sti]: fil })
      } catch (e) {
        expect(e).toBeInstanceOf(Importfeil)
        return (e as Importfeil).feil
      }
      return []
    }

    it('stopper på en setning fra kilden som mangler, og en som ikke står i kilden', () => {
      const forste = { ...atenolol.kort[0]!, utdyping: [...atenolol.kort[0]!.utdyping!, 'En ny påstand.'] }
      expect(feil({ ...atenolol, kort: [forste] })).toEqual([
        'atenolol: setningen «Beta2-reseptorer i lunger og kar påvirkes lite.» står ikke på noe kort',
        'atenolol: setningen «Beta2-mediert bronkodilatasjon og den vasodilaterende effekt av adrenalin blokkeres ikke.» står ikke på noe kort',
        'atenolol: «En ny påstand.» står ikke i kilden',
      ])
    })

    it('stopper på et kort med ukjent mekanisme, og på «Ingen effekt» med en retning', () => {
      expect(
        feil({
          ...atenolol,
          kort: [
            { ...atenolol.kort[0]!, mekanisme: 'invers_agonisme' },
            { ...atenolol.kort[1]!, retning: 'ned' },
          ],
        }),
      ).toEqual([
        'atenolol, kort 1: ukjent mekanisme «invers_agonisme»',
        'atenolol, kort 2: Mekanismen «Ingen effekt» og retningen «Ingen effekt» hører sammen.',
      ])
    })
  })

  it('gir hvert kort kildene til den gamle teksten', () => {
    // Kildene hentes fra teksten i databasen (se migrasjonstesten); her er
    // det nok at alle antihypertensivene har kilder på teksten som gjøres om.
    const antihypertensiver = KARTLAGT.filter((f) => f.kilde.startsWith('antihypertensiver/'))
    expect(antihypertensiver).toHaveLength(25)
    for (const f of antihypertensiver) expect((FILER[f.kilde] as Importfil).farmakodynamikk!.referanser?.length, f.stoff).toBeGreaterThan(0)
  })
})

/* --- Migrasjonene ------------------------------------------------------------ */

describe('migrasjonene', () => {
  it('er de skriptet lager av datasettet', () => {
    const filer = migrasjonsfiler().filter((f) => /_farmakodynamikk_mekanismekort_\d+\.sql$/.test(f))
    const forventet = farmakodynamikkmigrasjoner(farmakodynamikkplan(), 'peohol')
    expect(filer).toHaveLength(forventet.length)
    filer.forEach((f, i) => expect(readFileSync(new URL(f, MIGRASJONSMAPPE), 'utf8'), f).toBe(forventet[i]))
    for (const sql of forventet) expect(sql.length).toBeLessThanOrEqual(50_000)
  })

  it('tar med alle 60 stoffene og 224 kort, i rekkefølge', () => {
    const plan = farmakodynamikkplan()
    expect(plan.map((k) => k.stoff)).toEqual(KARTLAGT.map((f) => f.stoff))
    expect(plan.reduce((sum, k) => sum + k.kort.length, 0)).toBe(224)
  })
})

/* --- Ikonene og fargene --------------------------------------------------------- */

describe('ikonene og fargene', () => {
  const brukt = new Set(KARTLAGT.flatMap((f) => f.kort.map((k) => k.mekanisme as Mekanisme)))

  it('har bare mekanismetypene innholdet bruker', () => {
    expect(new Set(MEKANISMER.map((m) => m.nokkel))).toEqual(brukt)
  })

  it('har ikoner bare for mekanismene som er i bruk, og ingen for «Ingen effekt»', () => {
    const mekanismeikoner = IKONNAVN.filter((n) => n.startsWith('mek'))
    const iBruk = new Set([...brukt].map(mekanismeikon).filter(Boolean))
    expect(new Set(mekanismeikoner)).toEqual(iBruk)
    expect(mekanismeikon(INGEN_EFFEKT)).toBeUndefined()
    expect(mekanismeikon(null)).toBeUndefined()
    // De spesifikke mekanismene har hvert sitt ikon; de generelle deler familiens.
    for (const m of MEKANISMER.filter((x) => x.spesifikk && x.nokkel !== INGEN_EFFEKT)) {
      expect(MEKANISMER.filter((x) => mekanismeikon(x.nokkel) === mekanismeikon(m.nokkel)), m.nokkel).toHaveLength(1)
    }
  })

  it('farger rødt når målet reduseres, grønt når det økes, og nøytralt ellers, som kartleggingen', () => {
    expect(retningFor('ned').tone).toBe('ned')
    expect(retningFor('opp').tone).toBe('opp')
    expect(retningFor('ingen').tone).toBe('noytral')
    expect(retningFor('ukjent').tone).toBe('noytral')
    for (const k of MED_TEKST) {
      const fil = PER_STOFF.get(stoffFor(k.navn)!.slug)!
      k.rader.forEach((rad, i) => {
        const tone = { '↓': 'ned', '↑': 'opp', '0': 'noytral', '?': 'noytral' }[rad.retning]
        expect(retningFor(lesMekanismekort(fil.kort[i]).retning).tone, `${k.navn}, ${rad.maal}`).toBe(tone)
      })
    }
    // En α2-antagonist reduserer α2-aktiviteten, selv om den nedstrøms øker noradrenerg transmisjon.
    expect(PER_STOFF.get('mirtazapin')!.kort.find((k) => k.maal.includes('α2'))!.retning).toBe('ned')
  })
})

/* --- Søket ------------------------------------------------------------------------ */

describe('søket', () => {
  const [atenolol] = farmakodynamikkplan().filter((k) => k.stoff === 'atenolol')
  const kort = atenolol!.kort

  it('finner målet, effekten, kvalifikasjonen, merknaden og den utdypende teksten', () => {
    const tekster = elementtekster('mekanismekort', kort[1])
    expect(tekster.map((t) => t.navn)).toEqual(['Mål', 'Effekt', 'Kvalifikasjon', 'Mekanisme', 'Retning', 'Merknad', 'Utdypende tekst'])
    expect(tekster[0]).toMatchObject({ felt: 'overskrift', tekst: 'β2-adrenerge reseptorer' })
    expect(tekster.at(-1)!.tekst).toContain('Beta2-mediert bronkodilatasjon')
  })

  it('går til riktig mekanismekort fra det globale søket', () => {
    const elementer = kort.map((data, i) => ({ id: `k${i}`, panel: 'farmakodynamikk', posisjon: i, elementtype: 'mekanismekort', data, referanser: [] }))
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

/* --- Historikken -------------------------------------------------------------- */

describe('historikken', () => {
  it('sammenligner et mekanismekort felt for felt', () => {
    const [atenolol] = farmakodynamikkplan().filter((k) => k.stoff === 'atenolol')
    const innhold = { infoside: 's', panel: 'farmakodynamikk', posisjon: 1, elementtype: 'mekanismekort', data: atenolol!.kort[1]!, referanser: ['r'] }
    expect(innholdsfelter('innholdselement', innhold).map((f) => [f.nokkel, f.verdi])).toEqual([
      ['panel', 'Farmakodynamikk'],
      ['plass', '2'],
      ['Mål', 'β2-adrenerge reseptorer'],
      ['Effekt', 'Liten/ingen relevant blokkade'],
      ['Kvalifikasjon', 'Påvirkes lite'],
      ['Mekanisme', 'Ingen effekt'],
      ['Retning', 'Ingen effekt'],
      ['Merknad', 'β2-mediert bronkodilatasjon og adrenalins vasodilaterende effekt blokkeres ikke'],
      ['Utdypende tekst', expect.stringContaining('Beta2-reseptorer i lunger og kar påvirkes lite.')],
      ['kilder', '1 kilde'],
    ])
  })
})
