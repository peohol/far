import type { Kommentarplassering } from './kommentar'
import type { Kommentaroppslag } from './kommentarobjekt'

/**
 * Scenarioregelsett: fortolkningen av analytter som vurderes samlet.
 *
 * Et regelsett gjelder én fortolkningsmodul — f.eks. diazepam,
 * N-desmetyldiazepam og oksazepam — og består av **scenarier**. Hvert scenario
 * sier nøyaktig hvilke av modulens analytter som er påvist, eventuelt hvilke
 * forholdstall som må ligge over eller under en grense, og hva utfallet er:
 * kommentarer plassert på bestemte analyttkoder, eller en eksplisitt manuell
 * vurdering uten noe å kopiere.
 *
 * Modellen er bevisst smal (plan del 11): påvist/ikke påvist, forholdstall mot
 * navngitte grenser, og utfall. Ingen generelle uttrykk. Grensene er egne,
 * navngitte parametere, slik at en grense som skiller to scenarier, er ett
 * tall som endres ett sted.
 *
 * Kommentartekstene er egne objekter (`kommentarobjekt.ts`). Scenariene
 * peker på dem med ID-en, og motoren får tekstene å slå opp i ved siden av
 * regelsettet. Regelsettet eier altså reglene, ikke tekstene: en tekst rettes
 * og publiseres for seg, og samme tekst kan brukes av flere scenarier og
 * regelsett.
 *
 * Et gyldig regelsett gir nøyaktig ett scenario for hver mulig kombinasjon av
 * påviste analytter og forholdstall — {@link validerScenarioregelsett} sjekker
 * det — så rekkefølgen på scenariene betyr ingenting for utfallet.
 */

/* --- Modellen ----------------------------------------------------------- */

export const OPERATORER = ['<', '<=', '>', '>='] as const
export type Operator = (typeof OPERATORER)[number]

/**
 * Et forholdstall: summen av konsentrasjonene i telleren delt på summen i
 * nevneren. Kan ikke regnes ut når nevneren er 0; da vises `nullmelding`.
 */
export interface Forhold {
  nokkel: string
  teller: string[]
  nevner: string[]
  nullmelding: string
}

/**
 * En navngitt grense for et forholdstall, lagret som andel (0,1 = 10 %).
 * Tekster i regelsettet kan vise grensen med `{nokkel}`, som skrives ut i
 * prosent.
 */
export interface Parameter {
  nokkel: string
  navn: string
  verdi: number
}

/** «Forholdet `forhold` `operator` grensen `parameter`». */
export interface Vilkar {
  forhold: string
  operator: Operator
  parameter: string
}

/** Én kommentar i et utfall: kommentaren (som ID) og kodene den limes inn på. */
export interface Scenarioplassering {
  rolle: Kommentarplassering['rolle']
  /** Merkelappen i UI-et, f.eks. «Hovedkommentar for oksazepam». Unik i utfallet. */
  merke: string
  /** ID-en til kommentarobjektet. */
  kommentar: string
  koder: string[]
}

export type Scenarioutfall =
  | { type: 'kommentarer'; plasseringer: Scenarioplassering[]; notiser: string[] }
  /**
   * Kilden har ingen standardkommentar, og saken skal vurderes manuelt. Ingen
   * kommentar å kopiere — bare meldingen og veiledningen.
   */
  | { type: 'manuell'; melding: string; veiledning: string[] }

export interface Scenario {
  /** Stabil nøkkel innenfor regelsettet. */
  nokkel: string
  /** Nøyaktig de påviste analyttene; resten av modulens er ikke påvist. */
  pavist: string[]
  /** Alle må være oppfylt. */
  vilkar: Vilkar[]
  utfall: Scenarioutfall
}

export interface Scenarioregelsett {
  /** Fortolkningsmodulen regelsettet gjelder, f.eks. `diazepamgruppen`. */
  modul: string
  /** Modulens analyttkoder, i den rekkefølgen de vises. */
  analytter: string[]
  /** Hvorfor modulen ber om konsentrasjoner. Tom når den ikke gjør det. */
  verdihjelp: string
  forhold: Forhold[]
  parametere: Parameter[]
  scenarier: Scenario[]
}

/* --- Resultatet ---------------------------------------------------------- */

/** Utfallet av en fortolkning, slik fortolkningsmodulene viser det. */
export type Scenarioresultat =
  | { type: 'mangler'; mangler: string[] }
  | { type: 'kommentarer'; plasseringer: Kommentarplassering[]; notiser: string[] }
  | { type: 'plenum'; melding: string; veiledning: string[] }

