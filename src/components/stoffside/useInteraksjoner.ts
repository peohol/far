import { useEffect, useMemo, useState } from 'react'
import { byggInteraksjoner, interaksjonsnokler, type Interaksjonsoversikt } from '../../legemiddeldata/interaksjoner'
import { useFaginnholdskilde } from './Faginnholdskilde'
import type { Legemiddeltilstand } from './useLegemidler'

export type Interaksjonstilstand =
  | { status: 'ingen' }
  | { status: 'laster' }
  | { status: 'klar'; oversikt: Interaksjonsoversikt }
  | { status: 'feil'; feil: string }

/**
 * Interaksjonene for preparatene siden er koblet til. Slås opp når
 * preparatene er hentet, på ATC-kodene deres; `ingen` når siden ikke er
 * koblet, og `feil` også når preparatene ikke kunne hentes.
 */
export function useInteraksjoner(legemidler: Legemiddeltilstand, koblet: readonly string[]): Interaksjonstilstand {
  const { legemidler: leser } = useFaginnholdskilde()
  const utvalg = legemidler.status === 'klar' ? legemidler.utvalg : null
  // Nøkkelen, og ikke lista, avgjør om koblingen er ny, som i `useLegemidler`.
  const koblingsnokkel = koblet.join('\n')
  const nokler = useMemo(
    () => (utvalg ? interaksjonsnokler(utvalg, koblingsnokkel ? koblingsnokkel.split('\n') : []) : null),
    [utvalg, koblingsnokkel],
  )
  const [tilstand, setTilstand] = useState<Interaksjonstilstand>({ status: 'ingen' })

  useEffect(() => {
    if (legemidler.status === 'feil') return setTilstand({ status: 'feil', feil: legemidler.feil })
    if (legemidler.status === 'laster') return setTilstand({ status: 'laster' })
    if (!leser || !nokler) return setTilstand({ status: 'ingen' })
    let gjelder = true
    setTilstand({ status: 'laster' })
    leser
      .interaksjoner(nokler)
      .then((utvalg) => {
        if (gjelder) setTilstand({ status: 'klar', oversikt: byggInteraksjoner(utvalg, nokler) })
      })
      .catch((e: Error) => {
        if (gjelder) setTilstand({ status: 'feil', feil: e.message })
      })
    return () => {
      gjelder = false
    }
  }, [leser, nokler, legemidler])

  return tilstand
}
