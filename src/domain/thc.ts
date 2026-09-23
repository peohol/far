import type { Analyte } from '../types'
import { beregnIrcak, dagerMellom, formaterDatoNorsk, lesTall } from './thcTall'

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
 *
 * To regler er kommet til etter regnearket, begge bestilt av eieren, og begge
 * om en forrige prøve der THC-syre ble rapportert som «ikke påvist»:
 *
 * - Er IRCAK i forrige prøve 0, må enhver påvisning i denne prøven komme av
 *   et inntak etter den prøven, og kommentaren sier det.
 * - Var urinen så fortynnet at THC-syre havnet under påvisningsgrensen, kan
 *   labsystemets interne tall likevel vise THC-syre i prøven. De to tallene
 *   tastes da i stedet for IRCAK, og IRCAK regnes ut som UCAK/NKRE. En slik
 *   fortolkning bygger på et tall labsystemet ikke svarer ut, så
 *   måleusikkerheten legges høyere til grunn ({@link USIKKERHET_UNDER_CUTOFF}),
 *   og konklusjonen mot forrige prøve får sin egen ordlyd.
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

/**
 * Måleusikkerheten legges 50 % høyere til grunn når forrige prøve fortolkes
 * under påvisningsgrensen: tallet labsystemet har internt er ikke
 * kvalitetssikret på samme måte som et svar over grensen, og en fortolkning
 * som bygger på det skal være mer forsiktig. Faktoren ganges inn i
 * log-standardavviket, altså i spredningen selve korreksjonen leses av i.
 */
export const USIKKERHET_UNDER_CUTOFF = 1.5

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
 *
 * `usikkerhet` skalerer log-standardavviket — 1 er den vanlige
 * måleusikkerheten, {@link USIKKERHET_UNDER_CUTOFF} den forhøyede. Uten
 * margin er faktoren 1 uansett: medianen i fordelingen flytter seg ikke av at
 * spredningen blir større.
 */
export function korreksjonsfaktor(margin: Sikkerhetsmargin, usikkerhet = 1): number {
  return Math.exp(Z_KVANTIL[margin] * LOG_SD * usikkerhet)
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
  usikkerhet = 1,
): number {
  return (aktuell / forrige) * korreksjonsfaktor(margin, usikkerhet) - 1
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
 * Øverste trinn i regnearkets kategori: endringen ligger over alle kurvene,
 * og kommentaren konkluderer med at cannabis har vært inntatt etter forrige
 * prøve.
 */
export const KATEGORI_NYTT_INNTAK = 4

/** Trinnet som legges på når kronisk bruk ikke legges til grunn (B65). */
function utenKronisk(kronisk: boolean): number {
  return kronisk ? 0 : 1
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
    else base = KATEGORI_NYTT_INNTAK
  }
  return base + utenKronisk(kronisk)
}

/* --- Kommentaren --------------------------------------------------------
   Ordlyden under er hentet tegn for tegn fra regnearkets tekstformler
   (Innstillinger og beregninger!J23–J30) og brukes i rettsmedisinske
   svarbrev. Den skal ikke endres uten at eieren av appen uttrykkelig har
   bedt om det og bekreftet den nye ordlyden. Ett bevisst avvik er bestilt
   av eieren: «5-7 dager» skrives med tankestrek, «5–7 dager».

   De to konklusjonene som brukes under påvisningsgrensen finnes ikke i
   regnearket. De er eierens egen ordlyd, bestilt til denne funksjonen, og
   gjelder på samme vilkår som resten. */

/**
 * Konklusjonen når forrige prøve er fortolket under påvisningsgrensen og
 * endringen ikke gir holdepunkter for et nytt inntak. Erstatter J28: at
 * forrige prøve ble rapportert som «ikke påvist» er nettopp det som må
 * forklares, siden den likevel inneholdt THC-syre.
 */
