/**
 * Forhåndsvisningen av en bivirkningsimport: hva importen inneholder, og hva
 * den endrer fra den forrige importen av samme preparatomtale. Den skal gjøre
 * det lett å kontrollere en import, og særlig å se utilsiktede forskjeller
 * mellom to versjoner av en preparatomtale, før databasen endres (se
 * `docs/bivirkninger.md`).
 *
 * Forhåndsvisningen er et teknisk kontrollverktøy. Den teller og sammenligner
 * bare det som står i filene, og tolker ingenting. To bivirkninger regnes som
 * den samme bare når teksten er lik slik kontrollen av importen regner den
 * (`sammenligning`: uten forskjell på store og små bokstaver) og de står i
 * samme tabell. En bivirkning med en annen tekst er aldri «den samme» i ny
 * form; den står som fjernet, og den nye som lagt til.
 *
 * Alt her er rene funksjoner.
 */
import { antall } from '../faginnhold/oppsummering'
import { importtabeller, KILDEFELT, sammenligning, type Bivirkningsimport } from './import'
import { FREKVENSER, ORGANSYSTEMER, frekvens, organsystem, type Frekvenskode, type Organsystemkode } from './modell'

/** Én bivirkning i en import, med tabellen (`null` når importen har én), organsystemet og frekvensen. */
export interface Importrad {
  tabell: string | null
  organsystem: Organsystemkode
  frekvens: Frekvenskode
  tekst: string
  fotnote: string | null
}

/** Bivirkningene i en import, én rad hver, i fila sin rekkefølge. */
export function importrader(imp: Bivirkningsimport): Importrad[] {
  return importtabeller(imp).flatMap((t) =>
    t.organsystemer.flatMap((o) =>
      o.frekvenser.flatMap((f) =>
        f.bivirkninger.map((b) => ({
          tabell: t.nokkel,
          organsystem: o.organsystem,
          frekvens: f.frekvens,
          tekst: typeof b === 'string' ? b : b.tekst,
          fotnote: typeof b === 'string' ? null : (b.fotnote ?? null),
        })),
      ),
    ),
  )
}

/* --- Innholdet ----------------------------------------------------------- */

/** Opplysningene om en tabell; alle er `null` for den ene tabellen i en import uten `tabeller`. */
export interface Tabellinfo {
  nokkel: string | null
  navn: string | null
  frekvensgrunnlag: string | null
  merknad: string | null
}

/** Feltene i en tabell som kan endres; nøkkelen er det tabellen kjennes igjen på. */
const TABELLOPPLYSNINGER = ['navn', 'frekvensgrunnlag', 'merknad'] as const

const TABELLFELTNAVN: Record<(typeof TABELLOPPLYSNINGER)[number], string> = {
  navn: 'Navn',
  frekvensgrunnlag: 'Frekvensgrunnlag',
  merknad: 'Merknad',
}

const KILDEFELTNAVN: Record<(typeof KILDEFELT)[number], string> = {
  nokkel: 'Kildenøkkel',
  type: 'Type',
  tittel: 'Tittel',
  preparat: 'Preparat',
  innehaver: 'Innehaver',
  spc_versjon: 'SPC-versjon',
  revisjonsdato: 'Revisjonsdato',
  lenke: 'Lenke',
  kontrollert: 'Kontrollert',
  kontrollert_av: 'Kontrollert av',
  importert_av: 'Importert av',
  merknad: 'Merknad',
}

/** Tabellene i en import, i fila sin rekkefølge. */
export function tabellinfo(imp: Bivirkningsimport): Tabellinfo[] {
  if (!imp.tabeller) return [{ nokkel: null, navn: null, frekvensgrunnlag: null, merknad: null }]
  return imp.tabeller.map((t) => ({
    nokkel: t.nokkel,
    navn: t.navn,
    frekvensgrunnlag: t.frekvensgrunnlag ?? null,
    merknad: t.merknad ?? null,
  }))
}

/** Innholdet i én tabell: antallet i alt, per frekvens og per organsystem, og bivirkningene med fotnote. */
export interface Tabelloversikt extends Tabellinfo {
  antall: number
  /** Alle frekvensene, fra den høyeste, også dem uten bivirkninger. */
  perFrekvens: { kode: Frekvenskode; antall: number }[]
  /** Organsystemene med bivirkninger, i MedDRA-rekkefølgen. */
  perOrgansystem: { kode: Organsystemkode; antall: number }[]
  fotnoter: Importrad[]
}

