import { useMemo, type CSSProperties } from 'react'
import { Button } from './Button'
import { Card } from './Card'
import { Pill, type PillTone } from './Pill'
import { StepBar } from './StepBar'
import { Shortcut } from './Shortcut'
import { ManualCopy } from './ManualCopy'
import { useTips } from './Tips'
import { bandIkon } from './bandikon'
import { BackIcon, PhoneIcon } from './icons'
import { bands as bandsOf, type Band } from '../domain/bands'
import { displayName } from '../domain/names'
import { grensepiller, type Pilleslag } from '../domain/piller'
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

/**
 * Ett bånd. Kommentaren som havner på utklippstavlen henger på knappen som et
 * tips, så den kan leses før valget tas.
 */
function BandKnapp({ band, snarvei, onPick }: { band: Band; snarvei: string; onPick: () => void }) {
  const tips = useTips(band.kommentar)
  const Icon = bandIkon(band)

  return (
    <li>
      <button
        type="button"
        // Kvitteringen legges der knappen står, og beviset i neste steg flyter
        // opp fra den samme ruten. Begge finner knappen herfra — også når
        // båndet ble valgt med tastaturet.
        data-band={band.key}
        className={`bandknapp bandknapp--${band.tone}`}
        onClick={onPick}
        aria-keyshortcuts={snarvei}
        {...tips.props}
      >
        <Icon className="bandknapp__ikon" />
        <span className="bandknapp__verdi">{band.label}</span>
        <Shortcut>{snarvei}</Shortcut>
      </button>
      {tips.forklaring}
    </li>
  )
}

/** Fargen hver grensepille bæres av. Se `domain/piller.ts`. */
const TONE: Record<Pilleslag, PillTone> = {
  referanseomrade: 'noytral',
  ringegrense: 'ring',
  pavisningsgrense: 'noytral',
  terapiomrade: 'noytral',
  toksisk: 'over',
}

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
        <h1 className="analytt__navn">{displayName(analyte)}</h1>
        <div className="analytt__grenser">
          {grensepiller(analyte).map((pille) => (
            <Pill
              key={pille.slag}
              tone={TONE[pille.slag]}
              icon={pille.slag === 'ringegrense' ? <PhoneIcon /> : undefined}
              label={pille.merke}
            >
              {pille.verdi}
            </Pill>
          ))}
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
          {bands.map((band, i) => (
            <BandKnapp
              key={band.key}
              band={band}
              snarvei={indexToDigit(i)}
              onPick={() => onPick(band)}
            />
          ))}
        </ul>
      </Card>

      {failed && <ManualCopy message={failed.message} comment={failed.comment} />}
    </section>
  )
}
