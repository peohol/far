/**
 * Importformatet for bivirkningene: én JSON-fil per preparatomtale (SPC), og
 * kontrollen av den. Formatet er beskrevet i `docs/bivirkninger.md`, og
 * databasen kontrollerer det samme med de samme meldingene
 * (`bivirkninger.importfeil` i migrasjonen `*_bivirkninger.sql`); testen
 * `bivirkninger.test.ts` kjører de samme tilfellene gjennom begge.
 *
 * Kontrollen er streng med vilje. En ukjent frekvens, et ukjent organsystem
 * eller et felt med skrivefeil blir en tydelig feil med stedet i fila, aldri
 * en ny variant eller et felt som stille ignoreres. Tekstene tas inn slik de
 * står; ingenting normaliseres, omskrives eller klassifiseres her.
 *
 * Alt her er rene funksjoner.
 */
import { FREKVENSER, KILDETYPER, erFrekvenskode, erOrgansystemkode, type Frekvenskode, type Kildetype, type Organsystemkode } from './modell'

/** Formatet og versjonen importen skal oppgi, så en senere endring av formatet kan kjennes igjen. */
export const IMPORTFORMAT = 'ousfar-bivirkninger/1'

/** Hvor lange tekstene kan være, i tegn. De samme grensene står i databasen. */
export const MAKSLENGDE = {
  nokkel: 100,
  tittel: 300,
  preparat: 200,
  innehaver: 200,
  spc_versjon: 100,
  lenke: 2000,
  kontrollert_av: 200,
  importert_av: 200,
  merknad: 2000,
  navn: 300,
  frekvensgrunnlag: 200,
  tekst: 500,
  fotnote: 1000,
} as const

/** En bivirkning i importen: bare teksten, eller teksten med en fotnote. */
export type Importbivirkning = string | { tekst: string; fotnote?: string | null }

export interface Importkilde {
  nokkel: string
  type: Kildetype
  tittel: string
  preparat?: string | null
  innehaver?: string | null
  spc_versjon?: string | null
  revisjonsdato?: string | null
  lenke?: string | null
  kontrollert?: string | null
  kontrollert_av?: string | null
  importert_av: string
  merknad?: string | null
}

/** Bivirkningene i én tabell, etter organsystem og frekvens, som i preparatomtalen. */
export type Importorgansystemer = {
  organsystem: Organsystemkode
  frekvenser: { frekvens: Frekvenskode; bivirkninger: Importbivirkning[] }[]
}[]

/**
 * Én av flere bivirkningstabeller i preparatomtalen — for en indikasjon, en
 * dosering eller et frekvensgrunnlag (per pasient, per infusjon …). Hver
 * tabell vises for seg, og radene i ulike tabeller blandes aldri.
 */
export interface Importtabell {
  nokkel: string
  navn: string
  frekvensgrunnlag?: string | null
  merknad?: string | null
  organsystemer: Importorgansystemer
}

/**
 * Én importfil: stoffet, kilden og bivirkningene. Har preparatomtalen én
 * tabell, står organsystemene rett i importen; har den flere, står hver under
 * `tabeller`, og `organsystemer` utelates.
 */
export type Bivirkningsimport = {
  format: typeof IMPORTFORMAT
  stoff: string
  kilde: Importkilde
} & ({ organsystemer: Importorgansystemer; tabeller?: undefined } | { tabeller: Importtabell[]; organsystemer?: undefined })

/** Feltene på hvert nivå, i den rekkefølgen de kontrolleres. */
const TOPPFELT = ['format', 'stoff', 'kilde', 'organsystemer', 'tabeller'] as const
const KILDEFELT = [
  'nokkel',
  'type',
  'tittel',
  'preparat',
  'innehaver',
  'spc_versjon',
  'revisjonsdato',
  'lenke',
  'kontrollert',
  'kontrollert_av',
  'importert_av',
  'merknad',
] as const
const TABELLFELT = ['nokkel', 'navn', 'frekvensgrunnlag', 'merknad', 'organsystemer'] as const
const ORGANSYSTEMFELT = ['organsystem', 'frekvenser'] as const
const FREKVENSFELT = ['frekvens', 'bivirkninger'] as const
const BIVIRKNINGSFELT = ['tekst', 'fotnote'] as const

/** Nøkkelen til en fagside, og til en kilde: små bokstaver a–z, tall og enkle bindestreker. */
const NOKKEL = /^[a-z0-9]+(-[a-z0-9]+)*$/
const DATO = /^\d{4}-\d{2}-\d{2}$/
const LENKE = /^https?:\/\/\S+$/

