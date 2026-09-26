/**
 * Formen OUSFAR lagrer CPIC-dataene i, og lesingen av radene fra CPICs API.
 *
 * CPICs API (`api.cpicpgx.org/v1`) er PostgREST rett over CPIC-databasen: hver
 * tabell er et endepunkt, og hver rad kommer som et JSON-objekt med
 * kolonnenavnene i små bokstaver. Hver type under sier hvilken tabell den
 * kommer fra, hvilke kolonner som hentes, og hvordan en rad leses.
 *
 * Lesingen er defensiv: en rad uten ID, eller uten det den må ha for å henge
 * sammen med resten, forkastes alene og telles. Ukjente kolonner overses. Et
 * felt med feil type blir `null` (eller en tom liste), ikke en feil.
 *
 * Verdiene er CPICs egne og oversettes aldri: fenotyper, aktivitetsverdier,
 * allelstatus, anbefalingstekster, klassifiseringer og nivåer står som CPIC
 * skrev dem. Bare feltnavnene er OUSFARs.
 *
 * Øk {@link PARSERVERSJON} når lesingen endres, så alt leses inn på nytt.
 */

export const PARSERVERSJON = 1

export const CPIC_NETTSTED = 'https://cpicpgx.org'

type Rad = Record<string, unknown>

/* --- Små lesere ----------------------------------------------------------- */

