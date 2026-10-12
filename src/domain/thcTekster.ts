/**
 * Tekstene kommentaren om THC-syre settes sammen av.
 *
 * Tekstene er klinisk innhold for seg, adskilt fra reglene
 * (`thcRegelsett.ts`): reglene avgjør konklusjonen, motoren (`thcMotor.ts`)
 * avgjør hvilken kommentar konklusjonen gir, og tekstene gir ordlyden. Hver
 * tekst er en kommentar med en fast rolle i THC-syremodulen — nøkkelen under
 * — og kan inneholde plassholdere som fylles inn når kommentaren settes
 * sammen.
 *
 * En ferdig kommentar er alltid introsetningen, så kommentaren for
 * situasjonen, og til slutt spørsmålsetningen når regelsettet sier at
 * kommentaren skal avsluttes med den (`med_sporsmalsetning`). De to felles
 * setningene står ett sted og gjenbrukes i alle kommentarene. Delene bindes
 * sammen med ett mellomrom, så en tekst skal ikke begynne eller slutte med
 * mellomrom.
 *
 * De fire vanlige situasjonene har to kommentarer: én for nivåene som ikke
 * tyder på nylig inntak (lav og middels høy), og én for nivåene som gjør det
 * (høy). Hvilke nivåer det er, står i regelsettet (`nylig_inntak`).
 *
 * I databasen er hver tekst en kommentar (`kommentarobjekt.ts`), og
 * regelsettet sier hvilken kommentar hver tekst bruker ({@link ThcTekstbolker}).
 */

import { plassholdereI, type Kommentaroppslag } from './kommentarobjekt'
import type { ThcRegelsett } from './thcRegelsett'

/** Setningene som er felles for kommentarene. */
export const THC_FELLES_SETNINGER = ['introsetning', 'sporsmalsetning'] as const
export type ThcFellesSetning = (typeof THC_FELLES_SETNINGER)[number]

/**
 * Situasjonene som har hver sin kommentar, i den rekkefølgen redigeringen
 * viser dem.
 */
export const THC_SITUASJONER = [
  'uten_forrige',
  'ikke_nodvendigvis',
  'vanskelig',
  'nytt_inntak',
  'samlet_vurdering',
  'under_cutoff_ikke_nodvendigvis',
  'kort_tid',
] as const
export type ThcSituasjon = (typeof THC_SITUASJONER)[number]

/** Situasjonene der nivåene som tyder på nylig inntak, har en egen kommentar. */
export const THC_NIVADELTE_SITUASJONER = ['uten_forrige', 'ikke_nodvendigvis', 'vanskelig', 'nytt_inntak'] as const
export type ThcNivadeltSituasjon = (typeof THC_NIVADELTE_SITUASJONER)[number]

/** Kommentaren for nivåene som tyder på nylig inntak: `nytt_inntak_nylig`. */
export type ThcNyligNokkel = `${ThcNivadeltSituasjon}_nylig`
export type ThcKommentarnokkel = ThcSituasjon | ThcNyligNokkel

export function erNivadelt(situasjon: ThcSituasjon): situasjon is ThcNivadeltSituasjon {
  return (THC_NIVADELTE_SITUASJONER as readonly string[]).includes(situasjon)
}

/** Kommentaren for situasjonen og nivået: `nytt_inntak`, eller `nytt_inntak_nylig` for høy. */
export function kommentarnokkel(situasjon: ThcSituasjon, nyligInntak: boolean): ThcKommentarnokkel {
  return nyligInntak && erNivadelt(situasjon) ? `${situasjon}_nylig` : situasjon
}

/** Kommentarene til en situasjon: én, eller to når nivåene deler den. */
export function kommentarerFor(situasjon: ThcSituasjon): ThcKommentarnokkel[] {
  return erNivadelt(situasjon) ? [situasjon, `${situasjon}_nylig`] : [situasjon]
}

/** Alle kommentarene, situasjon for situasjon. */
export const THC_KOMMENTARNOKLER: readonly ThcKommentarnokkel[] = THC_SITUASJONER.flatMap(kommentarerFor)

/** Alle tekstene: de felles setningene og kommentarene. */
export const THC_TEKSTNOKLER: readonly ThcTekstnokkel[] = [...THC_FELLES_SETNINGER, ...THC_KOMMENTARNOKLER]
export type ThcTekstnokkel = ThcFellesSetning | ThcKommentarnokkel

/** Plassholderne en tekst kan inneholde. */
export const THC_PLASSHOLDERE = ['{nivå}', '{forrige prøvedato}', '{tidligere prøvedato}'] as const
export type ThcPlassholder = (typeof THC_PLASSHOLDERE)[number]

/** Hva en situasjon er og når den brukes. */
export interface ThcSituasjonsinfo {
  tittel: string
  /** Når kommentaren brukes, i vanlig språk. */
  brukes: string
  /** Plassholderne kommentaren må ha — de den ellers ville mistet meningen uten. */
  plassholdere: readonly ThcPlassholder[]
  /** Plassholderne kommentaren kan ha. */
  tilgjengelige: readonly ThcPlassholder[]
}

