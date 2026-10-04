/**
 * Forhåndsvisningen av en bivirkningsimport (`src/bivirkninger/forhandsvisning.ts`,
 * `docs/bivirkninger.md`): innholdet i en import, og hva den endrer fra den
 * forrige importen av samme preparatomtale — uten å gjette at to ulike
 * tekster er den samme bivirkningen. At databasen ser de samme importene som
 * like, kontrolleres i `bivirkninger.test.ts`.
 *
 * Alle bivirkningene her er syntetiske.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { importoversikt, importrapport, sammeInnhold, sammenlignImporter, type Importrad } from '../bivirkninger/forhandsvisning'
import { importmigrasjon, kildeid, sisteEndringer, tilbaketrekkingsmigrasjon, type Bivirkningsimport } from '../bivirkninger/import'

type Enkeltabell = Extract<Bivirkningsimport, { tabeller?: undefined }>
type Flertabell = Extract<Bivirkningsimport, { organsystemer?: undefined }>

const MALMAPPE = new URL('../../supabase/maler/', import.meta.url)
const lesMal = <T,>(navn: string): T => JSON.parse(readFileSync(new URL(navn, MALMAPPE), 'utf8')) as T
const MAL = lesMal<Enkeltabell>('bivirkningsimport.json')
const TABELLMAL = lesMal<Flertabell>('bivirkningsimport-tabeller.json')

const endret = <T extends Bivirkningsimport>(mal: T, endre: (imp: T) => void): T => {
  const imp = structuredClone(mal)
  endre(imp)
  return imp
}

/** Radene kort: [tabell, organsystem, frekvens, tekst]. */
const kort = (rader: readonly Importrad[]) => rader.map((r) => [r.tabell, r.organsystem, r.frekvens, r.tekst])
const endringene = (s: ReturnType<typeof sammenlignImporter>) => s.endret.map((e) => [e.til.tekst, e.hva])

/** En sammenligning der ingenting er endret, som utgangspunkt for forventningene. */
const INGENTING = {
  kilde: [],
  tabeller: { lagtTil: [], fjernet: [], endret: [], rekkefolge: null },
  lagtTil: [],
  fjernet: [],
  endret: [],
  rekkefolge: [],
}

describe('innholdet i en import', () => {
  it('teller bivirkningene i alt, per frekvens, per organsystem og med fotnote', () => {
    const o = importoversikt(MAL)
    expect([o.antall, o.antallFotnoter, o.tabeller.length]).toEqual([4, 1, 1])
    const [t] = o.tabeller
    expect(t!.nokkel).toBeNull()
    expect(t!.perFrekvens).toEqual([
      { kode: 'svaert_vanlige', antall: 1 },
      { kode: 'vanlige', antall: 0 },
      { kode: 'mindre_vanlige', antall: 2 },
      { kode: 'sjeldne', antall: 0 },
      { kode: 'svaert_sjeldne', antall: 0 },
      { kode: 'ikke_kjent', antall: 1 },
    ])
    // Bare organsystemer med bivirkninger, i MedDRA-rekkefølgen.
    expect(t!.perOrgansystem).toEqual([
      { kode: 'nevrologiske', antall: 3 },
      { kode: 'gastrointestinale', antall: 1 },
    ])
    expect(t!.fotnoter.map((r) => [r.tekst, r.fotnote])).toEqual([['Syntetisk bivirkning C', 'Syntetisk fotnote slik den står i preparatomtalen.']])
  })

  it('teller hver tabell for seg, med navnet og frekvensgrunnlaget', () => {
    const o = importoversikt(TABELLMAL)
    expect(o.antall).toBe(2)
    expect(o.tabeller.map((t) => [t.nokkel, t.navn, t.frekvensgrunnlag, t.merknad, t.antall])).toEqual([
      ['syntetisk-indikasjon-per-pasient', 'Syntetisk indikasjon A', 'per pasient', null, 1],
      ['syntetisk-indikasjon-per-infusjon', 'Syntetisk indikasjon A', 'per infusjon', 'Syntetisk merknad til tabellen.', 1],
    ])
    // Den samme bivirkningen med ulik frekvens i de to tabellene telles aldri sammen.
    expect(o.tabeller.map((t) => t.perFrekvens.filter((f) => f.antall > 0))).toEqual([
      [{ kode: 'vanlige', antall: 1 }],
      [{ kode: 'mindre_vanlige', antall: 1 }],
    ])
  })
})

