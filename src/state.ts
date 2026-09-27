import { erEtgAnalytt, type EtgValg } from './domain/etg'
import { erRusAnalytt } from './domain/rus'
import { erThcAnalytt } from './domain/thc'
import type { Analyte } from './types'

/**
 * Arbeidsflyten er en liten tilstandsmaskin.
 *
 * Psykofarmaka går gjennom tre steg — søk, bånd, lim inn. EtG og EtS går
 * samme vei: søk, hva som er påvist, lim inn. THC-syre og stoffene med
 * ruspotensial i serum går fra søket til hver sin fortolkningsmodul og blir
 * der til man bytter analytt, fordi svaret der bygges opp av flere spørsmål.
 *
 * Et valg som krever en bekreftelse før kommentaren kopieres, skyter inn et
 * kontrollsteg mellom de to siste. Se {@link Kontroll}.
 *
 * Hvilket steg som vises utledes av tilstanden, så det finnes ingen egen
 * «steg»-variabel som kan komme i utakt med resten.
 */
export type Stage =
  | 'search'
  | 'band'
  | 'kontroll'
  | 'paste'
  | 'thc'
  | 'rus'
  | 'etg'
  | 'etg-paste'

/**
 * Kontrollspørsmålet som står og venter på svar.
 *
 * «Til stede under cut-off» er det ene valget som ikke kan tas på ordet: et
 * signal under påvisningsgrensen kan like gjerne være støy, og laboratoriet må
 * ha bekreftet funnet før kommentaren gjelder. Svares det ja, kopieres
 * kommentaren og flyten går videre som ellers; svares det nei, er man tilbake
 * i valget.
 */
export type Kontroll = 'cutoff'

export interface State {
  /** Teksten i søkefeltet. Beholdes når man går tilbake fra steg 2. */
  query: string
  analyte: Analyte | null
  /** Nøkkelen til valget brukeren tok i steg 2, når kommentaren er kopiert. */
  bandKey: string | null
  /** Kontrollspørsmålet som venter på svar. `null` når ingen står. */
  kontroll: Kontroll | null
  /** Tilfellet brukeren valgte i EtG- og EtS-modulen, når kommentaren er kopiert. */
  etgValg: EtgValg | null
  /** Om et enslig alternativ får velge seg selv. Se {@link narrow}. */
  autoPick: boolean
  /**
   * Analysemetoden søket er begrenset til, valgt i filteret på hovedsiden
   * (`Filterbytte`). `null` er filteret slått av.
   *
   * Den lever utenom arbeidsflyten: et valg her skal stå til brukeren selv
   * endrer det, og overlever både Esc og at en kommentar er ferdig limt inn.
   */
  metodefilter: string | null
}

export const initialState: State = {
  query: '',
  analyte: null,
  bandKey: null,
  kontroll: null,
  etgValg: null,
  autoPick: true,
  metodefilter: null,
}

export type Action =
  /** `matches` er analyttene det nye søket gir — se {@link narrow}. */
  | { type: 'sett-sok'; value: string; matches: Analyte[] }
  | { type: 'velg-analytt'; analyte: Analyte }
  | { type: 'velg-band'; key: string }
  /** Stiller kontrollspørsmålet, i stedet for å kopiere med én gang. */
  | { type: 'spor'; kontroll: Kontroll }
  | { type: 'velg-etg'; valg: EtgValg }
  | { type: 'sett-metodefilter'; metode: string | null }
  | { type: 'tilbake' }
  | { type: 'nullstill' }

export function stageOf(state: State): Stage {
  if (!state.analyte) return 'search'
  if (erThcAnalytt(state.analyte)) return 'thc'
  if (erRusAnalytt(state.analyte)) return 'rus'
  if (erEtgAnalytt(state.analyte)) return state.etgValg ? 'etg-paste' : 'etg'
  if (state.kontroll) return 'kontroll'
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
      // Kommentaren er kopiert, og et kontrollspørsmål er dermed besvart.
      return { ...state, bandKey: action.key, kontroll: null }

    case 'spor':
      return { ...state, kontroll: action.kontroll }

    case 'velg-etg':
      return { ...state, etgValg: action.valg }

    case 'sett-metodefilter':
      return { ...state, metodefilter: action.metode }

    case 'tilbake':
      return stepBack(state)

    case 'nullstill':
      return nullstilt(state)
  }
}

function pick(state: State, analyte: Analyte): State {
  return { ...state, analyte, bandKey: null, kontroll: null, etgValg: null }
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
    case 'kontroll':
      // Ubesvart, eller besvart med nei: tilbake til valget.
      return { ...state, kontroll: null }
    case 'etg-paste':
      return { ...state, etgValg: null }
    case 'band':
    case 'thc':
    case 'rus':
    case 'etg':
      return { ...state, analyte: null }
    case 'search':
      return nullstilt(state)
  }
}

/**
 * Tilbake til utgangspunktet — men med filteret i behold. Det er et valg
 * brukeren har tatt i menyen, ikke et steg i arbeidsflyten, og skal ikke bli
 * borte av at søket nullstilles.
 */
function nullstilt(state: State): State {
  return { ...initialState, metodefilter: state.metodefilter }
}
