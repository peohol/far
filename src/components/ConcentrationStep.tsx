import { useEffect, useRef } from 'react'
import { Button } from './Button'
import { StepBar } from './StepBar'
import { LevelIndicator } from './LevelIndicator'
import { ManualCopy } from './ManualCopy'
import { BackIcon, CopyIcon, PhoneIcon, WarningIcon } from './icons'
import {
  classify,
  isAboveCallLimit,
  isOutsideMeasuringRange,
  levelComment,
  parseConcentration,
  sanitiseConcentrationInput,
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
  const kommentar = level === null ? null : levelComment(analyte, level).kommentar
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
            onChange={(e) => onChange(sanitiseConcentrationInput(e.target.value))}
            autoComplete="off"
            placeholder="0"
          />
          <span className="konsentrasjon__enhet">{analyte.enhet}</span>
        </div>
      </div>

      <div className="status">
        {level && kommentar && <LevelIndicator level={level} comment={kommentar} />}

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
        {error && kommentar && <ManualCopy message={error} comment={kommentar} />}
      </div>
    </section>
  )
}
