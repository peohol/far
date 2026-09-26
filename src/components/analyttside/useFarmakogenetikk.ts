import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Farmakogenetikkutvalg } from '../../clinpgx/lesing'
import { byggFarmakogenetikkvisning, type Farmakogenetikkvisning } from '../../clinpgx/stoffside'
import { useFaginnholdskilde } from './Faginnholdskilde'

export type Farmakogenetikktilstand =
  | { status: 'ingen' }
  | { status: 'laster' }
  | { status: 'klar'; utvalg: Farmakogenetikkutvalg; visning: Farmakogenetikkvisning }
  | { status: 'feil'; feil: string }

/**
 * ClinPGx-dataene for kjemikaliene siden er koblet til, ordnet slik seksjonen
 * «Farmakogenetikk» viser dem. `ingen` når siden ikke er koblet, eller appen
 * er satt opp uten ClinPGx-dataene. `lesPaNytt` henter dem igjen, etter at
 * en administrator har hentet nye fra ClinPGx.
 */
export function useFarmakogenetikk(koblet: readonly string[]): {
  tilstand: Farmakogenetikktilstand
  lesPaNytt: () => void
} {
  const { farmakogenetikk } = useFaginnholdskilde()
  // Nøkkelen, og ikke lista, avgjør om koblingen er ny, som i `useLegemidler`.
  const nokkel = koblet.join('\n')
  const ider = useMemo(() => (nokkel ? nokkel.split('\n') : []), [nokkel])
  const [tilstand, setTilstand] = useState<Farmakogenetikktilstand>({ status: 'ingen' })
  const [runde, setRunde] = useState(0)

  useEffect(() => {
    if (!farmakogenetikk || ider.length === 0) {
      setTilstand({ status: 'ingen' })
      return
    }
    let gjelder = true
    setTilstand((forrige) => (forrige.status === 'klar' ? forrige : { status: 'laster' }))
    farmakogenetikk
      .les(ider)
      .then((utvalg) => {
        if (gjelder) setTilstand({ status: 'klar', utvalg, visning: byggFarmakogenetikkvisning(utvalg) })
      })
      .catch((e: Error) => {
        if (gjelder) setTilstand({ status: 'feil', feil: e.message })
      })
    return () => {
      gjelder = false
    }
  }, [farmakogenetikk, ider, runde])

  const lesPaNytt = useCallback(() => setRunde((r) => r + 1), [])
  return { tilstand, lesPaNytt }
}
