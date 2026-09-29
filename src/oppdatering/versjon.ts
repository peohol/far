/**
 * Om det er lagt ut en nyere versjon av appen enn den som kjører.
 *
 * Hvert bygg får en identitet (`__BYGG__`, commiten det er bygget fra) og
 * legger den sammen med versjonsnummeret i `versjon.json` ved siden av
 * `index.html` (se `vite.config.ts`). Appen som kjører, spør jevnlig etter den
 * fila. Står det et annet bygg der enn det appen selv er, er en annen versjon
 * lagt ut — som regel en nyere, men det gjelder også når en versjon er trukket
 * tilbake. Fila ligger utenfor innloggingsveggen og sier ikke noe annet enn
 * dette.
 */

declare const __BYGG__: string

/** Bygget som kjører. */
export const BYGG: string = typeof __BYGG__ === 'string' ? __BYGG__ : 'ukjent'

/** Fila bygget legger ut, ved siden av `index.html`. */
export const VERSJONSFIL = 'versjon.json'

/** Det `versjon.json` inneholder. */
export interface Byggopplysninger {
  bygg: string
  /** Versjonsnummeret til bygget, den øverste føringen i endringsloggen. */
  versjon: string
}

function erByggopplysninger(data: unknown): data is Byggopplysninger {
  const { bygg, versjon } = (data ?? {}) as Partial<Record<keyof Byggopplysninger, unknown>>
  return typeof bygg === 'string' && bygg !== '' && typeof versjon === 'string'
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

/** Den utlagte versjonen, når den er en annen enn den som kjører. */
export function nyVersjon(utlagt: Byggopplysninger | null, kjorer: string = BYGG): Byggopplysninger | null {
  return utlagt && utlagt.bygg !== kjorer ? utlagt : null
}
