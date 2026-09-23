/**
 * Fasiten for THC-syremodulen: tusenvis av inndata med utfallet slik den
 * opprinnelige modulen gir det.
 *
 * Fasiten ble laget én gang, av den opprinnelige modulen med regnearkets
 * konstanter og tekster i koden, og ligger frosset i
 * `../fasit/thc-fasit.json`. Den nye motoren skal gi nøyaktig det samme — de
 * samme kommentarene tegn for tegn, den samme konklusjonen og de samme
 * tallene helt ned til siste siffer. Slik beskytter fasiten den kliniske
 * outputen også etter at den gamle modulen er borte.
 *
 * Tilfellene dekker:
 *
 * - et rutenett av forrige IRCAK, døgn mellom prøvene, bruksmønster og
 *   sikkerhetsmargin, med IRCAK i denne prøven rett på og rett ved siden av
 *   skillepunktene mellom konsentrasjonsnivåene;
 * - for hver kombinasjon IRCAK i denne prøven akkurat der den korrigerte
 *   endringen treffer hver av de tre kurvene, og det minste steget over og
 *   under (neste flyttall);
 * - forrige prøve med IRCAK 0, og forrige prøve under cut-off (UCAK/NKRE) med
 *   de samme grensene;
 * - ingen tidligere prøve;
 * - varselet om lang tid mellom prøvene rett på og over grensen;
 * - ugyldige og manglende felt.
 *
 * Endres den kliniske outputen med vilje, lages fasiten på nytt med
 * `npx vite-node scripts/lag-thc-fasit.ts` i samme PR, og føringen i
 * endringsloggen får merket «Fag».
 */
import { createHash } from 'node:crypto'

/** Inndataene slik skjemaet har dem. Samme form i gammel og ny motor. */
export interface FasitInndata {
  kronisk: boolean
  aktuellVerdi: string
  aktuellDato: string
  ingenTidligere: boolean
  forrigeUnderCutoff: boolean
  forrigeVerdi: string
  forrigeUcak: string
  forrigeNkre: string
  forrigeDato: string
  sikkerhetsmargin: number
}

/** Rekkefølgen feltene står i i fasitfilen. */
const FELT = [
  'kronisk',
  'aktuellVerdi',
  'aktuellDato',
  'ingenTidligere',
  'forrigeUnderCutoff',
  'forrigeVerdi',
  'forrigeUcak',
  'forrigeNkre',
  'forrigeDato',
  'sikkerhetsmargin',
] as const satisfies readonly (keyof FasitInndata)[]

export type Kodetinndata = (string | number)[]

export function kodInndata(inn: FasitInndata): Kodetinndata {
  return FELT.map((felt) => {
    const verdi = inn[felt]
    return typeof verdi === 'boolean' ? (verdi ? 1 : 0) : verdi
  })
}

export function dekodInndata(kodet: Kodetinndata): FasitInndata {
  const inn = Object.fromEntries(FELT.map((felt, i) => [felt, kodet[i]])) as Record<string, unknown>
  for (const felt of ['kronisk', 'ingenTidligere', 'forrigeUnderCutoff']) inn[felt] = inn[felt] === 1
  return inn as unknown as FasitInndata
}

export type Konklusjon = 'uten_forrige' | 'ikke_nodvendigvis' | 'vanskelig' | 'nytt_inntak'

/** Tallgrunnlaget, med feltene i fast rekkefølge. */
export interface FasitGrunnlag {
  forrige: number
  aktuell: number
  dager: number
  kronisk: boolean
  maltEndring: number
  korrigertEndring: number
  sikkerhetsmargin: number
  underCutoff: boolean
  forventet: { gronn: number; gul: number; rod: number }
}

/** Utfallet slik fasiten sammenligner det, uansett motor. */
export type FasitUtfall =
  | { type: 'mangler'; mangler: string[] }
  | {
      type: 'kommentar'
      kommentar: string
      konklusjon: Konklusjon
      langtMellomProvene: boolean
      grunnlag: FasitGrunnlag | null
    }

/** Figuren, i den formen testene sammenligner. */
export interface FasitGraf {
  xMaks: number
  xSteg: number
  yTopp: number
  yBunn: number
  ySteg: number
  kurver: { navn: string; tone: string; punkter: { dag: number; prosent: number }[] }[]
  punkter: { navn: string; dag: number; prosent: number }[]
}

