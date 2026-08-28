import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Metodepille } from './Metodepille'
import { useTips } from './Tips'
import { ANALYSEMETODER } from '../domain/analysemetoder'

/**
 * Pillen som viser hvilken analysemetode søket er begrenset til, og som åpner
 * en liten meny for å bytte eller slå filteret av.
 *
 * Filteret settes i sidemenyen, men å endre det derfra krever at hele menyen
 * åpnes. Her ligger de samme valgene der filteret allerede vises: metodene som
 * piller under hverandre, og «Skru av filter» nederst.
 *
 * Menyen er et lag over appen, som sidemenyen og endringsloggen: `data-lag`
 * sier fra til `lagLiggerOver()`, så talltastene i søket ikke velger et
 * alternativ bak menyen mens den står åpen.
 */

/** Luft mellom menyen og vinduskanten før den heller åpner andre veien. */
const KANTLUFT = 12

export interface FilterbytteProps {
  /** Metoden filteret står på. Linja vises bare når det er satt. */
  metodefilter: string
  /** `null` slår filteret av. */
  onFilter: (metode: string | null) => void
}

export function Filterbytte({ metodefilter, onFilter }: FilterbytteProps) {
  const [apen, setApen] = useState(false)
  /** Ned når det er plass under pillen, ellers opp. */
  const [retning, setRetning] = useState<'ned' | 'opp'>('ned')
  const knapp = useRef<HTMLButtonElement | null>(null)
  const meny = useRef<HTMLDivElement>(null)

  const tips = useTips('Trykk for å endre filter', { skjermleser: false })
  // Tipset og fokuset skal på det samme elementet, så de to ref-ene slås sammen.
  const { ref: tipsRef, ...knappeprops } = tips.props
  const settKnapp = useCallback(
    (element: HTMLButtonElement | null) => {
      knapp.current = element
      tipsRef(element)
    },
    [tipsRef],
  )

  const lukk = useCallback(() => {
    setApen(false)
    knapp.current?.focus()
  }, [])

  const apne = useCallback(() => setApen(true), [])

  const velg = useCallback(
    (metode: string | null) => {
      setApen(false)
      onFilter(metode)
      // Slås filteret av, forsvinner både menyen og knappen den hang på, og
      // det er ingenting å gi fokus tilbake til.
      if (metode !== null) knapp.current?.focus()
    },
    [onFilter],
  )

  /**
   * Retningen måles på den ferdig oppsatte menyen og ikke på et anslag, så
   * den alltid stemmer med hvor høy den faktisk ble. Målingen skjer før
   * maling, så menyen ikke rekker å vises i feil retning først.
   *
   * Fokus følger med inn i menyen, på metoden som står valgt.
   */
  useLayoutEffect(() => {
    if (!apen) return
    const boks = meny.current
    const rute = knapp.current?.getBoundingClientRect()
    if (boks && rute) {
      const under = window.innerHeight - rute.bottom - KANTLUFT
      setRetning(boks.offsetHeight > under ? 'opp' : 'ned')
    }
    boks?.querySelector<HTMLElement>('[aria-current="true"]')?.focus()
  }, [apen])

  // Escape lukker menyen. Appens egen Esc ligger stille så lenge laget står
  // over den, så de to kan ikke utløses av det samme tastetrykket.
  useEffect(() => {
    if (!apen) return
    function paaTast(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      event.preventDefault()
      lukk()
    }
    window.addEventListener('keydown', paaTast)
    return () => window.removeEventListener('keydown', paaTast)
  }, [apen, lukk])

  return (
    <span className="filterbytte" data-retning={retning}>
      <button
        ref={settKnapp}
        type="button"
        className="filterbytte__knapp"
        aria-label={`Søket er begrenset til ${metodefilter}. Trykk for å endre filter.`}
        aria-expanded={apen}
        aria-haspopup="true"
        onClick={() => (apen ? lukk() : apne())}
        {...knappeprops}
      >
        <Metodepille metode={metodefilter} />
      </button>
      {tips.forklaring}

      {apen && (
        <>
          {/* Et trykk hvor som helst ellers lukker menyen. */}
          <div
            className="filterbytte__lag"
            data-lag="filterbytte"
            aria-hidden="true"
            onClick={lukk}
          />

          <div ref={meny} className="filterbytte__meny" role="group" aria-label="Endre filter">
            {ANALYSEMETODER.map((metode) => (
              <button
                key={metode.kode}
                type="button"
                className="filterbytte__valg"
                aria-current={metode.kode === metodefilter}
                aria-label={`Begrens søket til ${metode.kode} – ${metode.beskrivelse}`}
                onClick={() => velg(metode.kode)}
              >
                <Metodepille metode={metode.kode} />
              </button>
            ))}

            <button type="button" className="filterbytte__av" onClick={() => velg(null)}>
              Skru av filter
            </button>
          </div>
        </>
      )}
    </span>
  )
}
