/**
 * Seksjonen «Analyse ved norske laboratorier» på fagsidene: analysene
 * laboratoriene oppgir i Farmakologiportalen for forbindelsene stoffet har i
 * `src/data/forbindelser.ts`, og for gruppe- og sumanalysene som dekker dem
 * (`docs/farmakologiportalen.md`).
 *
 * Én tabell per matrise og analytt, med begge i tittelen («Serum ·
 * Desmetylcitalopram»), så det aldri er tvil om hva som er målt: matrisene i
 * den rekkefølgen `MATRISER` har dem, og innenfor hver matrise selve stoffet
 * før metabolittene og gruppe- og sumanalysene. Måleområdene vises i enheten
 * brukeren velger når de kan regnes om sikkert: mellom masse og stoffmengde
 * bare med molekylvekten fra PubChem, og bare når koblingen til portalen er
 * verifisert. En sumanalyse regnes aldri om mellom masse og stoffmengde. Det
 * som ikke kan regnes om, står som laboratoriet oppga det, med enheten.
 *
 * Alt her er rene funksjoner.
 */
import {
  lesKonsentrasjonsenhet,
  regnOm,
  visGrense,
  visOmrade,
  type Grense,
  type Visningsenhet,
} from '../enheter/konsentrasjon'
import { ramsOpp } from '../faginnhold/oppsummering'
import type { Panelnokkel } from '../faginnhold/paneler'
import type { Tilleggstekst } from '../faginnhold/sok'
import { FORBINDELSER, type Forbindelse, type Forbindelsesregister } from '../kjemi/forbindelser'
import type { Kjemivisning } from '../kjemi/stoffside'
import type { Laboratoriedata, Labpost, Labutvalg } from './lesing'
import type { Analysedata, Komponentdata } from './modell'
import { MATRISER } from './provematerialer'

export const LABPANEL: Panelnokkel = 'laboratorieanalyser'

/**
 * Analysene fagsidene viser: de laboratoriene tilbyr nå, og som portalen selv
 * viser. Analysene ved et laboratorium som ikke er aktivt, tas ut i
 * `byggLabvisning`.
 */
export function vises(a: Pick<Analysedata, 'status' | 'synlighet'>): boolean {
  return (a.status ?? '').toLowerCase() === 'active' && (a.synlighet ?? '').toLowerCase() !== 'hidden'
}

/** Komponent-ID-ene i portalen for alle forbindelsene i registeret, sortert: det det globale søket leser. */
export function alleLabkomponenter(register: Forbindelsesregister = FORBINDELSER): string[] {
  return [...new Set(register.alle.flatMap((f) => register.fpId(f) ?? []))].sort()
}

/** Komponent-ID-ene i portalen for forbindelsene stoffet har. */
export function labkomponenter(stoff: string, register: Forbindelsesregister = FORBINDELSER): string[] {
  return register.forStoff(stoff).flatMap((f) => register.fpId(f) ?? [])
}

export interface Labrad {
  /** Analysens ID i portalen. */
  id: string
  /** Forbindelsen eller gruppe- og sumanalysen som måles. */
  analytt: string
  /** Forbindelsen på fagsiden; `null` for en gruppe- eller sumanalyse. */
  forbindelse: Forbindelse | null
  laboratorium: string
  laboratorium_id: string | null
  institusjon: string | null
  metode: string | null
  /** Prøvematerialet slik laboratoriet oppga det. */
  provemateriale: string | null
  nedre: Grense | null
  ovre: Grense | null
  /** Enheten måleområdet er oppgitt i, som laboratoriet skrev den, og OUSFARs skrivemåte når den kan regnes om. */
  enhet: { original: string | null; enhet: string | null }
  /** Enheten laboratoriet svarer ut i. */
  benevning: string | null
  /** Molekylvekten omregningen mellom masse og stoffmengde kan bruke (PubChem); `null` når den ikke skal regnes om. */
  molvekt: number | null
}

export interface Labtabell {
  /** Matrisens nøkkel (eller `annet:<prøvemateriale>` for et OUSFAR ikke kjenner) og analyttens. */
  nokkel: string
  /** Prøvematerialet: det radene har, når de har det samme («Serum»); ellers matrisen («Serum og plasma»). */
  materiale: string
  analytt: string
  /** Materialet og analytten: «Serum · Citalopram». */
  tittel: string
  rader: Labrad[]
  /** Om prøvematerialet skal stå på hver rad: når radene ikke har det samme. */
  visProvemateriale: boolean
}

