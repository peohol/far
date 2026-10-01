/**
 * Mekanismene i farmakodynamikken: hva et mekanismekort kan si om hvordan
 * stoffet virker på målet sitt, hvilken effekt det står på kortet, og hvilket
 * system målet hører til.
 *
 * Mekanismetypen bestemmer alene effekten kortet viser (pillen), fargen på
 * pillen og ikonet. Taksonomien skal aldri gjøre innholdet mer presist enn
 * kilden: sier kilden bare «antagonist», er kortet `antagonisme`, ikke
 * `kompetitiv_antagonisme`. De generelle typene (`spesifikk: false`) finnes
 * for å gjengi en kilde uten å gjette.
 *
 * Ikonene, fargene og hvordan en ny type legges til, står i
 * `docs/farmakodynamikk-ikoner.md`.
 */

/** Hva slags mål mekanismen virker på. */
export const MEKANISMEFAMILIER = [
  { nokkel: 'reseptor', navn: 'Reseptor' },
  { nokkel: 'ionekanal', navn: 'Ionekanal' },
  { nokkel: 'transportor', navn: 'Transportør' },
  { nokkel: 'enzym', navn: 'Enzym' },
  { nokkel: 'ingen', navn: 'Uten effekt' },
] as const

export type Mekanismefamilie = (typeof MEKANISMEFAMILIER)[number]['nokkel']

/**
 * Virkningen stoffet har på aktiviteten til målet, som et trafikklys: grønt
 * øker aktiviteten, gult øker den litt, rødt reduserer eller snur den, og
 * grått er ingen eller ukjent effekt. Det er den direkte aktiviteten på målet,
 * ikke de nedstrøms virkningene: en α₂-antagonist reduserer α₂-aktiviteten,
 * selv om den nedstrøms øker noradrenerg transmisjon.
 *
 * `merketone` er tonen pillen har (`src/components/Merke.tsx`); ikonene og
 * kortene bruker tokenet `--virkning-<nokkel>`.
 */
export const VIRKNINGER = [
  { nokkel: 'okt', navn: 'Øker aktiviteten', merketone: 'referanse' },
  { nokkel: 'delvis', navn: 'Øker aktiviteten litt', merketone: 'toksisk' },
  { nokkel: 'redusert', navn: 'Reduserer eller snur aktiviteten', merketone: 'alvorlig' },
  { nokkel: 'noytral', navn: 'Ingen eller ukjent effekt', merketone: 'noytral' },
] as const

export type Virkning = (typeof VIRKNINGER)[number]['nokkel']

export interface Mekanismedefinisjon {
  nokkel: string
  familie: Mekanismefamilie
  /** Navnet i redigeringen, med presiseringen i parentes når typen er generell. */
  navn: string
  /** Effekten slik den står i pillen på kortet: så kort som mulig, helst ett ord. */
  effekt: string
  virkning: Virkning
  /**
   * Om typen er en bestemt mekanisme (`true`), eller en generell kategori
   * for en kilde som ikke sier mer (`false`).
   */
  spesifikk: boolean
}

