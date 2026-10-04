/**
 * De strukturerte bivirkningene (`src/bivirkninger/`, `docs/bivirkninger.md`):
 * de faste listene over frekvenser og organsystemer, importformatet og
 * kontrollen av det — i appen og i databasen, med de samme meldingene —,
 * importen inn i en ekte database bygd av migrasjonene, med sporbarheten og
 * erstatningen av en tidligere import, lesingen appen gjør, de to visningene
 * av det samme datasettet, og importfilene i repoet.
 *
 * Alle bivirkningene her er syntetiske. Ingen av dem er hentet fra en
 * preparatomtale.
 */
import type { PGlite } from '@electric-sql/pglite'
import { readdirSync, readFileSync } from 'node:fs'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  bivirkningsendringer,
  importfeil,
  kildeid,
  sisteEndringer,
  importmigrasjon,
  kontrollerImport,
  antallIImport,
  tilbaketrekkingsmigrasjon,
  IMPORTFORMAT,
  MAKSLENGDE,
  type Bivirkningsimport,
} from '../bivirkninger/import'
import { sammeInnhold } from '../bivirkninger/forhandsvisning'
import { lesBivirkningsdata } from '../bivirkninger/lesing'
import {
  FREKVENSER,
  ORGANSYSTEMER,
  grupper,
  gruppeid,
  gruppenavn,
  tabeller,
  undergruppeid,
  type Bivirkning,
  type Bivirkningsdata,
  type Bivirkningskilde,
  type Gruppe,
} from '../bivirkninger/modell'
import { BIVIRKNINGSPANEL, bivirkningsopphav, bivirkningsreferanse, bivirkningsreferanser, PREPARATOMTALE } from '../bivirkninger/referanser'
import {
  bivirkningstekster,
  byggBivirkningsvisning,
  oppsummerBivirkninger,
  visningForKort,
} from '../bivirkninger/stoffside'
import { IKONER } from '../components/ikon/register'
import { frekvensikon, organsystemikon } from '../components/stoffside/panelvisning'
import { kallSom } from './hjelp/fest'
import { faginnholdskall, feilFra, nyDatabase, opprettBruker } from './hjelp/testdatabase'

/** En import med én tabell, der organsystemene står rett i importen. */
type Enkeltabell = Extract<Bivirkningsimport, { tabeller?: undefined }>
/** En import med flere tabeller. */
type Flertabell = Extract<Bivirkningsimport, { organsystemer?: undefined }>

const lesMal = (navn: string): unknown => JSON.parse(readFileSync(new URL(`../../supabase/maler/${navn}`, import.meta.url), 'utf8'))
const MAL = lesMal('bivirkningsimport.json') as Enkeltabell
const TABELLMAL = lesMal('bivirkningsimport-tabeller.json') as Flertabell
const IMPORTMAPPE = new URL('../../supabase/import/bivirkninger/', import.meta.url)
const MIGRASJONSMAPPE = new URL('../../supabase/migrations/', import.meta.url)

/** En syntetisk import til fagsiden i testdatabasen, med endringer for en test. */
function lagImport(endre: (imp: Enkeltabell) => void = () => {}): Enkeltabell {
  const imp = structuredClone(MAL)
  imp.stoff = 'syntetisk-teststoff'
  endre(imp)
  return imp
}

/** En syntetisk import med flere tabeller til fagsiden i testdatabasen, med endringer for en test. */
function lagTabellimport(endre: (imp: Flertabell) => void = () => {}): Flertabell {
  const imp = structuredClone(TABELLMAL)
  imp.stoff = 'syntetisk-teststoff'
  endre(imp)
  return imp
}

/** En kopi av malen med én verdi byttet ut, satt med en sti som `['kilde', 'tittel']`. */
function medVerdi(sti: readonly (string | number)[], verdi: unknown, mal: Bivirkningsimport = MAL): unknown {
  const imp = structuredClone(mal) as unknown as Record<string | number, unknown>
  let her = imp
  for (const steg of sti.slice(0, -1)) her = her[steg] as Record<string | number, unknown>
  const siste = sti[sti.length - 1]!
  if (verdi === undefined) delete her[siste]
  else her[siste] = verdi
  return imp
}

