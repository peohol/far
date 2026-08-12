import type { Analyte } from '../types'

/**
 * Fortolkning av THC-syre i urin (IRCAK), etter regnearket
 * `originaldata/THC-COOH.xlsm`. Verdiene som tastes inn er ferdig
 * kreatininkorrigerte THC-syrekonsentrasjoner fra labsystemet.
 *
 * Regnearket sammenligner endringen fra forrige prøve med tre
 * utskillelseskurver, og velger kommentar etter hvilke kurver endringen
 * ligger over. Uten en tidligere prøve fortolkes bare konsentrasjonen i den
 * aktuelle prøven. Kurvene, grensene og all ordlyd er hentet uendret fra
 * regnearket; avvik herfra er en feil.
 */

/* --- Utskillelseskurver -------------------------------------------------
   Bi-eksponentielle kurver C(t) = a1·e^(−k1·t) + a2·e^(−k2·t), med t i døgn,
   tilpasset måledata i regnearkets Modellering-ark. Amplitudene ganges med
   regnearkets konverteringsfaktor (Innstillinger og beregninger!H19), som
   regner kildedataenes enheter om til enhetene labsystemet svarer IRCAK i. */

/** Innstillinger og beregninger!H19: `=344.451/1000`. */
const KONVERTERING = 344.451 / 1000

export interface Kurve {
  a1: number
  k1: number
  a2: number
  k2: number
}

function kurve(a1: number, k1: number, a2: number, k2: number): Kurve {
  return { a1: a1 * KONVERTERING, k1, a2: a2 * KONVERTERING, k2 }
}

/** Rask utskillelse — «Sporadisk» i regnearkets graf. */
export const KURVE_GRONN = kurve(75.10642536264817, 2.344866277008879, 52.89994063494364, 0.13388138992902396)

/** Grønn med dobbel amplitude. Konklusjonens midterste grense. */
export const KURVE_GUL = kurve(2 * 75.10642536264817, 2.344866277008879, 2 * 52.89994063494364, 0.13388138992902396)

/** Tregest dokumenterte utskillelse — «Kronisk, ekstrem» i grafen. */
export const KURVE_ROD = kurve(261.5116678191702, 0.10152954824642728, 52.78117322451692, 0.022237916803065798)

/**
 * Mellomkurve — «Kronisk, typisk» i regnearkets graf. Brukes ikke: verken
 * konklusjonen eller figuren leser av den. Står igjen fordi parametrene er
 * regnearkets, og testene holder dem opp mot cellene.
 */
export const KURVE_LILLA = kurve(2017.5730310270542, 0.3026509802677265, 86.45163183092453, 0.057581264510644554)

/* --- Måleusikkerhet -----------------------------------------------------
   Endringen mellom to prøver korrigeres for analysenes variasjon før den
   sammenlignes med kurvene: i stedet for den målte endringen leses et kvantil
   i en lognormalfordeling rundt den av (Innstillinger og beregninger!B22–B25).
   Det gir personen tvilens fordel — bare endringer som er for høye selv med
   måleusikkerheten trukket fra, regnes som over.

   Hvor langt ut i fordelingen som leses av, styrer sikkerhetsmarginen.
   Regnearket har den fast (B5 = 0,9); her velges den i skjemaet. */

const CV_THC = 0.2
const CV_KREATININ = 0.05
const CV_TOTAL = Math.sqrt(CV_THC ** 2 + CV_KREATININ ** 2)

/** log-standardavvik for forholdet mellom to prøver: `=SQRT(2*B4^2)`. */
const LOG_SD = Math.sqrt(2 * CV_TOTAL ** 2)

/** Sikkerhetsmarginen fortolkningen regnes med — regnearkets B5. */
export type Sikkerhetsmargin = 0.5 | 0.9 | 0.99

/**
 * Halve fordelingen er ingen margin i det hele tatt: medianen i en
 * lognormalfordeling er den målte verdien selv, så korreksjonen blir 1 og
 * målingene tolkes rett fram. Står med eget navn fordi både regnestykket og
 * teksten sier noe annet i dette tilfellet.
 */
