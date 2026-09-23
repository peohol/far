/**
 * THC-syreregelsettet: alt ved fortolkningen av THC-syre i urin som er
 * fagkunnskap og ikke programlogikk — utskillelseskurvene, måleusikkerheten,
 * sikkerhetsmarginene, konsentrasjonsnivåene, grensene for hvert
 * bruksmønster, varselet om lang tid mellom prøvene og tekstbolkene
 * kommentaren settes sammen av.
 *
 * Regelsettet er ett objekt i det redigerbare faginnholdet (objekttypen
 * `thc_regelsett`), med utkast, publisering, revisjoner og gjenoppretting som
 * alt annet faginnhold. Formen her er den samme som øyeblikksbildet databasen
 * lagrer i hver revisjon. Motoren som bruker regelsettet, står i
 * `thcMotor.ts`; bakgrunnen i `docs/thc-syre.md`.
 *
 * Valideringen her er den samme som databasen gjør før noe lagres (se
 * migrasjonen `*_thc_regelsett.sql`), slik at redigeringen kan si fra før
 * brukeren trykker «Lagre». Databasen er likevel den som avgjør.
 */

/** Kurvene konklusjonen leses av, fra raskest til tregest utskillelse. */
export const THC_KURVEROLLER = ['gronn', 'gul', 'rod'] as const
export type ThcKurverolle = (typeof THC_KURVEROLLER)[number]

/** Fargen på kurven, bøyd som i «den grønne kurven». */
export const KURVEFARGE: Record<ThcKurverolle, string> = { gronn: 'grønne', gul: 'gule', rod: 'røde' }

/**
 * En bi-eksponentiell utskillelseskurve C(t) = a1·e^(−k1·t) + a2·e^(−k2·t),
 * med t i døgn. Amplitudene står i kildedataenes enheter, slik regnearket
 * har dem; motoren ganger dem med {@link ThcRegelsett.konverteringsfaktor}.
 */
export interface ThcKurve {
  /** Navnet kurven har i figuren, f.eks. «Normal utskillelse». */
  navn: string
  a1: number
  k1: number
  a2: number
  k2: number
}

/**
 * Et konsentrasjonsnivå for den aktuelle prøven. `nedre` er skillepunktet mot
 * nivået under og hører til dette nivået (nedre grense inkludert, øvre
 * ekskludert); det laveste nivået har ingen nedre grense.
 */
export interface ThcKonsentrasjonsniva {
  /** Ordet kommentaren bruker: «påvist i {nivå} konsentrasjon». */
  navn: string
  nedre: number | null
  /**
   * Sant når konsentrasjoner på dette nivået gjerne ses kort tid etter
   * inntak. Da tas tekstbolken om nylig inntak med, og setningen om at
   * inntak har skjedd og påvisningstiden uten forrige prøve utelates.
   */
  nylig_inntak: boolean
}

/**
 * Hvor den korrigerte endringen må ligge for hver konklusjon, uttrykt som
 * kurven den må ligge over. Endringen sammenlignes med kurvene i rekkefølge
 * fra grønn, og må ligge over alle kurvene fram til og med den som er
 * oppgitt.
 */
export interface ThcBruksmonster {
  vanskelig_over: ThcKurverolle
  nytt_inntak_over: ThcKurverolle
}

/** En sikkerhetsmargin og kvantilet den leser av (Φ⁻¹(1 − margin)). */
export interface ThcSikkerhetsmargin {
  margin: number
  /**
   * z-verdien med full presisjon. Lagres ved siden av marginen fordi
   * 1 − margin ikke kan regnes eksakt i flyttall; databasen kontrollerer at
   * de stemmer overens.
   */
  z: number
}

/** Tekstbolkene kommentaren settes sammen av. Rekkefølgen er den i kommentaren. */
export const THC_TEKSTNOKLER = [
  'apning',
  'nylig_inntak',
  'nytt_inntak',
  'inntak_har_skjedd',
  'pavisningstid',
  'vanskelig',
  'ikke_nodvendigvis',
  'under_cutoff_vanskelig',
  'under_cutoff_ikke_nodvendigvis',
  'uten_forrige',
] as const
export type ThcTekstnokkel = (typeof THC_TEKSTNOKLER)[number]

