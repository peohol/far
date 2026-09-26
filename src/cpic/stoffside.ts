/**
 * Hvor CPIC-dataene står på en stoffside: gruppen «Anbefalinger fra CPIC» i
 * seksjonen «Farmakogenetikk», med ett detaljkort per CPIC-retningslinje og
 * ett for parene CPIC har vurdert uten retningslinje.
 *
 * Alt her er rene funksjoner. Søket på siden (`Analyttside.tsx`) og søket i
 * hele kunnskapsbasen (`src/faginnhold/globaltSok.ts`) bruker de samme, så et
 * treff peker på det samme stedet uansett hvilket søk som fant det.
 *
 * Verdiene er CPICs egne og oversettes ikke: fenotyper, aktivitetsverdier,
 * allelstatus, anbefalingene, styrken og nivåene står som CPIC skrev dem.
 * Visningen slår bare sammen anbefalinger som er like i alt annet enn
 * aktivitetsverdien (se {@link byggCpicvisning}); den utleder ingenting.
 */
import { antall, ramsOpp } from '../faginnhold/oppsummering'
import { FARMAKOGENETIKKPANEL } from '../clinpgx/stoffside'
import type { Tilleggstekst } from '../faginnhold/sok'
import type { Cpickilde, Cpicutvalg, RetningslinjeMedPublikasjoner } from './lesing'
import type { Anbefaling, Betingelse, Gen, Legemiddel, Oppslagsmetode, Par } from './modell'


/* --- Utvalget for en side -------------------------------------------------- */

/**
 * Den delen av et utvalg som gjelder legemidlene med disse ClinPGx-ID-ene,
 * slik `les_cpic` ville gitt den. Da kan dataene for mange sider leses i ett
 * kall og deles opp etterpå.
 */
export function cpicFor(utvalg: Cpicutvalg, clinpgxIder: readonly string[]): Cpicutvalg {
  const egne = new Set(clinpgxIder)
  const legemidler = utvalg.legemidler.filter((l) => l.clinpgx_id !== null && egne.has(l.clinpgx_id))
  const legemiddelider = new Set(legemidler.map((l) => l.id))
  const par = utvalg.par.filter((p) => legemiddelider.has(p.legemiddel_id))
  const anbefalinger = utvalg.anbefalinger.filter((a) => legemiddelider.has(a.legemiddel_id))
  const retningslinjeider = new Set<string | null>([
    ...legemidler.map((l) => l.retningslinje_id),
    ...par.map((p) => p.retningslinje_id),
    ...anbefalinger.map((a) => a.retningslinje_id),
  ])
  const gener = new Set([...par.map((p) => p.gen), ...anbefalinger.flatMap((a) => a.betingelser.map((b) => b.gen))])
  return {
    kilde: utvalg.kilde,
    legemidler,
    par,
    retningslinjer: utvalg.retningslinjer.filter((r) => retningslinjeider.has(r.id)),
    anbefalinger,
    gener: utvalg.gener.filter((g) => gener.has(g.symbol)),
    genresultater: utvalg.genresultater.filter((r) => gener.has(r.gen)),
  }
}

/* --- Detaljkortene ---------------------------------------------------------- */

/** Detaljkortet for en CPIC-retningslinje. CPICs ID står i direktelenker, så den endres ikke. */
export function cpickort(retningslinjeId: string): string {
  return `cpic-${retningslinjeId}`
}

/** Detaljkortet med parene CPIC har vurdert uten retningslinje. */
export const CPIC_ANDRE_PAR_KORT = 'cpic-andre-par'

/* --- Resultattypene -------------------------------------------------------- */

/** Hva slags genetisk resultat CPIC slår opp anbefalingene på, for hver oppslagsmetode. */
const RESULTATTYPER: Record<Oppslagsmetode, string> = {
  PHENOTYPE: 'fenotype',
  ACTIVITY_SCORE: 'aktivitetsverdi',
  ALLELE_STATUS: 'allelstatus',
}

/** «fenotype», «aktivitetsverdi» eller «allelstatus»; `null` når CPIC ikke har oppgitt metoden. */
export function resultattype(metode: Oppslagsmetode | null | undefined): string | null {
  return metode ? RESULTATTYPER[metode] : null
}

/** Verdien CPIC bruker når et felt ikke gjelder. Den står i dataene, men vises ikke som innhold. */
const IKKE_AKTUELT = 'n/a'

function aktuell(tekst: string | null | undefined): string | null {
  const t = tekst?.trim()
  return t && t.toLowerCase() !== IKKE_AKTUELT ? t : null
}

/* --- Visningen ------------------------------------------------------------- */

