import { useMemo, useState } from 'react'
import { fortolkThc, tomThcInndata, type ThcModell } from '../../domain/thcMotor'
import { THC_TEKSTBOLKER } from '../../domain/thcTekster'
import { Button } from '../Button'
import { ThcKommentar, ThcKurvebilde } from '../ThcUtfall'
import { ThcSkjema } from '../ThcSkjema'
import { Detaljkort } from '../seksjoner/Seksjon'

/**
 * Fortolkningsmodulen i det små: det samme skjemaet og den samme kommentaren,
 * med reglene som vises over, og hvilke tekstbolker kommentaren ble satt
 * sammen av. Det er ingenting å kopiere.
 */
export function Thcsimulator({ modell }: { modell: ThcModell }) {
  const { regler } = modell
  const [inndata, setInndata] = useState(() => tomThcInndata(regler))
  const resultat = useMemo(() => fortolkThc(inndata, modell), [inndata, modell])

  return (
    <Detaljkort
      id="simulator"
      tittel="Prøv reglene"
      oppsummering="Fyll inn en prøve"
      handlinger={
        <Button variant="subtle" className="redigeringsknapp" onClick={() => setInndata(tomThcInndata(regler))}>
          Nullstill
        </Button>
      }
      className="simulator"
    >
      <p className="regler__ingress">Fyll inn slik som i fortolkningen. Kommentaren regnes ut med reglene over.</p>
      <ThcSkjema
        inndata={inndata}
        regler={regler}
        onEndre={(felt, verdi) => setInndata((forrige) => ({ ...forrige, [felt]: verdi }))}
      />
      <div className="simulator__resultat">
        {resultat.type === 'kommentar' && (
          <p className="simulator__scenario" role="status">
            Tekstbolker: {resultat.bolker.map((nokkel) => THC_TEKSTBOLKER[nokkel].tittel).join(', ')}.
          </p>
        )}
        <ThcKommentar
          resultat={resultat}
          regler={regler}
          onIngenTidligere={() => setInndata((forrige) => ({ ...forrige, ingenTidligere: true }))}
        />
        <ThcKurvebilde resultat={resultat} regler={regler} />
      </div>
    </Detaljkort>
  )
}
