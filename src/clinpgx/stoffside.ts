/**
 * Hvor ClinPGx-dataene står på en stoffside: koblingen i «Farmakogenetikk»,
 * rekkefølgen og grupperingen i seksjonen, detaljkortene og tekstene søket
 * finner der.
 *
 * Alt her er rene funksjoner. Søket på siden (`Stoffside.tsx`) og søket i
 * hele kunnskapsbasen (`src/faginnhold/globaltSok.ts`) bruker de samme, så et
 * treff peker på det samme stedet uansett hvilket søk som fant det.
 */
import type { Sideelement, Sidemodell } from '../faginnhold/stoffside'
import { ELEMENTTYPER, lesClinpgxkobling, type Clinpgxkoblingdata, type Panelnokkel } from '../faginnhold/paneler'
import { antall, ramsOpp } from '../faginnhold/oppsummering'
import type { Tilleggstekst } from '../faginnhold/sok'
import { interaksjonsnokler } from '../legemiddeldata/interaksjoner'
import type { Legemiddelutvalg } from '../legemiddeldata/lesing'
import type { Farmakogenetikkutvalg, Kjemikaliestatus, MedKjemikalier } from './lesing'
import {
  erHoyEvidens,
  type Kjemikalie,
  sorterEtterEvidens,
  type Genref,
  type KliniskAnnotasjon,
  type Preparatomtale,
  type Retningslinje,
} from './modell'

/** Seksjonen koblingen og ClinPGx-dataene står i. */
export const FARMAKOGENETIKKPANEL: Panelnokkel = 'farmakogenetikk'

/** Koblingen siden har til ClinPGx, og elementet den står i. */
export function finnClinpgxkobling(modell: Sidemodell): { element: Sideelement | null; kobling: Clinpgxkoblingdata } {
  const element =
    (modell.paneler.get(FARMAKOGENETIKKPANEL) ?? []).find((e) => e.elementtype === ELEMENTTYPER.clinpgxkobling) ?? null
  return { element, kobling: lesClinpgxkobling(element?.data) }
}

/** ClinPGx-ID-ene til kjemikaliene siden er koblet til. */
export function kobledeKjemikalier(modell: Sidemodell): string[] {
  return finnClinpgxkobling(modell).kobling.kjemikalier.map((k) => k.clinpgx_id)
}

/**
 * Status for hvert kjemikalie siden er koblet til, i koblingens rekkefølge.
 * Et kjemikalie som ikke er hentet ennå, finnes ikke i kopien; det får en
 * status uten henting, med navnet koblingen lagret.
 */
export function kjemikaliestatuser(
  utvalg: Pick<Farmakogenetikkutvalg, 'kjemikalier'>,
  kobling: Clinpgxkoblingdata,
): Kjemikaliestatus[] {
  const kjente = new Map(utvalg.kjemikalier.map((k) => [k.id, k]))
  return kobling.kjemikalier.map(({ clinpgx_id, navn }) => {
    const kjent = kjente.get(clinpgx_id)
    return kjent
      ? { ...kjent, navn: kjent.navn ?? (navn || null) }
      : { id: clinpgx_id, navn: navn || null, finnes: true, sist_hentet_kl: null, feil: null, feil_kl: null }
  })
}

/* --- Forslagene når en side kobles --------------------------------------- */

/** Det et kjemikalie i ClinPGx sammenlignes med når siden kobles: sidens virkestoff i FEST. */
export interface Koblingsgrunnlag {
  /** De engelske navnene FEST har for virkestoffene siden er koblet til. */
  navn: string[]
  /** ATC-kodene til preparatene med bare sidens virkestoff. */
  atc: string[]
}

export const TOMT_KOBLINGSGRUNNLAG: Koblingsgrunnlag = { navn: [], atc: [] }

/** Grunnlaget for forslagene, fra legemiddeldataene siden viser. */
export function koblingsgrunnlag(utvalg: Legemiddelutvalg | null, koblet: readonly string[]): Koblingsgrunnlag {
  if (!utvalg || koblet.length === 0) return TOMT_KOBLINGSGRUNNLAG
  const egne = new Set(koblet)
  return {
    navn: [
      ...new Set(
        utvalg.virkestoff.flatMap((v) => (egne.has(v.id) && v.navn_engelsk?.trim() ? [v.navn_engelsk.trim()] : [])),
      ),
    ],
    atc: [...interaksjonsnokler(utvalg, koblet).atc],
  }
}

/**
 * Hvorfor et kjemikalie i ClinPGx trolig er sidens stoff, eller `null`. Samme
 * ATC-kode som preparatene er det sterkeste; samme engelske navn som i FEST
 * er svakere. Et forslag er bare et forslag: koblingen gjelder først når
 * administratoren har valgt kjemikaliet og lagret.
 */