export interface Labvisning {
  tabeller: Labtabell[]
  /** Forbindelsene som bare er koblet til portalen på navnet. */
  usikre: Forbindelse[]
  /** Når dataene sist ble kontrollert mot portalen. */
  kontrollert_kl: string | null
}

export const TOM_LABVISNING: Labvisning = { tabeller: [], usikre: [], kontrollert_kl: null }

const sammenlign = (a: string, b: string) => a.localeCompare(b, 'nb')

/** Det utvalget leser av en analyse, både på fagsiden og i søket. */
export type Utvalgsanalyse = Pick<Analysedata, 'komponent_id' | 'laboratorium_id' | 'metode' | 'status' | 'synlighet'> &
  Partial<Pick<Analysedata, 'navn' | 'laboratorium' | 'institusjon'>>

/** Komponentene, analysene, laboratoriene og institusjonene, med så mye av hver som trengs. */
export interface Analyseutvalg<A extends Utvalgsanalyse = Utvalgsanalyse> {
  komponenter: readonly Labpost<Pick<Komponentdata, 'navn' | 'gruppe'>>[]
  analyser: readonly Labpost<A>[]
  laboratorier: readonly Labpost<Pick<Laboratoriedata, 'navn' | 'institusjon_id' | 'institusjon' | 'aktiv'>>[]
  institusjoner: readonly Labpost<{ navn: string }>[]
}

/** En analyse stoffet skal vise, med analytten og laboratoriet slått opp. */
export interface Valgtanalyse<A extends Utvalgsanalyse> {
  id: string
  analyse: A
  /** Forbindelsen på fagsiden; `null` for en gruppe- eller sumanalyse. */
  forbindelse: Forbindelse | null
  analytt: string
  laboratorium: string
  laboratorium_id: string | null
  institusjon: string | null
}

/**
 * Analysene for forbindelsene til et stoff, og for gruppe- og sumanalysene
 * som dekker dem: bare de som vises, ved laboratorier som er i drift. Det
 * samme utvalget gir tabellene på fagsiden og treffene i søket.
 */
export function velgAnalyser<A extends Utvalgsanalyse>(
  forbindelser: readonly Forbindelse[],
  utvalg: Analyseutvalg<A>,
  register: Forbindelsesregister = FORBINDELSER,
): Valgtanalyse<A>[] {
  const etterId = new Map(forbindelser.flatMap((f) => (register.fpId(f) ? [[register.fpId(f)!, f] as const] : [])))
  const komponenter = new Map(utvalg.komponenter.map((k) => [k.id, k.data]))
  const laboratorier = new Map(utvalg.laboratorier.map((l) => [l.id, l.data]))
  const institusjoner = new Map(utvalg.institusjoner.map((i) => [i.id, i.data.navn]))
  return utvalg.analyser.flatMap(({ id, data: a }): Valgtanalyse<A>[] => {
    if (!vises(a)) return []
    const forbindelse = etterId.get(a.komponent_id) ?? null
    const komponent = komponenter.get(a.komponent_id)
    // En komponent som verken er forbindelsens eller en gruppe som dekker den, hører ikke hjemme her.
    if (!forbindelse && !komponent?.gruppe.some((g) => etterId.has(g))) return []
    const lab = a.laboratorium_id ? laboratorier.get(a.laboratorium_id) : undefined
    if (lab?.aktiv === false) return []
    return [
      {
        id,
        analyse: a,
        forbindelse,
        analytt: forbindelse?.navn ?? komponent?.navn ?? a.navn ?? a.komponent_id,
        laboratorium: lab?.navn ?? a.laboratorium ?? 'Laboratoriet er ikke oppgitt',
        laboratorium_id: lab ? a.laboratorium_id : null,
        institusjon: (lab?.institusjon_id && institusjoner.get(lab.institusjon_id)) || lab?.institusjon || a.institusjon || null,
      },
    ]
  })
}

