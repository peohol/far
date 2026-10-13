import { useCallback, useEffect, useState } from 'react'
import { ENDRINGSLOGG } from '../data/endringslogg'
import { formaterDato, type Endring, type Endringstype } from '../domain/versjon'
import { FORSTE_FORING, Loggskuff } from './Loggskuff'
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

/*
 * Uten autofokus ville fokus landet på lukkeknappen, som er det første
 * nettleseren finner — og da ville `Enter` lukket loggen i samme øyeblikk
 * som den ble åpnet. Den nyeste føringen er det man kom for, så fokus legges
 * der (`FORSTE_FORING`): `Enter` folder den ut i stedet.
 */

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

/** Én føring: datoen og versjonen, sammendraget, typene og punktene. */
function Skuff({
  endring,
  apen,
  onVeksle,
}: {
  endring: Endring
  apen: boolean
  onVeksle: () => void
}) {
  return (
    <Loggskuff
      apen={apen}
      onVeksle={onVeksle}
      data-versjon={endring.versjon}
      merking={
        <>
          {formaterDato(endring.dato)} · {endring.versjon}
        </>
      }
      sammendrag={endring.sammendrag}
      merker={
        <>
          {endring.typer.map((type) => (
            <span key={type} className={`loggmerke loggmerke--${TONE[type]}`}>
              {type}
            </span>
          ))}
          <span className="loggmerke loggmerke--omfang">{endring.omfang}</span>
        </>
      }
    >
      <ul className="loggskuff__punkter">
        {endring.punkter.map((punkt, i) => (
          <li key={i}>{punkt}</li>
        ))}
      </ul>
    </Loggskuff>
  )
}
