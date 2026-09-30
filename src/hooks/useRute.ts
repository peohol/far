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
 * kom fra. Med `erstatt` skrives adressen om uten å legge noe i historikken,
 * for en adresse som bare skal følge med på noe som alt har skjedd.
 */
export function useRute(): [Rute, (rute: Rute, valg?: { erstatt?: boolean }) => void] {
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

  const gaaTil = useCallback((ny: Rute, { erstatt = false }: { erstatt?: boolean } = {}) => {
    if (window.location.hash !== adresse(ny)) {
      if (erstatt) window.history.replaceState(window.history.state, '', adresse(ny))
      else window.location.hash = adresse(ny)
    }
    setRute((forrige) => (sammeRute(forrige, ny) ? forrige : ny))
  }, [])

  return [rute, gaaTil]
}
