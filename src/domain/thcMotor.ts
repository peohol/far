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
import {
  godkjennThcTekster,
  kommentardeler,
  kommentarnokkel,
  settSammen,
  type GodkjenteThcTekster,
  type ThcKommentarnokkel,
  type ThcPlassholderverdier,
  type ThcTekster,
  type ThcTekstnokkel,
} from './thcTekster'
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
 * fremgangsmåten, og hvilken kommentar hver konklusjon gir. Regnestykkene er gjort i
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

/**
 * Reglene fortolkningen bruker, slik appen har dem: på vei, ikke mulige å
 * hente eller bruke, eller klare. Fortolkningen gir en kommentar bare når de
 * er klare.
 */
export type ThcRegler =
  | { status: 'laster' }
  | { status: 'feil'; melding: string; provIgjen: () => void }
  | { status: 'klar'; modell: ThcModell }

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
  const z = zFor(r, margin)
  // En ukjent margin ville gitt NaN, og NaN ligger aldri over noen kurve —
  // det ville blitt en stille konklusjon. `fortolkThc` avviser den før dette.
  if (z === undefined) throw new Error(`Sikkerhetsmarginen ${margin} finnes ikke i regelsettet.`)
  return Math.exp(z * logSd(r) * usikkerhet)
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

/** Konklusjonene, fra uten sammenligning til sikkert nytt inntak. */
export const THC_KONKLUSJONER = ['uten_forrige', 'ikke_nodvendigvis', 'vanskelig', 'nytt_inntak'] as const
export type ThcKonklusjon = (typeof THC_KONKLUSJONER)[number]

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

/** To prøver med IRCAK over 0 og hvordan de skal sammenlignes. */
export interface ThcSammenligning {
  forrige: number
  aktuell: number
  dager: number
  kronisk: boolean
  margin: number
  /** 1 normalt, og regelsettets faktor når forrige prøve fortolkes under cut-off. */
  usikkerhet: number
}

/**
 * Sammenligningen med forrige prøve: den korrigerte endringen, hva kurvene
 * venter etter like mange døgn, og konklusjonen. Fortolkningen bruker den, og
 * eksempelet i forklaringen av sikkerhetsmarginen.
 */
export function sammenlignMedForrige(
  r: ThcRegelsett,
  { forrige, aktuell, dager, kronisk, margin, usikkerhet }: ThcSammenligning,
): { korrigert: number; forventet: ThcForventet; utfall: ThcKonklusjon } {
  const korrigert = korrigertEndring(r, forrige, aktuell, margin, usikkerhet)
  const kurver = kurverI(r)
  const forventet: ThcForventet = {
    gronn: forventetEndring(forrige, dager, kurver.gronn),
    gul: forventetEndring(forrige, dager, kurver.gul),
    rod: forventetEndring(forrige, dager, kurver.rod),
  }
  return { korrigert, forventet, utfall: konklusjon(r, kronisk, korrigert, forventet) }
}

/* --- Kommentaren ---------------------------------------------------------- */

/** Det utover konklusjonen som avgjør hvilken kommentar som brukes. */
export interface ThcKommentarvalg {
  /** Forrige prøve er fortolket under cut-off. */
  underCutoff: boolean
  /** En enda tidligere prøve gir nytt inntak i den samlede vurderingen. */
  samlet: boolean
  /** Prøvene er tatt med kort tid imellom og vurderes ikke mot hverandre. */
  kortTid: boolean
}

/**
 * Kommentaren konklusjonen gir. Under cut-off har «ikke nødvendigvis» sin
 * egen kommentar; «kan ikke fastslås» erstattes av den samlede vurderingen
 * når en enda tidligere prøve gir nytt inntak; og kort tid mellom prøvene
 * gir sin egen. Ellers er det situasjonen selv, med egen kommentar for
 * nivåene som tyder på nylig inntak. Hver kommentar er beskrevet i
 * `THC_SITUASJONSINFO`.
 */
export function velgKommentar(
  niva: ThcKonsentrasjonsniva,
  utfall: ThcKonklusjon,
  { underCutoff, samlet, kortTid }: ThcKommentarvalg,
): ThcKommentarnokkel {
  if (kortTid) return 'kort_tid'
  if (utfall === 'vanskelig' && samlet) return 'samlet_vurdering'
  if (utfall === 'ikke_nodvendigvis' && underCutoff) return 'under_cutoff_ikke_nodvendigvis'
  return kommentarnokkel(utfall, niva.nylig_inntak)
}