export interface Importoversikt {
  antall: number
  antallFotnoter: number
  tabeller: Tabelloversikt[]
}

/**
 * Innholdet i en import, tabell for tabell. Frekvensene i ulike tabeller kan
 * ha ulikt grunnlag, så de telles aldri sammen.
 */
export function importoversikt(imp: Bivirkningsimport): Importoversikt {
  const rader = importrader(imp)
  const tabeller = tabellinfo(imp).map((t): Tabelloversikt => {
    const egne = rader.filter((r) => r.tabell === t.nokkel)
    const telle = <K>(kode: K, felt: 'frekvens' | 'organsystem') => egne.filter((r) => r[felt] === kode).length
    return {
      ...t,
      antall: egne.length,
      perFrekvens: FREKVENSER.map((f) => ({ kode: f.kode, antall: telle(f.kode, 'frekvens') })),
      perOrgansystem: ORGANSYSTEMER.map((o) => ({ kode: o.kode, antall: telle(o.kode, 'organsystem') })).filter((o) => o.antall > 0),
      fotnoter: egne.filter((r) => r.fotnote !== null),
    }
  })
  return { antall: rader.length, antallFotnoter: rader.filter((r) => r.fotnote !== null).length, tabeller }
}

/* --- Sammenligningen ----------------------------------------------------- */

/** Et felt med en annen verdi enn sist; et felt som er utelatt, er `null`. */
export interface Feltendring {
  felt: string
  navn: string
  fra: string | null
  til: string | null
}

/** Det som kan være endret ved en bivirkning som står i begge importene. */
export type Radforskjell = 'organsystem' | 'frekvens' | 'tekst' | 'fotnote'

export interface Radendring {
  fra: Importrad
  til: Importrad
  hva: Radforskjell[]
}

/** En kombinasjon av organsystem og frekvens der bivirkningene som står i begge, har byttet plass. */
export interface Rekkefolgeendring {
  tabell: string | null
  organsystem: Organsystemkode
  frekvens: Frekvenskode
  fra: string[]
  til: string[]
}

export interface Importsammenligning {
  /** Sant når databasen ikke vil endre noe: innholdet er det samme, bortsett fra `kilde.importert_av`. */
  identisk: boolean
  /** Fagsiden og kildefeltene som er endret. */
  kilde: Feltendring[]
  tabeller: {
    lagtTil: Tabellinfo[]
    fjernet: Tabellinfo[]
    endret: { nokkel: string | null; endringer: Feltendring[] }[]
    /** Rekkefølgen på tabellene som står i begge, når den er endret. */
    rekkefolge: { fra: (string | null)[]; til: (string | null)[] } | null
  }
  lagtTil: Importrad[]
  fjernet: Importrad[]
  endret: Radendring[]
  rekkefolge: Rekkefolgeendring[]
}

/** En verdi som JSON med nøklene sortert, så rekkefølgen på feltene ikke teller, som i `jsonb`. */
function kanonisk(verdi: unknown): string {
  if (Array.isArray(verdi)) return `[${verdi.map(kanonisk).join(',')}]`
  if (typeof verdi === 'object' && verdi !== null) {
    const felt = Object.entries(verdi)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    return `{${felt.map(([k, v]) => `${JSON.stringify(k)}:${kanonisk(v)}`).join(',')}}`
  }
  return JSON.stringify(verdi)
}

/**
 * Om databasen vil se importene som like og ikke endre noe: det samme
 * innholdet som `jsonb`, uten `kilde.importert_av` — som kontrollsummen
 * `innholdssum` i `bivirkninger.importer`.
 */
export function sammeInnhold(a: Bivirkningsimport, b: Bivirkningsimport): boolean {
  const uten = (imp: Bivirkningsimport) => ({ ...imp, kilde: { ...imp.kilde, importert_av: undefined } })
  return kanonisk(uten(a)) === kanonisk(uten(b))
}