export interface Fasit {
  om: string
  kommentarer: string[]
  /** [inndata, utfall]. Utfallet er ['m', mangler] eller [konklusjon, kommentarnr, langt]. */
  tilfeller: [Kodetinndata, (string | number | string[])[]][]
  /** SHA-256 av tallgrunnlaget og figurene, se {@link tallavtrykk}. */
  tallgrunnlag: string
}

/** Hver så mange tilfeller med figur får figuren med i avtrykket. */
const FIGUR_HVER = 20

/**
 * Avtrykket av alle tallene: grunnlaget for hvert tilfelle og figuren for
 * hvert {@link FIGUR_HVER}. tilfelle med figur. Tallene skrives med full
 * presisjon, så også en forskjell i siste siffer slår ut.
 */
export function tallavtrykk(
  utfall: FasitUtfall[],
  graf: (grunnlag: FasitGrunnlag) => FasitGraf,
): string {
  const hash = createHash('sha256')
  let medFigur = 0
  for (const u of utfall) {
    if (u.type !== 'kommentar' || u.grunnlag === null) {
      hash.update('-\n')
      continue
    }
    const g = u.grunnlag
    hash.update(
      JSON.stringify([
        g.forrige,
        g.aktuell,
        g.dager,
        g.kronisk,
        g.maltEndring,
        g.korrigertEndring,
        g.sikkerhetsmargin,
        g.underCutoff,
        g.forventet.gronn,
        g.forventet.gul,
        g.forventet.rod,
      ]) + '\n',
    )
    if (g.dager >= 1 && medFigur++ % FIGUR_HVER === 0) {
      const f = graf(g)
      hash.update(
        JSON.stringify([
          f.xMaks,
          f.xSteg,
          f.yTopp,
          f.yBunn,
          f.ySteg,
          f.kurver.map((k) => [k.navn, k.tone, k.punkter.map((p) => [p.dag, p.prosent])]),
          f.punkter.map((p) => [p.navn, p.dag, p.prosent]),
        ]) + '\n',
      )
    }
  }
  return hash.digest('hex')
}

/* --- Tilfellene ------------------------------------------------------------ */

const AKTUELL_DATO = '2026-07-27'

/** ISO-datoen `dager` døgn før denne prøven. */
function dagerFor(dager: number): string {
  const dato = new Date(`${AKTUELL_DATO}T00:00:00Z`)
  dato.setUTCDate(dato.getUTCDate() - dager)
  return dato.toISOString().slice(0, 10)
}

/** Nærmeste flyttall over eller under `x`. */
function nabo(x: number, retning: 1 | -1): number {
  const buffer = new DataView(new ArrayBuffer(8))
  buffer.setFloat64(0, x)
  const bits = buffer.getBigUint64(0)
  buffer.setBigUint64(0, x > 0 === (retning === 1) ? bits + 1n : bits - 1n)
  return buffer.getFloat64(0)
}

/** Et tall slik det kan tastes: uten eksponent, med punktum eller komma. */
function tastbart(x: number, komma = false): string | null {
  const tekst = String(x)
  if (!(x > 0) || /e/i.test(tekst)) return null
  return komma ? tekst.replace('.', ',') : tekst
}

const FORRIGE = ['0', '0,4', '3', '6,5', '25', '120']
const UNDER_CUTOFF: [string, string][] = [
  ['0', '1,2'],
  ['1', '8'],
  ['2,5', '0,9'],
  ['12', '3'],
]
const DAGER = [0, 1, 4, 23, 30, 31, 75]
const DAGER_UNDER_CUTOFF = [0, 9, 31]
const MARGINER = [0.5, 0.9, 0.99]
/** Rett på og rett under skillepunktene mellom nivåene, og langt fra dem. */
const AKTUELL = ['0,05', String(nabo(20, -1)), '20', String(nabo(40, -1)), '40', '300']
const AKTUELL_UNDER_CUTOFF = ['0,05', '20', '40']

/**
 * Hvor IRCAK i denne prøven må ligge for at den korrigerte endringen skal
 * treffe kurven — regnet av den motoren som lager fasiten.
 */
