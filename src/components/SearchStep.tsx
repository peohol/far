import { useEffect, useRef } from 'react'
import { Button } from './Button'
import { StepBar } from './StepBar'
import { Shortcut } from './Shortcut'
import { ResetIcon, SearchIcon } from './icons'
import { indexToDigit } from '../hooks/useKeyboard'
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

/**
 * Steg 1–2: instruksjon, søkefelt og alternativene som passer søket.
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
    <>
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
              <span className="alternativ__tall" aria-hidden="true">
                {indexToDigit(i)}
              </span>
              <span className="alternativ__tekst">
                <span className="alternativ__kode">{hit.analyte.kode}</span>
                <span className="alternativ__navn">{hit.analyte.navn}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="hint" role="status">
        {hits.length === 1 ? (
          <>
            Trykk <Shortcut>Enter</Shortcut> eller <Shortcut>1</Shortcut> for å velge
          </>
        ) : (
          <>
            Trykk tallet foran alternativet for å velge
          </>
        )}
      </p>
    </>
  )
}