const MED_FORRIGE = ['{nivå}', '{forrige prøvedato}'] as const

/**
 * Hver situasjon og når den brukes. Vilkårene er motorens (`thcMotor.ts`),
 * skrevet ut slik redigeringen og simulatoren viser dem.
 */
export const THC_SITUASJONSINFO: Record<ThcSituasjon, ThcSituasjonsinfo> = {
  uten_forrige: {
    tittel: 'Ikke vurdert mot tidligere prøve',
    brukes: 'Når det ikke finnes en tidligere prøve å sammenligne med.',
    plassholdere: [],
    tilgjengelige: ['{nivå}'],
  },
  ikke_nodvendigvis: {
    tittel: 'Ikke nødvendigvis nytt',
    brukes: 'Når endringen fra forrige prøve ligger innenfor det som er forventet.',
    plassholdere: ['{forrige prøvedato}'],
    tilgjengelige: MED_FORRIGE,
  },
  vanskelig: {
    tittel: 'Kan ikke fastslås',
    brukes:
      'Når endringen ligger over grensen for «kan ikke fastslås», men ikke for nytt inntak. Gjelder også når ' +
      'forrige prøve er fortolket under cut-off.',
    plassholdere: ['{forrige prøvedato}'],
    tilgjengelige: MED_FORRIGE,
  },
  nytt_inntak: {
    tittel: 'Nytt inntak',
    brukes: 'Når endringen ligger over grensen for nytt inntak, eller forrige prøve hadde IRCAK 0.',
    plassholdere: ['{forrige prøvedato}'],
    tilgjengelige: MED_FORRIGE,
  },
  samlet_vurdering: {
    tittel: 'Samlet vurdering av flere tidligere prøver',
    brukes:
      'I stedet for «Kan ikke fastslås» når samlet vurdering er slått på, og sammenligningen med en enda ' +
      'tidligere prøve gir nytt inntak. Den nærmeste slike prøven brukes.',
    plassholdere: ['{forrige prøvedato}', '{tidligere prøvedato}'],
    tilgjengelige: [...MED_FORRIGE, '{tidligere prøvedato}'],
  },
  under_cutoff_ikke_nodvendigvis: {
    tittel: 'Under cut-off i forrige prøve · ikke nødvendigvis nytt',
    brukes: 'I stedet for «Ikke nødvendigvis nytt» når forrige prøve er fortolket under cut-off.',
    plassholdere: ['{forrige prøvedato}'],
    tilgjengelige: MED_FORRIGE,
  },
  kort_tid: {
    tittel: 'Kort tid mellom prøvene',
    brukes:
      'Når «Kort tid mellom prøvene» er huket av. Den kan bare hukes av når prøvene er tatt med færre ' +
      'dager imellom enn regelsettets grense, og da vurderes ikke prøvene mot hverandre.',
    plassholdere: [],
    tilgjengelige: MED_FORRIGE,
  },
}

export interface ThcTekstbolkInfo extends ThcSituasjonsinfo {
  /** Situasjonen kommentaren hører til; ingen for de felles setningene. */
  situasjon: ThcSituasjon | null
  /**
   * `nylig` for kommentaren til nivåene som tyder på nylig inntak, `ovrige`
   * for de andre nivåene, og `alle` når nivåene deler den.
   */
  nivaer: 'alle' | 'ovrige' | 'nylig'
}

const FELLES: Record<ThcFellesSetning, ThcSituasjonsinfo> = {
  introsetning: {
    tittel: 'Introsetning',
    brukes: 'Først i alle kommentarene. {nivå} blir nivået konsentrasjonen i prøven ligger på.',
    plassholdere: ['{nivå}'],
    tilgjengelige: ['{nivå}'],
  },
  sporsmalsetning: {
    tittel: 'Spørsmålsetning',
    brukes: 'Sist i kommentarene som skal avsluttes med den.',
    plassholdere: [],
    tilgjengelige: [],
  },
}

function bolkinfo(nokkel: ThcTekstnokkel): ThcTekstbolkInfo {
  if (nokkel in FELLES) return { ...FELLES[nokkel as ThcFellesSetning], situasjon: null, nivaer: 'alle' }
  const nylig = nokkel.endsWith('_nylig')
  const situasjon = (nylig ? nokkel.slice(0, -'_nylig'.length) : nokkel) as ThcSituasjon
  const info = THC_SITUASJONSINFO[situasjon]
  if (!erNivadelt(situasjon)) return { ...info, situasjon, nivaer: 'alle' }
  return nylig
    ? { ...info, tittel: `${info.tittel} (nivå som tyder på nylig inntak)`, situasjon, nivaer: 'nylig' }
    : { ...info, tittel: `${info.tittel} (øvrige nivåer)`, situasjon, nivaer: 'ovrige' }
}

