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
  /** Den kanoniske informasjonssiden koden hører til, f.eks. «Amitriptylin». */
  sidenavn: string
  /** Tittelen siden vises med. Er vanligvis sidenavnet, men kan samle flere analytter under et faglig navn. */
  sidetittel: string
  analysemetode: string
  /** Kategorien i datasettet, f.eks. «ARB». Tom når metoden ikke er delt opp. */
  kategori: string
  /**
   * Stoffene analysen omfatter, slik datasettet navngir dem. Én for de fleste,
   * flere for sumanalysene.
   */
  komponenter: string[]
  /** Kort forklaring på forholdet mellom analytten og stoffet siden handler om. */
  merknad?: string
  /** Oppføringen som åpner fortolkningen — den samme som søket gir. */
  fortolkning: Analyte
}

export interface Analyttkatalog {
  /** Alle oppføringene, i den rekkefølgen menyen bygges i. */
  oppforinger: Katalogoppforing[]
  finn: (kode: string) => Katalogoppforing | undefined
  /**
   * Den kanoniske koden et stoff- eller sidenavn fører til. Alle navn som
   * deler fagsside gir den samme koden og dermed den samme URL-en.
   */
  kodeForSide: (sidenavn: string) => string | undefined
  /**
   * Oppføringene som deler informasjonssiden, med den kanoniske koden først.
   * Én for de fleste sider; flere når flere analytter hører til samme fagsside.
   */
  paSiden: (sidenavn: string) => Katalogoppforing[]
}

/**
 * Stoffnavn/aliaser som ikke skal åpne en egen fagsside: navnet → den
 * kanoniske siden. Dette brukes blant annet for gamle metabolittsider og gamle
 * sidenavn. Selve koblingen fra laboratorieanalytt til stoffside ligger i
 * `ANALYTTKOBLINGER`. Begge står i `src/data/stoffregister.json`.
 */
export const SAMMENSLATTE: Readonly<Record<string, string>> = registerdata.sammenslatte

/**
 * Eksplisitt kobling fra laboratorieanalytt til stoffside. Dette er skillet
 * mellom labsystemet og stoffregisteret: analyttens navn avgjør ikke hvilken
 * fagsside den tilhører når en kobling er oppgitt her.
 */
export const ANALYTTKOBLINGER: Readonly<Record<string, string>> = registerdata.analyttkoblinger ?? {}

/** Forklaringer som hører til én bestemt laboratorieanalytt på stoffets fagsside. */
export const ANALYTTMERKNADER: Readonly<Record<string, string>> = registerdata.analyttmerknader ?? {}

/** Sider som vises med en annen faglig tittel enn det interne sidenavnet. */
export const SIDETITLER: Readonly<Record<string, string>> = registerdata.sidetitler

function nokkel(navn: string): string {
  return navn.trim().toLocaleLowerCase('nb')
}

const SAMMENSLATT_PER_NOKKEL = new Map(Object.entries(SAMMENSLATTE).map(([stoff, side]) => [nokkel(stoff), side]))
const SIDE_PER_KODE = new Map(Object.entries(ANALYTTKOBLINGER).map(([kode, side]) => [kode.trim().toUpperCase(), side]))
const SIDETITTEL_PER_NOKKEL = new Map(Object.entries(SIDETITLER).map(([side, tittel]) => [nokkel(side), tittel]))
const SIDE_PER_TITTEL = new Map(Object.entries(SIDETITLER).map(([side, tittel]) => [nokkel(tittel), side]))

/** Den kanoniske siden et stoff eller en sidetittel hører til. */
export function sideFor(navn: string, sammenslatte: ReadonlyMap<string, string> = SAMMENSLATT_PER_NOKKEL): string {
  return SIDE_PER_TITTEL.get(nokkel(navn)) ?? sammenslatte.get(nokkel(navn)) ?? navn
}

/** Tittelen den kanoniske siden skal vises med. */
export function sidetittelFor(navn: string): string {
  const side = sideFor(navn)
  return SIDETITTEL_PER_NOKKEL.get(nokkel(side)) ?? side
}

function oppforingerFor(analyte: Analyte): Katalogoppforing[] {
  return menyanalytter(analyte).map(({ kode, navn }) => {
    // Står koden for hele oppføringen, er navnet moderstoffet pluss eventuelle
    // metabolitter, og siden er moderstoffets. Modulene som dekker flere koder,
    // deles opp i én oppføring per kode, med virkestoffets eget navn.
    const hele = kode === analyte.kode
    const utledetSide = sideFor(hele ? splitName(analyte).moderstoff : navn)
    const sidenavn = SIDE_PER_KODE.get(kode.trim().toUpperCase()) ?? utledetSide
    return {
      kode,
      navn,
      sidenavn,
      sidetittel: sidetittelFor(sidenavn),
      analysemetode: analyte.analysemetode,
      kategori: analyte.kategori,
      komponenter: hele && analyte.komponenter.length > 0 ? [...analyte.komponenter] : [navn],
      merknad: ANALYTTMERKNADER[kode.trim().toUpperCase()],
      fortolkning: analyte,
    }
  })
}

export function byggKatalog(pool: Analyte[]): Analyttkatalog {
  const oppforinger = pool.flatMap(oppforingerFor)
  const perKode = new Map(oppforinger.map((o) => [o.kode, o]))

  // Oppføringene per side, med den kanoniske koden først. Et navn som selv
  // er slått inn på en annen side er alltid sekundært; resten beholder
  // katalogrekkefølgen.
  const perSide = new Map<string, Katalogoppforing[]>()
  for (const o of oppforinger) {
    const liste = perSide.get(nokkel(o.sidenavn)) ?? []
    if (SAMMENSLATT_PER_NOKKEL.has(nokkel(o.navn))) liste.push(o)
    else liste.unshift(o)
    perSide.set(nokkel(o.sidenavn), liste)
  }

  return {
    oppforinger,
    finn: (kode) => perKode.get(kode.trim().toUpperCase()),
    kodeForSide: (sidenavn) => perSide.get(nokkel(sideFor(sidenavn)))?.[0]?.kode,
    paSiden: (sidenavn) => perSide.get(nokkel(sideFor(sidenavn))) ?? [],
  }
}


/** Standardkatalogen brukes av lenker som bare kjenner analyttkoden. */
const STANDARDKATALOG = byggKatalog(FORTOLKNINGSOPPFORINGER)

/**
 * Den ene koden som skal stå i URL-en for fagssiden en analyttkode tilhører.
 * Gamle/sekundære koder kan fortsatt leses fra adressen, men nye lenker peker
 * direkte på den kanoniske adressen.
 */
export function kanoniskAnalyttkode(kode: string): string {
  const oppforing = STANDARDKATALOG.finn(kode)
  return oppforing ? (STANDARDKATALOG.kodeForSide(oppforing.sidenavn) ?? oppforing.kode) : kode.trim().toUpperCase()
}
