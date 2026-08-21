import { Button } from './Button'
import { Card } from './Card'
import { Kopibevis } from './Kopibevis'
import { ManualCopy } from './ManualCopy'
import { StepBar } from './StepBar'
import { useTips } from './Tips'
import { BackIcon, CheckIcon, CopyIcon, PasteIcon } from './icons'
import type { EtgAlternativ } from '../domain/etg'
import type { Kommentarplassering } from '../domain/kommentar'
import type { Rute } from '../domain/flytting'
import { useKommentarflyt } from '../hooks/useKommentarflyt'

const KOPIFEIL = 'Fikk ikke tilgang til utklippstavlen. Kopier teksten manuelt.'

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
 * Bygd som limsteget for psykofarmaka — knappen som ble brukt står øverst som
 * bevis på hva som ligger på utklippstavlen, og under den koden kommentaren
 * skal limes inn på, i store bokstaver. Er begge omdannelsesproduktene påvist,
 * hører det to kommentarer til valget: hovedkommentaren er alt kopiert idet
 * knappen ble trykket, og `Enter` tar tilleggskommentaren og deretter
 * avslutningen ({@link useKommentarflyt}).
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

  const flyt = useKommentarflyt({
    plasseringer,
    // Den første kommentaren ble kopiert i det knappen ble trykket, og er
    // ferdig før dette bildet vises.
    alleredeKopiert: forste ? [forste.merke] : [],
    copy,
    flashAt,
    onFinish,
  })

  return (
    <section className="steg steg--etg-paste" aria-label="Lim inn kommentarene">
      <StepBar>
        <Button variant="subtle" icon={<BackIcon />} shortcut="Esc" onClick={onBack}>
          Endre valg
        </Button>
      </StepBar>

      {/* Beviset og kortene det hører til, tettere sammen enn stegets egen
          luft, så de leses som én ting: dette valget, hit. Er det to
          kommentarer, strammes kortene inn så begge får plass i bildet. */}
      <div className={`limstabel${plasseringer.length > 1 ? ' limstabel--flere' : ''}`}>
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

        {plasseringer.map((plassering) => (
          <LimInn
            key={plassering.merke}
            plassering={plassering}
            // Er det bare én kommentar, er det ingenting å skille den fra, og
            // merkelappen sier ikke mer enn beviset over den alt gjør.
            visMerke={plasseringer.length > 1}
            kopiert={flyt.erKopiert(plassering)}
            staarForTur={flyt.neste === plassering}
            onCopy={() => flyt.kopier(plassering)}
          />
        ))}
      </div>

      {flyt.alleKopiert && (
        <div className="handling">
          <Button ref={flyt.ferdigKnapp} shortcut="Enter" onClick={onFinish}>
            Ferdig
          </Button>
        </div>
      )}

      {flyt.feilKopi && <ManualCopy message={KOPIFEIL} comment={flyt.feilKopi} />}
    </section>
  )
}

/**
 * Én kommentar, og koden den skal limes inn på.
 *
 * Koden er det eneste her brukeren må lese av og handle på, og står derfor
 * størst. Kommentarteksten står under: er det to kommentarer i bildet, må det
 * gå fram hvilken som hører til hvilken kode.
 */
function LimInn({
  plassering,
  visMerke,
  kopiert,
  staarForTur,
  onCopy,
}: {
  plassering: Kommentarplassering
  visMerke: boolean
  kopiert: boolean
  staarForTur: boolean
  onCopy: () => void
}) {
  const tips = useTips(plassering.tekst)

  return (
    <Card className={`limInn limInn--${plassering.rolle}`}>
      {visMerke && <p className="plassering__merke">{plassering.merke}</p>}

      <p className="limInn__instruks">
        <PasteIcon className="limInn__ikon" />
        Lim inn kommentaren på
      </p>
      <p className="limInn__kode">{plassering.koder.join(' ')}</p>
      <p className="thc-kommentar">{plassering.tekst}</p>

      {/* Merket er det flyten finner kopiknappen igjen på. Se `useKommentarflyt`. */}
      <div className="plassering__handling" data-kommentar={plassering.merke}>
        {kopiert && (
          <p className="kopiert">
            <CheckIcon className="kopiert__ikon" />
            Kopiert
          </p>
        )}
        <Button
          {...tips.props}
          aria-label={`Kopier ${plassering.merke.toLowerCase()}`}
          variant={staarForTur ? 'primary' : 'subtle'}
          icon={<CopyIcon />}
          shortcut={staarForTur ? '↵' : undefined}
          onClick={() => onCopy()}
        >
          Kopier
        </Button>
        {tips.forklaring}
      </div>
    </Card>
  )
}