export const INGEN_SIKKERHETSMARGIN: Sikkerhetsmargin = 0.5

/** Regnearkets egen sikkerhet (B5), og modulens standardvalg. */
export const STANDARD_SIKKERHETSMARGIN: Sikkerhetsmargin = 0.9

/**
 * z-verdiene LOGNORM.INV leser av: Φ⁻¹(1 − margin) i standard
 * normalfordeling, med full presisjon. Regnearket bruker bare den midterste —
 * B5 er 0,9, altså 10 %-kvantilen; de to andre er de samme kvantilene lest av
 * henholdsvis midt i og lenger ute i den samme fordelingen.
 */
const Z_KVANTIL: Record<Sikkerhetsmargin, number> = {
  0.5: 0,
  0.9: -1.2815515655446008,
  0.99: -2.3263478740408408,
}

/**
 * Faktoren den målte endringen ganges med: `exp(Φ⁻¹(1 − margin) · logSD)`.
 * ≈ 0,688 ved 90 %, ≈ 0,528 ved 99 %, og nøyaktig 1 uten margin.
 */
export function korreksjonsfaktor(margin: Sikkerhetsmargin): number {
  return Math.exp(Z_KVANTIL[margin] * LOG_SD)
}

/* --- Kurveregning ------------------------------------------------------- */

/** Kurvens verdi etter `t` døgn. Definert også for negative `t`. */
export function verdiPaaKurve(t: number, k: Kurve): number {
  return k.a1 * Math.exp(-k.k1 * t) + k.a2 * Math.exp(-k.k2 * t)
}

/**
 * Tidspunktet der kurven passerer `verdi`. Kurven er strengt fallende, så
 * svaret er entydig; binærsøket lander på regnearkets Newton-løsning
 * (A29–G59) med maskinpresisjon. Verdier over kurvens startpunkt gir negativ
 * tid — kurven forlenges da bakover, akkurat som i regnearket.
 */
export function tidForVerdi(verdi: number, k: Kurve): number {
  let lav = -1000
  let hoy = 1000
  for (let i = 0; i < 200; i++) {
    const midt = (lav + hoy) / 2
    if (verdiPaaKurve(midt, k) > verdi) {
      lav = midt
    } else {
      hoy = midt
    }
  }
  return (lav + hoy) / 2
}

/**
 * Forventet relativ endring fra forrige prøve etter `dager` døgn, om
 * utskillelsen følger kurven: kurven leses av der forrige prøve ligger, og
 * `dager` senere (Innstillinger og beregninger!B63–D63). −0,25 betyr 25 %
 * nedgang.
 */
export function forventetEndring(forrige: number, dager: number, k: Kurve): number {
  const t0 = tidForVerdi(forrige, k)
  return verdiPaaKurve(t0 + dager, k) / forrige - 1
}

/** Målt relativ endring, korrigert for måleusikkerhet (D20 = B25 − 1). */
export function korrigertEndring(
  forrige: number,
  aktuell: number,
  margin: Sikkerhetsmargin,
): number {
  return (aktuell / forrige) * korreksjonsfaktor(margin) - 1
}

/* --- Konsentrasjonsnivå og kategori ------------------------------------- */

/** Regnearkets M21: nivået på den aktuelle prøvens målte verdi. */
export type Konsentrasjonsniva = 'lav' | 'middels høy' | 'høy'

export function konsentrasjonsniva(aktuell: number): Konsentrasjonsniva {
  if (aktuell < 20) return 'lav'
  if (aktuell < 40) return 'middels høy'
  return 'høy'
}

/**
 * Regnearkets kategori (B65): 0 uten sammenligningsgrunnlag, ellers 1–4
 * etter hvilke kurver den korrigerte endringen ligger over, pluss 1 når
 * kronisk bruk ikke legges til grunn. Grensene sjekkes med strengt større
 * enn, som i B64.
 */
