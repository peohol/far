import rusdata from '../data/rusmidler.json'
import type { Kommentarplassering } from './kommentar'
import type { Analyte } from '../types'

/**
 * Fortolkning av stoffer med ruspotensial i serum, etter tabellene i
 * `originaldata/rusmidler.md` (bygget til `src/data/rusmidler.json` med
 * `npm run data`).
 *
 * Denne kategorien skiller seg fra psykofarmaka på tre måter:
 *
 * - Kommentaren varierer ikke med konsentrasjonen. Det finnes én kommentar per
 *   analytt, uansett hvor svaret ligger, så det er ingen konsentrasjonsbånd å
 *   velge mellom.
 * - Noen stoffer fortolkes samlet. Da legges hele kommentaren på én analytt,
 *   og de andre får en tilleggskommentar som henviser dit. Hvilken analytt som
 *   bærer hovedkommentaren avhenger av hva som faktisk er påvist.
 * - Stoffer som tolkes sammen deler én modul, slik at hvilket som helst av
 *   navnene i søket fører til den samme fortolkningen.
 *
 * To av modulene har regler som leser forholdet mellom konsentrasjoner —
 * oksazepam mot diazepamgruppen, og morfin mot kodein. Selve kommentaren
 * varierer fortsatt ikke med konsentrasjonen; det er hvilken kommentar som
 * gjelder, forholdet avgjør.
 *
 * Kommentartekstene er kildens egne og skal ikke endres her; rettelsene
 * (tankestrek i intervaller, avsluttende punktum) gjøres i byggeskriptet og
 * ligger i `meta.rettelser` i datasettet.
 */

/* --- Datasettet --------------------------------------------------------- */

/** En rad i kildetabellene. */
export interface RusRad {
  id: string
  gruppe: string
  /** Analysemetoden stoffene rekvireres under — den samme for hele datasettet. */
  analysemetode: string
  /** Kategorien i sidemenyen, f.eks. «Opioider». */
  kategori: string
  /** Analyttkolonnen slik den står, f.eks. «Morfin og kodein – ordinær kombinasjon». */
  analytt: string
  koder: string[]
  /** Kommentartekstene raden gir, etter nøkkelen kilden gir dem. */
  tekster: Record<string, string>
  /**
   * Kildens veiledning til den som fortolker, etter kolonnen den står i.
   * Limes ikke inn noe sted.
   */
  merknader: Record<string, string>
}

export interface RusDatasett {
  meta: {
    kilde: string
    antallRader: number
    rettelser: { kategori: string; hvor: string; fra: string; til: string; begrunnelse: string }[]
  }
  rader: RusRad[]
}

// Radene har ulike nøkler i `tekster` og `merknader` etter hvilken tabell de
// kommer fra, så JSON-importens utledede type er smalere enn modellen.
export const rusDatasett = rusdata as unknown as RusDatasett

/**
 * Analysemetoden alle stoffene i datasettet rekvireres under. Den er den
 * samme for hele kilden, så den leses av datasettet i stedet for å stå to
 * steder — og skriptet som bygger datasettet setter den.
 */
export const RUS_ANALYSEMETODE: string = (() => {
  const forste = rusDatasett.rader[0]
  if (!forste) throw new Error('rusmidler.json har ingen rader')
  return forste.analysemetode
})()

const raderById = new Map(rusDatasett.rader.map((r) => [r.id, r]))

/** Raden med denne id-en. Kaster om den mangler — id-ene er skriptets kontrakt. */
function rad(id: string): RusRad {
  const funnet = raderById.get(id)
  if (!funnet) throw new Error(`ukjent rad i rusmidler.json: ${id}`)
  return funnet
}

/** Kommentarteksten en rad gir under denne nøkkelen. */
function tekst(radId: string, nokkel = 'hoved'): string {
  const funnet = rad(radId).tekster[nokkel]
  if (funnet === undefined) throw new Error(`raden ${radId} mangler teksten ${nokkel}`)
  return funnet
}

/* --- Fortolkningen ------------------------------------------------------ */

/** Én kommentar, og analyttkoden(e) den skal limes inn på. */
export type RusPlassering = Kommentarplassering

