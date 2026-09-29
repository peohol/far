import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { ENDRINGSLOGG } from '../data/endringslogg'
import { formaterDato, type Endring, type Endringstype } from '../domain/versjon'
import { rullefart } from '../hooks/useKortHopp'
import { Ikon } from './ikon/Ikon'
import { Modallag } from './Modallag'

/**
 * Endringsloggen, som et modalt lag over appen (se `Modallag`).
 *
 * Merk at appens egne taster fortsatt hører etter på vinduet mens laget står
 * åpent. Vakten mot det ligger i `lagLiggerOver()` i `hooks/useKeyboard.ts`.
 */

/** Tone på typemerket. Holdes utenfor de kliniske nivåfargene. */
const TONE: Record<Endringstype, string> = {
  'Design / layout': 'design',
  Funksjonalitet: 'funksjon',
  Fag: 'fag',
}

/**
 * Hvor lenge det ventes før en nyåpnet skuff hentes fram i bildet. Litt mer
 * enn `--fart-glid`, så høyden er ferdig glidd ut når det måles.
 */
const ETTER_GLIDNING = 300

/**
 * Uten dette ville fokus landet på lukkeknappen, som er det første
 * nettleseren finner — og da ville `Enter` lukket loggen i samme øyeblikk
 * som den ble åpnet. Den nyeste føringen er det man kom for, så fokus legges
 * der: `Enter` folder den ut i stedet.
 */
const FORSTE_FORING = '.loggskuff__tittel'

export function Endringslogg({
  apen,
  versjon = null,
  onLukk,
}: {
  apen: boolean
  /** Føringen som foldes ut og hentes fram når loggen åpnes, som fra en utført oppgave. */
  versjon?: string | null
  onLukk: () => void
}) {
  /** Versjonen til skuffen som står åpen — bare én av gangen. */
  const [apenSkuff, setApenSkuff] = useState<string | null>(null)

  // Lukket lag: neste åpning skal begynne på toppen, med alle skuffer igjen.
  // Åpnet på en føring: den står utfoldet og fram i bildet.
  useEffect(() => {
    setApenSkuff(apen ? versjon : null)
  }, [apen, versjon])

  const veksle = useCallback((versjon: string) => {
    setApenSkuff((forrige) => (forrige === versjon ? null : versjon))
  }, [])

  return (
    <Modallag
      apen={apen}
      tittel="Endringslogg"
      ikon="history"
      onLukk={onLukk}
      autofokus={versjon ? `[data-versjon="${versjon}"] ${FORSTE_FORING}` : FORSTE_FORING}
      tettKropp
    >
      <ul className="logg__liste">
        {ENDRINGSLOGG.map((endring) => (
          <Skuff
            key={endring.versjon}
            endring={endring}
            apen={apenSkuff === endring.versjon}
            onVeksle={() => veksle(endring.versjon)}
          />
        ))}
      </ul>
    </Modallag>
  )
}

/**
 * Én føring. Overskriften er knappen som åpner, og innholdet glir opp og igjen
 * med `grid-template-rows: 0fr ↔ 1fr` — den eneste måten å gli mot en ukjent
 * høyde på uten å måle den, og den samme som `Details` bruker ellers i appen.
 *
 * Her holder ren CSS, fordi skuffen styres av React og innholdet aldri
 * fjernes: det er nettopp `<details>` som må ha hjelp, siden nettleseren
 * skjuler innholdet momentant når `open` går bort. Lukket skuff settes usynlig
 * med `visibility`, slik at teksten i den heller ikke nås med tabulator eller
 * skjermleser.
 */
function Skuff({
  endring,
  apen,
  onVeksle,
}: {
  endring: Endring
  apen: boolean
  onVeksle: () => void
}) {
  const id = useId()
  const rad = useRef<HTMLLIElement>(null)

  // En skuff som åpnes nederst i lista skal ikke bli stående utenfor bildet.
  // Rullingen venter til glidningen er over — først da vet vi hvor høy den ble.
  useEffect(() => {
    if (!apen) return
    const el = rad.current
    if (!el) return
    const frist = window.setTimeout(
      () => el.scrollIntoView({ behavior: rullefart(), block: 'nearest' }),
      ETTER_GLIDNING,
    )
    return () => window.clearTimeout(frist)
  }, [apen])

  return (
    <li ref={rad} className="loggskuff" data-apen={apen ? 'ja' : 'nei'} data-versjon={endring.versjon}>
      <button
        type="button"
        className="loggskuff__tittel"
        aria-expanded={apen}
        aria-controls={id}
        onClick={onVeksle}
      >
        <span className="loggskuff__linje">
          <span className="loggskuff__merking">
            {formaterDato(endring.dato)} · {endring.versjon}
          </span>
          <span className="loggskuff__pil" aria-hidden="true">
            <Ikon navn="chev" storrelse={11} />
          </span>
        </span>
        <span className="loggskuff__sammendrag">{endring.sammendrag}</span>
        <span className="loggskuff__merker">
          {endring.typer.map((type) => (
            <span key={type} className={`loggmerke loggmerke--${TONE[type]}`}>
              {type}
            </span>
          ))}
          <span className="loggmerke loggmerke--omfang">{endring.omfang}</span>
        </span>
      </button>

      <div id={id} className="loggskuff__kropp">
        <div className="loggskuff__inner">
          <ul className="loggskuff__punkter">
            {endring.punkter.map((punkt, i) => (
              <li key={i}>{punkt}</li>
            ))}
          </ul>
        </div>
      </div>
    </li>
  )
}
