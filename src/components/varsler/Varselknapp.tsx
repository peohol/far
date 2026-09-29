import { useCallback, useState } from 'react'
import { merketall } from '../../varsler/modell'
import { Ikonknapp } from '../Ikonknapp'
import { useVarsler } from './useVarsler'
import { Varsler } from './Varsler'

/**
 * Bjella i toppmenyen, rett til venstre for profilbildet. Et rødt merke viser
 * hvor mange uleste varsler brukeren har i kategoriene vedkommende har valgt,
 * og knappen åpner varselvinduet.
 */
export function Varselknapp() {
  const status = useVarsler()
  const [apen, setApen] = useState(false)
  // Fast identitet: `Modallag` kobler den til lukkehendelsen på dialogen.
  const lukk = useCallback(() => setApen(false), [])
  const { antall } = status

  return (
    <div className="varselknapp">
      <Ikonknapp
        ikon="bell"
        etikett={antall > 0 ? `Varsler (${antall} uleste)` : 'Varsler'}
        variant="stille"
        storrelse="liten"
        aria-haspopup="dialog"
        onClick={() => setApen(true)}
      />
      {antall > 0 && (
        <span className="varselmerke" aria-hidden="true">
          {merketall(antall)}
        </span>
      )}
      <Varsler apen={apen} onLukk={lukk} status={status} />
    </div>
  )
}
