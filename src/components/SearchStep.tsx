import { useEffect, useRef } from 'react'
import { StepBar } from './StepBar'
import { Ikon } from './ikon/Ikon'
import { indexToDigit, lagLiggerOver, tastenGjelderFortolkningen } from '../hooks/useKeyboard'
import { Filterbytte } from './Filterbytte'
import { Shortcut } from './Shortcut'
import { splitName } from '../domain/names'
import { optionColourVars } from '../domain/optionColours'
import type { SearchHit } from '../domain/search'
import type { Analyte } from '../types'

export interface SearchStepProps {
  query: string
  hits: SearchHit[]
  /** Analysemetoden søket er begrenset til, valgt i filteret under alternativene. */
  metodefilter: string | null
  /** Endrer filteret; `null` slår det av, så alle analyttene finnes igjen. */
  onFilter: (metode: string | null) => void
  onQueryChange: (value: string) => void
  onSelect: (analyte: Analyte) => void
  onReset: () => void
}

/** Et vanlig tegn brukeren mente å skrive inn i søkefeltet. */
function isTypedCharacter(event: KeyboardEvent): boolean {
  return event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey
}

/**
 * Sant når tegnet hører til knappen som står fokusert i stedet for til søket.
 *
 * Mellomrom trykker en fokusert knapp, og skal aldri havne i feltet i stedet.
 * Bokstaver hører til søket — men ikke når fokus står på en knapp i selve
 * steget, som et søkealternativ: der er tastaturet midt i et valg. Knappene
 * rundt steget — menyknappen, verktøylinja, versjonspilla — skal derimot ikke
 * holde på skrivingen, ellers ville det å lukke menyen krevd et museklikk før
 * man kunne søke videre.
 */
function knappTarTegnet(event: KeyboardEvent): boolean {
  const aktiv = document.activeElement
  if (!(aktiv instanceof HTMLElement) || aktiv.tagName !== 'BUTTON') return false
  return event.key === ' ' || aktiv.closest('.steg') !== null
}

/**
 * Steg 1: instruksjon, søkefelt og alternativene som passer søket.
 *
 * Søkefeltet står alltid montert og har fokus, slik at det å begynne å skrive
 * er nok til å komme i gang. Instruksjonen viker for feltet ved første tegn.
 */
export function SearchStep({
  query,
  hits,
  metodefilter,
  onQueryChange,
  onSelect,
  onReset,
  onFilter,
}: SearchStepProps) {
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
      // Ligger endringsloggen eller sidemenyen over appen, eller skrives det i
      // et felt et annet sted på siden, hører det som skrives hjemme der og
      // skal ikke rykke fokus ned i søkefeltet bak.
      if (lagLiggerOver() || !tastenGjelderFortolkningen(event)) return
      if (!isTypedCharacter(event)) return
      if (knappTarTegnet(event)) return
      felt.focus()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [])

  return (
    <section className="steg steg--sok" aria-label="Velg analytt">
      <StepBar ikon="reset" onEsc={tomt ? undefined : onReset}>
        Nullstill
      </StepBar>

      <div className="sok">
        <p className={`instruks${tomt ? '' : ' instruks--skjult'}`} aria-hidden={!tomt}>
          <span className="instruks__sirkel" data-ih="">
            <Ikon navn="search" className="instruks__ikon" />
          </span>
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

        {/* Filteret er lett å glemme, og et glemt filter ser ut som at en
            analytt ikke finnes. Derfor står alle metodene framme under
            alternativene, med det aktive valget fylt i sin farge. */}
        <Filterbytte metodefilter={metodefilter} onFilter={onFilter} />
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
        Ingen stoffer passer med søket.
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
            <Shortcut always className="alternativ__tall" aria-hidden="true">
              {indexToDigit(i)}
            </Shortcut>
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
