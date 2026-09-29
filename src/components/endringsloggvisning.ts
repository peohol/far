import { lagSignal } from '../domain/signal'

/**
 * Veien inn til endringsloggen fra andre steder i appen enn versjonspillen,
 * som en utført oppgave eller et varsel som lenker til føringen der det står
 * hva som ble gjort. `Versjonspille` eier loggen og hører etter her.
 */
const endringslogg = lagSignal<string | null>()

/** Åpner endringsloggen, med føringen for `versjon` foldet ut. */
export function visEndringslogg(versjon: string | null = null): void {
  endringslogg.send(versjon)
}

/** Hører etter `visEndringslogg`. Gir tilbake funksjonen som slutter å høre etter. */
export const lyttEtterEndringslogg = endringslogg.lytt
