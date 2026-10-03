/**
 * Bivirkningene på fagsidene: de faste listene over frekvenskategorier og
 * organsystemer, formen på dataene, og de to visningene av dem.
 *
 * Det finnes ett datasett: hver bivirkning er én rad med stoffet (gjennom
 * kilden), organsystemet, frekvensen, teksten og kilden. Visningen etter
 * frekvens og visningen etter organsystem er den samme lista gruppert to veier
 * (`grupper`), og lagres aldri hver for seg. Hvordan dataene kommer inn, står
 * i `docs/bivirkninger.md`.
 *
 * Kodene her er de samme som i tabellene `bivirkninger.frekvenser` og
 * `bivirkninger.organsystemer` i databasen; testen sammenligner dem. Navnene
 * appen viser, står bare her.
 */

/* --- Frekvenskategoriene ------------------------------------------------- */

/**
 * Frekvenskategoriene i preparatomtalene (SPC), fra den høyeste frekvensen
 * til den laveste, med konvensjonen preparatomtalene bruker. `prikker` er
 * nivået i ikonet (5 for den høyeste); «Ikke kjent» har ikke noe nivå.
 */
export const FREKVENSER = [
  { kode: 'svaert_vanlige', navn: 'Svært vanlige', definisjon: '≥ 1/10', prikker: 5 },
  { kode: 'vanlige', navn: 'Vanlige', definisjon: '≥ 1/100 til < 1/10', prikker: 4 },
  { kode: 'mindre_vanlige', navn: 'Mindre vanlige', definisjon: '≥ 1/1 000 til < 1/100', prikker: 3 },
  { kode: 'sjeldne', navn: 'Sjeldne', definisjon: '≥ 1/10 000 til < 1/1 000', prikker: 2 },
  { kode: 'svaert_sjeldne', navn: 'Svært sjeldne', definisjon: '< 1/10 000', prikker: 1 },
  { kode: 'ikke_kjent', navn: 'Ikke kjent', definisjon: 'kan ikke anslås ut ifra tilgjengelige data', prikker: null },
] as const

export type Frekvens = (typeof FREKVENSER)[number]
export type Frekvenskode = Frekvens['kode']

/* --- Organsystemene ------------------------------------------------------ */

/**
 * Organklassesystemene (SOC) i MedDRA, i den internasjonalt avtalte
 * rekkefølgen preparatomtalene bruker, med de norske navnene fra
 * preparatomtalene, de engelske og MedDRA-koden. `kode` er nøkkelen
 * importen og databasen bruker; den endres aldri, selv om navnet gjør det.
 */
