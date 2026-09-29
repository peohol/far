import { useCallback, useEffect, useState } from 'react'
import { hentIdeerMedNytt } from '../../ideer/api'
import { Menyvalg, Nedtrekksmeny } from '../toppmeny/Nedtrekksmeny'
import { Ideer } from './Ideer'
import { Oppgaver } from './Oppgaver'

/** Hvor ofte appen ser etter nye kommentarer på idéene mens den står åpen. */
const NYTT_HVER = 5 * 60_000

/** Laget som står åpent: Idéer, eller Planlagte oppgaver, kanskje på én oppgave. */
type Vindu = { lag: 'ideer' } | { lag: 'oppgaver'; oppgave?: string } | null

/**
 * Idéer og Planlagte oppgaver, fra en egen meny i toppmenyen med ett valg for
 * hver. Har idéene kommentarer brukeren ikke har sett, står det en prikk på
 * knappen og på valget, og antallet i navnet.
 *
 * Bare ett av de to lagene står åpent om gangen; man går også mellom dem fra
 * lagene selv.
 */
export function Ideknapp() {
  const [vindu, setVindu] = useState<Vindu>(null)
  /** Antall idéer med kommentarer brukeren ikke har sett. Sjekkes når appen og fanen åpnes, etter vinduet og jevnlig. */
  const [medNytt, setMedNytt] = useState(0)
  const sjekkNytt = useCallback(() => {
    hentIdeerMedNytt().then(setMedNytt, () => undefined)
  }, [])
  useEffect(() => {
    sjekkNytt()
    // Også mens appen står åpen: når fanen får fokus igjen, og jevnlig mens den er synlig.
    const naarSynlig = () => {
      if (document.visibilityState === 'visible') sjekkNytt()
    }
    const jevnlig = window.setInterval(naarSynlig, NYTT_HVER)
    window.addEventListener('focus', naarSynlig)
    document.addEventListener('visibilitychange', naarSynlig)
    return () => {
      window.clearInterval(jevnlig)
      window.removeEventListener('focus', naarSynlig)
      document.removeEventListener('visibilitychange', naarSynlig)
    }
  }, [sjekkNytt])
  const nytt = medNytt > 0 ? `nye kommentarer på ${medNytt === 1 ? 'én idé' : `${medNytt} idéer`}` : undefined

  // Fast identitet: `Modallag` kobler den til lukkehendelsen på dialogen.
  // Lukkingen gjelder bare laget som står åpent: når man går fra det ene til
  // det andre, lukkes det første etter at det andre er valgt.
  const lukk = useCallback(
    (lag: NonNullable<Vindu>['lag']) => {
      setVindu((naa) => (naa?.lag === lag ? null : naa))
      sjekkNytt()
    },
    [sjekkNytt],
  )
  const lukkIdeer = useCallback(() => lukk('ideer'), [lukk])
  const lukkOppgaver = useCallback(() => lukk('oppgaver'), [lukk])

  return (
    <>
      <Nedtrekksmeny
        className="idemeny"
        knapp={{
          ikon: 'ideoppgaver',
          etikett: `Idéer og planlagte oppgaver${nytt ? ` (${nytt})` : ''}`,
          variant: 'stille',
          storrelse: 'liten',
        }}
        etikett="Idéer og planlagte oppgaver"
        lag="idemeny"
        ved={nytt && <span className="nyprikk toppmeny__prikk" aria-hidden="true" />}
      >
        {(lukk) => {
          /** Et valg lukker menyen først, så laget det åpner gir fokus tilbake til knappen. */
          const apne = (neste: NonNullable<Vindu>) => () => {
            lukk()
            setVindu(neste)
          }
          return (
            <ul className="nedtrekk__valg">
              <li>
                <Menyvalg ikon="idea" tekst="Idéer" nytt={nytt} onClick={apne({ lag: 'ideer' })} />
              </li>
              <li>
                <Menyvalg ikon="oppgaver" tekst="Planlagte oppgaver" onClick={apne({ lag: 'oppgaver' })} />
              </li>
            </ul>
          )
        }}
      </Nedtrekksmeny>
      <Ideer apen={vindu?.lag === 'ideer'} onLukk={lukkIdeer} onOppgaver={(oppgave) => setVindu({ lag: 'oppgaver', oppgave })} />
      <Oppgaver
        apen={vindu?.lag === 'oppgaver'}
        oppgave={vindu?.lag === 'oppgaver' ? vindu.oppgave : undefined}
        onLukk={lukkOppgaver}
        onIdeer={() => setVindu({ lag: 'ideer' })}
      />
    </>
  )
}
