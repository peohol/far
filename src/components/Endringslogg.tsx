import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { ENDRINGSLOGG } from '../data/endringslogg'
import { formaterDato, type Endring, type Endringstype } from '../domain/versjon'
import { rullefart } from '../hooks/useKortHopp'
import { CloseIcon } from './icons'

/**
 * Endringsloggen, som et lag over appen.
 *
 * Bygget på `<dialog>` med `showModal()`. Nettleseren gir da fokusfelle,
 * lukking med Escape, bakgrunn som ikke kan klikkes, og fokuset tilbake dit
 * det kom fra — alt sammen uten egen kode, og mer robust enn en håndskrevet
 * variant ville blitt.
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

export function Endringslogg({ apen, onLukk }: { apen: boolean; onLukk: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  /** Versjonen til skuffen som står åpen — bare én av gangen. */
  const [apenSkuff, setApenSkuff] = useState<string | null>(null)

  useEffect(() => {
    const el = dialog.current
    if (!el) return
    if (apen && !el.open) {
      el.showModal()
      // Uten dette lander fokus på lukkeknappen, som er det første nettleseren
      // finner — og da ville `Enter` lukket loggen i samme øyeblikk som den
      // ble åpnet. Den nyeste føringen er det man kom for, så fokus legges
      // der: `Enter` folder den ut i stedet.
      el.querySelector<HTMLElement>('.loggskuff__tittel')?.focus()
    } else if (!apen && el.open) {
      el.close()
    }
  }, [apen])

  // Alle veier ut — Escape, klikk på bakgrunnen, lukkeknappen — ender i
  // nettleserens egen `close`, så tilstanden utenfor holdes i takt ett sted.
  useEffect(() => {
    const el = dialog.current
    if (!el) return
    el.addEventListener('close', onLukk)
    return () => el.removeEventListener('close', onLukk)
  }, [onLukk])

  // Lukket lag: neste åpning skal begynne på toppen, med alle skuffer igjen.
  useEffect(() => {
    if (!apen) setApenSkuff(null)
  }, [apen])

  // Et klikk utenfor panelet treffer selve `<dialog>`, som fyller hele
  // vinduet. Panelet inni fanger sine egne klikk.
  const paaTrykk = (event: React.MouseEvent<HTMLDialogElement>) => {
    if (event.target === dialog.current) dialog.current?.close()
  }

  const veksle = useCallback((versjon: string) => {
    setApenSkuff((forrige) => (forrige === versjon ? null : versjon))
  }, [])

  return (
    <dialog ref={dialog} className="logg" aria-labelledby="logg-tittel" onClick={paaTrykk}>
      <div className="logg__panel">
        <div className="logg__topp">
          <h2 id="logg-tittel" className="logg__tittel">
            Endringslogg
          </h2>
          <button
            type="button"
            className="logg__lukk"
            aria-label="Lukk endringsloggen"
            onClick={() => dialog.current?.close()}
          >
            <CloseIcon />
          </button>
        </div>

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
      </div>
    </dialog>
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
    <li ref={rad} className="loggskuff" data-apen={apen ? 'ja' : 'nei'}>
      <button
        type="button"
        className="loggskuff__tittel"
        aria-expanded={apen}
        aria-controls={id}
        onClick={onVeksle}
      >
        <span className="loggskuff__merking">
          {formaterDato(endring.dato)} · {endring.versjon}
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