function erRad(v: unknown): v is Rad {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function tekst(v: unknown): string | null {
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t === '' ? null : t
}

function heltall(v: unknown): number | null {
  return typeof v === 'number' && Number.isInteger(v) ? v : null
}

function sannhet(v: unknown): boolean | null {
  return typeof v === 'boolean' ? v : null
}

function tekster(v: unknown): string[] {
  return Array.isArray(v) ? v.map(tekst).filter((t): t is string => t !== null) : []
}

/** Et objekt med tekstverdier, som CPICs `{"CYP2D6": "Poor Metabolizer"}`. Andre verdier overses. */
function tekstkart(v: unknown): Record<string, string> {
  if (!erRad(v)) return {}
  const kart: Record<string, string> = {}
  for (const [n, verdi] of Object.entries(v)) {
    const t = tekst(verdi)
    if (t !== null && n.trim() !== '') kart[n.trim()] = t
  }
  return kart
}

/** Et objekt med tallverdier, som diplotypenøkkelen `{"*1": 1, "*4": 1}`. */
function tallkart(v: unknown): Record<string, number> {
  if (!erRad(v)) return {}
  const kart: Record<string, number> = {}
  for (const [n, verdi] of Object.entries(v)) {
    if (typeof verdi === 'number' && Number.isFinite(verdi)) kart[n] = verdi
  }
  return kart
}

/** En ID som tekst: CPIC bruker både tall og tekst som nøkler. */
function id(v: unknown): string | null {
  if (typeof v === 'number' && Number.isInteger(v)) return String(v)
  return tekst(v)
}

/* --- Typene --------------------------------------------------------------- */

export interface Legemiddel {
  /** CPICs ID, «kilde:id», f.eks. «RxNorm:704». */
  id: string
  navn: string
  clinpgx_id: string | null
  rxnorm: string | null
  drugbank: string | null
  atc: string[]
  umls: string | null
  retningslinje_id: string | null
  flytskjema_url: string | null
}

/** Hvordan et resultat for genet slås opp i anbefalingene, som CPIC skriver det. */
export type Oppslagsmetode = 'PHENOTYPE' | 'ACTIVITY_SCORE' | 'ALLELE_STATUS'

export interface Gen {
  symbol: string
  kromosom: string | null
  clinpgx_id: string | null
  hgnc_id: string | null
  ncbi_id: string | null
  ensembl_id: string | null
  /** `null` når CPIC ikke har oppgitt en kjent metode. */
  oppslagsmetode: Oppslagsmetode | null
  merknad_diplotyper: string | null
  merknad_allelnavn: string | null
  url: string | null
}

export interface Retningslinje {
  id: string
  navn: string
  url: string | null
  gener: string[]
  clinpgx_id: string | null
  /** CPICs merknad om bruken, f.eks. at warfarin ikke følger en enkel oversettelse. */
  bruksmerknad: string | null
}

export interface Par {
  id: string
  gen: string
  legemiddel_id: string
  retningslinje_id: string | null
  /** Om genet brukes til å slå opp anbefalinger for legemiddelet. */
  brukt_i_anbefaling: boolean
  cpic_niva: string | null
  clinpgx_niva: string | null
  pgx_testing: string | null
  pmid: string[]
  fjernet: boolean
  fjernet_dato: string | null
  fjernet_grunn: string | null
}

/**
 * Betingelsen en anbefaling stiller for ett gen. En anbefaling kan ha flere
 * gener, og hvert gen kan være angitt med fenotype, aktivitetsverdi eller
 * allelstatus — eller flere av dem. `oppslagsverdi` er det CPIC slår opp på.
 */
export interface Betingelse {
  gen: string
  oppslagsverdi: string | null
  fenotype: string | null
  aktivitetsverdi: string | null
  allelstatus: string | null
  implikasjon: string | null
}

export interface Anbefaling {
  id: string
  retningslinje_id: string
  legemiddel_id: string
  /** Én per gen, i alfabetisk rekkefølge. */
  betingelser: Betingelse[]
  /** CPICs oppslagsnøkkel slik den er: gen → oppslagsverdi. */
  oppslagsnokkel: Record<string, string>
  anbefaling: string | null
  /** Styrken: «Strong», «Moderate», «Optional», «No Recommendation» … */
  klassifisering: string | null
  populasjon: string | null
  kommentarer: string | null
  dosejustering: boolean | null
  alternativt_legemiddel: boolean | null
  annen_veiledning: boolean | null
}

export interface Genresultat {
  id: string
  gen: string
  /** Fenotypen eller allelstatusen. */
  resultat: string
  aktivitetsverdi: string | null
  ehr_prioritet: string | null
  konsultasjonstekst: string | null
}

export interface Genresultatoppslag {
  id: string
  genresultat_id: string
  /** Allelfunksjonene, aktivitetsverdiene eller allelstatusene som gir resultatet, med antall. */
  oppslagsnokkel: Record<string, number>
  funksjon1: string | null
  funksjon2: string | null
  aktivitetsverdi1: string | null
  aktivitetsverdi2: string | null
  total_aktivitetsverdi: string | null
  beskrivelse: string | null
}

export interface Diplotype {
  id: string
  oppslag_id: string
  diplotype: string
  /** Gen → allel → antall, som CPIC normaliserer diplotypen. */
  nokkel: Record<string, Record<string, number>>
}

export interface Allel {
  id: string
  gen: string
  navn: string
  funksjon: string | null
  klinisk_funksjon: string | null
  klinisk_substrat: string | null
  aktivitetsverdi: string | null
  definisjon_id: string | null
  pmid: string[]
  evidensstyrke: string | null
  funksjonskommentar: string | null
  funn: string | null
}

export interface Alleldefinisjon {
  id: string
  gen: string
  navn: string
  pharmvar_id: string | null
  lik_referansesekvens: boolean | null
  strukturell_variasjon: boolean | null
}

export interface Publikasjon {
  id: string
  retningslinje_id: string | null
  tittel: string | null
  forfattere: string[]
  tidsskrift: string | null
  aar: number | null
  maaned: number | null
  volum: string | null
  side: string | null
  pmid: string | null
  pmcid: string | null
  doi: string | null
  url: string | null
}

export interface Term {
  id: string
  kategori: string | null
  term: string
  funksjonell_definisjon: string | null
  genetisk_definisjon: string | null
  loinc: string | null
}

export interface Endring {
  dato: string | null
  type: string | null
  entitet_id: string | null
  merknad: string
  release: string | null
}

/* --- Lesingen av radene ----------------------------------------------------- */

/** En lest rad: ID-en, CPICs versjonsnummer for den, og dataene. */
export interface Lest<T> {
  id: string
  versjon: number | null
  data: T
}

function lest<T>(rad: Rad, radId: string | null, data: T | null): Lest<T> | null {
  if (radId === null || data === null) return null
  return { id: radId, versjon: heltall(rad.version), data }
}

const OPPSLAGSMETODER: readonly Oppslagsmetode[] = ['PHENOTYPE', 'ACTIVITY_SCORE', 'ALLELE_STATUS']

export function lesLegemiddel(r: Rad): Lest<Legemiddel> | null {
  const drugid = tekst(r.drugid)
  const navn = tekst(r.name)
  return lest(r, drugid, drugid && navn ? {
    id: drugid,
    navn,
    clinpgx_id: tekst(r.clinpgxid),
    rxnorm: tekst(r.rxnormid),
    drugbank: tekst(r.drugbankid),
    atc: tekster(r.atcid),
    umls: tekst(r.umlscui),
    retningslinje_id: id(r.guidelineid),
    flytskjema_url: tekst(r.flowchart),
  } : null)
}

export function lesGen(r: Rad): Lest<Gen> | null {
  const symbol = tekst(r.symbol)
  const metode = tekst(r.lookupmethod)
  return lest(r, symbol, symbol ? {
    symbol,
    kromosom: tekst(r.chr),
    clinpgx_id: tekst(r.clinpgxid),
    hgnc_id: tekst(r.hgncid),
    ncbi_id: tekst(r.ncbiid),
    ensembl_id: tekst(r.ensemblid),
    oppslagsmetode: OPPSLAGSMETODER.find((m) => m === metode) ?? null,
    merknad_diplotyper: tekst(r.notesondiplotype),
    merknad_allelnavn: tekst(r.notesonallelenaming),
    url: tekst(r.url),
  } : null)
}

export function lesRetningslinje(r: Rad): Lest<Retningslinje> | null {
  const rid = id(r.id)
  const navn = tekst(r.name)
  return lest(r, rid, rid && navn ? {
    id: rid,
    navn,
    url: tekst(r.url),
    gener: tekster(r.genes),
    clinpgx_id: tekst(r.clinpgxid),
    bruksmerknad: tekst(r.notesonusage),
  } : null)
}

export function lesPar(r: Rad): Lest<Par> | null {
  const pid = id(r.pairid)
  const gen = tekst(r.genesymbol)
  const legemiddel = tekst(r.drugid)
  return lest(r, pid, pid && gen && legemiddel ? {
    id: pid,
    gen,
    legemiddel_id: legemiddel,
    retningslinje_id: id(r.guidelineid),
    brukt_i_anbefaling: r.usedforrecommendation === true,
    cpic_niva: tekst(r.cpiclevel),
    clinpgx_niva: tekst(r.clinpgxlevel),
    pgx_testing: tekst(r.pgxtesting),
    pmid: tekster(r.citations),
    fjernet: r.removed === true,
    fjernet_dato: tekst(r.removeddate),
    fjernet_grunn: tekst(r.removedreason),
  } : null)
}

export function lesAnbefaling(r: Rad): Lest<Anbefaling> | null {
  const aid = id(r.id)
  const retningslinje = id(r.guidelineid)
  const legemiddel = tekst(r.drugid)
  if (!aid || !retningslinje || !legemiddel) return null

  const oppslag = tekstkart(r.lookupkey)
  const fenotyper = tekstkart(r.phenotypes)
  const aktivitet = tekstkart(r.activityscore)
  const allelstatus = tekstkart(r.allelestatus)
  const implikasjoner = tekstkart(r.implications)
  const gener = [...new Set([oppslag, fenotyper, aktivitet, allelstatus, implikasjoner].flatMap(Object.keys))].sort()

  return lest(r, aid, {
    id: aid,
    retningslinje_id: retningslinje,
    legemiddel_id: legemiddel,
    betingelser: gener.map((gen) => ({
      gen,
      oppslagsverdi: oppslag[gen] ?? null,
      fenotype: fenotyper[gen] ?? null,
      aktivitetsverdi: aktivitet[gen] ?? null,
      allelstatus: allelstatus[gen] ?? null,
      implikasjon: implikasjoner[gen] ?? null,
    })),
    oppslagsnokkel: oppslag,
    anbefaling: tekst(r.drugrecommendation),
    klassifisering: tekst(r.classification),
    populasjon: tekst(r.population),
    kommentarer: tekst(r.comments),
    dosejustering: sannhet(r.dosinginformation),
    alternativt_legemiddel: sannhet(r.alternatedrugavailable),
    annen_veiledning: sannhet(r.otherprescribingguidance),
  })
}

export function lesGenresultat(r: Rad): Lest<Genresultat> | null {
  const gid = id(r.id)
  const gen = tekst(r.genesymbol)
  const resultat = tekst(r.result)
  return lest(r, gid, gid && gen && resultat ? {
    id: gid,
    gen,
    resultat,
    aktivitetsverdi: tekst(r.activityscore),
    ehr_prioritet: tekst(r.ehrpriority),
    konsultasjonstekst: tekst(r.consultationtext),
  } : null)
}

export function lesGenresultatoppslag(r: Rad): Lest<Genresultatoppslag> | null {
  const oid = id(r.id)
  const resultat = id(r.phenotypeid)
  return lest(r, oid, oid && resultat ? {
    id: oid,
    genresultat_id: resultat,
    oppslagsnokkel: tallkart(r.lookupkey),
    funksjon1: tekst(r.function1),
    funksjon2: tekst(r.function2),
    aktivitetsverdi1: tekst(r.activityvalue1),
    aktivitetsverdi2: tekst(r.activityvalue2),
    total_aktivitetsverdi: tekst(r.totalactivityscore),
    beskrivelse: tekst(r.description),
  } : null)
}

export function lesDiplotype(r: Rad): Lest<Diplotype> | null {
  const did = id(r.id)
  const oppslag = id(r.functionphenotypeid)
  const diplotype = tekst(r.diplotype)
  const nokkel: Record<string, Record<string, number>> = {}
  if (erRad(r.diplotypekey)) {
    for (const [gen, alleler] of Object.entries(r.diplotypekey)) nokkel[gen] = tallkart(alleler)
  }
  return lest(r, did, did && oppslag && diplotype ? { id: did, oppslag_id: oppslag, diplotype, nokkel } : null)
}

export function lesAllel(r: Rad): Lest<Allel> | null {
  const aid = id(r.id)
  const gen = tekst(r.genesymbol)
  const navn = tekst(r.name)
  return lest(r, aid, aid && gen && navn ? {
    id: aid,
    gen,
    navn,
    funksjon: tekst(r.functionalstatus),
    klinisk_funksjon: tekst(r.clinicalfunctionalstatus),
    klinisk_substrat: tekst(r.clinicalfunctionalsubstrate),
    aktivitetsverdi: tekst(r.activityvalue),
    definisjon_id: id(r.definitionid),
    pmid: tekster(r.citations),
    evidensstyrke: tekst(r.strength),
    funksjonskommentar: tekst(r.functioncomments),
    funn: tekst(r.findings),
  } : null)
}

export function lesAlleldefinisjon(r: Rad): Lest<Alleldefinisjon> | null {
  const did = id(r.id)
  const gen = tekst(r.genesymbol)
  const navn = tekst(r.name)
  return lest(r, did, did && gen && navn ? {
    id: did,
    gen,
    navn,
    pharmvar_id: tekst(r.pharmvarid),
    lik_referansesekvens: sannhet(r.matchesreferencesequence),
    strukturell_variasjon: sannhet(r.structuralvariation),
  } : null)
}

export function lesPublikasjon(r: Rad): Lest<Publikasjon> | null {
  const pid = id(r.id)
  return lest(r, pid, pid ? {
    id: pid,
    retningslinje_id: id(r.guidelineid),
    tittel: tekst(r.title),
    forfattere: tekster(r.authors),
    tidsskrift: tekst(r.journal),
    aar: heltall(r.year),
    maaned: heltall(r.month),
    volum: tekst(r.volume),
    side: tekst(r.page),
    pmid: tekst(r.pmid),
    pmcid: tekst(r.pmcid),
    doi: tekst(r.doi),
    url: tekst(r.url),
  } : null)
}

export function lesTerm(r: Rad): Lest<Term> | null {
  const tid = id(r.id)
  const term = tekst(r.term)
  return lest(r, tid, tid && term ? {
    id: tid,
    kategori: tekst(r.category),
    term,
    funksjonell_definisjon: tekst(r.functionaldef),
    genetisk_definisjon: tekst(r.geneticdef),
    loinc: tekst(r.loinc),
  } : null)
}

/**
 * CPICs endringslogg har ingen ID. OUSFAR lager en av innholdet, så samme
 * føring alltid får samme ID; `lagId` er en kontrollsum over tekst.
 */
export function lesEndring(r: Rad, lagId: (tekst: string) => string): Lest<Endring> | null {
  const merknad = tekst(r.note)
  if (!merknad) return null
  const data: Endring = {
    dato: tekst(r.date),
    type: tekst(r.type),
    entitet_id: tekst(r.entityid),
    merknad,
    release: tekst(r.deployedrelease),
  }
  return lest(r, lagId(JSON.stringify([data.dato, data.type, data.entitet_id, merknad])), data)
}

/* --- Hva som hentes ------------------------------------------------------- */

export const ENTITETER = [
  'legemiddel',
  'gen',
  'retningslinje',
  'par',
  'anbefaling',
  'genresultat',
  'genresultat_oppslag',
  'diplotype',
  'allel',
  'alleldefinisjon',
  'publikasjon',
  'term',
  'endring',
] as const

export type Entitetnavn = (typeof ENTITETER)[number]

export interface Entitet {
  navn: Entitetnavn
  /** Tabellen i CPICs API. */
  tabell: string
  /** Kolonnene som hentes (`select`), eller alle. */
  kolonner?: string
  /** Kolonnene uttrekket sorteres på, så sidene henger sammen. */
  rekkefolge: string
  /** Om raden slik CPIC ga den, lagres ved siden av. */
  raa: boolean
  les(rad: Rad, lagId: (tekst: string) => string): Lest<object> | null
}

/**
 * Tabellene som hentes. Diplotypene er over hundre tusen rader; der hentes
 * bare det oppslaget trenger, og rådataene lagres ikke. Eksempeltekstene for
 * klinisk beslutningsstøtte (`test_alert`) hentes ikke: de handler om når det
 * bør testes, og det er ikke OUSFARs bruk.
 */
export const KILDETABELLER: readonly Entitet[] = [
  { navn: 'legemiddel', tabell: 'drug', rekkefolge: 'drugid', raa: true, les: lesLegemiddel },
  { navn: 'gen', tabell: 'gene', rekkefolge: 'symbol', raa: true, les: lesGen },
  { navn: 'retningslinje', tabell: 'guideline', rekkefolge: 'id', raa: true, les: lesRetningslinje },
  { navn: 'par', tabell: 'pair', rekkefolge: 'pairid', raa: true, les: lesPar },
  { navn: 'anbefaling', tabell: 'recommendation', rekkefolge: 'id', raa: true, les: lesAnbefaling },
  { navn: 'genresultat', tabell: 'gene_result', rekkefolge: 'id', raa: true, les: lesGenresultat },
  { navn: 'genresultat_oppslag', tabell: 'gene_result_lookup', rekkefolge: 'id', raa: true, les: lesGenresultatoppslag },
  {
    navn: 'diplotype',
    tabell: 'gene_result_diplotype',
    kolonner: 'id,functionphenotypeid,diplotype,diplotypekey',
    rekkefolge: 'id',
    raa: false,
    les: lesDiplotype,
  },
  { navn: 'allel', tabell: 'allele', rekkefolge: 'id', raa: true, les: lesAllel },
  { navn: 'alleldefinisjon', tabell: 'allele_definition', rekkefolge: 'id', raa: true, les: lesAlleldefinisjon },
  { navn: 'publikasjon', tabell: 'publication', rekkefolge: 'id', raa: true, les: lesPublikasjon },
  { navn: 'term', tabell: 'term', rekkefolge: 'id', raa: true, les: lesTerm },
  {
    navn: 'endring',
    tabell: 'change_log',
    rekkefolge: 'date,type,entityid,note',
    raa: false,
    les: (r, lagId) => lesEndring(r, lagId),
  },
]

/* --- Adressene hos CPIC ----------------------------------------------------- */

export function pubmedUrl(pmid: string): string {
  return `https://pubmed.ncbi.nlm.nih.gov/${encodeURIComponent(pmid)}/`
}
