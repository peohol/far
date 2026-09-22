import App from '../../App'
import { useOkt } from '../../auth/okt'
import { useTheme } from '../../hooks/useTheme'
import { Temaknapp } from '../Toolbar'
import { Versjonspille } from '../Versjonspille'
import { Forstegangsoppsett } from './Forstegangsoppsett'
import { Innlogging } from './Innlogging'

/**
 * Portvakten foran appen.
 *
 * Så lenge økten ikke er avklart, tegnes ingenting opp: den kliniske appen
 * skal ikke rekke å blinke fram for en som ikke er logget inn, eller for en
 * som skal til førstegangsoppsettet. Hva som gjelder når, står i
 * `domain/tilgang.ts`.
 */
export function Port() {
  const { tilgang } = useOkt()

  if (tilgang === 'app') return <App />
  if (tilgang === 'venter') return <div className="port" aria-busy="true" />
  return <Portskall oppsett={tilgang === 'oppsett'} />
}

/** Rammen rundt innlogging og førstegangsoppsett. */
function Portskall({ oppsett }: { oppsett: boolean }) {
  const { theme, toggle } = useTheme()

  return (
    <div className="port">
      <div className="verktoylinje">
        <Temaknapp theme={theme} onToggleTheme={toggle} />
      </div>

      <main className={['portkort', oppsett && 'portkort--bred'].filter(Boolean).join(' ')}>
        <header className="portkort__topp">
          <h1 className="portkort__tittel">OUSFAR</h1>
          <p className="portkort__undertittel">
            Fortolkning og kommentering av farmakologiske analyser
          </p>
        </header>

        {oppsett ? <Forstegangsoppsett /> : <Innlogging />}
      </main>

      <Versjonspille />
    </div>
  )
}