export const ORGANSYSTEMER = [
  { kode: 'infeksiose', meddra: 10021881, navn: 'Infeksiøse og parasittære sykdommer', engelsk: 'Infections and infestations' },
  {
    kode: 'svulster',
    meddra: 10029104,
    navn: 'Godartede, ondartede og uspesifiserte svulster (inkludert cyster og polypper)',
    engelsk: 'Neoplasms benign, malignant and unspecified (incl cysts and polyps)',
  },
  { kode: 'blod_lymfe', meddra: 10005329, navn: 'Sykdommer i blod og lymfatiske organer', engelsk: 'Blood and lymphatic system disorders' },
  { kode: 'immunsystemet', meddra: 10021428, navn: 'Forstyrrelser i immunsystemet', engelsk: 'Immune system disorders' },
  { kode: 'endokrine', meddra: 10014698, navn: 'Endokrine sykdommer', engelsk: 'Endocrine disorders' },
  { kode: 'stoffskifte', meddra: 10027433, navn: 'Stoffskifte- og ernæringsbetingede sykdommer', engelsk: 'Metabolism and nutrition disorders' },
  { kode: 'psykiatriske', meddra: 10037175, navn: 'Psykiatriske lidelser', engelsk: 'Psychiatric disorders' },
  { kode: 'nevrologiske', meddra: 10029205, navn: 'Nevrologiske sykdommer', engelsk: 'Nervous system disorders' },
  { kode: 'oye', meddra: 10015919, navn: 'Øyesykdommer', engelsk: 'Eye disorders' },
  { kode: 'ore_labyrint', meddra: 10013993, navn: 'Sykdommer i øre og labyrint', engelsk: 'Ear and labyrinth disorders' },
  { kode: 'hjerte', meddra: 10007541, navn: 'Hjertesykdommer', engelsk: 'Cardiac disorders' },
  { kode: 'kar', meddra: 10047065, navn: 'Karsykdommer', engelsk: 'Vascular disorders' },
  {
    kode: 'respirasjon',
    meddra: 10038738,
    navn: 'Sykdommer i respirasjonsorganer, thorax og mediastinum',
    engelsk: 'Respiratory, thoracic and mediastinal disorders',
  },
  { kode: 'gastrointestinale', meddra: 10017947, navn: 'Gastrointestinale sykdommer', engelsk: 'Gastrointestinal disorders' },
  { kode: 'lever_galle', meddra: 10019805, navn: 'Sykdommer i lever og galleveier', engelsk: 'Hepatobiliary disorders' },
  { kode: 'hud', meddra: 10040785, navn: 'Hud- og underhudssykdommer', engelsk: 'Skin and subcutaneous tissue disorders' },
  {
    kode: 'muskel_skjelett',
    meddra: 10028395,
    navn: 'Sykdommer i muskler, bindevev og skjelett',
    engelsk: 'Musculoskeletal and connective tissue disorders',
  },
  { kode: 'nyre_urinveier', meddra: 10038359, navn: 'Sykdommer i nyre og urinveier', engelsk: 'Renal and urinary disorders' },
  {
    kode: 'svangerskap',
    meddra: 10036585,
    navn: 'Tilstander i forbindelse med svangerskap, puerperium og perinatalperioden',
    engelsk: 'Pregnancy, puerperium and perinatal conditions',
  },
  { kode: 'kjonnsorganer_bryst', meddra: 10038604, navn: 'Lidelser i kjønnsorganer og brystsykdommer', engelsk: 'Reproductive system and breast disorders' },
  { kode: 'medfodte', meddra: 10010331, navn: 'Medfødte, familiære og genetiske sykdommer', engelsk: 'Congenital, familial and genetic disorders' },
  {
    kode: 'generelle',
    meddra: 10018065,
    navn: 'Generelle lidelser og reaksjoner på administrasjonsstedet',
    engelsk: 'General disorders and administration site conditions',
  },
  { kode: 'undersokelser', meddra: 10022891, navn: 'Undersøkelser', engelsk: 'Investigations' },
  {
    kode: 'skader',
    meddra: 10022117,
    navn: 'Skader, forgiftninger og komplikasjoner ved medisinske prosedyrer',
    engelsk: 'Injury, poisoning and procedural complications',
  },
  { kode: 'prosedyrer', meddra: 10042613, navn: 'Kirurgiske prosedyrer og medisinske prosedyrer', engelsk: 'Surgical and medical procedures' },
  { kode: 'sosiale', meddra: 10041244, navn: 'Sosiale omstendigheter', engelsk: 'Social circumstances' },
  { kode: 'produktproblemer', meddra: 10077536, navn: 'Problemer med produktet', engelsk: 'Product issues' },
] as const

export type Organsystem = (typeof ORGANSYSTEMER)[number]
export type Organsystemkode = Organsystem['kode']

const FREKVENS_PER_KODE = new Map<string, Frekvens>(FREKVENSER.map((f) => [f.kode, f]))
const ORGANSYSTEM_PER_KODE = new Map<string, Organsystem>(ORGANSYSTEMER.map((o) => [o.kode, o]))

/** Plassen i den faste rekkefølgen: 0 for den første. */
const FREKVENSRANG = new Map<string, number>(FREKVENSER.map((f, i) => [f.kode, i]))
const ORGANSYSTEMRANG = new Map<string, number>(ORGANSYSTEMER.map((o, i) => [o.kode, i]))

export function erFrekvenskode(kode: unknown): kode is Frekvenskode {
  return typeof kode === 'string' && FREKVENS_PER_KODE.has(kode)
}

export function erOrgansystemkode(kode: unknown): kode is Organsystemkode {
  return typeof kode === 'string' && ORGANSYSTEM_PER_KODE.has(kode)
}

export function frekvens(kode: Frekvenskode): Frekvens {
  return FREKVENS_PER_KODE.get(kode)!
}

export function organsystem(kode: Organsystemkode): Organsystem {
  return ORGANSYSTEM_PER_KODE.get(kode)!
}

/* --- Dataene ------------------------------------------------------------- */

/** Kildetypene en import kan ha. Bare preparatomtaler ennå. */
export const KILDETYPER = ['spc'] as const
export type Kildetype = (typeof KILDETYPER)[number]