/** Den ferdige kommentaren for nøkkelen, med plassholderne fylt inn. */
export function byggKommentar(
  { regler, tekster }: ThcModell,
  nokkel: ThcKommentarnokkel,
  verdier: ThcPlassholderverdier,
): { kommentar: string; deler: ThcTekstnokkel[] } {
  const deler = kommentardeler(regler.med_sporsmalsetning, nokkel)
  return { kommentar: settSammen(tekster, deler, verdier), deler }
}

/* --- Fortolkningen -------------------------------------------------------- */

/**
 * En prøve slik den tastes: IRCAK, eller — når den ble fortolket under
 * cut-off — labsystemets to interne tall, UCAK og NKRE, som IRCAK regnes ut
 * av. Og prøvedatoen.
 */
export interface ThcProve {
  underCutoff: boolean
  verdi: string
  ucak: string
  nkre: string
  dato: string
}

export function tomThcProve(): ThcProve {
  return { underCutoff: false, verdi: '', ucak: '', nkre: '', dato: '' }
}

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
  /**
   * Prøvene er tatt med så kort tid imellom at de ikke skal vurderes mot
   * hverandre. Gjelder bare når de faktisk er det ({@link kortTidMellomProvene}).
   */
  kortTid?: boolean
  /** Vurder også mot prøvene i {@link tidligere} når konklusjonen er «kan ikke fastslås». */
  samletVurdering?: boolean
  /** Prøvene før forrige prøve, til den samlede vurderingen. */
  tidligere?: ThcProve[]
}

/** Feltene i skjemaet forrige prøve står i. */
export const FORRIGE_PROVEFELT = {
  underCutoff: 'forrigeUnderCutoff',
  verdi: 'forrigeVerdi',
  ucak: 'forrigeUcak',
  nkre: 'forrigeNkre',
  dato: 'forrigeDato',
} as const satisfies Record<keyof ThcProve, keyof ThcInndata>

/** Forrige prøve, på samme form som de tidligere. */
export function forrigeProve(inn: ThcInndata): ThcProve {
  return {
    underCutoff: inn.forrigeUnderCutoff,
    verdi: inn.forrigeVerdi,
    ucak: inn.forrigeUcak,
    nkre: inn.forrigeNkre,
    dato: inn.forrigeDato,
  }
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
    kortTid: false,
    samletVurdering: false,
    tidligere: [],
  }
}

/**
 * Døgnene mellom forrige prøve og denne, når begge datoene er fylt inn og
 * står i riktig rekkefølge.
 */
function dagerMellomProvene(inn: ThcInndata): number | null {
  if (inn.ingenTidligere || inn.forrigeDato === '' || inn.aktuellDato === '') return null
  const dager = dagerMellom(inn.forrigeDato, inn.aktuellDato)
  return Number.isFinite(dager) && dager >= 0 ? dager : null
}

/**
 * Sant når prøvene er tatt samme dag eller med færre døgn imellom enn
 * regelsettets grense. Da viser skjemaet banneret og valget om ikke å vurdere
 * prøvene mot hverandre.
 */