/** Tilfellene som kontrolleres både i appen og i databasen, med feilene de skal gi. */
const FEILTILFELLER: { navn: string; data: unknown; feil: string[] }[] = [
  { navn: 'ikke et objekt', data: [], feil: ['Importen må være et JSON-objekt.'] },
  {
    navn: 'ukjent frekvens',
    data: medVerdi(['organsystemer', 0, 'frekvenser', 0, 'frekvens'], 'ofte'),
    feil: [
      'organsystemer[0].frekvenser[0].frekvens: ukjent frekvenskategori «ofte». Tillatte: svaert_vanlige, vanlige, mindre_vanlige, sjeldne, svaert_sjeldne, ikke_kjent.',
    ],
  },
  {
    navn: 'frekvens med feil skrivemåte',
    data: medVerdi(['organsystemer', 0, 'frekvenser', 0, 'frekvens'], 'Svært vanlige'),
    feil: [
      'organsystemer[0].frekvenser[0].frekvens: ukjent frekvenskategori «Svært vanlige». Tillatte: svaert_vanlige, vanlige, mindre_vanlige, sjeldne, svaert_sjeldne, ikke_kjent.',
    ],
  },
  {
    navn: 'manglende frekvens',
    data: medVerdi(['organsystemer', 0, 'frekvenser', 0, 'frekvens'], undefined),
    feil: ['organsystemer[0].frekvenser[0].frekvens: må fylles ut.'],
  },
  {
    navn: 'frekvens som tall',
    data: medVerdi(['organsystemer', 0, 'frekvenser', 0, 'frekvens'], 5),
    feil: [
      'organsystemer[0].frekvenser[0].frekvens: ukjent frekvenskategori 5. Tillatte: svaert_vanlige, vanlige, mindre_vanlige, sjeldne, svaert_sjeldne, ikke_kjent.',
    ],
  },
  {
    navn: 'ukjent organsystem',
    data: medVerdi(['organsystemer', 1, 'organsystem'], 'mage'),
    feil: ['organsystemer[1].organsystem: ukjent organsystem «mage». De tillatte kodene står i docs/bivirkninger.md.'],
  },
  {
    navn: 'organsystem med det norske navnet',
    data: medVerdi(['organsystemer', 1, 'organsystem'], 'Gastrointestinale sykdommer'),
    feil: [
      'organsystemer[1].organsystem: ukjent organsystem «Gastrointestinale sykdommer». De tillatte kodene står i docs/bivirkninger.md.',
    ],
  },
  {
    navn: 'organsystemet to ganger',
    data: medVerdi(['organsystemer', 1, 'organsystem'], 'nevrologiske'),
    feil: ['organsystemer[1].organsystem: «nevrologiske» står mer enn én gang; samle frekvensene under ett organsystem.'],
  },
  {
    navn: 'frekvensen to ganger under samme organsystem',
    data: medVerdi(['organsystemer', 0, 'frekvenser', 1, 'frekvens'], 'svaert_vanlige'),
    feil: ['organsystemer[0].frekvenser[1].frekvens: «svaert_vanlige» står mer enn én gang under samme organsystem.'],
  },
  {
    navn: 'samme bivirkning to ganger i en kombinasjon',
    data: medVerdi(['organsystemer', 0, 'frekvenser', 1, 'bivirkninger', 1], { tekst: 'SYNTETISK bivirkning b' }),
    feil: [
      'organsystemer[0].frekvenser[1].bivirkninger[1]: «SYNTETISK bivirkning b» står mer enn én gang i samme kombinasjon av organsystem og frekvens.',
    ],
  },
  {
    navn: 'ukjente felt på alle nivåer',
    data: (() => {
      const d = structuredClone(MAL) as unknown as Record<string, unknown>
      d.stof = 'x'
      ;(d.kilde as Record<string, unknown>).versjon = '1'
      ;(d.organsystemer as Record<string, unknown>[])[0]!.navn = 'x'
      ;((d.organsystemer as { frekvenser: Record<string, unknown>[] }[])[0]!.frekvenser[0]!).antall = 1
      ;((d.organsystemer as { frekvenser: { bivirkninger: unknown[] }[] }[])[0]!.frekvenser[1]!.bivirkninger[1] as Record<string, unknown>).merknad = 'x'
      return d
    })(),
    feil: [
      'stof: ukjent felt. Tillatte felt: format, stoff, kilde, organsystemer, tabeller.',
      'kilde.versjon: ukjent felt. Tillatte felt: nokkel, type, tittel, preparat, innehaver, spc_versjon, revisjonsdato, lenke, kontrollert, kontrollert_av, importert_av, merknad.',
      'organsystemer[0].navn: ukjent felt. Tillatte felt: organsystem, frekvenser.',
      'organsystemer[0].frekvenser[0].antall: ukjent felt. Tillatte felt: frekvens, bivirkninger.',
      'organsystemer[0].frekvenser[1].bivirkninger[1].merknad: ukjent felt. Tillatte felt: tekst, fotnote.',
    ],
  },
  {
    navn: 'feil format og stoff',
    data: { ...structuredClone(MAL), format: 'ousfar-bivirkninger/2', stoff: 'Syntetisk eksempel' },
    feil: [
      `format: må være «${IMPORTFORMAT}».`,
      'stoff: må være nøkkelen til en fagside (små bokstaver a–z, tall og enkle bindestreker).',
    ],
  },
  {
    navn: 'kilden mangler det påkrevde',
    data: medVerdi(['kilde'], { nokkel: 'Syntetisk' }),
    feil: [
      'kilde.nokkel: må bestå av små bokstaver a–z, tall og enkle bindestreker (høyst 100 tegn).',
      'kilde.type: må fylles ut.',
      'kilde.tittel: må fylles ut.',
      'kilde.importert_av: må fylles ut.',
    ],
  },
  { navn: 'ukjent kildetype', data: medVerdi(['kilde', 'type'], 'felleskatalogen'), feil: ['kilde.type: ukjent kildetype «felleskatalogen». Tillatte: spc.'] },
  {
    navn: 'datoer som ikke finnes',
    data: medVerdi(['kilde'], { ...MAL.kilde, revisjonsdato: '2026-02-30', kontrollert: '1.2.2026' }),
    feil: ['kilde.revisjonsdato: må være en dato på formen ÅÅÅÅ-MM-DD.', 'kilde.kontrollert: må være en dato på formen ÅÅÅÅ-MM-DD.'],
  },
  { navn: 'lenke uten protokoll', data: medVerdi(['kilde', 'lenke'], 'example.org/spc'), feil: ['kilde.lenke: må begynne med http:// eller https:// og kan ikke ha mellomrom.'] },
  { navn: 'tom valgfri tekst', data: medVerdi(['kilde', 'preparat'], ''), feil: ['kilde.preparat: kan ikke være tom tekst; utelat feltet i stedet.'] },
  { navn: 'tekst som ikke er tekst', data: medVerdi(['kilde', 'innehaver'], 12), feil: ['kilde.innehaver: må være tekst.'] },
  {
    navn: 'mellomrom rundt en bivirkning',
    data: medVerdi(['organsystemer', 0, 'frekvenser', 0, 'bivirkninger', 0], ' Syntetisk bivirkning A'),
    feil: ['organsystemer[0].frekvenser[0].bivirkninger[0]: har mellomrom i begynnelsen eller slutten.'],
  },
  {
    navn: 'linjeskift i en fotnote',
    data: medVerdi(['organsystemer', 0, 'frekvenser', 1, 'bivirkninger', 1, 'fotnote'], 'Syntetisk\nfotnote'),
    feil: ['organsystemer[0].frekvenser[1].bivirkninger[1].fotnote: kan ikke ha linjeskift eller tabulator.'],
  },
  {
    navn: 'for lang bivirkning',
    data: medVerdi(['organsystemer', 0, 'frekvenser', 0, 'bivirkninger', 0], 'æ'.repeat(MAKSLENGDE.tekst + 1)),
    feil: [`organsystemer[0].frekvenser[0].bivirkninger[0]: er lengre enn ${MAKSLENGDE.tekst} tegn.`],
  },
  {
    navn: 'en bivirkning som verken er tekst eller objekt',
    data: medVerdi(['organsystemer', 0, 'frekvenser', 0, 'bivirkninger', 0], 7),
    feil: ['organsystemer[0].frekvenser[0].bivirkninger[0]: må være tekst eller et objekt med tekst og fotnote.'],
  },
  {
    navn: 'tomme lister',
    data: (() => {
      const d = structuredClone(MAL)
      d.organsystemer[0]!.frekvenser[0]!.bivirkninger = []
      d.organsystemer[1]!.frekvenser = []
      return d
    })(),
    feil: [
      'organsystemer[0].frekvenser[0].bivirkninger: må være en liste med minst én bivirkning.',
      'organsystemer[1].frekvenser: må være en liste med minst én frekvens.',
    ],
  },
  { navn: 'ingen organsystemer', data: medVerdi(['organsystemer'], []), feil: ['organsystemer: må være en liste med minst ett organsystem.'] },
  // Flere tabeller.
  {
    navn: 'både organsystemer og tabeller',
    data: { ...structuredClone(TABELLMAL), organsystemer: structuredClone(MAL.organsystemer) },
    feil: ['organsystemer: utelat feltet når importen har tabeller; organsystemene står i hver tabell.'],
  },
  { navn: 'ingen tabeller', data: medVerdi(['tabeller'], [], TABELLMAL), feil: ['tabeller: må være en liste med minst én tabell.'] },
  { navn: 'tabeller som ikke er en liste', data: medVerdi(['tabeller'], {}, TABELLMAL), feil: ['tabeller: må være en liste med minst én tabell.'] },
  { navn: 'en tabell som ikke er et objekt', data: medVerdi(['tabeller', 0], 'Syntetisk', TABELLMAL), feil: ['tabeller[0]: må være et objekt.'] },
  {
    navn: 'samme tabellnøkkel to ganger',
    data: medVerdi(['tabeller', 1, 'nokkel'], 'syntetisk-indikasjon-per-pasient', TABELLMAL),
    feil: ['tabeller[1].nokkel: «syntetisk-indikasjon-per-pasient» står mer enn én gang; hver tabell har sin egen nøkkel.'],
  },
  {
    navn: 'en tabell uten navn, med feil nøkkel og tomt frekvensgrunnlag',
    data: medVerdi(['tabeller', 0], { nokkel: 'Per pasient', frekvensgrunnlag: '', organsystemer: structuredClone(MAL.organsystemer) }, TABELLMAL),
    feil: [
      'tabeller[0].nokkel: må bestå av små bokstaver a–z, tall og enkle bindestreker (høyst 100 tegn).',
      'tabeller[0].navn: må fylles ut.',
      'tabeller[0].frekvensgrunnlag: kan ikke være tom tekst; utelat feltet i stedet.',
    ],
  },
  {
    navn: 'et ukjent felt og et ukjent organsystem i en tabell',
    data: (() => {
      const d = structuredClone(TABELLMAL) as unknown as { tabeller: Record<string, unknown>[] }
      d.tabeller[1]!.indikasjon = 'Syntetisk'
      ;(d.tabeller[1]!.organsystemer as Record<string, unknown>[])[0]!.organsystem = 'mage'
      return d
    })(),
    feil: [
      'tabeller[1].indikasjon: ukjent felt. Tillatte felt: nokkel, navn, frekvensgrunnlag, merknad, organsystemer.',
      'tabeller[1].organsystemer[0].organsystem: ukjent organsystem «mage». De tillatte kodene står i docs/bivirkninger.md.',
    ],
  },
  {
    navn: 'en tabell uten organsystemer',
    data: medVerdi(['tabeller', 0, 'organsystemer'], undefined, TABELLMAL),
    feil: ['tabeller[0].organsystemer: må være en liste med minst ett organsystem.'],
  },
  {
    navn: 'en for lang bivirkning i en tabell',
    data: medVerdi(['tabeller', 1, 'organsystemer', 0, 'frekvenser', 0, 'bivirkninger', 0], 'æ'.repeat(MAKSLENGDE.tekst + 1), TABELLMAL),
    feil: [`tabeller[1].organsystemer[0].frekvenser[0].bivirkninger[0]: er lengre enn ${MAKSLENGDE.tekst} tegn.`],
  },
]

