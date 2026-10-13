import { useState } from 'react'
import { OPPSUMMERING_MAKS } from '../../endringslogg/operasjon'
import { Felt } from '../konto/Felt'
import '../../styles/innholdslogg.css'

/**
 * Den valgfrie oppsummeringen av en endring, til endringsloggen for siden.
 * Den står lukket bak en liten lenkeknapp, så den ikke gjør lagringen
 * tyngre; tom beskriver loggen endringen selv ut fra det som ble endret.
 *
 * `skjema` er skjemaet feltet hører til når det står utenfor det (i foten av
 * et redigeringsvindu), så Enter i feltet lagrer som i resten av skjemaet.
 * `onEnter` lagrer der det ikke er noe eget skjema (som en ny referanse inne i
 * skjemaet for kortet), så Enter ikke sender det ytre skjemaet.
 */
export function Oppsummeringsfelt({
  verdi,
  onEndre,
  skjema,
  onEnter,
}: {
  verdi: string
  onEndre: (verdi: string) => void
  skjema?: string
  onEnter?: () => void
}) {
  const [apen, setApen] = useState(verdi !== '')
  if (!apen) {
    return (
      <button type="button" className="oppsummeringsfelt__apne" onClick={() => setApen(true)}>
        Legg til en kort oppsummering (valgfri)
      </button>
    )
  }
  return (
    <div className="oppsummeringsfelt">
      <Felt
        merkelapp="Kort oppsummering til endringsloggen (valgfri)"
        hjelp="Uten oppsummering beskriver endringsloggen selv hva som ble endret."
        value={verdi}
        maxLength={OPPSUMMERING_MAKS}
        autoFocus
        {...(skjema && { form: skjema })}
        onChange={(e) => onEndre(e.target.value)}
        {...(onEnter && {
          onKeyDown: (e) => {
            if (e.key !== 'Enter') return
            e.preventDefault()
            onEnter()
          },
        })}
      />
    </div>
  )
}