/** Plassholderne en tekstbolk kan inneholde. */
export const THC_PLASSHOLDERE = ['{nivå}', '{forrige prøvedato}'] as const
export type ThcPlassholder = (typeof THC_PLASSHOLDERE)[number]

export interface ThcTekstbolkInfo {
  tittel: string
  /** Når bolken tas med, i vanlig språk. */
  brukes: string
  /** Plassholderne bolken må ha — de den ellers ville mistet meningen uten. */
  plassholdere: readonly ThcPlassholder[]
  /**
   * Plassholderne bolken kan ha. Datoen for forrige prøve finnes bare i
   * bolkene som brukes når det er en forrige prøve.
   */
  tilgjengelige: readonly ThcPlassholder[]
}

/**
 * Hva hver tekstbolk er og når den brukes. Vilkårene er motorens
 * (`thcMotor.ts`), skrevet ut slik redigeringen og simulatoren viser dem.
 */
export const THC_TEKSTBOLKER: Record<ThcTekstnokkel, ThcTekstbolkInfo> = {
  apning: {
    tittel: 'Åpning',
    brukes: 'Alltid.',
    plassholdere: ['{nivå}'],
    tilgjengelige: ['{nivå}'],
  },
  nylig_inntak: {
    tittel: 'Nylig inntak',
    brukes: 'Når konsentrasjonsnivået gjerne ses kort tid etter inntak.',
    plassholdere: [],
    tilgjengelige: ['{nivå}'],
  },
  nytt_inntak: {
    tittel: 'Nytt inntak etter forrige prøve',
    brukes: 'Når endringen ligger over grensen for nytt inntak, eller forrige prøve hadde IRCAK 0.',
    plassholdere: ['{forrige prøvedato}'],
    tilgjengelige: ['{nivå}', '{forrige prøvedato}'],
  },
  inntak_har_skjedd: {
    tittel: 'Inntak har skjedd',
    brukes:
      'Når konsentrasjonsnivået ikke tyder på nylig inntak, og konklusjonen er «ikke nødvendigvis», ' +
      'det er ingen forrige prøve, eller forrige prøve er fortolket under cut-off og konklusjonen er ' +
      '«vanskelig å avgjøre».',
    plassholdere: [],
    tilgjengelige: ['{nivå}'],
  },
  pavisningstid: {
    tittel: 'Påvisningstid',
    brukes:
      'Med forrige prøve: når konklusjonen ikke er nytt inntak. Uten forrige prøve: når ' +
      'konsentrasjonsnivået ikke tyder på nylig inntak.',
    plassholdere: [],
    tilgjengelige: ['{nivå}'],
  },
  vanskelig: {
    tittel: 'Vanskelig å avgjøre',
    brukes: 'Når endringen ligger over grensen for «vanskelig å avgjøre», men ikke for nytt inntak.',
    plassholdere: ['{forrige prøvedato}'],
    tilgjengelige: ['{nivå}', '{forrige prøvedato}'],
  },
  ikke_nodvendigvis: {
    tittel: 'Ikke nødvendigvis nytt inntak',
    brukes: 'Når endringen ligger innenfor det som er forventet.',
    plassholdere: ['{forrige prøvedato}'],
    tilgjengelige: ['{nivå}', '{forrige prøvedato}'],
  },
  under_cutoff_vanskelig: {
    tittel: 'Vanskelig å avgjøre, forrige prøve under cut-off',
    brukes: 'I stedet for «Vanskelig å avgjøre» når forrige prøve er fortolket under cut-off.',
    plassholdere: [],
    tilgjengelige: ['{nivå}', '{forrige prøvedato}'],
  },
  under_cutoff_ikke_nodvendigvis: {
    tittel: 'Ikke nødvendigvis nytt inntak, forrige prøve under cut-off',
    brukes: 'I stedet for «Ikke nødvendigvis nytt inntak» når forrige prøve er fortolket under cut-off.',
    plassholdere: ['{forrige prøvedato}'],
    tilgjengelige: ['{nivå}', '{forrige prøvedato}'],
  },
  uten_forrige: {
    tittel: 'Uten forrige prøve',
    brukes: 'Når det ikke finnes en tidligere prøve å sammenligne med.',
    plassholdere: [],
    tilgjengelige: ['{nivå}'],
  },
}

