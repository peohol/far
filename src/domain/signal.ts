/**
 * Et signal på tvers av appen: noe som skal skje et annet sted enn der det
 * blir bedt om, som å åpne endringsloggen eller en idé fra et varsel. Den
 * delen som eier det som skal skje, hører etter; resten sender.
 */
export interface Signal<T> {
  send: (verdi: T) => void
  /** Hører etter signalet. Gir tilbake funksjonen som slutter å høre etter. */
  lytt: (lytter: (verdi: T) => void) => () => void
}

export function lagSignal<T = void>(): Signal<T> {
  const lyttere = new Set<(verdi: T) => void>()
  return {
    send: (verdi) => {
      for (const lytter of lyttere) lytter(verdi)
    },
    lytt: (lytter) => {
      lyttere.add(lytter)
      return () => {
        lyttere.delete(lytter)
      }
    },
  }
}
