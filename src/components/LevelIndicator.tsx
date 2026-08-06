import { useId } from 'react'
import { ArrowDownIcon, ArrowUpIcon, CheckIcon } from './icons'
import type { Level } from '../types'

const OPPSETT: Record<Level, { label: string; Icon: typeof CheckIcon }> = {
  under: { label: 'Under referanseområdet', Icon: ArrowDownIcon },
  innenfor: { label: 'Innenfor referanseområdet', Icon: CheckIcon },
  over: { label: 'Over referanseområdet', Icon: ArrowUpIcon },
}

export interface LevelIndicatorProps {
  level: Level
  /** Kommentaren for nivået, som vises som tooltip. */
  comment: string
}

/**
 * Viser hvilket nivå den inntastede konsentrasjonen havner på, og gir
 * kommentaren som tooltip ved pekeren eller tastaturfokus.
 *
 * Tooltipen ligger alltid i DOM-en og skjules med gjennomsiktighet, ikke
 * `display`/`visibility`, slik at `aria-describedby` fortsatt når fram til
 * skjermlesere.
 */
export function LevelIndicator({ level, comment }: LevelIndicatorProps) {
  const tooltipId = useId()
  const { label, Icon } = OPPSETT[level]

  return (
    <div className="indikator-hylse">
      <div
        className={`indikator indikator--${level}`}
        tabIndex={0}
        role="status"
        aria-describedby={tooltipId}
      >
        <Icon className="indikator__ikon" />
        <span className="indikator__tekst">{label}</span>
      </div>
      <div className="tooltip" id={tooltipId} role="tooltip">
        {comment}
      </div>
    </div>
  )
}
