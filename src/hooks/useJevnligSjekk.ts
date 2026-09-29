import { useEffect } from 'react'

/** Hvor ofte appen ser etter noe nytt mens den står åpen. */
export const SJEKK_HVER = 5 * 60_000

/**
 * Kjører `sjekk` med én gang, når fanen får fokus eller blir synlig igjen, og
 * jevnlig mens den er synlig — som idémenyen og bjella gjør for å se etter
 * nye kommentarer og varsler. `sjekk` bør ha fast identitet.
 */
export function useJevnligSjekk(sjekk: () => void, hver = SJEKK_HVER): void {
  useEffect(() => {
    sjekk()
    const naarSynlig = () => {
      if (document.visibilityState === 'visible') sjekk()
    }
    const jevnlig = window.setInterval(naarSynlig, hver)
    window.addEventListener('focus', naarSynlig)
    document.addEventListener('visibilitychange', naarSynlig)
    return () => {
      window.clearInterval(jevnlig)
      window.removeEventListener('focus', naarSynlig)
      document.removeEventListener('visibilitychange', naarSynlig)
    }
  }, [sjekk, hver])
}