export type RusResultat =
  | { type: 'mangler'; mangler: string[] }
  | { type: 'kommentarer'; plasseringer: RusPlassering[]; notiser: string[] }
  /**
   * Kilden har ingen standardkommentar for tilfellet, og sier at saken skal
   * tas opp i plenum. Da skal appen ikke tilby noe å kopiere — bare si hvorfor
   * (`melding`) og hva kilden sier om håndteringen (`veiledning`).
   */
  | { type: 'plenum'; melding: string; veiledning: string[] }

/** Det brukeren har svart i modulen. */
export interface RusInndata {
  /** Analyttkodene som er krysset av som påvist. */
  pavist: string[]
  /** Målte konsentrasjoner per analyttkode, slik de er tastet inn. */
  verdier: Record<string, string>
}

export const TOM_RUS_INNDATA: RusInndata = { pavist: [], verdier: {} }

/** En analytt modulen dekker. */
export interface RusAnalytt {
  kode: string
  navn: string
}

/** Et konsentrasjonsfelt modulen ber om for å avgjøre hvilken regel som gjelder. */
export type RusVerdifelt = RusAnalytt

export interface RusModul {
  id: string
  gruppe: string
  /** Kategorien i sidemenyen, hentet fra raden modulen bygger på. */
  kategori: string
  /** Navnet modulen vises og søkes opp med. */
  navn: string
  analytter: RusAnalytt[]
  /** Ekstra søkeord — koder og navnevarianter. */
  aliaser: string[]
  /**
   * Konsentrasjonene fortolkningen trenger, gitt hva som er påvist. Tom når
   * ingen regel avhenger av tall.
   */
  verdifelter: (pavist: string[]) => RusVerdifelt[]
  /** Hvorfor modulen ber om tallene. Tom når den ikke gjør det. */
  verdihjelp: string
  fortolk: (inn: RusInndata) => RusResultat
}

/** Alle kodene modulen kan legge en kommentar på. */
export function moduleKoder(modul: RusModul): string[] {
  return modul.analytter.map((a) => a.kode)
}

/**
 * Sant når brukeren skal se hovedkommentaren før den kopieres.
 *
 * Har modulen noe å velge mellom, kan valget bli feil, og da må teksten som
 * faktisk havner på utklippstavlen kunne leses av. Er det bare én kommentar
 * uansett, holder det at den henger på kopiknappen som et tips.
 */
export function viserKommentartekst(modul: RusModul): boolean {
  return modul.analytter.length > 1
}

/* --- Byggeklosser -------------------------------------------------------- */

function hoved(
  radId: string,
  koder: string[],
  { nokkel = 'hoved', merke = 'Hovedkommentar' } = {},
): RusPlassering {
  return { rolle: 'hoved', merke, koder, tekst: tekst(radId, nokkel) }
}

function tillegg(
  radId: string,
  koder: string[],
  { nokkel = 'tillegg', merke = 'Tilleggskommentar' } = {},
): RusPlassering {
  return { rolle: 'tillegg', merke, koder, tekst: tekst(radId, nokkel) }
}

const VELG_PAVIST = 'Kryss av for hvilke av analyttene som er påvist.'
const FYLL_INN_TALL = 'Fyll inn de målte konsentrasjonene, så avgjøres regelen.'

/** Kodene i `rekkefolge` som er påvist, i modulens egen rekkefølge. */
function pavisteAv(pavist: string[], rekkefolge: string[]): string[] {
  return rekkefolge.filter((kode) => pavist.includes(kode))
}

/**
 * Leser et konsentrasjonstall slik det tastes i norske felt. `null` når
 * teksten ikke er et tall som ikke er negativt.
 */
export function lesKonsentrasjon(tekst: string): number | null {
  const trimmet = tekst.trim().replace(',', '.')
  if (trimmet === '' || !/^\d+(\.\d+)?$/.test(trimmet)) return null
  return Number(trimmet)
}

