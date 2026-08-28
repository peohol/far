import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react'

export type PillTone = 'noytral' | 'kode' | 'metode' | 'kategori' | 'ring' | 'over'

export interface PillProps extends Omit<ComponentPropsWithoutRef<'span'>, 'children'> {
  children: ReactNode
  tone?: PillTone
  icon?: ReactNode
  /** Ledetekst foran verdien, f.eks. «Referanseområde». */
  label?: ReactNode
}

/**
 * Liten avrundet etikett for én opplysning — analysemetode, kategori, kode,
 * referanseområde, ringegrense, påvisningsgrense, terapiområde eller grensen
 * for toksisk konsentrasjon.
 *
 * Resten av egenskapene går videre til elementet, slik at en pille kan bære et
 * tips på samme måte som knappene gjør.
 */
export const Pill = forwardRef<HTMLSpanElement, PillProps>(function Pill(
  { children, tone = 'noytral', icon, label, className, ...rest },
  ref,
) {
  return (
    <span
      ref={ref}
      className={['pille', `pille--${tone}`, className].filter(Boolean).join(' ')}
      {...rest}
    >
      {icon && <span className="pille__ikon">{icon}</span>}
      {label && <span className="pille__merke">{label}</span>}
      <span className="pille__verdi">{children}</span>
    </span>
  )
})
