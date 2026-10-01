/**
 * Autoerstatt: tegn som byttes ut mens det skrives, som « - » med « – ».
 *
 * Reglene ligger i databasen (`public.autoerstatt_regler`) og endres av
 * administratorene fra adminmenyen. De er nøyaktige, også på mellomrom: en
 * regel slår til når det som står rett foran markøren, blir regelens `finn`
 * idet et tegn skrives. « - » blir da « – », mens «-» alene får stå.
 *
 * Denne fila er bare reglene og hvordan de slår til; rikteksteditoren
 * (`editor.ts`) og tekstfeltene (`felt.ts`) bruker den samme logikken.
 */

export interface Autoerstattregel {
  id: string
  /** Teksten som byttes ut, nøyaktig slik den skrives — mellomrom og alt. */
  finn: string
  /** Det den byttes med. */
  erstatt: string
}

/** Lengst tillatte `finn` og `erstatt`, som i databasen. */
export const MAKS_LENGDE = 20

/**
 * Regelen som slår til når teksten foran markøren er `foran` — den med lengst
 * `finn` når flere passer, så den mest presise vinner — eller `null`.
 */
export function finnRegel(foran: string, regler: readonly Autoerstattregel[]): Autoerstattregel | null {
  let treff: Autoerstattregel | null = null
  for (const regel of regler) {
    if (regel.finn !== '' && foran.endsWith(regel.finn) && (!treff || regel.finn.length > treff.finn.length)) treff = regel
  }
  return treff
}

/** En utført erstatning, så den kan angres med tilbaketasten rett etterpå. */
export interface Erstatning {
  /** Der erstatningen begynner. */
  fra: number
  /** Rett etter erstatningen, der markøren står. */
  til: number
  /** Det som sto der før, og som tilbaketasten setter tilbake. */
  original: string
}

/** Feilen i en regel slik den er fylt ut, eller `null` når den kan lagres. */
export function regelfeil(
  finn: string,
  erstatt: string,
  andre: readonly Autoerstattregel[],
): string | null {
  if (finn === '') return 'Skriv teksten som skal byttes ut.'
  if (erstatt === '') return 'Skriv det teksten skal byttes med.'
  if (finn.length > MAKS_LENGDE || erstatt.length > MAKS_LENGDE) return `Hver tekst kan være høyst ${MAKS_LENGDE} tegn.`
  if (/[\r\n]/.test(finn) || /[\r\n]/.test(erstatt)) return 'En regel kan ikke inneholde linjeskift.'
  if (finn === erstatt) return 'Regelen må bytte teksten med noe annet.'
  if (andre.some((r) => r.finn === finn)) return 'Det finnes alt en regel for denne teksten.'
  return null
}
