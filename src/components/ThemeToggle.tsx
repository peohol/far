import { MoonIcon, SunIcon } from './icons'
import type { Theme } from '../hooks/useTheme'

export function ThemeToggle({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  const tilLyst = theme === 'moerkt'
  return (
    <button
      type="button"
      className="temavelger"
      onClick={onToggle}
      aria-label={tilLyst ? 'Bytt til lyst tema' : 'Bytt til mørkt tema'}
      title={tilLyst ? 'Lyst tema' : 'Mørkt tema'}
    >
      {tilLyst ? <SunIcon /> : <MoonIcon />}
    </button>
  )
}