/** Det brukeren har svart: påviste koder og konsentrasjoner slik de er tastet. */
export interface Scenarioinndata {
  pavist: string[]
  verdier: Record<string, string>
}

export const VELG_PAVIST = 'Kryss av for hvilke av analyttene som er påvist.'
export const FYLL_INN_TALL = 'Fyll inn de målte konsentrasjonene, så avgjøres regelen.'

/* --- Tall og tekst ------------------------------------------------------- */

/**
 * Leser et konsentrasjonstall slik det tastes i norske felt. `null` når
 * teksten ikke er et tall som ikke er negativt.
 */
export function lesKonsentrasjon(tekst: string): number | null {
  const trimmet = tekst.trim().replace(',', '.')
  if (trimmet === '' || !/^\d+(\.\d+)?$/.test(trimmet)) return null
  return Number(trimmet)
}

/** En andel skrevet som prosenttall med desimalkomma: 0,1 → «10», 0,125 → «12,5». */
export function somProsent(andel: number): string {
  return String(Number((andel * 100).toPrecision(12))).replace('.', ',')
}

/** Prosenttallet brukeren skriver, som andel: «12,5» → 0,125. `null` om det ikke er et tall. */
export function fraProsent(tekst: string): number | null {
  const tall = lesKonsentrasjon(tekst)
  return tall === null ? null : tall / 100
}

const PLASSHOLDER = /\{([a-z0-9_]+)\}/g

/** Teksten med `{nokkel}` byttet ut med grensen i prosent. */
export function flettInn(tekst: string, parametere: readonly Parameter[]): string {
  return tekst.replace(PLASSHOLDER, (hele, nokkel: string) => {
    const parameter = parametere.find((p) => p.nokkel === nokkel)
    return parameter ? somProsent(parameter.verdi) : hele
  })
}

/* --- Motoren ------------------------------------------------------------- */

/**
 * Kodene i `pavist` som hører til modulen, i modulens rekkefølge. Har modulen
 * bare én analytt, er den påvist — ellers hadde den ikke blitt kommentert.
 */
export function pavisteAv(regelsett: Scenarioregelsett, pavist: readonly string[]): string[] {
  if (regelsett.analytter.length === 1) return [...regelsett.analytter]
  return regelsett.analytter.filter((kode) => pavist.includes(kode))
}

function sammeMengde(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((kode) => b.includes(kode))
}

/** Scenariene som gjelder akkurat denne kombinasjonen av påviste analytter. */
export function scenarierFor(regelsett: Scenarioregelsett, pavist: readonly string[]): Scenario[] {
  const paviste = pavisteAv(regelsett, pavist)
  return regelsett.scenarier.filter((s) => sammeMengde(s.pavist, paviste))
}

/** Forholdene scenariene bruker, i regelsettets rekkefølge. */
function forholdI(regelsett: Scenarioregelsett, scenarier: readonly Scenario[]): Forhold[] {
  const brukt = new Set(scenarier.flatMap((s) => s.vilkar.map((v) => v.forhold)))
  return regelsett.forhold.filter((f) => brukt.has(f.nokkel))
}

/**
 * Konsentrasjonene fortolkningen trenger, gitt hva som er påvist: kodene
 * forholdstallene i de aktuelle scenariene regnes av, i modulens rekkefølge.
 */
export function verdifelter(regelsett: Scenarioregelsett, pavist: readonly string[]): string[] {
  const koder = new Set(
    forholdI(regelsett, scenarierFor(regelsett, pavist)).flatMap((f) => [...f.teller, ...f.nevner]),
  )
  return regelsett.analytter.filter((kode) => koder.has(kode))
}

function sum(koder: readonly string[], tall: ReadonlyMap<string, number>): number {
  return koder.reduce((acc, kode) => acc + (tall.get(kode) ?? 0), 0)
}

function oppfylt(verdi: number, operator: Operator, grense: number): boolean {
  switch (operator) {
    case '<':
      return verdi < grense
    case '<=':
      return verdi <= grense
    case '>':
      return verdi > grense
    case '>=':
      return verdi >= grense
  }
}

function grenseFor(regelsett: Scenarioregelsett, nokkel: string): number {
  const parameter = regelsett.parametere.find((p) => p.nokkel === nokkel)
  if (!parameter) throw new Error(`${regelsett.modul}: ukjent parameter ${nokkel}`)
  return parameter.verdi
}

/** Sant når alle vilkårene holder for disse forholdstallene. */
function treffer(regelsett: Scenarioregelsett, scenario: Scenario, forhold: ReadonlyMap<string, number>): boolean {
  return scenario.vilkar.every((v) => {
    const verdi = forhold.get(v.forhold)
    return verdi !== undefined && oppfylt(verdi, v.operator, grenseFor(regelsett, v.parameter))
  })
}

