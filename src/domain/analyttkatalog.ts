import registerdata from '../data/stoffregister.json'
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
   * Koden et stoffnavn fører til: hovedkoden for siden med det navnet, eller
   * koden til en metabolitt som er slått sammen med moderstoffets side
   * («O-desmetyltramadol» fører til OTRAM, som viser tramadolsiden). Brukes
   * til å lenke komponentene i en sumanalyse videre og til å sende en
   * stoffadresse til siden for koden.
   */
  kodeForSide: (sidenavn: string) => string | undefined
  /**
   * Oppføringene som deler informasjonssiden, med hovedkoden først: den som
   * har samme navn som siden. Én for de fleste sider; flere når en metabolitt
   * er slått sammen med moderstoffets side ({@link SAMMENSLATTE}).
   */
  paSiden: (sidenavn: string) => Katalogoppforing[]
}

/**
 * Metabolittene som står på moderstoffets informasjonsside i stedet for å ha
 * sin egen, fordi de ikke er legemidler selv: metabolittens navn → moderstoffets
 * side. Kodene beholder hver sin adresse og sine fortolkningsregler, men viser
 * den samme siden. Står i `src/data/stoffregister.json`.
 */
export const SAMMENSLATTE: Readonly<Record<string, string>> = registerdata.sammenslatte

function nokkel(navn: string): string {
  return navn.trim().toLocaleLowerCase('nb')
}

const SAMMENSLATT_PER_NOKKEL = new Map(Object.entries(SAMMENSLATTE).map(([metabolitt, side]) => [nokkel(metabolitt), side]))

/** Siden et stoff står på: moderstoffets når stoffet er slått sammen med det. */
export function sideFor(navn: string, sammenslatte: ReadonlyMap<string, string> = SAMMENSLATT_PER_NOKKEL): string {
  return sammenslatte.get(nokkel(navn)) ?? navn
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
      sidenavn: sideFor(hele ? splitName(analyte).moderstoff : navn),
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

  // Oppføringene per side, med hovedkoden — den som har sidens navn — først.
  const perSide = new Map<string, Katalogoppforing[]>()
  for (const o of oppforinger) {
    const liste = perSide.get(nokkel(o.sidenavn)) ?? []
    if (nokkel(o.navn) === nokkel(o.sidenavn)) liste.unshift(o)
    else liste.push(o)
    perSide.set(nokkel(o.sidenavn), liste)
  }
  const perNavn = new Map(oppforinger.map((o) => [nokkel(o.navn), o]))

  return {
    oppforinger,
    finn: (kode) => perKode.get(kode.trim().toUpperCase()),
    kodeForSide: (sidenavn) => {
      const [forste, ...andre] = perSide.get(nokkel(sidenavn)) ?? []
      if (forste) return andre.length === 0 || nokkel(forste.navn) === nokkel(sidenavn) ? forste.kode : undefined
      // En metabolitt uten egen side fører til sin egen kode på moderstoffets side.
      return SAMMENSLATT_PER_NOKKEL.has(nokkel(sidenavn)) ? perNavn.get(nokkel(sidenavn))?.kode : undefined
    },
    paSiden: (sidenavn) => perSide.get(nokkel(sidenavn)) ?? [],
  }
}
