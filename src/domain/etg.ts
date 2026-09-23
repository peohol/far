import type { Kommentarplassering } from './kommentar'
import type { Analyte } from '../types'

/**
 * Fortolkning av etanolmarkørene i urin: etylglukuronid (EtG, UETGS) og
 * etylsulfat (EtS, UETS).
 *
 * Begge er omdannelsesprodukter av etanol, og de fortolkes under ett. Det som
 * må avgjøres er hva som er påvist av de to, for det bestemmer både hvilken
 * kommentar som gjelder og hvilken analyttkode den skal ligge på:
 *
 * - Er begge påvist, er etanol inntatt, og fortolkningen legges på EtS med en
 *   henvisning dit fra EtG.
 * - Er bare den ene påvist, er inntak mulig, men ikke sikkert — funnet kan
 *   også komme fra alkoholfri drikke og andre mat- og drikkevarer. Da får den
 *   påviste analytten kommentaren, og den andre ingenting.
 *
 * Fordi de to alltid vurderes sammen, deler de én modul: det spiller ingen
 * rolle hvilken av dem man søker opp.
 *
 * Kommentartekstene er eierens egne og skal ikke endres uten at eieren av
 * appen uttrykkelig har bedt om det og bekreftet den nye ordlyden.
 */

/* --- Analyttkodene ------------------------------------------------------- */

/** Etylglukuronid i urin. */
export const ETG_KODE = 'UETGS'

/** Etylsulfat i urin. */
export const ETS_KODE = 'UETS'

/**
 * Analysemetoden de to rekvireres under. Modulen er hele metoden: EtG og EtS
 * er de eneste analyttene i den, og den har ingen underkategorier.
 */
export const ETG_ANALYSEMETODE = 'UETGHB'

/**
 * De to analyttene metoden består av, med de korte navnene de er kjent under.
 * Sidemenyen lister dem hver for seg, siden de har hver sin kode, men begge
 * fører til den samme modulen.
 */
export const ETG_ANALYTTER: { kode: string; navn: string }[] = [
  { kode: ETG_KODE, navn: 'EtG' },
  { kode: ETS_KODE, navn: 'EtS' },
]

/* --- Kommentartekstene --------------------------------------------------- */

/** Begge påvist: da er inntaket sikkert. Hele fortolkningen ligger på EtS. */
const BEGGE_PAVIST =
  'Omdannelsesprodukter av etanol, etylglukuronid (EtG) og etylsulfat (EtS), er påvist i urin. Dette viser at etanol (alkohol) er inntatt.'

/** Henvisningen EtG får når fortolkningen ligger på EtS. */
const SE_ETS = 'Se kommentar for EtS i urin.'

/**
 * Bare den ene påvist: da er inntak mulig, men ikke sikkert. Teksten er den
 * samme enten det er EtG eller EtS som er påvist; det er koden den limes inn
 * på som skiller de to tilfellene.
 */
const EN_AV_DEM =
  'Omdannelsesprodukt av etanol, etylglukuronid (EtG) eller etylsulfat (EtS), er påvist i urin. Dette kan være forenlig med inntak av etanol (alkohol). I enkelte tilfeller kan dette ses etter inntak av alkoholfri vin/øl eller andre mat-/drikkevarer.'

/* --- Alternativene ------------------------------------------------------- */

export type EtgValg = 'begge' | 'etg' | 'ets'

/** Ett av de tre tilfellene modulen fortolker. */
export interface EtgAlternativ {
  id: EtgValg
  /** Teksten på knappen. */
  merke: string
  /** Analyttkodene alternativet sier er påvist. */
  pavist: string[]
  /** Kommentarene tilfellet gir, i den rekkefølgen de skal limes inn. */
  plasseringer: Kommentarplassering[]
}

/**
 * De tre tilfellene, i den rekkefølgen de vises og velges med tastene 1, 2
 * og 3. «Begge påvist» står først: det er tilfellet med mer enn én kommentar,
 * og det eneste som slår fast at etanol er inntatt.
 */
export const ETG_ALTERNATIVER: EtgAlternativ[] = [
  {
    id: 'begge',
    merke: 'Begge påvist',
    pavist: [ETG_KODE, ETS_KODE],
    plasseringer: [
      { rolle: 'hoved', merke: 'Hovedkommentar', koder: [ETS_KODE], tekst: BEGGE_PAVIST },
      { rolle: 'tillegg', merke: 'Tilleggskommentar', koder: [ETG_KODE], tekst: SE_ETS },
    ],
  },
  {
    id: 'etg',
    merke: 'EtG påvist',
    pavist: [ETG_KODE],
    plasseringer: [
      { rolle: 'hoved', merke: 'Hovedkommentar', koder: [ETG_KODE], tekst: EN_AV_DEM },
    ],
  },
  {
    id: 'ets',
    merke: 'EtS påvist',
    pavist: [ETS_KODE],
    plasseringer: [
      { rolle: 'hoved', merke: 'Hovedkommentar', koder: [ETS_KODE], tekst: EN_AV_DEM },
    ],
  },
]

/** Alternativet med denne id-en. */
export function alternativFor(id: EtgValg): EtgAlternativ | undefined {
  return ETG_ALTERNATIVER.find((a) => a.id === id)
}

/* --- Oppføringen i søket ------------------------------------------------- */

/**
 * EtG og EtS som én søkbar oppføring, slik rusmiddelmodulene også er: koden
 * er begge analyttkodene, og hvert enkelt navn og hver enkelt kode finner
 * modulen gjennom `komponenter` og `aliaser`. Velges den, går appen til
 * fortolkningsmodulen i stedet for til konsentrasjonsbåndene, så feltene som
 * bare gjelder båndene står tomme.
 */
export const ETG_ANALYTT: Analyte = {
  kode: `${ETG_KODE} · ${ETS_KODE}`,
  navn: 'EtG + EtS',
  visningsnavn: 'EtG + EtS i urin',
  komponenter: ['Etylglukuronid', 'Etylsulfat'],
  gruppe: 'Rusmiddelanalyse',
  analysemetode: ETG_ANALYSEMETODE,
  kategori: '',
  enhet: '',
  referanseomrade: null,
  maleomrade: { tekst: '', deler: [] },
  aliaser: [ETG_KODE, ETS_KODE, 'EtG', 'EtS', 'etanol', 'alkohol'],
}

export function erEtgAnalytt(analyte: Analyte): boolean {
  return analyte.kode === ETG_ANALYTT.kode
}