export type Kurvetreff = (inn: FasitInndata) => number[]

export function fasittilfeller(kurvetreff: Kurvetreff): FasitInndata[] {
  const tilfeller: FasitInndata[] = []
  const tom: FasitInndata = {
    kronisk: true,
    aktuellVerdi: '',
    aktuellDato: '',
    ingenTidligere: false,
    forrigeUnderCutoff: false,
    forrigeVerdi: '',
    forrigeUcak: '',
    forrigeNkre: '',
    forrigeDato: '',
    sikkerhetsmargin: 0.9,
  }

  const medGrenser = (grunn: FasitInndata, aktuelle: string[]) => {
    for (const aktuellVerdi of aktuelle) tilfeller.push({ ...grunn, aktuellVerdi })
    for (const treff of kurvetreff({ ...grunn, aktuellVerdi: '1' })) {
      for (const x of [nabo(treff, -1), treff, nabo(treff, 1)]) {
        const tekst = tastbart(x)
        if (tekst !== null) tilfeller.push({ ...grunn, aktuellVerdi: tekst })
      }
    }
  }

  for (const kronisk of [true, false]) {
    for (const sikkerhetsmargin of MARGINER) {
      for (const dager of DAGER) {
        for (const forrigeVerdi of FORRIGE) {
          medGrenser(
            { ...tom, kronisk, sikkerhetsmargin, forrigeVerdi, forrigeDato: dagerFor(dager), aktuellDato: AKTUELL_DATO },
            AKTUELL,
          )
        }
      }
      for (const dager of DAGER_UNDER_CUTOFF) {
        for (const [forrigeUcak, forrigeNkre] of UNDER_CUTOFF) {
          medGrenser(
            {
              ...tom,
              kronisk,
              sikkerhetsmargin,
              forrigeUnderCutoff: true,
              forrigeUcak,
              forrigeNkre,
              forrigeDato: dagerFor(dager),
              aktuellDato: AKTUELL_DATO,
            },
            AKTUELL_UNDER_CUTOFF,
          )
        }
      }
    }
    // Uten tidligere prøve betyr datoene, marginen og feltene for forrige
    // prøve ingenting — de står likevel utfylt i noen av tilfellene.
    for (const aktuellVerdi of [...AKTUELL, '1.5', '39,999']) {
      tilfeller.push({ ...tom, kronisk, ingenTidligere: true, aktuellVerdi })
      tilfeller.push({
        ...tom,
        kronisk,
        ingenTidligere: true,
        forrigeUnderCutoff: true,
        forrigeVerdi: '3',
        forrigeDato: dagerFor(40),
        aktuellDato: AKTUELL_DATO,
        sikkerhetsmargin: 0.99,
        aktuellVerdi,
      })
    }
  }

  // Ugyldige og manglende felt, og prøver i feil rekkefølge.
  const gyldig = { ...tom, aktuellVerdi: '2,5', aktuellDato: AKTUELL_DATO, forrigeVerdi: '6,5', forrigeDato: dagerFor(23) }
  const feil: Partial<FasitInndata>[] = [
    {},
    { aktuellVerdi: '' },
    { aktuellVerdi: '0' },
    { aktuellVerdi: '-1' },
    { aktuellVerdi: 'abc' },
    { aktuellVerdi: '1,2,3' },
    { aktuellVerdi: ' 2,5 ' },
    { aktuellDato: '' },
    { forrigeVerdi: '' },
    { forrigeVerdi: '-0,1' },
    { forrigeVerdi: 'x' },
    { forrigeDato: '' },
    { forrigeDato: '2026-07-28' },
    { forrigeDato: AKTUELL_DATO },
    { aktuellVerdi: '', forrigeVerdi: '', forrigeDato: '', aktuellDato: '' },
    { forrigeUnderCutoff: true },
    { forrigeUnderCutoff: true, forrigeUcak: '1', forrigeNkre: '' },
    { forrigeUnderCutoff: true, forrigeUcak: '', forrigeNkre: '2' },
    { forrigeUnderCutoff: true, forrigeUcak: '-1', forrigeNkre: '0' },
    { forrigeUnderCutoff: true, forrigeUcak: '1', forrigeNkre: '-2' },
    { forrigeUnderCutoff: true, forrigeUcak: 'a', forrigeNkre: 'b' },
    { forrigeUnderCutoff: true, forrigeUcak: '0', forrigeNkre: '0' },
    { forrigeUnderCutoff: true, forrigeUcak: '0', forrigeNkre: '5', forrigeDato: '' },
    { ingenTidligere: true, aktuellVerdi: '' },
    { ingenTidligere: true, aktuellVerdi: '0' },
    { ingenTidligere: true, aktuellDato: '', forrigeDato: '' },
  ]
  for (const endring of feil) tilfeller.push({ ...gyldig, ...endring })
  tilfeller.push(tom)

  // Rett på og rett over varselgrensen, og svært lang tid mellom prøvene.
  for (const dager of [29, 30, 31, 32, 365, 3650]) {
    tilfeller.push({ ...gyldig, forrigeDato: dagerFor(dager) })
    tilfeller.push({ ...gyldig, forrigeVerdi: '0', forrigeDato: dagerFor(dager) })
  }

  return tilfeller
}

