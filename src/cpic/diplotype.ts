/**
 * Fra diplotype til resultatet CPIC slår opp på (arbeidspakke F).
 *
 * Oversettelsen er CPICs egen tabell, og ingenting annet:
 *
 *   diplotype → kombinasjon av allelfunksjoner eller aktivitetsverdier
 *             (`genresultat_oppslag`) → resultat (`genresultat`)
 *
 * OUSFAR regner ikke ut aktivitetsverdier, slår ikke sammen alleler og
 * gjetter ikke på skrivemåter. En diplotype CPIC ikke har i tabellen for
 * genet, blir ikke oversatt. Det gjelder også kopitall (CYP2D6 «*1x2»,
 * «*2x≥3»), hybridalleler («*36+*10») og andre sammensatte alleler: de
 * oversettes når, og bare når, CPIC har nøyaktig den diplotypen.
 *
 * Gener CPIC slår opp på allelstatus (HLA-A, HLA-B), oversettes ikke:
 * statusen («HLA-B*57:01 positive») er selve resultatet, og velges direkte.
 *
 * Resultatet brukes bare når anbefalingene for legemiddelet har det, med
 * samme verdi. Ellers sier oppslaget at CPIC ikke har en anbefaling for det.
 *
 * Alt her er rene funksjoner. Søket skjer i nettleseren, i tabellen for
 * genet; diplotypen sendes ikke noe sted.
 */
import type { Allelfunksjon, Diplotypegrunnlag, Diplotypeoppslag } from './lesing'
import type { Genresultat, Oppslagsmetode } from './modell'
import type { Genvalg, Oppslagsgrunnlag } from './oppslag'
import { resultatFor } from './stoffside'

/**
 * Om resultatet for et gen kan oversettes fra en diplotype: bare for gener
 * CPIC slår opp på fenotype eller aktivitetsverdi. For allelstatus (HLA) er
 * statusen resultatet, og for et gen uten kjent metode vet vi ikke hva
 * oversettelsen skulle gi.
 */
export function kanOversettes(metode: Oppslagsmetode | null): boolean {
  return metode === 'PHENOTYPE' || metode === 'ACTIVITY_SCORE'
}

/* --- Søket ----------------------------------------------------------------- */

/** En diplotype i CPICs tabell for genet, med kombinasjonene den står under (normalt én). */
export interface Diplotypeoppforing {
  diplotype: string
  oppslag: Diplotypeoppslag[]
  /** Skrivemåten søket sammenligner med, og den med allelene i motsatt rekkefølge. */
  sammenlign: string[]
}

export interface Diplotypeindeks {
  grunnlag: Diplotypegrunnlag
  oppforinger: Diplotypeoppforing[]
  /** Oppføringene etter CPICs skrivemåte, for oversettelsen. */
  etterDiplotype: ReadonlyMap<string, Diplotypeoppforing>
}

/**
 * Skrivemåten søket sammenligner: uten store bokstaver, mellomrom og
 * stjerner, og med «>=» som «≥». Det gjør at «1/4» finner «*1/*4», men endrer
 * ikke hva som oversettes: brukeren velger alltid CPICs egen diplotype.
 */
export function normaliser(tekst: string): string {
  return tekst.normalize('NFC').toLowerCase().replace(/>=/g, '≥').replace(/[\s*]+/g, '')
}

/** Diplotypen med allelene i motsatt rekkefølge, når den har to. Allelnavnene i CPIC har ingen «/». */
function snudd(diplotype: string): string | null {
  const deler = diplotype.split('/')
  return deler.length === 2 && deler[0] !== deler[1] ? `${deler[1]}/${deler[0]}` : null
}

export function lagDiplotypeindeks(grunnlag: Diplotypegrunnlag): Diplotypeindeks {
  const etterDiplotype = new Map<string, Diplotypeoppforing>()
  for (const o of grunnlag.oppslag) {
    for (const diplotype of o.diplotyper) {
      const funnet = etterDiplotype.get(diplotype)
      if (funnet) {
        if (!funnet.oppslag.includes(o)) funnet.oppslag.push(o)
        continue
      }
      const motsatt = snudd(diplotype)
      etterDiplotype.set(diplotype, {
        diplotype,
        oppslag: [o],
        sammenlign: [normaliser(diplotype), ...(motsatt ? [normaliser(motsatt)] : [])],
      })
    }
  }
  return { grunnlag, oppforinger: [...etterDiplotype.values()], etterDiplotype }
}

export interface Diplotypesok {
  treff: Diplotypeoppforing[]
  /** Hvor mange diplotyper søket passer, også de som ikke er med i `treff`. */
  antall: number
  /** Treffet som er nøyaktig det som ble skrevet (i den ene eller andre rekkefølgen), om noe er det. */
  eksakt: Diplotypeoppforing | null
}

const sortering = new Intl.Collator('en', { numeric: true })

/**
 * Diplotypene som passer søket: først den som er nøyaktig det som ble
 * skrevet, så de som begynner med det, så de som inneholder det; innen hver
 * de korteste først. Rekkefølgen på allelene spiller ingen rolle.
 */
