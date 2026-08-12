import { KeyboardIcon, MoonIcon, SunIcon } from './icons'
import { useTips } from './Tips'
import { useShortcutVisibility } from '../hooks/useShortcutVisibility'
import type { Theme } from '../hooks/useTheme'

interface ToolbarButtonProps {
  onClick: () => void
  label: string
  pressed?: boolean
  children: React.ReactNode
}

function ToolbarButton({ onClick, label, pressed, children }: ToolbarButtonProps) {
  // Knappene viser bare et ikon, så teksten trengs for å se hva de gjør.
  // Skjermlesere har den allerede som knappens navn og skal ikke få den to
  // ganger, derfor `skjermleser: false`.
  const tips = useTips(label, { skjermleser: false })

  return (
    <button
      type="button"
      className="verktoyknapp"
      onClick={onClick}
      aria-label={label}
      aria-pressed={pressed}
      {...tips.props}
    >
      {children}
    </button>
  )
}

/** Innstillingene som ligger fast i hjørnet: tema og hurtigtastmerker. */
export function Toolbar({ theme, onToggleTheme }: { theme: Theme; onToggleTheme: () => void }) {
  const { visible, toggle } = useShortcutVisibility()
  const tilLyst = theme === 'moerkt'

  return (
    <div className="verktoylinje">
      <ToolbarButton
        onClick={toggle}
        pressed={visible}
        label={visible ? 'Skjul hurtigtaster' : 'Vis hurtigtaster'}
      >
        <KeyboardIcon />
      </ToolbarButton>
      <ToolbarButton
        onClick={onToggleTheme}
        label={tilLyst ? 'Bytt til lyst tema' : 'Bytt til mørkt tema'}
      >
        {tilLyst ? <SunIcon /> : <MoonIcon />}
      </ToolbarButton>
    </div>
  )
}
