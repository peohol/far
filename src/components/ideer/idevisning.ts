import { lagSignal } from '../../domain/signal'

/**
 * Veien inn til en idé fra andre steder i appen enn idémenyen, som et varsel
 * om en ny kommentar eller en direktelenke. `Ideknapp` eier idévinduet og
 * hører etter her.
 */
export interface Idevisning {
  id: string
  /** Kommentaren under idéen som skal vises, om noen. */
  kommentar?: string | null
}

const ide = lagSignal<Idevisning>()
/** Vakten `Ideknapp` melder: lukker lagene og gjør så det som ble bedt om. */
let forlatLagene: ((deretter: () => void) => void) | null = null

/** Åpner Idéer på idéen, og eventuelt kommentaren, med denne ID-en. */
export const visIde = ide.send

/** Hører etter `visIde`. Gir tilbake funksjonen som slutter å høre etter. */
export const lyttEtterIde = ide.lytt

/**
 * Lukker Idéer og Planlagte oppgaver og gjør så `deretter`, som når en lenke
 * fører til en diskusjon bak dem. Har et skjema i dem endringer som ikke er
 * lagret, spør det først, og forkastes ikke endringene, skjer ingenting. Uten
 * lagene i appen gjøres det med en gang.
 */
export function forlatIdelagene(deretter: () => void): void {
  if (forlatLagene) forlatLagene(deretter)
  else deretter()
}

/** For `Ideknapp`, som eier lagene. Gir tilbake funksjonen som melder vakten av. */
export function meldIdelagene(forlat: (deretter: () => void) => void): () => void {
  forlatLagene = forlat
  return () => {
    if (forlatLagene === forlat) forlatLagene = null
  }
}
