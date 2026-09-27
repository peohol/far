/**
 * Idéene: formen de har i appen, sorteringen av lista, kommentartråden som
 * tre og tidspunktene slik de vises. Alt her er rene funksjoner; kallene mot
 * databasen står i `api.ts`, og reglene for hvem som får gjøre hva, i
 * migrasjonen `*_ideer.sql`.
 */
import { visningsnavn, type Profil } from '@delt/profil'
import { NODER, erTomt, rensDokument, type Riktekstdokument, type Riktekstnode } from '../faginnhold/riktekst'

/* --- Kategoriene ----------------------------------------------------------- */

/** Kategoriene, i den rekkefølgen de vises. Samme verdier som `public.idekategori`. */
export const KATEGORIER = ['fag', 'funksjonalitet', 'annet'] as const
export type Idekategori = (typeof KATEGORIER)[number]

export const KATEGORINAVN: Record<Idekategori, string> = {
  fag: 'Fag',
  funksjonalitet: 'Funksjonalitet',
  annet: 'Annet',
}

export function erKategori(verdi: unknown): verdi is Idekategori {
  return typeof verdi === 'string' && (KATEGORIER as readonly string[]).includes(verdi)
}

/** Lengste overskrift. Samme grense som databasen setter. */
export const TITTEL_MEST = 140

/* --- Formen dataene har ------------------------------------------------------ */

interface Felles {
  id: string
  /** `null` for en slettet kommentar, som ikke sier hvem som skrev den. */
  forfatter_id: string | null
  opprettet_kl: string
  endret_kl: string | null
  hjerter: number
  mitt_hjerte: boolean
}

/** En idé slik lista viser den, uten beskrivelsen. */
export interface Ide extends Felles {
  forfatter_id: string
  kategori: Idekategori
  tittel: string
  kommentarer: number
}

export interface Kommentar extends Felles {
  forelder_id: string | null
  /** Renset for visning. Tomt for en slettet kommentar. */
  tekst: Riktekstdokument
  slettet: boolean
}

/** Én idé med beskrivelsen og hele kommentartråden. */
export interface Idetraad extends Omit<Ide, 'kommentarer'> {
  /** Renset for visning, eller `null` uten beskrivelse. */
  tekst: Riktekstdokument | null
  kommentarer: Kommentar[]
}

/**
 * Rikteksten i en idé eller kommentar, renset for visning. Idéene har ikke
 * referansesystemet, så siteringer blir ikke stående selv om noen skulle
 * sende dem.
 */
export function rensIdetekst(verdi: unknown): Riktekstdokument {
  return utenSiteringer(rensDokument(verdi))
}

function utenSiteringer<T extends Riktekstnode>(node: T): T {
  if (!node.content) return node
  return { ...node, content: node.content.filter((n) => n.type !== NODER.sitering).map(utenSiteringer) }
}

/** Teksten som skal lagres: renset, eller `null` når den er tom. */
export function tekstTilLagring(dokument: Riktekstdokument): Riktekstdokument | null {
  const renset = rensIdetekst(dokument)
  return erTomt(renset) ? null : renset
}

/* --- Lesing av det databasen svarer ------------------------------------------ */

function erObjekt(verdi: unknown): verdi is Record<string, unknown> {
  return typeof verdi === 'object' && verdi !== null && !Array.isArray(verdi)
}

const tekst = (verdi: unknown): string => (typeof verdi === 'string' ? verdi : '')
const tekstEllerNull = (verdi: unknown): string | null => (typeof verdi === 'string' ? verdi : null)
const tall = (verdi: unknown): number => (typeof verdi === 'number' && Number.isFinite(verdi) ? verdi : Number(verdi) || 0)

function lesFelles(rad: Record<string, unknown>): Felles {
  return {
    id: tekst(rad.id),
    forfatter_id: tekstEllerNull(rad.forfatter_id),
    opprettet_kl: tekst(rad.opprettet_kl),
    endret_kl: tekstEllerNull(rad.endret_kl),
    hjerter: tall(rad.hjerter),
    mitt_hjerte: rad.mitt_hjerte === true,
  }
}

function lesIde(rad: unknown): Ide | null {
  if (!erObjekt(rad) || !erKategori(rad.kategori)) return null
  const felles = lesFelles(rad)
  if (!felles.id || !felles.forfatter_id) return null
  return { ...felles, forfatter_id: felles.forfatter_id, kategori: rad.kategori, tittel: tekst(rad.tittel), kommentarer: tall(rad.kommentarer) }
}

/** Idélista fra `ideoversikt()`. Rader som ikke har formen, utelates. */
export function lesIdeoversikt(data: unknown): Ide[] {
  return Array.isArray(data) ? data.flatMap((rad) => lesIde(rad) ?? []) : []
}