type Objekt = Record<string, unknown>

function erObjekt(verdi: unknown): verdi is Objekt {
  return typeof verdi === 'object' && verdi !== null && !Array.isArray(verdi)
}

/** Om feltet står i objektet med en verdi (ikke `null`), som `bivirkninger.har` i databasen. */
function har(objekt: Objekt, felt: string): boolean {
  return objekt[felt] !== undefined && objekt[felt] !== null
}

/** Antall tegn, som `char_length` i databasen (ikke UTF-16-enheter). */
function tegn(tekst: string): number {
  return [...tekst].length
}

/** Feltene i objektet som ikke hører til, sortert så meldingene kommer i samme rekkefølge som i databasen. */
function ukjenteFelt(objekt: Objekt, sti: string, tillatte: readonly string[]): string[] {
  return Object.keys(objekt)
    .filter((f) => !tillatte.includes(f))
    .sort()
    .map((f) => `${sti ? `${sti}.` : ''}${f}: ukjent felt. Tillatte felt: ${tillatte.join(', ')}.`)
}

/**
 * Feilene i et tekstfelt. Et valgfritt felt kan utelates eller være `null`;
 * står det, gjelder de samme reglene som for et påkrevd.
 */
function tekstfeil(verdi: unknown, sti: string, maks: number, pakrevd: boolean): string[] {
  if (verdi === undefined || verdi === null) return pakrevd ? [`${sti}: må fylles ut.`] : []
  if (typeof verdi !== 'string') return [`${sti}: må være tekst.`]
  if (verdi === '') return [pakrevd ? `${sti}: må fylles ut.` : `${sti}: kan ikke være tom tekst; utelat feltet i stedet.`]
  if (/[\n\r\t]/.test(verdi)) return [`${sti}: kan ikke ha linjeskift eller tabulator.`]
  if (/^\s|\s$/.test(verdi)) return [`${sti}: har mellomrom i begynnelsen eller slutten.`]
  if (tegn(verdi) > maks) return [`${sti}: er lengre enn ${maks} tegn.`]
  return []
}

/** En gyldig dato på formen ÅÅÅÅ-MM-DD. */
export function erDato(tekst: string): boolean {
  if (!DATO.test(tekst)) return false
  const [ar, maned, dag] = tekst.split('-').map(Number) as [number, number, number]
  const d = new Date(Date.UTC(ar, maned - 1, dag))
  return d.getUTCFullYear() === ar && d.getUTCMonth() === maned - 1 && d.getUTCDate() === dag && ar >= 1900
}

function datofeil(verdi: unknown, sti: string): string[] {
  if (verdi === undefined || verdi === null) return []
  return typeof verdi === 'string' && erDato(verdi) ? [] : [`${sti}: må være en dato på formen ÅÅÅÅ-MM-DD.`]
}

/** Feilen i en nøkkel (kilde eller tabell): små bokstaver a–z, tall og enkle bindestreker. */
function nokkelfeil(verdi: unknown, sti: string): string[] {
  return typeof verdi === 'string' && NOKKEL.test(verdi) && tegn(verdi) <= MAKSLENGDE.nokkel
    ? []
    : [`${sti}: må bestå av små bokstaver a–z, tall og enkle bindestreker (høyst ${MAKSLENGDE.nokkel} tegn).`]
}

/** Teksten slik to like bivirkninger sammenlignes: uten forskjell på store og små bokstaver. */
function sammenligning(tekst: string): string {
  return tekst.toLocaleLowerCase('nb')
}

