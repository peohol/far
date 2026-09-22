import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { SearchStep } from './components/SearchStep'
import { BandStep } from './components/BandStep'
import { EtgPasteStep } from './components/EtgPasteStep'
import { EtgStep } from './components/EtgStep'
import { KontrollStep } from './components/KontrollStep'
import { PasteStep } from './components/PasteStep'
import { RusStep } from './components/RusStep'
import { Sidemeny } from './components/Sidemeny'
import { ThcStep } from './components/ThcStep'
import { CopyFlash } from './components/CopyFlash'
import { ruteAv } from './components/Kopibevis'
import { Toolbar } from './components/Toolbar'
import { Kontoknapper } from './components/konto/Kontoknapper'
import { Versjonspille } from './components/Versjonspille'
import { ANALYSEMETODER, filtrertPool } from './domain/analysemetoder'
import { analytes } from './domain/analytes'
import { alternativFor, ETG_ALTERNATIVER, ETG_ANALYTT, type EtgAlternativ } from './domain/etg'
import type { Rute } from './domain/flytting'
import { RUS_ANALYTTER, rusModulFor } from './domain/rus'
import { search } from './domain/search'
import { THC_ANALYTT } from './domain/thc'
import {
  CUTOFF_NOKKEL,
  CUTOFF_SPORSMAL,
  cutoffvalg,
  finnValg,
  valgene,
  type Kommentarvalg,
} from './domain/valg'
import { useClipboard } from './hooks/useClipboard'
import { useCopyFlash } from './hooks/useCopyFlash'
import {
  digitToIndex,
  erBekreftelse,
  modaltLagLiggerOver,
  useKeyboard,
} from './hooks/useKeyboard'
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
  /**
   * Steget bildet henger igjen i mens kvitteringen starter der knappen sto —
   * det steget kopieringen gikk ut fra. `null` når ingenting dveler. Se
   * `STEGBYTTE` og `vist`.
   */
  const [dveler, setDveler] = useState<Stage | null>(null)
  const stegbytte = useRef<number>()
  /** Ruten båndknappen sto i — beviset i limsteget flyter opp fra den. */
  const [bevisFra, setBevisFra] = useState<Rute | null>(null)

  const stage = stageOf(state)
  // Kopieringen svarer først etter en tur innom nettleseren, og skal legge
  // kvitteringen i det steget den gikk ut fra. Refen holder det steget uten å
  // binde `kopierOgGaaVidere` til en ny utgave for hver rendring.
  const staaende = useRef(stage)
  staaende.current = stage
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
    setDveler(null)
  }, [])

  /**
   * Kopierer kommentaren knappen bærer og går videre til limsteget.
   *
   * Knappen står i bildet bare så lenge steget foran vises, enten den ble
   * klikket eller valgt med et tastetrykk. Blinket legges der den står nå, og
   * ruten følger med til limsteget, der beviset flyter opp fra den. Veien er
   * den samme for konsentrasjonsbåndene, for cut-off-valget og for EtG og
   * EtS.
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
      setDveler(staaende.current)
      window.clearTimeout(stegbytte.current)
      stegbytte.current = window.setTimeout(() => setDveler(null), STEGBYTTE)
    },
    [copy, show],
  )

  const kopierValg = useCallback(
    (valg: Kommentarvalg) =>
      kopierOgGaaVidere(valg.kommentar, `[data-band="${valg.key}"]`, {
        type: 'velg-band',
        key: valg.key,
      }),
    [kopierOgGaaVidere],
  )

  /**
   * Et valg i steg 2. De fleste kopierer kommentaren med én gang; cut-off-valget
   * går innom kontrollspørsmålet først, siden funnet må være bekreftet av
   * laboratoriet før kommentaren gjelder.
   */
  const velgValg = useCallback(
    (valg: Kommentarvalg) => {
      if (valg.key === CUTOFF_NOKKEL) {
        dispatch({ type: 'spor', kontroll: 'cutoff' })
        return
      }
      void kopierValg(valg)
    },
    [kopierValg],
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

  const velgAnalytt = useCallback(
    (analyte: Analyte) => {
      slippBildet()
      setFailedCopy(null)
      dispatch({ type: 'velg-analytt', analyte })
    },
    [slippBildet],
  )

  const settMetodefilter = useCallback((metode: string | null) => {
    dispatch({ type: 'sett-metodefilter', metode })
  }, [])

  const reset = useCallback(() => {
    slippBildet()
    setFailedCopy(null)
    dispatch({ type: 'nullstill' })
  }, [slippBildet])

  useEffect(() => () => window.clearTimeout(stegbytte.current), [])

  /**
   * Valget kontrollsteget spør om. Det leses av analytten og ikke av
   * spørsmålet som står, så bildet kan bli stående det korte øyeblikket etter
   * at spørsmålet er besvart — se `dveler`.
   */
  const kontrollvalg = useMemo(
    () => (state.analyte ? cutoffvalg(state.analyte) : null),
    [state.analyte],
  )

  /** Ja: kommentaren kopieres, og flyten går videre som ellers. */
  const bekreftKontroll = useCallback(() => {
    if (!state.kontroll || !kontrollvalg) return
    void kopierValg(kontrollvalg)
  }, [state.kontroll, kontrollvalg, kopierValg])

  /**
   * Alt + 1 … Alt + 5 setter filteret på hver sin analysemetode, i den
   * rekkefølgen menyen viser dem. Alt + 0 slår det av: null hører ikke til
   * noen metode, og står derfor for «ingen av dem».
   *
   * Snarveien ligger utenom `useKeyboard`, som med vilje slipper alle
   * modifikatorkombinasjoner gjennom til nettleseren. Den leser `event.code`
   * og ikke `event.key`, siden Alt gjør om tegnet på flere tastaturoppsett —
   * det er den fysiske talltasten som gjelder.
   *
   * Filteret kan settes mens sidemenyen eller filtermenyen står åpen; de viser
   * nettopp metodene. Endringsloggen fanger derimot tastaturet for seg.
   */
  useEffect(() => {
    function paaTast(event: KeyboardEvent) {
      if (!event.altKey || event.ctrlKey || event.metaKey) return
      const truffet = /^Digit(\d)$/.exec(event.code)
      if (!truffet?.[1]) return
      const tall = Number(truffet[1])
      if (tall > ANALYSEMETODER.length || modaltLagLiggerOver()) return
      event.preventDefault()
      dispatch({
        type: 'sett-metodefilter',
        metode: tall === 0 ? null : (ANALYSEMETODER[tall - 1]?.kode ?? null),
      })
    }
    window.addEventListener('keydown', paaTast)
    return () => window.removeEventListener('keydown', paaTast)
  }, [])

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
            const valg = valgene(state.analyte)[index]
            if (!valg) return
            e.preventDefault()
            velgValg(valg)
          } else if (stage === 'kontroll') {
            // 1 er ja, 2 er nei — i den rekkefølgen knappene står.
            const svar = [bekreftKontroll, back][index]
            if (!svar) return
            e.preventDefault()
            svar()
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

  const valgtValg =
    state.analyte && state.bandKey ? finnValg(state.analyte, state.bandKey) : undefined
  const rusModul = state.analyte ? rusModulFor(state.analyte) : undefined
  const etgAlternativ = state.etgValg ? alternativFor(state.etgValg) : undefined

  /**
   * Steget som vises. Det henger etter `stage` i det korte øyeblikket knappene
   * i steget foran blir stående, så kvitteringen rekker å starte der knappen
   * sto. Tastene følger `stage` og venter ikke på bildet.
   */
  const vist = dveler ?? stage

  return (
    <div className="app" data-steg={vist} data-tomt={isIdle(state) ? 'ja' : 'nei'}>
      <Sidemeny
        pool={alleAnalytter}
        metodefilter={state.metodefilter}
        onFilter={settMetodefilter}
        onVelgAnalytt={velgAnalytt}
      />
      <Toolbar theme={theme} onToggleTheme={toggle} foran={<Kontoknapper />} />

      <main className="scene">
        {vist === 'search' && (
          <SearchStep
            query={state.query}
            hits={hits}
            metodefilter={state.metodefilter}
            onFilter={settMetodefilter}
            onQueryChange={setQuery}
            onSelect={velgAnalytt}
            onReset={reset}
          />
        )}

        {vist === 'band' && state.analyte && (
          <BandStep
            analyte={state.analyte}
            onPick={velgValg}
            onBack={back}
            failed={failedCopy ? { message: KOPIFEIL, comment: failedCopy } : null}
          />
        )}

        {vist === 'kontroll' && kontrollvalg && (
          <KontrollStep
            valg={kontrollvalg}
            sporsmal={CUTOFF_SPORSMAL}
            onJa={bekreftKontroll}
            onNei={back}
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

        {vist === 'paste' && state.analyte && valgtValg && (
          <PasteStep
            analyte={state.analyte}
            valg={valgtValg}
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