/** Idéen og tråden fra `idetraad()`, eller `null` når idéen ikke finnes. */
export function lesIdetraad(data: unknown): Idetraad | null {
  const ide = lesIde({ ...(erObjekt(data) ? data : {}), kommentarer: 0 })
  if (!ide || !erObjekt(data)) return null
  const kommentarer = Array.isArray(data.kommentarer)
    ? data.kommentarer.flatMap((rad): Kommentar[] => {
        if (!erObjekt(rad)) return []
        const felles = lesFelles(rad)
        if (!felles.id) return []
        const slettet = rad.slettet === true
        return [
          {
            ...felles,
            forelder_id: tekstEllerNull(rad.forelder_id),
            slettet,
            tekst: slettet ? rensIdetekst(null) : rensIdetekst(rad.tekst),
          },
        ]
      })
    : []
  const { kommentarer: _antall, ...resten } = ide
  return { ...resten, tekst: data.tekst == null ? null : rensIdetekst(data.tekst), kommentarer }
}

/* --- Sorteringen ------------------------------------------------------------- */

export const KRITERIER = ['kategori', 'tid', 'bruker'] as const
export type Kriterium = (typeof KRITERIER)[number]

/** Kriteriene lista kan grupperes etter. Tiden gir ingen overskrifter. */
export const GRUPPEKRITERIER = ['kategori', 'bruker'] as const satisfies readonly Kriterium[]
export type Gruppekriterium = (typeof GRUPPEKRITERIER)[number]

export const KRITERIENAVN: Record<Kriterium, string> = {
  kategori: 'Kategori',
  tid: 'Tid',
  bruker: 'Bruker',
}

/**
 * Hvordan lista sorteres: `forst` gir overskriftene, `deretter` rekkefølgen
 * under dem. Det tredje kriteriet er det som er igjen, og avgjør resten.
 */
export interface Sortering {
  forst: Gruppekriterium
  deretter: Kriterium
}

export const STANDARDSORTERING: Sortering = { forst: 'kategori', deretter: 'tid' }

/** Nøkkelen sorteringen lagres under i brukerinnstillingene. */
export const SORTERINGSNOKKEL = 'ideer.sortering'

/** Alle tre kriteriene i rekkefølge. */
export function kriterierFor(sortering: Sortering): [Kriterium, Kriterium, Kriterium] {
  const tredje = KRITERIER.find((k) => k !== sortering.forst && k !== sortering.deretter)!
  return [sortering.forst, sortering.deretter, tredje]
}

/**
 * Et nytt førstekriterium. Står andrekriteriet på det samme, flyttes det til
 * det som var førstekriteriet, så de to bare bytter plass.
 */
export function velgForst(sortering: Sortering, forst: Gruppekriterium): Sortering {
  return { forst, deretter: sortering.deretter === forst ? sortering.forst : sortering.deretter }
}

/** Kriteriene som kan stå som nummer to når `forst` er valgt. */
export function andrevalg(forst: Gruppekriterium): Kriterium[] {
  return KRITERIER.filter((k) => k !== forst)
}

/** En lagret sortering, eller standarden når den mangler eller er ugyldig. */
export function lesSortering(verdi: unknown): Sortering {
  if (!erObjekt(verdi)) return STANDARDSORTERING
  const { forst, deretter } = verdi
  const gyldigForst = (GRUPPEKRITERIER as readonly unknown[]).includes(forst)
  const gyldigDeretter = (KRITERIER as readonly unknown[]).includes(deretter) && deretter !== forst
  return gyldigForst && gyldigDeretter ? { forst: forst as Gruppekriterium, deretter: deretter as Kriterium } : STANDARDSORTERING
}

/** En overskrift i lista, med idéene under den. */
export interface Idegruppe {
  kriterium: Gruppekriterium
  /** Kategorien eller bruker-ID-en. */
  nokkel: string
  navn: string
  ideer: Ide[]
}

type Profiloppslag = ReadonlyMap<string, Pick<Profil, 'first_name' | 'last_name' | 'username'>>

const SAMMENLIGN = new Intl.Collator('nb', { sensitivity: 'base', numeric: true })

function brukernavn(id: string, profiler: Profiloppslag): string {
  const profil = profiler.get(id)
  return profil ? visningsnavn(profil) : ''
}

/** Sammenligningen for hvert kriterium. Tiden står med de nyeste først. */
function sammenligning(kriterium: Kriterium, profiler: Profiloppslag): (a: Ide, b: Ide) => number {
  switch (kriterium) {
    case 'kategori':
      return (a, b) => KATEGORIER.indexOf(a.kategori) - KATEGORIER.indexOf(b.kategori)
    case 'tid':
      return (a, b) => Date.parse(b.opprettet_kl) - Date.parse(a.opprettet_kl)
    case 'bruker':
      return (a, b) =>
        SAMMENLIGN.compare(brukernavn(a.forfatter_id, profiler), brukernavn(b.forfatter_id, profiler)) ||
        a.forfatter_id.localeCompare(b.forfatter_id)
  }
}