export function koblingsforslag(kjemikalie: Pick<Kjemikalie, 'navn' | 'atc'>, grunnlag: Koblingsgrunnlag): string | null {
  const atc = kjemikalie.atc.filter((a) => grunnlag.atc.includes(a))
  if (atc.length > 0) return `samme ATC-kode som preparatene (${atc.join(', ')})`
  const navn = kjemikalie.navn.toLocaleLowerCase('en')
  if (grunnlag.navn.some((n) => n.toLocaleLowerCase('en') === navn)) return 'samme navn som virkestoffet i FEST'
  return null
}

/* --- Detaljkortene -------------------------------------------------------- */

/** Detaljkortet for en retningslinje eller preparatomtale. Nøkkelen står i direktelenker. */
export function annotasjonskort(id: string): string {
  return `clinpgx-${id}`
}

/** Detaljkortet for en klinisk annotasjon med høy evidens. */
export function kliniskkort(id: string): string {
  return `clinpgx-klinisk-${id}`
}

/** Detaljkortet de kliniske annotasjonene med lavere evidens står samlet i. */
export const LAVERE_EVIDENS_KORT = 'clinpgx-lavere-evidens'

/* --- Rekkefølgen ---------------------------------------------------------- */

/** Organisasjonene retningslinjene står i rekkefølge etter; andre kommer etter, alfabetisk. */
const RETNINGSLINJEKILDER = ['CPIC', 'DPWG', 'PRO']

/** Myndighetene preparatomtalene står i rekkefølge etter. */
const PREPARATOMTALEKILDER = ['FDA', 'EMA', 'HCSC', 'SWISSMEDIC', 'PMDA']

function kildeplass(rekkefolge: readonly string[], kilde: string): number {
  const plass = rekkefolge.indexOf(kilde.toUpperCase())
  return plass === -1 ? rekkefolge.length : plass
}

function genliste(gener: readonly Genref[]): string {
  return gener.map((g) => g.symbol).join(', ')
}

function etterKilde<T extends Pick<Retningslinje, 'kilde' | 'gener' | 'id'>>(rekkefolge: readonly string[], liste: readonly T[]): T[] {
  return [...liste].sort(
    (a, b) =>
      kildeplass(rekkefolge, a.kilde) - kildeplass(rekkefolge, b.kilde) ||
      a.kilde.localeCompare(b.kilde) ||
      genliste(a.gener).localeCompare(genliste(b.gener)) ||
      a.id.localeCompare(b.id),
  )
}

/* --- Visningen ------------------------------------------------------------ */

/** ClinPGx-dataene for en side, ordnet slik seksjonen viser dem. */
export interface Farmakogenetikkvisning {
  retningslinjer: MedKjemikalier<Retningslinje>[]
  preparatomtaler: MedKjemikalier<Preparatomtale>[]
  /** De kliniske annotasjonene med evidensnivå 1A og 1B, sterkest først. */
  hoye: MedKjemikalier<KliniskAnnotasjon>[]
  /** De andre kliniske annotasjonene, sterkest først. */
  lavere: MedKjemikalier<KliniskAnnotasjon>[]
  /** Genene seksjonen handler om: fra retningslinjene, så de sterkeste annotasjonene, så preparatomtalene. */
  gener: string[]
  /** Organisasjonene bak retningslinjene, i fast rekkefølge. */
  kilder: string[]
}

export function byggFarmakogenetikkvisning(utvalg: Farmakogenetikkutvalg): Farmakogenetikkvisning {
  const retningslinjer = etterKilde(RETNINGSLINJEKILDER, utvalg.retningslinjer)
  const preparatomtaler = etterKilde(PREPARATOMTALEKILDER, utvalg.preparatomtaler)
  const kliniske = sorterEtterEvidens(utvalg.kliniske)
  const hoye = kliniske.filter(erHoyEvidens)
  const lavere = kliniske.filter((k) => !erHoyEvidens(k))
  const gener = [
    ...new Set(
      [...retningslinjer, ...hoye, ...preparatomtaler].flatMap((a) => a.gener.map((g) => g.symbol)).filter(Boolean),
    ),
  ]
  const kilder = [...new Set(retningslinjer.map((r) => r.kilde).filter(Boolean))]
  return { retningslinjer, preparatomtaler, hoye, lavere, gener, kilder }
}

export function harFarmakogenetikk(visning: Farmakogenetikkvisning): boolean {
  return (
    visning.retningslinjer.length + visning.preparatomtaler.length + visning.hoye.length + visning.lavere.length > 0
  )
}

/** Flest gener den lukkede seksjonen nevner. */
const MAKS_GENER_I_OPPSUMMERING = 5

/**
 * Det den lukkede seksjonen sier om ClinPGx-dataene, f.eks.
 * «CYP2D6 · CYP2C19 · CPIC + DPWG». Uten retningslinjer: antallet
 * preparatomtaler og annotasjoner. Tom når det ikke er noe.
 */