/** Mekanismetypene, gruppert etter familie, i den rekkefølgen redigeringen viser dem. */
export const MEKANISMER = [
  { nokkel: 'agonisme', familie: 'reseptor', navn: 'Agonisme (grad ikke angitt)', effekt: 'Agonist', virkning: 'okt', spesifikk: false },
  { nokkel: 'partiell_agonisme', familie: 'reseptor', navn: 'Partiell agonisme', effekt: 'Partiell agonist', virkning: 'delvis', spesifikk: true },
  { nokkel: 'antagonisme', familie: 'reseptor', navn: 'Antagonisme (subtype ikke angitt)', effekt: 'Antagonist', virkning: 'redusert', spesifikk: false },
  {
    nokkel: 'kompetitiv_antagonisme',
    familie: 'reseptor',
    navn: 'Kompetitiv antagonisme',
    effekt: 'Kompetitiv antagonist',
    virkning: 'redusert',
    spesifikk: true,
  },
  { nokkel: 'invers_agonisme', familie: 'reseptor', navn: 'Invers agonisme', effekt: 'Invers agonist', virkning: 'redusert', spesifikk: true },
  {
    nokkel: 'positiv_allosterisk_modulering',
    familie: 'reseptor',
    navn: 'Positiv allosterisk modulering',
    effekt: 'Positiv modulator',
    virkning: 'okt',
    spesifikk: true,
  },
  {
    nokkel: 'negativ_allosterisk_modulering',
    familie: 'reseptor',
    navn: 'Negativ allosterisk modulering',
    effekt: 'Negativ modulator',
    virkning: 'redusert',
    spesifikk: true,
  },
  {
    nokkel: 'reseptorbinding',
    familie: 'reseptor',
    navn: 'Binding/affinitet (funksjonell effekt ikke angitt)',
    effekt: 'Binder',
    virkning: 'noytral',
    spesifikk: false,
  },
  {
    nokkel: 'reseptorpavirkning',
    familie: 'reseptor',
    navn: 'Reseptorpåvirkning (mekanisme ikke angitt)',
    effekt: 'Påvirker',
    virkning: 'noytral',
    spesifikk: false,
  },
  { nokkel: 'kanalblokkering', familie: 'ionekanal', navn: 'Kanalblokkering', effekt: 'Blokkerer', virkning: 'redusert', spesifikk: true },
  {
    nokkel: 'bruksavhengig_blokkering',
    familie: 'ionekanal',
    navn: 'Bruks-/frekvensavhengig blokkering',
    effekt: 'Bruksavhengig blokker',
    virkning: 'redusert',
    spesifikk: true,
  },
  {
    nokkel: 'ionekanalpavirkning',
    familie: 'ionekanal',
    navn: 'Ionekanalpåvirkning (mekanisme ikke angitt)',
    effekt: 'Påvirker',
    virkning: 'noytral',
    spesifikk: false,
  },
  { nokkel: 'reopptakshemming', familie: 'transportor', navn: 'Reopptakshemming', effekt: 'Reopptakshemmer', virkning: 'redusert', spesifikk: true },
  { nokkel: 'transporterhemming', familie: 'transportor', navn: 'Transporterhemming', effekt: 'Hemmer', virkning: 'redusert', spesifikk: true },
  {
    nokkel: 'kotransporterhemming',
    familie: 'transportor',
    navn: 'Hemming/modulering av kotransportør',
    effekt: 'Hemmer',
    virkning: 'redusert',
    spesifikk: true,
  },
  {
    nokkel: 'transportorpavirkning',
    familie: 'transportor',
    navn: 'Transportørpåvirkning (funksjonell effekt ikke angitt)',
    effekt: 'Påvirker',
    virkning: 'noytral',
    spesifikk: false,
  },
  { nokkel: 'enzymhemming', familie: 'enzym', navn: 'Enzymhemming (subtype ikke angitt)', effekt: 'Hemmer', virkning: 'redusert', spesifikk: false },
  { nokkel: 'ingen_effekt', familie: 'ingen', navn: 'Ingen effekt', effekt: 'Ingen effekt', virkning: 'noytral', spesifikk: true },
] as const satisfies readonly Mekanismedefinisjon[]

export type Mekanisme = (typeof MEKANISMER)[number]['nokkel']

/** Mekanismen et kort har når kilden sier uttrykkelig at stoffet ikke virker på målet. */
export const INGEN_EFFEKT: Mekanisme = 'ingen_effekt'

const MEKANISME_PER_NOKKEL = new Map<string, Mekanismedefinisjon>(MEKANISMER.map((m) => [m.nokkel, m]))

export function mekanismeFor(nokkel: string | null | undefined): Mekanismedefinisjon | undefined {
  return nokkel ? MEKANISME_PER_NOKKEL.get(nokkel) : undefined
}

export function erMekanisme(verdi: unknown): verdi is Mekanisme {
  return typeof verdi === 'string' && MEKANISME_PER_NOKKEL.has(verdi)
}

/** Virkningen mekanismen har, nøytral når den mangler. */
export function virkningFor(mekanisme: string | null | undefined): (typeof VIRKNINGER)[number] {
  const nokkel = mekanismeFor(mekanisme)?.virkning ?? 'noytral'
  return VIRKNINGER.find((v) => v.nokkel === nokkel)!
}

/* --- Systemene målene hører til ---------------------------------------------- */

