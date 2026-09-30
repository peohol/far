/**
 * Om det er lagt ut en nyere versjon av appen enn den som kjører.
 *
 * Hvert bygg får en identitet (`bygg`, commiten det er bygget fra) og legger
 * den sammen med versjonene sine i `versjon.json` ved siden av `index.html`
 * (se `vite.config.ts`). Appen som kjører, spør jevnlig etter den fila. Brukeren
 * bes om å oppdatere når versjonen de skal oppdatere til (`oppdatering`) er en
 * annen enn den som kjører — som regel en nyere, men det gjelder også når en
 * versjon er trukket tilbake. Et bygg som bare er en stille designjustering
 * eller en føring med `utenVarsel`, ber altså ingen oppdatere. Fila ligger
 * utenfor innloggingsveggen og sier ikke noe annet enn dette.
 */

/** Det `versjon.json` inneholder. */
export interface Byggopplysninger {
  bygg: string
  /** Versjonsnummeret til bygget, den øverste føringen i endringsloggen. */
  versjon: string
  /**
   * Versjonen brukerne bes om å oppdatere til, den nyeste føringen som varsles
   * (`oppdateringsversjon`). Mangler i bygg fra før feltet fantes.
   */
  oppdatering?: string
}

declare const __BYGG__: Byggopplysninger | undefined

/** Bygget som kjører. */
export const KJORER: Byggopplysninger =
  typeof __BYGG__ === 'object' ? __BYGG__ : { bygg: 'ukjent', versjon: '0.0.0', oppdatering: '0.0.0' }

/** Fila bygget legger ut, ved siden av `index.html`. */
export const VERSJONSFIL = 'versjon.json'

function erByggopplysninger(data: unknown): data is Byggopplysninger {
  const { bygg, versjon, oppdatering } = (data ?? {}) as Partial<Record<keyof Byggopplysninger, unknown>>
  return (
    typeof bygg === 'string' &&
    bygg !== '' &&
    typeof versjon === 'string' &&
    (oppdatering === undefined || typeof oppdatering === 'string')
  )
}

/**
 * Bygget som er lagt ut nå, eller `null` når det ikke lar seg finne ut — uten
 * nett, eller i utviklingsserveren, som ikke har fila. Svaret skal aldri komme
 * fra et mellomlager.
 */
export async function hentUtlagtBygg(hent: typeof fetch = fetch): Promise<Byggopplysninger | null> {
  try {
    const svar = await hent(new URL(VERSJONSFIL, document.baseURI), { cache: 'no-store' })
    if (!svar.ok) return null
    const data: unknown = await svar.json()
    return erByggopplysninger(data) ? data : null
  } catch {
    return null
  }
}

/**
 * Den utlagte versjonen, når brukeren skal bes om å oppdatere til den: når
 * den har en annen `oppdatering` enn den som kjører. Med `alleBygg` holder det
 * at bygget er et annet — det gjelder når en del av appen ikke lar seg laste,
 * for da er filene til bygget som kjører, borte, også etter en stille endring.
 */
export function nyVersjon(
  utlagt: Byggopplysninger | null,
  kjorer: Byggopplysninger = KJORER,
  { alleBygg = false }: { alleBygg?: boolean } = {},
): Byggopplysninger | null {
  if (!utlagt || utlagt.bygg === kjorer.bygg) return null
  return alleBygg || utlagt.oppdatering === undefined || utlagt.oppdatering !== kjorer.oppdatering ? utlagt : null
}
