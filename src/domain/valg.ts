import type { BandTone } from './bands'
import { cutoffkommentar, regelsettband } from './intervallregler'
import type { Intervallregelsett } from '../regler/modell'

/**
 * Valgene steg 2 tilbyr, laget av regelsettet for analytten.
 *
 * De fleste analyttene kommenteres bare ut fra hvor konsentrasjonen ligger, og
 * da er båndene regelsettet gir, hele utvalget. Regelsett med «Til stede under
 * cut-off» har i tillegg et tilfelle som ikke er en konsentrasjon: stoffet er
 * til stede, men så lavt at det ikke lar seg tallfeste. Det får sin egen knapp
 * her.
 */

/* --- Formen en knapp i steg 2 har ---------------------------------------- */

/**
 * Det en knapp i steg 2 bærer: kommentaren som kopieres, og formen knappen
 * vises i. {@link Band} er den ene varianten — et konsentrasjonsbånd, med
 * tallene sine i tillegg — og cut-off-valget den andre.
 *
 * Steg 3 og kopikvitteringen trenger bare dette, og tar derfor imot begge.
 */
export interface Kommentarvalg {
  /** Stabil id, brukes som nøkkel i tilstanden. */
  key: string
  tone: BandTone
  /** Sant når rekvirenten skal ringes. */
  ring: boolean
  /** Teksten på knappen. */
  label: string
  kommentar: string
}

/* --- «Til stede under cut-off» ------------------------------------------- */

/** Nøkkelen valget kjennes på i tilstanden. */
export const CUTOFF_NOKKEL = 'under-cutoff'

/** Teksten på knappen. */
export const CUTOFF_MERKE = 'Til stede under cut-off'

/**
 * Kontrollspørsmålet som må besvares før kommentaren kopieres. Et signal
 * under påvisningsgrensen kan like gjerne være støy som et virkelig funn, og
 * det er laboratoriet som avgjør hvilken av delene det er.
 */
export const CUTOFF_SPORSMAL =
  'Har laboratoriet bekreftet funnet – altså at det ikke bare skyldes støy?'

/** Knappen for cut-off-kommentaren. */
function lagCutoffvalg(kommentar: string): Kommentarvalg {
  return { key: CUTOFF_NOKKEL, tone: 'cutoff', ring: false, label: CUTOFF_MERKE, kommentar }
}

/** Knappen «Til stede under cut-off», eller `null` når regelsettet ikke har den. */
export function cutoffvalg(regelsett: Intervallregelsett): Kommentarvalg | null {
  const kommentar = cutoffkommentar(regelsett)
  return kommentar === null ? null : lagCutoffvalg(kommentar)
}

/* --- Utvalget under ett -------------------------------------------------- */

/**
 * Alle valgene regelsettet gir, i den rekkefølgen tastene 1, 2 … velger dem:
 * ett bånd per intervall, nedenfra og opp, og «Til stede under cut-off» sist
 * når regelsettet har den. Cut-off-valget får derfor tasten etter det siste
 * båndet — 4 for de fleste analyttene, 5 for dem som har fire bånd.
 */
export function regelsettvalg(regelsett: Intervallregelsett): Kommentarvalg[] {
  const cutoff = cutoffvalg(regelsett)
  const alle: Kommentarvalg[] = [...regelsettband(regelsett)]
  if (cutoff) alle.push(cutoff)
  return alle
}
