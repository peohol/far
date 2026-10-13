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
 */
export function Oppsummeringsfelt({
  verdi,
  onEndre,
  skjema,
}: {
  verdi: string
  onEndre: (verdi: string) => void
  skjema?: string
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
      />
    </div>
  )
}