export function sokDiplotyper(indeks: Diplotypeindeks, sok: string, maks = 10): Diplotypesok {
  const s = normaliser(sok)
  if (!s) return { treff: [], antall: 0, eksakt: null }
  const rangert: { o: Diplotypeoppforing; rang: number }[] = []
  for (const o of indeks.oppforinger) {
    const rang = o.sammenlign.some((x) => x === s) ? 0 : o.sammenlign.some((x) => x.startsWith(s)) ? 1 : o.sammenlign.some((x) => x.includes(s)) ? 2 : -1
    if (rang >= 0) rangert.push({ o, rang })
  }
  rangert.sort(
    (a, b) => a.rang - b.rang || a.o.diplotype.length - b.o.diplotype.length || sortering.compare(a.o.diplotype, b.o.diplotype),
  )
  return {
    treff: rangert.slice(0, maks).map((x) => x.o),
    antall: rangert.length,
    eksakt: rangert[0]?.rang === 0 ? rangert[0].o : null,
  }
}

/* --- Oversettelsen --------------------------------------------------------- */

/** Diplotypen oversatt med CPICs tabell. */
export interface Oversettelse {
  gen: string
  diplotype: string
  /** Allelene i diplotypen med funksjonen CPIC har gitt dem, når CPIC har alle; ellers tom. */
  alleler: Allelfunksjon[]
  /** Kombinasjonen diplotypen står under: allelfunksjonene, aktivitetsverdiene og CPICs beskrivelse. */
  oppslag: Diplotypeoppslag
  genresultat: Genresultat
  /**
   * Verdien anbefalingene slås opp på: aktivitetsverdien for gener CPIC slår
   * opp på den, ellers resultatet, slik genets oppslagsmetode sier.
   */
  oppslagsverdi: string
}

export type Oversettelsessvar =
  | { status: 'oversatt'; oversettelse: Oversettelse }
  /** CPIC har ikke diplotypen i tabellen for genet. */
  | { status: 'ukjent' }
  /** CPIC har diplotypen under flere kombinasjoner, eller uten resultat. Den oversettes ikke. */
  | { status: 'uklar' }
  /** Genet slås ikke opp etter diplotype (allelstatus, eller ukjent metode). */
  | { status: 'ikke aktuelt' }

/** Oversetter en diplotype slik CPIC skrev den. */
export function oversett(indeks: Diplotypeindeks, diplotype: string): Oversettelsessvar {
  const { gen, genresultater, alleler } = indeks.grunnlag
  if (!gen || !kanOversettes(gen.oppslagsmetode)) return { status: 'ikke aktuelt' }
  const oppforing = indeks.etterDiplotype.get(diplotype)
  if (!oppforing) return { status: 'ukjent' }
  if (oppforing.oppslag.length !== 1) return { status: 'uklar' }
  const oppslag = oppforing.oppslag[0]!
  const genresultat = genresultater.find((r) => r.id === oppslag.genresultat_id)
  const oppslagsverdi = genresultat && (gen.oppslagsmetode === 'ACTIVITY_SCORE' ? genresultat.aktivitetsverdi : genresultat.resultat)
  if (!genresultat || !oppslagsverdi) return { status: 'uklar' }

  const deler = diplotype.split('/').map((navn) => alleler.find((a) => a.navn === navn))
  return {
    status: 'oversatt',
    oversettelse: {
      gen: gen.symbol,
      diplotype,
      alleler: deler.every((a) => a !== undefined) ? (deler as Allelfunksjon[]) : [],
      oppslag,
      genresultat,
      oppslagsverdi,
    },
  }
}

export type Diplotypevalg =
  | { status: 'valgt'; valg: Genvalg }
  /** Anbefalingene for legemiddelet har ikke resultatet med denne verdien. */
  | { status: 'ingen anbefaling' }

/**
 * Valget oversettelsen gir i oppslaget for et legemiddel: resultatet og den
 * eksakte verdien, når minst én av CPICs anbefalinger for legemiddelet har
 * nøyaktig dem for genet. Ellers ingen valg.
 */
export function valgFraOversettelse(grunnlag: Oppslagsgrunnlag, o: Oversettelse): Diplotypevalg {
  const alternativ = grunnlag.gener
    .find((g) => g.symbol === o.gen)
    ?.alternativer.find((a) => a.resultat === o.genresultat.resultat)
  const harAnbefaling = grunnlag.anbefalinger.some((a) => {
    const b = a.betingelser.find((x) => x.gen === o.gen)
    return b !== undefined && a.oppslagsnokkel[o.gen] === o.oppslagsverdi && resultatFor(b) === o.genresultat.resultat
  })
  if (!alternativ || !harAnbefaling) return { status: 'ingen anbefaling' }
  return { status: 'valgt', valg: { resultat: alternativ.resultat, oppslagsverdi: o.oppslagsverdi, diplotype: o.diplotype } }
}
