/**
 * Ikonregisteret for legemiddelformene: FESTs kode for den korte
 * legemiddelformen (`LegemiddelformKort`, kodeverk 7448) → en semantisk
 * variant → navnet på ikonet i ikonregisteret fra Atlas-designet
 * (`src/components/ikon/`).
 *
 * Koden er identiteten, aldri teksten: teksten kan få nye ord i FEST, koden
 * står. Former som ikke står her, får den generiske varianten og er merket
 * `kartlagt: false`, så de kan vises og fanges opp.
 *
 * Hvilke former som faktisk brukes av de publiserte stoffsidene, står i
 * `legemiddelformer-i-bruk.json`. Den lages maskinelt av
 * `scripts/legemiddelformer-i-bruk.sql`, og testen i
 * `src/__tests__/legemiddelformer.test.ts` krever at hver av dem står her. Se
 * `docs/legemiddeldata.md`.
 */

/**
 * De semantiske variantene og ikonet hver av dem vises med. Atlas har ikoner
 * for tablett, depottablett og kapsel; sprøyten, flasken og dråpeflasken er
 * tegnet i samme stil (`src/components/ikon/register.ts`). En variant uten
 * egen tegning bruker det generiske ikonet; får den en, er det bare
 * ikonnavnet her som endres.
 */
export const FORMVARIANTER = {
  tablett: { ikon: 'tablet' },
  smeltetablett: { ikon: 'tablet' },
  dispergerbar_tablett: { ikon: 'tablet' },
  depottablett: { ikon: 'depot' },
  kapsel: { ikon: 'capsule' },
  depotkapsel: { ikon: 'capsule' },
  enterokapsel: { ikon: 'capsule' },
  mikstur: { ikon: 'bottle' },
  draper: { ikon: 'dropper' },
  injeksjon: { ikon: 'syringe' },
  depotinjeksjon: { ikon: 'syringe' },
  generisk: { ikon: 'fallback' },
} as const satisfies Record<string, { ikon: string }>

export type Formvariant = keyof typeof FORMVARIANTER

/** Varianten former uten egen oppføring får. */
export const GENERISK_FORM: Formvariant = 'generisk'

/** FEST-kode → variant. Teksten står bare som kommentar, til hjelp for lesing. */
export const FORMKODER: Readonly<Record<string, Formvariant>> = {
  '53': 'tablett', // Tablett
  '48': 'smeltetablett', // Smeltetablett
  '5': 'dispergerbar_tablett', // Dispergerbar tablett
  '524': 'dispergerbar_tablett', // Tyggetablett/dispergerbar tablett
  '25': 'depottablett', // Depottablett
  '891': 'kapsel', // Kapsel, hard
  '743': 'depotkapsel', // Depotkapsel, hard
  '769': 'enterokapsel', // Enterokapsel, hard
  '842': 'mikstur', // Mikstur, oppløsning
  '840': 'mikstur', // Mikstur, suspensjon
  '171': 'mikstur', // Konsentrat til mikstur
  '748': 'draper', // Dråper, oppløsning
  '816': 'injeksjon', // Injeksjonsvæske, oppløsning
  '880': 'injeksjon', // Injeksjons-/infusjonsvæske, oppløsning
  '789': 'injeksjon', // Pulver til injeksjonsvæske, oppløsning
  '913': 'depotinjeksjon', // Depotinjeksjonsvæske, suspensjon
  '819': 'depotinjeksjon', // Pulver og væske til depotinjeksjonsvæske, suspensjon
}

export interface Formikon {
  variant: Formvariant
  /** Navnet i ikonregisteret. */
  ikon: string
  /** `false` når formkoden ikke står i registeret og den generiske varianten brukes. */
  kartlagt: boolean
}

/** Ikonet for en FEST-formkode. Ukjent eller manglende kode gir det generiske. */
export function formikon(kode: string | null | undefined): Formikon {
  const kjent = kode ? FORMKODER[kode] : undefined
  const variant = kjent ?? GENERISK_FORM
  return { variant, ikon: FORMVARIANTER[variant].ikon, kartlagt: kjent !== undefined }
}
