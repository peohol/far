import type { ReactNode } from 'react'
import { Button } from './Button'
import { Ikon } from './ikon/Ikon'
import type { Ikonnavn } from './ikon/register'

export interface StepBarProps {
  /** Teksten på Esc-handlingen, f.eks. «Bytt analytt». */
  children?: ReactNode
  /** Det Esc gjør i steget. Uten står raden tom, men beholder plassen. */
  onEsc?: () => void
  /** Ikonet foran teksten. Tilbakepilen, med mindre handlingen er noe annet. */
  ikon?: Ikonnavn
}

/**
 * Raden over hovedinnholdet i hvert steg. Her bor Esc-handlingen, så «angre»
 * alltid ligger på samme sted uansett hvor i flyten man er: en stille pille
 * med ikon og tastemerke, venstrestilt over panelene (Atlas).
 */
export function StepBar({ children, onEsc, ikon = 'back' }: StepBarProps) {
  return (
    <div className="stegbar">
      {onEsc && children && (
        <Button variant="subtle" icon={<Ikon navn={ikon} />} shortcut="Esc" onClick={onEsc}>
          {children}
        </Button>
      )}
    </div>
  )
}
