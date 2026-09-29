/**
 * Lesingen av det databasen svarer for idéene og oppgavene: verdier som ikke
 * har formen, blir tomme i stedet for å velte visningen.
 */
export function erObjekt(verdi: unknown): verdi is Record<string, unknown> {
  return typeof verdi === 'object' && verdi !== null && !Array.isArray(verdi)
}

export const tekst = (verdi: unknown): string => (typeof verdi === 'string' ? verdi : '')
export const tekstEllerNull = (verdi: unknown): string | null => (typeof verdi === 'string' ? verdi : null)
export const tall = (verdi: unknown): number => (typeof verdi === 'number' && Number.isFinite(verdi) ? verdi : Number(verdi) || 0)
export const tallEllerNull = (verdi: unknown): number | null => (verdi == null ? null : tall(verdi) || null)
