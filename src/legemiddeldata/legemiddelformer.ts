/**
 * Ikonregisteret for legemiddelformene: navnet på en legemiddelform → en
 * semantisk variant → navnet på ikonet i ikonregisteret fra Atlas-designet
 * (`src/components/ikon/`).
 *
 * Varianten finnes med reglene i `FORMREGLER`, som leser navnet på formen.
 * FEST har over 200 former (kodeverk 7448, `LegemiddelformKort`), og navnene er
 * bygd av de samme ordene («Pulver og væske til injeksjonsvæske, oppløsning»),
 * så noen få regler dekker alle, også former som kommer til senere. Det er
 * formen som gis til pasienten som bestemmer: for «X til Y» leses Y først, så
 * et pulver til injeksjonsvæske får sprøyten. Ikonet er pynt ved siden av
 * navnet, som alltid står i tekst.
 *
 * Former ingen regel passer for, får den generiske varianten og er merket
 * `kartlagt: false`, så de kan vises og fanges opp. En form kan også få en
 * variant etter FEST-koden sin i `FORMKODER`, som går foran reglene.
 *
 * Hvilke former som finnes i FEST, og hvilke de publiserte stoffsidene
 * faktisk bruker, står i `legemiddelformer-i-bruk.json`. Den lages maskinelt
 * av `scripts/legemiddelformer-i-bruk.sql`, og testen i
 * `src/__tests__/legemiddelformer.test.ts` krever at hver av dem er kartlagt.
 * Se `docs/legemiddeldata.md`.
 */

/**
 * De semantiske variantene og ikonet hver av dem vises med. Atlas har ikoner
 * for tablett, depottablett og kapsel; de andre er tegnet i samme stil
 * (`src/components/ikon/register.ts`).
 */
export const FORMVARIANTER = {
  tablett: { ikon: 'tablet' },
  depottablett: { ikon: 'depot' },
  kapsel: { ikon: 'capsule' },
  mikstur: { ikon: 'bottle' },
  draper: { ikon: 'dropper' },
  injeksjon: { ikon: 'syringe' },
  depotinjeksjon: { ikon: 'syringe' },
  infusjon: { ikon: 'infusion' },
  inhalasjon: { ikon: 'inhaler' },
  spray: { ikon: 'spray' },
  utvortes: { ikon: 'tube' },
  plaster: { ikon: 'patch' },
  granulat: { ikon: 'sachet' },
  stikkpille: { ikon: 'suppository' },
  implantat: { ikon: 'implant' },
  gass: { ikon: 'gas' },
  generisk: { ikon: 'fallback' },
} as const satisfies Record<string, { ikon: string }>

export type Formvariant = keyof typeof FORMVARIANTER

/** Varianten former uten egen oppføring får. */
export const GENERISK_FORM: Formvariant = 'generisk'

/**
 * Reglene, i rekkefølge: den første som passer, vinner. Mønstrene prøves mot
 * navnet med små bokstaver og uten aksenter («Dråper» leses «draper»). De
 * første er formene som er entydige uansett resten av navnet (inhalasjon,
 * injeksjon, plaster), så den fysiske formen, og til slutt væskene.
 *
 * Mønstrene dekker også navnene redaktørene gir formene i «Viktige data»
 * («Peroralt», «Depotinjeksjon (Xeplion)», «i.v.»).
 */
export const FORMREGLER: readonly { variant: Formvariant; monster: RegExp }[] = [
  { variant: 'inhalasjon', monster: /inhal|nebulisator/ },
  { variant: 'gass', monster: /\bgass\b/ },
  { variant: 'depotinjeksjon', monster: /depotinjek/ },
  { variant: 'injeksjon', monster: /injek|parenteral|preparasjonssett|intramusk|intraven|subkutan|\bi\.?[mv]\b/ },
  { variant: 'infusjon', monster: /infusj|dialyse|hemofiltrering|kardioplegi/ },
  { variant: 'plaster', monster: /plaster|kompress/ },
  { variant: 'spray', monster: /spray|skum|nesepulver/ },
  { variant: 'draper', monster: /draper|instillasjon|prikktest|risptest/ },
  { variant: 'kapsel', monster: /kapsel/ },
  { variant: 'depottablett', monster: /depot\w*tablett|tablett med modifisert/ },
  { variant: 'tablett', monster: /tablett|pastill|lyofilisat|tyggegummi|film$|peroral|^oralt?\b|\bp\.?o\b/ },
  { variant: 'granulat', monster: /granul|pulver|pudder|urtete|pose$/ },
  { variant: 'stikkpille', monster: /stikkpille|vagitori|suppositori/ },
  { variant: 'implantat', monster: /implant|innlegg|lamell|\btrad\b|matriks|svamp/ },
  { variant: 'utvortes', monster: /krem|salve|gel\b|pasta|stift/ },
  {
    variant: 'mikstur',
    monster:
      /mikstur|sirup|munnvann|skyll|gurgle|oppl[oø]s|v(æ|ae)ske|emulsjon|suspensjon|dispersjon|liniment|sjampo|lakk|kollodium|badevann/,
  },
  { variant: 'depotinjeksjon', monster: /\bdepot\b/ },
]

/** FEST-kode → variant, for en form reglene ikke gir riktig. Går foran reglene. */
export const FORMKODER: Readonly<Record<string, Formvariant>> = {
  '531': 'generisk', // Medisinsk blodigle: ingen av tegningene passer.
}

/** Navnet slik reglene leser det: små bokstaver, uten aksenter og ekstra mellomrom. */
function normaliser(tekst: string): string {
  return tekst
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function regelFor(tekst: string): Formvariant | undefined {
  return FORMREGLER.find(({ monster }) => monster.test(tekst))?.variant
}

/**
 * Varianten for navnet på en form, eller ingen når ingen regel passer. For
 * «X til Y» prøves Y først («Pulver til injeksjonsvæske» er en injeksjon);
 * passer ingen regel for Y («Oppløsning til prikktest»), prøves hele navnet.
 */
export function formvariant(tekst: string | null | undefined): Formvariant | undefined {
  if (!tekst) return undefined
  const navn = normaliser(tekst)
  const til = navn.lastIndexOf(' til ')
  return (til >= 0 ? regelFor(navn.slice(til + 5)) : undefined) ?? regelFor(navn)
}

export interface Formikon {
  variant: Formvariant
  /** Navnet i ikonregisteret. */
  ikon: string
  /** `false` når ingen regel eller kode passer og den generiske varianten brukes. */
  kartlagt: boolean
}

/** Ikonet for en legemiddelform fra FEST. Ukjent eller manglende form gir det generiske. */
export function formikon(kode: string | null | undefined, tekst: string | null | undefined): Formikon {
  const kjent = (kode ? FORMKODER[kode] : undefined) ?? formvariant(tekst)
  const variant = kjent ?? GENERISK_FORM
  return { variant, ikon: FORMVARIANTER[variant].ikon, kartlagt: kjent !== undefined }
}
