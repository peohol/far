import type { ReactNode } from 'react'

export interface CardProps {
  children: ReactNode
  /** Venstrejustert innhold i stedet for midtstilt. */
  align?: 'center' | 'start'
  className?: string
}

/** Hevet flate som samler én ting av gangen og gir tydelig visuell avgrensning. */
export function Card({ children, align = 'center', className }: CardProps) {
  return (
    <section className={['kort', `kort--${align}`, className].filter(Boolean).join(' ')}>
      {children}
    </section>
  )
}
