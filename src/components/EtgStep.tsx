import { useRef, useState } from 'react'
import { Button } from './Button'
import { Card } from './Card'
import { Kommentarflyt } from './Kommentarflyt'
import { Pill } from './Pill'
import { Shortcut } from './Shortcut'
import { StepBar } from './StepBar'
import { BackIcon, CheckIcon } from './icons'
import { ETG_ALTERNATIVER, ETG_KODE, ETS_KODE, type EtgAlternativ } from '../domain/etg'
import { useKortHopp } from '../hooks/useKortHopp'
import { indexToDigit, useKeyboard } from '../hooks/useKeyboard'

export interface EtgStepProps {
  onBack: () => void
  /** Tilbake til søket, klar for neste analytt. */
  onFinish: () => void
  /** Legger teksten på utklippstavlen. Usant når utklippstavlen er utilgjengelig. */
  copy: (text: string) => Promise<boolean>
  /** Viser kopikvitteringen ved elementet — samme blink som i båndsteget. */
  flashAt: (element: Element | null | undefined) => void
}

/**
 * Fortolkningsmodulen for etylglukuronid (EtG) og etylsulfat (EtS) i urin.
 *
 * De to omdannelsesproduktene vurderes alltid sammen, og det eneste modulen
 * trenger å vite er hva som er påvist av dem. Derfor er hele modulen tre
 * knapper — ett tilfelle hver — med tastene 1, 2 og 3, slik båndknappene også
 * velges. Valget avgjør både hvilken kommentar som gjelder og hvilken
 * analyttkode den skal limes inn på; selve kopieringen er felles for
 * fortolkningsmodulene og ligger i {@link Kommentarflyt}.
 */
export function EtgStep({ onBack, onFinish, copy, flashAt }: EtgStepProps) {
  const [valgt, setValgt] = useState<EtgAlternativ | null>(null)
  /**
   * Teller opp for hvert nytt valg, så kvitteringene for det forrige ikke blir
   * stående på kommentarer som ikke lenger gjelder.
   */
  const [utgave, setUtgave] = useState(0)
  const seksjon = useRef<HTMLElement>(null)

  useKortHopp(true, seksjon)

  const velg = (alternativ: EtgAlternativ) => {
    // Det samme valget om igjen er ikke noe nytt svar, og skal ikke viske ut
    // kvitteringen for en kommentar som alt er kopiert.
    if (alternativ === valgt) return
    setValgt(alternativ)
    setUtgave((sa) => sa + 1)
  }

  /** Tastene 1, 2 og 3 velger hvert sitt tilfelle, som knappene de hører til. */
  useKeyboard(
    Object.fromEntries(
      ETG_ALTERNATIVER.map((alternativ, i) => [
        indexToDigit(i),
        (e: KeyboardEvent) => {
          e.preventDefault()
          velg(alternativ)
        },
      ]),
    ),
  )

  return (
    <section className="steg steg--etg" aria-label="Kommenter EtG og EtS" ref={seksjon}>
      <StepBar>
        <Button variant="subtle" icon={<BackIcon />} shortcut="Esc" onClick={onBack}>
          Bytt analytt
        </Button>
      </StepBar>

      <div className="modul">
        <Card align="start" className="analyttkort">
          <div className="modul-koder">
            <Pill tone="kode">{ETG_KODE}</Pill>
            <Pill tone="kode">{ETS_KODE}</Pill>
          </div>
          <h1 className="analytt__navn">EtG + EtS</h1>
          <p className="modul-undertittel">Etylglukuronid og etylsulfat i urin</p>

          <fieldset className="modul-valg">
            <legend>Påvist i denne prøven</legend>
            <ul className="etg-alternativer">
              {ETG_ALTERNATIVER.map((alternativ, i) => (
                <li key={alternativ.id}>
                  <Alternativ
                    alternativ={alternativ}
                    snarvei={indexToDigit(i)}
                    valgt={alternativ === valgt}
                    onVelg={() => velg(alternativ)}
                  />
                </li>
              ))}
            </ul>
          </fieldset>
        </Card>

        <Card align="start" className="modul-resultat">
          {valgt === null ? (
            <>
              <h2 className="thc-resultat__merke">Mangler</h2>
              <ul className="thc-mangler">
                <li>Velg hva som er påvist i denne prøven.</li>
              </ul>
            </>
          ) : (
            <>
              <h2 className="thc-resultat__merke">
                {valgt.plasseringer.length > 1 ? 'Kommentarer' : 'Kommentar'}
              </h2>

              <Kommentarflyt
                plasseringer={valgt.plasseringer}
                utgave={utgave}
                // Kommentaren avhenger av hvilket av de tre tilfellene som er
                // valgt, og valget kan bli feil. Da skal den som limer inn
                // kunne lese hva som faktisk havner på utklippstavlen.
                visTekst
                copy={copy}
                flashAt={flashAt}
                onFinish={onFinish}
              />
            </>
          )}
        </Card>
      </div>
    </section>
  )
}

/**
 * Ett av de tre tilfellene. Kodene som er påvist står under teksten, så det
 * går fram hvilke analytter knappen svarer for — og hva som ikke er påvist.
 * Det valgte tilfellet er merket med både farge og hake, slik at valget ikke
 * bare leses av fargen.
 */
function Alternativ({
  alternativ,
  snarvei,
  valgt,
  onVelg,
}: {
  alternativ: EtgAlternativ
  snarvei: string
  valgt: boolean
  onVelg: () => void
}) {
  return (
    <button
      type="button"
      className="etg-alternativ"
      aria-pressed={valgt}
      aria-keyshortcuts={snarvei}
      onClick={onVelg}
    >
      {/* Plassen til haken står der hele tiden, så knappene ikke skifter form
          når valget flyttes. */}
      <span className="etg-alternativ__hake">{valgt && <CheckIcon />}</span>
      <span className="etg-alternativ__merke">{alternativ.merke}</span>
      <span className="etg-alternativ__koder">{alternativ.pavist.join(' + ')}</span>
      <Shortcut>{snarvei}</Shortcut>
    </button>
  )
}