/**
 * Idéene under overskriftene. Med kategori først står alle kategoriene, også
 * de uten idéer; med bruker først står hver bruker som har skrevet noe.
 */
export function grupperIdeer(ideer: readonly Ide[], sortering: Sortering, profiler: Profiloppslag): Idegruppe[] {
  const sammenligninger = kriterierFor(sortering).map((k) => sammenligning(k, profiler))
  const sortert = [...ideer].sort((a, b) => {
    for (const s of sammenligninger) {
      const r = s(a, b)
      if (r !== 0) return r
    }
    return a.id.localeCompare(b.id)
  })

  if (sortering.forst === 'kategori') {
    return KATEGORIER.map((kategori) => ({
      kriterium: 'kategori',
      nokkel: kategori,
      navn: KATEGORINAVN[kategori],
      ideer: sortert.filter((i) => i.kategori === kategori),
    }))
  }

  const grupper = new Map<string, Idegruppe>()
  for (const ide of sortert) {
    const gruppe = grupper.get(ide.forfatter_id)
    if (gruppe) gruppe.ideer.push(ide)
    else grupper.set(ide.forfatter_id, { kriterium: 'bruker', nokkel: ide.forfatter_id, navn: brukernavn(ide.forfatter_id, profiler) || 'Ukjent bruker', ideer: [ide] })
  }
  return [...grupper.values()]
}

/* --- Kommentartråden ------------------------------------------------------ */

export interface Kommentarnode {
  kommentar: Kommentar
  svar: Kommentarnode[]
  /** Alle svarene under, også svar på svar, som ikke er slettet. */
  antallSvar: number
}

/**
 * Kommentarene som et tre, med de eldste først på hvert nivå, slik en samtale
 * leses. Et svar hvis forelder ikke finnes (den ble borte mellom to
 * hentinger), står øverst i stedet for å forsvinne.
 */
export function byggTraad(kommentarer: readonly Kommentar[]): Kommentarnode[] {
  const noder = new Map(kommentarer.map((k) => [k.id, { kommentar: k, svar: [] as Kommentarnode[], antallSvar: 0 }]))
  const topp: Kommentarnode[] = []
  const eldstForst = (a: Kommentarnode, b: Kommentarnode) =>
    Date.parse(a.kommentar.opprettet_kl) - Date.parse(b.kommentar.opprettet_kl) || a.kommentar.id.localeCompare(b.kommentar.id)

  for (const node of noder.values()) {
    const forelder = node.kommentar.forelder_id ? noder.get(node.kommentar.forelder_id) : undefined
    ;(forelder ? forelder.svar : topp).push(node)
  }
  const ordne = (liste: Kommentarnode[]): number => {
    liste.sort(eldstForst)
    return liste.reduce((sum, node) => {
      node.antallSvar = ordne(node.svar)
      return sum + node.antallSvar + (node.kommentar.slettet ? 0 : 1)
    }, 0)
  }
  ordne(topp)
  return topp
}

/* --- Tidspunktene ---------------------------------------------------------- */

const KLOKKE = new Intl.DateTimeFormat('nb-NO', { hour: '2-digit', minute: '2-digit' })
const DAG = new Intl.DateTimeFormat('nb-NO', { day: 'numeric', month: 'short' })
const DAG_OG_AAR = new Intl.DateTimeFormat('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' })
const FULLT = new Intl.DateTimeFormat('nb-NO', { dateStyle: 'long', timeStyle: 'short' })

function sammeDag(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

/**
 * Tidspunktet kort, slik lista og tråden viser det: «nå», «for 5 min siden»,
 * «i dag 14:32», «i går 09:10», «12. sep.» og «12. sep. 2025».
 */
export function kortTid(iso: string, naa: Date = new Date()): string {
  const tid = new Date(iso)
  if (Number.isNaN(tid.getTime())) return ''
  const minutter = Math.floor((naa.getTime() - tid.getTime()) / 60_000)
  if (minutter < 1) return 'nå'
  if (minutter < 60) return `for ${minutter} min siden`
  if (sammeDag(tid, naa)) return `i dag ${KLOKKE.format(tid)}`
  const igaar = new Date(naa)
  igaar.setDate(naa.getDate() - 1)
  if (sammeDag(tid, igaar)) return `i går ${KLOKKE.format(tid)}`
  return (tid.getFullYear() === naa.getFullYear() ? DAG : DAG_OG_AAR).format(tid)
}

/** Tidspunktet i sin helhet, til `title` og skjermlesere. */
export function fullTid(iso: string): string {
  const tid = new Date(iso)
  return Number.isNaN(tid.getTime()) ? '' : FULLT.format(tid)
}
