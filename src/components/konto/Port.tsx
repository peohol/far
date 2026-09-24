import { Component, Suspense, lazy, type ReactNode } from 'react'
import { useOkt } from '../../auth/okt'
import type { Tilgang } from '../../domain/tilgang'
import { useTheme } from '../../hooks/useTheme'
import { Button } from '../Button'
import { Temaknapp } from '../toppmeny/Temaknapp'
import { Forstegangsoppsett } from './Forstegangsoppsett'
import { Innlogging } from './Innlogging'

/**
 * Den kliniske appen, hentet først når noen faktisk er logget inn.
 *
 * Det er denne delen av pakken innloggingsveggen står foran: uten en gyldig
 * økt svarer kanten 401, og ingenting av analysedataene, kommentartekstene
 * eller fortolkningsreglene utleveres. Se `src/auth/vegg.ts`.
 */
const App = lazy(() => import('../../App'))

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

  if (tilgang === 'app') {
    return (
      <Hentefeil>
        <Suspense fallback={<div className="port" aria-busy="true" />}>
          <App />
        </Suspense>
      </Hentefeil>
    )
  }
  if (tilgang === 'venter') return <div className="port" aria-busy="true" />
  return <Portskall viser={tilgang} />
}

/**
 * Rammen rundt innlogging, førstegangsoppsett og kontaktfeil.
 *
 * Her står bare det som må stå utenfor innloggingsveggen. Endringsloggen er
 * ikke blant det: den hører til inne i appen, og skal ikke kunne leses av noen
 * som ikke er logget inn.
 */
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

/**
 * Fanger opp at den kliniske delen ikke lot seg hente.
 *
 * Som regel fordi appen er lagt ut på nytt mens fanen sto åpen, og filen
 * fanen ber om ikke finnes lenger — da hjelper det å laste siden på nytt. Uten
 * dette ville brukeren fått en blank skjerm.
 */
class Hentefeil extends Component<{ children: ReactNode }, { feilet: boolean }> {
  override state = { feilet: false }

  static getDerivedStateFromError() {
    return { feilet: true }
  }

  override render() {
    if (!this.state.feilet) return this.props.children

    return (
      <div className="port">
        <main className="portkort">
          <header className="portkort__topp">
            <h1 className="portkort__tittel">OUSFAR</h1>
          </header>
          <div className="skjema">
            <p className="skjemafeil" role="alert">
              Fikk ikke hentet appen. Det skjer gjerne rett etter at OUSFAR er oppdatert. Last
              siden på nytt.
            </p>
            <Button onClick={() => window.location.reload()}>Last siden på nytt</Button>
          </div>
        </main>
      </div>
    )
  }
}
