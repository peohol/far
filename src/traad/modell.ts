/**
 * Kommentartrådene idéene og diskusjonene deler: formen innleggene har,
 * tråden som tre, det som er nytt, rikteksten slik den vises og lagres, og
 * tidspunktene. Alt her er rene funksjoner.
 */
import { NODER, erTomt, rensDokument, type Riktekstdokument, type Riktekstnode } from '../faginnhold/riktekst'
import { erObjekt, tall, tekst, tekstEllerNull } from '../ideer/lesing'

/* --- Formen dataene har ------------------------------------------------------ */

/** Det alle innlegg har: en idé, en diskusjon og en kommentar. */
export interface Innlegg {
  id: string
  /** `null` for en slettet kommentar, som ikke sier hvem som skrev den. */
  forfatter_id: string | null
  opprettet_kl: string
  endret_kl: string | null
  hjerter: number
  mitt_hjerte: boolean
}

export interface Kommentar extends Innlegg {
  forelder_id: string | null
  /** Renset for visning. Tomt for en slettet eller skjult kommentar. */
  tekst: Riktekstdokument
  slettet: boolean
  /** En administrator har skjult innholdet. Bare i diskusjonene. */
  skjult?: boolean
}

/** Lengste overskrift på en idé eller en diskusjon. Samme grense som databasen setter. */
export const TITTEL_MEST = 140

/**
 * Om kommentaren er ny for den innloggede: skrevet av noen andre etter at
 * tråden sist ble åpnet, eller når den aldri er åpnet. Samme regel som
 * databasen teller etter (`ideoversikt()` og `diskusjonsoversikt()`).
 */
export function erNyKommentar(kommentar: Kommentar, sistSett: string | null, meg: string): boolean {
  if (kommentar.slettet || kommentar.forfatter_id === meg) return false
  return sistSett === null || Date.parse(kommentar.opprettet_kl) > Date.parse(sistSett)
}

/**
 * Rikteksten i et innlegg, renset for visning. Trådene har ikke
 * referansesystemet, så siteringer blir ikke stående selv om noen skulle
 * sende dem.
 */
export function rensInnleggstekst(verdi: unknown): Riktekstdokument {
  return utenSiteringer(rensDokument(verdi))
}

function utenSiteringer<T extends Riktekstnode>(node: T): T {
  if (!node.content) return node
  return { ...node, content: node.content.filter((n) => n.type !== NODER.sitering).map(utenSiteringer) }
}

/** Teksten som skal lagres: renset, eller `null` når den er tom. */
export function tekstTilLagring(dokument: Riktekstdokument): Riktekstdokument | null {
  const renset = rensInnleggstekst(dokument)
  return erTomt(renset) ? null : renset
}

/* --- Lesing av det databasen svarer ------------------------------------------ */

export function lesInnlegg(rad: Record<string, unknown>): Innlegg {
  return {
    id: tekst(rad.id),
    forfatter_id: tekstEllerNull(rad.forfatter_id),
    opprettet_kl: tekst(rad.opprettet_kl),
    endret_kl: tekstEllerNull(rad.endret_kl),
    hjerter: tall(rad.hjerter),
    mitt_hjerte: rad.mitt_hjerte === true,
  }
}

/** Kommentarene i en tråd slik databasen gir dem. Rader som ikke har formen, utelates. */
export function lesKommentarer(verdi: unknown): Kommentar[] {
  if (!Array.isArray(verdi)) return []
  return verdi.flatMap((rad): Kommentar[] => {
    if (!erObjekt(rad)) return []
    const innlegg = lesInnlegg(rad)
    if (!innlegg.id) return []
    const slettet = rad.slettet === true
    const skjult = !slettet && rad.skjult === true
    return [
      {
        ...innlegg,
        forelder_id: tekstEllerNull(rad.forelder_id),
        slettet,
        skjult,
        tekst: slettet || skjult ? rensInnleggstekst(null) : rensInnleggstekst(rad.tekst),
      },
    ]
  })
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
