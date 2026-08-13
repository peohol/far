import rusdata from '../data/rusmidler.json'
import type { Analyte } from '../types'

/**
 * Fortolkning av stoffer med ruspotensial i serum, etter tabellene i
 * `originaldata/rusmidler.pdf` (bygget til `src/data/rusmidler.json` med
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
 * Kommentartekstene er kildens egne og skal ikke endres her; rettelsene
 * (tankestrek i intervaller, mellomrom foran prosenttegn) gjøres i
 * byggeskriptet og ligger i `meta.rettelser` i datasettet.
 */

/* --- Datasettet --------------------------------------------------------- */

/** En rad i kildetabellene. */
export interface RusRad {
  id: string
  gruppe: string
  /** Analyttkolonnen slik den står, f.eks. «KOMBINASJON Høy kodein, lav morfin». */
  analytt: string
  koder: string[]
  hovedkommentar: string
  /** Kommentaren som legges på de analyttene som ikke bærer hovedkommentaren. */
  tilleggskommentar: string
  /** Kildens veiledning til den som fortolker. Limes ikke inn noe sted. */
  bemerkninger: string[]
}

export interface RusDatasett {
  meta: {
    kilde: string
    antallRader: number
    rettelser: { kategori: string; hvor: string; fra: string; til: string; begrunnelse: string }[]
  }
  rader: RusRad[]
}

export const rusDatasett = rusdata as RusDatasett

const raderById = new Map(rusDatasett.rader.map((r) => [r.id, r]))

/** Raden med denne id-en. Kaster om den mangler — id-ene er skriptets kontrakt. */
function rad(id: string): RusRad {
  const funnet = raderById.get(id)
  if (!funnet) throw new Error(`ukjent rad i rusmidler.json: ${id}`)
  return funnet
}

/* --- Fortolkningen ------------------------------------------------------ */

/** Én kommentar, og analyttkoden(e) den skal limes inn på. */
export interface RusPlassering {
  rolle: 'hoved' | 'tillegg'
  /** Merkelappen som vises, f.eks. «Hovedkommentar for morfin». */
  merke: string
  koder: string[]
  tekst: string
}

export type RusResultat =
  | { type: 'mangler'; mangler: string[] }
  | { type: 'kommentarer'; plasseringer: RusPlassering[]; notiser: string[] }

/** Det brukeren har svart i modulen. */
export interface RusInndata {
  /** Analyttkodene som er krysset av som påvist. */
  pavist: string[]
  /** Målte konsentrasjoner per analyttkode, slik de er tastet inn. */
  verdier: Record<string, string>
  /** Om modulens tilleggsavkryssing er huket av. Se {@link RusModul.avkryssing}. */
  avkrysset: boolean
}

export const TOM_RUS_INNDATA: RusInndata = { pavist: [], verdier: {}, avkrysset: false }

/** En analytt modulen dekker. */
export interface RusAnalytt {
  kode: string
  navn: string
}

/** Et konsentrasjonsfelt modulen ber om for å avgjøre hvilken regel som gjelder. */
export interface RusVerdifelt {
  kode: string
  navn: string
}

/** Avkryssingen modulen ber brukeren ta stilling til. */
export interface RusAvkryssing {
  merke: string
  /** Kildens veiledning for vurderingen. */
  hjelp: string
}