export function oppsummerFarmakogenetikk(visning: Farmakogenetikkvisning): string {
  const gener = visning.gener.slice(0, MAKS_GENER_I_OPPSUMMERING)
  const flere = visning.gener.length - gener.length
  return ramsOpp([
    ...gener,
    flere > 0 && `+${flere} gener`,
    visning.kilder.join(' + '),
    visning.kilder.length === 0 && visning.preparatomtaler.length > 0 &&
      antall(visning.preparatomtaler.length, 'preparatomtale', 'preparatomtaler'),
    visning.kilder.length === 0 && visning.preparatomtaler.length === 0 &&
      antall(visning.hoye.length + visning.lavere.length, 'klinisk annotasjon', 'kliniske annotasjoner'),
  ])
}

/* --- Titlene -------------------------------------------------------------- */

/** Tittelen på en retningslinje eller preparatomtale: organisasjonen og genene, f.eks. «CPIC · CYP2B6, CYP2C19». */
export function annotasjonstittel(a: Pick<Retningslinje, 'kilde' | 'gener' | 'navn'>): string {
  return ramsOpp([a.kilde, genliste(a.gener)]) || a.navn
}

/** Tittelen på en klinisk annotasjon: varianten eller haplotypene, eller genet. */
export function klinisktittel(a: Pick<KliniskAnnotasjon, 'variant' | 'gener' | 'rsid' | 'navn'>): string {
  return a.variant || a.rsid || genliste(a.gener) || a.navn
}

/** «Nivå 1A»: evidensnivået slik det vises. */
export function evidensetikett(niva: string | null): string {
  return niva ? `Nivå ${niva}` : 'Nivå ikke oppgitt'
}

/** Nivåene i en liste annotasjoner, fra det sterkeste til det svakeste: «2A–4». */
export function nivaspenn(annotasjoner: readonly Pick<KliniskAnnotasjon, 'niva'>[]): string {
  const nivaer = [...new Set(annotasjoner.map((a) => a.niva).filter((n): n is string => !!n))]
  if (nivaer.length === 0) return ''
  return nivaer.length === 1 ? nivaer[0]! : `${nivaer[0]}–${nivaer[nivaer.length - 1]}`
}

/* --- Søket ---------------------------------------------------------------- */

/**
 * Tekstene fra ClinPGx søket finner, med detaljkortet de står i: hver
 * retningslinje og preparatomtale med organisasjonen og genene, de sterkeste
 * kliniske annotasjonene med varianten og nivået, og genene og variantene i
 * de svakere. Sammendragene er fritekst.
 */
export function farmakogenetikktekster(visning: Farmakogenetikkvisning): Tilleggstekst[] {
  const tekster: Tilleggstekst[] = []
  const legg = (kort: string, tittel: string, felt: Tilleggstekst['felt'], tekst: string) =>
    tekster.push({ panel: FARMAKOGENETIKKPANEL, element: { id: kort, tittel }, detaljkort: kort, felt, tekst })

  const annotasjoner: (Retningslinje & { testing?: string | null })[] = [...visning.retningslinjer, ...visning.preparatomtaler]
  for (const a of annotasjoner) {
    const kort = annotasjonskort(a.id)
    const tittel = annotasjonstittel(a)
    legg(kort, tittel, 'overskrift', tittel)
    if (a.testing) legg(kort, tittel, 'verdi', a.testing)
    legg(kort, tittel, 'fritekst', a.sammendrag)
  }
  for (const a of visning.hoye) {
    const kort = kliniskkort(a.id)
    const tittel = klinisktittel(a)
    legg(kort, tittel, 'overskrift', ramsOpp([tittel, genliste(a.gener), a.rsid]))
    legg(kort, tittel, 'verdi', ramsOpp([evidensetikett(a.niva), ...a.typer, ...a.sykdommer]))
  }
  if (visning.lavere.length > 0) {
    const tittel = 'Lavere evidensnivå'
    legg(LAVERE_EVIDENS_KORT, tittel, 'fritekst', ramsOpp(visning.lavere.flatMap((a) => [klinisktittel(a), ...a.gener.map((g) => g.symbol)])))
  }
  return tekster.filter((t) => t.tekst.trim())
}

/* --- Sporbarheten -------------------------------------------------------- */

/**
 * Når dataene for siden sist ble hentet fra ClinPGx: den eldste av
 * kjemikaliene, så datoen aldri lover mer enn det som gjelder alle. `null`
 * når ingen er hentet.
 */
export function sistHentet(utvalg: Pick<Farmakogenetikkutvalg, 'kjemikalier'>): string | null {
  const tider = utvalg.kjemikalier
    .map((k) => k.sist_hentet_kl)
    .filter((t): t is string => !!t && !Number.isNaN(new Date(t).getTime()))
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
  return tider[0] ?? null
}

/**
 * Hvor lenge dataene kan stå uten å bli hentet før siden sier fra.
 * Synkroniseringen går hver uke; etter ti døgn har minst én uke feilet eller
 * ikke gått.
 */
export const CLINPGX_FORELDET_ETTER_DOGN = 10
