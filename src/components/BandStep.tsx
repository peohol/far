import { useMemo, type CSSProperties } from 'react'
import { Button } from './Button'
import { Card } from './Card'
import { Metodepille } from './Metodepille'
import { Pill, type PillTone } from './Pill'
import { StepBar } from './StepBar'
import { Shortcut } from './Shortcut'
import { ManualCopy } from './ManualCopy'
import { useTips } from './Tips'
import { bandIkon } from './bandikon'
import { BackIcon, PhoneIcon } from './icons'
import { displayName } from '../domain/names'
import { grensepiller, type Pilleslag } from '../domain/piller'
import { CUTOFF_NOKKEL, valgene, type Kommentarvalg } from '../domain/valg'
import { indexToDigit } from '../hooks/useKeyboard'
import { useShortcutVisibility } from '../hooks/useShortcutVisibility'
import type { Analyte } from '../types'

export interface BandStepProps {
  analyte: Analyte
  onPick: (valg: Kommentarvalg) => void
  onBack: () => void
  /** Kommentaren som skal kopieres for hånd, når utklippstavlen er utilgjengelig. */
  failed: { message: string; comment: string } | null
}

/**
 * Ett valg. Kommentaren som havner på utklippstavlen henger på knappen som et
 * tips, så den kan leses før valget tas.
 */
function Valgknapp({
  valg,
  snarvei,
  onPick,
}: {
  valg: Kommentarvalg
  snarvei: string
  onPick: () => void
}) {
  const tips = useTips(valg.kommentar)
  const Icon = bandIkon(valg)

  return (
    <li>
      <button
        type="button"
        // Kvitteringen legges der knappen står, og beviset i neste steg flyter
        // opp fra den samme ruten. Begge finner knappen herfra — også når
        // valget ble tatt med tastaturet.
        data-band={valg.key}
        className={`bandknapp bandknapp--${valg.tone}`}
        onClick={onPick}
        aria-keyshortcuts={snarvei}
        {...tips.props}
      >
        <Icon className="bandknapp__ikon" />
        <span className="bandknapp__verdi">{valg.label}</span>
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
 *
 * Antidepressiver og antipsykotika har ett valg til, som ikke er en
 * konsentrasjon: stoffet er til stede, men under påvisningsgrensen. Det står
 * under båndene, i sin egen rad, og fortsetter nummereringen deres.
 */
export function BandStep({ analyte, onPick, onBack, failed }: BandStepProps) {
  const alle = useMemo(() => valgene(analyte), [analyte])
  const { visible: merker } = useShortcutVisibility()

  // Hurtigtasten er plassen i utvalget, og cut-off-valget står sist. Da kan
  // ikke tastene i de to radene komme i utakt med hverandre.
  const bands = alle.filter((valg) => valg.key !== CUTOFF_NOKKEL)
  const cutoff = alle.find((valg) => valg.key === CUTOFF_NOKKEL)

  return (
    <section className="steg" aria-label="Velg konsentrasjon">
      <StepBar>
        <Button variant="subtle" icon={<BackIcon />} shortcut="Esc" onClick={onBack}>
          Bytt analytt
        </Button>
      </StepBar>

      <Card align="start" className="analyttkort">
        <Metodepille metode={analyte.analysemetode} kategori={analyte.kategori} />
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
          {bands.map((valg, i) => (
            <Valgknapp
              key={valg.key}
              valg={valg}
              snarvei={indexToDigit(i)}
              onPick={() => onPick(valg)}
            />
          ))}
        </ul>

        {/* Egen rad: valget er ingen konsentrasjon, og skal verken dele
            bredden med båndene eller leses som en del av skalaen. */}
        {cutoff && (
          <ul className="band bandkort__ekstra">
            <Valgknapp
              valg={cutoff}
              snarvei={indexToDigit(bands.length)}
              onPick={() => onPick(cutoff)}
            />
          </ul>
        )}
      </Card>

      {failed && <ManualCopy message={failed.message} comment={failed.comment} />}
    </section>
  )
}
