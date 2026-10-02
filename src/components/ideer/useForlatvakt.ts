import { useCallback, useEffect, useState, type MutableRefObject } from 'react'

/**
 * `lagrer`: lagringen er sendt, og skjemaet kan ikke forlates før svaret har
 * kommet — ellers ville det blitt lagret etter at brukeren forkastet det.
 */
export type Skjemastatus = 'uendret' | 'ulagret' | 'lagrer'

/** Gjør `handling` når skjemaet kan forlates, eller spør først. */
export type Forlat = (handling: () => void) => void

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

  const nullstill = useCallback(() => {
    setStatus('uendret')
    setForlater(null)
  }, [])

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
    /** Endringene er forkastet, så vakten slipper før det brukeren ville, skjer. */
    forkast: () => {
      const handling = forlater
      nullstill()
      handling?.()
    },
    fortsett: useCallback(() => setForlater(null), []),
    /** Til `vedLukking` på laget: holder det åpent og spør, når det trengs. */
    vedLukking: (onLukk: () => void) => () => {
      if (status === 'uendret') return true
      if (status === 'ulagret') setForlater(() => onLukk)
      return false
    },
    /** En ny side, eller en ny åpning av laget, begynner uten endringer. */
    nullstill,
  }
}

/**
 * Gir vakten til laget som står åpent, til den som eier lagene (`Ideknapp`),
 * så det som kommer utenfra — et varsel eller en direktelenke — også spør før
 * skjemaet forlates.
 */
export function useMeldVakt(apen: boolean, forlat: Forlat, til: MutableRefObject<Forlat | null> | undefined) {
  useEffect(() => {
    if (!apen || !til) return
    til.current = forlat
    return () => {
      if (til.current === forlat) til.current = null
    }
  })
}