function kildefeil(kilde: unknown): string[] {
  if (!erObjekt(kilde)) return ['kilde: må være et objekt.']
  const feil = ukjenteFelt(kilde, 'kilde', KILDEFELT)
  feil.push(...nokkelfeil(kilde.nokkel, 'kilde.nokkel'))
  feil.push(
    ...kodefeil(kilde.type, 'kilde.type', (KILDETYPER as readonly unknown[]).includes(kilde.type), `ukjent kildetype %. Tillatte: ${KILDETYPER.join(', ')}.`),
  )
  feil.push(...tekstfeil(kilde.tittel, 'kilde.tittel', MAKSLENGDE.tittel, true))
  feil.push(...tekstfeil(kilde.preparat, 'kilde.preparat', MAKSLENGDE.preparat, false))
  feil.push(...tekstfeil(kilde.innehaver, 'kilde.innehaver', MAKSLENGDE.innehaver, false))
  feil.push(...tekstfeil(kilde.spc_versjon, 'kilde.spc_versjon', MAKSLENGDE.spc_versjon, false))
  feil.push(...datofeil(kilde.revisjonsdato, 'kilde.revisjonsdato'))
  const lenke = tekstfeil(kilde.lenke, 'kilde.lenke', MAKSLENGDE.lenke, false)
  if (lenke.length === 0 && typeof kilde.lenke === 'string' && !LENKE.test(kilde.lenke)) {
    lenke.push('kilde.lenke: må begynne med http:// eller https:// og kan ikke ha mellomrom.')
  }
  feil.push(...lenke)
  feil.push(...datofeil(kilde.kontrollert, 'kilde.kontrollert'))
  feil.push(...tekstfeil(kilde.kontrollert_av, 'kilde.kontrollert_av', MAKSLENGDE.kontrollert_av, false))
  feil.push(...tekstfeil(kilde.importert_av, 'kilde.importert_av', MAKSLENGDE.importert_av, true))
  feil.push(...tekstfeil(kilde.merknad, 'kilde.merknad', MAKSLENGDE.merknad, false))
  return feil
}

/** En verdi i en melding: tekst i anførselstegn, alt annet som JSON. */
function vis(verdi: unknown): string {
  return typeof verdi === 'string' ? `«${verdi}»` : JSON.stringify(verdi)
}

/** Feilen i et felt som skal være en kode fra en fast liste: mangler, eller er ukjent. */
function kodefeil(verdi: unknown, sti: string, gyldig: boolean, ukjent: string): string[] {
  if (verdi === undefined || verdi === null) return [`${sti}: må fylles ut.`]
  return gyldig ? [] : [`${sti}: ${ukjent.replace('%', vis(verdi))}`]
}

const FREKVENSKODER = FREKVENSER.map((f) => f.kode).join(', ')

function bivirkningsfeil(liste: unknown, sti: string): string[] {
  if (!Array.isArray(liste) || liste.length === 0) return [`${sti}: må være en liste med minst én bivirkning.`]
  const feil: string[] = []
  const sett = new Set<string>()
  liste.forEach((b: unknown, k) => {
    const her = `${sti}[${k}]`
    let tekst: unknown
    if (typeof b === 'string') {
      tekst = b
      feil.push(...tekstfeil(b, her, MAKSLENGDE.tekst, true))
    } else if (erObjekt(b)) {
      tekst = b.tekst
      feil.push(...ukjenteFelt(b, her, BIVIRKNINGSFELT))
      feil.push(...tekstfeil(b.tekst, `${her}.tekst`, MAKSLENGDE.tekst, true))
      feil.push(...tekstfeil(b.fotnote, `${her}.fotnote`, MAKSLENGDE.fotnote, false))
    } else {
      feil.push(`${her}: må være tekst eller et objekt med tekst og fotnote.`)
      return
    }
    if (typeof tekst !== 'string') return
    const nokkel = sammenligning(tekst)
    if (sett.has(nokkel)) feil.push(`${her}: «${tekst}» står mer enn én gang i samme kombinasjon av organsystem og frekvens.`)
    sett.add(nokkel)
  })
  return feil
}

function frekvensfeil(liste: unknown, sti: string): string[] {
  if (!Array.isArray(liste) || liste.length === 0) return [`${sti}: må være en liste med minst én frekvens.`]
  const feil: string[] = []
  const sett = new Set<string>()
  liste.forEach((f: unknown, j) => {
    const her = `${sti}[${j}]`
    if (!erObjekt(f)) {
      feil.push(`${her}: må være et objekt.`)
      return
    }
    feil.push(...ukjenteFelt(f, her, FREKVENSFELT))
    const ukjent = kodefeil(f.frekvens, `${her}.frekvens`, erFrekvenskode(f.frekvens), `ukjent frekvenskategori %. Tillatte: ${FREKVENSKODER}.`)
    if (ukjent.length > 0) {
      feil.push(...ukjent)
    } else if (sett.has(f.frekvens as string)) {
      feil.push(`${her}.frekvens: «${f.frekvens}» står mer enn én gang under samme organsystem.`)
    } else {
      sett.add(f.frekvens as string)
    }
    feil.push(...bivirkningsfeil(f.bivirkninger, `${her}.bivirkninger`))
  })
  return feil
}

