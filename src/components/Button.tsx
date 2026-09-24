import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Shortcut } from './Shortcut'

/**
 * - `primary`: aksentflate, sidens hovedhandling
 * - `subtle`: gjennomsiktig, for det som står ved siden av
 * - `kant`: liten pille med hårlinje, for handlinger på en rad (Atlas)
 */
type Variant = 'primary' | 'subtle' | 'kant'

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
 * tastatur alltid forteller det samme. Referansen peker på selve knappen,
 * for den som skal feste noe til der den står — som kopikvitteringen.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', icon, shortcut, children, className, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
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
})

/** «Esc» → «Escape», slik `aria-keyshortcuts` vil ha det. */
function ariaKey(shortcut: string): string {
  const map: Record<string, string> = { Esc: 'Escape', '↵': 'Enter' }
  return map[shortcut] ?? shortcut
}