/** Betingelsen for ett gen i en gruppe anbefalinger, som den vises. */
export interface Betingelsevisning {
  gen: string
  /** Fenotypen, allelstatusen eller verdien CPIC slår opp på, som CPIC skrev den. */
  resultat: string
  /** Aktivitetsverdiene som gir anbefalingen, for gener CPIC slår opp på aktivitetsverdi. */
  aktivitetsverdier: string[]
  implikasjon: string | null
}

/**
 * Én eller flere av CPICs anbefalinger som er like i alt annet enn
 * aktivitetsverdien: samme legemiddel, populasjon, fenotyper eller
 * allelstatus, implikasjoner, anbefaling, styrke og kommentarer.
 */
export interface Anbefalingsgruppe {
  /** ID-en til den første av anbefalingene. */
  id: string
  /** CPICs ID-er for anbefalingene gruppen står for. */
  anbefalinger: string[]
  legemiddel_id: string
  betingelser: Betingelsevisning[]
  anbefaling: string | null
  /** Styrken, som CPIC skrev den: «Strong», «Moderate», «Optional» … */
  klassifisering: string | null
  populasjon: string | null
  kommentarer: string | null
  /** Hva slags råd anbefalingen inneholder, etter CPICs merking. */
  radtyper: string[]
}

/** Et gen i en retningslinje: hva slags resultat anbefalingene bygger på, og hvilke resultater de nevner. */
export interface Genvisning {
  symbol: string
  resultattype: string | null
  /** Resultatkategoriene anbefalingene gjelder, i CPICs rekkefølge. */
  resultater: string[]
}

/** Et detaljkort for én CPIC-retningslinje, med det siden har av den. */
export interface Retningslinjekort {
  kort: string
  retningslinje: RetningslinjeMedPublikasjoner
  /** Legemidlene på siden retningslinjen gjelder. */
  legemidler: Legemiddel[]
  par: Par[]
  gener: Genvisning[]
  grupper: Anbefalingsgruppe[]
  antall_anbefalinger: number
  klassifiseringer: string[]
  populasjoner: string[]
}

/** CPIC-dataene for en side, ordnet slik seksjonen viser dem. */
export interface Cpicvisning {
  kilde: Cpickilde
  legemidler: Legemiddel[]
  retningslinjer: Retningslinjekort[]
  /** Parene uten retningslinje i CPIC-databasen, eller med en retningslinje OUSFAR ikke har. */
  andre_par: Par[]
  /** Genene: fra retningslinjene, så de andre parene. */
  gener: string[]
}

function unike<T>(liste: readonly T[]): T[] {
  return [...new Set(liste)]
}

function radtyper(a: Anbefaling): string[] {
  return [
    a.dosejustering && 'Dosering',
    a.alternativt_legemiddel && 'Alternativt legemiddel',
    a.annen_veiledning && 'Annen forskrivningsveiledning',
  ].filter((t): t is string => !!t)
}

/**
 * Om genet slås opp på aktivitetsverdi og betingelsen har en fenotype. Da
 * står fenotypen som resultatet, og aktivitetsverdiene som gir samme
 * anbefaling, samles under den.
 */
function samlesPaFenotype(b: Betingelse, metode: Oppslagsmetode | null): boolean {
  return metode === 'ACTIVITY_SCORE' && aktuell(b.fenotype) !== null
}

function resultatFor(b: Betingelse): string {
  return aktuell(b.fenotype) ?? aktuell(b.allelstatus) ?? b.oppslagsverdi ?? 'Ikke oppgitt'
}

/**
 * Anbefalingene gruppert: de som er like i alt annet enn aktivitetsverdien,
 * står sammen, med aktivitetsverdiene listet. Rekkefølgen er CPICs, etter
 * den første anbefalingen i hver gruppe. Ingenting utledes: hver gruppe er
 * nøyaktig anbefalingene CPIC har.
 */
