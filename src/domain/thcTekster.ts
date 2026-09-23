/**
 * Tekstbolkene kommentaren om THC-syre settes sammen av.
 *
 * Tekstene er klinisk innhold for seg, adskilt fra reglene
 * (`thcRegelsett.ts`): reglene avgjør konklusjonen, motoren (`thcMotor.ts`)
 * avgjør hvilke bolker konklusjonen gir, og bolkene gir ordlyden. Hver bolk er
 * en kommentar med en fast rolle i THC-syremodulen — nøkkelen under — og kan
 * inneholde plassholdere som fylles inn når kommentaren settes sammen.
 *
 * Bolkene bindes sammen med ett mellomrom, så en tekst skal ikke begynne
 * eller slutte med mellomrom.
 */

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

/** Én tekst for hver bolk. */
export type ThcTekster = Record<ThcTekstnokkel, string>

/** Plassholderne i en tekst, også ukjente, uten gjentakelser og sortert. */
export function plassholdereI(tekst: string): string[] {
  return [...new Set(tekst.match(/\{[^{}]*\}/g) ?? [])].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
}

/**
 * Om en tekst med disse plassholderne kan brukes i bolken: den må ha
 * plassholderne bolken krever, og ingen den ikke kan bruke. Databasen gjør den
 * samme kontrollen, med samme ordlyd, når en bolk kobles til en kommentar.
 */
export function validerThcTekstbolk(nokkel: ThcTekstnokkel, plassholdere: readonly string[]): string[] {
  const { tittel, plassholdere: kreves, tilgjengelige } = THC_TEKSTBOLKER[nokkel]
  const feil: string[] = []
  const ukjente = plassholdere.filter((p) => !(tilgjengelige as readonly string[]).includes(p))
  if (ukjente.length > 0) {
    feil.push(`Tekstbolken «${tittel}» har plassholdere den ikke kan bruke: ${ukjente.join(', ')}.`)
  }
  for (const p of kreves) {
    if (!plassholdere.includes(p)) feil.push(`Tekstbolken «${tittel}» må inneholde ${p}.`)
  }
  return feil
}

/** Alt som er galt med teksten til én bolk, i vanlig språk. */
export function validerThcTekst(nokkel: ThcTekstnokkel, tekst: unknown): string[] {
  const { tittel } = THC_TEKSTBOLKER[nokkel]
  if (typeof tekst !== 'string' || tekst.trim() === '') return [`Tekstbolken «${tittel}» er tom.`]
  const feil: string[] = []
  if (tekst !== tekst.trim()) feil.push(`Tekstbolken «${tittel}» begynner eller slutter med mellomrom.`)
  feil.push(...validerThcTekstbolk(nokkel, plassholdereI(tekst)))
  if (/[{}]/.test(tekst.replace(/\{[^{}]*\}/g, ''))) {
    feil.push(`Tekstbolken «${tittel}» har en krøllparentes som ikke hører til en plassholder.`)
  }
  return feil
}

/** Alt som er galt med tekstene, i vanlig språk. Tom liste betyr at alle bolkene kan brukes. */
export function validerThcTekster(tekster: ThcTekster): string[] {
  return THC_TEKSTNOKLER.flatMap((nokkel) => validerThcTekst(nokkel, tekster[nokkel]))
}

declare const godkjent: unique symbol

/** Tekster som har vært gjennom {@link validerThcTekster} uten feil. */
export type GodkjenteThcTekster = ThcTekster & { readonly [godkjent]: true }

/** Kontrollerer tekstene og gir dem tilbake som godkjent, eller feilene. */
export function godkjennThcTekster(
  tekster: ThcTekster,
): { ok: true; tekster: GodkjenteThcTekster } | { ok: false; feil: string[] } {
  const feil = validerThcTekster(tekster)
  return feil.length === 0 ? { ok: true, tekster: tekster as GodkjenteThcTekster } : { ok: false, feil }
}
