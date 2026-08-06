import { useCallback, useMemo, useReducer, useState } from 'react'
import { SearchStep } from './components/SearchStep'
import { ConcentrationStep } from './components/ConcentrationStep'
import { PasteStep } from './components/PasteStep'
import { ThemeToggle } from './components/ThemeToggle'
import { analytes } from './domain/analytes'
import { classify, levelComment, parseConcentration } from './domain/concentration'
import { search } from './domain/search'
import { useClipboard } from './hooks/useClipboard'
import { digitToIndex, useKeyboard } from './hooks/useKeyboard'
import { useTheme } from './hooks/useTheme'
import { initialState, isIdle, reducer, stageOf } from './state'

/** Enter skal ikke både trykke en fokusert knapp og utløse stegets handling. */
function buttonHasFocus(): boolean {
  return document.activeElement?.tagName === 'BUTTON'
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState)
  const [copyError, setCopyError] = useState<string | null>(null)
  const { theme, toggle } = useTheme()
  const copy = useClipboard()

  const stage = stageOf(state)
  const hits = useMemo(() => search(state.query, analytes), [state.query])

  const copyComment = useCallback(async () => {
    const { analyte, concentration } = state
    const value = parseConcentration(concentration)
    if (!analyte || value === null) return
    const kommentar = levelComment(analyte, classify(analyte, value)).kommentar
    if (await copy(kommentar)) {
      setCopyError(null)
      dispatch({ type: 'kopiert' })
    } else {
      setCopyError('Fikk ikke tilgang til utklippstavlen. Kopier teksten manuelt.')
    }
  }, [copy, state])

  useKeyboard({
    Escape: (e) => {
      e.preventDefault()
      setCopyError(null)
      dispatch({ type: 'tilbake' })
    },

    Enter: (e) => {
      if (buttonHasFocus()) return
      e.preventDefault()
      if (stage === 'search') {
        // Bare når det ikke er noe å velge mellom.
        if (hits.length === 1 && hits[0]) dispatch({ type: 'velg-analytt', analyte: hits[0].analyte })
      } else if (stage === 'concentration') {
        void copyComment()
      } else {
        dispatch({ type: 'nullstill' })
      }
    },

    ...Object.fromEntries(
      '0123456789'.split('').map((digit) => [
        digit,
        (e: KeyboardEvent) => {
          if (stage !== 'search' || state.query === '') return
          const index = digitToIndex(digit)
          const hit = index === null ? undefined : hits[index]
          if (!hit) return
          e.preventDefault()
          dispatch({ type: 'velg-analytt', analyte: hit.analyte })
        },
      ]),
    ),
  })

  return (
    <div className="app" data-steg={stage} data-tomt={isIdle(state) ? 'ja' : 'nei'}>
      <ThemeToggle theme={theme} onToggle={toggle} />

      <main className="scene">
        {stage === 'search' && (
          <SearchStep
            query={state.query}
            hits={hits}
            onQueryChange={(value) => dispatch({ type: 'sett-sok', value })}
            onSelect={(analyte) => dispatch({ type: 'velg-analytt', analyte })}
            onReset={() => dispatch({ type: 'nullstill' })}
          />
        )}

        {stage === 'concentration' && state.analyte && (
          <ConcentrationStep
            analyte={state.analyte}
            value={state.concentration}
            error={copyError}
            onChange={(value) => dispatch({ type: 'sett-konsentrasjon', value })}
            onBack={() => dispatch({ type: 'tilbake' })}
            onCopy={() => void copyComment()}
          />
        )}

        {stage === 'paste' && state.analyte && (
          <PasteStep
            analyte={state.analyte}
            onBack={() => dispatch({ type: 'tilbake' })}
            onFinish={() => dispatch({ type: 'nullstill' })}
          />
        )}
      </main>
    </div>
  )
}