describe('sammenligningen med den forrige importen', () => {
  it('finner ingen endringer når importen er den samme, heller ikke med en annen som importerer', () => {
    expect(sammenlignImporter(MAL, structuredClone(MAL))).toEqual({ identisk: true, ...INGENTING })
    const annen = endret(MAL, (i) => (i.kilde.importert_av = 'Syntetisk annen'))
    const s = sammenlignImporter(MAL, annen)
    expect(s.identisk).toBe(true)
    expect(s.kilde).toEqual([{ felt: 'importert_av', navn: 'Importert av', fra: 'Syntetisk importør', til: 'Syntetisk annen' }])
  })

  it('ser bort fra rekkefølgen på feltene, men ikke på et felt som er null i stedet for utelatt', () => {
    const omstokket = { organsystemer: MAL.organsystemer, kilde: MAL.kilde, stoff: MAL.stoff, format: MAL.format } as Enkeltabell
    expect(sammeInnhold(MAL, omstokket)).toBe(true)
    const medNull = endret(MAL, (i) => (i.kilde.lenke = null))
    const utenLenke = endret(MAL, (i) => delete i.kilde.lenke)
    expect(sammeInnhold(utenLenke, medNull)).toBe(false)
    // Det er ingen forskjell å vise, men databasen legger den inn på nytt, og det sier rapporten.
    expect(sammenlignImporter(utenLenke, medNull)).toEqual({ identisk: false, ...INGENTING })
    expect(importrapport(medNull, { slag: 'import', import: utenLenke, beskrivelse: 'den forrige' })).toContain('Ingen forskjell i det som vises')
  })

  it('finner nye og fjernede bivirkninger', () => {
    const ny = endret(MAL, (i) => {
      i.organsystemer[0]!.frekvenser[0]!.bivirkninger.push('Syntetisk bivirkning X')
      i.organsystemer[1]!.frekvenser[0]!.bivirkninger = ['Syntetisk bivirkning Y']
    })
    const s = sammenlignImporter(MAL, ny)
    expect(s.identisk).toBe(false)
    expect(kort(s.lagtTil)).toEqual([
      [null, 'nevrologiske', 'svaert_vanlige', 'Syntetisk bivirkning X'],
      [null, 'gastrointestinale', 'ikke_kjent', 'Syntetisk bivirkning Y'],
    ])
    // «D» og «Y» står på samme sted, men med ulik tekst: de pares ikke.
    expect(kort(s.fjernet)).toEqual([[null, 'gastrointestinale', 'ikke_kjent', 'Syntetisk bivirkning D']])
    expect(s.endret).toEqual([])
  })

  it('finner en endret frekvens', () => {
    const ny = endret(MAL, (i) => (i.organsystemer[1]!.frekvenser[0]!.frekvens = 'sjeldne'))
    const s = sammenlignImporter(MAL, ny)
    expect(endringene(s)).toEqual([['Syntetisk bivirkning D', ['frekvens']]])
    expect([s.lagtTil, s.fjernet]).toEqual([[], []])
  })

  it('finner en bivirkning som er flyttet til et annet organsystem', () => {
    const ny = endret(MAL, (i) => {
      i.organsystemer[0]!.frekvenser[1]!.bivirkninger.shift()
      i.organsystemer.push({ organsystem: 'hud', frekvenser: [{ frekvens: 'mindre_vanlige', bivirkninger: ['Syntetisk bivirkning B'] }] })
    })
    const s = sammenlignImporter(MAL, ny)
    expect(endringene(s)).toEqual([['Syntetisk bivirkning B', ['organsystem']]])
    expect(s.endret[0]!.fra).toMatchObject({ organsystem: 'nevrologiske', frekvens: 'mindre_vanlige' })
    expect([s.lagtTil, s.fjernet]).toEqual([[], []])
    // Flyttet og med ny frekvens samtidig: begge deler står.
    const begge = endret(ny, (i) => (i.organsystemer[2]!.frekvenser[0]!.frekvens = 'vanlige'))
    expect(endringene(sammenlignImporter(MAL, begge))).toEqual([['Syntetisk bivirkning B', ['organsystem', 'frekvens']]])
  })

  it('finner en fotnote som er lagt til, endret eller fjernet', () => {
    const forrige = endret(MAL, (i) => {
      i.organsystemer[1]!.frekvenser[0]!.bivirkninger = [{ tekst: 'Syntetisk bivirkning D', fotnote: 'Syntetisk fotnote D.' }]
    })
    const ny = endret(MAL, (i) => {
      const liste = i.organsystemer[0]!.frekvenser[1]!.bivirkninger
      liste[0] = { tekst: 'Syntetisk bivirkning B', fotnote: 'Syntetisk ny fotnote.' }
      liste[1] = { tekst: 'Syntetisk bivirkning C', fotnote: 'Syntetisk endret fotnote.' }
      i.organsystemer[1]!.frekvenser[0]!.bivirkninger = [{ tekst: 'Syntetisk bivirkning D', fotnote: null }]
    })
    const s = sammenlignImporter(forrige, ny)
    expect(s.endret.map((e) => [e.til.tekst, e.hva, e.fra.fotnote, e.til.fotnote])).toEqual([
      ['Syntetisk bivirkning B', ['fotnote'], null, 'Syntetisk ny fotnote.'],
      ['Syntetisk bivirkning C', ['fotnote'], 'Syntetisk fotnote slik den står i preparatomtalen.', 'Syntetisk endret fotnote.'],
      ['Syntetisk bivirkning D', ['fotnote'], 'Syntetisk fotnote D.', null],
    ])
    expect([s.lagtTil, s.fjernet]).toEqual([[], []])
  })

  it('kjenner igjen en tekst med bare andre store og små bokstaver, men gjetter aldri ellers', () => {
    const ny = endret(MAL, (i) => {
      i.organsystemer[0]!.frekvenser[0]!.bivirkninger = ['syntetisk BIVIRKNING a']
      i.organsystemer[1]!.frekvenser[0]!.bivirkninger = ['Syntetisk bivirkning D.']
    })
    const s = sammenlignImporter(MAL, ny)
    expect(endringene(s)).toEqual([['syntetisk BIVIRKNING a', ['tekst']]])
    expect(kort(s.fjernet)).toEqual([[null, 'gastrointestinale', 'ikke_kjent', 'Syntetisk bivirkning D']])
    expect(kort(s.lagtTil)).toEqual([[null, 'gastrointestinale', 'ikke_kjent', 'Syntetisk bivirkning D.']])
  })

  it('parer ikke en tekst som står flere steder når det ikke er entydig hvor den er flyttet', () => {
    const forrige = endret(MAL, (i) => {
      i.organsystemer[1]!.frekvenser[0]!.bivirkninger = ['Syntetisk bivirkning A']
    })
    const ny = endret(MAL, (i) => {
      i.organsystemer[0]!.frekvenser[0]!.bivirkninger = ['Syntetisk bivirkning Z']
      i.organsystemer[1]!.frekvenser[0]!.bivirkninger = ['Syntetisk bivirkning Z']
      i.organsystemer.push({ organsystem: 'hud', frekvenser: [{ frekvens: 'sjeldne', bivirkninger: ['Syntetisk bivirkning A'] }] })
    })
    const s = sammenlignImporter(forrige, ny)
    // «A» sto to steder og står nå ett tredje: den ene flyttingen kan ikke velges, så begge står som fjernet.
    expect(kort(s.fjernet)).toEqual([
      [null, 'nevrologiske', 'svaert_vanlige', 'Syntetisk bivirkning A'],
      [null, 'gastrointestinale', 'ikke_kjent', 'Syntetisk bivirkning A'],
    ])
    expect(kort(s.lagtTil)).toEqual([
      [null, 'nevrologiske', 'svaert_vanlige', 'Syntetisk bivirkning Z'],
      [null, 'gastrointestinale', 'ikke_kjent', 'Syntetisk bivirkning Z'],
      [null, 'hud', 'sjeldne', 'Syntetisk bivirkning A'],
    ])
    expect(s.endret).toEqual([])
  })

  it('finner endret rekkefølge innenfor en kombinasjon', () => {
    const ny = endret(MAL, (i) => i.organsystemer[0]!.frekvenser[1]!.bivirkninger.reverse())
    const s = sammenlignImporter(MAL, ny)
    expect(s.rekkefolge).toEqual([
      {
        tabell: null,
        organsystem: 'nevrologiske',
        frekvens: 'mindre_vanlige',
        fra: ['Syntetisk bivirkning B', 'Syntetisk bivirkning C'],
        til: ['Syntetisk bivirkning C', 'Syntetisk bivirkning B'],
      },
    ])
    expect([s.lagtTil, s.fjernet, s.endret]).toEqual([[], [], []])
  })

  it('finner endringer i kilden og fagsiden', () => {
    const ny = endret(MAL, (i) => {
      i.stoff = 'syntetisk-annet'
      i.kilde.spc_versjon = 'Syntetisk versjon 2'
      i.kilde.revisjonsdato = '2026-06-30'
      delete i.kilde.lenke
    })
    expect(sammenlignImporter(MAL, ny).kilde).toEqual([
      { felt: 'stoff', navn: 'Fagside', fra: 'syntetisk-eksempel', til: 'syntetisk-annet' },
      { felt: 'spc_versjon', navn: 'SPC-versjon', fra: 'Syntetisk versjon 1', til: 'Syntetisk versjon 2' },
      { felt: 'revisjonsdato', navn: 'Revisjonsdato', fra: '2026-01-31', til: '2026-06-30' },
      { felt: 'lenke', navn: 'Lenke', fra: 'https://example.org/syntetisk-preparatomtale', til: null },
    ])
  })

  it('holder tabellene fra hverandre, og finner tabeller som er lagt til, fjernet, endret eller byttet plass', () => {
    const [perPasient, perInfusjon] = TABELLMAL.tabeller
    const ny = endret(TABELLMAL, (i) => {
      i.tabeller = [
        { ...structuredClone(perInfusjon!), frekvensgrunnlag: 'per syntetisk infusjon' },
        structuredClone(perPasient!),
        {
          nokkel: 'syntetisk-indikasjon-b',
          navn: 'Syntetisk indikasjon B',
          organsystemer: [{ organsystem: 'generelle', frekvenser: [{ frekvens: 'vanlige', bivirkninger: ['Syntetisk bivirkning E'] }] }],
        },
      ]
      // «E» får en annen frekvens i den ene tabellen; den andre tabellen er som før.
      i.tabeller[0]!.organsystemer[0]!.frekvenser[0]!.frekvens = 'sjeldne'
    })
    const s = sammenlignImporter(TABELLMAL, ny)
    expect(s.tabeller).toEqual({
      lagtTil: [{ nokkel: 'syntetisk-indikasjon-b', navn: 'Syntetisk indikasjon B', frekvensgrunnlag: null, merknad: null }],
      fjernet: [],
      endret: [
        {
          nokkel: 'syntetisk-indikasjon-per-infusjon',
          endringer: [{ felt: 'frekvensgrunnlag', navn: 'Frekvensgrunnlag', fra: 'per infusjon', til: 'per syntetisk infusjon' }],
        },
      ],
      rekkefolge: {
        fra: ['syntetisk-indikasjon-per-pasient', 'syntetisk-indikasjon-per-infusjon'],
        til: ['syntetisk-indikasjon-per-infusjon', 'syntetisk-indikasjon-per-pasient'],
      },
    })
    // Den samme teksten i en annen tabell er en annen bivirkning.
    expect(endringene(s)).toEqual([['Syntetisk bivirkning E', ['frekvens']]])
    expect(s.endret[0]!.til.tabell).toBe('syntetisk-indikasjon-per-infusjon')
    expect(kort(s.lagtTil)).toEqual([['syntetisk-indikasjon-b', 'generelle', 'vanlige', 'Syntetisk bivirkning E']])
    expect(s.fjernet).toEqual([])
  })

  it('ser én tabell som blir til flere som en tabell fjernet og nye lagt til, uten å flytte bivirkningene', () => {
    const fra = endret(MAL, (i) => (i.stoff = TABELLMAL.stoff))
    const s = sammenlignImporter(fra, TABELLMAL)
    expect(s.tabeller.fjernet).toEqual([{ nokkel: null, navn: null, frekvensgrunnlag: null, merknad: null }])
    expect(s.tabeller.lagtTil.map((t) => t.nokkel)).toEqual(['syntetisk-indikasjon-per-pasient', 'syntetisk-indikasjon-per-infusjon'])
    expect([s.fjernet.length, s.lagtTil.length, s.endret.length]).toEqual([4, 2, 0])
  })
})

