import type { CSSProperties } from 'react'
import { Button } from './Button'
import { Card } from './Card'
import { Kodepille } from './Kodepille'
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
import { CUTOFF_NOKKEL, type Kommentarvalg } from '../domain/valg'
import { indexToDigit } from '../hooks/useKeyboard'
import { useShortcutVisibility } from '../hooks/useShortcutVisibility'
import { referanseomradet, type Regeloppslag } from '../regler/publiserte'
import type { Analyte } from '../types'

export interface BandStepProps {
  analyte: Analyte
  /** Det publiserte regelsettet for analytten, eller hvorfor det ikke er her. */
  regler: Regeloppslag
  /** Valgene regelsettet gir — de samme som tastene velger mellom. */
  valg: Kommentarvalg[]
  onPick: (valg: Kommentarvalg) => void
  onBack: () => void
  /** Henter regelsettene igjen, etter at hentingen feilet. */
  onProvIgjen: () => void
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
 * Det steg 2 sier i stedet for knappene, mens regelsettet hentes eller når
 * det ikke finnes. Uten knapper er det ingenting å kopiere, så ingen
 * kommentar kan bli gitt etter regler som ikke er de publiserte.
 */
function Regelmelding({
  regler,
  kode,
  onProvIgjen,
}: {
  regler: Exclude<Regeloppslag, { status: 'klar' }>
  kode: string
  onProvIgjen: () => void
}) {
  if (regler.status === 'laster') {
    return (
      <p className="bandkort__melding" aria-busy="true">
        Henter fortolkningsreglene …
      </p>
    )
  }
  if (regler.status === 'mangler') {
    return (
      <p className="bandkort__melding" role="alert">
        Det finnes ingen publiserte fortolkningsregler for {kode}.
      </p>
    )
  }
  return (
    <div className="bandkort__melding" role="alert">
      <p>Fikk ikke hentet fortolkningsreglene. {regler.melding}</p>
      <Button variant="subtle" onClick={onProvIgjen}>
        Prøv igjen
      </Button>
    </div>
  )
}

/**
 * Steg 2: hvilken analytt som kommenteres, og hvilket konsentrasjonsbånd
 * svaret havner i. Båndene er intervallene i det publiserte regelsettet for
 * analytten, så knappene viser tallene som gjelder akkurat den analytten.
 *
 * Regelsett med «Til stede under cut-off» har ett valg til, som ikke er en
 * konsentrasjon: stoffet er til stede, men under påvisningsgrensen. Det står
 * under båndene, i sin egen rad, og fortsetter nummereringen deres.
 */
export function BandStep({ analyte, regler, valg: alle, onPick, onBack, onProvIgjen, failed }: BandStepProps) {
  const { visible: merker } = useShortcutVisibility()
  const regelsett = regler.status === 'klar' ? regler.regelsett : null

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
        <Kodepille kode={analyte.kode} />
        <h1 className="analytt__navn">{displayName(analyte)}</h1>
        <div className="analytt__grenser">
          {grensepiller(analyte, regelsett, referanseomradet(regler)).map((pille) => (
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
        {regler.status !== 'klar' && (
          <Regelmelding regler={regler} kode={analyte.kode} onProvIgjen={onProvIgjen} />
        )}
        {/* Antallet bånd varierer med analytten, og knappene skal stå på én
            linje. CSS-en deler bredden på antallet for å finne hvor stor
            skriften kan være — og trenger å vite om hurtigtastmerkene tar plass
            inne i knappene. */}
        {bands.length > 0 && (
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
        )}

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