export interface ThcMaleusikkerhet {
  /** Analysevariasjonen (CV) for THC-syre. */
  cv_thc: number
  /** Analysevariasjonen (CV) for kreatinin. */
  cv_kreatinin: number
  /**
   * Hvor mye høyere måleusikkerheten legges til grunn når forrige prøve
   * fortolkes under cut-off. Ganges inn i log-standardavviket.
   */
  faktor_under_cutoff: number
}

/** Hele regelsettet — det som lagres i hver revisjon. */
export interface ThcRegelsett {
  /** Regner kildedataenes enheter om til enhetene IRCAK svares ut i. */
  konverteringsfaktor: number
  kurver: Record<ThcKurverolle, ThcKurve>
  maleusikkerhet: ThcMaleusikkerhet
  /** Stigende. Den første uten margin (0,5), om den er med, har z = 0. */
  sikkerhetsmarginer: ThcSikkerhetsmargin[]
  standard_sikkerhetsmargin: number
  /** Stigende etter nedre grense; det første uten. */
  konsentrasjonsnivaer: ThcKonsentrasjonsniva[]
  bruksmonstre: { kronisk: ThcBruksmonster; ikke_kronisk: ThcBruksmonster }
  /** Mer enn så mange døgn mellom prøvene gir et varsel. */
  varsel_dager_mellom: number
  tekster: Record<ThcTekstnokkel, string>
}

/** Marginen der medianen leses av: ingen korreksjon i det hele tatt. */
export const INGEN_SIKKERHETSMARGIN = 0.5

/* --- Kvantilene ----------------------------------------------------------- */

/**
 * Φ⁻¹(p), kvantilet i standard normalfordeling — Wichuras algoritme AS 241
 * (PPND16), med relativ feil rundt 1e-16. Brukes til å foreslå z når en ny
 * sikkerhetsmargin legges til, og til å kontrollere at lagrede z-verdier
 * stemmer med marginen. Samme algoritme står i migrasjonen.
 */
export function normalkvantil(p: number): number {
  if (!(p > 0 && p < 1)) return Number.NaN
  const q = p - 0.5
  if (Math.abs(q) <= 0.425) {
    const r = 0.180625 - q * q
    return (
      (q *
        (((((((r * 2509.0809287301226727 + 33430.575583588128105) * r + 67265.770927008700853) * r +
          45921.953931549871457) *
          r +
          13731.693765509461125) *
          r +
          1971.5909503065514427) *
          r +
          133.14166789178437745) *
          r +
          3.387132872796366608)) /
      (((((((r * 5226.495278852545925 + 28729.085735721942674) * r + 39307.89580009271061) * r +
        21213.794301586595867) *
        r +
        5394.1960214247511077) *
        r +
        687.1870074920579083) *
        r +
        42.313330701600911252) *
        r +
        1)
    )
  }
  let r = Math.sqrt(-Math.log(q < 0 ? p : 1 - p))
  let v: number
  if (r <= 5) {
    r -= 1.6
    v =
      (((((((r * 7.7454501427834140764e-4 + 0.0227238449892691845833) * r + 0.24178072517745061177) * r +
        1.27045825245236838258) *
        r +
        3.64784832476320460504) *
        r +
        5.7694972214606914055) *
        r +
        4.6303378461565452959) *
        r +
        1.42343711074968357734) /
      (((((((r * 1.05075007164441684324e-9 + 5.475938084995344946e-4) * r + 0.0151986665636164571966) * r +
        0.14810397642748007459) *
        r +
        0.68976733498510000455) *
        r +
        1.6763848301838038494) *
        r +
        2.05319162663775882187) *
        r +
        1)
  } else {
    r -= 5
    v =
      (((((((r * 2.01033439929228813265e-7 + 2.71155556874348757815e-5) * r + 0.0012426609473880784386) * r +
        0.026532189526576123093) *
        r +
        0.29656057182850489123) *
        r +
        1.7848265399172913358) *
        r +
        5.4637849111641143699) *
        r +
        6.6579046435011037772) /
      (((((((r * 2.04426310338993978564e-15 + 1.4215117583164458887e-7) * r + 1.8463183175100546818e-5) * r +
        7.868691311456132591e-4) *
        r +
        0.0148753612908506148525) *
        r +
        0.13692988092273580531) *
        r +
        0.59983220655588793769) *
        r +
        1)
  }
  return q < 0 ? -v : v
}

