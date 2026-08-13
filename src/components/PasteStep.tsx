import { Button } from './Button'
import { Card } from './Card'
import { Kopibevis } from './Kopibevis'
import { StepBar } from './StepBar'
import { BackIcon, PasteIcon, PhoneIcon } from './icons'
import type { Band } from '../domain/bands'
import type { Rute } from '../domain/flytting'
import type { Analyte } from '../types'

export interface PasteStepProps {
  analyte: Analyte
  band: Band
  /** Ruten båndknappen sto i da kommentaren ble kopiert. Se {@link Kopibevis}. */
  fra: Rute | null
  onBack: () => void
  onFinish: () => void
}

/** Steg 3: kommentaren ligger på utklippstavlen — her står hvor den skal. */
export function PasteStep({ analyte, band, fra, onBack, onFinish }: PasteStepProps) {
  return (
    <section className="steg" aria-label="Lim inn kommentaren">
      <StepBar>
        <Button variant="subtle" icon={<BackIcon />} shortcut="Esc" onClick={onBack}>
          Endre konsentrasjon
        </Button>
      </StepBar>

      {/* Beviset hører til kortet under og står tettere på det enn stegets
          egen luft, så de to leses som én ting: denne kommentaren, hit. */}
      <div className="limstabel">
        <Kopibevis band={band} fra={fra} />

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
      </div>

      <div className="handling">
        <Button shortcut="Enter" onClick={onFinish}>
          Ferdig
        </Button>
      </div>
    </section>
  )
}
