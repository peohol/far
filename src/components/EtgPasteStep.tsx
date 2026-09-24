import { Card } from './Card'
import { Kommentarliste } from './Kommentarliste'
import { Kopibevis } from './Kopibevis'
import { Panelhode } from './Panelhode'
import { StepBar } from './StepBar'
import type { EtgAlternativ } from '../domain/etg'
import type { Rute } from '../domain/flytting'

export interface EtgPasteStepProps {
  alternativ: EtgAlternativ
  /** Ruten knappen sto i — beviset flyter opp fra den. Se {@link Kopibevis}. */
  fra: Rute | null
  onBack: () => void
  onFinish: () => void
  copy: (text: string) => Promise<boolean>
  flashAt: (element: Element | null | undefined) => void
}

/**
 * Limsteget i EtG- og EtS-modulen: hvor kommentarene skal.
 *
 * Knappen som ble brukt står øverst som bevis på hva som ligger på
 * utklippstavlen, som i limsteget for psykofarmaka. Under den står
 * kommentarene i panelet «Kommentarer», med koden hver skal limes inn på og
 * teksten skrevet ut: er begge omdannelsesproduktene påvist, hører det to
 * kommentarer til valget, og det må gå fram hvilken som hører til hvilken
 * kode. Hovedkommentaren er alt kopiert idet knappen ble trykket, og `Enter`
 * tar tilleggskommentaren og deretter avslutningen ({@link Kommentarliste}).
 */
export function EtgPasteStep({
  alternativ,
  fra,
  onBack,
  onFinish,
  copy,
  flashAt,
}: EtgPasteStepProps) {
  const plasseringer = alternativ.plasseringer
  const forste = plasseringer[0]

  return (
    <section className="steg steg--etg-paste" aria-label="Lim inn kommentarene">
      <StepBar onEsc={onBack}>Endre valg</StepBar>

      {/* Beviset og panelet det hører til, tettere sammen enn stegets egen
          luft, så de leses som én ting: dette valget, hit. */}
      <div className="limstabel">
        {forste && (
          <Kopibevis
            // Tilfellene er ikke konsentrasjonsnivåer, og skal ikke låne
            // nivåfargene: her ville en farge sagt noe klinisk som ikke er ment.
            tone="noytral"
            tekst={alternativ.merke}
            kommentar={forste.tekst}
            fra={fra}
          />
        )}

        <Card align="start">
          <Panelhode>{plasseringer.length > 1 ? 'Kommentarer' : 'Kommentar'}</Panelhode>
          <Kommentarliste
            plasseringer={plasseringer}
            // Den første kommentaren ble kopiert i det knappen ble trykket, og
            // er ferdig før dette bildet vises.
            alleredeKopiert={forste ? [forste.merke] : []}
            visTekst
            copy={copy}
            flashAt={flashAt}
            onFinish={onFinish}
          />
        </Card>
      </div>
    </section>
  )
}