export function kortTidMellomProvene(r: ThcRegelsett, inn: ThcInndata): boolean {
  const dager = dagerMellomProvene(inn)
  return dager !== null && dager < r.kort_tid_dager
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

/** Den tidligere prøven den samlede vurderingen fant nytt inntak etter. */
export interface ThcSamletVurdering {
  /** Datoen slik kommentaren skriver den. */
  dato: string
  /** IRCAK i den tidligere prøven. */
  ircak: number
  dager: number
}

export type ThcResultat =
  | { type: 'mangler'; mangler: string[] }
  | {
      type: 'kommentar'
      kommentar: string
      /**
       * Konklusjonen mot forrige prøve. `uten_forrige` også når prøvene ikke
       * vurderes mot hverandre fordi det er kort tid mellom dem.
       */
      konklusjon: ThcKonklusjon
      /** Nivået den aktuelle prøven ligger på. */
      niva: ThcKonsentrasjonsniva
      /** Kommentaren som ble brukt. */
      kommentarnokkel: ThcKommentarnokkel
      /** Tekstene kommentaren ble satt sammen av, i rekkefølge. */
      bolker: ThcTekstnokkel[]
      /** Satt når fortolkningen er gjort mot forrige prøve med IRCAK over 0. */
      grunnlag: ThcGrunnlag | null
      /** Satt når den samlede vurderingen fant nytt inntak etter en enda tidligere prøve. */
      samlet: ThcSamletVurdering | null
      /**
       * Sant når det er mer enn regelsettets varselgrense i døgn mellom
       * prøvene. Fortolkningen skjer som normalt; dette er bare et varsel.
       */
      langtMellomProvene: boolean
    }

/**
 * Leser IRCAK i en prøve og legger det som mangler til `mangler`, med
 * prøvens navn: «forrige prøve», «tidligere prøve 1». IRCAK er `null` når det
 * mangler noe.
 */
function lesProve(prove: ThcProve, navn: string, mangler: string[]): number | null {
  let ircak: number | null
  if (prove.underCutoff) {
    const thcSyre = lesTall(prove.ucak)
    const kreatinin = lesTall(prove.nkre)
    if (prove.ucak.trim() === '') {
      mangler.push(`Fyll inn UCAK (THC-syre) for ${navn}.`)
    } else if (thcSyre === null || thcSyre < 0) {
      mangler.push(`UCAK (THC-syre) for ${navn} må være et tall som ikke er negativt.`)
    }
    if (prove.nkre.trim() === '') {
      mangler.push(`Fyll inn NKRE (kreatinin) for ${navn}.`)
    } else if (kreatinin === null || !(kreatinin > 0)) {
      mangler.push(`NKRE (kreatinin) for ${navn} må være et tall større enn 0.`)
    }
    ircak = beregnIrcak(prove.ucak, prove.nkre)
  } else {
    ircak = lesTall(prove.verdi)
    if (prove.verdi.trim() === '') {
      mangler.push(`Fyll inn IRCAK for ${navn}.`)
    } else if (ircak === null || ircak < 0) {
      mangler.push(`IRCAK for ${navn} må være et tall som ikke er negativt.`)
    }
  }
  if (prove.dato === '') mangler.push(`Fyll inn prøvedato for ${navn}.`)
  return ircak
}

/** Navnet en tidligere prøve har i meldingene: «den tidligere prøven», eller nummeret når det er flere. */
function tidligereNavn(antall: number, i: number): string {
  return antall === 1 ? 'den tidligere prøven' : `tidligere prøve ${i + 1}`
}

/**
 * Validerer inndataene og bygger kommentaren. Forrige prøve brukes i
 * sammenligningen uansett hvor lang tid det har gått siden den.
 */
export function fortolkThc(inn: ThcInndata, modell: ThcModell): ThcResultat {
  const { regler: r } = modell
  const mangler: string[] = []

  const aktuell = lesTall(inn.aktuellVerdi)
  if (inn.aktuellVerdi.trim() === '') mangler.push('Fyll inn IRCAK for denne prøven.')
  else if (aktuell === null || !(aktuell > 0)) mangler.push('IRCAK for denne prøven må være et tall større enn 0.')

  // Avkryssingen står inne i «Forrige prøve», så den betyr ingenting når det
  // ikke finnes en forrige prøve å fortolke.
  const underCutoff = !inn.ingenTidligere && inn.forrigeUnderCutoff
  // Kort tid mellom prøvene gjelder bare så lenge datoene sier det; da
  // trengs ikke tallene for forrige prøve, siden prøvene ikke sammenlignes.
  const kortTid = inn.kortTid === true && kortTidMellomProvene(r, inn)
  // Den samlede vurderingen gjelder bare når prøvene sammenlignes.
  const tidligere = !inn.ingenTidligere && !kortTid && inn.samletVurdering ? (inn.tidligere ?? []) : []

  let forrige: number | null = null
  const tidligereIrcak: (number | null)[] = []
  if (!inn.ingenTidligere) {
    if (inn.aktuellDato === '') mangler.push('Fyll inn prøvedato for denne prøven.')

    if (!kortTid) forrige = lesProve(forrigeProve(inn), 'forrige prøve', mangler)

    if (inn.forrigeDato !== '' && inn.aktuellDato !== '' && dagerMellom(inn.forrigeDato, inn.aktuellDato) < 0) {
      mangler.push('Denne prøven kan ikke være tatt før forrige prøve.')
    }

    if (!kortTid && inn.samletVurdering && tidligere.length === 0) {
      mangler.push('Legg til en tidligere prøve, eller slå av den samlede vurderingen.')
    }
    tidligere.forEach((prove, i) => {
      const navn = tidligereNavn(tidligere.length, i)
      tidligereIrcak.push(lesProve(prove, navn, mangler))
      if (prove.dato !== '' && inn.forrigeDato !== '' && dagerMellom(prove.dato, inn.forrigeDato) < 0) {
        const stor = navn.charAt(0).toUpperCase() + navn.slice(1)
        mangler.push(`${stor} kan ikke være tatt etter forrige prøve.`)
      }
    })
  }

  // Marginen kommer fra skjemaet, som kan leve lenger enn regelsettet det ble
  // fylt ut mot. En margin regelsettet ikke har, gir aldri en konklusjon.
  if (zFor(r, inn.sikkerhetsmargin) === undefined) {
    mangler.push('Sikkerhetsmarginen finnes ikke i regelsettet. Velg en av marginene som tilbys.')
  }

  if (mangler.length > 0) return { type: 'mangler', mangler }

  const aktuellIrcak = aktuell as number
  const niva = konsentrasjonsniva(r, aktuellIrcak)
  const resultat = (
    utfall: ThcKonklusjon,
    forrigeDato: string,
    grunnlag: ThcGrunnlag | null,
    langt: boolean,
    { samlet = null, kortTid = false }: { samlet?: ThcSamletVurdering | null; kortTid?: boolean } = {},
  ) => {
    const kommentarnokkel = velgKommentar(niva, utfall, { underCutoff, samlet: samlet !== null, kortTid })
    const { kommentar, deler } = byggKommentar(modell, kommentarnokkel, {
      niva: niva.navn,
      forrigeDato,
      tidligereDato: samlet?.dato ?? '',
    })
    return {
      type: 'kommentar' as const,
      kommentar,
      konklusjon: utfall,
      niva,
      kommentarnokkel,
      bolker: deler,
      grunnlag,
      samlet,
      langtMellomProvene: langt,
    }
  }

  if (inn.ingenTidligere) return resultat('uten_forrige', '', null, false)

  const dager = dagerMellom(inn.forrigeDato, inn.aktuellDato)
  const forrigeDato = formaterDatoNorsk(inn.forrigeDato)

  // Prøvene vurderes ikke mot hverandre; varselet om lang tid gjelder ikke.
  if (kortTid) return resultat('uten_forrige', forrigeDato, null, false, { kortTid: true })

  const langt = dager > r.varsel_dager_mellom
  const forrigeIrcak = forrige as number

  // Ingen THC-syre i forrige prøve: da finnes det ingen utskillelse å regne
  // på — enhver konsentrasjon nå må komme av et inntak etter den prøven.
  // Figuren og forklaringen har ingen prosentvis endring fra 0 å vise.
  if (forrigeIrcak === 0) return resultat('nytt_inntak', forrigeDato, null, langt)

  const sammenlign = (fra: number, dagerFra: number, fraUnderCutoff: boolean) =>
    sammenlignMedForrige(r, {
      forrige: fra,
      aktuell: aktuellIrcak,
      dager: dagerFra,
      kronisk: inn.kronisk,
      margin: inn.sikkerhetsmargin,
      usikkerhet: fraUnderCutoff ? r.maleusikkerhet.faktor_under_cutoff : 1,
    })

  const { korrigert, forventet, utfall } = sammenlign(forrigeIrcak, dager, underCutoff)

  return resultat(
    utfall,
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
    { samlet: utfall === 'vanskelig' ? samletVurdering(tidligere, tidligereIrcak as number[], inn, sammenlign) : null },
  )
}

/**
 * Den samlede vurderingen: denne prøven sammenlignes med hver av de
 * tidligere prøvene, fra den nærmeste og bakover, på samme måte som med
 * forrige prøve. Den første som gir nytt inntak, brukes. Gir ingen av dem
 * nytt inntak, tilfører de ikke noe, og kommentaren gjelder bare forrige
 * prøve.
 */
function samletVurdering(
  prover: ThcProve[],
  ircak: number[],
  inn: ThcInndata,
  sammenlign: (fra: number, dager: number, underCutoff: boolean) => { utfall: ThcKonklusjon },
): ThcSamletVurdering | null {
  const nyestForst = prover
    .map((prove, i) => ({ prove, ircak: ircak[i]!, dager: dagerMellom(prove.dato, inn.aktuellDato) }))
    .sort((a, b) => a.dager - b.dager)
  for (const { prove, ircak: fra, dager } of nyestForst) {
    // IRCAK 0 i den tidligere prøven: som for forrige prøve er ethvert funn
    // nå et nytt inntak etter den.
    if (fra === 0 || sammenlign(fra, dager, prove.underCutoff).utfall === 'nytt_inntak') {
      return { dato: formaterDatoNorsk(prove.dato), ircak: fra, dager }
    }
  }
  return null
}

/** Sant når marginen er den uten korreksjon — medianen er den målte verdien. */
export function erUtenMargin(margin: number): boolean {
  return margin === INGEN_SIKKERHETSMARGIN
}
