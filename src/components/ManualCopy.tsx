import { useEffect, useRef } from 'react'

/** Beskjeden når utklippstavlen ikke var tilgjengelig. Den samme overalt. */
export const KOPIFEIL = 'Fikk ikke tilgang til utklippstavlen. Kopier teksten manuelt.'

export interface ManualCopyProps {
  /** Beskjeden over feltet. Uten står {@link KOPIFEIL}. */
  message?: string
  comment: string
}

/**
 * Reserveløsning når nettleseren nekter tilgang til utklippstavlen.
 *
 * Uten dette ville brukeren stått fast: kommentaren finnes ellers bare i
 * tooltipen, som har `pointer-events: none` og derfor ikke kan markeres. Her
 * vises den i et markerbart felt som velges automatisk, slik at Ctrl+C
 * fullfører oppgaven likevel.
 */
export function ManualCopy({ message = KOPIFEIL, comment }: ManualCopyProps) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    ref.current?.select()
  }, [comment])

  return (
    <div className="manuellKopi" role="alert">
      <p className="manuellKopi__melding">{message}</p>
      <textarea
        ref={ref}
        className="manuellKopi__tekst"
        value={comment}
        readOnly
        rows={5}
        aria-label="Kommentar til manuell kopiering"
        onFocus={(e) => e.currentTarget.select()}
      />
    </div>
  )
}