/* --- Fasitfilen ----------------------------------------------------------- */

const OM =
  'Utfallet av THC-syremodulen for et fast sett inndata, laget av den opprinnelige modulen med ' +
  'regnearkets konstanter og tekster i koden. Se src/domain/__tests__/hjelp/thcFasit.ts.'

export function lagFasit(
  inndata: FasitInndata[],
  utfall: FasitUtfall[],
  graf: (grunnlag: FasitGrunnlag) => FasitGraf,
): Fasit {
  const kommentarer: string[] = []
  const nummer = new Map<string, number>()
  const tilfeller = inndata.map((inn, i): Fasit['tilfeller'][number] => {
    const u = utfall[i]!
    if (u.type === 'mangler') return [kodInndata(inn), ['m', u.mangler]]
    let nr = nummer.get(u.kommentar)
    if (nr === undefined) {
      nr = kommentarer.push(u.kommentar) - 1
      nummer.set(u.kommentar, nr)
    }
    return [kodInndata(inn), [u.konklusjon, nr, u.langtMellomProvene ? 1 : 0]]
  })
  return { om: OM, kommentarer, tilfeller, tallgrunnlag: tallavtrykk(utfall, graf) }
}

/** Fasitfilen som tekst: ett tilfelle per linje, så en endring gir en lesbar diff. */
export function fasitSomTekst(fasit: Fasit): string {
  const linjer = fasit.tilfeller.map((t) => '    ' + JSON.stringify(t))
  return (
    '{\n' +
    `  "om": ${JSON.stringify(fasit.om)},\n` +
    `  "tallgrunnlag": ${JSON.stringify(fasit.tallgrunnlag)},\n` +
    `  "kommentarer": ${JSON.stringify(fasit.kommentarer, null, 4).replace(/\n/g, '\n  ')},\n` +
    '  "tilfeller": [\n' +
    linjer.join(',\n') +
    '\n  ]\n}\n'
  )
}

/** Sammenligner et utfall med fasiten for ett tilfelle. `null` når de er like. */
export function avvikFraFasit(fasit: Fasit, i: number, u: FasitUtfall): string | null {
  const [, forventet] = fasit.tilfeller[i]!
  if (forventet[0] === 'm') {
    if (u.type !== 'mangler') return `ventet mangler, fikk kommentar`
    return JSON.stringify(u.mangler) === JSON.stringify(forventet[1]) ? null : `mangler: ${JSON.stringify(u.mangler)}`
  }
  if (u.type !== 'kommentar') return `ventet kommentar, fikk mangler: ${JSON.stringify(u.mangler)}`
  const [konklusjon, nr, langt] = forventet as [string, number, number]
  if (u.konklusjon !== konklusjon) return `konklusjon ${u.konklusjon}, ventet ${konklusjon}`
  if (u.kommentar !== fasit.kommentarer[nr]) return `kommentar:\n${u.kommentar}\nventet:\n${fasit.kommentarer[nr]}`
  if (u.langtMellomProvene !== (langt === 1)) return `varsel om lang tid: ${u.langtMellomProvene}`
  return null
}
