import { useCallback, useEffect, useState } from 'react'
import { adresse, kanoniskAdresse, lesRute, sammeRute, type Rute } from '../domain/rute'

/**
 * Skriver en eldre adresse til en fagside — et navn, et alias eller en gammel
 * analyttadresse som `#/analytt/HBUP` — om til den kanoniske, uten å legge
 * noe nytt i historikken. Tilbakeknappen går da dit man kom fra, ikke til den
 * gamle adressen.
 */
function rettAdressen(): void {
  const kanonisk = kanoniskAdresse(window.location.hash)
  if (kanonisk) window.history.replaceState(window.history.state, '', kanonisk)
}

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
    rettAdressen()
    const oppdater = () => {
      rettAdressen()
      setRute((forrige) => {
        const ny = lesRute(window.location.hash)
        return sammeRute(forrige, ny) ? forrige : ny
      })
    }
    window.addEventListener('hashchange', oppdater)
    return () => window.removeEventListener('hashchange', oppdater)
  }, [])

  const gaaTil = useCallback((ny: Rute) => {
    if (window.location.hash !== adresse(ny)) window.location.hash = adresse(ny)
    setRute(ny)
  }, [])

  return [rute, gaaTil]
}
