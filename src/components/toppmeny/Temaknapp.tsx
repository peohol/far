import type { Tema } from '../../domain/systemvalg'
import { Ikonknapp, type IkonknappProps, type Ikonknappvariant } from '../Ikonknapp'

/** Lyst eller mørkt tema på innloggingssiden, utenfor appen. Inne i appen står valget under «Preferanser» i kontomenyen. */
export function Temaknapp({
  tema,
  onVelg,
  variant = 'stille',
  storrelse = 'liten',
}: {
  /** Temaet som gjelder nå, også når det følger systemet. */
  tema: Tema
  onVelg: (tema: Tema) => void
  /** Alene i hjørnet på innloggingssiden står den med kant, i full størrelse. */
  variant?: Ikonknappvariant
  storrelse?: IkonknappProps['storrelse']
}) {
  const tilLyst = tema === 'moerkt'
  return (
    <Ikonknapp
      ikon={tilLyst ? 'sun' : 'moon'}
      etikett={tilLyst ? 'Bytt til lyst tema' : 'Bytt til mørkt tema'}
      variant={variant}
      storrelse={storrelse}
      onClick={() => onVelg(tilLyst ? 'lyst' : 'moerkt')}
    />
  )
}
