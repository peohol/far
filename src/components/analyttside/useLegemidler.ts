import { useEffect, useMemo, useState } from 'react'
import type { Legemiddelutvalg } from '../../legemiddeldata/lesing'
import { byggPreparatoversikt, type Preparatoversikt } from '../../legemiddeldata/preparater'
import { useFaginnholdskilde } from './Faginnholdskilde'

export type Legemiddeltilstand =
  | { status: 'ingen' }
  | { status: 'laster' }
  | { status: 'klar'; utvalg: Legemiddelutvalg; oversikt: Preparatoversikt }
  | { status: 'feil'; feil: string }

/**
 * Legemiddeldataene for virkestoffene siden er koblet til, og preparatene
 * gruppert slik seksjonen viser dem. `ingen` når siden ikke er koblet, eller
 * appen er satt opp uten legemiddeldataene.
 */
export function useLegemidler(koblet: readonly string[]): Legemiddeltilstand {
  const { legemidler } = useFaginnholdskilde()
  const nokkel = koblet.join('\n')
  const ider = useMemo(() => (nokkel ? nokkel.split('\n') : []), [nokkel])
  const [tilstand, setTilstand] = useState<Legemiddeltilstand>({ status: 'ingen' })

  useEffect(() => {
    if (!legemidler || ider.length === 0) {
      setTilstand({ status: 'ingen' })
      return
    }
    let gjelder = true
    setTilstand({ status: 'laster' })
    legemidler
      .les(ider)
      .then((utvalg) => {
        if (gjelder) setTilstand({ status: 'klar', utvalg, oversikt: byggPreparatoversikt(utvalg, ider) })
      })
      .catch((e: Error) => {
        if (gjelder) setTilstand({ status: 'feil', feil: e.message })
      })
    return () => {
      gjelder = false
    }
  }, [legemidler, ider])

  return tilstand
}
