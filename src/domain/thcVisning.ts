import { sammenlignMedForrige, type ThcForventet, type ThcKonklusjon } from './thcMotor'
import { INGEN_SIKKERHETSMARGIN, KURVEFARGE, type ThcKonsentrasjonsniva, type ThcRegelsett } from './thcRegelsett'
import { kommentardeler, settSammen, THC_TEKSTBOLKER, type ThcKommentarnokkel, type ThcTekster } from './thcTekster'
import { formaterIrcak, ordEndring } from './thcTall'

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

/**
 * Valget for marginen i skjemaet: som {@link marginmerke}, men «Ingen» får med
 * hvor sikker den er, «Ingen (50 %)». Parentesen holdes samlet om merket må
 * brytes.
 */
export function marginvalg(margin: number): string {
  return margin === INGEN_SIKKERHETSMARGIN
    ? `${marginmerke(margin)} (${somProsent(margin)}\u00a0%)`
    : marginmerke(margin)
}

/** «en nedgang på 74 %», «en økning på 5 %» eller «ingen endring». */
export function endringsfrase(endring: number): string {
  const ord = ordEndring(endring)
  if (ord === 'ingen endring') return 'ingen endring'
  return `en ${ord} på ${Math.round(Math.abs(endring) * 100)} %`
}

/**
 * Hvor ofte endringen som fortolkes, er større enn den sanne med marginen:
 * «i annethvert tilfelle» uten margin, «i 1 av 10 tilfeller» med 90 %.
 */
export function hvorOfteForStor(margin: number): string {
  const n = Math.round(1 / (1 - margin))
  return n === 2 ? 'i annethvert tilfelle' : `i 1 av ${n} tilfeller`
}

/**
 * De to prøvene i eksempelet på hva sikkerhetsmarginen gjør. Tallene er
 * oppdiktede og valgt fordi hver margin i de publiserte reglene gir en egen
 * konklusjon for dem; konklusjonene regnes likevel av reglene som gjelder.
 */
export const MARGINEKSEMPEL = { forrige: 50, aktuell: 40, dager: 3, kronisk: true } as const

/** Eksempelet fortolket med hver margin i regelsettet: endringen som fortolkes, og konklusjonen. */
export function margineksempel(r: ThcRegelsett): { margin: number; endring: number; utfall: ThcKonklusjon }[] {
  return r.sikkerhetsmarginer.map(({ margin }) => {
    const { korrigert, utfall } = sammenlignMedForrige(r, { ...MARGINEKSEMPEL, margin, usikkerhet: 1 })
    return { margin, endring: korrigert, utfall }
  })
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
 * «Over den gule kurven: kan ikke fastslås. Over den røde: nytt inntak.»
 */
export function bruksmonsterbeskrivelse(r: ThcRegelsett, kronisk: boolean): string {
  const monster = kronisk ? r.bruksmonstre.kronisk : r.bruksmonstre.ikke_kronisk
  return (
    `Over den ${KURVEFARGE[monster.vanskelig_over]} kurven: kan ikke fastslås. ` +
    `Over den ${KURVEFARGE[monster.nytt_inntak_over]}: nytt inntak.`
  )
}

/* --- Kommentarene ----------------------------------------------------------- */

/** Nivåene en kommentar gjelder for: alle, eller de som tyder (ikke) på nylig inntak. */
export function nivaerForKommentar(r: ThcRegelsett, nokkel: ThcKommentarnokkel): ThcKonsentrasjonsniva[] {
  const { nivaer } = THC_TEKSTBOLKER[nokkel]
  return r.konsentrasjonsnivaer.filter((n) => nivaer === 'alle' || (nivaer === 'nylig') === n.nylig_inntak)
}

/** «Lav og middels høy», «Lav, middels høy og høy», eller «Ingen nivåer nå». */
export function nivaliste(navn: readonly string[]): string {
  if (navn.length === 0) return 'Ingen nivåer nå'
  const tekst = navn.length === 1 ? navn[0]! : `${navn.slice(0, -1).join(', ')} og ${navn.at(-1)}`
  return tekst.charAt(0).toUpperCase() + tekst.slice(1)
}

/** Datoene eksemplene på kommentarene viser. Oppdiktede. */
export const EKSEMPELDATOER = { forrigeDato: '04.07.2026', tidligereDato: '01.06.2026' } as const

/**
 * Kommentaren slik den blir, med det første nivået den gjelder for og
 * eksempeldatoene. Brukes også for et utkast som ikke er gyldig ennå, så
 * redigeringen kan vise hva som skrives.
 */
export function eksempelkommentar(r: ThcRegelsett, tekster: ThcTekster, nokkel: ThcKommentarnokkel): string {
  const niva = nivaerForKommentar(r, nokkel)[0] ?? r.konsentrasjonsnivaer[0]
  return settSammen(tekster, kommentardeler(r.med_sporsmalsetning ?? [], nokkel), {
    niva: niva?.navn ?? '{nivå}',
    ...EKSEMPELDATOER,
  })
}
