import type { Kommentaroppslag } from './kommentarobjekt'
import type { Scenarioinndata, Scenarioregelsett, Scenarioresultat } from './scenario'
import type { Analyte } from '../types'

/**
 * Stoffene med ruspotensial i serum: modulene fortolkningen har for dem, og
 * søkeoppføringene de gir.
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
 * Her står bare hvilke moduler som finnes, hva de heter og hvilke analytter de
 * dekker. Reglene og kommentartekstene er faginnhold i Supabase: ett
 * scenarioregelsett per modul, med samme nøkkel som modulen, og
 * kommentarobjektene scenariene peker på (`docs/scenarioregler.md`). Appen
 * henter de publiserte og sender dem inn til fortolkningen som {@link Rusregler}.
 */

/* --- Fortolkningen ------------------------------------------------------ */

export type RusResultat = Scenarioresultat
export type RusPlassering = Extract<RusResultat, { type: 'kommentarer' }>['plasseringer'][number]

/** Det brukeren har svart i modulen. */
export type RusInndata = Scenarioinndata

export const TOM_RUS_INNDATA: RusInndata = { pavist: [], verdier: {} }

/**
 * Reglene fortolkningen av en modul bruker, slik appen har dem: på vei, ikke
 * mulige å hente, eller klare — regelsettet for modulen og kommentarene det
 * peker på.
 */
export type Rusregler =
  | { status: 'laster' }
  | { status: 'feil'; melding: string; provIgjen: () => void }
  | { status: 'klar'; regelsett: Scenarioregelsett; kommentarer: Kommentaroppslag }

/* --- Modulene ------------------------------------------------------------ */

/** En analytt modulen dekker. */
export interface RusAnalytt {
  kode: string
  navn: string
}

/** Et konsentrasjonsfelt modulen ber om for å avgjøre hvilken regel som gjelder. */
export type RusVerdifelt = RusAnalytt

export interface RusModul {
  /** Nøkkelen, den samme som regelsettets `modul`. */
  id: string
  gruppe: string
  /** Kategorien i sidemenyen. */
  kategori: string
  /** Navnet modulen vises og søkes opp med. */
  navn: string
  analytter: RusAnalytt[]
  /** Ekstra søkeord — koder og navnevarianter. */
  aliaser: string[]
}

/** Analysemetoden alle stoffene rekvireres under. */
export const RUS_ANALYSEMETODE = 'SRUS'

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

/** Konsentrasjonsfeltene regelsettet ber om, med analyttnavnene fra modulen. */
export function rusVerdifelter(modul: RusModul, koder: readonly string[]): RusVerdifelt[] {
  return koder.map((kode) => modul.analytter.find((a) => a.kode === kode) ?? { kode, navn: kode })
}

const BENZO = 'Benzodiazepiner og Z-hypnotika'
const OPIOIDER = 'Opioider'
const STIMULERENDE = 'Sentralstimulerende'

/**
 * En modul. Analyttene står som [kode, navn]; en modul for én analytt heter
 * det samme som analytten. Kodene er alltid søkeord.
 */
function modul(
  id: string,
  navn: string,
  gruppe: string,
  analytter: [string, string][],
  { aliaser = [], kategori = gruppe }: { aliaser?: string[]; kategori?: string } = {},
): RusModul {
  return {
    id,
    gruppe,
    kategori,
    navn,
    analytter: analytter.map(([kode, analyttnavn]) => ({ kode, navn: analyttnavn })),
    aliaser: [...analytter.map(([kode]) => kode), ...aliaser],
  }
}

/** En modul for én analytt. */
function enkelt(id: string, kode: string, navn: string, gruppe: string, aliaser: string[] = [], kategori = gruppe) {
  return modul(id, navn, gruppe, [[kode, navn]], { aliaser, kategori })
}

export const RUS_MODULER: RusModul[] = [
  enkelt('alprazolam', 'APR', 'Alprazolam', BENZO),
  modul(
    'diazepamgruppen',
    'Diazepam + N-desmetyldiazepam + oksazepam',
    BENZO,
    [
      ['DIAZ', 'Diazepam'],
      ['DMI', 'N-desmetyldiazepam'],
      ['OXA', 'Oksazepam'],
    ],
    { aliaser: ['desmetyldiazepam'] },
  ),
  enkelt('klonazepam', 'CZP', 'Klonazepam', BENZO),
  enkelt('nitrazepam', 'NIT', 'Nitrazepam', BENZO),
  enkelt('zolpidem', 'ZOLP', 'Zolpidem', BENZO),
  enkelt('zopiklon', 'ZOPI', 'Zopiklon', BENZO),
  enkelt('thc', 'THC', 'THC', 'Cannabis', ['cannabis'], 'Cannabinoider'),
  enkelt('buprenorfin', 'BUP', 'Buprenorfin', OPIOIDER),
  enkelt('fentanyl', 'FYL', 'Fentanyl', OPIOIDER),
  modul('kodeingruppen', 'Kodein + morfin', OPIOIDER, [
    ['KOD', 'Kodein'],
    ['MOR', 'Morfin'],
  ]),
  enkelt('metadon', 'MDO', 'Metadon', OPIOIDER),
  enkelt('oksykodon', 'OKSY', 'Oksykodon', OPIOIDER),
  enkelt('tapentadol', 'TAP', 'Tapentadol', OPIOIDER),
  modul(
    'tramadolgruppen',
    'Tramadol + O-desmetyltramadol',
    OPIOIDER,
    [
      ['TRAM', 'Tramadol'],
      ['OTRAM', 'O-desmetyltramadol'],
    ],
    { aliaser: ['desmetyltramadol'] },
  ),
  modul('amfetamingruppen', 'Amfetamin + metamfetamin', STIMULERENDE, [
    ['AMF1', 'Amfetamin'],
    ['MAF1', 'Metamfetamin'],
  ]),
  enkelt('benzoylekgonin', 'BEZ1', 'Benzoylekgonin', STIMULERENDE, ['kokain']),
  enkelt('mdma', 'ECS1', 'MDMA', STIMULERENDE, ['ecstasy']),
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