/**
 * Hver tekst: tittelen meldingene og kommentarnavnene bruker, når den brukes,
 * og plassholderne den må og kan ha. Databasen har de samme titlene og
 * plassholderne (`intern.thc_tekstbolktittel` osv.).
 */
export const THC_TEKSTBOLKER = Object.fromEntries(THC_TEKSTNOKLER.map((n) => [n, bolkinfo(n)])) as Record<
  ThcTekstnokkel,
  ThcTekstbolkInfo
>

/** Én tekst for hver nøkkel. */
export type ThcTekster = Record<ThcTekstnokkel, string>

/** Kommentaren hver tekst bruker, med kommentarens ID. */
export type ThcTekstbolker = Record<ThcTekstnokkel, string>

/**
 * THC-syreregelsettet slik det lagres: reglene, og hvilken kommentar hver
 * tekst bruker. Selve tekstene står i kommentarene.
 */
export interface ThcRegelsettinnhold extends ThcRegelsett {
  tekstbolker: ThcTekstbolker
}

/** Teksten til hver nøkkel, slått opp i kommentarene, eller tekstene som mangler en. */
export function thcTeksterFra(
  tekstbolker: Partial<ThcTekstbolker>,
  kommentarer: Kommentaroppslag,
): { ok: true; tekster: ThcTekster } | { ok: false; feil: string[] } {
  const mangler = THC_TEKSTNOKLER.filter((nokkel) => !kommentarer.has(tekstbolker[nokkel] ?? ''))
  if (mangler.length > 0) {
    return {
      ok: false,
      feil: mangler.map((nokkel) => `Fant ikke kommentaren til teksten «${THC_TEKSTBOLKER[nokkel].tittel}».`),
    }
  }
  return {
    ok: true,
    tekster: Object.fromEntries(
      THC_TEKSTNOKLER.map((nokkel) => [nokkel, kommentarer.get(tekstbolker[nokkel]!)!]),
    ) as ThcTekster,
  }
}

/**
 * Om en tekst med disse plassholderne kan brukes for nøkkelen: den må ha
 * plassholderne nøkkelen krever, og ingen den ikke kan bruke. Databasen gjør
 * den samme kontrollen, med samme ordlyd, når en tekst kobles til en
 * kommentar.
 */
export function validerThcTekstbolk(nokkel: ThcTekstnokkel, plassholdere: readonly string[]): string[] {
  const { tittel, plassholdere: kreves, tilgjengelige } = THC_TEKSTBOLKER[nokkel]
  const feil: string[] = []
  const ukjente = plassholdere.filter((p) => !(tilgjengelige as readonly string[]).includes(p))
  if (ukjente.length > 0) {
    feil.push(`Teksten «${tittel}» har plassholdere den ikke kan bruke: ${ukjente.join(', ')}.`)
  }
  for (const p of kreves) {
    if (!plassholdere.includes(p)) feil.push(`Teksten «${tittel}» må inneholde ${p}.`)
  }
  return feil
}

/** Alt som er galt med én tekst, i vanlig språk. */
export function validerThcTekst(nokkel: ThcTekstnokkel, tekst: unknown): string[] {
  const { tittel } = THC_TEKSTBOLKER[nokkel]
  if (typeof tekst !== 'string' || tekst.trim() === '') return [`Teksten «${tittel}» er tom.`]
  const feil: string[] = []
  if (tekst !== tekst.trim()) feil.push(`Teksten «${tittel}» begynner eller slutter med mellomrom.`)
  feil.push(...validerThcTekstbolk(nokkel, plassholdereI(tekst)))
  if (/[{}]/.test(tekst.replace(/\{[^{}]*\}/g, ''))) {
    feil.push(`Teksten «${tittel}» har en krøllparentes som ikke hører til en plassholder.`)
  }
  return feil
}

/** Alt som er galt med tekstene, i vanlig språk. Tom liste betyr at alle kan brukes. */
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

/* --- Sammensettingen ------------------------------------------------------ */

/** Verdiene plassholderne fylles med. */
export interface ThcPlassholderverdier {
  niva: string
  forrigeDato: string
  tidligereDato: string
}

/** Delene kommentaren for nøkkelen består av: introsetningen, kommentaren og eventuelt spørsmålsetningen. */
export function kommentardeler(
  medSporsmalsetning: readonly ThcKommentarnokkel[],
  nokkel: ThcKommentarnokkel,
): ThcTekstnokkel[] {
  return medSporsmalsetning.includes(nokkel)
    ? ['introsetning', nokkel, 'sporsmalsetning']
    : ['introsetning', nokkel]
}

/** Setter inn plassholderne og binder delene sammen med mellomrom. */
export function settSammen(tekster: ThcTekster, deler: readonly ThcTekstnokkel[], verdier: ThcPlassholderverdier): string {
  return deler
    .map((nokkel) =>
      tekster[nokkel]
        .replaceAll('{nivå}', verdier.niva)
        .replaceAll('{forrige prøvedato}', verdier.forrigeDato)
        .replaceAll('{tidligere prøvedato}', verdier.tidligereDato),
    )
    .join(' ')
}
