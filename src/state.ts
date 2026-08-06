import type { Analyte } from './types'

/**
 * Arbeidsflyten er en liten tilstandsmaskin med tre steg. Hvilket steg som
 * vises utledes av tilstanden, så det finnes ingen egen «steg»-variabel som
 * kan komme i utakt med resten.
 */
export type Stage = 'search' | 'band' | 'paste'

export interface State {
  /** Teksten i søkefeltet. Beholdes når man går tilbake fra steg 2. */
  query: string
  analyte: Analyte | null
  /** Nøkkelen til konsentrasjonsbåndet brukeren valgte, når kommentaren er kopiert. */
  bandKey: string | null
}

export const initialState: State = {
  query: '',
  analyte: null,
  bandKey: null,
}

export type Action =
  | { type: 'sett-sok'; value: string }
  | { type: 'velg-analytt'; analyte: Analyte }
  | { type: 'velg-band'; key: string }
  | { type: 'tilbake' }
  | { type: 'nullstill' }

export function stageOf(state: State): Stage {
  if (!state.analyte) return 'search'
  return state.bandKey ? 'paste' : 'band'
}

/** Sant i steg 1, før brukeren har begynt å skrive. */
export function isIdle(state: State): boolean {
  return stageOf(state) === 'search' && state.query === ''
}

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'sett-sok':
      return { ...state, query: action.value }

    case 'velg-analytt':
      return { ...state, analyte: action.analyte, bandKey: null }

    case 'velg-band':
      return { ...state, bandKey: action.key }

    case 'tilbake':
      return stepBack(state)

    case 'nullstill':
      return initialState
  }
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
      return { ...state, analyte: null }
    case 'search':
      return initialState
  }
}