/** Hvordan en fortolkning falt ut, med scenariet som traff — det simulatoren viser. */
export type Scenariotreff =
  | { resultat: Extract<Scenarioresultat, { type: 'mangler' }>; scenario: null; forhold: Map<string, number> }
  | {
      resultat: Exclude<Scenarioresultat, { type: 'mangler' }>
      scenario: Scenario
      forhold: Map<string, number>
    }

/**
 * Kjører regelsettet på det brukeren har svart, med kommentartekstene
 * scenariene peker på. Kaster om regelsettet ikke gir nøyaktig ett scenario,
 * eller viser til en kommentar som ikke finnes — det skal validering ha
 * stoppet.
 */
export function kjorScenarier(
  regelsett: Scenarioregelsett,
  kommentarer: Kommentaroppslag,
  inn: Scenarioinndata,
): Scenariotreff {
  const forhold = new Map<string, number>()
  const mangler = (melding: string): Scenariotreff => ({
    resultat: { type: 'mangler', mangler: [melding] },
    scenario: null,
    forhold,
  })

  const paviste = pavisteAv(regelsett, inn.pavist)
  if (paviste.length === 0) return mangler(VELG_PAVIST)

  const kandidater = scenarierFor(regelsett, paviste)
  const felter = verdifelter(regelsett, paviste)
  const tall = new Map<string, number>()
  for (const kode of felter) {
    const verdi = lesKonsentrasjon(inn.verdier[kode] ?? '')
    if (verdi === null) return mangler(FYLL_INN_TALL)
    tall.set(kode, verdi)
  }

  for (const f of forholdI(regelsett, kandidater)) {
    const nevner = sum(f.nevner, tall)
    if (nevner <= 0) return mangler(flettInn(f.nullmelding, regelsett.parametere))
    forhold.set(f.nokkel, sum(f.teller, tall) / nevner)
  }

  const treff = kandidater.filter((s) => treffer(regelsett, s, forhold))
  const scenario = treff[0]
  if (treff.length !== 1 || !scenario) {
    throw new Error(`${regelsett.modul}: ${treff.length} scenarier traff ${paviste.join('+')}`)
  }

  return { resultat: utfallFor(regelsett, kommentarer, scenario.utfall), scenario, forhold }
}

/** Kort vei til bare resultatet. */
export function fortolkScenarier(
  regelsett: Scenarioregelsett,
  kommentarer: Kommentaroppslag,
  inn: Scenarioinndata,
): Scenarioresultat {
  return kjorScenarier(regelsett, kommentarer, inn).resultat
}

/** Utfallet slik brukeren ser det: tekstene slått opp og grensene flettet inn. */
export function utfallFor(
  regelsett: Scenarioregelsett,
  kommentarer: Kommentaroppslag,
  utfall: Scenarioutfall,
): Exclude<Scenarioresultat, { type: 'mangler' }> {
  const flett = (tekst: string) => flettInn(tekst, regelsett.parametere)
  if (utfall.type === 'manuell') {
    return { type: 'plenum', melding: flett(utfall.melding), veiledning: utfall.veiledning.map(flett) }
  }
  return {
    type: 'kommentarer',
    plasseringer: utfall.plasseringer.map((p) => {
      const tekst = kommentarer.get(p.kommentar)
      if (tekst === undefined) throw new Error(`${regelsett.modul}: mangler kommentaren ${p.kommentar}`)
      return { rolle: p.rolle, merke: p.merke, koder: [...p.koder], tekst }
    }),
    notiser: utfall.notiser.map(flett),
  }
}

/* --- Valideringen -------------------------------------------------------- */

const NOKKEL = /^[a-z0-9]+(_[a-z0-9]+)*$/
const MODULNOKKEL = /^[a-z0-9]+(-[a-z0-9]+)*$/
const ANALYTTKODE = /^[A-Z0-9]+([._-][A-Z0-9]+)*$/

/** Alle ikke-tomme delmengder av kodene, i modulens rekkefølge. */
export function kombinasjoner(koder: readonly string[]): string[][] {
  const ut: string[][] = []
  for (let maske = 1; maske < 2 ** koder.length; maske++) {
    ut.push(koder.filter((_, i) => maske & (1 << i)))
  }
  return ut
}

/**
 * Stedene på tallinjen der et forholdstall kan gi et annet utfall: 0, hver
 * grense, et punkt mellom hver grense og ett over den høyeste. Mellom to av
 * disse punktene gir alle vilkårene samme svar, så å prøve dem er å prøve alt.
 */