export interface RusModul {
  id: string
  gruppe: string
  /** Navnet modulen vises og søkes opp med. */
  navn: string
  analytter: RusAnalytt[]
  /** Ekstra søkeord — koder og navnevarianter fra kilden. */
  aliaser: string[]
  /**
   * Konsentrasjonene fortolkningen trenger, gitt hva som er påvist. Tom når
   * ingen regel avhenger av tall.
   */
  verdifelter: (pavist: string[]) => RusVerdifelt[]
  /** Hvorfor modulen ber om tallene. Tom når den ikke gjør det. */
  verdihjelp: string
  /** Avkryssingen brukeren må ta stilling til, gitt hva som er påvist. */
  avkryssing: (pavist: string[]) => RusAvkryssing | null
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

function hoved(radId: string, koder: string[], merke = 'Hovedkommentar'): RusPlassering {
  return { rolle: 'hoved', merke, koder, tekst: rad(radId).hovedkommentar }
}

function tillegg(radId: string, koder: string[]): RusPlassering {
  return {
    rolle: 'tillegg',
    merke: 'Tilleggskommentar',
    koder,
    tekst: rad(radId).tilleggskommentar,
  }
}

const VELG_PAVIST = 'Kryss av for hvilke av analyttene som er påvist.'

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

/** «6.25» → «6,3 %». Ett desimal er nok til å se hvilken side av 10 % man er på. */
function prosent(andel: number): string {
  return `${(andel * 100).toFixed(1).replace('.', ',')} %`
}

/* --- Moduler for ett stoff ----------------------------------------------- */

/**
 * En modul for én analytt: ingen valg, én kommentar, én kode å lime den inn
 * på. Kildens bemerkning følger med som veiledning der den finnes.
 */
function enkeltmodul(radId: string, navn: string, aliaser: string[] = []): RusModul {
  const kilde = rad(radId)
  const kode = kilde.koder[0]
  if (kode === undefined) throw new Error(`raden ${radId} mangler analyttkode`)

  return {
    id: radId,
    gruppe: kilde.gruppe,
    navn,
    analytter: [{ kode, navn }],
    aliaser: [kode, ...aliaser],
    verdifelter: () => [],
    verdihjelp: '',
    avkryssing: () => null,
    fortolk: () => ({
      type: 'kommentarer',
      plasseringer: [hoved(radId, [kode])],
      notiser: kilde.bemerkninger,
    }),
  }
}

/* --- Diazepam, N-desmetyldiazepam og oksazepam --------------------------- */

const DIAZ = 'DIAZ'
const DMI = 'DMI'
const OXA = 'OXA'

/** Kildens grense for når de tre fortolkes under ett (diazepamgruppen-samlet). */
export const OKSAZEPAM_GRENSE = 0.1

/** Raden hovedkommentaren for diazepam/desmetyldiazepam hentes fra. */
function diazepamrad(kode: string): string {
  return kode === DIAZ ? 'diazepam' : 'desmetyldiazepam'
}

/**
 * Diazepam, N-desmetyldiazepam og oksazepam.
 *
 * Diazepam og desmetyldiazepam vurderes alltid samlet: hovedkommentaren legges
 * på diazepam når begge er påvist, ellers på den som er påvist alene. Er
 * oksazepam påvist i tillegg, avgjør kildens 10 %-regel om alle tre får den
 * felles kommentaren, eller om oksazepam kommenteres for seg.
 */
const DIAZEPAM_ANALYTTER: RusAnalytt[] = [
  { kode: DIAZ, navn: 'Diazepam' },
  { kode: DMI, navn: 'N-desmetyldiazepam' },
  { kode: OXA, navn: 'Oksazepam' },
]

const diazepamgruppen: RusModul = {
  id: 'diazepamgruppen',
  gruppe: rad('diazepamgruppen-samlet').gruppe,
  navn: 'Diazepam + N-desmetyldiazepam + oksazepam',
  analytter: DIAZEPAM_ANALYTTER,
  aliaser: [DIAZ, DMI, OXA, 'desmetyldiazepam'],

  // Tallene trengs bare når oksazepam er påvist sammen med minst én av de to
  // andre; det er da 10 %-regelen avgjør hvilken kommentar som gjelder.
  verdifelter: (pavist) => {
    const benzo = pavisteAv(pavist, [DIAZ, DMI])
    if (!pavist.includes(OXA) || benzo.length === 0) return []
    return DIAZEPAM_ANALYTTER.filter((a) => [...benzo, OXA].includes(a.kode))
  },

  verdihjelp:
    'Oksazepam kommenteres sammen med de andre bare når det utgjør under 10 % av summen av ' +
    'diazepam og desmetyldiazepam. Bare forholdet mellom tallene teller, så enheten spiller ' +
    'ingen rolle.',

  avkryssing: () => null,

  fortolk: ({ pavist, verdier }) => {
    const benzo = pavisteAv(pavist, [DIAZ, DMI])
    const harOxa = pavist.includes(OXA)
    const barer = benzo[0]

    if (barer === undefined && !harOxa) return { type: 'mangler', mangler: [VELG_PAVIST] }

    // Oksazepam alene er ikke en sumanalyse — da gjelder standardkommentaren.
    if (barer === undefined) {
      return { type: 'kommentarer', plasseringer: [hoved('oksazepam', [OXA])], notiser: [] }
    }

    const diazepamPar = (): RusPlassering[] => [
      hoved(diazepamrad(barer), [barer]),
      ...(benzo.length > 1 ? [tillegg(diazepamrad(barer), benzo.slice(1))] : []),
    ]

    if (!harOxa) {
      return { type: 'kommentarer', plasseringer: diazepamPar(), notiser: [] }
    }

    const oksazepam = lesKonsentrasjon(verdier[OXA] ?? '')
    const benzotall = benzo.map((kode) => lesKonsentrasjon(verdier[kode] ?? ''))
    if (oksazepam === null || benzotall.some((v) => v === null)) {
      return {
        type: 'mangler',
        mangler: ['Fyll inn de målte konsentrasjonene, så avgjøres 10 %-regelen for oksazepam.'],
      }
    }

    const sum = benzotall.reduce((sa: number, v) => sa + (v ?? 0), 0)
    if (sum <= 0) {
      return {
        type: 'mangler',
        mangler: [
          'Summen av diazepam og desmetyldiazepam må være større enn 0 for at 10 %-regelen skal kunne regnes ut.',
        ],
      }
    }

    const andel = oksazepam / sum
    const grunn = `Oksazepam utgjør ${prosent(andel)} av summen av ${benzo
      .map((kode) => (kode === DIAZ ? 'diazepam' : 'desmetyldiazepam'))
      .join(' og ')}.`

    // Kilden sier «Brukes når SOXA < 10 %» og «Dersom SOXA > 10 % brukes
    // standardkommentarene». Nøyaktig 10 % dekkes ikke av noen av dem; her
    // gjelder standardkommentarene, slik at fellesskommentaren bare brukes der
    // kilden uttrykkelig sier at den skal.
    if (andel < OKSAZEPAM_GRENSE) {
      // Oksazepam er alltid med blant de øvrige her, så det finnes alltid en
      // analytt tilleggskommentaren skal ligge på.
      return {
        type: 'kommentarer',
        plasseringer: [
          hoved('diazepamgruppen-samlet', [barer]),
          tillegg('diazepamgruppen-samlet', [...benzo.slice(1), OXA]),
        ],
        notiser: [`${grunn} Under 10 %, og de påviste analyttene kommenteres under ett.`],
      }
    }

    return {
      type: 'kommentarer',
      plasseringer: [
        ...diazepamPar(),
        hoved('oksazepam', [OXA], 'Hovedkommentar for oksazepam'),
      ],
      notiser: [`${grunn} Ikke under 10 %, og oksazepam kommenteres for seg.`],
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
  gruppe: rad('tramadol').gruppe,
  navn: 'Tramadol + O-desmetyltramadol',
  analytter: [
    { kode: TRAM, navn: 'Tramadol' },
    { kode: OTRAM, navn: 'O-desmetyltramadol' },
  ],
  aliaser: [TRAM, OTRAM, 'desmetyltramadol'],
  verdifelter: () => [],
  verdihjelp: '',
  avkryssing: () => null,

  fortolk: ({ pavist }) => {
    const paviste = pavisteAv(pavist, [TRAM, OTRAM])
    if (paviste.length === 0) return { type: 'mangler', mangler: [VELG_PAVIST] }

    if (paviste.length === 1 && paviste[0] === OTRAM) {
      return {
        type: 'kommentarer',
        plasseringer: [hoved('o-desmetyltramadol', [OTRAM])],
        notiser: [],
      }
    }

    return {
      type: 'kommentarer',
      plasseringer: [
        hoved('tramadol', [TRAM]),
        ...(paviste.length > 1 ? [tillegg('o-desmetyltramadol', [OTRAM])] : []),
      ],
      notiser: [],
    }
  },
}

/* --- Kodein og morfin ---------------------------------------------------- */

const KOD = 'KOD'
const MOR = 'MOR'

/**
 * Kodein og morfin.
 *
 * Hver for seg har de hver sin standardkommentar. Er begge påvist, har kilden
 * to kombinasjonskommentarer: én for høy kodein og lav morfin, og én for alle
 * andre tilfeller. Den siste er kildens standardvalg, og er derfor det
 * avkryssingen står på til den hukes av.
 */
const kodeingruppen: RusModul = {
  id: 'kodeingruppen',
  gruppe: rad('kodein').gruppe,
  navn: 'Kodein + morfin',
  analytter: [
    { kode: KOD, navn: 'Kodein' },
    { kode: MOR, navn: 'Morfin' },
  ],
  aliaser: [KOD, MOR],
  verdifelter: () => [],
  verdihjelp: '',

  avkryssing: (pavist) =>
    pavisteAv(pavist, [KOD, MOR]).length === 2
      ? {
          merke: 'Høy kodein, lav morfin',
          // Kildens egen veiledning, fra bemerkningen på kodeinraden. Det er
          // den «Se tekst øverst» i kombinasjonsraden viser til.
          hjelp: rad('kodein').bemerkninger.join(' '),
        }
      : null,

  fortolk: ({ pavist, avkrysset }) => {
    const paviste = pavisteAv(pavist, [KOD, MOR])
    if (paviste.length === 0) return { type: 'mangler', mangler: [VELG_PAVIST] }

    if (paviste.length === 1) {
      const alene = paviste[0] === KOD ? 'kodein' : 'morfin'
      return {
        type: 'kommentarer',
        plasseringer: [hoved(alene, paviste)],
        notiser: rad(alene).bemerkninger,
      }
    }

    if (avkrysset) {
      return {
        type: 'kommentarer',
        plasseringer: [
          hoved('hoy-kodein-lav-morfin', [KOD]),
          tillegg('hoy-kodein-lav-morfin', [MOR]),
        ],
        notiser: [],
      }
    }

    // Kilden: morfin får sin egen standardkommentar i dette tilfellet, ikke en
    // henvisning til kodein («Det legges også til morfinkommentar på SMOR»).
    return {
      type: 'kommentarer',
      plasseringer: [
        hoved('kodein-med-morfin', [KOD], 'Hovedkommentar for kodein'),
        hoved('morfin', [MOR], 'Hovedkommentar for morfin'),
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
  enkeltmodul('thc', 'THC i serum', ['cannabis']),
  enkeltmodul('buprenorfin', 'Buprenorfin'),
  enkeltmodul('fentanyl', 'Fentanyl'),
  kodeingruppen,
  enkeltmodul('metadon', 'Metadon'),
  enkeltmodul('oksykodon', 'Oksykodon'),
  enkeltmodul('tapentadol', 'Tapentadol'),
  tramadolgruppen,
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
    // Feltene under gjelder konsentrasjonsbåndene, som denne kategorien ikke
    // har. De står tomme, slik THC-syreoppføringen også gjør.
    enhet: '',
    referanseomrade: null,
    maleomrade: { tekst: '', deler: [] },
    ringegrense: null,
    nedreGrense: 0,
    ovreGrense: 0,
    nivaer: [],
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