export function beregnKategori(
  medForrige: boolean,
  kronisk: boolean,
  korrigert?: number,
  forventet?: { gronn: number; gul: number; rod: number },
): number {
  let base = 0
  if (medForrige && korrigert !== undefined && forventet !== undefined) {
    if (!(korrigert > forventet.gronn)) base = 1
    else if (!(korrigert > forventet.gul)) base = 2
    else if (!(korrigert > forventet.rod)) base = 3
    else base = 4
  }
  return base + (kronisk ? 0 : 1)
}

/* --- Kommentaren --------------------------------------------------------
   Ordlyden under er hentet tegn for tegn fra regnearkets tekstformler
   (Innstillinger og beregninger!J23–J30) og brukes i rettsmedisinske
   svarbrev. Den skal ikke endres uten at eieren av appen uttrykkelig har
   bedt om det og bekreftet den nye ordlyden. Ett bevisst avvik er bestilt
   av eieren: «5-7 dager» skrives med tankestrek, «5–7 dager». */

export function byggKommentar(
  niva: Konsentrasjonsniva,
  kategori: number,
  medForrige: boolean,
  forrigeDatoNorsk: string,
): string {
  const deler: string[] = []

  // J23 — åpningen, alltid med.
  deler.push(`THC-syre, et omdannelsesprodukt av cannabis, er påvist i ${niva} konsentrasjon. `)

  // J24 — bare ved høy konsentrasjon.
  if (niva === 'høy') {
    deler.push('Slike konsentrasjoner ses gjerne ved prøvetaking kort tid etter inntak av cannabis. ')
  }

  // J25 — endringen er over selv den strengeste kurven.
  if (kategori >= 4) {
    deler.push(`Analyseresultatet tilsier at cannabis har vært inntatt etter prøve tatt ${forrigeDatoNorsk}.`)
  }

  // J26 — påvist uten holdepunkter for nytt inntak: inntak har uansett skjedd.
  if (niva !== 'høy' && kategori < 3) {
    deler.push('Analyseresultatet viser at cannabis har vært inntatt. ')
  }

  if (medForrige && kategori < 4) {
    // J27 — generelt om påvisningstid.
    deler.push(
      'Etter et enkeltinntak vil THC-syre kunne påvises i urin i cirka 5–7 dager. Ved gjentatte inntak vil påvisningstiden for THC-syre i urin øke, vanligvis opptil en måned etter avsluttet inntak. ',
    )
    // J28 — konklusjonen mot forrige prøve.
    const lede =
      kategori === 3
        ? 'Basert på analyseresultatet alene er det vanskelig å avgjøre hvorvidt cannabis har vært inntatt etter prøve tatt '
        : 'Analyseresultatet tilsier at cannabis ikke nødvendigvis har vært inntatt etter prøve tatt '
    deler.push(
      `${lede}${forrigeDatoNorsk}. Ved spørsmål kan rekvirent kontakte vakthavende lege ved Seksjon for klinisk farmakologi Ullevål (se ous.labfag.no).`,
    )
  }

  // J29 — uten sammenligningsgrunnlag.
  if (!medForrige) {
    deler.push('Oppfølging med flere prøver anbefales.')
  }

  return deler.join('')
}

/* --- Datoer og tall ------------------------------------------------------ */

/** Hele døgn fra `fra` til `til` (ISO-datoer). Negativt når `til` er først. */
export function dagerMellom(fra: string, til: string): number {
  return Math.round((Date.parse(til) - Date.parse(fra)) / 86_400_000)
}

/** «2026-07-04» → «04.07.2026», slik datoen står i kommentaren. */
export function formaterDatoNorsk(iso: string): string {
  const [aar = '', maaned = '', dag = ''] = iso.split('-')
  return `${dag}.${maaned}.${aar}`
}

/**
 * Leser et tall slik det tastes i norske felt: både komma og punktum godtas
 * som desimaltegn. `null` når teksten ikke er et rent tall.
 */