export function grupperAnbefalinger(
  anbefalinger: readonly Anbefaling[],
  metoder: ReadonlyMap<string, Oppslagsmetode | null>,
): Anbefalingsgruppe[] {
  const grupper = new Map<string, Anbefalingsgruppe>()
  for (const a of anbefalinger) {
    const betingelser = a.betingelser.map((b) => {
      const samles = samlesPaFenotype(b, metoder.get(b.gen) ?? null)
      return {
        gen: b.gen,
        resultat: resultatFor(b),
        // Uten samling er oppslagsverdien en del av det som skiller gruppene.
        skille: samles ? null : b.oppslagsverdi,
        aktivitetsverdi: metoder.get(b.gen) === 'ACTIVITY_SCORE' ? (b.aktivitetsverdi ?? b.oppslagsverdi) : null,
        implikasjon: b.implikasjon,
      }
    })
    const nokkel = JSON.stringify([
      a.legemiddel_id,
      a.populasjon,
      a.anbefaling,
      a.klassifisering,
      a.kommentarer,
      radtyper(a),
      betingelser.map((b) => [b.gen, b.resultat, b.skille, b.implikasjon]),
    ])
    const gruppe = grupper.get(nokkel)
    if (gruppe) {
      gruppe.anbefalinger.push(a.id)
      gruppe.betingelser.forEach((b, i) => {
        const verdi = betingelser[i]?.aktivitetsverdi
        if (verdi && !b.aktivitetsverdier.includes(verdi)) b.aktivitetsverdier.push(verdi)
      })
      continue
    }
    grupper.set(nokkel, {
      id: a.id,
      anbefalinger: [a.id],
      legemiddel_id: a.legemiddel_id,
      betingelser: betingelser.map((b) => ({
        gen: b.gen,
        resultat: b.resultat,
        aktivitetsverdier: b.aktivitetsverdi ? [b.aktivitetsverdi] : [],
        implikasjon: b.implikasjon,
      })),
      anbefaling: a.anbefaling,
      klassifisering: a.klassifisering,
      populasjon: a.populasjon,
      kommentarer: aktuell(a.kommentarer),
      radtyper: radtyper(a),
    })
  }
  return [...grupper.values()]
}

export function byggCpicvisning(utvalg: Cpicutvalg): Cpicvisning {
  const metoder = new Map(utvalg.gener.map((g: Gen) => [g.symbol, g.oppslagsmetode]))
  const legemidler = new Map(utvalg.legemidler.map((l) => [l.id, l]))
  const retningslinjer = new Map(utvalg.retningslinjer.map((r) => [r.id, r]))
  const ider = unike(
    [
      ...utvalg.legemidler.map((l) => l.retningslinje_id),
      ...utvalg.par.map((p) => p.retningslinje_id),
      ...utvalg.anbefalinger.map((a) => a.retningslinje_id),
    ].filter((id): id is string => id !== null && retningslinjer.has(id)),
  )

  const kort = ider
    .map((id): Retningslinjekort => {
      const retningslinje = retningslinjer.get(id)!
      const par = utvalg.par.filter((p) => p.retningslinje_id === id)
      const anbefalinger = utvalg.anbefalinger.filter((a) => a.retningslinje_id === id)
      const grupper = grupperAnbefalinger(anbefalinger, metoder)
      const legemiddelider = unike([
        ...utvalg.legemidler.filter((l) => l.retningslinje_id === id).map((l) => l.id),
        ...par.map((p) => p.legemiddel_id),
        ...anbefalinger.map((a) => a.legemiddel_id),
      ])
      // Genene i retningslinjens rekkefølge, så de andre fra parene og anbefalingene.
      const symboler = unike([
        ...retningslinje.gener.filter((g) => par.some((p) => p.gen === g) || anbefalinger.some((a) => a.betingelser.some((b) => b.gen === g))),
        ...par.map((p) => p.gen),
        ...anbefalinger.flatMap((a) => a.betingelser.map((b) => b.gen)),
      ])
      return {
        kort: cpickort(id),
        retningslinje,
        legemidler: legemiddelider.flatMap((l) => legemidler.get(l) ?? []),
        par,
        gener: symboler.map((symbol) => ({
          symbol,
          resultattype: resultattype(metoder.get(symbol)),
          resultater: unike(grupper.flatMap((g) => g.betingelser.filter((b) => b.gen === symbol).map((b) => b.resultat))),
        })),
        grupper,
        antall_anbefalinger: anbefalinger.length,
        klassifiseringer: unike(grupper.map((g) => g.klassifisering).filter((k): k is string => !!k)),
        populasjoner: unike(grupper.map((g) => g.populasjon).filter((p): p is string => !!p)),
      }
    })
    .sort((a, b) => a.retningslinje.navn.localeCompare(b.retningslinje.navn, 'en') || a.kort.localeCompare(b.kort))

  const andre_par = utvalg.par
    .filter((p) => p.retningslinje_id === null || !retningslinjer.has(p.retningslinje_id))
    .sort((a, b) => a.gen.localeCompare(b.gen) || a.legemiddel_id.localeCompare(b.legemiddel_id))

  return {
    kilde: utvalg.kilde,
    legemidler: utvalg.legemidler,
    retningslinjer: kort,
    andre_par,
    gener: unike([...kort.flatMap((k) => k.gener.map((g) => g.symbol)), ...andre_par.map((p) => p.gen)]),
  }
}

export function harCpic(visning: Cpicvisning): boolean {
  return visning.retningslinjer.length + visning.andre_par.length > 0
}

/** Om CPIC-dataene er hentet minst én gang. */
export function cpicHentet(kilde: Pick<Cpickilde, 'endret_kl' | 'kontrollert_kl'>): boolean {
  return !!(kilde.endret_kl || kilde.kontrollert_kl)
}

