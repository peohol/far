/**
 * Datamodellen byggeskriptene i `scripts/` produserer: psykofarmaka fra
 * kommentarer.pdf og antihypertensiver fra AHT.docx. De to kategoriene deler
 * modell fordi de går samme vei gjennom appen — søk, konsentrasjonsbånd, lim
 * inn — og skiller seg bare på hvilke referansetall analyttkortet viser.
 */

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

/**
 * Referansetallene en antihypertensiv analytt viser i stedet for
 * referanseområde og ringegrense. Kategorien har ingen ringegrense.
 */
export interface Antihypertensivgrenser {
  /** Nedre teknisk måleområde: under denne kan konsentrasjonen ikke tallfestes. */
  pavisningsgrense: number
  /**
   * Terapiområdet slik kilden oppgir det — ikke det samme som båndet
   * «innenfor», som også dekker konsentrasjonene over terapiområdet men under
   * toksisk. `null` for bumetanid og furosemid, som ikke har noe definert
   * terapiområde.
   */
  terapiomrade: Interval | null
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
  /** Satt for antihypertensiver, som viser andre referansetall enn psykofarmaka. */
  antihypertensiv?: Antihypertensivgrenser
  /** Konsentrasjoner under denne er «under». */
  nedreGrense: number
  /** Konsentrasjoner fra og med denne er «over». */
  ovreGrense: number
  nivaer: LevelComment[]
  /** Ekstra søkeord, vedlikeholdt i `src/data/aliaser.json`. */
  aliaser: string[]
}

/** En rettelse gjort i teksten fra kilden, for etterprøving. */
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
