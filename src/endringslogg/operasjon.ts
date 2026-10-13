/**
 * Én handling i appen — en lagring, en flytting, en publisering — kan bestå av
 * flere kall til databasen. Kallene sender handlingens ID og oppsummeringen
 * brukeren skrev, i overskriftene, så databasen fører dem som én endring i
 * endringsloggen (`intern.gjeldende_endring`, `docs/innholdsendringer.md`).
 */

/** Overskriftene databasen leser (`request.headers`). */
export const ENDRINGSOVERSKRIFT = 'x-far-endring'
export const OPPSUMMERINGSOVERSKRIFT = 'x-far-oppsummering'

/** Det databasen godtar i en oppsummering. */
export const OPPSUMMERING_MAKS = 500

export interface Endringskontekst {
  /** Handlingens ID. Kallene med samme ID føres som én endring. */
  id: string
  /** Det brukeren skrev om endringen. Uten den beskriver loggen endringen selv. */
  oppsummering?: string
}

/** Oppsummeringen slik den lagres: blanke tegn slått sammen, tom blir ingen. */
export function ryddOppsummering(tekst: string | undefined): string | undefined {
  const ryddet = (tekst ?? '').replace(/\s+/g, ' ').trim().slice(0, OPPSUMMERING_MAKS)
  return ryddet === '' ? undefined : ryddet
}

/** En ny handling. */
export function nyEndring(oppsummering?: string): Endringskontekst {
  const ryddet = ryddOppsummering(oppsummering)
  return { id: crypto.randomUUID(), ...(ryddet && { oppsummering: ryddet }) }
}

/** Teksten som base64 av UTF-8: en overskrift kan ikke ha æ, ø og å. */
export function base64Utf8(tekst: string): string {
  let binar = ''
  for (const byte of new TextEncoder().encode(tekst)) binar += String.fromCharCode(byte)
  return btoa(binar)
}

/** Overskriftene for handlingen. */
export function endringsoverskrifter(endring: Endringskontekst): Record<string, string> {
  const oppsummering = ryddOppsummering(endring.oppsummering)
  return {
    [ENDRINGSOVERSKRIFT]: endring.id,
    ...(oppsummering && { [OPPSUMMERINGSOVERSKRIFT]: base64Utf8(oppsummering) }),
  }
}

/** Et kall som kan få overskrifter, som et `rpc`-kall i Supabase-klienten. */
interface MedOverskrifter {
  setHeader?: (navn: string, verdi: string) => unknown
}

/** Kallet med overskriftene for handlingen, når det er en. */
export function iEndring<T extends MedOverskrifter>(kall: T, endring: Endringskontekst | undefined): T {
  if (!endring || typeof kall.setHeader !== 'function') return kall
  for (const [navn, verdi] of Object.entries(endringsoverskrifter(endring))) kall.setHeader(navn, verdi)
  return kall
}