export function provepunkter(grenser: readonly number[]): number[] {
  const sortert = [...new Set(grenser)].sort((a, b) => a - b)
  const punkter = [0]
  let forrige = 0
  for (const grense of sortert) {
    if (grense > forrige) punkter.push((forrige + grense) / 2)
    punkter.push(grense)
    forrige = grense
  }
  punkter.push(forrige > 0 ? forrige * 2 : 1)
  return [...new Set(punkter)]
}

/** Alle kombinasjoner av prøvepunkter for forholdene, som forhold → verdi. */
function provesett(forhold: readonly string[], punkter: ReadonlyMap<string, number[]>): Map<string, number>[] {
  return forhold.reduce<Map<string, number>[]>(
    (alle, nokkel) => alle.flatMap((m) => (punkter.get(nokkel) ?? []).map((v) => new Map(m).set(nokkel, v))),
    [new Map()],
  )
}

function beskrivForhold(forhold: ReadonlyMap<string, number>): string {
  return [...forhold].map(([nokkel, verdi]) => `${nokkel} = ${somProsent(verdi)} %`).join(', ')
}

/**
 * Feilene i regelsettet, som meldinger en administrator kan handle på. Tom
 * liste betyr gyldig. `kommentarer` er kommentarene som finnes; scenariene kan
 * bare vise til dem.
 */
export function validerScenarioregelsett(regelsett: Scenarioregelsett, kommentarer: Kommentaroppslag): string[] {
  const feil: string[] = []
  const { analytter } = regelsett

  if (!MODULNOKKEL.test(regelsett.modul)) feil.push(`Ugyldig modulnøkkel «${regelsett.modul}».`)
  if (analytter.length === 0) feil.push('Regelsettet må gjelde minst én analytt.')
  if (analytter.length > 6) feil.push('Regelsettet kan gjelde høyst seks analytter.')
  for (const kode of analytter) {
    if (!ANALYTTKODE.test(kode)) feil.push(`Ugyldig analyttkode «${kode}».`)
  }
  if (new Set(analytter).size !== analytter.length) feil.push('En analyttkode står to ganger.')

  const tekst = (verdi: string, hva: string) => {
    if (verdi.trim() === '' || verdi !== verdi.trim()) feil.push(`${hva} mangler eller har mellomrom i endene.`)
    for (const [, nokkel] of verdi.matchAll(PLASSHOLDER)) {
      if (!regelsett.parametere.some((p) => p.nokkel === nokkel)) feil.push(`${hva} viser til ukjent grense {${nokkel}}.`)
    }
  }
  if (regelsett.verdihjelp !== '') tekst(regelsett.verdihjelp, 'Hjelpeteksten')

  const entydig = (nokler: string[], hva: string) => {
    for (const nokkel of nokler) if (!NOKKEL.test(nokkel)) feil.push(`Ugyldig nøkkel for ${hva}: «${nokkel}».`)
    if (new Set(nokler).size !== nokler.length) feil.push(`To ${hva} har samme nøkkel.`)
  }
  entydig(regelsett.forhold.map((f) => f.nokkel), 'forhold')
  entydig(regelsett.parametere.map((p) => p.nokkel), 'grenser')
  entydig(regelsett.scenarier.map((s) => s.nokkel), 'scenarier')

  for (const f of regelsett.forhold) {
    const hva = `Forholdet ${f.nokkel}`
    if (f.teller.length === 0 || f.nevner.length === 0) feil.push(`${hva} må ha både teller og nevner.`)
    for (const kode of [...f.teller, ...f.nevner]) {
      if (!analytter.includes(kode)) feil.push(`${hva} bruker ${kode}, som ikke hører til modulen.`)
    }
    if (f.teller.some((k) => f.nevner.includes(k))) feil.push(`${hva} har samme analytt i teller og nevner.`)
    if (new Set(f.teller).size !== f.teller.length || new Set(f.nevner).size !== f.nevner.length) {
      feil.push(`${hva} har samme analytt to ganger.`)
    }
    tekst(f.nullmelding, `Meldingen når nevneren i ${f.nokkel} er 0`)
  }

  for (const p of regelsett.parametere) {
    if (p.navn.trim() === '') feil.push(`Grensen ${p.nokkel} mangler navn.`)
    if (!Number.isFinite(p.verdi) || p.verdi <= 0) feil.push(`Grensen ${p.nokkel} må være et tall større enn 0.`)
  }

  for (const s of regelsett.scenarier) feil.push(...validerScenario(regelsett, kommentarer, s, tekst))

  // Bare når delene er i orden, gir det mening å prøve helheten.
  if (feil.length === 0) feil.push(...dekning(regelsett))
  return [...new Set(feil)]
}