/**
 * Systemet et mål hører til — nevrotransmittersystemet, eller en annen klasse
 * — gir målproteinet i ikonet en fast farge (`--system-<nokkel>` i
 * `tokens.css`). Reseptorer, reopptaksproteiner og andre proteiner i samme
 * system har samme farge.
 *
 * Systemet leses av navnet på målet, som er fri tekst. Navnet sammenlignes med
 * små bokstaver og uten aksenter; det første systemet som passer, vinner, så
 * de mer bestemte står først («NMDA-reseptor/kanal» er glutamat, ikke ionekanal).
 * Passer ingen, får målet den nøytrale fargen.
 */
export const SYSTEMER = [
  { nokkel: 'opioid', navn: 'Opioidsystemet', monster: /opioid|\bmor\b|\bkor\b|\bdor\b|\bnop\b|μ|κ|δ/ },
  { nokkel: 'glutamat', navn: 'Glutamat/NMDA', monster: /nmda|ampa|kainat|glutamat|mglu/ },
  { nokkel: 'gaba', navn: 'GABA', monster: /gaba|benzodiazepin/ },
  { nokkel: 'serotonin', navn: 'Serotonin', monster: /5-?ht|serotonin|\bsert\b/ },
  { nokkel: 'dopamin', navn: 'Dopamin', monster: /dopamin|\bd[1-5]\b|\bdat\b/ },
  { nokkel: 'histamin', navn: 'Histamin', monster: /histamin|\bh[1-4]\b/ },
  { nokkel: 'acetylkolin', navn: 'Acetylkolin', monster: /kolinerg|muskarin|nikotin|acetylkolin|\bm[1-5]\b/ },
  { nokkel: 'noradrenalin', navn: 'Noradrenalin og adrenalin', monster: /adrenerg|adrenalin|katekolamin|\bnet\b|α|β/ },
  { nokkel: 'raas', navn: 'Renin–angiotensin–aldosteron', monster: /angiotensin|\bace\b|\bat[12]\b|aldosteron|mineralokortikoid|renin/ },
  { nokkel: 'hormon', navn: 'Hormoner', monster: /hormon|østrogen|androgen|progest|glukokortikoid/ },
  { nokkel: 'ioner', navn: 'Ionekanaler og elektrolytter', monster: /kanal|natrium|kalium|kalsium|ca2|na\+|k\+|cl−|kotransport/ },
] as const

export type System = (typeof SYSTEMER)[number]['nokkel']

/** Navnet på målet slik systemene sammenlignes: små bokstaver, uten aksenter. */
function normaliser(maal: string): string {
  return maal
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

/** Systemet målet hører til, eller ingen når navnet ikke passer noe. */
export function systemFor(maal: string): System | undefined {
  const navn = normaliser(maal)
  return SYSTEMER.find(({ monster }) => monster.test(navn))?.nokkel
}

/* --- Subtypene i navnet på målet ---------------------------------------------- */

/** En del av en tekst, med senket skrift eller ikke. */
export interface Tekstdel {
  tekst: string
  senket: boolean
}

/**
 * Subtypen etter navnet på en reseptorfamilie: «D1», «AT1», «5-HT2C», «α1»,
 * «GABAA». Familien må stå som et eget ord, så «CYP2D6» og «Ca2+» ikke tas med.
 */
const SUBTYPE =
  /(?<![\p{L}\p{N}])(5-HT|mGlu|GABA|TAAR|CB|NK|OX|AT|D|H|M|A|α|β|σ|κ|μ|δ)(\d+[A-Z]?|(?<=GABA)-?[ABC])(?![\p{L}\p{N}+])/gu

/**
 * Navnet på et mål delt i vanlig og senket skrift, med subtypen senket:
 * «5-HT2C-reseptor» blir «5-HT» og senket «2C», så «-reseptor».
 */
export function subtypedeler(maal: string): Tekstdel[] {
  const deler: Tekstdel[] = []
  let forrige = 0
  for (const treff of maal.matchAll(SUBTYPE)) {
    const start = treff.index + treff[1]!.length
    const subtype = treff[2]!.replace(/^-/, '')
    deler.push({ tekst: maal.slice(forrige, start), senket: false }, { tekst: subtype, senket: true })
    forrige = treff.index + treff[0].length
  }
  deler.push({ tekst: maal.slice(forrige), senket: false })
  return deler.filter((d) => d.tekst !== '')
}
