import type { CSSProperties } from 'react'
import { Button } from './Button'
import { Card } from './Card'
import { ManualCopy } from './ManualCopy'
import { Pill } from './Pill'
import { Shortcut } from './Shortcut'
import { StepBar } from './StepBar'
import { useTips } from './Tips'
import { BackIcon } from './icons'
import { ETG_ALTERNATIVER, ETG_KODE, ETS_KODE, type EtgAlternativ } from '../domain/etg'
import { indexToDigit } from '../hooks/useKeyboard'

export interface EtgStepProps {
  onPick: (alternativ: EtgAlternativ) => void
  onBack: () => void
  /** Kommentaren som skal kopieres for hånd, når utklippstavlen er utilgjengelig. */
  failed: { message: string; comment: string } | null
}

/**
 * Fortolkningsmodulen for etylglukuronid (EtG) og etylsulfat (EtS) i urin.
 *
 * De to omdannelsesproduktene vurderes alltid sammen, og det eneste modulen
 * trenger å vite er hva som er påvist av dem. Det gjør steget til det samme
 * valget som konsentrasjonsbåndene er for psykofarmaka: én knapp per tilfelle,
 * med tallet sitt, og kommentaren kopiert i det knappen trykkes. Derfor er
 * knappene bygd som båndknappene, og følger med videre til limsteget på samme
 * måte.
 */
export function EtgStep({ onPick, onBack, failed }: EtgStepProps) {
  return (
    <section className="steg steg--etg" aria-label="Velg hva som er påvist">
      <StepBar>
        <Button variant="subtle" icon={<BackIcon />} shortcut="Esc" onClick={onBack}>
          Bytt analytt
        </Button>
      </StepBar>

      <Card align="start" className="analyttkort">
        <div className="modul-koder">
          <Pill tone="kode">{ETG_KODE}</Pill>
          <Pill tone="kode">{ETS_KODE}</Pill>
        </div>
        <h1 className="analytt__navn">EtG + EtS</h1>
        <p className="modul-undertittel">Etylglukuronid og etylsulfat i urin</p>
      </Card>

      <Card className="bandkort">
        <h2 className="bandkort__merke">Påvist i denne prøven</h2>
        {/* Samme rad som båndknappene, men med ord i stedet for tall: hver
            knapp trenger mer bredde før skriften må krympe, og tallmerket står
            alltid og er regnet med i bredden. */}
        <ul
          className="band"
          style={{ '--antall': ETG_ALTERNATIVER.length, '--band-innhold': 13 } as CSSProperties}
        >
          {ETG_ALTERNATIVER.map((alternativ, i) => (
            <EtgKnapp
              key={alternativ.id}
              alternativ={alternativ}
              snarvei={indexToDigit(i)}
              onPick={() => onPick(alternativ)}
            />
          ))}
        </ul>
      </Card>

      {failed && <ManualCopy message={failed.message} comment={failed.comment} />}
    </section>
  )
}

/**
 * Ett av de tre tilfellene. Kommentaren som havner på utklippstavlen henger på
 * knappen som et tips, så den kan leses før valget tas — som på båndknappene.
 *
 * Tallmerket står alltid. Modulen er tre knapper og ingenting annet, og da er
 * tastene den raskeste veien gjennom den; de skal ikke måtte slås på først.
 */
function EtgKnapp({
  alternativ,
  snarvei,
  onPick,
}: {
  alternativ: EtgAlternativ
  snarvei: string
  onPick: () => void
}) {
  const forste = alternativ.plasseringer[0]
  const tips = useTips(forste?.tekst ?? '')

  return (
    <li>
      <button
        type="button"
        // Kvitteringen legges der knappen står, og beviset i neste steg flyter
        // opp fra den samme ruten. Begge finner knappen herfra — også når
        // tilfellet ble valgt med tastaturet.
        data-etg={alternativ.id}
        className="bandknapp bandknapp--noytral"
        onClick={onPick}
        aria-keyshortcuts={snarvei}
        {...tips.props}
      >
        <span className="bandknapp__verdi">{alternativ.merke}</span>
        <Shortcut always>{snarvei}</Shortcut>
      </button>
      {tips.forklaring}
    </li>
  )
}
