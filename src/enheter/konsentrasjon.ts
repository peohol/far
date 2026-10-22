/**
 * Konsentrasjonsenhetene, omregningen mellom dem og hvordan tallene vises
 * (`docs/farmakologiportalen.md`).
 *
 * Bare enheter for masse eller stoffmengde per liter regnes om. Mellom masse
 * og stoffmengde trengs molekylvekten til forbindelsen som faktisk måles, og
 * den må være verifisert (PubChem, `docs/kjemi.md`). Alt annet — kvalitative
 * svar, enheter per kreatinin, prosent, promille — står som kilden oppga det.
 *
 * Ren TypeScript uten avhengigheter: brukes både av synkroniseringen på
 * serveren og av fagsidene.
 */

export type Enhetsslag = 'masse' | 'stoff'

export interface Enhetsdefinisjon {
  /** Enheten slik OUSFAR skriver den. */
  enhet: string
  slag: Enhetsslag
  /** Antall av grunnenheten (µg/L for masse, nmol/L for stoffmengde) i én av denne. */
  faktor: number
}

export const KONSENTRASJONSENHETER: readonly Enhetsdefinisjon[] = [
  { enhet: 'g/L', slag: 'masse', faktor: 1e6 },
  { enhet: 'mg/L', slag: 'masse', faktor: 1e3 },
  { enhet: 'µg/L', slag: 'masse', faktor: 1 },
  { enhet: 'ng/L', slag: 'masse', faktor: 1e-3 },
  { enhet: 'mol/L', slag: 'stoff', faktor: 1e9 },
  { enhet: 'mmol/L', slag: 'stoff', faktor: 1e6 },
  { enhet: 'µmol/L', slag: 'stoff', faktor: 1e3 },
  { enhet: 'nmol/L', slag: 'stoff', faktor: 1 },
]

/** Enhetene fagsidene kan vise måleområdene i. */
export const VISNINGSENHETER = ['µg/L', 'nmol/L', 'µmol/L'] as const
export type Visningsenhet = (typeof VISNINGSENHETER)[number]

/** Skrivemåter som betyr det samme som en av enhetene over. */
const SAMME_SOM: Record<string, string> = {
  'mg/ml': 'g/L',
  'µg/ml': 'mg/L',
  'ng/ml': 'µg/L',
  'pg/ml': 'ng/L',
  'mmol/ml': 'mol/L',
  'µmol/ml': 'mmol/L',
  'nmol/ml': 'µmol/L',
  'pmol/ml': 'nmol/L',
}

const ETTER_NOKKEL = new Map(KONSENTRASJONSENHETER.map((d) => [d.enhet.toLowerCase(), d]))

/** Enheten skrevet så små forskjeller ikke teller: «ug/l», «μg/L» (gresk my) og «µg/L» er det samme. */
function enhetsnokkel(tekst: string): string {
  return tekst
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/^u(?=[gm])|^mc(?=g)/, 'µ')
    .replace(/μ/g, 'µ')
    .replace(/liter$/, 'l')
}

/** Konsentrasjonsenheten en tekst står for, eller `null` når det ikke er en OUSFAR kan regne om. */
export function lesKonsentrasjonsenhet(tekst: string | null | undefined): Enhetsdefinisjon | null {
  if (!tekst) return null
  const nokkel = enhetsnokkel(tekst)
  return ETTER_NOKKEL.get(SAMME_SOM[nokkel]?.toLowerCase() ?? nokkel) ?? null
}

/**
 * Verdien i en annen enhet, eller `null` når den ikke kan regnes om. Mellom
 * masse og stoffmengde trengs molekylvekten (g/mol).
 */
