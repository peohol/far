/**
 * Feilene fra funksjonene i databasen, gjort om til noe som kan vises.
 *
 * Funksjonene skriver meldingene sine på norsk, med stor forbokstav, for at de
 * skal vises; Postgres' egne meldinger begynner med liten og er ikke skrevet
 * for brukeren. Et brudd på en unik indeks sies med meldingen i `unike`, etter
 * indeksens navn, og et brudd på en regel i tabellen med en generell melding.
 * En uventet feil får den generelle meldingen med databasens egen kode og
 * melding etter, så den kan meldes videre og finnes igjen.
 */
export interface Databasefeil {
  code?: string
  message?: string
}

export const UVENTET_FEIL = 'Noe gikk galt. Prøv igjen.'

/** Så mye av databasens egen melding som tas med. */
const DETALJ_MAKS = 300

/** Den generelle meldingen, med databasens kode og melding når de finnes. */
export function uventetFeil(feil: Databasefeil): string {
  const detalj = [feil.code, feil.message?.trim()].filter(Boolean).join(' ').slice(0, DETALJ_MAKS)
  return detalj ? `${UVENTET_FEIL} Teknisk feil: ${detalj}` : UVENTET_FEIL
}

export function lesbarFeil(feil: Databasefeil, unike: Readonly<Record<string, string>> = {}): Error {
  const melding = feil.message ?? ''
  if (feil.code === '23505') {
    const brudd = Object.keys(unike).find((indeks) => melding.includes(indeks))
    if (brudd) return new Error(unike[brudd])
  }
  if (feil.code === '23514') return new Error('Det som ble skrevet, ble ikke godtatt. Kontroller feltene og prøv igjen.')
  return new Error(/^\p{Lu}/u.test(melding) ? melding : uventetFeil(feil))
}
