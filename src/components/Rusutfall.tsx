import type { ReactNode } from 'react'
import { Panelhode } from './Panelhode'
import type { RusPlassering, RusResultat } from '../domain/rus'

export interface RusutfallProps {
  resultat: RusResultat
  /** Kommentarene, når fortolkningen ga noen: kopierbare i modulen, bare til å lese i simulatoren. */
  kommentarer: (plasseringer: RusPlassering[]) => ReactNode
}

/**
 * Utfallet av en rusmiddelfortolkning: hva som mangler, en sak til plenum,
 * eller kommentarene med notisene over. Felles for fortolkningsmodulen og
 * simulatoren på stoffsiden, så simulatoren viser det samme som modulen.
 */
export function Rusutfall({ resultat, kommentarer }: RusutfallProps) {
  switch (resultat.type) {
    case 'mangler':
      return (
        <>
          <Panelhode ikon="fallback" tone="toksisk">
            Mangler
          </Panelhode>
          <ul className="mangelliste">
            {resultat.mangler.map((melding) => (
              <li key={melding}>{melding}</li>
            ))}
          </ul>
        </>
      )

    // Kilden har ingen standardkommentar for tilfellet, og sier at saken skal
    // tas opp i plenum. Da skal det ikke ligge noe her til å kopiere — bare
    // beskjed om hvorfor, og hva kilden sier.
    case 'plenum':
      return (
        <>
          <Panelhode ikon="interp">Til plenum</Panelhode>
          <p className="rus-plenum" role="note">
            {resultat.melding}
          </p>
          {resultat.veiledning.map((tekst) => (
            <p className="rus-veiledning" key={tekst}>
              {tekst}
            </p>
          ))}
        </>
      )

    case 'kommentarer':
      return (
        <>
          <Panelhode ikon="interp">{resultat.plasseringer.length > 1 ? 'Kommentarer' : 'Kommentar'}</Panelhode>
          {resultat.notiser.map((notis) => (
            <p className="notis" role="note" key={notis}>
              {notis}
            </p>
          ))}
          {kommentarer(resultat.plasseringer)}
        </>
      )
  }
}
