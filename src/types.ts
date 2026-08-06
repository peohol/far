/** Datamodellen som `scripts/build_data.py` produserer fra kommentarer.pdf. */

/** De tre nivåene en målt konsentrasjon kan havne i. */
export const LEVELS = ['under', 'innenfor', 'over'] as const
export type Level = (typeof LEVELS)[number]

/** Et tallintervall. `fra`/`til` er `null` når intervallet er åpent i den enden. */
export interface Interval {
  fra: number | null
  til: number | null
  merknad: string
  tekst: string
}

/** Måleområde: ett intervall, eller ett per delanalytt i en sumanalyse. */
export interface MeasuringRange {
  tekst: string
  deler: (Interval & { kode: string | null })[]
}

/** Kommentaren som hører til ett konsentrasjonsnivå. */
export interface LevelComment {
  niva: Level
  /** Intervallet slik det vises, f.eks. «10 – 1799». */
  tekst: string
  fra: number | null
  til: number | null
  kommentar: string
}

export interface Analyte {
  /** Koden labsystemet bruker, f.eks. «AMTNORSUM». */
  kode: string
  /** Navnet fra referansetabellen, f.eks. «Amitriptylin + nortriptylin». */
  navn: string
  /** Navnet fra kommentartabellen, f.eks. «Sum: Amitriptylin + nortriptylin». */
  visningsnavn: string
  /** Enkeltanalyttene navnet består av. */
  komponenter: string[]
  gruppe: string
  enhet: string
  referanseomrade: Interval | null
  maleomrade: MeasuringRange
  ringegrense: number | null
  /** Konsentrasjoner under denne er «under». */
  nedreGrense: number
  /** Konsentrasjoner fra og med denne er «over». */
  ovreGrense: number
  nivaer: LevelComment[]
  /** Ekstra søkeord, vedlikeholdt i `src/data/aliaser.json`. */
  aliaser: string[]
}

/** En rettelse gjort i teksten fra PDF-en, for etterprøving. */
export interface Correction {
  kategori: string
  hvor: string
  fra: string
  til: string
  begrunnelse: string
}

/** En uoverensstemmelse i kildedokumentet som ikke lot seg rette maskinelt. */
export interface Discrepancy {
  kode: string
  type: string
  beskrivelse: string
}

export interface Dataset {
  meta: {
    kilde: string
    standardEnhet: string
    antallAnalytter: number
    rettelser: Correction[]
    avvik: Discrepancy[]
  }
  analytter: Analyte[]
}
