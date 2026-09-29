import { useCallback, useState } from 'react'

/**
 * `lagrer`: lagringen er sendt, og skjemaet kan ikke forlates før svaret har
 * kommet — ellers ville det blitt lagret etter at brukeren forkastet det.
 */
export type Skjemastatus = 'uendret' | 'ulagret' | 'lagrer'

/**
 * Vakten for et skjema i et lag, som idéskjemaet og prompten til en oppgave:
 * med endringer som ikke er lagret, spør det før det forlates, enten det er
 * tilbake, til en annen side eller ut av laget. Mens det lagrer, blir det
 * stående til svaret har kommet.
 */
export function useForlatvakt() {
  const [status, setStatus] = useState<Skjemastatus>('uendret')
  /** Det som skal skje om brukeren forkaster endringene. */
  const [forlater, setForlater] = useState<(() => void) | null>(null)

  /** Gjør `handling` nå, eller spør først når skjemaet har endringer. */
  const forlat = (handling: () => void) => {
    if (status === 'uendret') handling()
    else if (status === 'ulagret') setForlater(() => handling)
  }

  return {
    status,
    setStatus,
    /** Om brukeren står og skal velge mellom å forkaste og å fortsette. */
    forlater: forlater !== null,
    forlat,
    forkast: () => forlater?.(),
    fortsett: useCallback(() => setForlater(null), []),
    /** Til `vedLukking` på laget: holder det åpent og spør, når det trengs. */
    vedLukking: (onLukk: () => void) => () => {
      if (status === 'uendret') return true
      if (status === 'ulagret') setForlater(() => onLukk)
      return false
    },
    /** En ny side begynner uten endringer. */
    nullstill: useCallback(() => {
      setStatus('uendret')
      setForlater(null)
    }, []),
  }
}