function underCutoffIkkeNodvendigvis(forrigeDatoNorsk: string): string {
  return (
    `Analyseresultatet tilsier at cannabis ikke nødvendigvis har vært inntatt etter prøve tatt ${forrigeDatoNorsk}, ` +
    `selv om prøven tatt ${forrigeDatoNorsk} ble rapportert som «ikke påvist». Ved lave THC-syrekonsentrasjoner ` +
    'og varierende kreatininresultater kan nivået svinge over og under påvisningsgrensen, uten at nytt inntak ' +
    'nødvendigvis har funnet sted. Ved spørsmål kan rekvirent kontakte vakthavende lege ved Seksjon for klinisk ' +
    'farmakologi Ullevål (se ous.labfag.no).'
  )
}

/**
 * Konklusjonen når forrige prøve er fortolket under påvisningsgrensen og
 * endringen ligger mellom kurvene. Erstatter J28: sammenligningen mot forrige
 * prøve er da ikke bare vanskelig å avgjøre, den lar seg ikke gjøre, og
 * kommentaren sier hvorfor i stedet for å peke på en dato.
 */
const UNDER_CUTOFF_VANSKELIG =
  'Ved lave THC-syrekonsentrasjoner og varierende kreatininresultater kan nivået svinge over og under ' +
  'påvisningsgrensen. Vurdering i forhold til andre prøver kan derfor være vanskelig, og inntakstidspunktet ' +
  'kan ikke avgjøres. Ved spørsmål kan rekvirent kontakte vakthavende lege ved Seksjon for klinisk farmakologi ' +
  'Ullevål (se ous.labfag.no).'

/** J27 — generelt om hvor lenge THC-syre kan påvises. */
const PAVISNINGSTID =
  'Etter et enkeltinntak vil THC-syre kunne påvises i urin i cirka 5–7 dager. Ved gjentatte inntak vil ' +
  'påvisningstiden for THC-syre i urin øke, vanligvis opptil en måned etter avsluttet inntak. '

export function byggKommentar(
  niva: Konsentrasjonsniva,
  kategori: number,
  medForrige: boolean,
  forrigeDatoNorsk: string,
  underCutoff = false,
): string {
  const deler: string[] = []

  /** Sant der de to bestilte tekstene over erstatter regnearkets J28. */
  const underGrensen = underCutoff && medForrige && kategori < KATEGORI_NYTT_INNTAK

  // J23 — åpningen, alltid med.
  deler.push(`THC-syre, et omdannelsesprodukt av cannabis, er påvist i ${niva} konsentrasjon. `)

  // J24 — bare ved høy konsentrasjon.
  if (niva === 'høy') {
    deler.push('Slike konsentrasjoner ses gjerne ved prøvetaking kort tid etter inntak av cannabis. ')
  }

  // J25 — endringen er over selv den strengeste kurven.
  if (kategori >= KATEGORI_NYTT_INNTAK) {
    deler.push(`Analyseresultatet tilsier at cannabis har vært inntatt etter prøve tatt ${forrigeDatoNorsk}.`)
  }

  // J26 — påvist uten holdepunkter for nytt inntak: inntak har uansett skjedd.
  // Under påvisningsgrensen står setningen i begge de to kommentarene som
  // ikke konkluderer med nytt inntak: der er det bare tidspunktet som er
  // usikkert, ikke om cannabis har vært inntatt.
  if (niva !== 'høy' && (kategori < 3 || underGrensen)) {
    deler.push('Analyseresultatet viser at cannabis har vært inntatt. ')
  }

  if (medForrige && kategori < KATEGORI_NYTT_INNTAK) {
    // J27 — generelt om påvisningstid.
    deler.push(PAVISNINGSTID)
    if (underGrensen) {
      deler.push(
        kategori === 3 ? UNDER_CUTOFF_VANSKELIG : underCutoffIkkeNodvendigvis(forrigeDatoNorsk),
      )
    } else {
      // J28 — konklusjonen mot forrige prøve.
      const lede =
        kategori === 3
          ? 'Basert på analyseresultatet alene er det vanskelig å avgjøre hvorvidt cannabis har vært inntatt etter prøve tatt '
          : 'Analyseresultatet tilsier at cannabis ikke nødvendigvis har vært inntatt etter prøve tatt '
      deler.push(
        `${lede}${forrigeDatoNorsk}. Ved spørsmål kan rekvirent kontakte vakthavende lege ved Seksjon for klinisk farmakologi Ullevål (se ous.labfag.no).`,
      )
    }
  } else if (!medForrige && niva !== 'høy') {
    // Uten en forrige prøve å sammenligne med er det ingen konklusjon å
    // knytte påvisningstiden til (J28 over), men opplysningen om hvor lenge
    // THC-syre kan påvises er like relevant her — bestilt av eieren som et
    // tillegg til J26.
    deler.push(PAVISNINGSTID)
  }

  // J29 — uten sammenligningsgrunnlag.
  if (!medForrige) {
    deler.push('Oppfølging med flere prøver anbefales.')
  }

  return deler.join('')
}

