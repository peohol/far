/**
 * Seksjonen «Kjemiske grunndata» på fagsidene: forbindelsene stoffet har i
 * `src/data/forbindelser.ts` — selve stoffet først, så metabolittene —
 * med formelen, molekylvekten, CID og InChIKey fra PubChem (`docs/kjemi.md`).
 *
 * Alt her er rene funksjoner.
 */
import { ramsOpp } from '../faginnhold/oppsummering'
import type { Panelnokkel } from '../faginnhold/paneler'
import type { Tilleggstekst } from '../faginnhold/sok'
import { FORBINDELSER, type Forbindelse, type Forbindelsesregister, type Forbindelsesrelasjon } from './forbindelser'
import type { Kjemiutvalg } from './lesing'
import type { Pubchemdata } from './pubchem'

export const KJEMIPANEL: Panelnokkel = 'kjemiske_grunndata'

/** Hvor dataene for en forbindelse står: hentet, koblet men ikke hentet ennå, eller ikke koblet sikkert. */
export type Kjemistatus = 'hentet' | 'ikke_hentet' | 'uavklart'

export interface Kjemirad {
  forbindelse: Forbindelse
  relasjon: Forbindelsesrelasjon
  status: Kjemistatus
  /** Dataene fra PubChem, når de er hentet. */
  data: Pubchemdata | null
}

export interface Kjemivisning {
  rader: Kjemirad[]
  /**
   * Når dataene siden viser, sist ble kontrollert mot PubChem: den eldste av
   * forbindelsene, så datoen aldri lover mer enn det som gjelder alle. En
   * forbindelse en kjøring avviste, beholder datoen den sist ble godtatt.
   */
  kontrollert_kl: string | null
}

/** CID-ene til forbindelsene stoffet har, som tekst. */
export function kjemicider(stoff: string, register: Forbindelsesregister = FORBINDELSER): string[] {
  return register.forStoff(stoff).flatMap((f) => (f.pubchem ? [String(f.pubchem.cid)] : []))
}

export function byggKjemivisning(
  stoff: string,
  utvalg: Kjemiutvalg | null,
  register: Forbindelsesregister = FORBINDELSER,
): Kjemivisning {
  const hentet = new Map(utvalg?.forbindelser.map((p) => [p.cid, p]) ?? [])
  const tider: string[] = []
  const rader = register.forStoff(stoff).map((forbindelse): Kjemirad => {
    const relasjon = forbindelse.stoffer.find((s) => s.stoff === stoff)!.relasjon
    const post = forbindelse.pubchem ? hentet.get(forbindelse.pubchem.cid) : undefined
    if (post?.sist_hentet_kl && !Number.isNaN(Date.parse(post.sist_hentet_kl))) tider.push(post.sist_hentet_kl)
    const data = post?.data ?? null
    return { forbindelse, relasjon, data, status: data ? 'hentet' : forbindelse.pubchem ? 'ikke_hentet' : 'uavklart' }
  })
  tider.sort((a, b) => Date.parse(a) - Date.parse(b))
  return { rader, kontrollert_kl: tider[0] ?? null }
}

/** En del av en molekylformel: tallene står senket, ladningen hevet. */
export interface Formeldel {
  tekst: string
  slag: 'vanlig' | 'senket' | 'hevet'
}

/** «C20H21FN2O» som C, 20 senket, H, 21 senket …; «Li+» med ladningen hevet. */
export function formeldeler(formel: string): Formeldel[] {
  const ladning = /(\d*[+-])$/.exec(formel)?.[1] ?? ''
  const kropp = ladning ? formel.slice(0, -ladning.length) : formel
  const deler: Formeldel[] = kropp
    .split(/(\d+)/)
    .filter(Boolean)
    .map((tekst) => ({ tekst, slag: /^\d+$/.test(tekst) ? 'senket' : 'vanlig' }))
  return ladning ? [...deler, { tekst: ladning, slag: 'hevet' }] : deler
}

const SENKET = '₀₁₂₃₄₅₆₇₈₉'
const HEVET: Record<string, string> = { '+': '⁺', '-': '⁻', ...Object.fromEntries([...'0123456789'].map((s, i) => [s, '⁰¹²³⁴⁵⁶⁷⁸⁹'[i]!])) }

/** Formelen som ren tekst med senkede og hevede tegn: «C₂₀H₂₁FN₂O», «Li⁺». */
export function formeltekst(formel: string): string {
  return formeldeler(formel)
    .map(({ tekst, slag }) =>
      slag === 'senket' ? [...tekst].map((s) => SENKET[Number(s)]).join('') : slag === 'hevet' ? [...tekst].map((s) => HEVET[s] ?? s).join('') : tekst,
    )
    .join('')
}

/** Molekylvekten slik PubChem oppgir den, med desimalkomma: «324,4 g/mol». */
export function molvekttekst(molvekt: string): string {
  return `${molvekt.replace('.', ',')} g/mol`
}

/** Hva seksjonen viser når den er lukket: «Citalopram 324,4 g/mol · Desmetylcitalopram 310,4 g/mol». */
export function kjemioppsummering(visning: Kjemivisning): string {
  return ramsOpp(visning.rader.map((r) => r.data && `${r.forbindelse.navn} ${molvekttekst(r.data.molvekt)}`))
}

/** Ankeret til raden for en forbindelse. */
export function kjemisted(f: Pick<Forbindelse, 'nokkel'>): string {
  return `kjemi:${f.nokkel}`
}

/** Navnene, formlene og identifikatorene, slik søket på siden finner dem. */
export function kjemisoketekster(visning: Kjemivisning): Tilleggstekst[] {
  return visning.rader.flatMap((r): Tilleggstekst[] => {
    const element = { id: kjemisted(r.forbindelse), tittel: r.forbindelse.navn }
    const tekst = (felt: Tilleggstekst['felt'], t: string): Tilleggstekst => ({ panel: KJEMIPANEL, element, felt, tekst: t })
    return [
      tekst('overskrift', r.forbindelse.navn),
      ...(r.data
        ? [tekst('verdi', formeltekst(r.data.formel)), tekst('verdi', `CID ${r.data.cid}`), tekst('verdi', r.data.inchikey)]
        : []),
    ]
  })
}
