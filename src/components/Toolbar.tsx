import type { ReactNode } from 'react'
import { KeyboardIcon, MoonIcon, SunIcon } from './icons'
import { useTips } from './Tips'
import { useShortcutVisibility } from '../hooks/useShortcutVisibility'
import type { Theme } from '../hooks/useTheme'

interface VerktoyknappProps {
  onClick: () => void
  label: string
  pressed?: boolean
  /** Ekstra klasse, f.eks. når knappen bærer et profilbilde. */
  className?: string
  children: ReactNode
}

/**
 * Én knapp i verktøylinja: bare et ikon, med teksten som tips og som navn for
 * hjelpemiddelteknologi. Skjermlesere har teksten allerede som knappens navn
 * og skal ikke få den to ganger, derfor `skjermleser: false`.
 */
export function Verktoyknapp({ onClick, label, pressed, className, children }: VerktoyknappProps) {
  const tips = useTips(label, { skjermleser: false })

  return (
    <button
      type="button"
      className={['verktoyknapp', className].filter(Boolean).join(' ')}
      onClick={onClick}
      aria-label={label}
      aria-pressed={pressed}
      {...tips.props}
    >
      {children}
    </button>
  )
}

/** Lyst eller mørkt tema. Står også på innloggingssiden, utenfor appen. */
export function Temaknapp({ theme, onToggleTheme }: { theme: Theme; onToggleTheme: () => void }) {
  const tilLyst = theme === 'moerkt'
  return (
    <Verktoyknapp
      onClick={onToggleTheme}
      label={tilLyst ? 'Bytt til lyst tema' : 'Bytt til mørkt tema'}
    >
      {tilLyst ? <SunIcon /> : <MoonIcon />}
    </Verktoyknapp>
  )
}

export interface ToolbarProps {
  theme: Theme
  onToggleTheme: () => void
  /** Knappene for konto og brukerliste, som står først i linja. */
  foran?: ReactNode
}

/** Innstillingene som ligger fast i hjørnet: konto, tema og hurtigtastmerker. */
export function Toolbar({ theme, onToggleTheme, foran }: ToolbarProps) {
  const { visible, toggle } = useShortcutVisibility()

  return (
    <div className="verktoylinje">
      {foran}
      <Verktoyknapp
        onClick={toggle}
        pressed={visible}
        label={visible ? 'Skjul hurtigtaster' : 'Vis hurtigtaster'}
      >
        <KeyboardIcon />
      </Verktoyknapp>
      <Temaknapp theme={theme} onToggleTheme={onToggleTheme} />
    </div>
  )
}