/* --- De faste listene ----------------------------------------------------- */

describe('frekvensene og organsystemene', () => {
  it('har frekvensene fra den høyeste til «Ikke kjent», med færre prikker for hver', () => {
    expect(FREKVENSER.map((f) => f.navn)).toEqual(['Svært vanlige', 'Vanlige', 'Mindre vanlige', 'Sjeldne', 'Svært sjeldne', 'Ikke kjent'])
    expect(FREKVENSER.map((f) => f.prikker)).toEqual([5, 4, 3, 2, 1, null])
  })

  it('har alle de 27 organklassesystemene i MedDRA, hver med egen kode', () => {
    expect(ORGANSYSTEMER).toHaveLength(27)
    expect(new Set(ORGANSYSTEMER.map((o) => o.kode)).size).toBe(27)
    expect(new Set(ORGANSYSTEMER.map((o) => o.meddra)).size).toBe(27)
    expect(new Set(ORGANSYSTEMER.map((o) => o.navn)).size).toBe(27)
  })

  it('har et ikon i registeret for hver frekvens og hvert organsystem, og et eget for hver frekvens', () => {
    for (const f of FREKVENSER) expect(IKONER, f.kode).toHaveProperty(frekvensikon(f.kode))
    for (const o of ORGANSYSTEMER) expect(IKONER, o.kode).toHaveProperty(organsystemikon(o.kode))
    expect(new Set(FREKVENSER.map((f) => frekvensikon(f.kode))).size).toBe(FREKVENSER.length)
    expect(new Set(ORGANSYSTEMER.map((o) => organsystemikon(o.kode))).size).toBe(ORGANSYSTEMER.length)
  })
})

describe('dokumentasjonen', () => {
  const docs = readFileSync(new URL('../../docs/bivirkninger.md', import.meta.url), 'utf8')
  const prikker = (n: number | null) => (n === null ? '?' : '●'.repeat(n) + '○'.repeat(5 - n))

  it('har frekvensene og ikonene deres, som i appen', () => {
    for (const f of FREKVENSER) {
      expect(docs).toContain(`| \`${f.kode}\` | ${f.navn} | ${f.definisjon} | ${prikker(f.prikker)} | \`${frekvensikon(f.kode)}\` |`)
    }
  })

  it('har organsystemene med MedDRA og ikonene deres, i samme rekkefølge som i appen', () => {
    const rader = ORGANSYSTEMER.map((o) => `| \`${o.kode}\` | ${o.navn} | ${o.engelsk} | ${o.meddra} | \`${organsystemikon(o.kode)}\` |`)
    for (const r of rader) expect(docs).toContain(r)
    expect(rader.map((r) => docs.indexOf(r))).toEqual(rader.map((r) => docs.indexOf(r)).sort((a, b) => a - b))
  })
})

/* --- Importformatet ------------------------------------------------------- */

describe('importformatet', () => {
  it('godtar malen, som er syntetisk', () => {
    const kontroll = kontrollerImport(MAL)
    expect(kontroll.ok).toBe(true)
    expect(antallIImport(MAL)).toBe(4)
    expect(MAL.stoff).toMatch(/^syntetisk/)
    // Hver bivirkning i malen sier selv at den er syntetisk.
    for (const o of MAL.organsystemer) for (const f of o.frekvenser) for (const b of f.bivirkninger) expect(typeof b === 'string' ? b : b.tekst).toMatch(/^Syntetisk/)
  })

  it('godtar malen for en preparatomtale med flere tabeller, som også er syntetisk', () => {
    expect(kontrollerImport(TABELLMAL).ok).toBe(true)
    expect(antallIImport(TABELLMAL)).toBe(2)
    expect(TABELLMAL.stoff).toMatch(/^syntetisk/)
    for (const t of TABELLMAL.tabeller)
      for (const o of t.organsystemer) for (const f of o.frekvenser) for (const b of f.bivirkninger) expect(typeof b === 'string' ? b : b.tekst).toMatch(/^Syntetisk/)
    // Et tomt organsystemer-felt ved siden av tabellene er det samme som at det mangler.
    expect(importfeil({ ...TABELLMAL, organsystemer: null })).toEqual([])
  })

  it('godtar valgfrie felt som er utelatt eller null, og en SPC uten noen av frekvensene', () => {
    const imp = lagImport((i) => {
      i.kilde = { nokkel: 'kort', type: 'spc', tittel: 'Syntetisk', importert_av: 'Syntetisk', preparat: null, lenke: null }
      i.organsystemer = [{ organsystem: 'hud', frekvenser: [{ frekvens: 'sjeldne', bivirkninger: ['Syntetisk'] }] }]
    })
    expect(importfeil(imp)).toEqual([])
  })

  it.each(FEILTILFELLER)('gir en tydelig feil med stedet i fila: $navn', ({ data, feil }) => {
    expect(importfeil(data)).toEqual(feil)
    expect(kontrollerImport(data)).toEqual({ ok: false, feil })
  })

  it('skriver en migrasjon som tar med importen uendret, også med dollartegn i teksten', () => {
    const imp = lagImport((i) => {
      i.organsystemer[0]!.frekvenser[0]!.bivirkninger = ['Syntetisk $import$ bivirkning']
    })
    const sql = importmigrasjon(imp)
    expect(sql).not.toMatch(/\n$/)
    expect(bivirkningsendringer(sql)).toEqual([{ slag: 'import', stoff: imp.stoff, nokkel: imp.kilde.nokkel, import: imp }])
  })

  it('skriver en tilbaketrekking som kan leses tilbake', () => {
    const sql = tilbaketrekkingsmigrasjon('syntetisk-teststoff', 'syntetisk-preparat-spc', "Syntetisk  begrunnelse med 'sitat'")
    expect(sql).toContain("'Syntetisk begrunnelse med ''sitat'''")
    expect(bivirkningsendringer(sql)).toEqual([{ slag: 'tilbaketrekking', stoff: 'syntetisk-teststoff', nokkel: 'syntetisk-preparat-spc' }])
  })
})

