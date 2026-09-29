import type { ReactNode } from 'react'

export interface BryterProps {
  pa: boolean
  onEndre: (pa: boolean) => void
  /** Teksten ved bryteren, som også er navnet dens. */
  children: ReactNode
  className?: string
}

/**
 * Av og på, som «Vis underkategorier» eller temaet. Selve avkryssingen er
 * usynlig, men tar imot fokus og tastetrykk; sporet viser tilstanden (stilen
 * står under «Bryter» i `skjema.css`).
 */
export function Bryter({ pa, onEndre, children, className }: BryterProps) {
  return (
    <label className={['bryter', className].filter(Boolean).join(' ')}>
      <input type="checkbox" role="switch" checked={pa} onChange={(e) => onEndre(e.target.checked)} />
      <span className="bryter__spor" aria-hidden="true" />
      <span className="bryter__tekst">{children}</span>
    </label>
  )
}
