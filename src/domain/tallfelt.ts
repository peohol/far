/**
 * Renskrivingen som gjør et konsentrasjonsfelt numerisk.
 *
 * Feltene tar en målt konsentrasjon og ikke annet: bokstaver, mellomrom og
 * fortegn hører ikke hjemme i dem. Filteret sitter på selve feltet
 * (`src/components/Tallfelt.tsx`), så tegn som ikke er en del av et tall aldri
 * blir stående — en verdi som ser ut som et tall, er et tall.
 *
 * Både komma og punktum godtas som desimaltegn, slik tallene tastes i norske
 * felt, og slik `lesKonsentrasjon` og `lesTall` leser dem igjen.
 */

/** Et tall slik det kan se ut mens det skrives — «», «12», «12,» og «12,5». */
const UNDER_SKRIVING = /^\d*([.,]\d*)?$/

/**
 * Verdien slik den skal stå i feltet, eller `null` når tegnene ikke hører
 * hjemme i et konsentrasjonsfelt og innskrivingen skal avvises.
 *
 * Mellomrom fjernes i stedet for å avvises: da tar feltet imot en verdi som
 * limes inn med mellomrom rundt seg, og et mellomrom som slipper gjennom blir
 * ikke stående i tallet.
 */
export function renskTall(tekst: string): string | null {
  const uten = tekst.replace(/\s/g, '')
  return UNDER_SKRIVING.test(uten) ? uten : null
}
