import { ETG_ANALYTTER, erEtgAnalytt } from './etg'
import { rusModulFor } from './rus'
import { displayName } from './names'
import { optionColourVars } from './optionColours'
import { THC_KODE, erThcAnalytt } from './thc'
import type { Analyte } from '../types'

/**
 * Analysemetodene appen dekker, og filteret søket i fortolkningen kan
 * begrenses med.
 *
 * Hvilken metode og kategori en analytt hører til står på analytten selv, satt
 * av skriptene som bygger datasettene. Ingenting her lister opp analytter.
 * Sidemenyen er stoffregisteret, ordnet etter farmakologisk klasse
 * (`stoffregister.ts`), og bygges av katalogen.
 */

export interface Analysemetode {
  /** Koden metoden rekvireres med, f.eks. «SPFA». */
  kode: string
  /** Hva metoden er, i klartekst. */
  beskrivelse: string
}

/**
 * Metodene i den rekkefølgen filtermenyen viser dem. Beskrivelsene er metodenes
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

/**
 * Fargen metoden bærer overalt i appen: pillen i analyttkortet, pillen i
 * søket og filteret. Én farge per metode, ett sted, så SPFA er den samme
 * fargen uansett hvor den dukker opp.
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
 * filtermenyen og tasten som faktisk virker ikke kan komme i utakt.
 */
export function metodesnarvei(kode: string): string | null {
  const plass = ANALYSEMETODER.findIndex((m) => m.kode === kode)
  return plass >= 0 && plass < 9 ? `Alt + ${plass + 1}` : null
}

/**
 * Hurtigtasten som slår filteret av. Null hører ikke til noen metode, og står
 * derfor for «ingen av dem».
 */
export const AV_SNARVEI = 'Alt + 0'

/* --- Kodene i en oppføring --------------------------------------------- */

/** Ett virkestoff med sin analyttkode, og analytten det fører til. */
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

/* --- Filteret ------------------------------------------------------------ */

/**
 * Analyttene søket skal lete i. `null` betyr alle metodene — det er filteret
 * slått av.
 */
export function filtrertPool(pool: Analyte[], metode: string | null): Analyte[] {
  if (metode === null) return pool
  return pool.filter((a) => a.analysemetode === metode)
}
