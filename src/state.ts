import { erEtgAnalytt } from './domain/etg'
import { erRusAnalytt } from './domain/rus'
import { erThcAnalytt } from './domain/thc'
import type { Analyte } from './types'

/**
 * Arbeidsflyten er en liten tilstandsmaskin. Psykofarmaka går gjennom tre
 * steg — søk, bånd, lim inn — mens THC-syre, stoffene med ruspotensial i
 * serum og etanolmarkørene i urin går fra søket til hver sin
 * fortolkningsmodul og blir der til man bytter analytt. Hvilket steg som
 * vises utledes av tilstanden, så det finnes ingen egen «steg»-variabel som
 * kan komme i utakt med resten.
 */
export type Stage = 'search' | 'band' | 'paste' | 'thc' | 'rus' | 'etg'

export interface State {
  /** Teksten i søkefeltet. Beholdes når man går tilbake fra steg 2. */
  query: string
  analyte: Analyte | null
  /** Nøkkelen til konsentrasjonsbåndet brukeren valgte, når kommentaren er kopiert. */
  bandKey: string | null
  /** Om et enslig alternativ får velge seg selv. Se {@link narrow}. */
  autoPick: boolean
}

export const initialState: State = {
  query: '',
  analyte: null,
  bandKey: null,
  autoPick: true,
}

export type Action =
  /** `matches` er analyttene det nye søket gir — se {@link narrow}. */
  | { type: 'sett-sok'; value: string; matches: Analyte[] }
  | { type: 'velg-analytt'; analyte: Analyte }
  | { type: 'velg-band'; key: string }
  | { type: 'tilbake' }
  | { type: 'nullstill' }

export function stageOf(state: State): Stage {
  if (!state.analyte) return 'search'
  if (erThcAnalytt(state.analyte)) return 'thc'
  if (erRusAnalytt(state.analyte)) return 'rus'
  if (erEtgAnalytt(state.analyte)) return 'etg'
  return state.bandKey ? 'paste' : 'band'
}

/** Sant i steg 1, før brukeren har begynt å skrive. */
export function isIdle(state: State): boolean {
  return stageOf(state) === 'search' && state.query === ''
}

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'sett-sok':
      return narrow(state, action.value, action.matches)

    case 'velg-analytt':
      return pick(state, action.analyte)

    case 'velg-band':
      return { ...state, bandKey: action.key }

    case 'tilbake':
      return stepBack(state)

    case 'nullstill':
      return initialState
  }
}

function pick(state: State, analyte: Analyte): State {
  return { ...state, analyte, bandKey: null }
}

/**
 * Nytt søk. Smalner det inn til ett eneste alternativ, er valget i praksis
 * allerede tatt, og appen går videre til analytten uten at brukeren må
 * bekrefte det.
 *
 * Det skjer bare i selve overgangen fra noe annet enn ett alternativ til ett.
 * Turen tilbake hit fra steg 2 rører ikke søket og lar derfor det ene
 * alternativet stå — ellers ville «Bytt analytt» sendt brukeren rett inn igjen.
 * Å skrive videre på et søk som alt bare gir ett alternativ gjør det heller
 * ikke. Ny sjanse får man når søket igjen gir noe annet enn ett alternativ:
 * ved å slette tilbake til flere alternativer, eller tømme feltet helt.
 */
function narrow(state: State, query: string, matches: Analyte[]): State {
  const alone = matches.length === 1 ? matches[0] : undefined
  const next: State = { ...state, query, autoPick: alone === undefined }
  return alone && state.autoPick ? pick(next, alone) : next
}

/**
 * Esc angrer ett steg av gangen, og beholder det brukeren skrev i steget
 * foran slik at det er billig å ombestemme seg. Fra første steg nullstiller
 * den søket.
 */
function stepBack(state: State): State {
  switch (stageOf(state)) {
    case 'paste':
      return { ...state, bandKey: null }
    case 'band':
    case 'thc':
    case 'rus':
    case 'etg':
      return { ...state, analyte: null }
    case 'search':
      return initialState
  }
}
