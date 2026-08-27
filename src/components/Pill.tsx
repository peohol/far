import type { ReactNode } from 'react'

export type PillTone = 'noytral' | 'kode' | 'ring' | 'over'

export interface PillProps {
  children: ReactNode
  tone?: PillTone
  icon?: ReactNode
  /** Ledetekst foran verdien, f.eks. «Referanseområde». */
  label?: string
}

/**
 * Liten avrundet etikett for én opplysning — kode, referanseområde,
 * ringegrense, påvisningsgrense, terapiområde eller grensen for toksisk
 * konsentrasjon.
 */
export function Pill({ children, tone = 'noytral', icon, label }: PillProps) {
  return (
    <span className={`pille pille--${tone}`}>
      {icon && <span className="pille__ikon">{icon}</span>}
      {label && <span className="pille__merke">{label}</span>}
      <span className="pille__verdi">{children}</span>
    </span>
  )
}