function feltendringer<F extends string>(
  felt: readonly F[],
  navn: Record<F, string>,
  fra: Partial<Record<F, unknown>>,
  til: Partial<Record<F, unknown>>,
): Feltendring[] {
  const verdi = (v: unknown) => (v === undefined || v === null ? null : String(v))
  return felt.flatMap((f) => {
    const [a, b] = [verdi(fra[f]), verdi(til[f])]
    return a === b ? [] : [{ felt: f, navn: navn[f], fra: a, til: b }]
  })
}

/** Elementene i `a` som også står i `b`, i rekkefølgen i `a`. */
function felles<T>(a: readonly T[], b: readonly T[]): T[] {
  const i = new Set(b)
  return a.filter((x) => i.has(x))
}

function likeLister<T>(a: readonly T[], b: readonly T[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i])
}

function gruppert<T>(liste: readonly T[], nokkel: (x: T) => string): Map<string, T[]> {
  const kart = new Map<string, T[]>()
  for (const x of liste) kart.set(nokkel(x), [...(kart.get(nokkel(x)) ?? []), x])
  return kart
}

/** Tabellen og teksten slik to bivirkninger kjennes igjen som den samme. */
const identitet = (r: Importrad) => `${r.tabell ?? ''}\u0000${sammenligning(r.tekst)}`
/** Kombinasjonen av organsystem og frekvens en bivirkning står i, i tabellen sin. */
const kombinasjon = (r: Pick<Importrad, 'tabell' | 'organsystem' | 'frekvens'>) => `${r.tabell ?? ''}\u0000${r.organsystem}\u0000${r.frekvens}`

/**
 * Bivirkningene i den nye importen paret med dem i den forrige. Først pares
 * hver med den som har samme tekst på samme sted (organsystem og frekvens);
 * er det da én igjen med samme tekst på hver side, er den flyttet. Står den
 * samme teksten igjen flere steder på en av sidene, gjettes det ikke: de står
 * som fjernet og lagt til.
 */
function parBivirkninger(gamle: readonly Importrad[], nye: readonly Importrad[]): Map<Importrad, Importrad> {
  const par = new Map<Importrad, Importrad>()
  const brukt = new Set<Importrad>()
  const gamlePerIdentitet = gruppert(gamle, identitet)
  for (const [id, egne] of gruppert(nye, identitet)) {
    const kandidater = gamlePerIdentitet.get(id) ?? []
    const restNye = egne.filter((n) => {
      const g = kandidater.find((k) => !brukt.has(k) && kombinasjon(k) === kombinasjon(n))
      if (!g) return true
      brukt.add(g)
      par.set(n, g)
      return false
    })
    const restGamle = kandidater.filter((k) => !brukt.has(k))
    if (restNye.length === 1 && restGamle.length === 1) {
      brukt.add(restGamle[0]!)
      par.set(restNye[0]!, restGamle[0]!)
    }
  }
  return par
}

/** Hvordan en bivirkning i begge importene er endret; tom når den er lik. */
function radforskjeller(fra: Importrad, til: Importrad): Radforskjell[] {
  const hva: Radforskjell[] = []
  if (fra.organsystem !== til.organsystem) hva.push('organsystem')
  if (fra.frekvens !== til.frekvens) hva.push('frekvens')
  if (fra.tekst !== til.tekst) hva.push('tekst')
  if (fra.fotnote !== til.fotnote) hva.push('fotnote')
  return hva
}