/** Alle de oppgitte konsentrasjonene, eller `null` om noen mangler. */
function lesAlle(verdier: Record<string, string>, koder: string[]): number[] | null {
  const tall = koder.map((kode) => lesKonsentrasjon(verdier[kode] ?? ''))
  return tall.every((v): v is number => v !== null) ? tall : null
}

/* --- Moduler for ett stoff ----------------------------------------------- */

/**
 * En modul for én analytt: ingen valg, én kommentar, én kode å lime den inn
 * på. Kildens veiledning følger med der den finnes.
 */
function enkeltmodul(radId: string, navn: string, aliaser: string[] = []): RusModul {
  const kilde = rad(radId)
  const kode = kilde.koder[0]
  if (kode === undefined) throw new Error(`raden ${radId} mangler analyttkode`)

  return {
    id: radId,
    gruppe: kilde.gruppe,
    kategori: kilde.kategori,
    navn,
    analytter: [{ kode, navn }],
    aliaser: [kode, ...aliaser],
    verdifelter: () => [],
    verdihjelp: '',
    fortolk: () => ({
      type: 'kommentarer',
      plasseringer: [hoved(radId, [kode])],
      notiser: Object.values(kilde.merknader),
    }),
  }
}

/* --- Diazepam, N-desmetyldiazepam og oksazepam --------------------------- */

const DIAZ = 'DIAZ'
const DMI = 'DMI'
const OXA = 'OXA'

/** Kildens grense: fellesskommentaren brukes når oksazepam er høyst så stor andel. */
export const OKSAZEPAM_GRENSE = 0.1

const DIAZEPAM_ANALYTTER: RusAnalytt[] = [
  { kode: DIAZ, navn: 'Diazepam' },
  { kode: DMI, navn: 'N-desmetyldiazepam' },
  { kode: OXA, navn: 'Oksazepam' },
]

/**
 * Kommentarene for diazepam og desmetyldiazepam alene: hovedkommentaren på
 * diazepam når begge er påvist, ellers på den ene som er påvist.
 */
function diazepamPar(benzo: string[]): RusPlassering[] {
  const barer = benzo[0]
  if (barer === undefined) return []
  const radId = barer === DIAZ ? 'diazepam' : 'desmetyldiazepam'
  return [
    hoved(radId, [barer]),
    // Tilleggsteksten står på desmetyldiazepamraden i kilden, og er den samme
    // uansett hvilken av de to som bærer hovedkommentaren.
    ...(benzo.length > 1 ? [tillegg('desmetyldiazepam', benzo.slice(1))] : []),
  ]
}

/**
 * Diazepam, N-desmetyldiazepam og oksazepam.
 *
 * Diazepam og desmetyldiazepam vurderes alltid samlet. Er oksazepam påvist i
 * tillegg til begge, avgjør kildens 10 %-regel om alle tre får den felles
 * kommentaren, eller om oksazepam kommenteres for seg.
 */
