/**
 * Kurateringskøen: arbeidslisten monografkuratoren henter neste stoff fra,
 * med det køen vet om hvert stoff (`docs/kurateringsko.md`).
 *
 * Køen står på en egen gren som bare arbeidsflyten «Kurateringskø» skriver
 * på. Kuratoren endrer den aldri direkte: den skriver en forespørsel på sin
 * egen øktgren, og arbeidsflyten behandler forespørslene én om gangen og
 * skriver svaret tilbake på samme gren. Slik får to kuratorer som spør
 * samtidig aldri det samme stoffet.
 *
 * Her står formen på køen, forespørslene og svarene, og navnene på grenene og
 * filene. Alt annet om køen leser herfra.
 */

/** Versjonen av formen på køen, forespørselen og svaret. Økes når en leser må vite at formen er endret. */
export const KOVERSJON = 1

/** Grenen køen står på. Bare arbeidsflyten skriver der; den slås aldri sammen med main. */
export const KOGREN = 'kurateringsko/tilstand'

/** Prefikset til øktgrenene kuratoren skriver forespørslene på. */
export const OKTPREFIKS = 'kurateringsko/okt/'

/** Hele navnet på en øktgren: prefikset og en nøkkel av bokstaver, tall, `.`, `_` og `-`. */
export const OKTGREN = /^kurateringsko\/okt\/[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/

/** Mappen filene står i, på køgrenen og øktgrenene. Finnes aldri på main. */
export const KOMAPPE = 'kurateringsko'
export const KOFIL = `${KOMAPPE}/ko.json`
export const NESTEFIL = `${KOMAPPE}/neste.json`
export const OVERSIKTSFIL = `${KOMAPPE}/oversikt.md`
export const FORESPORSELSFIL = `${KOMAPPE}/foresporsel.json`
export const SVARFIL = `${KOMAPPE}/svar.json`

/** Prefikset til grenene kurateringene lages på, og som køen kjenner en PR for et stoff igjen på. */
export const KURATERINGSPREFIKS = 'kuratering/'

/**
 * Hvordan et stoff kurateres:
 *
 * - `de_novo`: hele monografien bygges opp på nytt fra et uavhengig
 *   kildegrunnlag, før den sammenlignes med det som står (som citalopram).
 * - `evidensovervaking`: siden er kuratert de novo; nå ses det etter ny
 *   kunnskap etter kunnskapsgrensen.
 * - `oppdatering`: en kuratering av en annen art, f.eks. en eldre full
 *   oppdatering. Køen velger den aldri selv, men den står i historikken.
 */
export const MODI = ['de_novo', 'evidensovervaking', 'oppdatering'] as const
export type Modus = (typeof MODI)[number]

/**
 * Hvor et stoff står i køen:
 *
 * - `klar`: kan reserveres (når det ikke må vente etter en feil).
 * - `reservert`: en kuratoren arbeider med det nå, til fristen.
 * - `fagarbeid_ferdig`: kuratoren er ferdig og har laget en PR som fortsatt er et utkast.
 * - `venter_godkjenning`: PR-en er klar til gjennomgang og venter på å bli godkjent og slått sammen.
 * - `sammenslatt`: PR-en er slått sammen, men utrullingen til produksjonen er ikke bekreftet.
 * - `publisert`: kurateringen er rullet ut, og ingen ny er forfalt.
 * - `blokkert`: noe må avklares av et menneske før stoffet kan kurateres (se `blokkeringer`).
 * - `utenfor`: ikke et aktivt stoff i registeret (arkivert, i papirkurven eller borte), eller utelatt.
 */
export const KOSTATUSER = ['klar', 'reservert', 'fagarbeid_ferdig', 'venter_godkjenning', 'sammenslatt', 'publisert', 'blokkert', 'utenfor'] as const
export type Kostatus = (typeof KOSTATUSER)[number]

/** Tallene køen prioriterer innholdet etter, fra den publiserte siden. Bare tall, aldri innholdet. */
export interface Sidemaal {
  kl: string
  /** Om stoffet har en publisert fagside. */
  side: boolean
  /** Elementene på siden, utenom de fjernede. */
  elementer: number
  /** De redaksjonelle seksjonene, og hvor mange av dem som har innhold. */
  redaksjonelle_paneler: number
  paneler_med_innhold: number
  /** Referansene siden siterer. */
  referanser: number
  /** Redaksjonelle elementer uten noen kilde, verken inline eller på kortet. */
  elementer_uten_kilde: number
}

/** En kuratering som er publisert: rullet ut fra køen, eller funnet i repoet. */
export interface Kurateringsspor {
  /** Når den kom i produksjonen (eller migrasjonens tidspunkt, for en funnet i repoet). */
  kl: string
  modus: Modus
  /** Datoen kildesøket gjelder til (ÅÅÅÅ-MM-DD), når den er kjent. */
  kunnskapsgrense: string | null
  /** De novo-runden den hørte til, for en de novo-kuratering. */
  runde: number | null
  pr: number | null
  /** Kurateringsgrenen i OUSFAR den ble publisert fra, når den ble det. */
  gren?: string | null
  /** `ko` når køen fulgte den, `repo` når den er funnet i migrasjonene og journalene på main. */
  kilde: 'ko' | 'repo'
}

/** Det kuratoren har laget i en kuratering som ble avbrutt, så neste forsøk fortsetter der i stedet for å begynne på nytt. */
export interface Gjenopptak {
  oppgave: string
  okt: string
  avbrutt_kl: string
  grunn: string
  fase: string | null
  jobbgren: string | null
  kurateringsgren: string | null
  pr: number | null
  /** Kurateringsgrenen i OUSFAR (ID-en), når kurateringen gjøres der. */
  gren?: string | null
  /** Kunnskapsgrensen grenen ble meldt ferdig med, så den følger grenen til den er publisert. */
  kunnskapsgrense?: string | null
}

export interface Reservasjon {
  /** ID-en for denne kurateringen; alle forespørsler om den må oppgi den. */
  oppgave: string
  /** Øktgrenen som reserverte. */
  okt: string
  modus: Modus
  reservert_kl: string
  fornyet_kl: string
  /** Når reservasjonen går ut hvis den ikke fornyes. */
  frist_kl: string
  /** Det kuratoren sist meldte at den holdt på med. */
  fase: string | null
  jobbgren: string
  kurateringsgren: string
  pr: number | null
  /** Kurateringsgrenen i OUSFAR (ID-en), så snart kuratoren har åpnet den. */
  gren?: string | null
  /** Kunnskapsgrensen fra en tidligere kontrollrunde i samme gren (se {@link Gjenopptak}). */
  kunnskapsgrense?: string | null
}

/** Statusene til en kurateringsgren i OUSFAR, som `kuratering.grener` har dem. */
export const GRENSTATUSER = ['arbeid', 'klar', 'tilbakemelding', 'retting', 'godkjent', 'publisert', 'stanset', 'blokkert', 'arkivert'] as const
export type Grenstatus = (typeof GRENSTATUSER)[number]

/** En kurateringsgren i OUSFAR slik køen leser den (`kuratering_kostatus`): ingen fagtekst. */
export interface Greninfo {
  id: string
  stoff: string
  art: 'kuratering' | 'de_novo' | 'gjenoppretting'
  status: Grenstatus
  revisjon: number
  runde: number
  oppdatert_kl: string
  publisert_kl: string | null
}

/**
 * Arten en kurateringsgren i OUSFAR må ha for å kunne være kurateringen i
 * modusen: en de novo-kuratering gjøres i en `de_novo`-gren, de andre i en
 * `kuratering`-gren. En `gjenoppretting` er aldri en kuratering køen følger.
 */
export const grenartFor = (modus: Modus): Greninfo['art'] => (modus === 'de_novo' ? 'de_novo' : 'kuratering')

/**
 * En ferdig kuratering i en kurateringsgren i OUSFAR, som køen følger til den
 * er publisert: gjennom den faglige kontrollen, rettingene og publiseringen.
 */
export interface Kurateringsappgren {
  id: string
  oppgave: string
  modus: Modus
  runde: number | null
  kunnskapsgrense: string
  jobbgren: string | null
  registrert_kl: string
  /** `ukjent` til køen har lest den. */
  status: Grenstatus | 'ukjent'
  revisjon: number | null
  kontrollrunde: number | null
}

/** PR-en med en ferdig kuratering, slik GitHub sist viste den. */
export interface Kurateringspr {
  nummer: number
  url: string | null
  oppgave: string
  modus: Modus
  /** De novo-runden kurateringen hører til. */
  runde: number | null
  kunnskapsgrense: string
  kurateringsgren: string | null
  jobbgren: string | null
  registrert_kl: string
  /** `ukjent` til køen har slått den opp. */
  tilstand: 'ukjent' | 'utkast' | 'klar' | 'sammenslatt' | 'lukket'
  sammenslatt_kl: string | null
  /** Når utrullingen til produksjonen etter sammenslåingen var vellykket. */
  utrullet_kl: string | null
}

/**
 * Noe som hindrer kuratering til et menneske har sett på det. `system`-
 * blokkeringer forsvinner av seg selv når grunnen er borte (som en fagside som
 * kommer); de andre fjernes med `tilbakestill`.
 */
export interface Blokkering {
  kode:
    | 'uten_fagside'
    | 'for_mange_forsok'
    | 'pr_lukket'
    | 'pr_ukjent'
    | 'utrulling_feilet'
    | 'agent'
    | 'gren_forkastet'
    | 'gren_ukjent'
    | 'gren_stanset'
    | 'annen_gren'
    | 'gren_feil_kobling'
  grunn: string
  kl: string
  kilde: 'system' | 'ko' | 'agent'
}

export interface Hendelse {
  kl: string
  hendelse: string
  oppgave?: string
  okt?: string
  melding?: string
}

export interface Kostoff {
  stoff: string
  navn: string
  status: Kostatus
  /** Modusen neste (eller den pågående) kuratering skal ha; `null` når ingen er forfalt. */
  modus: Modus | null
  prioritet: { poeng: number; grunner: string[] }
  maal: Sidemaal | null
  reservasjon: Reservasjon | null
  /** Forsøk siden siste publiserte kuratering. */
  forsok: number
  /** Etter en feil: tidligst når stoffet kan reserveres igjen. */
  tidligst_kl: string | null
  gjenoppta: Gjenopptak | null
  pr: Kurateringspr | null
  /** Kurateringsgrenen i OUSFAR køen følger. Mangler i køer fra før grenene. */
  appgren?: Kurateringsappgren | null
  blokkeringer: Blokkering[]
  sist_kuratert: Kurateringsspor | null
  /** Det siste forsøket, hvordan det enn endte. */
  siste_kjoring: { oppgave: string; okt: string; startet_kl: string; avsluttet_kl: string | null; utfall: string } | null
  /** Om stoffet er aktivt i stoffregisteret. */
  aktiv: boolean
  /** De siste hendelsene, eldst først. Hele historikken står i køgrenens commits. */
  historikk: Hendelse[]
}

/** Forespørslene køen har behandlet fra én øktgren. */
export interface Oktlogg {
  /** ID-ene som er brukt på grenen, de siste først. */
  ider: string[]
  siste: { id: string; sha256: string; svar: Svar } | null
  /** Commiten øktgrenen sto på etter at svaret ble skrevet: står den der fortsatt, er det ikke noe nytt. */
  besvart_commit: string | null
  sist_brukt_kl: string
}

export interface Kotilstand {
  versjon: typeof KOVERSJON
  oppdatert_kl: string
  /** Sist stoffene og tallene ble lest fra databasen. */
  malt_kl: string | null
  /** Telleren oppgave-ID-ene lages av. */
  teller: number
  stoffer: Record<string, Kostoff>
  okter: Record<string, Oktlogg>
}

export const HANDLINGER = ['status', 'forhandsvis', 'reserver', 'forny', 'fullfort', 'feilet', 'blokkert', 'frigi', 'tilbakestill'] as const
export type Handling = (typeof HANDLINGER)[number]

/** Forespørselen, slik den står i {@link FORESPORSELSFIL} på en øktgren. */
export interface Foresporsel {
  versjon: typeof KOVERSJON
  /** Ny for hver forespørsel på grenen. Samme ID og innhold to ganger gir det samme svaret. */
  id: string
  handling: Handling
  /** `reserver`, `forhandsvis`: et bestemt stoff i stedet for det køen velger. `tilbakestill`: stoffet. */
  stoff?: string
  /** Alle handlinger om en reservert kuratering. */
  oppgave?: string
  fase?: string
  jobbgren?: string
  kurateringsgren?: string
  pr?: number
  /** `forny`, `fullfort`: kurateringsgrenen i OUSFAR (ID-en). `tilbakestill`: grenen stoffet gis tilbake til kuratoren med. */
  gren?: string
  /** `fullfort`: datoen kildesøket gjelder til (ÅÅÅÅ-MM-DD). */
  kunnskapsgrense?: string
  modus?: Modus
  /** `feilet`, `blokkert`, `frigi`, `tilbakestill`: hvorfor, uten innhold fra fagsidene. */
  grunn?: string
}

export type Svarutfall = 'ok' | 'ingen_oppgave' | 'avvist'

export interface Svar {
  versjon: typeof KOVERSJON
  foresporsel_id: string | null
  foresporsel_sha256: string
  handling: Handling | null
  utfall: Svarutfall
  melding: string
  behandlet_kl: string
  kjoring: string | null
  /** Kurateringen svaret gjelder, med det kuratoren trenger for å gjøre den. */
  oppgave?: Oppgavesvar
  /** Oversikten over køen, for `status` og `ingen_oppgave`. */
  ko?: Kooversikt
}

export interface Oppgavesvar {
  oppgave: string
  stoff: string
  navn: string
  modus: Modus
  forsok: number
  frist_kl: string
  jobbgren: string
  kurateringsgren: string
  pr: number | null
  /** Kurateringsgrenen i OUSFAR å fortsette i, når det finnes en. */
  gren: string | null
  gjenoppta: Gjenopptak | null
  sist_kuratert: Kurateringsspor | null
  maal: Sidemaal | null
  prioritet: Kostoff['prioritet']
}

/** Det korte sammendraget i {@link NESTEFIL}: det kuratoren og folk flest trenger. */
export interface Kooversikt {
  oppdatert_kl: string
  malt_kl: string | null
  antall: Record<Kostatus, number>
  aktive: { stoff: string; oppgave: string; okt: string; frist_kl: string; fase: string | null }[]
  /** Hvorfor det neste stoffet ikke gis ut nå (en annen kuratering skal fortsettes først, eller for mange venter på kontroll), ellers `null`. */
  holdes_tilbake: string | null
  /** De neste stoffene køen gir ut, i rekkefølge. */
  neste: { stoff: string; modus: Modus; poeng: number; grunner: string[]; tidligst_kl: string | null }[]
  /** Kurateringene som venter på kontroll, godkjenning eller utrulling: PR-en, eller grenen i OUSFAR med statusen der. */
  til_gjennomgang: { stoff: string; pr?: number; gren?: string; grenstatus?: Grenstatus | 'ukjent'; status: Kostatus }[]
  blokkert: { stoff: string; blokkeringer: Blokkering[] }[]
}