/* --- Datoer og tall ------------------------------------------------------ */

export { beregnIrcak, dagerMellom, formaterDatoNorsk, formaterIrcak, formaterTall, lesTall, ordEndring } from './thcTall'

/* --- Fortolkningen ------------------------------------------------------- */

/**
 * Mer enn så mange døgn mellom prøvene, og fortolkningen skjer likevel som
 * normalt — men brukeren varsles, siden lang tid mellom prøvene gjør
 * sammenligningen mindre treffsikker. Eierens egen grense, ikke hentet fra
 * regnearket.
 */
export const VARSEL_DAGER_MELLOM = 30

export interface ThcInndata {
  kronisk: boolean
  aktuellVerdi: string
  aktuellDato: string
  ingenTidligere: boolean
  /**
   * Sant når forrige prøve fortolkes under påvisningsgrensen. Da er det ikke
   * IRCAK som tastes, men labsystemets to interne tall — {@link forrigeUcak}
   * og {@link forrigeNkre} — og IRCAK regnes ut av dem.
   */
  forrigeUnderCutoff: boolean
  forrigeVerdi: string
  /** THC-syre i forrige prøve (UCAK), brukt under påvisningsgrensen. */
  forrigeUcak: string
  /** Kreatinin i forrige prøve (NKRE), brukt under påvisningsgrensen. */
  forrigeNkre: string
  forrigeDato: string
  sikkerhetsmargin: Sikkerhetsmargin
}

export const TOM_THC_INNDATA: ThcInndata = {
  kronisk: true,
  aktuellVerdi: '',
  aktuellDato: '',
  ingenTidligere: false,
  forrigeUnderCutoff: false,
  forrigeVerdi: '',
  forrigeUcak: '',
  forrigeNkre: '',
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
  /**
   * Sant når forrige prøve er fortolket under påvisningsgrensen: IRCAK er da
   * regnet ut av UCAK og NKRE, og måleusikkerheten er lagt
   * {@link USIKKERHET_UNDER_CUTOFF} ganger høyere til grunn.
   */
  underCutoff: boolean
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
      /**
       * Sant når det er mer enn {@link VARSEL_DAGER_MELLOM} døgn mellom
       * prøvene. Fortolkningen skjer som normalt likevel — feltet er bare et
       * varsel til brukeren om at avstanden er stor.
       */
      merEnn30Dager: boolean
    }

/**
 * Validerer inndataene og bygger kommentaren. Forrige prøve brukes i
 * sammenligningen uansett hvor lang tid det har gått siden den — appen har
 * ingen øvre grense for det, i motsetning til regnearkets K21.
 */