const diazepamgruppen: RusModul = {
  id: 'diazepamgruppen',
  gruppe: rad('diazepamgruppen-samlet').gruppe,
  kategori: rad('diazepamgruppen-samlet').kategori,
  navn: 'Diazepam + N-desmetyldiazepam + oksazepam',
  analytter: DIAZEPAM_ANALYTTER,
  aliaser: [DIAZ, DMI, OXA, 'desmetyldiazepam'],

  // Kilden gir fellesskommentaren bare når alle tre er påvist, og det er da
  // 10 %-regelen avgjør hvilken kommentar som gjelder.
  verdifelter: (pavist) =>
    pavisteAv(pavist, [DIAZ, DMI, OXA]).length === 3 ? DIAZEPAM_ANALYTTER : [],

  verdihjelp:
    'Alle tre får den felles kommentaren bare når oksazepam utgjør høyst 10 % av summen av ' +
    'diazepam og desmetyldiazepam.',

  fortolk: ({ pavist, verdier }) => {
    const benzo = pavisteAv(pavist, [DIAZ, DMI])
    const harOxa = pavist.includes(OXA)

    if (benzo.length === 0 && !harOxa) return { type: 'mangler', mangler: [VELG_PAVIST] }

    // Oksazepam alene er ikke en sumanalyse — da gjelder standardkommentaren.
    if (benzo.length === 0) {
      return { type: 'kommentarer', plasseringer: [hoved('oksazepam', [OXA])], notiser: [] }
    }

    if (!harOxa) {
      return { type: 'kommentarer', plasseringer: diazepamPar(benzo), notiser: [] }
    }

    /** Diazepam/desmetyldiazepam og oksazepam kommentert hver for seg. */
    const hverForSeg = (notiser: string[]): RusResultat => ({
      type: 'kommentarer',
      plasseringer: [
        ...diazepamPar(benzo),
        hoved('oksazepam', [OXA], { merke: 'Hovedkommentar for oksazepam' }),
      ],
      notiser,
    })

    // Kilden knytter fellesskommentaren til at alle tre er påvist. Er bare den
    // ene av diazepam og desmetyldiazepam påvist sammen med oksazepam, sier
    // den ingenting, og stoffene kommenteres hver for seg.
    if (benzo.length < 2) {
      return hverForSeg([
        'Fellesskommentaren gjelder når diazepam, desmetyldiazepam og oksazepam alle er påvist. ' +
          'Her er bare to av dem påvist, og de kommenteres hver for seg.',
      ])
    }

    const tall = lesAlle(verdier, [DIAZ, DMI, OXA])
    if (tall === null) return { type: 'mangler', mangler: [FYLL_INN_TALL] }

    const [diazepam = 0, desmetyl = 0, oksazepam = 0] = tall
    const sum = diazepam + desmetyl
    if (sum <= 0) {
      return {
        type: 'mangler',
        mangler: [
          'Summen av diazepam og desmetyldiazepam må være større enn 0 for at 10 %-regelen skal kunne regnes ut.',
        ],
      }
    }

    const andel = oksazepam / sum

    if (andel > OKSAZEPAM_GRENSE) {
      return hverForSeg([
        'Oksazepam > 10 % av diazepam + N-desmetyldiazepam\n⟶ Oksazepam kommenteres for seg selv.',
      ])
    }

    return {
      type: 'kommentarer',
      plasseringer: [
        hoved('diazepamgruppen-samlet', [DIAZ]),
        tillegg('diazepamgruppen-samlet', [DMI, OXA]),
      ],
      notiser: [
        'Oksazepam ≤ 10 % av diazepam + N-desmetyldiazepam\n⟶ Felles kommentar for alle tre.',
      ],
    }
  },
}

/* --- Tramadol og O-desmetyltramadol -------------------------------------- */

const TRAM = 'TRAM'
const OTRAM = 'OTRAM'

/**
 * Tramadol og O-desmetyltramadol vurderes samlet: hovedkommentaren legges på
 * tramadol når begge er påvist, ellers på den som er påvist alene.
 */
const tramadolgruppen: RusModul = {
  id: 'tramadolgruppen',
  gruppe: rad('tramadolgruppen').gruppe,
  kategori: rad('tramadolgruppen').kategori,
  navn: 'Tramadol + O-desmetyltramadol',
  analytter: [
    { kode: TRAM, navn: 'Tramadol' },
    { kode: OTRAM, navn: 'O-desmetyltramadol' },
  ],
  aliaser: [TRAM, OTRAM, 'desmetyltramadol'],
  verdifelter: () => [],
  verdihjelp: '',

  fortolk: ({ pavist }) => {
    const paviste = pavisteAv(pavist, [TRAM, OTRAM])
    if (paviste.length === 0) return { type: 'mangler', mangler: [VELG_PAVIST] }

    // Bare O-desmetyltramadol påvist: da bærer den hovedkommentaren selv.
    const barer = paviste.length === 1 ? (paviste[0] as string) : TRAM

    return {
      type: 'kommentarer',
      plasseringer: [
        hoved('tramadolgruppen', [barer]),
        ...(paviste.length > 1 ? [tillegg('tramadolgruppen', [OTRAM])] : []),
      ],
      notiser: [],
    }
  },
}

/* --- Kodein og morfin ---------------------------------------------------- */

const KOD = 'KOD'
const MOR = 'MOR'

const KODEIN_ANALYTTER: RusAnalytt[] = [
  { kode: KOD, navn: 'Kodein' },
  { kode: MOR, navn: 'Morfin' },
]

