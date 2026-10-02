/**
 * Hva en direktelenke peker på: en diskusjon eller en idé, eventuelt en
 * kommentar i den. Lenken bærer bare ID-ene, så den virker også når tråden
 * er flyttet til en annen side eller har fått ny overskrift:
 *
 *   #/diskusjon/<id>
 *   #/diskusjon/<id>/<kommentar-ID>
 *   #/ide/<id>
 *   #/ide/<id>/<kommentar-ID>
 *
 * Som de andre adressene i appen står den etter `#` (se `domain/rute.ts`), så
 * den kan limes inn i nettleseren, også før innloggingen. Hva lenken peker på,
 * og om det finnes, avgjør databasen (`direktelenke()`, se `modell.ts`).
 *
 * Denne fila leses også av rikteksten, som renser lenkebrikkene med den; den
 * skal derfor ikke lese noe annet fra appen.
 */

/** Det en direktelenke kan peke på. Samme verdier som `slag` i `direktelenke()`. */
export const LENKESLAG = ['diskusjon', 'ide'] as const
export type Lenkeslag = (typeof LENKESLAG)[number]

export interface Lenkemal {
  slag: Lenkeslag
  id: string
  /** Kommentaren i tråden lenken peker på, eller `null` for selve tråden. */
  kommentar: string | null
}

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ADRESSE = new RegExp(`^#/(${LENKESLAG.join('|')})/([^/?#]+)(?:/([^/?#]+))?/?$`, 'i')

function erObjekt(verdi: unknown): verdi is Record<string, unknown> {
  return typeof verdi === 'object' && verdi !== null && !Array.isArray(verdi)
}

function erSlag(verdi: unknown): verdi is Lenkeslag {
  return typeof verdi === 'string' && (LENKESLAG as readonly string[]).includes(verdi)
}

/** En gyldig ID, med små bokstaver, eller `null`. */
function lesId(verdi: unknown): string | null {
  return typeof verdi === 'string' && ID.test(verdi) ? verdi.toLowerCase() : null
}

/** Målet, når slaget og ID-ene har riktig form. */
export function lagLenkemal(slag: unknown, id: unknown, kommentar?: unknown): Lenkemal | null {
  const trad = lesId(id)
  if (!erSlag(slag) || !trad) return null
  if (kommentar == null || kommentar === '') return { slag, id: trad, kommentar: null }
  const svar = lesId(kommentar)
  return svar ? { slag, id: trad, kommentar: svar } : null
}

/** Målet slik det står i en lenkebrikke i rikteksten (`attrs`). */
export function lesLenkemal(attrs: unknown): Lenkemal | null {
  return erObjekt(attrs) ? lagLenkemal(attrs.slag, attrs.id, attrs.kommentar) : null
}

/** Adressen i appen, det som står etter `#`. */
export function lenkeadresse(mal: Lenkemal): string {
  return `#/${mal.slag}/${mal.id}${mal.kommentar ? `/${mal.kommentar}` : ''}`
}

/** Målet en adresse i appen peker på, når den er en direktelenke. */
export function malFraAdresse(hash: string): Lenkemal | null {
  const treff = ADRESSE.exec(hash)
  return treff ? lagLenkemal(treff[1]!.toLowerCase(), treff[2], treff[3]) : null
}

/**
 * Målet en innlimt lenke peker på: hele nettadressen til en direktelenke i
 * denne appen (samme opprinnelse), eller bare adressen etter `#`. Alt annet —
 * en lenke til et annet nettsted, en annen side i appen — er ingen
 * direktelenke.
 */
export function malFraLenke(tekst: string, opprinnelse: string = window.location.origin): Lenkemal | null {
  const renset = tekst.trim()
  if (renset.startsWith('#')) return malFraAdresse(renset)
  let url: URL
  try {
    url = new URL(renset)
  } catch {
    return null
  }
  return url.origin === opprinnelse ? malFraAdresse(url.hash) : null
}

/** Hele lenken, slik den kopieres: adressen til appen med målet etter `#`. */
export function fullLenke(mal: Lenkemal, app: string = window.location.origin + window.location.pathname): string {
  return `${app}${lenkeadresse(mal)}`
}

/** Nøkkelen et mål kjennes igjen på, til oppslag og sammenligning. */
export const malnokkel = lenkeadresse
