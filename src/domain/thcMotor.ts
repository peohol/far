import { forventetEndring } from './thcKurver'
import {
  INGEN_SIKKERHETSMARGIN,
  THC_KURVEROLLER,
  godkjennThcRegelsett,
  kurverI,
  type GodkjentThcRegelsett,
  type ThcKonsentrasjonsniva,
  type ThcKurverolle,
  type ThcRegelsett,
} from './thcRegelsett'
import { godkjennThcTekster, type GodkjenteThcTekster, type ThcTekster, type ThcTekstnokkel } from './thcTekster'
import { beregnIrcak, dagerMellom, formaterDatoNorsk, lesTall } from './thcTall'

/**
 * Fortolkningsmotoren for THC-syre i urin (IRCAK). Verdiene som tastes inn er
 * ferdig kreatininkorrigerte THC-syrekonsentrasjoner fra labsystemet.
 *
 * Endringen fra forrige prøve korrigeres for måleusikkerhet og sammenlignes
 * med tre utskillelseskurver; hvilke kurver den ligger over, avgjør
 * konklusjonen. Uten en tidligere prøve fortolkes bare konsentrasjonen i den
 * aktuelle prøven. Metoden er regnearket `originaldata/THC-COOH.xlsm` sin, med
 * to regler bestilt av eieren siden: en forrige prøve med IRCAK 0, og en
 * forrige prøve fortolket under cut-off (UCAK/NKRE i stedet for IRCAK, med
 * høyere måleusikkerhet og egen ordlyd).
 *
 * Alt som er fagkunnskap kommer utenfra: kurvene, usikkerheten, marginene,
 * nivåene og grensene per bruksmønster fra regelsettet (`thcRegelsett.ts`),
 * og ordlyden fra tekstbolkene (`thcTekster.ts`). Her står bare
 * fremgangsmåten, og hvilke bolker hver konklusjon gir. Regnestykkene er gjort i
 * nøyaktig samme rekkefølge som i den opprinnelige modulen, slik at
 * resultatene er like helt ned til siste siffer; testene mot fasiten
 * (`__tests__/fasit/`) holder det slik.
 */

/* --- Regelsettet og tekstene --------------------------------------------- */

/** Reglene og tekstene fortolkningen bruker, begge kontrollert. */
export interface ThcModell {
  regler: GodkjentThcRegelsett
  tekster: GodkjenteThcTekster
}

/** Kontrollerer reglene og tekstene og setter dem sammen, eller gir feilene. */
export function lagThcModell(
  regler: ThcRegelsett,
  tekster: ThcTekster,
): { ok: true; modell: ThcModell } | { ok: false; feil: string[] } {
  const r = godkjennThcRegelsett(regler)
  const t = godkjennThcTekster(tekster)
  if (r.ok && t.ok) return { ok: true, modell: { regler: r.regelsett, tekster: t.tekster } }
  return { ok: false, feil: [...(r.ok ? [] : r.feil), ...(t.ok ? [] : t.feil)] }
}

/* --- Måleusikkerheten ----------------------------------------------------- */

/** log-standardavviket for forholdet mellom to prøver: √(2·CV²). */
function logSd(r: ThcRegelsett): number {
  const { cv_thc, cv_kreatinin } = r.maleusikkerhet
  const cvTotal = Math.sqrt(cv_thc ** 2 + cv_kreatinin ** 2)
  return Math.sqrt(2 * cvTotal ** 2)
}

/** z-verdien for en margin i regelsettet, eller `undefined` om den ikke finnes. */
function zFor(r: ThcRegelsett, margin: number): number | undefined {
  return r.sikkerhetsmarginer.find((m) => m.margin === margin)?.z
}

/**
 * Faktoren den målte endringen ganges med: `exp(z · logSD · usikkerhet)`.
 * `usikkerhet` er 1 normalt, og regelsettets faktor under cut-off ellers.
 */
export function korreksjonsfaktor(r: ThcRegelsett, margin: number, usikkerhet = 1): number {
  return Math.exp((zFor(r, margin) ?? Number.NaN) * logSd(r) * usikkerhet)
}

/** Målt relativ endring, korrigert for måleusikkerhet. */
export function korrigertEndring(
  r: ThcRegelsett,
  forrige: number,
  aktuell: number,
  margin: number,
  usikkerhet = 1,
): number {
  return (aktuell / forrige) * korreksjonsfaktor(r, margin, usikkerhet) - 1
}

/* --- Nivå og konklusjon --------------------------------------------------- */

/** Nivået den aktuelle prøven ligger på: nedre grense med, øvre ikke. */
export function konsentrasjonsniva(r: ThcRegelsett, aktuell: number): ThcKonsentrasjonsniva {
  let funnet = r.konsentrasjonsnivaer[0]!
  for (const niva of r.konsentrasjonsnivaer) {
    if (niva.nedre !== null && aktuell >= niva.nedre) funnet = niva
  }
  return funnet
}

