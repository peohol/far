import type { Kommentaroppslag } from './kommentarobjekt'
import { flettInn, somProsent, type Forhold, type Operator, type Scenario, type Scenarioregelsett } from './scenario'

/**
 * Et scenarioregelsett skrevet ut slik stoffsiden viser det: vilkårene som
 * lesbar tekst, og kommentarene regelsettet viser til nummerert, så en regel
 * kan vise til «tekst 2» i stedet for å gjenta hele teksten.
 */

export const OPERATORTEGN: Record<Operator, string> = { '<': '<', '<=': '≤', '>': '>', '>=': '≥' }

function sum(koder: readonly string[]): string {
  return koder.join(' + ')
}

/** «OXA / (DIAZ + DMI)», «MOR / KOD». */
export function beskrivForhold(forhold: Forhold): string {
  const del = (koder: readonly string[]) => (koder.length > 1 ? `(${sum(koder)})` : sum(koder))
  return `${del(forhold.teller)} / ${del(forhold.nevner)}`
}

/** Forholdstallet i prosent, slik simulatoren viser det: «12,5 %». */
export function formaterAndel(andel: number): string {
  return `${new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 2 }).format(andel * 100)} %`
}

export interface Scenariobeskrivelse {
  scenario: Scenario
  pavist: string[]
  ikkePavist: string[]
  /** Hvert vilkår som tekst: «OXA / (DIAZ + DMI) ≤ 10 %». */
  vilkar: string[]
  utfall: Utfallsbeskrivelse
}

export type Utfallsbeskrivelse =
  | {
      type: 'kommentarer'
      plasseringer: { rolle: 'hoved' | 'tillegg'; merke: string; tekstnummer: number; koder: string[] }[]
      notiser: string[]
    }
  | { type: 'manuell'; melding: string; veiledning: string[] }

export interface Regelsettbeskrivelse {
  /** Grensene, med verdien i prosent. */
  grenser: { nokkel: string; navn: string; prosent: string }[]
  /** Scenariene gruppert etter hvilke analytter som er påvist, i modulens rekkefølge. */
  scenarier: Scenariobeskrivelse[]
  /** Kommentarene regelsettet viser til, i den rekkefølgen de først brukes; nummeret er plassen + 1. */
  tekster: { id: string; tekst: string; brukesAv: number }[]
}

/** Rekkefølgen en kombinasjon av påviste analytter sorteres i: færrest først, så modulens rekkefølge. */
function kombinasjonsnokkel(analytter: readonly string[], pavist: readonly string[]): number[] {
  return [pavist.length, ...analytter.map((kode) => (pavist.includes(kode) ? 0 : 1))]
}

function sammenlign(a: readonly number[], b: readonly number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const forskjell = (a[i] ?? 0) - (b[i] ?? 0)
    if (forskjell !== 0) return forskjell
  }
  return 0
}

/**
 * Regelsettet slik stoffsiden viser det. Scenariene sorteres etter
 * kombinasjonen av påviste analytter — rekkefølgen i regelsettet betyr ikke
 * noe for utfallet — og innenfor en kombinasjon står de som i regelsettet.
 */
export function beskrivRegelsett(regelsett: Scenarioregelsett, kommentarer: Kommentaroppslag): Regelsettbeskrivelse {
  const flett = (tekst: string) => flettInn(tekst, regelsett.parametere)
  const forhold = new Map(regelsett.forhold.map((f) => [f.nokkel, f]))
  const grense = new Map(regelsett.parametere.map((p) => [p.nokkel, p]))

  const sortert = regelsett.scenarier
    .map((scenario, i) => ({ scenario, i }))
    .sort(
      (a, b) =>
        sammenlign(
          kombinasjonsnokkel(regelsett.analytter, a.scenario.pavist),
          kombinasjonsnokkel(regelsett.analytter, b.scenario.pavist),
        ) || a.i - b.i,
    )
    .map(({ scenario }) => scenario)

  const nummer = new Map<string, number>()
  const bruk = new Map<string, number>()
  for (const scenario of sortert) {
    if (scenario.utfall.type !== 'kommentarer') continue
    for (const id of new Set(scenario.utfall.plasseringer.map((p) => p.kommentar))) {
      if (!nummer.has(id)) nummer.set(id, nummer.size + 1)
      bruk.set(id, (bruk.get(id) ?? 0) + 1)
    }
  }

  return {
    grenser: regelsett.parametere.map((p) => ({ nokkel: p.nokkel, navn: p.navn, prosent: `${somProsent(p.verdi)} %` })),
    scenarier: sortert.map((scenario) => ({
      scenario,
      pavist: regelsett.analytter.filter((kode) => scenario.pavist.includes(kode)),
      ikkePavist: regelsett.analytter.filter((kode) => !scenario.pavist.includes(kode)),
      vilkar: scenario.vilkar.map((v) => {
        const f = forhold.get(v.forhold)
        const p = grense.get(v.parameter)
        return `${f ? beskrivForhold(f) : v.forhold} ${OPERATORTEGN[v.operator]} ${p ? `${somProsent(p.verdi)} %` : v.parameter}`
      }),
      utfall:
        scenario.utfall.type === 'manuell'
          ? { type: 'manuell', melding: flett(scenario.utfall.melding), veiledning: scenario.utfall.veiledning.map(flett) }
          : {
              type: 'kommentarer',
              plasseringer: scenario.utfall.plasseringer.map((p) => ({
                rolle: p.rolle,
                merke: p.merke,
                tekstnummer: nummer.get(p.kommentar) ?? 0,
                koder: [...p.koder],
              })),
              notiser: scenario.utfall.notiser.map(flett),
            },
    })),
    tekster: [...nummer.keys()].map((id) => ({
      id,
      tekst: kommentarer.get(id) ?? '',
      brukesAv: bruk.get(id) ?? 0,
    })),
  }
}
