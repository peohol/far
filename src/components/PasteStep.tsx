import { Button } from './Button'
import { StepBar } from './StepBar'
import { BackIcon, DoneIcon, PasteIcon } from './icons'
import type { Analyte } from '../types'

export interface PasteStepProps {
  analyte: Analyte
  onBack: () => void
  onFinish: () => void
}

/** Steg 4: kommentaren ligger på utklippstavlen — her står hvor den skal. */
export function PasteStep({ analyte, onBack, onFinish }: PasteStepProps) {
  return (
    <section className="steg steg--limInn" aria-label="Lim inn kommentaren">
      <StepBar>
        <Button variant="subtle" icon={<BackIcon />} shortcut="Esc" onClick={onBack}>
          Endre konsentrasjon
        </Button>
      </StepBar>

      <div className="limInn">
        <p className="limInn__instruks">
          <PasteIcon className="limInn__ikon" />
          Lim inn kommentaren på
        </p>
        <p className="limInn__kode">{analyte.kode}</p>
      </div>

      <div className="handling">
        <Button icon={<DoneIcon />} shortcut="Enter" onClick={onFinish}>
          Ferdig
        </Button>
      </div>
    </section>
  )
}
