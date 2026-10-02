import { useCallback, useEffect, useState } from 'react'
import { useBevart } from '../../oppdatering/Bevaring'
import { useJevnligSjekk } from '../../hooks/useJevnligSjekk'
import { hentIdeerMedNytt } from '../../ideer/api'
import { oppfriskVarsler } from '../../varsler/api'
import { Menyvalg, Nedtrekksmeny } from '../toppmeny/Nedtrekksmeny'
import { Ideer } from './Ideer'
import { lyttEtterIde, lyttEtterIdelukking } from './idevisning'
import { Oppgaver } from './Oppgaver'

/**
 * Laget som står åpent: Idéer, kanskje på én idé (og en kommentar under den,
 * fra en direktelenke; `nr` er ny for hver lenke), eller Planlagte oppgaver,
 * kanskje på én oppgave.
 */
type Vindu = { lag: 'ideer'; ide?: string; kommentar?: string; nr?: number } | { lag: 'oppgaver'; oppgave?: string } | null

/**
 * Idéer og Planlagte oppgaver, fra en egen meny i toppmenyen med ett valg for
 * hver. Har idéene kommentarer brukeren ikke har sett, står det en prikk på
 * knappen og på valget, og antallet i navnet.
 *
 * Bare ett av de to lagene står åpent om gangen; man går også mellom dem fra
 * lagene selv. Et varsel eller en direktelenke kan åpne Idéer rett på en idé
 * (`visIde`), og en direktelenke til en diskusjon lukker lagene
 * (`lukkIdelagene`).
 */
export function Ideknapp() {
  const [vindu, setVindu] = useBevart<Vindu>('ideknapp', null)
  /** Antall idéer med kommentarer brukeren ikke har sett. Sjekkes når appen og fanen åpnes, etter vinduet og jevnlig. */
  const [medNytt, setMedNytt] = useState(0)
  const sjekkNytt = useCallback(() => {
    hentIdeerMedNytt().then(setMedNytt, () => undefined)
  }, [])
  useJevnligSjekk(sjekkNytt)
  useEffect(
    () =>
      lyttEtterIde(({ id, kommentar }) =>
        setVindu({ lag: 'ideer', ide: id, ...(kommentar && { kommentar }), nr: Date.now() }),
      ),
    [setVindu],
  )
  useEffect(() => lyttEtterIdelukking(() => setVindu(null)), [setVindu])
  const nytt = medNytt > 0 ? `nye kommentarer på ${medNytt === 1 ? 'én idé' : `${medNytt} idéer`}` : undefined

  // Fast identitet: `Modallag` kobler den til lukkehendelsen på dialogen.
  // Lukkingen gjelder bare laget som står åpent: når man går fra det ene til
  // det andre, lukkes det første etter at det andre er valgt.
  const lukk = useCallback(
    (lag: NonNullable<Vindu>['lag']) => {
      setVindu((naa) => (naa?.lag === lag ? null : naa))
      sjekkNytt()
      // Å lese en idé merker varslene om den lest.
      oppfriskVarsler()
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
      <Ideer
        apen={vindu?.lag === 'ideer'}
        ide={vindu?.lag === 'ideer' ? vindu.ide : undefined}
        kommentar={vindu?.lag === 'ideer' ? vindu.kommentar : undefined}
        nr={vindu?.lag === 'ideer' ? vindu.nr : undefined}
        onLukk={lukkIdeer} onOppgaver={(oppgave) => setVindu({ lag: 'oppgaver', oppgave })} />
      <Oppgaver
        apen={vindu?.lag === 'oppgaver'}
        oppgave={vindu?.lag === 'oppgaver' ? vindu.oppgave : undefined}
        onLukk={lukkOppgaver}
        onIdeer={() => setVindu({ lag: 'ideer' })}
      />
    </>
  )
}