/* --- Databasen ------------------------------------------------------------ */

describe('bivirkningene i databasen', () => {
  let db: PGlite
  const innlogget = () => kallSom(db, 'authenticated')
  const les = async (stoff = 'syntetisk-teststoff') => lesBivirkningsdata(await innlogget()('les_bivirkninger', { stoff }))
  const importer = async (imp: unknown) =>
    (await db.query<{ id: string }>('select bivirkninger.importer($1::jsonb) as id', [JSON.stringify(imp)])).rows[0]!.id
  const antall = async (sql: string) => Number((await db.query<{ n: number }>(sql)).rows[0]!.n)

  beforeAll(async () => {
    db = await nyDatabase()
    const admin = await opprettBruker(db, { brukernavn: 'syntetisk', fornavn: 'Syntetisk', etternavn: 'Redaktør', rolle: 'admin' })
    const kall = faginnholdskall(db, admin)
    await kall.opprett('infoside', { navn: 'Syntetisk teststoff', slug: 'syntetisk-teststoff' })
    await kall.opprett('infoside', { navn: 'Syntetisk annet stoff', slug: 'syntetisk-annet' })
  }, 120_000)

  it('har de samme frekvensene og organsystemene, i samme rekkefølge, som appen', async () => {
    const frekvenser = (await db.query('select kode, navn, definisjon from bivirkninger.frekvenser order by rang')).rows
    expect(frekvenser).toEqual(FREKVENSER.map(({ kode, navn, definisjon }) => ({ kode, navn, definisjon })))
    const organsystemer = (await db.query('select kode, navn, engelsk, meddra_kode from bivirkninger.organsystemer order by rang')).rows
    expect(organsystemer).toEqual(ORGANSYSTEMER.map(({ kode, navn, engelsk, meddra }) => ({ kode, navn, engelsk, meddra_kode: meddra })))
  })

  it.each(FEILTILFELLER)('gir de samme feilene som appen: $navn', async ({ data, feil }) => {
    const { rows } = await db.query<{ feil: string[] }>('select bivirkninger.importfeil($1::jsonb) as feil', [JSON.stringify(data)])
    expect(rows[0]!.feil).toEqual(feil)
  })

  it.each([
    ['malen', MAL],
    ['malen med flere tabeller', TABELLMAL],
    ['tabeller med et tomt organsystemer-felt', { ...TABELLMAL, organsystemer: null }],
  ])('godtar det appen godtar: %s', async (_, data) => {
    const { rows } = await db.query<{ feil: string[] }>('select bivirkninger.importfeil($1::jsonb) as feil', [JSON.stringify(data)])
    expect(rows[0]!.feil).toEqual([])
  })

  it('avviser en import med feil, med alle feilene, og legger ingenting inn', async () => {
    const fu = await feilFra(() => importer(medVerdi(['organsystemer', 1, 'organsystem'], 'mage')))
    expect(fu?.code).toBe('22023')
    expect(fu?.message).toBe(
      'Bivirkningsimporten har feil:\norgansystemer[1].organsystem: ukjent organsystem «mage». De tillatte kodene står i docs/bivirkninger.md.',
    )
    expect(await antall('select count(*) as n from bivirkninger.kilder')).toBe(0)
  })

  it('avviser en import til en fagside som ikke finnes', async () => {
    const fu = await feilFra(() => importer(MAL))
    expect(fu?.message).toBe('Bivirkningsimporten har feil:\nstoff: fant ingen fagside med nøkkelen «syntetisk-eksempel».')
  })

  it('slipper ikke en ukjent frekvens eller et ukjent organsystem inn i tabellen utenom importen', async () => {
    const kilde = await importer(lagImport((i) => (i.kilde.nokkel = 'midlertidig')))
    for (const [organsystem, frekvens] of [['mage', 'vanlige'], ['hud', 'ofte']]) {
      const fu = await feilFra(() =>
        db.query(
          `insert into bivirkninger.bivirkninger (kilde, organsystem, frekvens, tekst, posisjon) values ($1, $2, $3, 'Syntetisk', 99)`,
          [kilde, organsystem, frekvens],
        ),
      )
      expect(fu?.code).toBe('23503')
    }
    await db.query(`select bivirkninger.trekk_tilbake('syntetisk-teststoff', 'midlertidig', 'Syntetisk test')`)
  })

  it('legger inn bivirkningene med kilden og hele sporbarheten', async () => {
    const id = await importer(lagImport())
    const kilde = (await db.query<Record<string, unknown>>('select * from bivirkninger.kilder where id = $1', [id])).rows[0]!
    expect(kilde).toMatchObject({
      nokkel: 'syntetisk-preparat-spc',
      type: 'spc',
      tittel: MAL.kilde.tittel,
      preparat: MAL.kilde.preparat,
      innehaver: MAL.kilde.innehaver,
      spc_versjon: MAL.kilde.spc_versjon,
      lenke: MAL.kilde.lenke,
      kontrollert_av: MAL.kilde.kontrollert_av,
      importert_av: MAL.kilde.importert_av,
      merknad: MAL.kilde.merknad,
      erstattet_av: null,
      trukket_kl: null,
    })
    expect((kilde.revisjonsdato as Date).toISOString().slice(0, 10)).toBe('2026-01-31')
    expect((kilde.kontrollert as Date).toISOString().slice(0, 10)).toBe('2026-02-01')
    expect(kilde.importen).toEqual(lagImport())

    const data = await les()
    expect(data.kilder).toHaveLength(1)
    expect(data.kilder[0]).toMatchObject({ id, nokkel: 'syntetisk-preparat-spc', revisjonsdato: '2026-01-31', kontrollert: '2026-02-01' })
    expect(data.bivirkninger.map((b) => [b.organsystem, b.frekvens, b.tekst, b.fotnote])).toEqual([
      ['nevrologiske', 'svaert_vanlige', 'Syntetisk bivirkning A', null],
      ['nevrologiske', 'mindre_vanlige', 'Syntetisk bivirkning B', null],
      ['nevrologiske', 'mindre_vanlige', 'Syntetisk bivirkning C', 'Syntetisk fotnote slik den står i preparatomtalen.'],
      ['gastrointestinale', 'ikke_kjent', 'Syntetisk bivirkning D', null],
    ])
  })

  it('gjør ingenting når den samme importen kommer igjen, også med en annen som importerer', async () => {
    const forrige = (await les()).kilder[0]!.id
    const rader = await antall('select count(*) as n from bivirkninger.bivirkninger')
    expect(await importer(lagImport((i) => (i.kilde.importert_av = 'Syntetisk annen')))).toBe(forrige)
    expect(await antall('select count(*) as n from bivirkninger.bivirkninger')).toBe(rader)
  })

  it('erstatter en tidligere import av samme kilde uten duplikater, og beholder den som historikk', async () => {
    const forrige = (await les()).kilder[0]!.id
    const ny = await importer(
      lagImport((i) => {
        i.kilde.spc_versjon = 'Syntetisk versjon 2'
        i.organsystemer = [{ organsystem: 'hud', frekvenser: [{ frekvens: 'vanlige', bivirkninger: ['Syntetisk bivirkning E'] }] }]
      }),
    )
    expect(ny).not.toBe(forrige)
    const data = await les()
    expect(data.kilder.map((k) => [k.id, k.spc_versjon])).toEqual([[ny, 'Syntetisk versjon 2']])
    expect(data.bivirkninger.map((b) => b.tekst)).toEqual(['Syntetisk bivirkning E'])
    const historikk = (await db.query<{ erstattet_av: string | null }>('select erstattet_av from bivirkninger.kilder where id = $1', [forrige])).rows
    expect(historikk).toEqual([{ erstattet_av: ny }])
    // Ingen rad står uten en kilde, og bare én import av kilden gjelder.
    expect(
      await antall(`select count(*) as n from bivirkninger.kilder where nokkel = 'syntetisk-preparat-spc' and erstattet_av is null and trukket_kl is null`),
    ).toBe(1)
    expect(await antall('select count(*) as n from bivirkninger.bivirkninger b left join bivirkninger.kilder k on k.id = b.kilde where k.id is null')).toBe(0)
  })

  it('viser flere preparatomtaler for samme fagside side om side, og holder sidene fra hverandre', async () => {
    await importer(
      lagImport((i) => {
        i.kilde.nokkel = 'syntetisk-depot-spc'
        i.kilde.tittel = 'Preparatomtale (SPC) for Syntetisk depot'
        i.organsystemer = [{ organsystem: 'hud', frekvenser: [{ frekvens: 'vanlige', bivirkninger: ['Syntetisk bivirkning F'] }] }]
      }),
    )
    await importer(lagImport((i) => (i.stoff = 'syntetisk-annet')))
    const data = await les()
    expect(data.kilder.map((k) => k.nokkel)).toEqual(['syntetisk-preparat-spc', 'syntetisk-depot-spc'])
    expect(data.bivirkninger.map((b) => b.tekst)).toEqual(['Syntetisk bivirkning E', 'Syntetisk bivirkning F'])
    expect(byggBivirkningsvisning(data).flereKilder).toBe(true)
    expect((await les('syntetisk-annet')).bivirkninger).toHaveLength(4)
  })

  it('trekker tilbake en kilde, så den ikke vises, og bare med en begrunnelse', async () => {
    expect((await feilFra(() => db.query(`select bivirkninger.trekk_tilbake('syntetisk-teststoff', 'syntetisk-depot-spc', ' ')`)))?.code).toBe('22023')
    await db.exec(tilbaketrekkingsmigrasjon('syntetisk-teststoff', 'syntetisk-depot-spc', 'Syntetisk: preparatet er avregistrert'))
    expect((await les()).kilder.map((k) => k.nokkel)).toEqual(['syntetisk-preparat-spc'])
    const fu = await feilFra(() => db.query(`select bivirkninger.trekk_tilbake('syntetisk-teststoff', 'syntetisk-depot-spc', 'Igjen')`))
    expect(fu?.code).toBe('PT404')
  })

  it('kjører migrasjonen importskriptet lager', async () => {
    await db.exec(importmigrasjon(lagImport((i) => (i.kilde.nokkel = 'fra-migrasjon'))))
    expect((await les()).kilder.map((k) => k.nokkel)).toContain('fra-migrasjon')
  })

  it('legger inn en preparatomtale med flere tabeller hver for seg, og blander aldri radene', async () => {
    const id = await importer(lagTabellimport())
    const data = await les()
    const kilden = data.kilder.find((k) => k.id === id)!
    expect(kilden.kontekster).toEqual([
      { nokkel: 'syntetisk-indikasjon-per-pasient', navn: 'Syntetisk indikasjon A', frekvensgrunnlag: 'per pasient', merknad: null },
      { nokkel: 'syntetisk-indikasjon-per-infusjon', navn: 'Syntetisk indikasjon A', frekvensgrunnlag: 'per infusjon', merknad: 'Syntetisk merknad til tabellen.' },
    ])
    // Den samme teksten i to tabeller er to rader, hver med sin tabell og sin frekvens.
    expect(data.bivirkninger.filter((b) => b.kilde === id).map((b) => [b.kontekst, b.organsystem, b.frekvens, b.tekst])).toEqual([
      ['syntetisk-indikasjon-per-pasient', 'generelle', 'vanlige', 'Syntetisk bivirkning E'],
      ['syntetisk-indikasjon-per-infusjon', 'generelle', 'mindre_vanlige', 'Syntetisk bivirkning E'],
    ])
    // De andre kildene på siden har én tabell og ingen kontekst.
    expect(data.kilder.filter((k) => k.id !== id).every((k) => k.kontekster.length === 0)).toBe(true)
    expect(data.bivirkninger.filter((b) => b.kilde !== id).every((b) => b.kontekst === null)).toBe(true)
    const visning = byggBivirkningsvisning(data)
    const tabellene = visning.tabeller.filter((t) => t.kilde.id === id)
    expect(tabellene.map((t) => [t.kontekst?.frekvensgrunnlag, t.bivirkninger.length])).toEqual([
      ['per pasient', 1],
      ['per infusjon', 1],
    ])
  })

  it('erstatter tabellene med kilden, og lar ikke en rad peke på en tabell i en annen kilde', async () => {
    const forrige = (await les()).kilder.find((k) => k.nokkel === TABELLMAL.kilde.nokkel)!.id
    expect(await importer(lagTabellimport())).toBe(forrige)
    const ny = await importer(lagTabellimport((i) => (i.tabeller[1]!.frekvensgrunnlag = 'per syntetisk dose')))
    const data = await les()
    expect(data.kilder.find((k) => k.id === ny)!.kontekster.map((t) => t.frekvensgrunnlag)).toEqual(['per pasient', 'per syntetisk dose'])
    expect(data.kilder.some((k) => k.id === forrige)).toBe(false)
    // De gamle tabellene står igjen som historikk med den gamle kilden.
    expect(await antall(`select count(*) as n from bivirkninger.kontekster where kilde = '${forrige}'`)).toBe(2)
    const fremmed = (await db.query<{ id: string }>(`select id::text from bivirkninger.kontekster where kilde = '${forrige}' limit 1`)).rows[0]!.id
    const fu = await feilFra(() =>
      db.query(
        `insert into bivirkninger.bivirkninger (kilde, kontekst, organsystem, frekvens, tekst, posisjon) values ($1, $2, 'hud', 'vanlige', 'Syntetisk', 99)`,
        [ny, fremmed],
      ),
    )
    expect(fu?.code).toBe('23503')
    await db.query(`select bivirkninger.trekk_tilbake('syntetisk-teststoff', $1, 'Syntetisk test')`, [TABELLMAL.kilde.nokkel])
  })

  it('lar bare innloggede lese, og ingen av API-rollene røre tabellene eller importen', async () => {
    expect(await feilFra(() => kallSom(db, 'anon')('les_bivirkninger', { stoff: 'syntetisk-teststoff' }))).not.toBeNull()
    for (const rolle of ['anon', 'authenticated'] as const) {
      for (const sql of ['select * from bivirkninger.kilder', `select bivirkninger.importer('{}'::jsonb)`]) {
        const fu = await feilFra(() =>
          db.transaction(async (tx) => {
            await tx.query(`select set_config('role', $1, true)`, [rolle])
            await tx.query(sql)
          }),
        )
        expect(fu?.code, `${rolle}: ${sql}`).toBe('42501')
      }
    }
    expect(await innlogget()('les_bivirkninger', { stoff: 'finnes-ikke' })).toEqual({ kilder: [], bivirkninger: [] })
  })

  it('ser de samme importene som like som forhåndsvisningen gjør', async () => {
    const grunn = lagImport((i) => (i.kilde.nokkel = 'syntetisk-likhet'))
    const varianter: Bivirkningsimport[] = [
      grunn,
      lagImport((i) => Object.assign(i.kilde, { nokkel: 'syntetisk-likhet', importert_av: 'Syntetisk annen' })),
      { organsystemer: grunn.organsystemer, kilde: grunn.kilde, stoff: grunn.stoff, format: grunn.format },
      lagImport((i) => Object.assign(i.kilde, { nokkel: 'syntetisk-likhet', lenke: null })),
      lagImport((i) => Object.assign(i.kilde, { nokkel: 'syntetisk-likhet', lenke: null, spc_versjon: 'Syntetisk versjon 2' })),
      lagImport((i) => {
        Object.assign(i.kilde, { nokkel: 'syntetisk-likhet', lenke: null, spc_versjon: 'Syntetisk versjon 2' })
        i.organsystemer.reverse()
      }),
    ]
    let forrige = await importer(varianter[0])
    for (const [n, ny] of varianter.entries()) {
      if (n === 0) continue
      const id = await importer(ny)
      expect(id === forrige, `variant ${n}`).toBe(sammeInnhold(varianter[n - 1]!, ny))
      forrige = id
    }
  })
})