/**
 * Kilden en import kommer fra, med sporbarheten: hvilken preparatomtale,
 * hvilket preparat, hvilken versjon og når den ble importert og kontrollert.
 * `id` er databasens; `nokkel` er den stabile nøkkelen importen gir kilden,
 * så en ny import av den samme preparatomtalen erstatter den forrige.
 */
export interface Bivirkningskilde {
  id: string
  nokkel: string
  type: Kildetype
  tittel: string
  preparat: string | null
  innehaver: string | null
  spc_versjon: string | null
  /** Datoen for siste revisjon av preparatomtalen, `ÅÅÅÅ-MM-DD`. */
  revisjonsdato: string | null
  lenke: string | null
  /** Datoen dataene sist ble kontrollert mot kilden, `ÅÅÅÅ-MM-DD`, og hvem som kontrollerte. */
  kontrollert: string | null
  kontrollert_av: string | null
  merknad: string | null
  importert_kl: string
  importert_av: string
  /** Bivirkningstabellene i preparatomtalen når den har flere, i rekkefølge; tom når den har én. */
  kontekster: Kontekst[]
}

/**
 * Én av flere bivirkningstabeller i en preparatomtale: for en indikasjon, en
 * dosering eller et frekvensgrunnlag (per pasient, per infusjon …). Radene i
 * ulike tabeller er ikke sammenlignbare og blandes aldri.
 */
export interface Kontekst {
  nokkel: string
  navn: string
  /** Hva frekvensene er regnet per, når preparatomtalen sier det. */
  frekvensgrunnlag: string | null
  merknad: string | null
}

/** Én bivirkning, slik den står i kilden. */
export interface Bivirkning {
  /** Kildens `id`. */
  kilde: string
  /** Nøkkelen til tabellen (konteksten) i kilden; `null` når kilden har én tabell. */
  kontekst: string | null
  organsystem: Organsystemkode
  frekvens: Frekvenskode
  tekst: string
  fotnote: string | null
  /** Rekkefølgen i kilden, innenfor tabellen, organsystemet og frekvensen. */
  posisjon: number
}

/** Bivirkningene for én fagside: kildene som gjelder, og radene fra dem. */
export interface Bivirkningsdata {
  kilder: Bivirkningskilde[]
  bivirkninger: Bivirkning[]
}

export const INGEN_BIVIRKNINGER: Bivirkningsdata = { kilder: [], bivirkninger: [] }

/** En bivirkningstabell: én kilde, eventuelt én kontekst i den, og radene i tabellen. */
export interface Tabell {
  kilde: Bivirkningskilde
  kontekst: Kontekst | null
  bivirkninger: Bivirkning[]
}

/**
 * Bivirkningene delt i tabellene de står i — kilde for kilde, og i hver kilde
 * kontekst for kontekst — så rader fra ulike preparatomtaler, indikasjoner,
 * doseringer eller frekvensgrunnlag aldri havner i samme gruppe. Bare tabeller
 * med rader er med, i kildenes rekkefølge og preparatomtalens.
 */
export function tabeller(data: Bivirkningsdata): Tabell[] {
  return data.kilder.flatMap((kilde) =>
    [null, ...kilde.kontekster].flatMap((kontekst): Tabell[] => {
      const rader = data.bivirkninger.filter((b) => b.kilde === kilde.id && b.kontekst === (kontekst?.nokkel ?? null))
      return rader.length > 0 ? [{ kilde, kontekst, bivirkninger: rader }] : []
    }),
  )
}

/** Den faste ID-en til en tabell, f.eks. `preparat-spc` eller `preparat-spc_per-infusjon`. Nøklene har aldri `_`. */
export function tabellid(tabell: Pick<Tabell, 'kilde' | 'kontekst'>): string {
  return tabell.kontekst ? `${tabell.kilde.nokkel}_${tabell.kontekst.nokkel}` : tabell.kilde.nokkel
}

/* --- Visningene ---------------------------------------------------------- */

/** De to måtene seksjonen viser de samme dataene på. */
export const VISNINGER = [
  { kode: 'frekvens', navn: 'Frekvens' },
  { kode: 'organsystem', navn: 'Organsystem' },
] as const
export type Visning = (typeof VISNINGER)[number]['kode']

export type Gruppenokkel = { slag: 'frekvens'; kode: Frekvenskode } | { slag: 'organsystem'; kode: Organsystemkode }

/** En kombinasjon av organsystem og frekvens, med bivirkningene i den. */
export interface Undergruppe {
  nokkel: Gruppenokkel
  bivirkninger: Bivirkning[]
}

