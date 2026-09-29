/**
 * Referanseområdekortene slik databasen gir dem etter at fagsidene fikk
 * stoffets nøkkel (`les_stoffreferanseomrader`): ett kort per stoffside, med
 * koden kortet gjelder når det ikke er stoffets hovedanalytt. Appen knytter
 * dem til analyttkodene gjennom koblingene i stoffregisteret
 * (`referanseomraderPerAnalytt`).
 *
 * For testene som erstatter databasen og har referanseområdene etter
 * analyttkoden (`REFERANSEOMRADER`).
 */
import type { Referanseomrade } from '../../domain/piller'
import type { Stoffreferanseomrade } from '../../domain/koblinger'
import { STOFFREGISTER, type Stoffregister } from '../../domain/stoffregister'
import type { Intervallregelsett } from '../../regler/modell'
import { publiserteRader } from './dagensregler'
import { REFERANSEOMRADER } from './referanseomrader'

/**
 * Kortene referanseområdene etter kode gir: på siden til kodens primære stoff,
 * uten `gjelder` for stoffets hovedanalytt og med koden for de andre. Koder
 * uten primært stoff har ingen side å stå på, og gir ikke noe kort.
 */
export function stoffreferanseomrader(
  perKode: Readonly<Record<string, Referanseomrade>> = REFERANSEOMRADER,
  register: Stoffregister = STOFFREGISTER,
): Stoffreferanseomrade[] {
  return Object.entries(perKode).flatMap(([kode, verdi]) => {
    const stoff = register.primartStoffFor(kode)
    if (!stoff) return []
    const hovedanalytt = register.analytterFor(stoff.slug).find((k) => k.primar)?.kode
    return [{ stoff: stoff.slug, gjelder: hovedanalytt === kode ? null : kode, verdi: { ...verdi, forbehold: '' } }]
  })
}

/**
 * Det databasen gir for regelsettene som de publiserte (`publiserteRader`),
 * med referanseområdene som kort på stoffsidene i stedet for etter koden.
 * `referanseomrader` kan være kortene selv, når testen vil ha dem slik.
 */
export function publiserteStoffrader(
  regelsett: Intervallregelsett[],
  referanseomrader: Readonly<Record<string, Referanseomrade>> | readonly Stoffreferanseomrade[] = REFERANSEOMRADER,
) {
  const { les_intervallregelsett, les_kommentarer } = publiserteRader(regelsett)
  return {
    les_intervallregelsett,
    les_kommentarer,
    les_stoffreferanseomrader: Array.isArray(referanseomrader)
      ? [...referanseomrader]
      : stoffreferanseomrader(referanseomrader as Readonly<Record<string, Referanseomrade>>),
  }
}
