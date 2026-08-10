import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { SearchStep } from './components/SearchStep'
import { BandStep } from './components/BandStep'
import { PasteStep } from './components/PasteStep'
import { CopyFlash } from './components/CopyFlash'
import { Toolbar } from './components/Toolbar'
import { analytes } from './domain/analytes'
import { bands as bandsOf, findBand, type Band } from './domain/bands'
import { search } from './domain/search'
import { useClipboard } from './hooks/useClipboard'
import { useCopyFlash } from './hooks/useCopyFlash'
import { digitToIndex, useKeyboard } from './hooks/useKeyboard'
import { useTheme } from './hooks/useTheme'
import { initialState, isIdle, reducer, stageOf } from './state'

const KOPIFEIL = 'Fikk ikke tilgang til utklippstavlen. Kopier teksten manuelt.'

/**
 * Kvitteringen for kopieringen, i millisekunder.
 *
 * `BLINK` er hele blinket. `STEGBYTTE` er hvor lenge båndknappene blir stående
 * etterpå, så blinket rekker å starte ved knappen som ble brukt før limsteget
 * overtar; resten av blinket går der. Begge er korte med vilje — kvitteringen
 * skal rekke å bli sett uten å legge seg i veien for neste svar.
 *
 * `STEGBYTTE` holder bare igjen bildet. Tilstanden går videre med én gang
 * kommentaren er kopiert, slik at et tastetrykk i mellomtiden gjør det samme
 * som ellers i limsteget i stedet for å falle på gulvet.
 */
const BLINK = 500
const STEGBYTTE = 130

/** Enter og mellomrom skal ikke både trykke en fokusert knapp og utløse stegets handling. */
function buttonHasFocus(): boolean {
  return document.activeElement?.tagName === 'BUTTON'
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState)
  const [failedCopy, setFailedCopy] = useState<string | null>(null)
  const { theme, toggle } = useTheme()
  const copy = useClipboard()
  const { flash, show } = useCopyFlash(BLINK)
  /** Sant i det korte øyeblikket båndknappene blir stående etter et valg. */
  const [dveler, setDveler] = useState(false)
  const stegbytte = useRef<number>()

  const stage = stageOf(state)
  const hits = useMemo(() => search(state.query, analytes), [state.query])

  const slippBildet = useCallback(() => {
    window.clearTimeout(stegbytte.current)
    setDveler(false)
  }, [])

  const pickBand = useCallback(
    async (band: Band) => {
      if (!(await copy(band.kommentar))) {
        setFailedCopy(band.kommentar)
        return
      }
      setFailedCopy(null)
      // Knappen står her bare så lenge båndsteget vises, enten den ble klikket
      // eller valgt med et tastetrykk. Blinket legges der den står nå.
      show(document.querySelector(`[data-band="${band.key}"]`))
      dispatch({ type: 'velg-band', key: band.key })
      setDveler(true)
      window.clearTimeout(stegbytte.current)
      stegbytte.current = window.setTimeout(() => setDveler(false), STEGBYTTE)
    },
    [copy, show],
  )

  const back = useCallback(() => {
    slippBildet()
    setFailedCopy(null)
    dispatch({ type: 'tilbake' })
  }, [slippBildet])

  const reset = useCallback(() => {
    slippBildet()
    setFailedCopy(null)
    dispatch({ type: 'nullstill' })
  }, [slippBildet])

  useEffect(() => () => window.clearTimeout(stegbytte.current), [])

  // Enter og mellomrom bekrefter det samme, overalt i appen.
  const confirm = useCallback(
    (event: KeyboardEvent) => {
      if (buttonHasFocus()) return
      if (stage === 'search') {
        // Bare når det ikke er noe å velge mellom. Ellers får mellomrom
        // skrives inn i søkefeltet som vanlig.
        if (hits.length !== 1 || !hits[0]) return
        event.preventDefault()
        dispatch({ type: 'velg-analytt', analyte: hits[0].analyte })
      } else if (stage === 'paste') {
        event.preventDefault()
        reset()
      }
    },
    [stage, hits, reset],
  )

  useKeyboard({
    Escape: (e) => {
      e.preventDefault()
      back()
    },
    Enter: confirm,
    ' ': confirm,

    ...Object.fromEntries(
      '0123456789'.split('').map((digit) => [
        digit,
        (e: KeyboardEvent) => {
          const index = digitToIndex(digit)
          if (index === null) return

          if (stage === 'search' && state.query !== '') {
            const hit = hits[index]
            if (!hit) return
            e.preventDefault()
            dispatch({ type: 'velg-analytt', analyte: hit.analyte })
          } else if (stage === 'band' && state.analyte) {
            const band = bandsOf(state.analyte)[index]
            if (!band) return
            e.preventDefault()
            void pickBand(band)
          } else if (stage === 'paste') {
            // Alle sifre avslutter, slik at man kan bruke samme talltast som i
            // forrige bilde for å komme raskt videre.
            e.preventDefault()
            reset()
          }
        },
      ]),
    ),
  })

  const band = state.analyte && state.bandKey ? findBand(state.analyte, state.bandKey) : undefined

  /**
   * Steget som vises. Det henger etter `stage` i det korte øyeblikket
   * båndknappene blir stående, så kvitteringen rekker å starte der knappen sto.
   * Tastene følger `stage` og venter ikke på bildet.
   */
  const vist = dveler && stage === 'paste' ? 'band' : stage

  return (
    <div className="app" data-steg={vist} data-tomt={isIdle(state) ? 'ja' : 'nei'}>
      <Toolbar theme={theme} onToggleTheme={toggle} />

      <main className="scene">
        {vist === 'search' && (
          <SearchStep
            query={state.query}
            hits={hits}
            onQueryChange={(value) => dispatch({ type: 'sett-sok', value })}
            onSelect={(analyte) => {
              setFailedCopy(null)
              dispatch({ type: 'velg-analytt', analyte })
            }}
            onReset={reset}
          />
        )}

        {vist === 'band' && state.analyte && (
          <BandStep
            analyte={state.analyte}
            onPick={(b) => void pickBand(b)}
            onBack={back}
            failed={failedCopy ? { message: KOPIFEIL, comment: failedCopy } : null}
          />
        )}

        {vist === 'paste' && state.analyte && band && (
          <PasteStep analyte={state.analyte} band={band} onBack={back} onFinish={reset} />
        )}
      </main>

      {/* Kvitteringen ligger utenfor stegene, så den overlever stegbyttet. */}
      {flash && <CopyFlash key={flash.id} flash={flash} varighet={BLINK} />}
      {/* Blinket er visuelt; dette er den samme beskjeden for skjermlesere. */}
      <p className="kun-skjermleser" role="status">
        {flash ? 'Kommentaren er kopiert' : ''}
      </p>
    </div>
  )
}
