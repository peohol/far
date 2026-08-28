import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { SearchStep } from './components/SearchStep'
import { BandStep } from './components/BandStep'
import { EtgPasteStep } from './components/EtgPasteStep'
import { EtgStep } from './components/EtgStep'
import { PasteStep } from './components/PasteStep'
import { RusStep } from './components/RusStep'
import { Sidemeny } from './components/Sidemeny'
import { ThcStep } from './components/ThcStep'
import { CopyFlash } from './components/CopyFlash'
import { ruteAv } from './components/Kopibevis'
import { Toolbar } from './components/Toolbar'
import { Versjonspille } from './components/Versjonspille'
import { filtrertPool } from './domain/analysemetoder'
import { analytes } from './domain/analytes'
import { bands as bandsOf, findBand, type Band } from './domain/bands'
import { alternativFor, ETG_ALTERNATIVER, ETG_ANALYTT, type EtgAlternativ } from './domain/etg'
import type { Rute } from './domain/flytting'
import { RUS_ANALYTTER, rusModulFor } from './domain/rus'
import { search } from './domain/search'
import { THC_ANALYTT } from './domain/thc'
import { useClipboard } from './hooks/useClipboard'
import { useCopyFlash } from './hooks/useCopyFlash'
import { digitToIndex, erBekreftelse, useKeyboard } from './hooks/useKeyboard'
import { useTheme } from './hooks/useTheme'
import { initialState, isIdle, reducer, stageOf, type Action, type Stage } from './state'
import type { Analyte } from './types'

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

/**
 * Steget bildet henger igjen i mens kvitteringen starter der knappen sto. Se
 * `STEGBYTTE` og `vist`.
 */
