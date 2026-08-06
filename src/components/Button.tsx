import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Shortcut } from './Shortcut'

type Variant = 'primary' | 'subtle'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  icon?: ReactNode
  /** Tasten som gjør det samme som et klikk, f.eks. «Esc» eller «Enter». */
  shortcut?: string
  children: ReactNode
}

/**
 * Appens eneste knappekomponent. Hurtigtasten vises som en merkelapp og
 * meldes til hjelpemiddelteknologi med `aria-keyshortcuts`, slik at knapp og
 * tastatur alltid forteller det samme.
 */
export function Button({
  variant = 'primary',
  icon,
  shortcut,
  children,
  className,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      className={['knapp', `knapp--${variant}`, className].filter(Boolean).join(' ')}
      aria-keyshortcuts={shortcut ? ariaKey(shortcut) : undefined}
      {...rest}
    >
      {icon && <span className="knapp__ikon">{icon}</span>}
      <span className="knapp__tekst">{children}</span>
      {shortcut && <Shortcut>{shortcut}</Shortcut>}
    </button>
  )
}

/** «Esc» → «Escape», slik `aria-keyshortcuts` vil ha det. */
function ariaKey(shortcut: string): string {
  const map: Record<string, string> = { Esc: 'Escape', '↵': 'Enter' }
  return map[shortcut] ?? shortcut
}
