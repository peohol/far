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
const lukking = lagSignal()

/** Åpner Idéer på idéen, og eventuelt kommentaren, med denne ID-en. */
export const visIde = ide.send

/** Hører etter `visIde`. Gir tilbake funksjonen som slutter å høre etter. */
export const lyttEtterIde = ide.lytt

/** Lukker Idéer og Planlagte oppgaver, som når en lenke fører til en diskusjon bak dem. */
export const lukkIdelagene = lukking.send

/** Hører etter `lukkIdelagene`. */
export const lyttEtterIdelukking = lukking.lytt
