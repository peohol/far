/**
 * Seksjonen «Analyse ved norske laboratorier» på fagsidene: analysene
 * laboratoriene oppgir i Farmakologiportalen for forbindelsene stoffet har i
 * `src/data/forbindelser.ts`, og for gruppe- og sumanalysene som dekker dem
 * (`docs/farmakologiportalen.md`).
 *
 * Én tabell per matrise, i den rekkefølgen `MATRISER` har dem. Måleområdene
 * vises i enheten brukeren velger når de kan regnes om sikkert: mellom masse
 * og stoffmengde bare med molekylvekten fra PubChem, og bare når koblingen
 * til portalen er verifisert. En sumanalyse regnes aldri om mellom masse og
 * stoffmengde. Det som ikke kan regnes om, står som laboratoriet oppga det,
 * med enheten.
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
import type { Labutvalg } from './lesing'
import type { Analysedata } from './modell'
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
  /** Matrisens nøkkel, eller `annet:<prøvemateriale>` for et OUSFAR ikke kjenner. */
  nokkel: string
  tittel: string
  rader: Labrad[]
  /** Om analytten skal stå i en egen kolonne: når tabellen har mer enn én. */
  visAnalytt: boolean
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

export function byggLabvisning(
  stoff: string,
  utvalg: Labutvalg | null,
  kjemi: Pick<Kjemivisning, 'rader'> | null,
  register: Forbindelsesregister = FORBINDELSER,
): Labvisning {
  const forbindelser = register.forStoff(stoff)
  const usikre = forbindelser.filter((f) => f.farmakologiportalen?.status === 'usikker')
  if (!utvalg) return { ...TOM_LABVISNING, usikre }

  const etterId = new Map(forbindelser.flatMap((f) => (register.fpId(f) ? [[register.fpId(f)!, f] as const] : [])))
  const rekkefolge = new Map(forbindelser.map((f, i) => [f.nokkel, i]))
  const komponenter = new Map(utvalg.komponenter.map((k) => [k.id, k.data]))
  const laboratorier = new Map(utvalg.laboratorier.map((l) => [l.id, l.data]))
  const institusjoner = new Map(utvalg.institusjoner.map((i) => [i.id, i.data.navn]))
  const molvekter = new Map(
    (kjemi?.rader ?? []).flatMap((r) => (r.data ? [[r.forbindelse.nokkel, Number(r.data.molvekt)] as const] : [])),
  )

  const tabeller = new Map<string, Labrad[]>()
  for (const { id, data: a } of utvalg.analyser) {
    if (!vises(a)) continue
    const forbindelse = etterId.get(a.komponent_id) ?? null
    const komponent = komponenter.get(a.komponent_id)
    // En komponent som verken er forbindelsens eller en gruppe som dekker den, hører ikke hjemme her.
    if (!forbindelse && !komponent?.gruppe.some((g) => etterId.has(g))) continue
    const lab = a.laboratorium_id ? laboratorier.get(a.laboratorium_id) : undefined
    if (lab?.aktiv === false) continue
    const mw = forbindelse?.farmakologiportalen?.status === 'verifisert' ? molvekter.get(forbindelse.nokkel) : undefined
    const rad: Labrad = {
      id,
      analytt: forbindelse?.navn ?? komponent?.navn ?? a.navn,
      forbindelse,
      laboratorium: lab?.navn ?? a.laboratorium ?? 'Laboratoriet er ikke oppgitt',
      laboratorium_id: lab ? a.laboratorium_id : null,
      institusjon: (lab?.institusjon_id && institusjoner.get(lab.institusjon_id)) || lab?.institusjon || a.institusjon,
      metode: a.metode,
      provemateriale: a.provemateriale.original,
      nedre: a.maleomrade.nedre,
      ovre: a.maleomrade.ovre,
      enhet: a.maleomrade.enhet,
      benevning: a.svarenhet.original,
      molvekt: mw && Number.isFinite(mw) && mw > 0 ? mw : null,
    }
    const nokkel = a.provemateriale.matrise ?? `annet:${a.provemateriale.original ?? 'Prøvemateriale ikke oppgitt'}`
    tabeller.set(nokkel, [...(tabeller.get(nokkel) ?? []), rad])
  }

  const plass = (nokkel: string) => {
    const i = MATRISER.findIndex((m) => m.nokkel === nokkel)
    return i < 0 ? MATRISER.length : i
  }
  const radorden = (r: Labrad) => (r.forbindelse ? (rekkefolge.get(r.forbindelse.nokkel) ?? 0) : forbindelser.length)
  return {
    usikre,
    kontrollert_kl: utvalg.kilde.kontrollert_kl,
    tabeller: [...tabeller]
      .sort(([a], [b]) => plass(a) - plass(b) || sammenlign(a, b))
      .map(([nokkel, rader]): Labtabell => {
        rader.sort((a, b) => radorden(a) - radorden(b) || sammenlign(a.analytt, b.analytt) || sammenlign(a.laboratorium, b.laboratorium) || sammenlign(a.id, b.id))
        const materialer = new Set(rader.map((r) => r.provemateriale ?? ''))
        const matrise = MATRISER.find((m) => m.nokkel === nokkel)
        const eneste = materialer.size === 1 ? rader[0]!.provemateriale : null
        return {
          nokkel,
          // Har alle radene samme prøvemateriale, står det som tittel («Serum»); ellers matrisen («Serum og plasma»).
          tittel: eneste ?? matrise?.navn ?? nokkel.replace(/^annet:/, ''),
          rader,
          visAnalytt: new Set(rader.map((r) => r.analytt)).size > 1,
          visProvemateriale: materialer.size > 1,
        }
      }),
  }
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

/** Om benevningen laboratoriet svarer ut i, sier noe den valgte enheten ikke sier. */
export function harEgenBenevning(rad: Pick<Labrad, 'benevning'>, valgt: Visningsenhet): boolean {
  return Boolean(rad.benevning) && lesKonsentrasjonsenhet(rad.benevning)?.enhet !== valgt
}

/** Hva seksjonen viser når den er lukket: «Serum og plasma 6 · Urin 2». */
export function laboppsummering(visning: Labvisning): string {
  return ramsOpp(visning.tabeller.map((t) => `${t.tittel} ${t.rader.length}`))
}

/** Ankeret til raden for en analyse. */
export function labsted(id: string): string {
  return `lab:${id}`
}

/** Analyttene, laboratoriene og metodene, slik søket på siden finner dem. */
export function labsoketekster(visning: Labvisning): Tilleggstekst[] {
  return visning.tabeller.flatMap((t) =>
    t.rader.flatMap((r): Tilleggstekst[] => {
      const element = { id: labsted(r.id), tittel: `${r.analytt} · ${r.laboratorium}` }
      const tekst = (felt: Tilleggstekst['felt'], verdi: string | null): Tilleggstekst[] =>
        verdi ? [{ panel: LABPANEL, element, felt, tekst: verdi }] : []
      return [...tekst('overskrift', r.analytt), ...tekst('verdi', r.laboratorium), ...tekst('verdi', r.institusjon), ...tekst('verdi', r.metode)]
    }),
  )
}