/* --- Lesingen ------------------------------------------------------------- */

describe('lesingen', () => {
  it('hopper over rader med ukjente koder eller fra en kilde eller tabell som ikke er med', () => {
    const data = lesBivirkningsdata({
      kilder: [
        {
          id: 'k1',
          nokkel: 'a',
          type: 'spc',
          tittel: 'Syntetisk',
          importert_kl: '2026-01-01T00:00:00Z',
          kontekster: [{ nokkel: 't1', navn: 'Syntetisk tabell', frekvensgrunnlag: 'per pasient' }, { nokkel: 't2' }],
        },
        { id: 'k2', type: 'annet', tittel: 'X' },
      ],
      bivirkninger: [
        { kilde: 'k1', organsystem: 'hud', frekvens: 'vanlige', tekst: 'Syntetisk A', posisjon: 0 },
        { kilde: 'k1', organsystem: 'mage', frekvens: 'vanlige', tekst: 'Syntetisk B', posisjon: 1 },
        { kilde: 'k1', organsystem: 'hud', frekvens: 'ofte', tekst: 'Syntetisk C', posisjon: 2 },
        { kilde: 'k2', organsystem: 'hud', frekvens: 'vanlige', tekst: 'Syntetisk D', posisjon: 0 },
        { kilde: 'k1', kontekst: 't1', organsystem: 'hud', frekvens: 'vanlige', tekst: 'Syntetisk E', posisjon: 0 },
        { kilde: 'k1', kontekst: 't2', organsystem: 'hud', frekvens: 'vanlige', tekst: 'Syntetisk F', posisjon: 0 },
      ],
    })
    expect(data.kilder.map((k) => k.id)).toEqual(['k1'])
    expect(data.kilder[0]!.kontekster).toEqual([{ nokkel: 't1', navn: 'Syntetisk tabell', frekvensgrunnlag: 'per pasient', merknad: null }])
    expect(data.bivirkninger.map((b) => [b.kontekst, b.tekst])).toEqual([
      [null, 'Syntetisk A'],
      ['t1', 'Syntetisk E'],
    ])
    expect(lesBivirkningsdata(null)).toEqual({ kilder: [], bivirkninger: [] })
  })
})

