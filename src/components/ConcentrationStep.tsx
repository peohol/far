import { useEffect, useRef } from 'react'
import { Button } from './Button'
import { StepBar } from './StepBar'
import { LevelIndicator } from './LevelIndicator'
import { BackIcon, CopyIcon, PhoneIcon, WarningIcon } from './icons'
import {
  classify,
  isAboveCallLimit,
  isOutsideMeasuringRange,
  levelComment,
  parseConcentration,
} from '../domain/concentration'
import type { Analyte } from '../types'

export interface ConcentrationStepProps {
  analyte: Analyte
  value: string
  onChange: (value: string) => void
  onBack: () => void
  onCopy: () => void
  error: string | null
}

/** Sifre, ett desimalskille og ingenting annet. */
function sanitise(input: string): string {
  return input.replace(/[^\d.,]/g, '').replace(/[.,]/g, (m, i, s) => (s.indexOf(m) === i ? m : ''))
}

/**
 * Steg 3: tast inn konsentrasjonen og se fortløpende hvilket nivå den havner
 * på. Kommentaren kopieres med knappen eller Enter.
 */
export function ConcentrationStep({
  analyte,
  value,
  onChange,
  onBack,
  onCopy,
  error,
}: ConcentrationStepProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [analyte.kode])

  const tall = parseConcentration(value)
  const level = tall === null ? null : classify(analyte, tall)
  const ringer = tall !== null && isAboveCallLimit(analyte, tall)
  const utenforMaleomrade = tall !== null && isOutsideMeasuringRange(analyte, tall)

  return (
    <section className="steg steg--konsentrasjon" aria-label="Tast inn konsentrasjon">
      <StepBar>
        <Button variant="subtle" icon={<BackIcon />} shortcut="Esc" onClick={onBack}>
          Bytt analytt
        </Button>
      </StepBar>

      <header className="analytt">
        <p className="analytt__kode">{analyte.kode}</p>
        <h1 className="analytt__navn">{analyte.visningsnavn}</h1>
        {analyte.referanseomrade && (
          <p className="analytt__ref">
            Referanseområde {analyte.referanseomrade.tekst} {analyte.enhet}
          </p>
        )}
      </header>

      <div className="konsentrasjon">
        <label className="konsentrasjon__merke" htmlFor="konsentrasjon">
          Målt konsentrasjon
        </label>
        <div className="konsentrasjon__felt">
          <input
            ref={inputRef}
            id="konsentrasjon"
            className="konsentrasjon__input"
            type="text"
            inputMode="decimal"
            value={value}
            onChange={(e) => onChange(sanitise(e.target.value))}
            autoComplete="off"
            placeholder="0"
          />
          <span className="konsentrasjon__enhet">{analyte.enhet}</span>
        </div>
      </div>

      <div className="status">
        {level && <LevelIndicator level={level} comment={levelComment(analyte, level).kommentar} />}

        {ringer && (
          <p className="ringegrense">
            <PhoneIcon className="ringegrense__ikon" />
            Over ringegrensen!
          </p>
        )}

        {utenforMaleomrade && (
          <p className="varsel">
            <WarningIcon className="varsel__ikon" />
            Utenfor måleområdet ({analyte.maleomrade.tekst} {analyte.enhet})
          </p>
        )}
      </div>

      <div className="handling">
        {level && (
          <Button icon={<CopyIcon />} shortcut="Enter" onClick={onCopy}>
            Kopier kommentar nå
          </Button>
        )}
        {error && (
          <p className="feil" role="alert">
            {error}
          </p>
        )}
      </div>
    </section>
  )
}
