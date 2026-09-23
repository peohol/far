import type { ReactNode } from 'react'
import type { RusPlassering, RusResultat } from '../domain/rus'

export interface RusutfallProps {
  resultat: RusResultat
  /** Kommentarene, når fortolkningen ga noen: kopierbare i modulen, bare til å lese i simulatoren. */
  kommentarer: (plasseringer: RusPlassering[]) => ReactNode
}

/**
 * Utfallet av en rusmiddelfortolkning: hva som mangler, en sak til plenum,
 * eller kommentarene med notisene over. Felles for fortolkningsmodulen og
 * simulatoren på analyttsiden, så simulatoren viser det samme som modulen.
 */
export function Rusutfall({ resultat, kommentarer }: RusutfallProps) {
  switch (resultat.type) {
    case 'mangler':
      return (
        <>
          <h2 className="thc-resultat__merke">Mangler</h2>
          <ul className="thc-mangler">
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
          <h2 className="thc-resultat__merke">Til plenum</h2>
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
          <h2 className="thc-resultat__merke">{resultat.plasseringer.length > 1 ? 'Kommentarer' : 'Kommentar'}</h2>
          {resultat.notiser.map((notis) => (
            <p className="thc-notis" role="note" key={notis}>
              {notis}
            </p>
          ))}
          {kommentarer(resultat.plasseringer)}
        </>
      )
  }
}