/** En frekvens eller et organsystem, med kombinasjonene under. */
export interface Gruppe {
  nokkel: Gruppenokkel
  undergrupper: Undergruppe[]
}

function nokkelFor(slag: Visning, rad: Bivirkning): Gruppenokkel {
  return slag === 'frekvens' ? { slag, kode: rad.frekvens } : { slag, kode: rad.organsystem }
}

function rang(nokkel: Gruppenokkel): number {
  return (nokkel.slag === 'frekvens' ? FREKVENSRANG : ORGANSYSTEMRANG).get(nokkel.kode) ?? Number.MAX_SAFE_INTEGER
}

const motsatt = (visning: Visning): Visning => (visning === 'frekvens' ? 'organsystem' : 'frekvens')

/**
 * Bivirkningene i én tabell gruppert for en visning: etter frekvens med
 * organsystemene under, eller etter organsystem med frekvensene under.
 * Gruppene står i den faste rekkefølgen (frekvensen fra høyest til lavest,
 * organsystemene som i preparatomtalene), og bare kombinasjoner med minst én
 * bivirkning er med — en tom gruppe finnes ikke. Innenfor en kombinasjon står
 * bivirkningene i preparatomtalens rekkefølge. Gis rader fra flere tabeller,
 * står de tabell for tabell; siden grupperer hver tabell for seg (`tabeller`).
 */
export function grupper(bivirkninger: readonly Bivirkning[], visning: Visning): Gruppe[] {
  const indre = motsatt(visning)
  const ytre = new Map<string, { nokkel: Gruppenokkel; under: Map<string, Undergruppe> }>()
  for (const rad of bivirkninger) {
    const y = nokkelFor(visning, rad)
    const i = nokkelFor(indre, rad)
    let gruppe = ytre.get(y.kode)
    if (!gruppe) ytre.set(y.kode, (gruppe = { nokkel: y, under: new Map() }))
    let under = gruppe.under.get(i.kode)
    if (!under) gruppe.under.set(i.kode, (under = { nokkel: i, bivirkninger: [] }))
    under.bivirkninger.push(rad)
  }
  const tabellrekkefolge = new Map<string, number>()
  const tabellAv = (rad: Bivirkning) => `${rad.kilde} ${rad.kontekst ?? ''}`
  for (const rad of bivirkninger) if (!tabellrekkefolge.has(tabellAv(rad))) tabellrekkefolge.set(tabellAv(rad), tabellrekkefolge.size)
  const iKilden = (a: Bivirkning, b: Bivirkning) =>
    tabellrekkefolge.get(tabellAv(a))! - tabellrekkefolge.get(tabellAv(b))! || a.posisjon - b.posisjon
  return [...ytre.values()]
    .sort((a, b) => rang(a.nokkel) - rang(b.nokkel))
    .map(({ nokkel, under }) => ({
      nokkel,
      undergrupper: [...under.values()]
        .sort((a, b) => rang(a.nokkel) - rang(b.nokkel))
        .map((u) => ({ nokkel: u.nokkel, bivirkninger: [...u.bivirkninger].sort(iKilden) })),
    }))
}

/** Navnet på en frekvens eller et organsystem, slik siden viser det. */
export function gruppenavn(nokkel: Gruppenokkel): string {
  return nokkel.slag === 'frekvens' ? frekvens(nokkel.kode).navn : organsystem(nokkel.kode).navn
}

/** Forstavelsen til ID-ene i en tabell når siden har flere, f.eks. `tabell-preparat-spc_per-infusjon--`. */
export const TABELLFORSTAVELSE = /^tabell-[a-z0-9_-]+?--/

/**
 * Den faste ID-en en gruppe har på siden og i adressen, f.eks.
 * `frekvens-vanlige`. Har siden flere tabeller, står tabellen (`tabellid`)
 * foran: `tabell-preparat-spc--frekvens-vanlige`.
 */
export function gruppeid(nokkel: Gruppenokkel, tabell: string | null = null): string {
  return `${tabell ? `tabell-${tabell}--` : ''}${nokkel.slag}-${nokkel.kode.replaceAll('_', '-')}`
}

/** ID-en til en kombinasjon inne i en gruppe, f.eks. `frekvens-vanlige--organsystem-hjerte`. */
export function undergruppeid(gruppe: Gruppenokkel, under: Gruppenokkel, tabell: string | null = null): string {
  return `${gruppeid(gruppe, tabell)}--${gruppeid(under)}`
}