/** Hva `ny` endrer fra `forrige`, to importer av samme preparatomtale. */
export function sammenlignImporter(forrige: Bivirkningsimport, ny: Bivirkningsimport): Importsammenligning {
  const kilde = [
    ...feltendringer(['stoff'], { stoff: 'Fagside' }, forrige, ny),
    ...feltendringer(KILDEFELT, KILDEFELTNAVN, forrige.kilde, ny.kilde),
  ]

  const gamleTabeller = tabellinfo(forrige)
  const nyeTabeller = tabellinfo(ny)
  const gamleNokler = gamleTabeller.map((t) => t.nokkel)
  const nyeNokler = nyeTabeller.map((t) => t.nokkel)
  const fraRekkefolge = felles(gamleNokler, nyeNokler)
  const tilRekkefolge = felles(nyeNokler, gamleNokler)
  const tabeller: Importsammenligning['tabeller'] = {
    lagtTil: nyeTabeller.filter((t) => !gamleNokler.includes(t.nokkel)),
    fjernet: gamleTabeller.filter((t) => !nyeNokler.includes(t.nokkel)),
    endret: nyeTabeller.flatMap((t) => {
      const g = gamleTabeller.find((x) => x.nokkel === t.nokkel)
      const endringer = g ? feltendringer(TABELLOPPLYSNINGER, TABELLFELTNAVN, g, t) : []
      return endringer.length > 0 ? [{ nokkel: t.nokkel, endringer }] : []
    }),
    rekkefolge: likeLister(fraRekkefolge, tilRekkefolge) ? null : { fra: fraRekkefolge, til: tilRekkefolge },
  }

  const gamle = importrader(forrige)
  const nye = importrader(ny)
  const par = parBivirkninger(gamle, nye)
  const paret = new Set(par.values())
  const endret = nye.flatMap((n) => {
    const g = par.get(n)
    const hva = g ? radforskjeller(g, n) : []
    return g && hva.length > 0 ? [{ fra: g, til: n, hva }] : []
  })

  // Rekkefølgen innenfor en kombinasjon, for bivirkningene som står der i begge.
  const uflyttet = new Set([...par].filter(([n, g]) => kombinasjon(n) === kombinasjon(g)).map(([n]) => n))
  const gamlePerKombinasjon = gruppert(gamle, kombinasjon)
  const rekkefolge = [...gruppert(nye, kombinasjon)].flatMap(([k, egne]): Rekkefolgeendring[] => {
    const til = egne.filter((n) => uflyttet.has(n))
    const tilGamle = new Set(til.map((n) => par.get(n)!))
    const fra = (gamlePerKombinasjon.get(k) ?? []).filter((g) => tilGamle.has(g))
    if (likeLister(fra, til.map((n) => par.get(n)!))) return []
    const { tabell, organsystem, frekvens } = egne[0]!
    return [{ tabell, organsystem, frekvens, fra: fra.map((g) => g.tekst), til: til.map((n) => n.tekst) }]
  })

  return {
    identisk: sammeInnhold(forrige, ny),
    kilde,
    tabeller,
    lagtTil: nye.filter((n) => !par.has(n)),
    fjernet: gamle.filter((g) => !paret.has(g)),
    endret,
    rekkefolge,
  }
}

/* --- Rapporten ----------------------------------------------------------- */

/** Hva importen sammenlignes med: den forrige importen av samme preparatomtale, eller ingenting. */
export type Sammenligningsgrunnlag =
  | { slag: 'import'; import: Bivirkningsimport; beskrivelse: string }
  | { slag: 'ingen'; merknad?: string }

const sitat = (tekst: string | null) => (tekst === null ? '(ingen)' : `«${tekst}»`)
const tabellnavn = (t: Pick<Tabellinfo, 'nokkel' | 'navn'>) => (t.nokkel === null ? 'Én tabell uten navn' : `«${t.navn}» (${t.nokkel})`)

/** Hvor en bivirkning står: tabellen (når importen har flere), organsystemet og frekvensen. */
function sted(r: Pick<Importrad, 'tabell' | 'organsystem' | 'frekvens'>): string {
  return [r.tabell && `Tabell ${r.tabell}`, organsystem(r.organsystem).navn, frekvens(r.frekvens).navn].filter(Boolean).join(' · ')
}

function bivirkningslinje(r: Importrad): string {
  return `- ${sted(r)}: «${r.tekst}»${r.fotnote === null ? '' : ` — fotnote: «${r.fotnote}»`}`
}

function seksjon(overskrift: string, linjer: readonly string[]): string[] {
  return linjer.length > 0 ? ['', `### ${overskrift}`, '', ...linjer] : []
}