function organsystemfeil(liste: unknown, sti: string): string[] {
  if (!Array.isArray(liste) || liste.length === 0) return [`${sti}: må være en liste med minst ett organsystem.`]
  const feil: string[] = []
  const sett = new Set<string>()
  liste.forEach((o: unknown, i) => {
    const her = `${sti}[${i}]`
    if (!erObjekt(o)) {
      feil.push(`${her}: må være et objekt.`)
      return
    }
    feil.push(...ukjenteFelt(o, her, ORGANSYSTEMFELT))
    const ukjent = kodefeil(o.organsystem, `${her}.organsystem`, erOrgansystemkode(o.organsystem), 'ukjent organsystem %. De tillatte kodene står i docs/bivirkninger.md.')
    if (ukjent.length > 0) {
      feil.push(...ukjent)
    } else if (sett.has(o.organsystem as string)) {
      feil.push(`${her}.organsystem: «${o.organsystem}» står mer enn én gang; samle frekvensene under ett organsystem.`)
    } else {
      sett.add(o.organsystem as string)
    }
    feil.push(...frekvensfeil(o.frekvenser, `${her}.frekvenser`))
  })
  return feil
}

function tabellfeil(liste: unknown): string[] {
  if (!Array.isArray(liste) || liste.length === 0) return ['tabeller: må være en liste med minst én tabell.']
  const feil: string[] = []
  const sett = new Set<string>()
  liste.forEach((t: unknown, i) => {
    const her = `tabeller[${i}]`
    if (!erObjekt(t)) {
      feil.push(`${her}: må være et objekt.`)
      return
    }
    feil.push(...ukjenteFelt(t, her, TABELLFELT))
    const ugyldig = nokkelfeil(t.nokkel, `${her}.nokkel`)
    if (ugyldig.length > 0) {
      feil.push(...ugyldig)
    } else if (sett.has(t.nokkel as string)) {
      feil.push(`${her}.nokkel: «${t.nokkel}» står mer enn én gang; hver tabell har sin egen nøkkel.`)
    } else {
      sett.add(t.nokkel as string)
    }
    feil.push(...tekstfeil(t.navn, `${her}.navn`, MAKSLENGDE.navn, true))
    feil.push(...tekstfeil(t.frekvensgrunnlag, `${her}.frekvensgrunnlag`, MAKSLENGDE.frekvensgrunnlag, false))
    feil.push(...tekstfeil(t.merknad, `${her}.merknad`, MAKSLENGDE.merknad, false))
    feil.push(...organsystemfeil(t.organsystemer, `${her}.organsystemer`))
  })
  return feil
}

/**
 * Alle feilene i en import, med stedet i fila foran hver; tom når importen kan
 * legges inn. Om fagsiden `stoff` finnes, vet bare databasen.
 */
export function importfeil(data: unknown): string[] {
  if (!erObjekt(data)) return ['Importen må være et JSON-objekt.']
  const feil = ukjenteFelt(data, '', TOPPFELT)
  if (data.format !== IMPORTFORMAT) feil.push(`format: må være «${IMPORTFORMAT}».`)
  if (typeof data.stoff !== 'string' || !NOKKEL.test(data.stoff)) {
    feil.push('stoff: må være nøkkelen til en fagside (små bokstaver a–z, tall og enkle bindestreker).')
  }
  feil.push(...kildefeil(data.kilde))
  // Én tabell står rett i importen; flere står hver for seg under tabeller.
  if (har(data, 'tabeller')) {
    if (har(data, 'organsystemer')) feil.push('organsystemer: utelat feltet når importen har tabeller; organsystemene står i hver tabell.')
    feil.push(...tabellfeil(data.tabeller))
  } else {
    feil.push(...organsystemfeil(data.organsystemer, 'organsystemer'))
  }
  return feil
}

export type Importkontroll = { ok: true; import: Bivirkningsimport } | { ok: false; feil: string[] }

/** Importen kontrollert: enten klar til å legges inn, eller feilene. */
export function kontrollerImport(data: unknown): Importkontroll {
  const feil = importfeil(data)
  return feil.length > 0 ? { ok: false, feil } : { ok: true, import: data as Bivirkningsimport }
}

/** Tabellene i en import som er kontrollert; én uten nøkkel når organsystemene står rett i importen. */
export function importtabeller(imp: Bivirkningsimport): { nokkel: string | null; organsystemer: Importorgansystemer }[] {
  return imp.tabeller ?? [{ nokkel: null, organsystemer: imp.organsystemer }]
}