export function regnOm(verdi: number, fra: Enhetsdefinisjon, til: Enhetsdefinisjon, molvekt?: number | null): number | null {
  if (!Number.isFinite(verdi)) return null
  const grunn = verdi * fra.faktor
  if (fra.slag === til.slag) return grunn / til.faktor
  if (!molvekt || !Number.isFinite(molvekt) || molvekt <= 0) return null
  // 1 µg/L = 1000 / M nmol/L, med M i g/mol.
  const iTil = fra.slag === 'masse' ? (grunn * 1000) / molvekt : (grunn * molvekt) / 1000
  return iTil / til.faktor
}

const SIFRE = new Intl.NumberFormat('nb-NO', { maximumSignificantDigits: 2, useGrouping: false })

/** Et tall med høyst to gjeldende sifre, med desimalkomma: 1,2364 → «1,2», 17,1 → «17», 1356,15 → «1400». */
export function visTall(verdi: number): string {
  return SIFRE.format(verdi).replace('−', '-')
}

/* --- Verdiene slik kildene skriver dem -------------------------------------- */

export type Komparator = '<' | '>' | '≤' | '≥'

/** En grense i et måleområde: det kilden skrev, og tallet når det kunne leses. */
export interface Grense {
  original: string
  verdi: number | null
  komparator: Komparator | null
  /** En enhet som sto i selve verdien («20 µg/L»). */
  enhet: string | null
}

const KOMPARATORER: Record<string, Komparator> = { '<': '<', '>': '>', '<=': '≤', '>=': '≥', '≤': '≤', '≥': '≥' }

/**
 * Leser en grense slik laboratoriene skriver den: «0,10», «1.5», «< 0,05»,
 * «20 µg/L», «1 000». `null` når feltet er tomt. Et tall som ikke kan leses
 * sikkert, får `verdi: null` og står som det ble skrevet.
 */
export function lesGrense(tekst: unknown): Grense | null {
  if (typeof tekst !== 'string' && typeof tekst !== 'number') return null
  const original = String(tekst).replace(/ /g, ' ').trim()
  if (!original) return null
  const m = /^(<=|>=|[<>≤≥])?\s*([0-9]+(?:[ ][0-9]{3})*(?:[.,][0-9]+)?)\s*(\S.*)?$/.exec(original)
  if (!m) return { original, verdi: null, komparator: null, enhet: null }
  const [, komp, tall, rest] = m
  const enhet = rest ? (lesKonsentrasjonsenhet(rest)?.enhet ?? null) : null
  if (rest && !enhet) return { original, verdi: null, komparator: null, enhet: null }
  const verdi = Number(tall!.replace(/ /g, '').replace(',', '.'))
  return { original, verdi: Number.isFinite(verdi) ? verdi : null, komparator: komp ? KOMPARATORER[komp]! : null, enhet }
}

/** En grense som tekst, med høyst to gjeldende sifre når tallet er kjent. */
export function visGrense(grense: Pick<Grense, 'verdi' | 'komparator' | 'original'>, verdi = grense.verdi): string {
  if (verdi === null) return grense.original
  return `${grense.komparator ? `${grense.komparator} ` : ''}${visTall(verdi)}`
}

/** Et område: «5—500», «fra 0,1», «opptil 2». Tom når ingen av grensene er oppgitt. */
export function visOmrade(nedre: string | null, ovre: string | null): string {
  if (nedre && ovre) return `${nedre}—${ovre}`
  if (nedre) return `fra ${nedre}`
  if (ovre) return `opptil ${ovre}`
  return ''
}

/* --- Konsentrasjonene i fagtekstene ----------------------------------------- */

/** Enheten konsentrasjonene vises i når brukeren ikke har valgt noen (preferansen «Måleenhet»). */
export const STANDARDENHET: Visningsenhet = 'µg/L'

/** Det lagrede valget, eller `null` når det ikke er en av enhetene fagsidene viser. */
export function lesVisningsenhet(verdi: unknown): Visningsenhet | null {
  return VISNINGSENHETER.find((e) => e === verdi) ?? null
}

