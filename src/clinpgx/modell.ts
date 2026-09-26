/**
 * Farmakogenetiske data fra ClinPGx: formen OUSFAR lagrer dem i, og lesingen
 * av svarene fra ClinPGx' API.
 *
 * ClinPGx sier selv at API-et er under utvikling, og at parametre og svar kan
 * endres. Derfor:
 *
 * - bare det OUSFAR bruker, leses, og hvert felt kontrolleres for seg;
 * - ukjente felt overses, og et valgfritt felt som mangler, blir tomt;
 * - et objekt uten ID kan ikke kobles til noe og forkastes alene — resten av
 *   svaret brukes som før;
 * - svaret slik det kom, lagres ved siden av (`raa` i databasen), så ingenting
 *   går tapt om formen endres og parseren må skrives om.
 *
 * `les…Svar` leser et objekt fra API-et. `les…` leser det OUSFAR har lagret,
 * og brukes i nettleseren; begge tåler manglende og feilformede felt, så en
 * stoffside aldri faller sammen av ett objekt som ikke ser ut som ventet.
 *
 * Alt her er rene funksjoner.
 */

/** Øk når lesingen endres. Står i loggen over synkroniseringene. */
export const PARSERVERSJON = 1

/** Adressen til ClinPGx' egne sider. */
export const CLINPGX_NETTSTED = 'https://www.clinpgx.org'

/* --- Formen OUSFAR lagrer ------------------------------------------------- */

export interface Genref {
  id: string
  symbol: string
}

export interface Kjemikalieref {
  id: string
  navn: string
}

/** En publikasjon eller et dokument ClinPGx oppgir som grunnlag. */
export interface Litteratur {
  tittel: string
  aar: number | null
  /** Lenken til originalkilden: DOI, PubMed Central, PubMed eller adressen ClinPGx gir. */
  lenke: string | null
  pmid: string | null
  doi: string | null
}

/** Fellestrekkene til retningslinjer og preparatomtaler. */
interface Annotasjonsgrunnlag {
  id: string
  navn: string
  /** Organisasjonen eller myndigheten, som ClinPGx skriver den: «CPIC», «DPWG», «FDA», «EMA» … */
  kilde: string
  gener: Genref[]
  legemidler: Kjemikalieref[]
  /** Sammendraget, som ren tekst. */
  sammendrag: string
  /** Sant når annotasjonen har doseringsinformasjon. */
  dosering: boolean
  /** Sant når annotasjonen peker på et alternativt legemiddel. */
  alternativ: boolean
  /** Sant når annotasjonen har annen forskrivningsveiledning. */
  annen_veiledning: boolean
  /** Sant når annotasjonen omtaler barn. */
  barn: boolean
  litteratur: Litteratur[]
}

/** En farmakogenetisk retningslinje (guideline annotation), f.eks. fra CPIC eller DPWG. */
export type Retningslinje = Annotasjonsgrunnlag

/** En farmakogenetisk preparatomtale (drug label annotation), f.eks. fra FDA eller EMA. */
export interface Preparatomtale extends Annotasjonsgrunnlag {
  /** ClinPGx' vurdering av testing, f.eks. «Actionable PGx» eller «Testing Required». */
  testing: string | null
}

/** En genotype eller allel og fenotypen ClinPGx beskriver for den. */
export interface Allelfenotype {
  allel: string
  fenotype: string
}

/** En klinisk annotasjon (clinical/summary annotation). */
export interface KliniskAnnotasjon {
  /** Accession-ID-en, f.eks. PA166135169. */
  id: string
  /** Tall-ID-en ClinPGx' egne sider bruker i adressen, når den finnes. */
  nummer: string | null
  navn: string
  /** Evidensnivået: 1A, 1B, 2A, 2B, 3 eller 4. `null` når det mangler. */
  niva: string | null
  gener: Genref[]
  /** Varianten eller haplotypene, slik ClinPGx viser dem. */
  variant: string
  rsid: string | null
  /** Hva annotasjonen gjelder, f.eks. «Metabolism/PK», «Efficacy», «Toxicity». */
  typer: string[]
  sykdommer: string[]
  fenotyper: Allelfenotype[]
  legemidler: Kjemikalieref[]
  /** Retningslinjene annotasjonen bygger på eller støtter. */
  retningslinjer: string[]
  /** Preparatomtalene annotasjonen er knyttet til. */
  preparatomtaler: string[]
  poeng: number | null
}

