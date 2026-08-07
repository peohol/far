import { useMemo, type CSSProperties } from 'react'
import { Button } from './Button'
import { Card } from './Card'
import { Pill } from './Pill'
import { StepBar } from './StepBar'
import { Shortcut } from './Shortcut'
import { ManualCopy } from './ManualCopy'
import { ArrowDownIcon, ArrowUpIcon, BackIcon, CheckIcon, PhoneIcon } from './icons'
import { bands as bandsOf, type Band } from '../domain/bands'
import { indexToDigit } from '../hooks/useKeyboard'
import { useShortcutVisibility } from '../hooks/useShortcutVisibility'
import type { Analyte } from '../types'

export interface BandStepProps {
  analyte: Analyte
  onPick: (band: Band) => void
  onBack: () => void
  /** Kommentaren som skal kopieres for hånd, når utklippstavlen er utilgjengelig. */
  failed: { message: string; comment: string } | null
}

const IKON = {
  under: ArrowDownIcon,
  innenfor: CheckIcon,
  over: ArrowUpIcon,
  ring: PhoneIcon,
} as const

/**
 * Steg 2: hvilken analytt som kommenteres, og hvilket konsentrasjonsbånd
 * svaret havner i. Båndene er utledet av analyttens egne grenser, så knappene
 * viser tallene som gjelder akkurat den analytten.
 */
export function BandStep({ analyte, onPick, onBack, failed }: BandStepProps) {
  const bands = useMemo(() => bandsOf(analyte), [analyte])
  const { visible: merker } = useShortcutVisibility()

  return (
    <section className="steg" aria-label="Velg konsentrasjon">
      <StepBar>
        <Button variant="subtle" icon={<BackIcon />} shortcut="Esc" onClick={onBack}>
          Bytt analytt
        </Button>
      </StepBar>

      <Card align="start" className="analyttkort">
        <Pill tone="kode">{analyte.kode}</Pill>
        <h1 className="analytt__navn">{analyte.visningsnavn}</h1>
        <div className="analytt__grenser">
          {analyte.referanseomrade && (
            <Pill label="Referanseområde">
              {analyte.referanseomrade.tekst} {analyte.enhet}
            </Pill>
          )}
          {/* Enheten står bare på den første pillen — den gjelder begge. */}
          {analyte.ringegrense !== null && (
            <Pill tone="ring" icon={<PhoneIcon />} label="Ringegrense">
              {analyte.ringegrense}
            </Pill>
          )}
        </div>
      </Card>

      <Card className="bandkort">
        <h2 className="bandkort__merke">Målt konsentrasjon</h2>
        {/* Antallet bånd varierer med analytten, og knappene skal stå på én
            linje. CSS-en deler bredden på antallet for å finne hvor stor
            skriften kan være — og trenger å vite om hurtigtastmerkene tar plass
            inne i knappene. */}
        <ul
          className={`band${merker ? ' band--merker' : ''}`}
          style={{ '--antall': bands.length } as CSSProperties}
        >
          {bands.map((band, i) => {
            const Icon = IKON[band.ring && band.niva !== 'over' ? 'ring' : band.tone]
            return (
              <li key={band.key}>
                <button
                  type="button"
                  // Kvitteringen for kopieringen legges der knappen står, og
                  // finner den herfra — også når båndet ble valgt med tastaturet.
                  data-band={band.key}
                  className={`bandknapp bandknapp--${band.tone}`}
                  onClick={() => onPick(band)}
                  aria-keyshortcuts={indexToDigit(i)}
                  aria-describedby={`bandtips-${band.key}`}
                >
                  <Icon className="bandknapp__ikon" />
                  <span className="bandknapp__verdi">{band.label}</span>
                  <Shortcut>{indexToDigit(i)}</Shortcut>
                </button>
                {/* Kommentaren som havner på utklippstavlen, som tooltip over
                    raden. Den ligger utenfor knappen, slik at den kan spenne
                    over hele kortet uten å styre hvor bred knappen blir. */}
                <p className="bandtips" id={`bandtips-${band.key}`} role="tooltip">
                  {band.kommentar}
                </p>
              </li>
            )
          })}
        </ul>
      </Card>

      {failed && <ManualCopy message={failed.message} comment={failed.comment} />}
    </section>
  )
}