/** Hvor langt en lagret z kan ligge fra Φ⁻¹(1 − margin). */
export const Z_TOLERANSE = 1e-9

/* --- Validering ----------------------------------------------------------- */

/** Et endelig tall større enn 0. */
function positivt(verdi: unknown): verdi is number {
  return typeof verdi === 'number' && Number.isFinite(verdi) && verdi > 0
}

/** Plassholderne i en tekst, i den rekkefølgen de står, også ukjente. */
export function plassholdereI(tekst: string): string[] {
  return tekst.match(/\{[^{}]*\}/g) ?? []
}

/**
 * Døgnene og IRCAK-verdiene kurvenes rekkefølge kontrolleres over. De samme
 * står i migrasjonen.
 */
export const KURVEKONTROLL_FORRIGE = [0.01, 0.1, 1, 5, 20, 100, 1000] as const
export const KURVEKONTROLL_DAGER = [1, 3, 7, 14, 30, 90] as const
/**
 * Grønn og gul faller sammen når forrige prøve ligger langt ute på kurvene,
 * og skiller seg da bare i siste siffer. Så mye må rekkefølgen tåle.
 */
export const KURVEKONTROLL_TOLERANSE = 1e-9

/**
 * Alt som er galt med regelsettet, i vanlig språk. Tom liste betyr at det kan
 * lagres og publiseres. Kurvenes rekkefølge kontrolleres av
 * {@link kurvefeil} i `thcMotor.ts`, som trenger kurveregningen.
 */
