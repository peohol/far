import { menyanalytter } from './analysemetoder'
import { analytes } from './analytes'
import { ETG_ANALYTT } from './etg'
import { RUS_ANALYTTER } from './rus'
import { THC_ANALYTT } from './thc'
import type { Analyte } from '../types'

/**
 * Alle oppføringene appen kan fortolke: analyttene fra datasettet pluss
 * kategoriene som har egne fortolkningsmoduler i stedet for
 * konsentrasjonsbånd — THC-syre i urin, stoffene med ruspotensial i serum og
 * etanolmarkørene EtG og EtS i urin. Søket i fortolkningen og katalogen under
 * bygges av denne lista.
 */
export const FORTOLKNINGSOPPFORINGER: Analyte[] = [...analytes, THC_ANALYTT, ...RUS_ANALYTTER, ETG_ANALYTT]

/**
 * En laboratorieanalytt i fortolkningssystemet: koden laboratoriet
 * rapporterer, og det fortolkningen trenger å vite om den fra de statiske
 * datasettene.
 *
 * Analytten er ikke en fagside. Hvilke stoffer i stoffregisteret den gjelder,
 * står i de eksplisitte koblingene der (`src/domain/stoffregister.ts`), og
 * veien mellom de to domenene i `src/domain/koblinger.ts`.
 */
export interface Laboratorieanalytt {
  /** Analyttkoden, f.eks. «AMTNORSUM». */
  kode: string
  /** Navnet i fortolkningen, f.eks. «Amitriptylin + nortriptylin». */
  navn: string
  analysemetode: string
  /** Kategorien i datasettet, f.eks. «ARB». Tom når metoden ikke er delt opp. */
  kategori: string
  /**
   * Stoffene analysen måler, slik datasettet navngir dem. Én for de fleste,
   * flere for sumanalysene.
   */
  komponenter: string[]
  /** Oppføringen som åpner fortolkningen — den samme som søket gir. */
  fortolkning: Analyte
}

export interface Analyttkatalog {
  /** Alle analyttene, i datasettets rekkefølge. */
  oppforinger: Laboratorieanalytt[]
  finn: (kode: string) => Laboratorieanalytt | undefined
}

function oppforingerFor(analyte: Analyte): Laboratorieanalytt[] {
  // Modulene som dekker flere koder (DIAZ · DMI · OXA), deles opp i én
  // analytt per kode, med stoffets eget navn.
  return menyanalytter(analyte).map(({ kode, navn }) => {
    const hele = kode === analyte.kode
    return {
      kode,
      navn,
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
  return { oppforinger, finn: (kode) => perKode.get(kode.trim().toUpperCase()) }
}

/** Alle analyttene appen kan fortolke. */
export const ANALYTTKATALOG = byggKatalog(FORTOLKNINGSOPPFORINGER)
