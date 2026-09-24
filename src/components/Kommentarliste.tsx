import { Button } from './Button'
import { ManualCopy } from './ManualCopy'
import { useTips } from './Tips'
import { Ikon } from './ikon/Ikon'
import type { Kommentarplassering } from '../domain/kommentar'
import { useKommentarflyt } from '../hooks/useKommentarflyt'

export interface KommentarlisteProps {
  /** Kommentarene fortolkningen ga, i den rekkefølgen de skal limes inn. */
  plasseringer: Kommentarplassering[]
  /** Teller opp for hver endring i skjemaet over. Se `useKommentarflyt`. */
  utgave?: number
  /** Merkene på kommentarene som alt ligger på utklippstavlen. Se `useKommentarflyt`. */
  alleredeKopiert?: string[]
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
 * Felles for rusmiddelmodulen, der svaret kan endres mens man står i det, og
 * limsteget i EtG- og EtS-modulen, der den første kommentaren alt er kopiert.
 * Selve kopieringen ligger i {@link useKommentarflyt}. Hver blokk er Atlas
 * `CommentPlacement`: koden stort, teksten under, og kopiknappen til høyre —
 * primær og med Enter-merket på den som står for tur.
 */
export function Kommentarliste({
  plasseringer,
  utgave,
  alleredeKopiert,
  visTekst,
  copy,
  flashAt,
  onFinish,
}: KommentarlisteProps) {
  const flyt = useKommentarflyt({ plasseringer, utgave, alleredeKopiert, copy, flashAt, onFinish })

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
        <div className="handlingsrad">
          <Button ref={flyt.ferdigKnapp} icon={<Ikon navn="done" />} shortcut="↵" onClick={onFinish}>
            Ferdig
          </Button>
        </div>
      )}

      {flyt.feilKopi && <ManualCopy comment={flyt.feilKopi} />}
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
  // Står teksten skrevet ut, ville et tips på knappen bare gjenta den.
  const tips = useTips(plassering.tekst)
  const medTips = !visTekst

  return (
    // Merket er det flyten finner kopiknappen igjen på. Se `useKommentarflyt`.
    <li
      className={`plassering plassering--${plassering.rolle}`}
      data-kommentar={plassering.merke}
      data-for-tur={staarForTur ? '' : undefined}
    >
      <div className="plassering__innhold">
        {visMerke && <p className="plassering__merke">{plassering.merke}</p>}

        <p className="plassering__sted">
          <span className="plassering__instruks">
            <Ikon navn="paste" className="plassering__ikon" />
            Lim inn på
          </span>
          <span className="plassering__koder">
            {plassering.koder.map((kode) => (
              <span key={kode}>{kode}</span>
            ))}
          </span>
        </p>

        {visTekst && <p className="kommentartekst">{plassering.tekst}</p>}
      </div>

      <div className="plassering__handling">
        <Button
          {...(medTips && tips.props)}
          // Knappene heter det samme; merket sier hvilken kommentar det er.
          aria-label={`Kopier ${plassering.merke.toLowerCase()}`}
          variant={staarForTur ? 'primary' : 'kant'}
          icon={<Ikon navn="copy" />}
          shortcut={staarForTur ? '↵' : undefined}
          onClick={() => onCopy()}
        >
          Kopier
        </Button>
        {medTips && tips.forklaring}
        {kopiert && (
          <p className="kopiert">
            <Ikon navn="bInnenfor" className="kopiert__ikon" />
            Kopiert
          </p>
        )}
      </div>
    </li>
  )
}
