import { useCallback, useEffect, useRef, useState } from 'react'
import { malFraAdresse, type Lenkemal } from '../direktelenker/mal'
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
 *
 * En direktelenke (`#/diskusjon/<id>`, `#/ide/<id>`, se `direktelenker/mal.ts`)
 * er ingen side: den gis til `onDirektelenke`, som finner ut hvor den fører,
 * og adressefeltet står på siden man var på (eller fortolkningen, når appen
 * ble åpnet med lenken) til den har funnet det.
 */
export function useRute(
  onDirektelenke?: (mal: Lenkemal) => void,
): [Rute, (rute: Rute, valg?: { erstatt?: boolean }) => void] {
  const [rute, setRute] = useState<Rute>(() => lesRute(window.location.hash))
  const gjeldende = useRef(rute)
  gjeldende.current = rute
  const tilLenke = useRef(onDirektelenke)
  tilLenke.current = onDirektelenke

  useEffect(() => {
    /** Følger en direktelenke i adressefeltet. Sant når det var en. */
    const folgLenke = () => {
      const mal = malFraAdresse(window.location.hash)
      if (!mal) return false
      window.history.replaceState(window.history.state, '', adresse(gjeldende.current))
      tilLenke.current?.(mal)
      return true
    }
    if (!folgLenke()) rettAdressen()
    const oppdater = () => {
      if (folgLenke()) return
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