export function lesTall(tekst: string): number | null {
  const trimmet = tekst.trim().replace(',', '.')
  if (trimmet === '' || !/^-?\d+(\.\d+)?$/.test(trimmet)) return null
  return Number(trimmet)
}

/** Et forholdstall med to gjeldende siffer og norsk desimaltegn: «0,26». */
export function formaterTall(verdi: number): string {
  return Number(verdi.toPrecision(2)).toString().replace('.', ',')
}

/** «nedgang», «økning» eller «ingen endring» — for en relativ endring. */
export function ordEndring(endring: number): 'nedgang' | 'økning' | 'ingen endring' {
  if (endring < 0) return 'nedgang'
  if (endring > 0) return 'økning'
  return 'ingen endring'
}

/* --- Fortolkningen ------------------------------------------------------- */

/**
 * Mer enn så mange døgn mellom prøvene, og forrige prøve gir ikke lenger
 * sammenligningsgrunnlag — da fortolkes bare den aktuelle prøven, som i
 * regnearkets K21.
 */
export const MAKS_DAGER_MELLOM = 60

export interface ThcInndata {
  kronisk: boolean
  aktuellVerdi: string
  aktuellDato: string
  ingenTidligere: boolean
  forrigeVerdi: string
  forrigeDato: string
  sikkerhetsmargin: Sikkerhetsmargin
}

export const TOM_THC_INNDATA: ThcInndata = {
  kronisk: true,
  aktuellVerdi: '',
  aktuellDato: '',
  ingenTidligere: false,
  forrigeVerdi: '',
  forrigeDato: '',
  sikkerhetsmargin: STANDARD_SIKKERHETSMARGIN,
}

/**
 * Grunnlaget visualiseringen tegnes fra, når fortolkningen bruker forrige
 * prøve. Sikkerhetsmarginen står ikke her: figuren tegner den korrigerte
 * endringen, og trenger ikke vite hvor langt ut i fordelingen den er lest av.
 */
export interface ThcGrafgrunnlag {
  forrige: number
  dager: number
  /** Den korrigerte endringen (D20), som andel: −0,74 = 74 % nedgang. */
  korrigertEndring: number
}

/** Hele tallgrunnlaget for en fortolkning mot forrige prøve, til forklaringen. */
export interface ThcGrunnlag extends ThcGrafgrunnlag {
  aktuell: number
  kronisk: boolean
  /** Marginen den korrigerte endringen er lest av med. */
  sikkerhetsmargin: Sikkerhetsmargin
  /** Den målte endringen før usikkerhetskorreksjon: aktuell/forrige − 1. */
  maltEndring: number
  /** Forventet endring per kurve etter like mange døgn (rad 63). */
  forventet: { gronn: number; gul: number; rod: number }
}

export type ThcResultat =
  | { type: 'mangler'; mangler: string[] }
  | {
      type: 'kommentar'
      kommentar: string
      kategori: number
      /** Satt når fortolkningen er gjort mot forrige prøve. */
      grunnlag: ThcGrunnlag | null
      /** Sant når forrige prøve ble satt til side fordi den er for gammel. */
      forGammelForrige: boolean
    }

/**
 * Validerer inndataene og bygger kommentaren. Følger regnearket også der
 * det overrasker: er det mer enn {@link MAKS_DAGER_MELLOM} døgn mellom
 * prøvene, fortolkes bare den aktuelle prøven, og kommentaren blir den samme
 * som uten en tidligere prøve.
 */
