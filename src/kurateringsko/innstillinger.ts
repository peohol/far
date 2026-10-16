/**
 * Innstillingene for kurateringskøen (`docs/kurateringsko.md`). Endres i en
 * PR til main; arbeidsflyten bruker alltid det som står her på main.
 */
import type { Modus } from './modell'

export interface Koinnstillinger {
  /** Flest kurateringer som kan være reservert samtidig. PR-er som venter på gjennomgang, teller ikke. */
  maks_aktive: number
  /** Hvor lenge en reservasjon varer uten at den fornyes. */
  reservasjon_minutter: number
  /** Lengst en reservasjon kan fornyes til, regnet fra den ble gjort. */
  maks_reservasjon_timer: number
  /** Etter så mange forsøk uten publisert kuratering blokkeres stoffet til et menneske har sett på det. */
  maks_forsok: number
  /** Hvor lenge et stoff venter etter en feil før det kan reserveres igjen. */
  ventetid_etter_feil_minutter: number
  /** Modiene køen gir ut. `evidensovervaking` legges til når kuratoren skal se etter ny kunnskap på kuraterte sider. */
  aktive_modi: readonly Modus[]
  /** De novo-runden som gjelder. Økes for å kuratere alle sidene de novo på nytt. */
  de_novo_runde: number
  /** Dager fra kunnskapsgrensen til evidensovervåkningen er forfalt. */
  evidensovervaking_dager: number
  /** Hvor ofte stoffene og tallene leses fra databasen. */
  maling_timer: number
  /** Øktgrener uten aktiv reservasjon slettes etter så mange dager. */
  okt_slettes_etter_dager: number
  /** Stoffer som skal først, i denne rekkefølgen, når de er klare. */
  forrang: readonly string[]
  /** Gi bare ut stoffene i `forrang` (og kurateringer som fortsettes), f.eks. mens en pilot pågår. */
  bare_forrang: boolean
  /** Stoffer køen ikke gir ut. */
  utelatt: readonly string[]
  /** Vektene i prioriteringen (se `prioriter` i `ko.ts`). */
  vekter: {
    gjenoppta: number
    forrang: number
    aldri_kuratert: number
    de_novo: number
    alder_per_aar: number
    manglende_innhold: number
    uten_kilde: number
    faa_referanser: number
  }
  /** Færre referanser enn dette regnes som svak dokumentasjon. */
  faa_referanser: number
}

export const INNSTILLINGER: Koinnstillinger = {
  maks_aktive: 1,
  reservasjon_minutter: 180,
  maks_reservasjon_timer: 24,
  maks_forsok: 3,
  ventetid_etter_feil_minutter: 360,
  aktive_modi: ['de_novo'],
  // Runde 1 var den første de novo-piloten (citalopram, gjennom migrasjonene).
  // Runde 2 er den første i kurateringsgrenene, gjennom hele registeret.
  de_novo_runde: 2,
  evidensovervaking_dager: 180,
  maling_timer: 20,
  okt_slettes_etter_dager: 14,
  // Piloten for kurateringsgrenene (docs/kurateringsgrener-fremdrift.md, fase F).
  // Når alle tre er publisert etter godkjent kontroll: tøm forrang og slå av
  // bare_forrang, så går de novo-runden videre gjennom hele registeret.
  forrang: ['citalopram', 'lurasidon', 'ghb'],
  bare_forrang: true,
  // En fagside laget for å prøve appen, ikke en monografi.
  utelatt: ['teststoff'],
  vekter: {
    gjenoppta: 1000,
    forrang: 500,
    aldri_kuratert: 100,
    de_novo: 50,
    alder_per_aar: 100,
    manglende_innhold: 100,
    uten_kilde: 50,
    faa_referanser: 20,
  },
  faa_referanser: 5,
}