export function byggLabvisning(
  stoff: string,
  utvalg: Labutvalg | null,
  kjemi: Pick<Kjemivisning, 'rader'> | null,
  register: Forbindelsesregister = FORBINDELSER,
): Labvisning {
  const forbindelser = register.forStoff(stoff)
  const usikre = forbindelser.filter((f) => f.farmakologiportalen?.status === 'usikker')
  if (!utvalg) return { ...TOM_LABVISNING, usikre }

  const rekkefolge = new Map(forbindelser.map((f, i) => [f.nokkel, i]))
  const molvekter = new Map(
    (kjemi?.rader ?? []).flatMap((r) => (r.data ? [[r.forbindelse.nokkel, Number(r.data.molvekt)] as const] : [])),
  )

  const grupper = new Map<string, { matrise: string; rader: Labrad[] }>()
  for (const { analyse: a, ...valgt } of velgAnalyser(forbindelser, utvalg, register)) {
    const { forbindelse } = valgt
    const mw = forbindelse?.farmakologiportalen?.status === 'verifisert' ? molvekter.get(forbindelse.nokkel) : undefined
    const rad: Labrad = {
      ...valgt,
      metode: a.metode,
      provemateriale: a.provemateriale.original,
      nedre: a.maleomrade.nedre,
      ovre: a.maleomrade.ovre,
      enhet: a.maleomrade.enhet,
      benevning: a.svarenhet.original,
      molvekt: mw && Number.isFinite(mw) && mw > 0 ? mw : null,
    }
    const matrise = a.provemateriale.matrise ?? `annet:${a.provemateriale.original ?? 'Prøvemateriale ikke oppgitt'}`
    const nokkel = `${matrise}|${forbindelse?.nokkel ?? `fp:${a.komponent_id}`}`
    const gruppe = grupper.get(nokkel)
    if (gruppe) gruppe.rader.push(rad)
    else grupper.set(nokkel, { matrise, rader: [rad] })
  }

  const plass = (matrise: string) => {
    const i = MATRISER.findIndex((m) => m.nokkel === matrise)
    return i < 0 ? MATRISER.length : i
  }
  // Selve stoffet og metabolittene i registerets rekkefølge, gruppe- og sumanalysene etter dem.
  const analyttorden = (r: Labrad) => (r.forbindelse ? (rekkefolge.get(r.forbindelse.nokkel) ?? 0) : forbindelser.length)
  const tabeller = [...grupper].map(([nokkel, { matrise, rader }]): Labtabell => {
    rader.sort((a, b) => sammenlign(a.laboratorium, b.laboratorium) || sammenlign(a.id, b.id))
    const materialer = new Set(rader.map((r) => r.provemateriale ?? ''))
    const eneste = materialer.size === 1 ? rader[0]!.provemateriale : null
    const materiale = eneste ?? MATRISER.find((m) => m.nokkel === matrise)?.navn ?? matrise.replace(/^annet:/, '')
    const analytt = rader[0]!.analytt
    return { nokkel, materiale, analytt, tittel: `${materiale} · ${analytt}`, rader, visProvemateriale: materialer.size > 1 }
  })
  const matriseAv = (t: Labtabell) => grupper.get(t.nokkel)!.matrise
  tabeller.sort(
    (a, b) =>
      plass(matriseAv(a)) - plass(matriseAv(b)) ||
      sammenlign(matriseAv(a), matriseAv(b)) ||
      analyttorden(a.rader[0]!) - analyttorden(b.rader[0]!) ||
      sammenlign(a.analytt, b.analytt),
  )
  return { usikre, kontrollert_kl: utvalg.kilde.kontrollert_kl, tabeller }
}

/** Et måleområde slik det vises: tallene, og enheten når den ikke er den valgte. */
export interface Maleomradevisning {
  tekst: string
  /** Enheten tallene står i, når de ikke er regnet om til den valgte. */
  enhet: string | null
  omregnet: boolean
}

/**
 * Måleområdet i den valgte enheten, med høyst to gjeldende sifre. Kan det
 * ikke regnes om, står det som laboratoriet oppga det, med enheten.
 */