/** Et kjemikalie (legemiddel) i ClinPGx. */
export interface Kjemikalie {
  id: string
  navn: string
  /** ATC-kodene ClinPGx har for stoffet. */
  atc: string[]
  typer: string[]
}

export const ANNOTASJONSTYPER = ['retningslinje', 'preparatomtale', 'klinisk'] as const
export type Annotasjonstype = (typeof ANNOTASJONSTYPER)[number]

/* --- Hjelpefunksjoner ---------------------------------------------------- */

export function erObjekt(verdi: unknown): verdi is Record<string, unknown> {
  return typeof verdi === 'object' && verdi !== null && !Array.isArray(verdi)
}

function liste(verdi: unknown): unknown[] {
  return Array.isArray(verdi) ? verdi : []
}

function tekst(verdi: unknown): string {
  if (typeof verdi === 'string') return verdi.replace(/\s+/g, ' ').trim()
  if (typeof verdi === 'number' && Number.isFinite(verdi)) return String(verdi)
  return ''
}

function tekstEllerNull(verdi: unknown): string | null {
  return tekst(verdi) || null
}

function tallEllerNull(verdi: unknown): number | null {
  const tall = typeof verdi === 'string' && verdi.trim() !== '' ? Number(verdi) : verdi
  return typeof tall === 'number' && Number.isFinite(tall) ? tall : null
}

function sant(verdi: unknown): boolean {
  return verdi === true
}

function unike<T>(elementer: readonly T[], nokkel: (e: T) => string): T[] {
  const sett = new Map<string, T>()
  for (const e of elementer) if (!sett.has(nokkel(e))) sett.set(nokkel(e), e)
  return [...sett.values()]
}

/** Bare adresser nettleseren trygt kan åpne. */
export function tryggLenke(verdi: unknown): string | null {
  const t = tekst(verdi)
  return /^https?:\/\/[^\s]+$/i.test(t) ? t.replace(/^http:\/\//i, 'https://') : null
}

const ENTITETER: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

/**
 * HTML fra ClinPGx som ren tekst: avsnitt, overskrifter og punkter på egne
 * linjer, merkene fjernet og tegnene dekodet. OUSFAR viser aldri HTML fra en
 * ekstern kilde.
 */
export function htmlTilTekst(html: unknown): string {
  if (typeof html !== 'string') return ''
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|tr|blockquote|ul|ol|table)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]*>/g, '')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (hele, kode: string) => {
      if (kode[0] === '#') {
        const tall = kode[1] === 'x' || kode[1] === 'X' ? parseInt(kode.slice(2), 16) : parseInt(kode.slice(1), 10)
        return Number.isFinite(tall) && tall > 0 && tall < 0x110000 ? String.fromCodePoint(tall) : hele
      }
      return ENTITETER[kode.toLowerCase()] ?? hele
    })
    .split('\n')
    .map((linje) => linje.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
}

/** Markdown-feltet i ClinPGx' svar (`{ markdown, html }`) som ren tekst. */
function markdowntekst(verdi: unknown): string {
  if (!erObjekt(verdi)) return ''
  return htmlTilTekst(verdi.html) || tekst(verdi.markdown)
}

/* --- Lesingen av svarene fra ClinPGx ------------------------------------- */

function lesGener(verdi: unknown): Genref[] {
  return unike(
    liste(verdi)
      .filter(erObjekt)
      .map((g) => ({ id: tekst(g.id), symbol: tekst(g.symbol) || tekst(g.name) }))
      .filter((g) => g.id && g.symbol),
    (g) => g.id,
  )
}

