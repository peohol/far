import { Button } from './Button'
import { Card } from './Card'
import { StepBar } from './StepBar'
import { BackIcon, PasteIcon, PhoneIcon } from './icons'
import type { Band } from '../domain/bands'
import type { Analyte } from '../types'

export interface PasteStepProps {
  analyte: Analyte
  band: Band
  onBack: () => void
  onFinish: () => void
}

/** Steg 3: kommentaren ligger på utklippstavlen — her står hvor den skal. */
export function PasteStep({ analyte, band, onBack, onFinish }: PasteStepProps) {
  return (
    <section className="steg" aria-label="Lim inn kommentaren">
      <StepBar>
        <Button variant="subtle" icon={<BackIcon />} shortcut="Esc" onClick={onBack}>
          Endre konsentrasjon
        </Button>
      </StepBar>

      <Card className="limInn">
        <p className="limInn__instruks">
          <PasteIcon className="limInn__ikon" />
          Lim inn kommentaren på
        </p>
        <p className="limInn__kode">{analyte.kode}</p>

        {band.ring && (
          <p className="ringvarsel" role="status">
            <PhoneIcon className="ringvarsel__ikon" />
            Husk å ringe!
          </p>
        )}
      </Card>

      <div className="handling">
        <Button shortcut="Enter" onClick={onFinish}>
          Ferdig
        </Button>
      </div>
    </section>
  )
}