/* --- Visningene ----------------------------------------------------------- */

function kilde(id: string, endringer: Partial<Bivirkningskilde> = {}): Bivirkningskilde {
  return {
    id,
    nokkel: id,
    type: 'spc',
    tittel: `Syntetisk preparatomtale ${id}`,
    preparat: null,
    innehaver: null,
    spc_versjon: null,
    revisjonsdato: null,
    lenke: null,
    kontrollert: null,
    kontrollert_av: null,
    merknad: null,
    importert_kl: '2026-03-01T10:00:00Z',
    importert_av: 'Syntetisk',
    kontekster: [],
    ...endringer,
  }
}

let plass = 0
function rad(organsystem: Bivirkning['organsystem'], frekvens: Bivirkning['frekvens'], tekst: string, ekstra: Partial<Bivirkning> = {}): Bivirkning {
  return { kilde: 'k1', kontekst: null, organsystem, frekvens, tekst, fotnote: null, posisjon: plass++, ...ekstra }
}

const SYNTETISK: Bivirkningsdata = {
  kilder: [kilde('k1')],
  bivirkninger: [
    rad('hud', 'sjeldne', 'Syntetisk hud sjelden'),
    rad('nevrologiske', 'vanlige', 'Syntetisk nevro vanlig 1'),
    rad('nevrologiske', 'vanlige', 'Syntetisk nevro vanlig 2'),
    rad('nevrologiske', 'ikke_kjent', 'Syntetisk nevro ukjent'),
    rad('hjerte', 'vanlige', 'Syntetisk hjerte vanlig'),
    rad('hud', 'svaert_vanlige', 'Syntetisk hud svært vanlig', { fotnote: 'Syntetisk fotnote' }),
  ],
}

const navnene = (grupper: Gruppe[]) => grupper.map((g) => [gruppenavn(g.nokkel), g.undergrupper.map((u) => gruppenavn(u.nokkel))])
const radene = (grupper: Gruppe[]) => grupper.flatMap((g) => g.undergrupper.flatMap((u) => u.bivirkninger))

