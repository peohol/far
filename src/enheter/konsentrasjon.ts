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