function lesKjemikalierefer(verdi: unknown): Kjemikalieref[] {
  return unike(
    liste(verdi)
      .filter(erObjekt)
      .map((k) => ({ id: tekst(k.id), navn: tekst(k.name) }))
      .filter((k) => k.id),
    (k) => k.id,
  )
}

function iderI(verdi: unknown): string[] {
  return [...new Set(liste(verdi).filter(erObjekt).map((o) => tekst(o.id)).filter(Boolean))]
}

/** Den beste lenken til en publikasjon: DOI, PubMed Central, PubMed, og ellers adressen ClinPGx gir. */
function lesLitteratur(verdi: unknown): Litteratur[] {
  return unike(
    liste(verdi)
      .filter(erObjekt)
      .map((l): Litteratur => {
        const referanser = liste(l.crossReferences).filter(erObjekt)
        const fra = (ressurs: string) => referanser.find((r) => tekst(r.resource).toLowerCase() === ressurs)
        const doi = tekstEllerNull(fra('doi')?.resourceId)
        const pmid = tekstEllerNull(fra('pubmed')?.resourceId)
        const lenke =
          (doi && `https://doi.org/${doi}`) ||
          tryggLenke(fra('pubmed central')?._url) ||
          (pmid && `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`) ||
          tryggLenke(l._sameAs) ||
          tryggLenke(fra('url')?._url)
        const aar = tallEllerNull(l.year) ?? tallEllerNull(tekst(l.pubDate).slice(0, 4))
        return { tittel: tekst(l.title), aar, lenke: lenke || null, pmid, doi }
      })
      .filter((l) => l.tittel || l.lenke),
    (l) => `${l.tittel}\n${l.lenke ?? ''}`,
  )
}

/** Kilden slik den skal vises: «CPIC», «DPWG», «FDA»; ClinPGx skriver den noen ganger med små bokstaver. */
function lesKilde(verdi: unknown): string {
  const t = tekst(verdi)
  return /^[a-z]{2,6}$/.test(t) ? t.toUpperCase() : t
}

function lesGrunnlag(o: Record<string, unknown>): Annotasjonsgrunnlag | null {
  const id = tekst(o.id)
  if (!/^PA\d+$/.test(id)) return null
  return {
    id,
    navn: tekst(o.name),
    kilde: lesKilde(o.source),
    gener: lesGener(o.relatedGenes),
    legemidler: lesKjemikalierefer(o.relatedChemicals),
    sammendrag: markdowntekst(o.summaryMarkdown),
    dosering: sant(o.dosingInformation),
    alternativ: sant(o.alternateDrugAvailable),
    annen_veiledning: sant(o.otherPrescribingGuidance),
    barn: sant(o.pediatric),
    litteratur: lesLitteratur(o.literature),
  }
}

/** En retningslinje fra `/data/guidelineAnnotation`. `null` når den mangler ID. */
export function lesRetningslinjesvar(o: unknown): Retningslinje | null {
  return erObjekt(o) ? lesGrunnlag(o) : null
}

/** En preparatomtale fra `/data/label`. `null` når den mangler ID. */
export function lesPreparatomtalesvar(o: unknown): Preparatomtale | null {
  if (!erObjekt(o)) return null
  const grunnlag = lesGrunnlag(o)
  if (!grunnlag) return null
  const testing = erObjekt(o.testing) ? tekstEllerNull(o.testing.term) : null
  // Genene preparatomtalen gir forskrivningsråd for, står noen ganger bare her.
  const gener = unike([...grunnlag.gener, ...lesGener(o.prescribingGenes)], (g) => g.id)
  return { ...grunnlag, gener, testing }
}