/**
 * En konsentrasjon kuratoren har merket i en fagtekst (`konsentrasjon` i
 * rikteksten, `docs/faginnhold.md`): tallet og enheten nøyaktig som kilden
 * oppga dem, og forbindelsen som er målt.
 */
export interface Tekstkonsentrasjon {
  /** Ett tall eller et område, som i kilden: «50–200», «< 0,05», «1,2». */
  verdi: string
  /** Enheten som i kilden: «ng/mL», «nmol/L». */
  enhet: string
  /**
   * Nøkkelen til forbindelsen i `src/data/forbindelser.ts`. Bare med den kan
   * tallet regnes om mellom masse og stoffmengde (molekylvekten fra PubChem).
   */
  forbindelse: string | null
}

/** Slik en forbindelse er nøklet i `src/data/forbindelser.ts`: «desmetylcitalopram». */
export const FORBINDELSESNOKKEL = /^[a-z0-9][a-z0-9-]*$/

/** Tallene i en konsentrasjon: ett, eller nedre og øvre grense i et område. */
export interface Konsentrasjonstall {
  komparator: Komparator | null
  tall: readonly [number] | readonly [number, number]
}

/** Et tall med desimalkomma eller -punktum, og eventuelt mellomrom mellom tusenene («1 000»). */
const TALL = String.raw`[0-9]+(?:[ \u00a0\u2009\u202f][0-9]{3})*(?:[.,][0-9]+)?`
const KONSENTRASJONSTALL = new RegExp(String.raw`^(?:(<=|>=|[<>≤≥])\s*)?(${TALL})(?:\s*[–—-]\s*(${TALL}))?$`)

function tallverdi(tekst: string): number {
  return Number(tekst.replace(/[ \u00a0\u2009\u202f]/g, '').replace(',', '.'))
}

/**
 * Tallene i `verdi` («50–200», «< 0,05», «1 000»), eller `null` når de ikke
 * kan leses sikkert. Et område har ingen komparator, og den nedre grensen er
 * ikke over den øvre.
 */
export function lesKonsentrasjonstall(verdi: string): Konsentrasjonstall | null {
  const m = KONSENTRASJONSTALL.exec(verdi.trim())
  if (!m) return null
  const [, komp, a, b] = m
  if (komp && b) return null
  const nedre = tallverdi(a!)
  if (!Number.isFinite(nedre)) return null
  if (!b) return { komparator: komp ? KOMPARATORER[komp]! : null, tall: [nedre] }
  const ovre = tallverdi(b)
  return Number.isFinite(ovre) && nedre <= ovre ? { komparator: null, tall: [nedre, ovre] } : null
}

/** En merket konsentrasjon som kan regnes om: tallene og enheten slik OUSFAR kjenner dem. */
export interface LestKonsentrasjon extends Konsentrasjonstall {
  fra: Enhetsdefinisjon
}

/** Konsentrasjonen lest, eller `null` når tallet eller enheten ikke kan regnes om. */
export function lesTekstkonsentrasjon(k: Pick<Tekstkonsentrasjon, 'verdi' | 'enhet'>): LestKonsentrasjon | null {
  const tall = lesKonsentrasjonstall(k.verdi)
  const fra = lesKonsentrasjonsenhet(k.enhet)
  return tall && fra ? { ...tall, fra } : null
}

/** Tallene i en annen enhet, eller `null` når de ikke kan regnes om dit. */
function tallI(k: LestKonsentrasjon, til: Enhetsdefinisjon, molvekt: number | null): number[] | null {
  const regnet = k.tall.map((t) => regnOm(t, k.fra, til, molvekt))
  return regnet.every((t): t is number => t !== null) ? regnet : null
}

function skrivTall(komparator: Komparator | null, tall: readonly number[]): string {
  return `${komparator ? `${komparator} ` : ''}${tall.map(visTall).join('–')}`
}