describe('rapporten', () => {
  it('viser fagsiden, kilden, versjonen og innholdet ved en førstegangsimport', () => {
    const rapport = importrapport(MAL, { slag: 'ingen' }, 'syntetisk.json')
    for (const del of [
      'Fil: syntetisk.json',
      '- Fagside: syntetisk-eksempel (#/stoff/syntetisk-eksempel)',
      '- Kilde: syntetisk-preparat-spc (spc)',
      '- Tittel: Preparatomtale (SPC) for Syntetisk preparat 10 mg tabletter',
      '- SPC-versjon: Syntetisk versjon 1',
      '- Revisjonsdato: 2026-01-31',
      '4 bivirkninger i alt, 1 tabell, 1 fotnote.',
      '- Svært vanlige (≥ 1/10): 1',
      '- Vanlige (≥ 1/100 til < 1/10): 0',
      '- Nevrologiske sykdommer: 3',
      '- Nevrologiske sykdommer · Mindre vanlige: «Syntetisk bivirkning C» — fotnote: «Syntetisk fotnote slik den står i preparatomtalen.»',
      '**Førstegangsimport:**',
    ]) {
      expect(rapport).toContain(del)
    }
    expect(rapport).not.toContain('### Tabell')
  })

  it('sier når kildeopplysninger mangler, og viser hver tabell med frekvensgrunnlaget', () => {
    const rapport = importrapport(
      endret(TABELLMAL, (i) => delete i.kilde.spc_versjon),
      { slag: 'ingen', merknad: 'Syntetisk merknad om grunnlaget.' },
    )
    expect(rapport).toContain('- SPC-versjon: (ikke oppgitt)')
    expect(rapport).toContain('### Tabell «Syntetisk indikasjon A» (syntetisk-indikasjon-per-infusjon)')
    expect(rapport).toContain('- Frekvensgrunnlag: per infusjon')
    expect(rapport).toContain('telles bare tabell for tabell')
    expect(rapport).toContain('Syntetisk merknad om grunnlaget.')
  })

  it('sier at en identisk import ikke endrer noe', () => {
    const rapport = importrapport(structuredClone(MAL), { slag: 'import', import: MAL, beskrivelse: 'den syntetiske' })
    expect(rapport).toContain('Sammenlignet med den syntetiske.')
    expect(rapport).toContain('**Ingen endringer.**')
    expect(rapport).not.toContain('**Sammendrag:**')
  })

  it('lister hver endring under sin overskrift', () => {
    const ny = endret(MAL, (i) => {
      i.kilde.spc_versjon = 'Syntetisk versjon 2'
      i.organsystemer[0]!.frekvenser[0]!.bivirkninger.push('Syntetisk bivirkning X')
      i.organsystemer[1]!.frekvenser[0]!.frekvens = 'sjeldne'
    })
    const rapport = importrapport(ny, { slag: 'import', import: MAL, beskrivelse: 'den forrige' })
    expect(rapport).toContain(
      '**Sammendrag:** 1 lagt til, 0 fjernet, 0 flyttet til annet organsystem, 1 med endret frekvens, 0 med endret tekst, 0 med endret fotnote, 0 kombinasjoner med endret rekkefølge.',
    )
    expect(rapport).toContain('- SPC-versjon: «Syntetisk versjon 1» → «Syntetisk versjon 2»')
    expect(rapport).toContain('### Lagt til (1)\n\n- Nevrologiske sykdommer · Svært vanlige: «Syntetisk bivirkning X»')
    expect(rapport).toContain('### Endret frekvens (1)\n\n- «Syntetisk bivirkning D»: Ikke kjent → Sjeldne (Gastrointestinale sykdommer)')
    expect(rapport).not.toContain('### Fjernet')
  })
})