/** En klinisk annotasjon fra `/data/summaryAnnotation`. `null` når den mangler ID. */
export function lesKliniskSvar(o: unknown): KliniskAnnotasjon | null {
  if (!erObjekt(o)) return null
  const nummer = tekstEllerNull(o.id)
  const accession = tekst(o.accessionId)
  const id = /^PA\d+$/.test(accession) ? accession : nummer
  if (!id) return null
  const sted = erObjekt(o.location) ? o.location : {}
  const niva = erObjekt(o.levelOfEvidence) ? tekstEllerNull(o.levelOfEvidence.term) : null
  return {
    id,
    nummer,
    navn: tekst(o.name),
    niva: niva && EVIDENSNIVAER.includes(niva.toUpperCase() as Evidensniva) ? niva.toUpperCase() : niva,
    gener: lesGener(sted.genes),
    variant: tekst(sted.displayName) || tekst(sted.name),
    rsid: tekstEllerNull(sted.rsid),
    typer: [...new Set(liste(o.types).map(tekst).filter(Boolean))],
    sykdommer: [...new Set(liste(o.relatedDiseases).filter(erObjekt).map((s) => tekst(s.name)).filter(Boolean))],
    fenotyper: liste(o.allelePhenotypes)
      .filter(erObjekt)
      .map((a) => ({ allel: tekst(a.allele), fenotype: tekst(a.phenotype) }))
      .filter((a) => a.allel || a.fenotype),
    legemidler: lesKjemikalierefer(o.relatedChemicals),
    retningslinjer: iderI(o.relatedGuidelines),
    preparatomtaler: iderI(o.relatedLabels),
    poeng: tallEllerNull(o.score),
  }
}

/** Et kjemikalie fra `/data/chemical`. `null` når det mangler ID. */
export function lesKjemikaliesvar(o: unknown): Kjemikalie | null {
  if (!erObjekt(o)) return null
  const id = tekst(o.id)
  if (!/^PA\d+$/.test(id)) return null
  const atc = liste(o.linkOuts)
    .filter(erObjekt)
    .filter((l) => tekst(l.resource).toUpperCase() === 'ATC')
    .map((l) => tekst(l.resourceId).toUpperCase())
    .filter((k) => /^[A-Z]\d{2}[A-Z0-9]{0,4}$/.test(k))
  return { id, navn: tekst(o.name), atc: [...new Set(atc)], typer: [...new Set(liste(o.types).map(tekst).filter(Boolean))] }
}

/* --- Lesingen av det OUSFAR har lagret ----------------------------------- */

function lesLagretGrunnlag(data: unknown): Annotasjonsgrunnlag | null {
  if (!erObjekt(data)) return null
  const id = tekst(data.id)
  if (!id) return null
  return {
    id,
    navn: tekst(data.navn),
    kilde: tekst(data.kilde),
    gener: liste(data.gener)
      .filter(erObjekt)
      .map((g) => ({ id: tekst(g.id), symbol: tekst(g.symbol) }))
      .filter((g) => g.symbol),
    legemidler: liste(data.legemidler)
      .filter(erObjekt)
      .map((k) => ({ id: tekst(k.id), navn: tekst(k.navn) }))
      .filter((k) => k.id),
    sammendrag: typeof data.sammendrag === 'string' ? data.sammendrag.trim() : '',
    dosering: sant(data.dosering),
    alternativ: sant(data.alternativ),
    annen_veiledning: sant(data.annen_veiledning),
    barn: sant(data.barn),
    litteratur: liste(data.litteratur)
      .filter(erObjekt)
      .map((l) => ({
        tittel: tekst(l.tittel),
        aar: tallEllerNull(l.aar),
        lenke: tryggLenke(l.lenke),
        pmid: tekstEllerNull(l.pmid),
        doi: tekstEllerNull(l.doi),
      }))
      .filter((l) => l.tittel || l.lenke),
  }
}

export function lesRetningslinje(data: unknown): Retningslinje | null {
  return lesLagretGrunnlag(data)
}

export function lesPreparatomtale(data: unknown): Preparatomtale | null {
  const grunnlag = lesLagretGrunnlag(data)
  return grunnlag && { ...grunnlag, testing: erObjekt(data) ? tekstEllerNull(data.testing) : null }
}

