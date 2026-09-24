import { Button } from './Button'
import { Card } from './Card'
import { Kopibevis } from './Kopibevis'
import { StepBar } from './StepBar'
import { bandIkon } from './bandikon'
import { Ikon } from './ikon/Ikon'
import type { Rute } from '../domain/flytting'
import type { Kommentarvalg } from '../domain/valg'
import type { Analyte } from '../types'

export interface PasteStepProps {
  analyte: Analyte
  /** Valget kommentaren kom fra: et konsentrasjonsbånd, eller cut-off-knappen. */
  valg: Kommentarvalg
  /** Ruten knappen sto i da kommentaren ble kopiert. Se {@link Kopibevis}. */
  fra: Rute | null
  onBack: () => void
  onFinish: () => void
}

/** Steg 3: kommentaren ligger på utklippstavlen — her står hvor den skal. */
export function PasteStep({ analyte, valg, fra, onBack, onFinish }: PasteStepProps) {
  return (
    <section className="steg" aria-label="Lim inn kommentaren">
      <StepBar onEsc={onBack}>Endre konsentrasjon</StepBar>

      {/* Beviset hører til kortet under og står tettere på det enn stegets
          egen luft, så de to leses som én ting: denne kommentaren, hit. */}
      <div className="limstabel">
        <Kopibevis
          tone={valg.tone}
          ikon={bandIkon(valg)}
          tekst={valg.label}
          kommentar={valg.kommentar}
          fra={fra}
        />

        <Limkort kode={analyte.kode} ring={valg.ring} />
      </div>

      <div className="handling">
        <Button icon={<Ikon navn="done" />} shortcut="Enter" onClick={onFinish}>
          Ferdig
        </Button>
      </div>
    </section>
  )
}

/**
 * Limkortet: «Lim inn kommentaren på» og koden stort, og ringevarselet når det
 * gjelder (Atlas `PasteCard`). Koden er det eneste på skjermen brukeren må
 * lese av og handle på, og står derfor størst.
 */
function Limkort({ kode, ring }: { kode: string; ring: boolean }) {
  return (
    <Card className="limInn">
      <p className="limInn__instruks">
        <Ikon navn="paste" className="limInn__ikon" />
        Lim inn kommentaren på
      </p>
      <p className="limInn__kode">{kode}</p>

      {ring && (
        <p className="ringvarsel" role="status">
          <Ikon navn="phone" className="ringvarsel__ikon" />
          Husk å ringe!
        </p>
      )}
    </Card>
  )
}
