import App from '../../App'
import { useOkt } from '../../auth/okt'
import type { Tilgang } from '../../domain/tilgang'
import { useTheme } from '../../hooks/useTheme'
import { Button } from '../Button'
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
  return <Portskall viser={tilgang} />
}

/** Rammen rundt innlogging, førstegangsoppsett og kontaktfeil. */
function Portskall({ viser }: { viser: Exclude<Tilgang, 'app' | 'venter'> }) {
  const { theme, toggle } = useTheme()

  return (
    <div className="port">
      <div className="verktoylinje">
        <Temaknapp theme={theme} onToggleTheme={toggle} />
      </div>

      <main
        className={['portkort', viser === 'oppsett' && 'portkort--bred']
          .filter(Boolean)
          .join(' ')}
      >
        <header className="portkort__topp">
          <h1 className="portkort__tittel">OUSFAR</h1>
          <p className="portkort__undertittel">
            Fortolkning og kommentering av farmakologiske analyser
          </p>
        </header>

        {viser === 'oppsett' && <Forstegangsoppsett />}
        {viser === 'innlogging' && <Innlogging />}
        {viser === 'feil' && <Kontaktfeil />}
      </main>

      <Versjonspille />
    </div>
  )
}

/**
 * Økten står, men profilen lot seg ikke hente.
 *
 * Som regel et nett som falt ut. Oppslaget prøves ikke om igjen av seg selv,
 * så brukeren må få en vei videre i stedet for en tom skjerm.
 */
function Kontaktfeil() {
  const { forsokPaaNytt, loggUt } = useOkt()

  return (
    <div className="skjema">
      <p className="skjemafeil" role="alert">
        Fikk ikke kontakt med brukerdatabasen. Sjekk nettforbindelsen og prøv igjen.
      </p>
      <div className="skjema__knapper">
        <Button onClick={forsokPaaNytt}>Prøv igjen</Button>
        <Button variant="subtle" onClick={() => void loggUt()}>
          Logg ut
        </Button>
      </div>
    </div>
  )
}