describe('den forrige importen i migrasjonene', () => {
  it('er den siste endringen av kilden, i migrasjonenes rekkefølge, også en tilbaketrekking', () => {
    const v2 = endret(MAL, (i) => (i.kilde.spc_versjon = 'Syntetisk versjon 2'))
    const siste = sisteEndringer([
      { navn: '20260102000000_b.sql', sql: importmigrasjon(v2) },
      { navn: '20260101000000_a.sql', sql: importmigrasjon(MAL) },
      { navn: '20260103000000_c.sql', sql: tilbaketrekkingsmigrasjon('syntetisk-annet', 'k', 'Syntetisk') },
    ])
    expect(siste.get(kildeid(MAL.stoff, MAL.kilde.nokkel))).toEqual({
      slag: 'import',
      stoff: MAL.stoff,
      nokkel: MAL.kilde.nokkel,
      import: v2,
      migrasjon: '20260102000000_b.sql',
    })
    expect(siste.get('syntetisk-annet--k')).toMatchObject({ slag: 'tilbaketrekking', migrasjon: '20260103000000_c.sql' })
  })
})

describe('importverktøyet', () => {
  const kjor = (...argumenter: string[]) => {
    try {
      const ut = execFileSync('npx', ['vite-node', 'scripts/lag-bivirkningsimport.ts', '--', ...argumenter], { encoding: 'utf8', stdio: 'pipe' })
      return { kode: 0, ut, feil: '' }
    } catch (e) {
      const f = e as { status: number; stdout: string; stderr: string }
      return { kode: f.status, ut: f.stdout, feil: f.stderr }
    }
  }
  const mappe = mkdtempSync(join(tmpdir(), 'bivirkninger-'))

  it('forhåndsviser uten å lage noe, mot den forrige fila når den oppgis', () => {
    const ny = join(mappe, 'ny.json')
    writeFileSync(ny, JSON.stringify(endret(MAL, (i) => (i.organsystemer[1]!.frekvenser[0]!.frekvens = 'sjeldne'))))
    const r = kjor(ny, '--mot', 'supabase/maler/bivirkningsimport.json')
    expect(r.kode).toBe(0)
    expect(r.ut).toContain('# Forhåndsvisning av bivirkningsimport')
    expect(r.ut).toContain('Sammenlignet med fila supabase/maler/bivirkningsimport.json.')
    expect(r.ut).toContain('### Endret frekvens (1)')
    expect(kjor('supabase/maler/bivirkningsimport.json').ut).toContain('**Førstegangsimport:**')
  }, 60_000)

  it('lager migrasjonen bare når fila er i orden', () => {
    const migrasjon = join(mappe, 'migrasjon.sql')
    const feil = join(mappe, 'feil.json')
    writeFileSync(feil, JSON.stringify(endret(MAL, (i) => ((i.organsystemer[0]!.frekvenser[0] as { frekvens: string }).frekvens = 'ofte'))))
    const r = kjor(feil, migrasjon)
    expect(r.kode).toBe(1)
    expect(r.feil).toContain('ukjent frekvenskategori «ofte»')
    expect(r.ut).toBe('')
    expect(existsSync(migrasjon)).toBe(false)
    expect(kjor('supabase/maler/bivirkningsimport.json', migrasjon).kode).toBe(0)
    expect(readFileSync(migrasjon, 'utf8')).toBe(importmigrasjon(MAL))
  }, 60_000)
})
