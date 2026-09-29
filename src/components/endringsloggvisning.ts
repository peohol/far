/**
 * Veien inn til endringsloggen fra andre steder i appen enn versjonspillen,
 * som en utført oppgave som lenker til føringen der det står hva som ble
 * gjort. `Versjonspille` eier loggen og hører etter her.
 */
type Lytter = (versjon: string | null) => void

const lyttere = new Set<Lytter>()

/** Åpner endringsloggen, med føringen for `versjon` foldet ut. */
export function visEndringslogg(versjon: string | null = null): void {
  for (const lytter of lyttere) lytter(versjon)
}

/** Hører etter `visEndringslogg`. Gir tilbake funksjonen som slutter å høre etter. */
export function lyttEtterEndringslogg(lytter: Lytter): () => void {
  lyttere.add(lytter)
  return () => {
    lyttere.delete(lytter)
  }
}