function kildelinjer(imp: Bivirkningsimport): string[] {
  const k = imp.kilde
  const linje = (navn: string, verdi: string | null | undefined) => (verdi ? [`- ${navn}: ${verdi}`] : [])
  return [
    `- Fagside: ${imp.stoff} (#/stoff/${imp.stoff})`,
    `- Kilde: ${k.nokkel} (${k.type})`,
    `- Tittel: ${k.tittel}`,
    ...linje('Preparat', k.preparat),
    ...linje('Innehaver', k.innehaver),
    `- SPC-versjon: ${k.spc_versjon ?? '(ikke oppgitt)'}`,
    `- Revisjonsdato: ${k.revisjonsdato ?? '(ikke oppgitt)'}`,
    ...linje('Lenke', k.lenke),
    ...linje('Kontrollert', [k.kontrollert, k.kontrollert_av && `av ${k.kontrollert_av}`].filter(Boolean).join(' ')),
    `- Importert av: ${k.importert_av}`,
    ...linje('Merknad', k.merknad),
  ]
}

function innholdslinjer(imp: Bivirkningsimport): string[] {
  const o = importoversikt(imp)
  const flere = imp.tabeller !== undefined
  const linjer = [
    '',
    '## Innhold',
    '',
    `${antall(o.antall, 'bivirkning', 'bivirkninger')} i alt, ${antall(o.tabeller.length, 'tabell', 'tabeller')}, ${antall(o.antallFotnoter, 'fotnote', 'fotnoter')}.`,
  ]
  if (flere) linjer.push('Frekvensene i ulike tabeller kan ha ulikt grunnlag og telles bare tabell for tabell.')
  const under = flere ? '####' : '###'
  for (const t of o.tabeller) {
    if (flere) {
      linjer.push('', `### Tabell ${tabellnavn(t)}`, '')
      linjer.push(`- Frekvensgrunnlag: ${t.frekvensgrunnlag ?? '(ikke oppgitt)'}`)
      if (t.merknad) linjer.push(`- Merknad: ${t.merknad}`)
      linjer.push(`- ${antall(t.antall, 'bivirkning', 'bivirkninger')}`)
    }
    linjer.push('', `${under} Per frekvens`, '')
    linjer.push(...t.perFrekvens.map((f) => `- ${frekvens(f.kode).navn} (${frekvens(f.kode).definisjon}): ${f.antall}`))
    linjer.push('', `${under} Per organsystem`, '')
    linjer.push(...t.perOrgansystem.map((s) => `- ${organsystem(s.kode).navn}: ${s.antall}`))
    linjer.push('', `${under} Fotnoter`, '')
    linjer.push(...(t.fotnoter.length > 0 ? t.fotnoter.map(bivirkningslinje) : ['Ingen.']))
  }
  return linjer
}

const FORSKJELLSNAVN: Record<Radforskjell, string> = {
  organsystem: 'Flyttet til annet organsystem',
  frekvens: 'Endret frekvens',
  tekst: 'Endret tekst, bare store og små bokstaver',
  fotnote: 'Endret fotnote',
}

function radendringslinje(e: Radendring, hva: Radforskjell): string {
  const { fra, til } = e
  switch (hva) {
    case 'organsystem':
      return `- ${til.tabell ? `Tabell ${til.tabell} · ` : ''}«${til.tekst}»: ${organsystem(fra.organsystem).navn} → ${organsystem(til.organsystem).navn}${
        fra.frekvens === til.frekvens ? ` (${frekvens(til.frekvens).navn})` : ''
      }`
    case 'frekvens':
      return `- ${til.tabell ? `Tabell ${til.tabell} · ` : ''}«${til.tekst}»: ${frekvens(fra.frekvens).navn} → ${frekvens(til.frekvens).navn}${
        fra.organsystem === til.organsystem ? ` (${organsystem(til.organsystem).navn})` : ''
      }`
    case 'tekst':
      return `- ${sted(til)}: «${fra.tekst}» → «${til.tekst}»`
    case 'fotnote':
      return `- ${sted(til)}: «${til.tekst}»: ${sitat(fra.fotnote)} → ${sitat(til.fotnote)}`
  }
}