/** Antall bivirkninger i en import som er kontrollert. */
export function antallIImport(imp: Bivirkningsimport): number {
  return importtabeller(imp).reduce(
    (sum, t) => sum + t.organsystemer.reduce((s, o) => s + o.frekvenser.reduce((n, f) => n + f.bivirkninger.length, 0), 0),
    0,
  )
}

/* --- Migrasjonen --------------------------------------------------------- */

/** En tekst som dollarsitat, med en markør som ikke står i teksten. */
function dollarsitat(tekst: string): string {
  let n = 0
  while (tekst.includes(`$import${n || ''}$`)) n += 1
  const merke = `$import${n || ''}$`
  return `${merke}${tekst}${merke}`
}

/**
 * Migrasjonen som legger én kontrollert import inn i databasen. Den kaller
 * `bivirkninger.importer`, som kontrollerer importen på nytt, finner fagsiden
 * og erstatter en tidligere import av samme kilde på samme side. Er innholdet
 * det samme som sist, gjør den ingenting.
 */
export function importmigrasjon(imp: Bivirkningsimport): string {
  const json = JSON.stringify(imp, null, 2)
  return [
    `-- Bivirkninger for fagsiden «${imp.stoff}» fra ${imp.kilde.tittel.replace(/\s+/g, ' ')}.`,
    `-- Laget av scripts/lag-bivirkningsimport.ts fra importfila; se docs/bivirkninger.md.`,
    `select bivirkninger.importer(${dollarsitat(json)}::jsonb);`,
  ].join('\n')
}

/** En tekst som SQL-streng i enkle anførselstegn. */
function sqlTekst(tekst: string): string {
  return `'${tekst.replaceAll("'", "''")}'`
}

/**
 * Migrasjonen som trekker tilbake den gjeldende importen av en kilde på en
 * fagside, så bivirkningene fra den ikke vises lenger. Radene står igjen som
 * historikk, og importfila tas ut av repoet i samme endring.
 */
export function tilbaketrekkingsmigrasjon(stoff: string, nokkel: string, begrunnelse: string): string {
  return [
    `-- Trekker tilbake bivirkningene fra kilden «${nokkel}» på fagsiden «${stoff}».`,
    `-- Laget av scripts/lag-bivirkningsimport.ts; se docs/bivirkninger.md.`,
    `select bivirkninger.trekk_tilbake(${[stoff, nokkel, begrunnelse.replace(/\s+/g, ' ').trim()].map(sqlTekst).join(', ')});`,
  ].join('\n')
}

/** Det en migrasjon gjør med bivirkningene: legger inn en import, eller trekker en kilde tilbake. */
export type Bivirkningsendring =
  | { slag: 'import'; stoff: string; nokkel: string; import: unknown }
  | { slag: 'tilbaketrekking'; stoff: string; nokkel: string }

const IMPORTKALL = /bivirkninger\.importer\((\$import\d*\$)([\s\S]*?)\1::jsonb\)/g
const TILBAKETREKKINGSKALL = /bivirkninger\.trekk_tilbake\('((?:[^']|'')*)', '((?:[^']|'')*)', '(?:[^']|'')*'\)/g

/**
 * Endringene i bivirkningene en migrasjon gjør, i rekkefølge, lest ut av
 * SQL-en som `importmigrasjon` og `tilbaketrekkingsmigrasjon` skriver. Testen
 * bruker dem til å holde importfilene i takt med migrasjonene.
 */
export function bivirkningsendringer(sql: string): Bivirkningsendring[] {
  const funn: { plass: number; endring: Bivirkningsendring }[] = []
  for (const m of sql.matchAll(IMPORTKALL)) {
    const data = JSON.parse(m[2]!) as { stoff?: string; kilde?: { nokkel?: string } }
    funn.push({ plass: m.index, endring: { slag: 'import', stoff: String(data.stoff), nokkel: String(data.kilde?.nokkel), import: data } })
  }
  for (const m of sql.matchAll(TILBAKETREKKINGSKALL)) {
    const tekst = (t: string) => t.replaceAll("''", "'")
    funn.push({ plass: m.index, endring: { slag: 'tilbaketrekking', stoff: tekst(m[1]!), nokkel: tekst(m[2]!) } })
  }
  return funn.sort((a, b) => a.plass - b.plass).map((f) => f.endring)
}
