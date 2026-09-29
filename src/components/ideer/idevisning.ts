import { lagSignal } from '../../domain/signal'

/**
 * Veien inn til en idé fra andre steder i appen enn idémenyen, som et varsel
 * om en ny kommentar. `Ideknapp` eier idévinduet og hører etter her.
 */
const ide = lagSignal<string>()

/** Åpner Idéer på idéen med denne ID-en. */
export const visIde = ide.send

/** Hører etter `visIde`. Gir tilbake funksjonen som slutter å høre etter. */
export const lyttEtterIde = ide.lytt
