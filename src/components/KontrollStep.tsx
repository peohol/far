import { Button } from './Button'
import { Card } from './Card'
import { ManualCopy } from './ManualCopy'
import { Shortcut } from './Shortcut'
import { StepBar } from './StepBar'
import { bandIkon } from './bandikon'
import { BackIcon } from './icons'
import type { Kommentarvalg } from '../domain/valg'
import { indexToDigit } from '../hooks/useKeyboard'

export interface KontrollStepProps {
  /** Valget som venter på bekreftelse. */
  valg: Kommentarvalg
  /** Spørsmålet som må besvares før kommentaren kopieres. */
  sporsmal: string
  /** Ja: kommentaren kopieres, og flyten går videre til limsteget. */
  onJa: () => void
  /** Nei: tilbake til valget. Det samme som Esc gjør. */
  onNei: () => void
  /** Kommentaren som skal kopieres for hånd, når utklippstavlen er utilgjengelig. */
  failed: { message: string; comment: string } | null
}

/**
 * Kontrollsteget: spørsmålet som står mellom et valg og kommentaren det gir.
 *
 * «Til stede under cut-off» kan ikke tas på ordet — et signal under
 * påvisningsgrensen kan like gjerne være støy — og kommentaren skal derfor
 * ikke kopieres før laboratoriet har bekreftet funnet. Steget gjør ingenting
 * annet enn å stille det ene spørsmålet.
 *
 * Knappen som ble valgt står øverst, i sin egen farge, så det går fram hva som
 * bekreftes. Den er også den kvitteringen for kopieringen fester seg til, og
 * flyter videre derfra til limsteget.
 *
 * Ja og nei er nøytrale. En grønn og en rød knapp ville sagt noe klinisk her
 * som ikke er ment — fargene i appen hører til konsentrasjonsnivåene.
 */
export function KontrollStep({ valg, sporsmal, onJa, onNei, failed }: KontrollStepProps) {
  const Ikon = bandIkon(valg)

  return (
    <section className="steg" aria-label="Bekreft funnet">
      <StepBar>
        <Button variant="subtle" icon={<BackIcon />} shortcut="Esc" onClick={onNei}>
          Endre konsentrasjon
        </Button>
      </StepBar>

      <Card className="kontrollkort">
        {/* Kvitteringen legges der merket står, og beviset i limsteget flyter
            opp fra den samme ruten — samme feste som knappene i steget foran. */}
        <p className={`valgmerke valgmerke--${valg.tone}`} data-band={valg.key}>
          <Ikon className="valgmerke__ikon" />
          {valg.label}
        </p>

        <h1 className="kontrollkort__sporsmal">{sporsmal}</h1>

        <ul className="band kontrollkort__svar">
          {[
            { merke: 'Ja', onClick: onJa },
            { merke: 'Nei', onClick: onNei },
          ].map((svar, i) => (
            <li key={svar.merke}>
              <button
                type="button"
                className="bandknapp bandknapp--noytral"
                onClick={svar.onClick}
                aria-keyshortcuts={indexToDigit(i)}
              >
                <span className="bandknapp__verdi">{svar.merke}</span>
                {/* Steget er to knapper og ingenting annet; da er tastene den
                    raskeste veien gjennom det og skal alltid stå. */}
                <Shortcut always>{indexToDigit(i)}</Shortcut>
              </button>
            </li>
          ))}
        </ul>
      </Card>

      {failed && <ManualCopy message={failed.message} comment={failed.comment} />}
    </section>
  )
}
