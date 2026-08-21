import { Button } from './Button'
import { ManualCopy } from './ManualCopy'
import { useTips } from './Tips'
import { CheckIcon, CopyIcon, PasteIcon } from './icons'
import type { Kommentarplassering } from '../domain/kommentar'
import { useKommentarflyt } from '../hooks/useKommentarflyt'

const KOPIFEIL = 'Fikk ikke tilgang til utklippstavlen. Kopier teksten manuelt.'

export interface KommentarlisteProps {
  /** Kommentarene fortolkningen ga, i den rekkefølgen de skal limes inn. */
  plasseringer: Kommentarplassering[]
  /** Teller opp for hver endring i skjemaet over. Se `useKommentarflyt`. */
  utgave: number
  /**
   * Sant når kommentarteksten skal stå framme i blokka. Er det noe å velge
   * mellom, kan valget bli feil, og den som limer inn skal kunne lese hva som
   * faktisk havner på utklippstavlen. Ellers henger teksten på kopiknappen
   * som et tips.
   */
  visTekst: boolean
  copy: (text: string) => Promise<boolean>
  flashAt: (element: Element | null | undefined) => void
  onFinish: () => void
}

/**
 * Kommentarene en fortolkning ga, som en liste med én blokk hver.
 *
 * Bildet som hører til fortolkningsmoduler der svaret kan endres mens man
 * står i det — rusmiddelmodulen. Selve kopieringen ligger i
 * {@link useKommentarflyt} og er felles med limsteget i EtG- og EtS-modulen.
 */
export function Kommentarliste({
  plasseringer,
  utgave,
  visTekst,
  copy,
  flashAt,
  onFinish,
}: KommentarlisteProps) {
  const flyt = useKommentarflyt({ plasseringer, utgave, copy, flashAt, onFinish })

  return (
    <>
      {/* Kommentarene i den rekkefølgen de skal limes inn. Nummereringen fra
          <ol> vises ikke — merkelappen over hver kommentar sier hva den er —
          men den gir rekkefølgen mening for skjermlesere. */}
      <ol className="plasseringer">
        {plasseringer.map((plassering) => (
          <Kommentar
            key={plassering.merke}
            plassering={plassering}
            visTekst={visTekst}
            // Er det bare én kommentar, er det ingenting å skille den fra, og
            // merkelappen sier ikke mer enn korthodet alt gjør.
            visMerke={plasseringer.length > 1}
            kopiert={flyt.erKopiert(plassering)}
            staarForTur={flyt.neste === plassering}
            onCopy={() => flyt.kopier(plassering)}
          />
        ))}
      </ol>

      {flyt.alleKopiert && (
        <div className="thc-handling">
          <Button ref={flyt.ferdigKnapp} shortcut="↵" onClick={onFinish}>
            Ferdig
          </Button>
        </div>
      )}

      {flyt.feilKopi && <ManualCopy message={KOPIFEIL} comment={flyt.feilKopi} />}
    </>
  )
}

/**
 * Én kommentar med koden den skal limes inn på.
 *
 * Teksten henger alltid på kopiknappen som et tips, og står i tillegg framme
 * når fortolkningen avhenger av noe brukeren har svart: da skal den som limer
 * inn kunne lese hva som faktisk blir kopiert.
 */
function Kommentar({
  plassering,
  visTekst,
  visMerke,
  kopiert,
  staarForTur,
  onCopy,
}: {
  plassering: Kommentarplassering
  visTekst: boolean
  visMerke: boolean
  kopiert: boolean
  staarForTur: boolean
  onCopy: () => void
}) {
  const tips = useTips(plassering.tekst)

  return (
    // Merket er det flyten finner kopiknappen igjen på. Se `useKommentarflyt`.
    <li className={`plassering plassering--${plassering.rolle}`} data-kommentar={plassering.merke}>
      {visMerke && <p className="plassering__merke">{plassering.merke}</p>}

      <p className="plassering__instruks">
        <PasteIcon className="limInn__ikon" />
        Lim inn på
      </p>
      <p className="plassering__koder">
        {plassering.koder.map((kode) => (
          <span key={kode}>{kode}</span>
        ))}
      </p>

      {visTekst && <p className="thc-kommentar">{plassering.tekst}</p>}

      <div className="plassering__handling">
        {kopiert && (
          <p className="kopiert">
            <CheckIcon className="kopiert__ikon" />
            Kopiert
          </p>
        )}
        <Button
          {...tips.props}
          // Knappene heter det samme; merket sier hvilken kommentar det er.
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
    </li>
  )
}
