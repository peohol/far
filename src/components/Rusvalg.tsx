import type { Ref } from 'react'
import type { RusAnalytt, RusVerdifelt } from '../domain/rus'
import { indexToDigit } from '../hooks/useKeyboard'
import { Shortcut } from './Shortcut'
import { Tallfelt } from './Tallfelt'

export interface RusvalgProps {
  analytter: RusAnalytt[]
  pavist: string[]
  verdifelter: RusVerdifelt[]
  verdier: Record<string, string>
  /** Hvorfor modulen ber om tallene. Tom når den ikke gjør det. */
  verdihjelp: string
  onPavist: (kode: string, pavist: boolean) => void
  onVerdi: (kode: string, verdi: string) => void
  /** Den første avkryssingen, for den som vil gi den fokus. */
  forsteValg?: Ref<HTMLInputElement>
  /** Sant når tallene 1, 2 … huker av analyttene, og det skal stå ved dem. */
  snarveier?: boolean
}

/**
 * Spørsmålene rusmiddelmodulen stiller: hvilke analytter som er påvist, og
 * konsentrasjonene regelen trenger for å avgjøre. Felles for
 * fortolkningsmodulen og simulatoren på stoffsiden, så de spør likt.
 */
export function Rusvalg({
  analytter,
  pavist,
  verdifelter,
  verdier,
  verdihjelp,
  onPavist,
  onVerdi,
  forsteValg,
  snarveier = false,
}: RusvalgProps) {
  return (
    <>
      {analytter.length > 1 && (
        <fieldset className="feltgruppe">
          <legend>Påvist i denne prøven</legend>
          <div className="avkryssinger">
            {analytter.map((analytt, i) => (
              <label className="avkryssing" key={analytt.kode}>
                <input
                  ref={i === 0 ? forsteValg : undefined}
                  type="checkbox"
                  checked={pavist.includes(analytt.kode)}
                  onChange={(e) => onPavist(analytt.kode, e.target.checked)}
                  aria-keyshortcuts={snarveier ? indexToDigit(i) : undefined}
                />
                {analytt.navn}
                <span className="avkryssing__kode">{analytt.kode}</span>
                {snarveier && <Shortcut>{indexToDigit(i)}</Shortcut>}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {verdifelter.length > 0 && (
        <fieldset className="feltgruppe">
          <legend>Målte konsentrasjoner</legend>
          {verdihjelp && <p className="feltgruppe__hjelp">{verdihjelp}</p>}
          <div className="feltrad">
            {verdifelter.map((felt) => (
              <label className="skjemafelt" key={felt.kode}>
                <span>
                  {felt.navn} ({felt.kode})
                </span>
                <Tallfelt value={verdier[felt.kode] ?? ''} onChange={(verdi) => onVerdi(felt.kode, verdi)} />
              </label>
            ))}
          </div>
        </fieldset>
      )}
    </>
  )
}
