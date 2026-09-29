import { formatNumber } from './bands'
import { intervallene } from './intervallregler'
import type { Intervallregelsett } from '../regler/modell'
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

/**
 * Referanseområdet slik stoffsiden har det: kortet «Referanseområde» i
 * «Viktige data». Fortolkningen får det fra samme sted, så steg 2 og siden
 * alltid viser det samme. `null` er en grense som ikke er oppgitt.
 */
export interface Referanseomrade {
  nedre: number | null
  ovre: number | null
  enhet: string
}

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

/**
 * Referanseområdet slik pillen viser det: «10 – 300», eller «fra 10» og
 * «opptil 300» når bare den ene grensen er oppgitt — som på stoffsiden,
 * uten å si om grensen er med.
 */
function omrade({ nedre, ovre }: Referanseomrade): string {
  if (nedre !== null && ovre !== null) return nedre === ovre ? tall(nedre) : `${tall(nedre)} – ${tall(ovre)}`
  return nedre !== null ? `fra ${tall(nedre)}` : `opptil ${tall(ovre!)}`
}

/** En pille med enheten verdien er oppgitt i, før enheten er satt på. */
interface Pilleutkast extends Grensepille {
  enhet: string
}

function pille(slag: Pilleslag, verdi: string, enhet: string): Pilleutkast {
  return { slag, merke: MERKE[slag], verdi, enhet }
}

/**
 * Pillene regelsettet gir: ringegrensen, eller for antihypertensiver grensen
 * for toksisk konsentrasjon — der det første intervallet på nivået «over»
 * begynner, det samme tallet som på knappen for det øverste båndet.
 */
function regelpiller(regelsett: Intervallregelsett, antihypertensiv: boolean): Pilleutkast[] {
  const f = (verdi: number) => formatNumber(verdi, regelsett.desimaler)
  if (antihypertensiv) {
    const toksisk = intervallene(regelsett).find((t) => t.niva === 'over')?.fra ?? null
    return toksisk === null ? [] : [pille('toksisk', `≥ ${f(toksisk)}`, regelsett.enhet)]
  }
  return regelsett.ringegrense === null
    ? []
    : [pille('ringegrense', f(regelsett.ringegrense), regelsett.enhet)]
}

/**
 * Pillene analyttkortet viser, i den rekkefølgen de skal stå.
 *
 * Referanseområdet er det stoffsiden har; påvisningsgrensen og
 * terapiområdet står i datasettet; ringegrensen og den toksiske grensen hører
 * til fortolkningsreglene og leses av regelsettet. Mens referanseområdet og
 * regelsettet hentes, står bare det som er i datasettet.
 *
 * Enheten står bare på den første pillen — den gjelder alle, og gjentatt på
 * hver pille ville den tatt oppmerksomhet fra tallene. Bare en pille med en
 * annen enhet enn pillen foran får sin egen.
 */
export function grensepiller(
  analyte: Analyte,
  regelsett: Intervallregelsett | null,
  referanseomrade: Referanseomrade | null,
): Grensepille[] {
  const grenser = analyte.antihypertensiv
  const piller: Pilleutkast[] = [
    ...(grenser
      ? [
          pille('pavisningsgrense', tall(grenser.pavisningsgrense), analyte.enhet),
          ...(grenser.terapiomrade
            ? [pille('terapiomrade', grenser.terapiomrade.tekst, analyte.enhet)]
            : []),
        ]
      : referanseomrade && (referanseomrade.nedre !== null || referanseomrade.ovre !== null)
        ? [pille('referanseomrade', omrade(referanseomrade), referanseomrade.enhet || analyte.enhet)]
        : []),
    ...(regelsett ? regelpiller(regelsett, grenser !== undefined) : []),
  ]

  return piller.map(({ enhet, ...pille }, i) => {
    const skifter = i === 0 || enhet !== piller[i - 1]?.enhet
    return skifter && enhet ? { ...pille, verdi: `${pille.verdi} ${enhet}` } : pille
  })
}