export function validerThcRegelsett(r: ThcRegelsett): string[] {
  const feil: string[] = []

  if (!positivt(r.konverteringsfaktor)) feil.push('Konverteringsfaktoren må være et tall større enn 0.')

  for (const rolle of THC_KURVEROLLER) {
    const kurve = r.kurver[rolle]
    if (kurve.navn.trim() === '') feil.push(`Den ${KURVEFARGE[rolle]} kurven mangler navn.`)
    for (const felt of ['a1', 'k1', 'a2', 'k2'] as const) {
      if (!positivt(kurve[felt])) feil.push(`${kurve.navn || rolle}: ${felt} må være et tall større enn 0.`)
    }
  }

  const { cv_thc, cv_kreatinin, faktor_under_cutoff } = r.maleusikkerhet
  if (!positivt(cv_thc) || cv_thc >= 1) feil.push('CV for THC-syre må ligge mellom 0 og 1.')
  if (!positivt(cv_kreatinin) || cv_kreatinin >= 1) feil.push('CV for kreatinin må ligge mellom 0 og 1.')
  if (!(Number.isFinite(faktor_under_cutoff) && faktor_under_cutoff >= 1)) {
    feil.push('Faktoren for måleusikkerhet under cut-off må være minst 1.')
  }

  if (r.sikkerhetsmarginer.length === 0) feil.push('Det må finnes minst én sikkerhetsmargin.')
  r.sikkerhetsmarginer.forEach(({ margin, z }, i) => {
    if (!(Number.isFinite(margin) && margin >= 0.5 && margin < 1)) {
      feil.push('En sikkerhetsmargin må være minst 50 % og under 100 %.')
    } else if (!(Number.isFinite(z) && Math.abs(z - normalkvantil(1 - margin)) <= Z_TOLERANSE)) {
      feil.push(`z-verdien for ${margin * 100} % stemmer ikke med marginen.`)
    }
    const forrige = r.sikkerhetsmarginer[i - 1]
    if (forrige && !(margin > forrige.margin)) feil.push('Sikkerhetsmarginene må stå stigende, uten like.')
  })
  if (!r.sikkerhetsmarginer.some((m) => m.margin === r.standard_sikkerhetsmargin)) {
    feil.push('Standardmarginen må være en av sikkerhetsmarginene.')
  }

  const nivaer = r.konsentrasjonsnivaer
  if (nivaer.length === 0) feil.push('Det må finnes minst ett konsentrasjonsnivå.')
  nivaer.forEach((niva, i) => {
    if (niva.navn.trim() === '') feil.push('Et konsentrasjonsnivå mangler navn.')
    if (i === 0) {
      if (niva.nedre !== null) feil.push('Det laveste konsentrasjonsnivået skal ikke ha nedre grense.')
      return
    }
    if (!positivt(niva.nedre)) {
      feil.push(`Skillepunktet under «${niva.navn}» må være et tall større enn 0.`)
      return
    }
    const under = nivaer[i - 1]?.nedre
    if (typeof under === 'number' && !(niva.nedre > under)) {
      feil.push('Skillepunktene mellom konsentrasjonsnivåene må være stigende.')
    }
  })
  if (new Set(nivaer.map((n) => n.navn.trim())).size !== nivaer.length) {
    feil.push('To konsentrasjonsnivåer har samme navn.')
  }

  for (const kronisk of [true, false]) {
    const monster = kronisk ? r.bruksmonstre.kronisk : r.bruksmonstre.ikke_kronisk
    const navn = kronisk ? 'ved kronisk bruk' : 'uten kronisk bruk'
    const vanskelig = THC_KURVEROLLER.indexOf(monster.vanskelig_over)
    const nytt = THC_KURVEROLLER.indexOf(monster.nytt_inntak_over)
    if (vanskelig < 0 || nytt < 0) feil.push(`Grensene ${navn} peker på en ukjent kurve.`)
    else if (!(vanskelig < nytt)) {
      feil.push(`Grensene ${navn}: nytt inntak må ligge på en tregere kurve enn «vanskelig å avgjøre».`)
    }
  }

  if (!(Number.isInteger(r.varsel_dager_mellom) && r.varsel_dager_mellom >= 1)) {
    feil.push('Varselet om tid mellom prøvene må være et helt antall døgn, minst 1.')
  }

  for (const nokkel of THC_TEKSTNOKLER) {
    const tekst = r.tekster[nokkel]
    const { tittel, plassholdere, tilgjengelige } = THC_TEKSTBOLKER[nokkel]
    if (typeof tekst !== 'string' || tekst.trim() === '') {
      feil.push(`Tekstbolken «${tittel}» er tom.`)
      continue
    }
    if (tekst !== tekst.trim()) feil.push(`Tekstbolken «${tittel}» begynner eller slutter med mellomrom.`)
    const funnet = plassholdereI(tekst)
    const ukjente = funnet.filter((p) => !(tilgjengelige as readonly string[]).includes(p))
    if (ukjente.length > 0) {
      feil.push(`Tekstbolken «${tittel}» har plassholdere den ikke kan bruke: ${ukjente.join(', ')}.`)
    }
    for (const p of plassholdere) {
      if (!funnet.includes(p)) feil.push(`Tekstbolken «${tittel}» må inneholde ${p}.`)
    }
    if (/[{}]/.test(tekst.replace(/\{[^{}]*\}/g, ''))) {
      feil.push(`Tekstbolken «${tittel}» har en krøllparentes som ikke hører til en plassholder.`)
    }
  }

  return feil
}
