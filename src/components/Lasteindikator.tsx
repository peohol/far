import { useEffect, useState, useSyncExternalStore } from 'react'
import { abonnerPaHentinger, pagaendeHentinger } from '../auth/aktivitet'
import '../styles/lasting.css'

/** Hvor lenge en henting må vare før indikatoren vises, så korte hentinger ikke blinker. */
export const LASTEINDIKATOR_FORSINKELSE_MS = 250

/**
 * Den tynne streken øverst i vinduet mens appen henter noe fra databasen
 * (`src/auth/aktivitet.ts`). Den kommer først når hentingen har vart en
 * stund, og forsvinner når alt er hentet.
 */
export function Lasteindikator() {
  const henter = useSyncExternalStore(abonnerPaHentinger, () => pagaendeHentinger() > 0)
  const [vis, setVis] = useState(false)

  useEffect(() => {
    if (!henter) return setVis(false)
    const tidtaker = window.setTimeout(() => setVis(true), LASTEINDIKATOR_FORSINKELSE_MS)
    return () => window.clearTimeout(tidtaker)
  }, [henter])

  return (
    <div
      className="lasteindikator"
      data-vis={vis ? 'ja' : 'nei'}
      role="progressbar"
      aria-label="Henter data"
      aria-hidden={!vis}
    />
  )
}

/** En liten snurrende sirkel ved en tekst om at noe hentes. Teksten sier det. */
export function Lastesirkel() {
  return <span className="lastesirkel" aria-hidden="true" />
}
