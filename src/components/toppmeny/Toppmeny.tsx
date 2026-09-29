import type { ReactNode } from 'react'
import { useMeldSpor } from './Toppmenykilde'

export interface ToppmenyProps {
  /** Sidemenyen — knappen som åpner den, først i menyen. */
  meny: ReactNode
  /** Globalt fagsøk. Tar resten av bredden, og har forrang på smale flater. */
  sok?: ReactNode
  /** Knappene foran kontoen: idéene og adminmenyen. */
  verktoy?: ReactNode
  /** Kontoen, sist i menyen. */
  konto: ReactNode
}

/**
 * Den ene faste toppmenyen: en svevende pille øverst i vinduet, over alt
 * innhold, i rekkefølgen sidemeny · fagsøk · sidens egne handlinger · skille
 * · idéer, adminmeny og konto. Ingen logo.
 *
 * Sidene fyller sine plasser i menyen med `ToppmenyInnhold`. På smale flater
 * flyttes de til en dokk nederst i vinduet.
 *
 * Menyen tar `--toppmeny-offset` av vinduet øverst; innhold og ankere legger
 * seg under den (se `tokens.css`).
 */
export function Toppmeny({ meny, sok, verktoy, konto }: ToppmenyProps) {
  const sidesok = useMeldSpor('sidesok')
  const handlinger = useMeldSpor('handlinger')

  return (
    <header className="toppmeny" data-toppmeny="">
      <nav className="toppmeny__pille" aria-label="Toppmeny">
        {meny}
        <div className="toppmeny__sok">{sok}</div>
        <div className="toppmeny__kontekst" role="group" aria-label="Sidehandlinger">
          <div ref={sidesok} className="toppmeny__spor" data-spor="sidesok" />
          <div ref={handlinger} className="toppmeny__spor" data-spor="handlinger" />
        </div>
        <span className="toppmeny__skille" aria-hidden="true" />
        {verktoy && <div className="toppmeny__verktoy">{verktoy}</div>}
        {konto}
      </nav>
    </header>
  )
}