function endringslinjer(s: Importsammenligning, beskrivelse: string): string[] {
  const linjer = ['', '## Endringer', '', `Sammenlignet med ${beskrivelse}.`]
  const importertAv = s.kilde.find((e) => e.felt === 'importert_av')
  if (s.identisk) {
    linjer.push('', '**Ingen endringer.** Innholdet er det samme, og databasen vil ikke endre noe.')
    if (importertAv) linjer.push(`Bare «Importert av» er annerledes (${sitat(importertAv.fra)} → ${sitat(importertAv.til)}), og det teller ikke.`)
    return linjer
  }
  const antallMed = (hva: Radforskjell) => s.endret.filter((e) => e.hva.includes(hva)).length
  linjer.push(
    '',
    `**Sammendrag:** ${[
      `${s.lagtTil.length} lagt til`,
      `${s.fjernet.length} fjernet`,
      `${antallMed('organsystem')} flyttet til annet organsystem`,
      `${antallMed('frekvens')} med endret frekvens`,
      `${antallMed('tekst')} med endret tekst`,
      `${antallMed('fotnote')} med endret fotnote`,
      `${antall(s.rekkefolge.length, 'kombinasjon', 'kombinasjoner')} med endret rekkefølge`,
    ].join(', ')}.`,
  )
  linjer.push(...seksjon('Kilden', s.kilde.map((e) => `- ${e.navn}: ${sitat(e.fra)} → ${sitat(e.til)}`)))
  linjer.push(
    ...seksjon('Tabellene', [
      ...s.tabeller.lagtTil.map((t) => `- Lagt til: ${tabellnavn(t)}`),
      ...s.tabeller.fjernet.map((t) => `- Fjernet: ${tabellnavn(t)}`),
      ...s.tabeller.endret.flatMap((t) => t.endringer.map((e) => `- ${t.nokkel}: ${e.navn} ${sitat(e.fra)} → ${sitat(e.til)}`)),
      ...(s.tabeller.rekkefolge ? [`- Ny rekkefølge: ${s.tabeller.rekkefolge.fra.join(', ')} → ${s.tabeller.rekkefolge.til.join(', ')}`] : []),
    ]),
  )
  linjer.push(...seksjon(`Lagt til (${s.lagtTil.length})`, s.lagtTil.map(bivirkningslinje)))
  linjer.push(...seksjon(`Fjernet (${s.fjernet.length})`, s.fjernet.map(bivirkningslinje)))
  for (const hva of Object.keys(FORSKJELLSNAVN) as Radforskjell[]) {
    const med = s.endret.filter((e) => e.hva.includes(hva))
    linjer.push(...seksjon(`${FORSKJELLSNAVN[hva]} (${med.length})`, med.map((e) => radendringslinje(e, hva))))
  }
  linjer.push(
    ...seksjon(
      `Endret rekkefølge (${s.rekkefolge.length})`,
      s.rekkefolge.map((r) => `- ${sted(r)}: ${r.fra.map((t) => `«${t}»`).join(', ')} → ${r.til.map((t) => `«${t}»`).join(', ')}`),
    ),
  )
  const synlige =
    s.kilde.length +
    s.tabeller.lagtTil.length +
    s.tabeller.fjernet.length +
    s.tabeller.endret.length +
    (s.tabeller.rekkefolge ? 1 : 0) +
    s.lagtTil.length +
    s.fjernet.length +
    s.endret.length +
    s.rekkefolge.length
  if (synlige === 0) {
    linjer.push(
      '',
      'Ingen forskjell i det som vises, men fila er ikke lik den forrige (for eksempel rekkefølgen på organsystemene eller frekvensene i fila, eller et felt som er `null` i stedet for utelatt). Databasen vil legge den inn som en ny import.',
    )
  }
  return linjer
}

/**
 * Forhåndsvisningen som lettlest tekst (Markdown): kilden, innholdet og,
 * når det finnes en forrige import, endringene fra den.
 */
export function importrapport(imp: Bivirkningsimport, grunnlag: Sammenligningsgrunnlag, fil?: string): string {
  const linjer = ['# Forhåndsvisning av bivirkningsimport', '']
  if (fil) linjer.push(`Fil: ${fil}`, '')
  linjer.push(...kildelinjer(imp), ...innholdslinjer(imp))
  if (grunnlag.slag === 'import') {
    linjer.push(...endringslinjer(sammenlignImporter(grunnlag.import, imp), grunnlag.beskrivelse))
  } else {
    linjer.push('', '## Endringer', '', '**Førstegangsimport:** kilden er ikke importert til denne fagsiden før, så alle bivirkningene er nye.')
    if (grunnlag.merknad) linjer.push(grunnlag.merknad)
  }
  return `${linjer.join('\n')}\n`
}