export function fortolkThc(inn: ThcInndata): ThcResultat {
  const mangler: string[] = []

  const aktuell = lesTall(inn.aktuellVerdi)
  if (inn.aktuellVerdi.trim() === '') mangler.push('Fyll inn IRCAK for denne prøven.')
  else if (aktuell === null || !(aktuell > 0)) mangler.push('IRCAK for denne prøven må være et tall større enn 0.')

  let forrige: number | null = null
  if (!inn.ingenTidligere) {
    // Datoene trengs bare for å telle døgn mellom prøvene, så uten en
    // tidligere prøve å sammenligne med er heller ikke denne prøvens dato
    // noe å kreve.
    if (inn.aktuellDato === '') mangler.push('Fyll inn prøvedato for denne prøven.')
    forrige = lesTall(inn.forrigeVerdi)
    if (inn.forrigeVerdi.trim() === '') {
      mangler.push('Fyll inn IRCAK for forrige prøve.')
    } else if (forrige === null || forrige < 0) {
      mangler.push('IRCAK for forrige prøve må være et tall som ikke er negativt.')
    } else if (forrige === 0) {
      mangler.push(
        'Verktøyet kan ikke sammenligne med en forrige prøve der IRCAK er 0. Mangler et brukbart sammenligningsgrunnlag, huk av for «Ingen tidligere prøve tilgjengelig».',
      )
    }
    if (inn.forrigeDato === '') mangler.push('Fyll inn prøvedato for forrige prøve.')
    if (inn.forrigeDato !== '' && inn.aktuellDato !== '' && dagerMellom(inn.forrigeDato, inn.aktuellDato) < 0) {
      mangler.push('Denne prøven kan ikke være tatt før forrige prøve.')
    }
  }

  if (mangler.length > 0) return { type: 'mangler', mangler }

  const niva = konsentrasjonsniva(aktuell as number)

  if (inn.ingenTidligere) {
    const kategori = beregnKategori(false, inn.kronisk)
    return {
      type: 'kommentar',
      kommentar: byggKommentar(niva, kategori, false, ''),
      kategori,
      grunnlag: null,
      forGammelForrige: false,
    }
  }

  const dager = dagerMellom(inn.forrigeDato, inn.aktuellDato)

  // Regnearkets K21: en prøve eldre enn 60 døgn settes til side, og
  // kommentaren blir som om ingen tidligere prøve fantes.
  if (dager > MAKS_DAGER_MELLOM) {
    const kategori = beregnKategori(false, inn.kronisk)
    return {
      type: 'kommentar',
      kommentar: byggKommentar(niva, kategori, false, ''),
      kategori,
      grunnlag: null,
      forGammelForrige: true,
    }
  }

  const korrigert = korrigertEndring(forrige as number, aktuell as number, inn.sikkerhetsmargin)
  const forventet = {
    gronn: forventetEndring(forrige as number, dager, KURVE_GRONN),
    gul: forventetEndring(forrige as number, dager, KURVE_GUL),
    rod: forventetEndring(forrige as number, dager, KURVE_ROD),
  }
  const kategori = beregnKategori(true, inn.kronisk, korrigert, forventet)

  return {
    type: 'kommentar',
    kommentar: byggKommentar(niva, kategori, true, formaterDatoNorsk(inn.forrigeDato)),
    kategori,
    grunnlag: {
      forrige: forrige as number,
      aktuell: aktuell as number,
      dager,
      kronisk: inn.kronisk,
      maltEndring: (aktuell as number) / (forrige as number) - 1,
      korrigertEndring: korrigert,
      sikkerhetsmargin: inn.sikkerhetsmargin,
      forventet,
    },
    forGammelForrige: false,
  }
}

/* --- Oppføringen i søket ------------------------------------------------- */

export const THC_KODE = 'IRCAK'

/**
 * THC-syre som søkbar oppføring i det vanlige analyttsøket. Velges den, går
 * appen til fortolkningsmodulen i stedet for til konsentrasjonsbåndene, så
 * feltene som bare gjelder båndene står tomme.
 */
export const THC_ANALYTT: Analyte = {
  kode: THC_KODE,
  navn: 'THC-syre',
  visningsnavn: 'THC-syre i urin',
  komponenter: [],
  gruppe: 'Rusmiddelanalyse',
  enhet: '',
  referanseomrade: null,
  maleomrade: { tekst: '', deler: [] },
  ringegrense: null,
  nedreGrense: 0,
  ovreGrense: 0,
  nivaer: [],
  aliaser: ['THC-COOH', 'cannabis'],
}

export function erThcAnalytt(analyte: Analyte): boolean {
  return analyte.kode === THC_KODE
}
