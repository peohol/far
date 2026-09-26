import { useEffect } from 'react'

/** Hvor lenge nettleseren høyst får vente med det før det gjøres likevel. */
const LENGSTE_VENTETID_MS = 4000

/**
 * Gjør `gjor` én gang når nettleseren har tid til overs etter at appen er
 * vist, og på nytt når `gjor` endres. Til det som er greit å ha klart, men som
 * ingen venter på ennå.
 */
export function useNaarLedig(gjor: () => void): void {
  useEffect(() => {
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(() => gjor(), { timeout: LENGSTE_VENTETID_MS })
      return () => window.cancelIdleCallback(id)
    }
    // Nettlesere uten `requestIdleCallback` venter litt i stedet.
    const id = window.setTimeout(gjor, LENGSTE_VENTETID_MS / 4)
    return () => window.clearTimeout(id)
  }, [gjor])
}