/** En konsentrasjon slik leseren ser den: tallet og enheten det står i. */
export interface Konsentrasjonsvisning {
  tekst: string
  enhet: string
  /** Tallet er regnet om fra kilden, med høyst to gjeldende sifre. */
  omregnet: boolean
  /** Det kunne ikke regnes om til den valgte enheten, og står som i kilden. */
  somIKilden: boolean
}

/**
 * Konsentrasjonen i enheten brukeren har valgt. Står den alt i den enheten
 * (også skrevet som «ng/mL» for µg/L), vises tallet nøyaktig som i kilden;
 * ellers regnes det om og vises med høyst to gjeldende sifre, som i
 * «Analyse ved norske laboratorier». Mellom masse og stoffmengde trengs
 * molekylvekten; uten den står konsentrasjonen som i kilden.
 */
export function visKonsentrasjon(
  k: Pick<Tekstkonsentrasjon, 'verdi' | 'enhet'>,
  valgt: Visningsenhet,
  molvekt: number | null,
): Konsentrasjonsvisning {
  const somIKilden = { tekst: k.verdi.trim(), enhet: k.enhet.trim(), omregnet: false }
  const lest = lesTekstkonsentrasjon(k)
  const til = lesKonsentrasjonsenhet(valgt)!
  if (!lest) return { ...somIKilden, somIKilden: true }
  if (lest.fra.enhet === til.enhet) return { ...somIKilden, enhet: valgt, somIKilden: false }
  const tall = tallI(lest, til, molvekt)
  if (!tall) return { ...somIKilden, somIKilden: true }
  return { tekst: skrivTall(lest.komparator, tall), enhet: valgt, omregnet: true, somIKilden: false }
}

/** En rad i tabellen over enhetene: tallet i enheten, eller `null` når det ikke kan regnes om dit. */
export interface Enhetsrad {
  enhet: Visningsenhet
  tekst: string | null
}

/** Konsentrasjonen i hver av enhetene fagsidene kan vise, til tabellen ved tallet. */
export function konsentrasjonIAlleEnheter(k: Pick<Tekstkonsentrasjon, 'verdi' | 'enhet'>, molvekt: number | null): Enhetsrad[] {
  return VISNINGSENHETER.map((enhet) => {
    const vist = visKonsentrasjon(k, enhet, molvekt)
    return { enhet, tekst: vist.somIKilden ? null : vist.tekst }
  })
}

/* --- Konsentrasjoner som står i teksten uten merking ------------------------ */

const ENHETSTEKST = String.raw`(?:[mµμun]?|mc|p)(?:g|mol)\s*\/\s*(?:[mdµμ]?l|liter)`
const KONSENTRASJONSTEKST = new RegExp(
  String.raw`(?<![\p{L}\p{N}])((?:(?:<=|>=|[<>≤≥])\s*)?${TALL}(?:\s*[–—-]\s*${TALL})?)\s*(${ENHETSTEKST})(?![\p{L}\p{N}])`,
  'giu',
)

/** En konsentrasjon i løpende tekst: hvor den står, og tallet og enheten. */
export interface Konsentrasjonsfunn {
  start: number
  slutt: number
  verdi: string
  enhet: string
}

/**
 * Konsentrasjonene i en tekst, som «50–200 nmol/L» eller «< 0,05 ng/mL»: tall
 * med en enhet OUSFAR kan regne om. Brukes til å finne det som ikke er merket,
 * og til å fylle ut merkingen i editoren.
 */
export function finnKonsentrasjoner(tekst: string): Konsentrasjonsfunn[] {
  return [...tekst.matchAll(KONSENTRASJONSTEKST)].flatMap((m) => {
    const [hele, verdi, enhet] = m
    if (!lesKonsentrasjonstall(verdi!) || !lesKonsentrasjonsenhet(enhet!)) return []
    return [{ start: m.index, slutt: m.index + hele.length, verdi: verdi!.trim(), enhet: enhet!.replace(/\s+/g, '') }]
  })
}