/** Kildens grenser for forholdet morfin/kodein når begge er påvist. */
export const LAV_MORFIN_GRENSE = 0.2
export const HOY_MORFIN_GRENSE = 1

/**
 * Kodein og morfin.
 *
 * Hver for seg har de hver sin standardkommentar. Er begge påvist, avgjør
 * forholdet mellom konsentrasjonene hvilken kommentar som gjelder: under 20 %
 * morfin av kodein er det høy kodein og lav morfin, over 100 % er det den
 * ordinære kombinasjonen, og imellom har kilden ingen standardkommentar —
 * saken skal tas opp i plenum.
 */
const kodeingruppen: RusModul = {
  id: 'kodeingruppen',
  gruppe: rad('kun-kodein').gruppe,
  kategori: rad('kun-kodein').kategori,
  navn: 'Kodein + morfin',
  analytter: KODEIN_ANALYTTER,
  aliaser: [KOD, MOR],

  verdifelter: (pavist) =>
    pavisteAv(pavist, [KOD, MOR]).length === 2 ? KODEIN_ANALYTTER : [],

  verdihjelp: '',

  fortolk: ({ pavist, verdier }) => {
    const paviste = pavisteAv(pavist, [KOD, MOR])
    if (paviste.length === 0) return { type: 'mangler', mangler: [VELG_PAVIST] }

    if (paviste.length === 1) {
      const alene = paviste[0] === KOD ? 'kun-kodein' : 'kun-morfin'
      const nokkel = paviste[0] === KOD ? 'kodein' : 'morfin'
      return {
        type: 'kommentarer',
        plasseringer: [hoved(alene, paviste, { nokkel })],
        notiser: [],
      }
    }

    const tall = lesAlle(verdier, [KOD, MOR])
    if (tall === null) return { type: 'mangler', mangler: [FYLL_INN_TALL] }

    const [kodein = 0, morfin = 0] = tall
    if (kodein <= 0) {
      return {
        type: 'mangler',
        mangler: ['Kodein må være større enn 0 for at forholdet mellom stoffene skal kunne regnes ut.'],
      }
    }

    const andel = morfin / kodein

    if (andel < LAV_MORFIN_GRENSE) {
      return {
        type: 'kommentarer',
        plasseringer: [
          hoved('hoy-kodein-lav-morfin', [KOD], { nokkel: 'kodein' }),
          tillegg('hoy-kodein-lav-morfin', [MOR], { nokkel: 'morfin' }),
        ],
        notiser: ['Morfin < 20 % av kodein ⟶ Forenlig med inntak av kodein alene.'],
      }
    }

    // Gråsonen: kilden har ingen standardkommentar, og sier uttrykkelig at
    // saken ikke skal avgjøres automatisk. Veiledningen som vises er den
    // kilden gir for hvert av de to stoffene; kriteriet og håndteringsraden
    // sier det samme som meldingen over dem.
    if (andel <= HOY_MORFIN_GRENSE) {
      const grasone = rad('kodein-morfin-grasone').merknader
      return {
        type: 'plenum',
        melding: 'Morfin = 20–100 % av kodein. Vurder manuelt.',
        veiledning: [grasone.kodein, grasone.morfin].filter((t): t is string => Boolean(t)),
      }
    }

    return {
      type: 'kommentarer',
      plasseringer: [
        hoved('kodein-morfin-ordinaer', [KOD], {
          nokkel: 'kodein',
          merke: 'Hovedkommentar for kodein',
        }),
        hoved('kodein-morfin-ordinaer', [MOR], {
          nokkel: 'morfin',
          merke: 'Hovedkommentar for morfin',
        }),
      ],
      notiser: ['Morfin > kodein ⟶ Ikke forenlig med inntak av kodein alene.'],
    }
  },
}

/* --- Amfetamin og metamfetamin ------------------------------------------- */

const AMF = 'AMF1'
const MAF = 'MAF1'

/**
 * Amfetamin og metamfetamin.
 *
 * Er begge påvist, legges fellesskommentaren på metamfetamin — den forklarer
 * nettopp at amfetamin alene kan komme fra legemidler — og amfetamin får
 * henvisningen dit.
 */
