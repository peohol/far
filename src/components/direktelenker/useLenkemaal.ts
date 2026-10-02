import { useEffect, useState } from 'react'
import { hentLenkemaal } from '../../direktelenker/api'
import { malnokkel, type Lenkemal } from '../../direktelenker/mal'
import type { Lenkemaal } from '../../direktelenker/modell'

export type Lenketilstand =
  | { status: 'laster' }
  | { status: 'klar'; maal: Lenkemaal }
  /** Det lenken peker på, finnes ikke (lenger). */
  | { status: 'borte' }
  | { status: 'feil' }

const LASTER: Lenketilstand = { status: 'laster' }

/** Det en direktelenke peker på, slått opp når den vises. Uten mål: borte. */
export function useLenkemaal(mal: Lenkemal | null): Lenketilstand {
  const nokkel = mal ? malnokkel(mal) : null
  const [tilstand, setTilstand] = useState<{ nokkel: string | null; tilstand: Lenketilstand }>({ nokkel, tilstand: LASTER })

  useEffect(() => {
    if (!mal) return
    let aktiv = true
    hentLenkemaal(mal).then(
      (maal) => aktiv && setTilstand({ nokkel, tilstand: maal ? { status: 'klar', maal } : { status: 'borte' } }),
      () => aktiv && setTilstand({ nokkel, tilstand: { status: 'feil' } }),
    )
    return () => {
      aktiv = false
    }
    // Målet kjennes på nøkkelen; et nytt objekt med samme mål skal ikke slå opp igjen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nokkel])

  if (!mal) return { status: 'borte' }
  return tilstand.nokkel === nokkel ? tilstand.tilstand : LASTER
}
