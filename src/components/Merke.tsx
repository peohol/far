import type { ReactNode } from 'react'
import '../styles/merke.css'

/**
 * Tonene et merke kan ha. Hver av dem er et fargepar fra `tokens.css` som
 * `palette.test.ts` måler.
 */
export type Merketone = 'noytral' | 'flate' | 'aksent' | 'fritak' | 'referanse' | 'toksisk' | 'alvorlig'

/**
 * En liten merkelapp for en status, f.eks. «Godkjenningsfritak» eller
 * «Åpnet herfra» (Atlas: `Badge`). Betydningen står alltid i teksten, aldri
 * bare i fargen.
 */
export function Merke({ tone = 'noytral', ikon, children }: { tone?: Merketone; ikon?: ReactNode; children: ReactNode }) {
  return (
    <span className={`merke merke--${tone}`}>
      {ikon}
      {children}
    </span>
  )
}