export type ThcKonklusjon = 'uten_forrige' | 'ikke_nodvendigvis' | 'vanskelig' | 'nytt_inntak'

export type ThcForventet = Record<ThcKurverolle, number>

/**
 * Hvor mange kurver, fra grønn og utover, den korrigerte endringen ligger
 * over uten avbrudd. Grensene sjekkes med strengt større enn, som i
 * regnearket.
 */
export function kurverOver(korrigert: number, forventet: ThcForventet): number {
  let antall = 0
  for (const rolle of THC_KURVEROLLER) {
    if (!(korrigert > forventet[rolle])) break
    antall++
  }
  return antall
}

/** Konklusjonen mot forrige prøve for det valgte bruksmønsteret. */
export function konklusjon(
  r: ThcRegelsett,
  kronisk: boolean,
  korrigert: number,
  forventet: ThcForventet,
): ThcKonklusjon {
  const monster = kronisk ? r.bruksmonstre.kronisk : r.bruksmonstre.ikke_kronisk
  const over = kurverOver(korrigert, forventet)
  if (over > THC_KURVEROLLER.indexOf(monster.nytt_inntak_over)) return 'nytt_inntak'
  if (over > THC_KURVEROLLER.indexOf(monster.vanskelig_over)) return 'vanskelig'
  return 'ikke_nodvendigvis'
}

/* --- Kommentaren ---------------------------------------------------------- */

/**
 * Tekstbolkene kommentaren består av, i rekkefølge. Vilkårene er de samme som
 * i regnearkets tekstformler (J23–J30), med eierens tillegg; hver bolk er
 * beskrevet i `THC_TEKSTBOLKER`.
 */
export function velgTekstbolker(
  niva: ThcKonsentrasjonsniva,
  utfall: ThcKonklusjon,
  underCutoff: boolean,
): ThcTekstnokkel[] {
  const bolker: ThcTekstnokkel[] = ['apning']
  const medForrige = utfall !== 'uten_forrige'
  // Under cut-off erstatter egne bolker konklusjonen mot forrige prøve, så
  // lenge den ikke er et sikkert nytt inntak.
  const underGrensen = underCutoff && medForrige && utfall !== 'nytt_inntak'

  if (niva.nylig_inntak) bolker.push('nylig_inntak')
  if (utfall === 'nytt_inntak') bolker.push('nytt_inntak')
  if (
    !niva.nylig_inntak &&
    (utfall === 'uten_forrige' || utfall === 'ikke_nodvendigvis' || underGrensen)
  ) {
    bolker.push('inntak_har_skjedd')
  }

  if (medForrige && utfall !== 'nytt_inntak') {
    bolker.push('pavisningstid')
    if (underGrensen) {
      bolker.push(utfall === 'vanskelig' ? 'under_cutoff_vanskelig' : 'under_cutoff_ikke_nodvendigvis')
    } else {
      bolker.push(utfall === 'vanskelig' ? 'vanskelig' : 'ikke_nodvendigvis')
    }
  } else if (!medForrige && !niva.nylig_inntak) {
    bolker.push('pavisningstid')
  }

  if (!medForrige) bolker.push('uten_forrige')
  return bolker
}

/** Setter inn plassholderne og binder bolkene sammen med mellomrom. */
export function settSammen(
  tekster: ThcTekster,
  bolker: ThcTekstnokkel[],
  verdier: { niva: string; forrigeDato: string },
): string {
  return bolker
    .map((nokkel) =>
      tekster[nokkel]
        .replaceAll('{nivå}', verdier.niva)
        .replaceAll('{forrige prøvedato}', verdier.forrigeDato),
    )
    .join(' ')
}

/* --- Fortolkningen -------------------------------------------------------- */

export interface ThcInndata {
  kronisk: boolean
  aktuellVerdi: string
  aktuellDato: string
  ingenTidligere: boolean
  /**
   * Sant når forrige prøve fortolkes under cut-off. Da er det ikke IRCAK som
   * tastes, men labsystemets to interne tall — UCAK og NKRE — og IRCAK regnes
   * ut av dem.
   */
  forrigeUnderCutoff: boolean
  forrigeVerdi: string
  forrigeUcak: string
  forrigeNkre: string
  forrigeDato: string
  sikkerhetsmargin: number
}

/** Et tomt skjema, med regelsettets standardmargin. */
export function tomThcInndata(r: ThcRegelsett): ThcInndata {
  return {
    kronisk: true,
    aktuellVerdi: '',
    aktuellDato: '',
    ingenTidligere: false,
    forrigeUnderCutoff: false,
    forrigeVerdi: '',
    forrigeUcak: '',
    forrigeNkre: '',
    forrigeDato: '',
    sikkerhetsmargin: r.standard_sikkerhetsmargin,
  }
}

/**
 * Grunnlaget visualiseringen tegnes fra, når fortolkningen bruker forrige
 * prøve.
 */
export interface ThcGrafgrunnlag {
  forrige: number
  dager: number
  /** Den korrigerte endringen, som andel: −0,74 = 74 % nedgang. */
  korrigertEndring: number
}

