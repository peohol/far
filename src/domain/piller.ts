import { formatNumber } from './bands'
import type { Analyte } from '../types'

/**
 * Referansetallene som står over båndknappene i steg 2.
 *
 * Psykofarmaka og antihypertensiver deler resten av veien gjennom appen, men
 * ikke disse tallene: psykofarmaka har referanseområde og ringegrense, mens
 * antihypertensiver har påvisningsgrense, terapiområde og grensen for toksisk
 * konsentrasjon — og ingen ringegrense i det hele tatt.
 *
 * Hvilken av de to en analytt er, leses av datasettet og ikke av gruppenavnet.
 */

/** Hva pillen bærer. Avgjør ledetekst, farge og rekkefølge. */
export type Pilleslag =
  | 'referanseomrade'
  | 'ringegrense'
  | 'pavisningsgrense'
  | 'terapiomrade'
  | 'toksisk'

export interface Grensepille {
  slag: Pilleslag
  /** Ledeteksten foran verdien, f.eks. «Terapiområde». */
  merke: string
  /** Verdien slik den vises, f.eks. «10 – 300 nmol/L». */
  verdi: string
}

const MERKE: Record<Pilleslag, string> = {
  referanseomrade: 'Referanseområde',
  ringegrense: 'Ringegrense',
  pavisningsgrense: 'Påvisningsgrense',
  terapiomrade: 'Terapiområde',
  toksisk: 'Toksisk',
}

/** Norsk tallform med de desimalene tallet faktisk har. */
function tall(verdi: number): string {
  return formatNumber(verdi, (String(verdi).split('.')[1] ?? '').length)
}

function pille(slag: Pilleslag, verdi: string): Grensepille {
  return { slag, merke: MERKE[slag], verdi }
}

/**
 * Pillene analyttkortet viser, i den rekkefølgen de skal stå.
 *
 * Enheten står bare på den første — den gjelder alle, og gjentatt på hver
 * pille ville den tatt oppmerksomhet fra tallene.
 */
export function grensepiller(analyte: Analyte): Grensepille[] {
  const grenser = analyte.antihypertensiv
  const piller = grenser
    ? [
        pille('pavisningsgrense', tall(grenser.pavisningsgrense)),
        ...(grenser.terapiomrade ? [pille('terapiomrade', grenser.terapiomrade.tekst)] : []),
        // Toksisk konsentrasjon er den samme grensen som båndet «over»
        // begynner på, så den har ingen egen verdi i datasettet.
        pille('toksisk', `≥ ${tall(analyte.ovreGrense)}`),
      ]
    : [
        ...(analyte.referanseomrade
          ? [pille('referanseomrade', analyte.referanseomrade.tekst)]
          : []),
        ...(analyte.ringegrense !== null ? [pille('ringegrense', tall(analyte.ringegrense))] : []),
      ]

  const forste = piller[0]
  if (forste && analyte.enhet) forste.verdi = `${forste.verdi} ${analyte.enhet}`
  return piller
}
