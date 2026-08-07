import { useEffect, useRef } from 'react'
import { Button } from './Button'
import { StepBar } from './StepBar'
import { ResetIcon, SearchIcon } from './icons'
import { indexToDigit } from '../hooks/useKeyboard'
import { splitName } from '../domain/names'
import { optionColourVars } from '../domain/optionColours'
import type { SearchHit } from '../domain/search'
import type { Analyte } from '../types'

export interface SearchStepProps {
  query: string
  hits: SearchHit[]
  onQueryChange: (value: string) => void
  onSelect: (analyte: Analyte) => void
  onReset: () => void
}

/** Et vanlig tegn brukeren mente å skrive inn i søkefeltet. */
function isTypedCharacter(event: KeyboardEvent): boolean {
  return event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey
}

/**
 * Steg 1: instruksjon, søkefelt og alternativene som passer søket.
 *
 * Søkefeltet står alltid montert og har fokus, slik at det å begynne å skrive
 * er nok til å komme i gang. Instruksjonen viker for feltet ved første tegn.
 */
export function SearchStep({ query, hits, onQueryChange, onSelect, onReset }: SearchStepProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const tomt = query === ''

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Et klikk utenfor feltet tar fokus med seg, og da ville skriving forsvunnet
  // i ingenting. Første tegn henter fokus tilbake før tegnet settes inn.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const felt = inputRef.current
      if (!felt || document.activeElement === felt) return
      if (document.activeElement?.tagName === 'BUTTON') return
      if (!isTypedCharacter(event)) return
      felt.focus()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [])

  return (
    <section className="steg steg--sok" aria-label="Velg analytt">
      <StepBar>
        {!tomt && (
          <Button variant="subtle" icon={<ResetIcon />} shortcut="Esc" onClick={onReset}>
            Nullstill
          </Button>
        )}
      </StepBar>

      <div className="sok">
        <p className={`instruks${tomt ? '' : ' instruks--skjult'}`} aria-hidden={!tomt}>
          <SearchIcon className="instruks__ikon" />
          Begynn å skrive navnet på en analytt eller kode.
        </p>

        <div className={`sokefelt${tomt ? ' sokefelt--skjult' : ''}`}>
          <input
            ref={inputRef}
            className="sokefelt__input"
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            aria-label="Søk etter analytt eller kode"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>

        <Options hits={hits} onSelect={onSelect} query={query} />
      </div>
    </section>
  )
}

function Options({
  hits,
  onSelect,
  query,
}: {
  hits: SearchHit[]
  onSelect: (analyte: Analyte) => void
  query: string
}) {
  if (query === '') return null

  if (hits.length === 0) {
    return (
      <p className="ingen-treff" role="status">
        Ingen analytter passer søket.
      </p>
    )
  }

  return (
    <ul className="alternativer" aria-label={`${hits.length} treff`}>
      {hits.map((hit, i) => (
        <li key={hit.analyte.kode}>
          <button
            type="button"
            className="alternativ"
            style={optionColourVars(i, hits.length)}
            onClick={() => onSelect(hit.analyte)}
            aria-keyshortcuts={indexToDigit(i)}
          >
            {/* Står alltid: tallet endrer seg fra søk til søk og er ikke noe
                man kan lære seg, så det følger ikke hurtigtastinnstillingen. */}
            <span className="alternativ__tall" aria-hidden="true">
              {indexToDigit(i)}
            </span>
            <Name analyte={hit.analyte} />
          </button>
        </li>
      ))}
    </ul>
  )
}

/**
 * Navnet på ett alternativ.
 *
 * Moderstoffet står størst og sterkest: det er det brukeren kjenner igjen, og
 * det som skiller alternativene fra hverandre raskest. Koden og eventuelle
 * metabolitter er mindre kjent og står derfor dempet — koden i en pille over
 * navnet, i alternativets egen farge, metabolittene på hver sin linje under.
 */
function Name({ analyte }: { analyte: Analyte }) {
  const { moderstoff, metabolitter } = splitName(analyte)

  return (
    <span className="alternativ__tekst">
      <span className="alternativ__kode">{analyte.kode}</span>
      <span className="alternativ__navn">{moderstoff}</span>
      {metabolitter.length > 0 && (
        <span className="alternativ__metabolitter">
          {metabolitter.map((m) => (
            <span className="alternativ__metabolitt" key={m}>
              + {m}
            </span>
          ))}
        </span>
      )}
    </span>
  )
}
