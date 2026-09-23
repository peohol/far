import { useCallback, useEffect, useState } from 'react'
import { adresse, lesRute, sammeRute, type Rute } from '../domain/rute'

/**
 * Ruten adressefeltet peker på, og veien til en annen.
 *
 * Adressefeltet er fasit: tilbake- og framknappene i nettleseren, et bokmerke
 * og en lenke åpnet i samme fane går alle gjennom `hashchange`, og appen
 * følger med. En ny rute legges i historikken, så tilbakeknappen går dit man
 * kom fra.
 */
export function useRute(): [Rute, (rute: Rute) => void] {
  const [rute, setRute] = useState<Rute>(() => lesRute(window.location.hash))

  useEffect(() => {
    const oppdater = () =>
      setRute((forrige) => {
        const ny = lesRute(window.location.hash)
        return sammeRute(forrige, ny) ? forrige : ny
      })
    window.addEventListener('hashchange', oppdater)
    return () => window.removeEventListener('hashchange', oppdater)
  }, [])

  const gaaTil = useCallback((ny: Rute) => {
    if (window.location.hash !== adresse(ny)) window.location.hash = adresse(ny)
    setRute(ny)
  }, [])

  return [rute, gaaTil]
}
