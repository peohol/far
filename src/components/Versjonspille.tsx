import { useCallback, useEffect } from 'react'
import { useBevart } from '../oppdatering/Bevaring'
import { ENDRINGSLOGG } from '../data/endringslogg'
import { nyesteVersjon } from '../domain/versjon'
import { Endringslogg } from './Endringslogg'
import { lyttEtterEndringslogg } from './endringsloggvisning'
import { Ikon } from './ikon/Ikon'
import { useTips } from './Tips'

/** Versjonen appen kjører — den øverste føringen i endringsloggen. */
export const VERSJON = nyesteVersjon(ENDRINGSLOGG)

/**
 * Versjonsnummeret med klokka, fast nederst til høyre i vinduet, og veien inn
 * til endringsloggen. Andre deler av appen kan åpne loggen på en bestemt
 * føring med `visEndringslogg`, som en utført oppgave gjør.
 *
 * Den ligger med vilje lavt i synsfeltet og lavt i kontrast: den skal kunne
 * finnes når noen lurer på hva som er nytt, uten å ta oppmerksomhet fra
 * svaret som skal kommenteres. Den har heller ingen hurtigtast — tastene i
 * appen tilhører den kliniske flyten.
 */
export function Versjonspille() {
  const [apen, setApen] = useBevart('endringslogg', false)
  /** Føringen loggen åpnes på, når den ble åpnet fra en lenke. */
  const [versjon, setVersjon] = useBevart<string | null>('endringslogg/versjon', null)
  useEffect(
    () =>
      lyttEtterEndringslogg((ny) => {
        setVersjon(ny)
        setApen(true)
      }),
    [],
  )
  // Teksten er allerede en del av knappens navn, og skal ikke leses to ganger.
  const tips = useTips('Vis endringslogg', { skjermleser: false })
  const lukk = useCallback(() => setApen(false), [])

  return (
    <>
      <button
        type="button"
        className="versjonspille"
        data-ih=""
        aria-label={`Versjon ${VERSJON} – vis endringslogg`}
        aria-haspopup="dialog"
        onClick={() => {
          setVersjon(null)
          setApen(true)
        }}
        {...tips.props}
      >
        <Ikon navn="history" storrelse={14} />v{VERSJON}
      </button>

      <Endringslogg apen={apen} versjon={versjon} onLukk={lukk} />
    </>
  )
}
