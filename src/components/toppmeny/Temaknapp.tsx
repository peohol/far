import type { Theme } from '../../hooks/useTheme'
import { Ikonknapp, type IkonknappProps, type Ikonknappvariant } from '../Ikonknapp'

/** Lyst eller mørkt tema. Står også på innloggingssiden, utenfor appen. */
export function Temaknapp({
  theme,
  onToggleTheme,
  variant = 'stille',
  storrelse = 'liten',
}: {
  theme: Theme
  onToggleTheme: () => void
  /** Alene i hjørnet på innloggingssiden står den med kant, i full størrelse. */
  variant?: Ikonknappvariant
  storrelse?: IkonknappProps['storrelse']
}) {
  const tilLyst = theme === 'moerkt'
  return (
    <Ikonknapp
      ikon={tilLyst ? 'sun' : 'moon'}
      etikett={tilLyst ? 'Bytt til lyst tema' : 'Bytt til mørkt tema'}
      variant={variant}
      storrelse={storrelse}
      onClick={onToggleTheme}
    />
  )
}