describe('visningene av det samme datasettet', () => {
  it('grupperer etter frekvens fra den høyeste, med organsystemene i fast rekkefølge under', () => {
    expect(navnene(grupper(SYNTETISK.bivirkninger, 'frekvens'))).toEqual([
      ['Svært vanlige', ['Hud- og underhudssykdommer']],
      ['Vanlige', ['Nevrologiske sykdommer', 'Hjertesykdommer']],
      ['Sjeldne', ['Hud- og underhudssykdommer']],
      ['Ikke kjent', ['Nevrologiske sykdommer']],
    ])
  })

  it('grupperer etter organsystem i fast rekkefølge, med frekvensene fra den høyeste under', () => {
    expect(navnene(grupper(SYNTETISK.bivirkninger, 'organsystem'))).toEqual([
      ['Nevrologiske sykdommer', ['Vanlige', 'Ikke kjent']],
      ['Hjertesykdommer', ['Vanlige']],
      ['Hud- og underhudssykdommer', ['Svært vanlige', 'Sjeldne']],
    ])
  })

  it('viser ingen tom gruppe eller kombinasjon', () => {
    for (const visning of ['frekvens', 'organsystem'] as const) {
      for (const g of grupper(SYNTETISK.bivirkninger, visning)) {
        expect(g.undergrupper.length).toBeGreaterThan(0)
        for (const u of g.undergrupper) expect(u.bivirkninger.length).toBeGreaterThan(0)
      }
    }
    expect(grupper([], 'frekvens')).toEqual([])
    // «Mindre vanlige» og «Svært sjeldne» har ingen bivirkninger her og finnes ikke.
    expect(grupper(SYNTETISK.bivirkninger, 'frekvens').map((g) => g.nokkel.kode)).not.toContain('mindre_vanlige')
  })

  it('bruker de samme radene i begge visningene, hver nøyaktig én gang', () => {
    const [tabell] = byggBivirkningsvisning(SYNTETISK).tabeller
    const sorter = (r: Bivirkning[]) => [...r].sort((a, b) => a.posisjon - b.posisjon)
    expect(sorter(radene(tabell!.grupper.frekvens))).toEqual(SYNTETISK.bivirkninger)
    expect(sorter(radene(tabell!.grupper.organsystem))).toEqual(SYNTETISK.bivirkninger)
    // Det er de samme objektene, ikke kopier.
    expect(radene(tabell!.grupper.frekvens).every((r) => SYNTETISK.bivirkninger.includes(r))).toBe(true)
  })

  it('holder rekkefølgen fra preparatomtalen innenfor en kombinasjon, kilde for kilde', () => {
    const data: Bivirkning[] = [
      rad('hud', 'vanlige', 'Syntetisk k2 første', { kilde: 'k2', posisjon: 0 }),
      rad('hud', 'vanlige', 'Syntetisk k1 andre', { kilde: 'k1', posisjon: 1 }),
      rad('hud', 'vanlige', 'Syntetisk k1 første', { kilde: 'k1', posisjon: 0 }),
    ]
    expect(grupper(data, 'frekvens')[0]!.undergrupper[0]!.bivirkninger.map((b) => b.tekst)).toEqual([
      'Syntetisk k2 første',
      'Syntetisk k1 første',
      'Syntetisk k1 andre',
    ])
  })

  it('gir gruppene faste ID-er, og finner visningen fra ID-en', () => {
    const [vanlige] = grupper(SYNTETISK.bivirkninger, 'frekvens').filter((g) => g.nokkel.kode === 'vanlige')
    expect(gruppeid(vanlige!.nokkel)).toBe('frekvens-vanlige')
    expect(undergruppeid(vanlige!.nokkel, vanlige!.undergrupper[0]!.nokkel)).toBe('frekvens-vanlige--organsystem-nevrologiske')
    expect(visningForKort('organsystem-hud')).toBe('organsystem')
    expect(visningForKort('frekvens-ikke-kjent')).toBe('frekvens')
    expect(visningForKort('noe-annet')).toBeNull()
    expect(visningForKort(undefined)).toBeNull()
  })

  it('oppsummerer seksjonen likt i begge visningene', () => {
    expect(oppsummerBivirkninger(SYNTETISK)).toBe('6 bivirkninger · 3 organsystemer')
    expect(oppsummerBivirkninger({ kilder: [], bivirkninger: [] })).toBe('')
    expect(oppsummerBivirkninger(FLERE_TABELLER)).toBe('4 bivirkninger · 2 organsystemer · 3 tabeller')
  })

  it('gir søket tekstene i visningen som står, med kortet de står i', () => {
    const visning = byggBivirkningsvisning(SYNTETISK)
    const frekvens = bivirkningstekster(visning, 'frekvens')
    const fotnote = frekvens.find((t) => t.tekst === 'Syntetisk fotnote')!
    expect(fotnote).toMatchObject({
      panel: BIVIRKNINGSPANEL,
      detaljkort: 'frekvens-svaert-vanlige',
      element: { id: 'frekvens-svaert-vanlige--organsystem-hud', tittel: 'Hud- og underhudssykdommer' },
      felt: 'fritekst',
    })
    const organ = bivirkningstekster(visning, 'organsystem')
    expect(organ.find((t) => t.tekst === 'Syntetisk fotnote')).toMatchObject({ detaljkort: 'organsystem-hud' })
    // De samme bivirkningene er med i begge.
    const fritekst = (t: typeof frekvens) => t.filter((x) => x.felt === 'fritekst').map((x) => x.tekst).sort()
    expect(fritekst(frekvens)).toEqual(fritekst(organ))
  })
})

/* --- Flere tabeller ------------------------------------------------------ */

/** To preparatomtaler, den ene med to tabeller med ulikt frekvensgrunnlag og den samme bivirkningen i begge. */
const FLERE_TABELLER: Bivirkningsdata = {
  kilder: [
    kilde('k1', {
      preparat: 'Syntetisk infusjon',
      kontekster: [
        { nokkel: 'per-pasient', navn: 'Syntetisk indikasjon', frekvensgrunnlag: 'per pasient', merknad: null },
        { nokkel: 'per-infusjon', navn: 'Syntetisk indikasjon', frekvensgrunnlag: 'per infusjon', merknad: null },
      ],
    }),
    kilde('k2'),
  ],
  bivirkninger: [
    rad('generelle', 'vanlige', 'Syntetisk feber', { kontekst: 'per-pasient', posisjon: 0 }),
    rad('generelle', 'mindre_vanlige', 'Syntetisk feber', { kontekst: 'per-infusjon', posisjon: 0 }),
    rad('generelle', 'vanlige', 'Syntetisk tretthet', { kontekst: 'per-infusjon', posisjon: 1 }),
    rad('hud', 'vanlige', 'Syntetisk utslett', { kilde: 'k2', posisjon: 0 }),
  ],
}

