import { useCallback, useState } from 'react'
import { ENDRINGSLOGG } from '../data/endringslogg'
import { nyesteVersjon } from '../domain/versjon'
import { Endringslogg } from './Endringslogg'
import { useTips } from './Tips'

/** Versjonen appen kjører — den øverste føringen i endringsloggen. */
export const VERSJON = nyesteVersjon(ENDRINGSLOGG)

/**
 * Versjonsnummeret, fast nederst til høyre i vinduet, og veien inn til
 * endringsloggen.
 *
 * Den ligger med vilje lavt i synsfeltet og lavt i kontrast: den skal kunne
 * finnes når noen lurer på hva som er nytt, uten å ta oppmerksomhet fra
 * svaret som skal kommenteres. Den har heller ingen hurtigtast — tastene i
 * appen tilhører den kliniske flyten.
 */
export function Versjonspille() {
  const [apen, setApen] = useState(false)
  // Teksten er allerede en del av knappens navn, og skal ikke leses to ganger.
  const tips = useTips('Vis endringslogg', { skjermleser: false })
  const lukk = useCallback(() => setApen(false), [])

  return (
    <>
      <button
        type="button"
        className="versjonspille"
        aria-label={`Versjon ${VERSJON} – vis endringslogg`}
        aria-haspopup="dialog"
        onClick={() => setApen(true)}
        {...tips.props}
      >
        v{VERSJON}
      </button>

      <Endringslogg apen={apen} onLukk={lukk} />
    </>
  )
}
