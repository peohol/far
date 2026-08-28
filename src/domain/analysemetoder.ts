import { ETG_ANALYTTER, erEtgAnalytt } from './etg'
import { rusModulFor } from './rus'
import { displayName } from './names'
import { optionColourVars } from './optionColours'
import { THC_KODE, erThcAnalytt } from './thc'
import type { Analyte } from '../types'

/**
 * Analysemetodene appen dekker, og oversikten sidemenyen bygger av dem.
 *
 * Hvilken metode og kategori en analytt hører til står på analytten selv, satt
 * av skriptene som bygger datasettene. Ingenting her lister opp analytter:
 * menyen er alltid det datasettene faktisk inneholder, så en ny analytt dukker
 * opp av seg selv, og en som er tatt ut forsvinner.
 */

export interface Analysemetode {
  /** Koden metoden rekvireres med, f.eks. «SPFA». */
  kode: string
  /** Hva metoden er, i klartekst. */
  beskrivelse: string
}

/**
 * Metodene i den rekkefølgen menyen viser dem. Beskrivelsene er metodenes
 * egne navn i labsystemet.
 *
 * Rekkefølgen her bestemmer også fargen hver metode bærer — se
 * {@link metodefarger} — så en omrokering bytter om på fargene.
 */
export const ANALYSEMETODER: Analysemetode[] = [
  { kode: 'SPFA', beskrivelse: 'Antidepressiver og antipsykotika i serum' },
  { kode: 'SRUS', beskrivelse: 'Stoffer med ruspotensial i serum' },
  { kode: 'UCAK', beskrivelse: 'THC-syre i urin' },
  { kode: 'UETGHB', beskrivelse: 'Etanolmetabolitter i urin' },
  { kode: 'AHT', beskrivelse: 'Antihypertensiver' },
]

const METODE_PER_KODE = new Map(ANALYSEMETODER.map((m) => [m.kode, m]))

/**
 * Fargen metoden bærer overalt i appen: skuffen i menyen, pillen i
 * analyttkortet, pillen i søket og menyknappen når filteret står på den. Én
 * farge per metode, ett sted, så SPFA er den samme fargen uansett hvor den
 * dukker opp.
 *
 * Fargene kommer fra det samme settet som søkealternativene bruker, spredt
 * jevnt rundt fargesirkelen etter metodens plass i {@link ANALYSEMETODER}.
 * En kode som ikke står der, får den første fargen; at alle metodene i
 * datasettene er registrert, holdes av testene.
 */
export function metodefarger(kode: string): Record<string, string> {
  const plass = ANALYSEMETODER.findIndex((m) => m.kode === kode)
  return optionColourVars(Math.max(plass, 0), ANALYSEMETODER.length)
}

/**
 * Hurtigtasten som setter filteret på metoden: Alt + plassen i lista, fra 1.
 * `null` for en metode som ligger utenfor talltastene, og for ukjente koder.
 *
 * Tasten leses av det samme registeret som fargen og rekkefølgen, så merket i
 * menyen og tasten som faktisk virker ikke kan komme i utakt.
 */
export function metodesnarvei(kode: string): string | null {
  const plass = ANALYSEMETODER.findIndex((m) => m.kode === kode)
  return plass >= 0 && plass < 9 ? `Alt + ${plass + 1}` : null
}

/* --- Oppføringene i menyen ---------------------------------------------- */

/** Ett virkestoff i menyen, og analytten det fører til. */
export interface Menyanalytt {
  /** Analyttkoden virkestoffet svares ut med. */
  kode: string
  /** Virkestoffnavnet, slik det står i lista. */
  navn: string
  /** Søkeoppføringen et trykk velger — den samme som søket ville gitt. */
  analyte: Analyte
}

/**
 * Virkestoffene én søkeoppføring dekker: ett per analyttkode.
 *
 * De fleste oppføringene er én analytt med én kode, og blir én linje. De tre
 * fortolkningsmodulene dekker flere koder hver, og deles opp — det er
 * virkestoffene brukeren leter etter, ikke modulen de deler. Delingen følger
 * de samme skillene som ruteren i `state.ts` bruker, så en oppføring havner
 * ett sted og bare ett.
 *
 * Sumanalyser som «Amitriptylin + nortriptylin» deles ikke: de har én kode og
 * kommenteres under ett.
 */
export function menyanalytter(analyte: Analyte): Menyanalytt[] {
  const modul = rusModulFor(analyte)
  if (modul) return modul.analytter.map((a) => ({ kode: a.kode, navn: a.navn, analyte }))
  if (erEtgAnalytt(analyte)) return ETG_ANALYTTER.map((a) => ({ ...a, analyte }))
  if (erThcAnalytt(analyte)) return [{ kode: THC_KODE, navn: analyte.navn, analyte }]
  return [{ kode: analyte.kode, navn: displayName(analyte), analyte }]
}

/** Sammenligner navn slik norsk alfabetisk rekkefølge vil ha dem. */
function paaNavn(a: Menyanalytt, b: Menyanalytt): number {
  return a.navn.localeCompare(b.navn, 'nb')
}

export interface Menykategori {
  /** Kategorinavnet, f.eks. «Antidepressiver». */
  navn: string
  analytter: Menyanalytt[]
}

export interface Menymetode {
  kode: string
  beskrivelse: string
  /** Kategoriene i metoden, alfabetisk. Tom når metoden ikke er delt opp. */
  kategorier: Menykategori[]
  /** Alle virkestoffene i metoden alfabetisk, uten kategoriskillene. */
  analytter: Menyanalytt[]
}

/**
 * Bygger menyen av søkeoppføringene.
 *
 * Metodene kommer i rekkefølgen {@link ANALYSEMETODER} gir. En metode som
 * finnes i datasettet uten å stå der, havner sist i stedet for å forsvinne —
 * menyen skal aldri vise færre analytter enn appen har.
 */
export function byggMeny(pool: Analyte[]): Menymetode[] {
  const perMetode = new Map<string, Menyanalytt[]>()
  for (const analyte of pool) {
    const samlet = perMetode.get(analyte.analysemetode) ?? []
    for (const oppforing of menyanalytter(analyte)) samlet.push(oppforing)
    perMetode.set(analyte.analysemetode, samlet)
  }

  const kjente = ANALYSEMETODER.filter((m) => perMetode.has(m.kode))
  const ukjente = [...perMetode.keys()]
    .filter((kode) => !METODE_PER_KODE.has(kode))
    .sort((a, b) => a.localeCompare(b, 'nb'))
    .map((kode) => ({ kode, beskrivelse: kode }))

  return [...kjente, ...ukjente].map((metode) => {
    const analytter = (perMetode.get(metode.kode) ?? []).slice().sort(paaNavn)

    const kategorinavn = [...new Set(analytter.map((a) => a.analyte.kategori))]
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'nb'))

    return {
      ...metode,
      analytter,
      kategorier: kategorinavn.map((navn) => ({
        navn,
        analytter: analytter.filter((a) => a.analyte.kategori === navn),
      })),
    }
  })
}

/* --- Filteret ------------------------------------------------------------ */

/**
 * Analyttene søket skal lete i. `null` betyr alle metodene — det er filteret
 * slått av, og valget «Inkluder alle analysemetoder» i menyen.
 */
export function filtrertPool(pool: Analyte[], metode: string | null): Analyte[] {
  if (metode === null) return pool
  return pool.filter((a) => a.analysemetode === metode)
}
