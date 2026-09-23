/**
 * Tallene og datoene i THC-syremodulen: slik de tastes, regnes om og skrives.
 */

/** Hele døgn fra `fra` til `til` (ISO-datoer). Negativt når `til` er først. */
export function dagerMellom(fra: string, til: string): number {
  return Math.round((Date.parse(til) - Date.parse(fra)) / 86_400_000)
}

/** «2026-07-04» → «04.07.2026», slik datoen står i kommentaren. */
export function formaterDatoNorsk(iso: string): string {
  const [aar = '', maaned = '', dag = ''] = iso.split('-')
  return `${dag}.${maaned}.${aar}`
}

/**
 * Leser et tall slik det tastes i norske felt: både komma og punktum godtas
 * som desimaltegn. `null` når teksten ikke er et rent tall.
 */
export function lesTall(tekst: string): number | null {
  const trimmet = tekst.trim().replace(',', '.')
  if (trimmet === '' || !/^-?\d+(\.\d+)?$/.test(trimmet)) return null
  return Number(trimmet)
}

/** Et forholdstall med to gjeldende siffer og norsk desimaltegn: «0,26». */
export function formaterTall(verdi: number): string {
  return Number(verdi.toPrecision(2)).toString().replace('.', ',')
}

/**
 * En IRCAK-verdi slik den skrives i appen: inntil tre desimaler og norsk
 * desimaltegn. Tre desimaler holder for tallene labsystemet svarer i, og
 * trengs når IRCAK er regnet ut av UCAK og NKRE i stedet for tastet inn — da
 * er verdien sjelden et rundt tall. Blir tallet så lite at avrundingen ville
 * skrevet det som 0, vises gjeldende siffer i stedet: en verdi over 0 skal
 * aldri kunne leses som 0.
 */
export function formaterIrcak(verdi: number): string {
  const avrundet = Number(verdi.toFixed(3))
  const vist = avrundet === 0 && verdi !== 0 ? Number(verdi.toPrecision(2)) : avrundet
  return String(vist).replace('.', ',')
}

/**
 * IRCAK regnet ut av labsystemets interne tall, slik det gjøres når THC-syre
 * lå under påvisningsgrensen og labsystemet derfor ikke kreatininkorrigerte
 * den selv: `UCAK / NKRE`. `null` når feltene ikke gir et regnestykke som lar
 * seg utføre — tomme felt, tekst som ikke er tall, negativ THC-syre eller et
 * kreatinin som ikke er over 0.
 */
export function beregnIrcak(ucak: string, nkre: string): number | null {
  const thcSyre = lesTall(ucak)
  const kreatinin = lesTall(nkre)
  if (thcSyre === null || thcSyre < 0) return null
  if (kreatinin === null || !(kreatinin > 0)) return null
  return thcSyre / kreatinin
}

/** «nedgang», «økning» eller «ingen endring» — for en relativ endring. */
export function ordEndring(endring: number): 'nedgang' | 'økning' | 'ingen endring' {
  if (endring < 0) return 'nedgang'
  if (endring > 0) return 'økning'
  return 'ingen endring'
}