export function maleomrade(rad: Pick<Labrad, 'nedre' | 'ovre' | 'enhet' | 'molvekt'>, valgt: Visningsenhet): Maleomradevisning {
  const grenser = [rad.nedre, rad.ovre]
  if (grenser.every((g) => g === null)) return { tekst: 'Ikke oppgitt', enhet: null, omregnet: false }
  const fra = lesKonsentrasjonsenhet(rad.enhet.enhet)
  const til = lesKonsentrasjonsenhet(valgt)!
  const omregnet = grenser.map((g) => (g && g.verdi !== null && fra ? regnOm(g.verdi, fra, til, rad.molvekt) : null))
  if (grenser.every((g, i) => g === null || omregnet[i] !== null)) {
    const [nedre, ovre] = grenser.map((g, i) => (g ? visGrense(g, omregnet[i]!) : null))
    return { tekst: visOmrade(nedre!, ovre!), enhet: null, omregnet: true }
  }
  const [nedre, ovre] = grenser.map((g) => (g ? visGrense(g) : null))
  return { tekst: visOmrade(nedre!, ovre!), enhet: rad.enhet.original, omregnet: false }
}

/** Benevninger i portalen som ikke sier noe om svaret. */
const TOMME_BENEVNINGER = new Set(['annen enhet'])

/**
 * Hva laboratoriet svarer ut i, når det ikke er en konsentrasjon og ikke
 * enheten måleområdet står i: et kvalitativt svar («Kvalitativ
 * (positiv/negativ)») eller en enhet per kreatinin. En konsentrasjon sier
 * ikke noe måleområdet i den valgte enheten ikke sier. `null` når det ikke er
 * noe å bemerke.
 */
export function bemerkning(rad: Pick<Labrad, 'benevning' | 'enhet'>): string | null {
  const benevning = rad.benevning?.trim()
  if (!benevning || TOMME_BENEVNINGER.has(benevning.toLowerCase())) return null
  if (lesKonsentrasjonsenhet(benevning) || benevning === rad.enhet.original?.trim()) return null
  return `Svar: ${benevning}`
}

/** Hva seksjonen viser når den er lukket: radene per prøvemateriale, «Serum 9 · Fullblod 2». */
export function laboppsummering(visning: Labvisning): string {
  const antall = new Map<string, number>()
  for (const t of visning.tabeller) antall.set(t.materiale, (antall.get(t.materiale) ?? 0) + t.rader.length)
  return ramsOpp([...antall].map(([materiale, n]) => `${materiale} ${n}`))
}

/** Ankeret til raden for en analyse. */
export function labsted(id: string): string {
  return `lab:${id}`
}

/** Det søket finner en analyse på. */
export type Labsokerad = Pick<Labrad, 'id' | 'analytt' | 'laboratorium' | 'institusjon' | 'metode'>

/** Analyttene, laboratoriene og metodene, slik søket på siden finner dem. */
export function labsoketekster(visning: Pick<Labvisning, 'tabeller'>): Tilleggstekst[] {
  return labradtekster(visning.tabeller.flatMap((t) => t.rader))
}

/** Søketekstene for analysene, på siden og i det globale søket. */
export function labradtekster(rader: readonly Labsokerad[]): Tilleggstekst[] {
  return rader.flatMap((r): Tilleggstekst[] => {
    const element = { id: labsted(r.id), tittel: `${r.analytt} · ${r.laboratorium}` }
    const tekst = (felt: Tilleggstekst['felt'], verdi: string | null): Tilleggstekst[] =>
      verdi ? [{ panel: LABPANEL, element, felt, tekst: verdi }] : []
    return [...tekst('overskrift', r.analytt), ...tekst('verdi', r.laboratorium), ...tekst('verdi', r.institusjon), ...tekst('verdi', r.metode)]
  })
}

/**
 * Søketekstene for analysene et stoff har, fra søkedataene
 * (`les_laboratoriesok`): de samme analysene og tekstene som seksjonen på
 * fagsiden, i samme rekkefølge som der.
 */
export function labsoketeksterFor(
  stoff: string,
  sokedata: Analyseutvalg,
  register: Forbindelsesregister = FORBINDELSER,
): Tilleggstekst[] {
  const forbindelser = register.forStoff(stoff)
  if (!forbindelser.some((f) => register.fpId(f))) return []
  return labradtekster(velgAnalyser(forbindelser, sokedata, register).map(({ analyse, ...r }) => ({ ...r, metode: analyse.metode })))
}
