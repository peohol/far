import { bands, type BandTone } from './bands'
import { levelComment } from './concentration'
import { splitName } from './names'
import type { Analyte } from '../types'

/**
 * Valgene steg 2 tilbyr, og det ene av dem som ikke er et konsentrasjonsbånd.
 *
 * De fleste analyttene kommenteres bare ut fra hvor konsentrasjonen ligger, og
 * da er båndene i `domain/bands.ts` hele utvalget. Antidepressiver og
 * antipsykotika har i tillegg et tilfelle som ikke er en konsentrasjon: stoffet
 * er til stede, men så lavt at det ikke lar seg tallfeste. Det får sin egen
 * knapp her.
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

/**
 * Kategoriene valget gjelder. Ingenting her lister opp analytter: knappen
 * følger kategorien analytten har i datasettet, så en ny antidepressiv eller
 * antipsykotisk analytt får den av seg selv.
 */
export const CUTOFF_KATEGORIER: string[] = ['Antidepressiver', 'Antipsykotika']

/** Setningen som settes foran kommentaren fra det grønne båndet. */
function cutoffInnledning(analyte: Analyte): string {
  return `Prøven inneholder en lav konsentrasjon av ${cutoffNavn(analyte)} som ligger under påvisningsgrensen. `
}

export function harCutoffvalg(analyte: Analyte): boolean {
  return CUTOFF_KATEGORIER.includes(analyte.kategori)
}

/**
 * Stoffnavnet slik det står midt i en setning.
 *
 * Kilden skriver virkestoffnavn med liten forbokstav når de ikke innleder
 * setningen — «summen av amitriptylin og nortriptylin» — men beholder de store
 * bokstavene som hører til selve navnet, som O-en i «O-desmetylvenlafaksin».
 * Forbokstaven settes derfor bare ned når den står foran en liten bokstav; da
 * er den stor bare fordi navnet begynner der.
 */
function iSetning(navn: string): string {
  const [forste, andre] = navn
  if (forste === undefined || andre === undefined) return navn
  return /\p{Ll}/u.test(andre) ? forste.toLowerCase() + navn.slice(1) : navn
}

/**
 * Stoffene kommentaren gjelder, bundet sammen slik den skal lese dem:
 * «amitriptylin og/eller nortriptylin», «kariprazin, desmetylkariprazin
 * og/eller didesmetylkariprazin».
 *
 * En sumanalyse måler flere stoffer under ett, og et funn under
 * påvisningsgrensen kan komme fra hvilket som helst av dem — eller fra flere.
 * Derfor «og/eller» og ikke «og».
 *
 * Delingen går på `navn` og ikke på `komponenter`, fordi `navn` har
 * skrivemåten stoffene skal vises med. Se {@link splitName}.
 */
export function cutoffNavn(analyte: Analyte): string {
  const { moderstoff, metabolitter } = splitName(analyte)
  const deler = [moderstoff, ...metabolitter].map(iSetning)
  const siste = deler[deler.length - 1]
  if (deler.length < 2 || siste === undefined) return deler.join('')
  return `${deler.slice(0, -1).join(', ')} og/eller ${siste}`
}

/**
 * Kommentaren valget kopierer: den samme som det grønne båndet gir, med
 * funnet under påvisningsgrensen satt foran.
 *
 * Resten av kommentaren skal være ord for ord den samme som innenfor
 * referanseområdet — det er den samme fortolkningen av et stoff som er til
 * stede — så teksten hentes fra nivået og skrives ikke av.
 */
export function cutoffKommentar(analyte: Analyte): string {
  return cutoffInnledning(analyte) + levelComment(analyte, 'innenfor').kommentar
}

/** Knappen «Til stede under cut-off», eller `null` for analytter uten den. */
export function cutoffvalg(analyte: Analyte): Kommentarvalg | null {
  if (!harCutoffvalg(analyte)) return null
  return {
    key: CUTOFF_NOKKEL,
    tone: 'cutoff',
    ring: false,
    label: CUTOFF_MERKE,
    kommentar: cutoffKommentar(analyte),
  }
}

/* --- Utvalget under ett -------------------------------------------------- */

/**
 * Alle valgene analytten gir, i den rekkefølgen tastene 1, 2 … velger dem.
 * Cut-off-valget står sist, under båndene, og får derfor tasten etter det siste
 * båndet — 4 for de fleste analyttene, 5 for dem som har fire bånd.
 */
export function valgene(analyte: Analyte): Kommentarvalg[] {
  const cutoff = cutoffvalg(analyte)
  const alle: Kommentarvalg[] = [...bands(analyte)]
  if (cutoff) alle.push(cutoff)
  return alle
}

/** Valget med denne nøkkelen. */
export function finnValg(analyte: Analyte, key: string): Kommentarvalg | undefined {
  return valgene(analyte).find((v) => v.key === key)
}
