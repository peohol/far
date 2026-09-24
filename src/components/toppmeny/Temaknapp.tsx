import type { Theme } from '../../hooks/useTheme'
import { Ikonknapp } from '../Ikonknapp'

/** Lyst eller mørkt tema. Står også på innloggingssiden, utenfor appen. */
export function Temaknapp({ theme, onToggleTheme }: { theme: Theme; onToggleTheme: () => void }) {
  const tilLyst = theme === 'moerkt'
  return (
    <Ikonknapp
      ikon={tilLyst ? 'sun' : 'moon'}
      etikett={tilLyst ? 'Bytt til lyst tema' : 'Bytt til mørkt tema'}
      variant="stille"
      storrelse="liten"
      onClick={onToggleTheme}
    />
  )
}