export function lesKlinisk(data: unknown): KliniskAnnotasjon | null {
  if (!erObjekt(data)) return null
  const id = tekst(data.id)
  if (!id) return null
  return {
    id,
    nummer: tekstEllerNull(data.nummer),
    navn: tekst(data.navn),
    niva: tekstEllerNull(data.niva),
    gener: liste(data.gener)
      .filter(erObjekt)
      .map((g) => ({ id: tekst(g.id), symbol: tekst(g.symbol) }))
      .filter((g) => g.symbol),
    variant: tekst(data.variant),
    rsid: tekstEllerNull(data.rsid),
    typer: liste(data.typer).map(tekst).filter(Boolean),
    sykdommer: liste(data.sykdommer).map(tekst).filter(Boolean),
    fenotyper: liste(data.fenotyper)
      .filter(erObjekt)
      .map((a) => ({ allel: tekst(a.allel), fenotype: typeof a.fenotype === 'string' ? a.fenotype.trim() : '' }))
      .filter((a) => a.allel || a.fenotype),
    legemidler: liste(data.legemidler)
      .filter(erObjekt)
      .map((k) => ({ id: tekst(k.id), navn: tekst(k.navn) }))
      .filter((k) => k.id),
    retningslinjer: liste(data.retningslinjer).map(tekst).filter(Boolean),
    preparatomtaler: liste(data.preparatomtaler).map(tekst).filter(Boolean),
    poeng: tallEllerNull(data.poeng),
  }
}

/* --- Evidensnivåene ------------------------------------------------------ */

/** ClinPGx' evidensnivåer for kliniske annotasjoner, sterkest først. */
export const EVIDENSNIVAER = ['1A', '1B', '2A', '2B', '3', '4'] as const
export type Evidensniva = (typeof EVIDENSNIVAER)[number]

/** Nivåene som vises først; de lavere står bak ett detaljkort til. */
export const HOYE_EVIDENSNIVAER: readonly string[] = ['1A', '1B']

/** Plassen til et evidensnivå i rekkefølgen; ukjente og manglende sist. */
export function evidensplass(niva: string | null): number {
  const plass = EVIDENSNIVAER.indexOf((niva ?? '') as Evidensniva)
  return plass === -1 ? EVIDENSNIVAER.length : plass
}

export function erHoyEvidens(annotasjon: Pick<KliniskAnnotasjon, 'niva'>): boolean {
  return HOYE_EVIDENSNIVAER.includes(annotasjon.niva ?? '')
}

/**
 * De kliniske annotasjonene i visningsrekkefølge: sterkest evidens først,
 * så høyest poengsum fra ClinPGx, så genet og varianten.
 */
export function sorterEtterEvidens<T extends Pick<KliniskAnnotasjon, 'niva' | 'poeng' | 'gener' | 'variant' | 'id'>>(
  annotasjoner: readonly T[],
): T[] {
  return [...annotasjoner].sort(
    (a, b) =>
      evidensplass(a.niva) - evidensplass(b.niva) ||
      (b.poeng ?? -Infinity) - (a.poeng ?? -Infinity) ||
      (a.gener[0]?.symbol ?? '').localeCompare(b.gener[0]?.symbol ?? '') ||
      a.variant.localeCompare(b.variant) ||
      a.id.localeCompare(b.id),
  )
}

/* --- Adressene hos ClinPGx ---------------------------------------------- */

export function retningslinjeadresse(id: string): string {
  return `${CLINPGX_NETTSTED}/guidelineAnnotation/${encodeURIComponent(id)}`
}

export function preparatomtaleadresse(id: string): string {
  return `${CLINPGX_NETTSTED}/labelAnnotation/${encodeURIComponent(id)}`
}

/** ClinPGx' egne sider bruker tall-ID-en for kliniske annotasjoner. */
export function kliniskadresse(annotasjon: Pick<KliniskAnnotasjon, 'id' | 'nummer'>): string {
  return `${CLINPGX_NETTSTED}/clinicalAnnotation/${encodeURIComponent(annotasjon.nummer ?? annotasjon.id)}`
}

export function kjemikalieadresse(id: string): string {
  return `${CLINPGX_NETTSTED}/chemical/${encodeURIComponent(id)}`
}