/** Hele tallgrunnlaget for en fortolkning mot forrige prøve. */
export interface ThcGrunnlag extends ThcGrafgrunnlag {
  aktuell: number
  kronisk: boolean
  sikkerhetsmargin: number
  /** Sant når forrige prøve er fortolket under cut-off (IRCAK = UCAK/NKRE). */
  underCutoff: boolean
  /** Den målte endringen før usikkerhetskorreksjon: aktuell/forrige − 1. */
  maltEndring: number
  /** Forventet endring per kurve etter like mange døgn. */
  forventet: ThcForventet
}

export type ThcResultat =
  | { type: 'mangler'; mangler: string[] }
  | {
      type: 'kommentar'
      kommentar: string
      konklusjon: ThcKonklusjon
      /** Nivået den aktuelle prøven ligger på. */
      niva: ThcKonsentrasjonsniva
      /** Tekstbolkene kommentaren ble satt sammen av, i rekkefølge. */
      bolker: ThcTekstnokkel[]
      /** Satt når fortolkningen er gjort mot forrige prøve med IRCAK over 0. */
      grunnlag: ThcGrunnlag | null
      /**
       * Sant når det er mer enn regelsettets varselgrense i døgn mellom
       * prøvene. Fortolkningen skjer som normalt; dette er bare et varsel.
       */
      langtMellomProvene: boolean
    }

/**
 * Validerer inndataene og bygger kommentaren. Forrige prøve brukes i
 * sammenligningen uansett hvor lang tid det har gått siden den.
 */
export function fortolkThc(inn: ThcInndata, { regler: r, tekster }: ThcModell): ThcResultat {
  const mangler: string[] = []

  const aktuell = lesTall(inn.aktuellVerdi)
  if (inn.aktuellVerdi.trim() === '') mangler.push('Fyll inn IRCAK for denne prøven.')
  else if (aktuell === null || !(aktuell > 0)) mangler.push('IRCAK for denne prøven må være et tall større enn 0.')

  // Avkryssingen står inne i «Forrige prøve», så den betyr ingenting når det
  // ikke finnes en forrige prøve å fortolke.
  const underCutoff = !inn.ingenTidligere && inn.forrigeUnderCutoff

  let forrige: number | null = null
  if (!inn.ingenTidligere) {
    if (inn.aktuellDato === '') mangler.push('Fyll inn prøvedato for denne prøven.')

    if (underCutoff) {
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

  const aktuellIrcak = aktuell as number
  const niva = konsentrasjonsniva(r, aktuellIrcak)
  const resultat = (utfall: ThcKonklusjon, forrigeDato: string, grunnlag: ThcGrunnlag | null, langt: boolean) => {
    const bolker = velgTekstbolker(niva, utfall, underCutoff)
    return {
      type: 'kommentar' as const,
      kommentar: settSammen(tekster, bolker, { niva: niva.navn, forrigeDato }),
      konklusjon: utfall,
      niva,
      bolker,
      grunnlag,
      langtMellomProvene: langt,
    }
  }

  if (inn.ingenTidligere) return resultat('uten_forrige', '', null, false)

  const dager = dagerMellom(inn.forrigeDato, inn.aktuellDato)
  const langt = dager > r.varsel_dager_mellom
  const forrigeDato = formaterDatoNorsk(inn.forrigeDato)
  const forrigeIrcak = forrige as number

  // Ingen THC-syre i forrige prøve: da finnes det ingen utskillelse å regne
  // på — enhver konsentrasjon nå må komme av et inntak etter den prøven.
  // Figuren og forklaringen har ingen prosentvis endring fra 0 å vise.
  if (forrigeIrcak === 0) return resultat('nytt_inntak', forrigeDato, null, langt)

  const usikkerhet = underCutoff ? r.maleusikkerhet.faktor_under_cutoff : 1
  const korrigert = korrigertEndring(r, forrigeIrcak, aktuellIrcak, inn.sikkerhetsmargin, usikkerhet)
  const kurver = kurverI(r)
  const forventet: ThcForventet = {
    gronn: forventetEndring(forrigeIrcak, dager, kurver.gronn),
    gul: forventetEndring(forrigeIrcak, dager, kurver.gul),
    rod: forventetEndring(forrigeIrcak, dager, kurver.rod),
  }

  return resultat(
    konklusjon(r, inn.kronisk, korrigert, forventet),
    forrigeDato,
    {
      forrige: forrigeIrcak,
      aktuell: aktuellIrcak,
      dager,
      kronisk: inn.kronisk,
      maltEndring: aktuellIrcak / forrigeIrcak - 1,
      korrigertEndring: korrigert,
      sikkerhetsmargin: inn.sikkerhetsmargin,
      underCutoff,
      forventet,
    },
    langt,
  )
}

/** Sant når marginen er den uten korreksjon — medianen er den målte verdien. */
export function erUtenMargin(margin: number): boolean {
  return margin === INGEN_SIKKERHETSMARGIN
}
