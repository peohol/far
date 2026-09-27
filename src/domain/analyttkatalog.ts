import { menyanalytter } from './analysemetoder'
import { analytes } from './analytes'
import { ETG_ANALYTT } from './etg'
import { splitName } from './names'
import { RUS_ANALYTTER } from './rus'
import { THC_ANALYTT } from './thc'
import type { Analyte } from '../types'

/**
 * Alle oppføringene appen kan fortolke: analyttene fra datasettet pluss
 * kategoriene som har egne fortolkningsmoduler i stedet for
 * konsentrasjonsbånd — THC-syre i urin, stoffene med ruspotensial i serum og
 * etanolmarkørene EtG og EtS i urin. Søket, stoffregisteret i sidemenyen og
 * katalogen under bygges alle av denne lista.
 */
export const FORTOLKNINGSOPPFORINGER: Analyte[] = [...analytes, THC_ANALYTT, ...RUS_ANALYTTER, ETG_ANALYTT]

/**
 * Analyttkodene appen kjenner, med det informasjonssidene trenger å vite om
 * dem fra de statiske datasettene.
 *
 * Katalogen bygges av de samme søkeoppføringene som søket, og sidemenyen
 * (stoffregisteret) bygges av katalogen, så en kode har en informasjonsside
 * nøyaktig når den står i menyen. Hver kode
 * peker også på fortolkningsmodulen den hører til — oppføringen søket ville
 * valgt — slik at informasjonssiden kan åpne fortolkningen igjen.
 *
 * Tre begreper holdes fra hverandre, som i `docs/analyttsider-og-redigering.md`:
 * koden er laboratorieanalytten, `sidenavn` er informasjonssiden den hører til
 * (virkestoffet), og `fortolkning` er modulen som kommenterer den. For
 * sumanalysene er siden moderstoffet: `AMTNORSUM` hører til Amitriptylin og
 * omfatter amitriptylin og nortriptylin.
 */
export interface Katalogoppforing {
  /** Analyttkoden, f.eks. «AMTNORSUM». */
  kode: string
  /** Navnet i menyen, f.eks. «Amitriptylin + nortriptylin». */
  navn: string
  /** Informasjonssiden koden hører til, f.eks. «Amitriptylin». */
  sidenavn: string
  analysemetode: string
  /** Kategorien i datasettet, f.eks. «ARB». Tom når metoden ikke er delt opp. */
  kategori: string
  /**
   * Stoffene analysen omfatter, slik datasettet navngir dem. Én for de fleste,
   * flere for sumanalysene.
   */
  komponenter: string[]
  /** Oppføringen som åpner fortolkningen — den samme som søket gir. */
  fortolkning: Analyte
}

export interface Analyttkatalog {
  /** Alle oppføringene, i den rekkefølgen menyen bygges i. */
  oppforinger: Katalogoppforing[]
  finn: (kode: string) => Katalogoppforing | undefined
  /**
   * Koden som har siden med dette navnet som sin, når det finnes nøyaktig
   * én. Brukes til å lenke komponentene i en sumanalyse videre.
   */
  kodeForSide: (sidenavn: string) => string | undefined
}

function nokkel(navn: string): string {
  return navn.trim().toLocaleLowerCase('nb')
}

function oppforingerFor(analyte: Analyte): Katalogoppforing[] {
  return menyanalytter(analyte).map(({ kode, navn }) => {
    // Står koden for hele oppføringen, er navnet moderstoffet pluss eventuelle
    // metabolitter, og siden er moderstoffets. Modulene som dekker flere koder,
    // deles opp i én oppføring per kode, med virkestoffets eget navn.
    const hele = kode === analyte.kode
    return {
      kode,
      navn,
      sidenavn: hele ? splitName(analyte).moderstoff : navn,
      analysemetode: analyte.analysemetode,
      kategori: analyte.kategori,
      komponenter: hele && analyte.komponenter.length > 0 ? [...analyte.komponenter] : [navn],
      fortolkning: analyte,
    }
  })
}

export function byggKatalog(pool: Analyte[]): Analyttkatalog {
  const oppforinger = pool.flatMap(oppforingerFor)
  const perKode = new Map(oppforinger.map((o) => [o.kode, o]))

  const perSide = new Map<string, string[]>()
  for (const o of oppforinger) {
    const koder = perSide.get(nokkel(o.sidenavn)) ?? []
    koder.push(o.kode)
    perSide.set(nokkel(o.sidenavn), koder)
  }

  return {
    oppforinger,
    finn: (kode) => perKode.get(kode.trim().toUpperCase()),
    kodeForSide: (sidenavn) => {
      const koder = perSide.get(nokkel(sidenavn))
      return koder?.length === 1 ? koder[0] : undefined
    },
  }
}