export function fortolkThc(inn: ThcInndata): ThcResultat {
  const mangler: string[] = []

  const aktuell = lesTall(inn.aktuellVerdi)
  if (inn.aktuellVerdi.trim() === '') mangler.push('Fyll inn IRCAK for denne prøven.')
  else if (aktuell === null || !(aktuell > 0)) mangler.push('IRCAK for denne prøven må være et tall større enn 0.')

  // Avkryssingen står inne i «Forrige prøve», så den betyr ingenting når det
  // ikke finnes en forrige prøve å fortolke.
  const underCutoff = !inn.ingenTidligere && inn.forrigeUnderCutoff

  let forrige: number | null = null
  if (!inn.ingenTidligere) {
    // Datoene trengs bare for å telle døgn mellom prøvene, så uten en
    // tidligere prøve å sammenligne med er heller ikke denne prøvens dato
    // noe å kreve.
    if (inn.aktuellDato === '') mangler.push('Fyll inn prøvedato for denne prøven.')

    if (underCutoff) {
      // Under påvisningsgrensen er det labsystemets to interne tall som
      // tastes, og IRCAK regnes ut av dem.
      const thcSyre = lesTall(inn.forrigeUcak)
      const kreatinin = lesTall(inn.forrigeNkre)
      if (inn.forrigeUcak.trim() === '') {
        mangler.push('Fyll inn UCAK (THC-syre) for forrige prøve.')
      } else if (thcSyre === null || thcSyre < 0) {
        mangler.push('UCAK (THC-syre) for forrige prøve må være et tall som ikke er negativt.')
      }
      if (inn.forrigeNkre.trim() === '') {
        mangler.push('Fyll inn NKRE (kreatinin) for forrige prøve.')
      } else if (kreatinin === null || !(kreatinin > 0)) {
        mangler.push('NKRE (kreatinin) for forrige prøve må være et tall større enn 0.')
      }
      forrige = beregnIrcak(inn.forrigeUcak, inn.forrigeNkre)
    } else {
      forrige = lesTall(inn.forrigeVerdi)
      if (inn.forrigeVerdi.trim() === '') {
        mangler.push('Fyll inn IRCAK for forrige prøve.')
      } else if (forrige === null || forrige < 0) {
        mangler.push('IRCAK for forrige prøve må være et tall som ikke er negativt.')
      }
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
      merEnn30Dager: false,
    }
  }

  const dager = dagerMellom(inn.forrigeDato, inn.aktuellDato)
  const merEnn30Dager = dager > VARSEL_DAGER_MELLOM

  const forrigeIrcak = forrige as number

  // Ingen THC-syre i forrige prøve: da finnes det ingen utskillelse å regne
  // på — enhver konsentrasjon nå må komme av et inntak etter den prøven, og
  // kategorien settes rett i toppen. Figuren og forklaringen tegner
  // prosentvis endring fra forrige prøve, og har ingenting å vise når den er
  // 0, så de får ikke noe grunnlag.
  if (forrigeIrcak === 0) {
    const kategori = KATEGORI_NYTT_INNTAK + utenKronisk(inn.kronisk)
    return {
      type: 'kommentar',
      kommentar: byggKommentar(
        niva,
        kategori,
        true,
        formaterDatoNorsk(inn.forrigeDato),
        underCutoff,
      ),
      kategori,
      grunnlag: null,
      merEnn30Dager,
    }
  }

  const usikkerhet = underCutoff ? USIKKERHET_UNDER_CUTOFF : 1
  const korrigert = korrigertEndring(forrigeIrcak, aktuell as number, inn.sikkerhetsmargin, usikkerhet)
  const forventet = {
    gronn: forventetEndring(forrigeIrcak, dager, KURVE_GRONN),
    gul: forventetEndring(forrigeIrcak, dager, KURVE_GUL),
    rod: forventetEndring(forrigeIrcak, dager, KURVE_ROD),
  }
  const kategori = beregnKategori(true, inn.kronisk, korrigert, forventet)

  return {
    type: 'kommentar',
    kommentar: byggKommentar(niva, kategori, true, formaterDatoNorsk(inn.forrigeDato), underCutoff),
    kategori,
    grunnlag: {
      forrige: forrigeIrcak,
      aktuell: aktuell as number,
      dager,
      kronisk: inn.kronisk,
      maltEndring: (aktuell as number) / forrigeIrcak - 1,
      korrigertEndring: korrigert,
      sikkerhetsmargin: inn.sikkerhetsmargin,
      underCutoff,
      forventet,
    },
    merEnn30Dager,
  }
}

/* --- Oppføringen i søket ------------------------------------------------- */

export const THC_KODE = 'IRCAK'

/**
 * Analysemetoden IRCAK rekvireres under. Modulen er hele metoden: IRCAK er
 * den eneste analytten i den, og den har ingen underkategorier.
 */
export const THC_ANALYSEMETODE = 'UCAK'

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
  analysemetode: THC_ANALYSEMETODE,
  kategori: '',
  enhet: '',
  referanseomrade: null,
  maleomrade: { tekst: '', deler: [] },
  aliaser: ['THC-COOH', 'cannabis'],
}

export function erThcAnalytt(analyte: Analyte): boolean {
  return analyte.kode === THC_KODE
}