/* --- Tekstene -------------------------------------------------------------- */

/** «CYP2D6 (aktivitetsverdi)»: genet med resultattypen. */
export function genmedtype(g: Pick<Genvisning, 'symbol' | 'resultattype'>): string {
  return g.resultattype ? `${g.symbol} (${g.resultattype})` : g.symbol
}

/** «CYP2D6 Intermediate Metabolizer, aktivitetsverdi 0.5 eller 1.0»: betingelsen for ett gen. */
export function betingelsetekst(b: Pick<Betingelsevisning, 'gen' | 'resultat' | 'aktivitetsverdier'>): string {
  // Allelstatusen nevner ofte genet selv («HLA-B*57:01 positive»).
  const hode = b.resultat.startsWith(b.gen) ? b.resultat : `${b.gen} ${b.resultat}`
  const verdier = b.aktivitetsverdier.filter((v) => v !== b.resultat)
  if (verdier.length === 0) return hode
  const liste = verdier.length === 1 ? verdier[0] : `${verdier.slice(0, -1).join(', ')} eller ${verdier[verdier.length - 1]}`
  return `${hode}, aktivitetsverdi ${liste}`
}

/** Oppsummeringen av et retningslinjekort: genene med resultattypen, antallet anbefalinger og styrkene. */
export function retningslinjeoppsummering(k: Retningslinjekort): string {
  return ramsOpp([
    k.gener.map(genmedtype).join(', '),
    k.antall_anbefalinger > 0
      ? antall(k.antall_anbefalinger, 'anbefaling', 'anbefalinger')
      : 'ingen strukturerte anbefalinger',
    k.klassifiseringer.join(', '),
  ])
}

/** Det den lukkede seksjonen sier om CPIC-dataene, f.eks. «32 CPIC-anbefalinger». Tom når det ikke er noe. */
export function oppsummerCpic(visning: Cpicvisning): string {
  const n = visning.retningslinjer.reduce((sum, k) => sum + k.antall_anbefalinger, 0)
  if (n > 0) return antall(n, 'CPIC-anbefaling', 'CPIC-anbefalinger')
  if (visning.retningslinjer.length > 0) return antall(visning.retningslinjer.length, 'CPIC-retningslinje', 'CPIC-retningslinjer')
  return visning.andre_par.length > 0 ? antall(visning.andre_par.length, 'CPIC-par', 'CPIC-par') : ''
}

/** Hva siden sier om CPIC-versjonen: «CPIC, release v1.60.1 av 12.08.2026». */
export function cpicversjon(kilde: Pick<Cpickilde, 'release' | 'release_dato'>, dato: (t: string | null) => string | null): string {
  if (!kilde.release) return 'CPIC'
  const d = dato(kilde.release_dato)
  return `CPIC, release ${kilde.release}${d ? ` av ${d}` : ''}`
}

/* --- Søket ----------------------------------------------------------------- */

/**
 * Tekstene fra CPIC søket finner, med detaljkortet de står i: retningslinjens
 * navn og genene, resultattypene og resultatene, styrkene, hver anbefaling
 * med betingelsene, og genene i de andre parene. Implikasjonene og
 * kommentarene står under «Mer om anbefalingen» og er ikke med, så et treff
 * aldri peker på en tekst som er skjult.
 */
export function cpictekster(visning: Cpicvisning): Tilleggstekst[] {
  const tekster: Tilleggstekst[] = []
  const legg = (kort: string, tittel: string, felt: Tilleggstekst['felt'], tekst: string) =>
    tekster.push({ panel: FARMAKOGENETIKKPANEL, element: { id: kort, tittel }, detaljkort: kort, felt, tekst })

  for (const k of visning.retningslinjer) {
    const tittel = k.retningslinje.navn
    legg(k.kort, tittel, 'overskrift', ramsOpp([tittel, 'CPIC', ...k.gener.map((g) => g.symbol)]))
    legg(k.kort, tittel, 'verdi', ramsOpp([...k.gener.map(genmedtype), ...k.gener.flatMap((g) => g.resultater), ...k.klassifiseringer]))
    for (const g of k.grupper) {
      legg(k.kort, tittel, 'fritekst', ramsOpp([...g.betingelser.map(betingelsetekst), g.anbefaling]))
    }
  }
  if (visning.andre_par.length > 0) {
    const tittel = ANDRE_PAR_TITTEL
    legg(CPIC_ANDRE_PAR_KORT, tittel, 'verdi', ramsOpp(visning.andre_par.map((p) => p.gen)))
  }
  return tekster.filter((t) => t.tekst.trim())
}

export const ANDRE_PAR_TITTEL = 'Andre gen–legemiddel-par i CPIC'
