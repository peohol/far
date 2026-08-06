import { KeyboardIcon, MoonIcon, SunIcon } from './icons'
import { useShortcutVisibility } from '../hooks/useShortcutVisibility'
import type { Theme } from '../hooks/useTheme'

interface ToolbarButtonProps {
  onClick: () => void
  label: string
  pressed?: boolean
  children: React.ReactNode
}

function ToolbarButton({ onClick, label, pressed, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      className="verktoyknapp"
      onClick={onClick}
      aria-label={label}
      aria-pressed={pressed}
      title={label}
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
