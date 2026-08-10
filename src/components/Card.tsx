import { forwardRef, type MouseEvent, type ReactNode } from 'react'
import { rullTilKort } from '../hooks/useKortHopp'

export interface CardProps {
  children: ReactNode
  /** Venstrejustert innhold i stedet for midtstilt. */
  align?: 'center' | 'start'
  className?: string
}

/** Interaktivt innhold der klikket allerede har en jobb — da skal kortet ligge i ro. */
const INTERAKTIVT = 'button, a, input, select, textarea, label, summary, [role="button"]'

/**
 * Hevet flate som samler én ting av gangen og gir tydelig visuell avgrensning.
 *
 * Et klikk på selve flaten ruller kortet til midten av vinduet — nyttig i
 * moduler høyere enn skjermen, og ufarlig ellers: uten noe å rulle skjer
 * ingenting. Klikk på knapper og felt i kortet, eller et klikk som markerer
 * tekst, lar kortet ligge.
 */
export const Card = forwardRef<HTMLElement, CardProps>(function Card(
  { children, align = 'center', className },
  ref,
) {
  const sentrer = (event: MouseEvent<HTMLElement>) => {
    if ((event.target as Element).closest(INTERAKTIVT)) return
    if (!window.getSelection()?.isCollapsed) return
    rullTilKort(event.currentTarget)
  }

  return (
    <section
      ref={ref}
      className={['kort', `kort--${align}`, className].filter(Boolean).join(' ')}
      onClick={sentrer}
    >
      {children}
    </section>
  )
})