function validerScenario(
  regelsett: Scenarioregelsett,
  kommentarer: Kommentaroppslag,
  s: Scenario,
  tekst: (verdi: string, hva: string) => void,
): string[] {
  const feil: string[] = []
  const hva = `Scenariet ${s.nokkel}`

  if (s.pavist.length === 0) feil.push(`${hva} må ha minst én påvist analytt.`)
  if (new Set(s.pavist).size !== s.pavist.length) feil.push(`${hva} har samme analytt to ganger.`)
  for (const kode of s.pavist) {
    if (!regelsett.analytter.includes(kode)) feil.push(`${hva} bruker ${kode}, som ikke hører til modulen.`)
  }

  for (const v of s.vilkar) {
    const forhold = regelsett.forhold.find((f) => f.nokkel === v.forhold)
    if (!forhold) feil.push(`${hva} viser til ukjent forhold ${v.forhold}.`)
    else if (![...forhold.teller, ...forhold.nevner].every((k) => s.pavist.includes(k))) {
      feil.push(`${hva} regner ${v.forhold} av en analytt som ikke er påvist.`)
    }
    if (!regelsett.parametere.some((p) => p.nokkel === v.parameter)) {
      feil.push(`${hva} viser til ukjent grense ${v.parameter}.`)
    }
    if (!(OPERATORER as readonly string[]).includes(v.operator)) feil.push(`${hva} har ugyldig sammenligning.`)
  }

  const u = s.utfall
  if (u.type === 'manuell') {
    tekst(u.melding, `Meldingen i ${s.nokkel}`)
    u.veiledning.forEach((t) => tekst(t, `Veiledningen i ${s.nokkel}`))
    return feil
  }

  u.notiser.forEach((t) => tekst(t, `Notisen i ${s.nokkel}`))
  if (!u.plasseringer.some((p) => p.rolle === 'hoved')) feil.push(`${hva} må ha minst én hovedkommentar.`)
  const merker = u.plasseringer.map((p) => p.merke)
  if (new Set(merker).size !== merker.length) feil.push(`${hva} har to kommentarer med samme merke.`)

  const dekket: string[] = []
  for (const p of u.plasseringer) {
    tekst(p.merke, `Merket i ${s.nokkel}`)
    if (!kommentarer.has(p.kommentar)) {
      feil.push(`${hva} viser til en kommentar som ikke finnes.`)
    }
    if (p.koder.length === 0) feil.push(`${hva} har en kommentar uten analyttkode.`)
    dekket.push(...p.koder)
  }
  // Hver påvist analytt får nøyaktig én kommentar, og ingen andre får noen.
  if (dekket.length !== new Set(dekket).size || !sammeMengde(dekket, s.pavist)) {
    feil.push(`${hva} må gi hver påviste analytt nøyaktig én kommentar, og ingen andre.`)
  }
  return feil
}

/**
 * At hver kombinasjon av påviste analytter og forholdstall gir nøyaktig ett
 * scenario: ingen hull og ingen overlapp.
 */
function dekning(regelsett: Scenarioregelsett): string[] {
  const feil: string[] = []
  for (const pavist of kombinasjoner(regelsett.analytter)) {
    const navn = pavist.join(' + ')
    const kandidater = scenarierFor(regelsett, pavist)
    if (kandidater.length === 0) {
      feil.push(`Ingen scenarier gjelder når ${navn} er påvist.`)
      continue
    }

    const forhold = forholdI(regelsett, kandidater).map((f) => f.nokkel)
    const punkter = new Map(
      forhold.map((nokkel) => [
        nokkel,
        provepunkter(
          kandidater.flatMap((s) =>
            s.vilkar.filter((v) => v.forhold === nokkel).map((v) => grenseFor(regelsett, v.parameter)),
          ),
        ),
      ]),
    )

    for (const verdier of provesett(forhold, punkter)) {
      const treff = kandidater.filter((s) => treffer(regelsett, s, verdier))
      const hvor = verdier.size > 0 ? ` og ${beskrivForhold(verdier)}` : ''
      if (treff.length === 0) feil.push(`Ingen scenarier gjelder når ${navn} er påvist${hvor}.`)
      if (treff.length > 1) {
        feil.push(`Scenariene ${treff.map((s) => s.nokkel).join(' og ')} overlapper når ${navn} er påvist${hvor}.`)
      }
    }
  }
  return feil
}
