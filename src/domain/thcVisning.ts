import type { ThcForventet } from './thcMotor'
import { INGEN_SIKKERHETSMARGIN, KURVEFARGE, type ThcRegelsett } from './thcRegelsett'
import { formaterIrcak } from './thcTall'

/**
 * Det fortolkningen og simulatoren viser om THC-syreregelsettet, avledet av
 * reglene, så visningen følger med når reglene redigeres.
 */

/** En andel som prosenttall med norsk desimaltegn: 0,9 → «90», 0,995 → «99,5». */
export function somProsent(andel: number): string {
  return String(Math.round(andel * 10000) / 100).replace('.', ',')
}

/** Merket på sikkerhetsmarginen: «Ingen» for margin uten korreksjon, ellers «90 %». */
export function marginmerke(margin: number): string {
  return margin === INGEN_SIKKERHETSMARGIN ? 'Ingen' : `${somProsent(margin)} %`
}

/** Hvert konsentrasjonsnivå med området det dekker: «under 20», «20–40», «40 eller mer». */
export function nivaomrader(r: ThcRegelsett): { navn: string; omrade: string }[] {
  const nivaer = r.konsentrasjonsnivaer
  return nivaer.map((niva, i) => {
    const neste = nivaer[i + 1]?.nedre ?? null
    const nedre = niva.nedre
    const omrade =
      nedre === null
        ? neste === null
          ? 'alle konsentrasjoner'
          : `under ${formaterIrcak(neste)}`
        : neste === null
          ? `${formaterIrcak(nedre)} eller mer`
          : `${formaterIrcak(nedre)}–${formaterIrcak(neste)}`
    return { navn: niva.navn, omrade }
  })
}

/**
 * Hvordan konsentrasjonen i prøven gir nivået i kommentarens åpning: «under 20
 * omtales som lav, 20–40 som middels høy, og 40 eller mer som høy».
 */
export function nivabeskrivelse(r: ThcRegelsett): string {
  const deler = nivaomrader(r).map(({ navn, omrade }, i) => `${omrade}${i === 0 ? ' omtales' : ''} som ${navn}`)
  if (deler.length === 1) return deler[0]!
  // Komma også foran «og», som i den opprinnelige teksten.
  return `${deler.slice(0, -1).join(', ')}, og ${deler.at(-1)}`
}

/**
 * Forventet nedgang i prosent ved de to grensene konklusjonen bruker for
 * bruksmønsteret: den som skiller «ikke nødvendigvis» fra «vanskelig», og den
 * som skiller «vanskelig» fra nytt inntak.
 */
export function forventetNedgang(
  r: ThcRegelsett,
  kronisk: boolean,
  forventet: ThcForventet,
): { hosFleste: number; ovreGrense: number } {
  const monster = kronisk ? r.bruksmonstre.kronisk : r.bruksmonstre.ikke_kronisk
  return {
    hosFleste: Math.round(-forventet[monster.vanskelig_over] * 100),
    ovreGrense: Math.round(-forventet[monster.nytt_inntak_over] * 100),
  }
}

/**
 * Kurvene konklusjonen mot forrige prøve avgjøres av for et bruksmønster:
 * «Over den gule kurven: vanskelig å avgjøre. Over den røde: nytt inntak.»
 */
export function bruksmonsterbeskrivelse(r: ThcRegelsett, kronisk: boolean): string {
  const monster = kronisk ? r.bruksmonstre.kronisk : r.bruksmonstre.ikke_kronisk
  return (
    `Over den ${KURVEFARGE[monster.vanskelig_over]} kurven: vanskelig å avgjøre. ` +
    `Over den ${KURVEFARGE[monster.nytt_inntak_over]}: nytt inntak.`
  )
}
