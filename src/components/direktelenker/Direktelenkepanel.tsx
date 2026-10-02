import { useEffect, useId, useState } from 'react'
import { hentLenkemaal } from '../../direktelenker/api'
import { malFraLenke } from '../../direktelenker/mal'
import { lenkedeler, lenkeetikett, type Lenkemaal } from '../../direktelenker/modell'
import { Button } from '../Button'
import { useDirektelenkekilde } from './Direktelenkekilde'
import { Lenkeforhandsvisning } from './Lenkebrikke'

/** Hvor lenge det skal være stille i feltet før lenken slås opp. */
export const SJEKK_ETTER = 250

type Sjekk =
  | { status: 'tom' }
  | { status: 'ugyldig' }
  | { status: 'sjekker' }
  | { status: 'borte' }
  | { status: 'feil' }
  | { status: 'klar'; maal: Lenkemaal }

const MELDINGER: Partial<Record<Sjekk['status'], string>> = {
  ugyldig: 'Dette er ikke en lenke til en diskusjon, en idé eller en kommentar. Bruk «Kopier lenke» der, og lim den inn her.',
  borte: 'Lenken peker på noe som ikke finnes lenger.',
  feil: 'Fikk ikke sjekket lenken. Prøv igjen.',
}

/**
 * Panelet under verktøyraden der en direktelenke settes inn som en brikke.
 * Lenken limes inn, og settes bare inn når den peker på en diskusjon, en idé
 * eller en kommentar som finnes: først må den ha formen til en direktelenke i
 * appen, så slås den opp i databasen. Det den peker på, vises før den settes
 * inn.
 */
export function Direktelenkepanel({ onSett, onLukk }: { onSett: (maal: Lenkemaal, etikett: string) => void; onLukk: () => void }) {
  const id = useId()
  const meldingId = useId()
  const [lenke, setLenke] = useState('')
  const [sjekk, setSjekk] = useState<Sjekk>({ status: 'tom' })
  const { sidenavn } = useDirektelenkekilde()

  useEffect(() => {
    if (!lenke.trim()) return setSjekk({ status: 'tom' })
    const mal = malFraLenke(lenke)
    if (!mal) return setSjekk({ status: 'ugyldig' })
    setSjekk({ status: 'sjekker' })
    let aktiv = true
    const frist = window.setTimeout(() => {
      hentLenkemaal(mal, { fersk: true }).then(
        (maal) => aktiv && setSjekk(maal ? { status: 'klar', maal } : { status: 'borte' }),
        () => aktiv && setSjekk({ status: 'feil' }),
      )
    }, SJEKK_ETTER)
    return () => {
      aktiv = false
      window.clearTimeout(frist)
    }
  }, [lenke])

  const deler = sjekk.status === 'klar' ? lenkedeler(sjekk.maal, sjekk.maal.slag === 'diskusjon' ? sidenavn(sjekk.maal.side) : '') : null
  const sett = () => {
    if (sjekk.status === 'klar' && deler) onSett(sjekk.maal, lenkeetikett(deler))
  }
  const melding = MELDINGER[sjekk.status]

  return (
    <div className="verktoypanel direktelenkepanel" role="group" aria-label="Direktelenke">
      <label className="felt" htmlFor={id}>
        <span className="felt__merkelapp">Lenke til en diskusjon, en idé eller en kommentar</span>
        <input
          id={id}
          className="felt__inndata"
          type="url"
          value={lenke}
          autoFocus
          placeholder="Lim inn lenken"
          aria-invalid={melding ? true : undefined}
          aria-describedby={melding ? meldingId : undefined}
          onChange={(e) => setLenke(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              sett()
            }
          }}
        />
      </label>
      {melding && (
        <p id={meldingId} className="skjemafeil" role="alert">
          {melding}
        </p>
      )}
      {(sjekk.status === 'sjekker' || sjekk.status === 'klar') && (
        <div className="direktelenkepanel__visning" aria-live="polite">
          {sjekk.status === 'klar' ? (
            <Lenkeforhandsvisning mal={sjekk.maal.mal} tilstand={sjekk} deler={deler} />
          ) : (
            <span className="lenkevisning lenkevisning--tom">Sjekker lenken …</span>
          )}
        </div>
      )}
      <div className="skjema__knapper">
        <Button variant="subtle" onClick={onLukk}>
          Avbryt
        </Button>
        <Button className="knapp--kompakt" disabled={sjekk.status !== 'klar'} onClick={sett}>
          Sett inn i teksten
        </Button>
      </div>
    </div>
  )
}