describe('flere tabeller', () => {
  it('deler bivirkningene i tabeller, kilde for kilde, og blander aldri rader fra ulike tabeller', () => {
    expect(tabeller(FLERE_TABELLER).map((t) => [t.kilde.id, t.kontekst?.nokkel ?? null, t.bivirkninger.map((b) => b.tekst)])).toEqual([
      ['k1', 'per-pasient', ['Syntetisk feber']],
      ['k1', 'per-infusjon', ['Syntetisk feber', 'Syntetisk tretthet']],
      ['k2', null, ['Syntetisk utslett']],
    ])
    const visning = byggBivirkningsvisning(FLERE_TABELLER)
    expect(visning.tabeller.map((t) => [t.id, t.navn])).toEqual([
      ['k1_per-pasient', 'Syntetisk infusjon – Syntetisk indikasjon'],
      ['k1_per-infusjon', 'Syntetisk infusjon – Syntetisk indikasjon'],
      ['k2', 'Syntetisk preparatomtale k2'],
    ])
    // «Syntetisk feber» står som «Vanlige» i den ene tabellen og «Mindre vanlige» i den andre, hver for seg.
    expect(visning.tabeller.map((t) => navnene(t.grupper.frekvens))).toEqual([
      [['Vanlige', ['Generelle lidelser og reaksjoner på administrasjonsstedet']]],
      [
        ['Vanlige', ['Generelle lidelser og reaksjoner på administrasjonsstedet']],
        ['Mindre vanlige', ['Generelle lidelser og reaksjoner på administrasjonsstedet']],
      ],
      [['Vanlige', ['Hud- og underhudssykdommer']]],
    ])
    // Hver tabell har de samme radene i begge visningene.
    for (const t of visning.tabeller) {
      const sortert = (g: Gruppe[]) => radene(g).map((b) => b.tekst).sort()
      expect(sortert(t.grupper.frekvens)).toEqual(sortert(t.grupper.organsystem))
    }
  })

  it('er like enkel som før med én tabell, og viser navnet når tabellen har et', () => {
    expect(byggBivirkningsvisning(SYNTETISK).tabeller.map((t) => [t.id, t.navn])).toEqual([[null, null]])
    const enKontekst: Bivirkningsdata = {
      kilder: [kilde('k1', { kontekster: [{ nokkel: 'voksne', navn: 'Syntetisk: voksne', frekvensgrunnlag: null, merknad: null }] })],
      bivirkninger: [rad('hud', 'vanlige', 'Syntetisk', { kontekst: 'voksne' })],
    }
    expect(byggBivirkningsvisning(enKontekst).tabeller.map((t) => [t.id, t.navn])).toEqual([[null, 'Syntetisk: voksne']])
    expect(oppsummerBivirkninger(enKontekst)).toBe('1 bivirkning · 1 organsystem')
  })

  it('gir kortene i hver tabell egne ID-er, som søket og lenkene bruker', () => {
    const visning = byggBivirkningsvisning(FLERE_TABELLER)
    const [vanlige] = visning.tabeller[1]!.grupper.frekvens
    expect(gruppeid(vanlige!.nokkel, 'k1_per-infusjon')).toBe('tabell-k1_per-infusjon--frekvens-vanlige')
    expect(undergruppeid(vanlige!.nokkel, vanlige!.undergrupper[0]!.nokkel, 'k1_per-infusjon')).toBe(
      'tabell-k1_per-infusjon--frekvens-vanlige--organsystem-generelle',
    )
    expect(visningForKort('tabell-k1_per-infusjon--organsystem-generelle')).toBe('organsystem')
    expect(visningForKort('tabell-k2--frekvens-vanlige--organsystem-hud')).toBe('frekvens')
    const treff = bivirkningstekster(visning, 'frekvens').filter((t) => t.tekst === 'Syntetisk feber')
    expect(treff.map((t) => [t.detaljkort, t.element.id])).toEqual([
      ['tabell-k1_per-pasient--frekvens-vanlige', 'tabell-k1_per-pasient--frekvens-vanlige--organsystem-generelle'],
      ['tabell-k1_per-infusjon--frekvens-mindre-vanlige', 'tabell-k1_per-infusjon--frekvens-mindre-vanlige--organsystem-generelle'],
    ])
    // ID-ene er unike på siden.
    const ider = visning.tabeller.flatMap((t) => t.grupper.frekvens.map((g) => gruppeid(g.nokkel, t.id)))
    expect(new Set(ider).size).toBe(ider.length)
  })
})

/* --- Referansene ---------------------------------------------------------- */

describe('kildene som referanser', () => {
  it('står i referansefeltet til seksjonen med sporbarheten', () => {
    const k = kilde('k1', {
      tittel: 'Syntetisk preparatomtale',
      innehaver: 'Syntetisk innehaver AS',
      spc_versjon: '3',
      revisjonsdato: '2026-01-31',
      kontrollert: '2026-02-01',
      kontrollert_av: 'Syntetisk kontrollør',
      lenke: 'https://example.org/spc',
      merknad: 'Syntetisk merknad',
    })
    expect(bivirkningsopphav(k)).toMatch(/^versjon 3, revidert .+2026, importert .+2026 av Syntetisk, kontrollert .+2026 av Syntetisk kontrollør, Syntetisk merknad$/)
    expect(bivirkningsreferanse(k)).toMatchObject({
      id: 'bivirkning:k1',
      tittel: 'Syntetisk preparatomtale',
      forfattere: 'Syntetisk innehaver AS',
      aar: '2026',
      lenke: 'https://example.org/spc',
      automatisk: { kilde: PREPARATOMTALE },
    })
    expect(bivirkningsreferanser({ kilder: [k], bivirkninger: [] })).toEqual({
      referanser: [bivirkningsreferanse(k)],
      panelreferanser: { [BIVIRKNINGSPANEL]: ['bivirkning:k1'] },
    })
    expect(bivirkningsreferanser(null)).toEqual({ referanser: [] })
  })
})

/* --- Importfilene i repoet ------------------------------------------------ */

describe('importfilene og migrasjonene', () => {
  const filer = readdirSync(IMPORTMAPPE).filter((f) => f.endsWith('.json'))
  /** Det siste migrasjonene gjorde med hver kilde på hver fagside. */
  const siste = sisteEndringer(
    readdirSync(MIGRASJONSMAPPE)
      .filter((f) => f.endsWith('.sql'))
      .map((navn) => ({ navn, sql: readFileSync(new URL(navn, MIGRASJONSMAPPE), 'utf8') })),
  )

  it.each(filer.length ? filer : ['(ingen ennå)'])('%s er gyldig, heter etter innholdet og er lagt inn', (fil) => {
    if (!filer.length) return
    const data = JSON.parse(readFileSync(new URL(fil, IMPORTMAPPE), 'utf8')) as Bivirkningsimport
    expect(importfeil(data)).toEqual([])
    expect(fil).toBe(`${data.stoff}--${data.kilde.nokkel}.json`)
    const endring = siste.get(kildeid(data.stoff, data.kilde.nokkel))
    expect(endring?.slag, 'Lag migrasjonen med npm run import:bivirkninger').toBe('import')
    expect(endring?.slag === 'import' && endring.import).toEqual(data)
  })

  it('har en importfil for hver kilde migrasjonene har lagt inn og ikke trukket tilbake', () => {
    const gjeldende = [...siste.entries()].filter(([, e]) => e.slag === 'import').map(([k]) => `${k}.json`)
    expect(filer.sort()).toEqual(gjeldende.sort())
  })
})