const amfetamingruppen: RusModul = {
  id: 'amfetamingruppen',
  gruppe: rad('amfetamingruppen-samlet').gruppe,
  kategori: rad('amfetamingruppen-samlet').kategori,
  navn: 'Amfetamin + metamfetamin',
  analytter: [
    { kode: AMF, navn: 'Amfetamin' },
    { kode: MAF, navn: 'Metamfetamin' },
  ],
  aliaser: [AMF, MAF],
  verdifelter: () => [],
  verdihjelp: '',

  fortolk: ({ pavist }) => {
    const paviste = pavisteAv(pavist, [AMF, MAF])
    if (paviste.length === 0) return { type: 'mangler', mangler: [VELG_PAVIST] }

    if (paviste.length === 1) {
      const alene = paviste[0] === AMF ? 'amfetamin' : 'metamfetamin'
      return { type: 'kommentarer', plasseringer: [hoved(alene, paviste)], notiser: [] }
    }

    return {
      type: 'kommentarer',
      plasseringer: [
        hoved('amfetamingruppen-samlet', [MAF]),
        tillegg('amfetamingruppen-samlet', [AMF]),
      ],
      notiser: [],
    }
  },
}

/* --- Alle modulene ------------------------------------------------------- */

export const RUS_MODULER: RusModul[] = [
  enkeltmodul('alprazolam', 'Alprazolam'),
  diazepamgruppen,
  enkeltmodul('klonazepam', 'Klonazepam'),
  enkeltmodul('nitrazepam', 'Nitrazepam'),
  enkeltmodul('zolpidem', 'Zolpidem'),
  enkeltmodul('zopiklon', 'Zopiklon'),
  enkeltmodul('thc', 'THC', ['cannabis']),
  enkeltmodul('buprenorfin', 'Buprenorfin'),
  enkeltmodul('fentanyl', 'Fentanyl'),
  kodeingruppen,
  enkeltmodul('metadon', 'Metadon'),
  enkeltmodul('oksykodon', 'Oksykodon'),
  enkeltmodul('tapentadol', 'Tapentadol'),
  tramadolgruppen,
  amfetamingruppen,
  enkeltmodul('benzoylekgonin', 'Benzoylekgonin', ['kokain']),
  enkeltmodul('mdma', 'MDMA', ['ecstasy']),
]

/* --- Oppføringene i søket ------------------------------------------------ */

/**
 * Modulen som en søkeoppføring hører til. Nøkkelen er `Analyte.kode`, som for
 * disse oppføringene er alle modulens koder satt sammen.
 */
const modulPerKode = new Map<string, RusModul>()

function tilAnalytt(modul: RusModul): Analyte {
  const kode = moduleKoder(modul).join(' · ')
  modulPerKode.set(kode, modul)
  return {
    kode,
    navn: modul.navn,
    visningsnavn: modul.navn,
    komponenter: modul.analytter.map((a) => a.navn),
    gruppe: modul.gruppe,
    analysemetode: RUS_ANALYSEMETODE,
    kategori: modul.kategori,
    // Feltene under gjelder konsentrasjonsbåndene, som denne kategorien ikke
    // har. De står tomme, slik THC-syreoppføringen også gjør.
    enhet: '',
    referanseomrade: null,
    maleomrade: { tekst: '', deler: [] },
    aliaser: modul.aliaser,
  }
}

/**
 * Modulene som søkbare oppføringer. Koden i oppføringen er alle modulens
 * analyttkoder, så det går fram av alternativet hvilke koder modulen dekker —
 * og hvert enkelt navn og hver enkelt kode finner den gjennom `komponenter`
 * og `aliaser`.
 */
export const RUS_ANALYTTER: Analyte[] = RUS_MODULER.map(tilAnalytt)

export function rusModulFor(analyte: Analyte): RusModul | undefined {
  return modulPerKode.get(analyte.kode)
}

export function erRusAnalytt(analyte: Analyte): boolean {
  return modulPerKode.has(analyte.kode)
}