const DVELER_I: Partial<Record<Stage, Stage>> = { paste: 'band', 'etg-paste': 'etg' }

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
  /** Ruten båndknappen sto i — beviset i limsteget flyter opp fra den. */
  const [bevisFra, setBevisFra] = useState<Rute | null>(null)

  const stage = stageOf(state)
  // Søket dekker analyttene fra datasettet pluss kategoriene som har egne
  // fortolkningsmoduler i stedet for konsentrasjonsbånd: THC-syre i urin,
  // stoffene med ruspotensial i serum og etanolmarkørene EtG og EtS i urin.
  const alleAnalytter = useMemo(
    () => [...analytes, THC_ANALYTT, ...RUS_ANALYTTER, ETG_ANALYTT],
    [],
  )
  // Filteret fra sidemenyen smalner inn hva søket kan finne. Menyen selv viser
  // alltid alt, siden det er der filteret velges.
  const pool = useMemo(
    () => filtrertPool(alleAnalytter, state.metodefilter),
    [alleAnalytter, state.metodefilter],
  )
  const hits = useMemo(() => search(state.query, pool), [state.query, pool])

  // Tilstandsmaskinen trenger alternativene det nye søket gir for å se om det
  // smalner inn til én analytt, så søket kjøres her og ikke først når steget
  // tegnes opp. Datasettet er lite nok til at det ikke merkes.
  const setQuery = useCallback(
    (value: string) => {
      const matches = search(value, pool).map((hit) => hit.analyte)
      dispatch({ type: 'sett-sok', value, matches })
    },
    [pool],
  )

  const slippBildet = useCallback(() => {
    window.clearTimeout(stegbytte.current)
    setDveler(false)
  }, [])

  /**
   * Kopierer kommentaren knappen bærer og går videre til limsteget.
   *
   * Knappen står i bildet bare så lenge steget foran vises, enten den ble
   * klikket eller valgt med et tastetrykk. Blinket legges der den står nå, og
   * ruten følger med til limsteget, der beviset flyter opp fra den. Veien er
   * den samme for konsentrasjonsbåndene og for EtG og EtS.
   */
  const kopierOgGaaVidere = useCallback(
    async (tekst: string, velger: string, videre: Action) => {
      if (!(await copy(tekst))) {
        setFailedCopy(tekst)
        return
      }
      setFailedCopy(null)
      const knapp = document.querySelector(velger)
      show(knapp)
      setBevisFra(ruteAv(knapp))
      dispatch(videre)
      setDveler(true)
      window.clearTimeout(stegbytte.current)
      stegbytte.current = window.setTimeout(() => setDveler(false), STEGBYTTE)
    },
    [copy, show],
  )

  const pickBand = useCallback(
    (band: Band) =>
      kopierOgGaaVidere(band.kommentar, `[data-band="${band.key}"]`, {
        type: 'velg-band',
        key: band.key,
      }),
    [kopierOgGaaVidere],
  )

  /** Hovedkommentaren for tilfellet kopieres straks; resten hører til limsteget. */
  const pickEtg = useCallback(
    (alternativ: EtgAlternativ) => {
      const forste = alternativ.plasseringer[0]
      if (!forste) return
      return kopierOgGaaVidere(forste.tekst, `[data-etg="${alternativ.id}"]`, {
        type: 'velg-etg',
        valg: alternativ.id,
      })
    },
    [kopierOgGaaVidere],
  )

  const back = useCallback(() => {
    slippBildet()
    setFailedCopy(null)
    dispatch({ type: 'tilbake' })
  }, [slippBildet])

  const velgAnalytt = useCallback((analyte: Analyte) => {
    setFailedCopy(null)
    dispatch({ type: 'velg-analytt', analyte })
  }, [])

  const settMetodefilter = useCallback((metode: string | null) => {
    dispatch({ type: 'sett-metodefilter', metode })
  }, [])

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
        // skrives inn i søkefeltet som vanlig. Det ene alternativet velger som
        // regel seg selv i det søket smalner inn til det; her står det igjen
        // fordi brukeren nettopp kom tilbake fra den analytten.
        if (hits.length !== 1 || !hits[0]) return
        event.preventDefault()
        dispatch({ type: 'velg-analytt', analyte: hits[0].analyte })
      } else if (stage === 'paste') {
        // Mellomrom skal ikke avslutte fra et sted der tasten alt har en jobb
        // — som feltet for manuell kopiering, der teksten skal kunne markeres
        // og kopieres i fred.
        if (!erBekreftelse(event)) return
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
          } else if (stage === 'etg') {
            const alternativ = ETG_ALTERNATIVER[index]
            if (!alternativ) return
            e.preventDefault()
            void pickEtg(alternativ)
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
  const rusModul = state.analyte ? rusModulFor(state.analyte) : undefined
  const etgAlternativ = state.etgValg ? alternativFor(state.etgValg) : undefined

  /**
   * Steget som vises. Det henger etter `stage` i det korte øyeblikket knappene
   * i steget foran blir stående, så kvitteringen rekker å starte der knappen
   * sto. Tastene følger `stage` og venter ikke på bildet.
   */
  const vist = (dveler && DVELER_I[stage]) || stage

  return (
    <div className="app" data-steg={vist} data-tomt={isIdle(state) ? 'ja' : 'nei'}>
      <Sidemeny
        pool={alleAnalytter}
        metodefilter={state.metodefilter}
        onFilter={settMetodefilter}
        onVelgAnalytt={velgAnalytt}
      />
      <Toolbar theme={theme} onToggleTheme={toggle} />

      <main className="scene">
        {vist === 'search' && (
          <SearchStep
            query={state.query}
            hits={hits}
            metodefilter={state.metodefilter}
            onQueryChange={setQuery}
            onSelect={velgAnalytt}
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

        {vist === 'thc' && <ThcStep onBack={back} copy={copy} flashAt={show} />}

        {vist === 'rus' && rusModul && (
          <RusStep
            // Modulen holder sine egne valg. Bytter analytten, skal de nulles,
            // og nøkkelen gir modulen en frisk tilstand i stedet for å måtte
            // rydde i den fra utsiden.
            key={rusModul.id}
            modul={rusModul}
            onBack={back}
            onFinish={reset}
            copy={copy}
            flashAt={show}
          />
        )}

        {vist === 'etg' && (
          <EtgStep
            onPick={(alternativ) => void pickEtg(alternativ)}
            onBack={back}
            failed={failedCopy ? { message: KOPIFEIL, comment: failedCopy } : null}
          />
        )}

        {vist === 'etg-paste' && etgAlternativ && (
          <EtgPasteStep
            alternativ={etgAlternativ}
            fra={bevisFra}
            onBack={back}
            onFinish={reset}
            copy={copy}
            flashAt={show}
          />
        )}

        {vist === 'paste' && state.analyte && band && (
          <PasteStep
            analyte={state.analyte}
            band={band}
            fra={bevisFra}
            onBack={back}
            onFinish={reset}
          />
        )}
      </main>

      {/* Versjonen og veien inn til endringsloggen, fast i hjørnet som verktøylinja. */}
      <Versjonspille />

      {/* Kvitteringen ligger utenfor stegene, så den overlever stegbyttet. */}
      {flash && <CopyFlash key={flash.id} flash={flash} varighet={BLINK} />}
      {/* Blinket er visuelt; dette er den samme beskjeden for skjermlesere. */}
      <p className="kun-skjermleser" role="status">
        {flash ? 'Kommentaren er kopiert' : ''}
      </p>
    </div>
  )
}
