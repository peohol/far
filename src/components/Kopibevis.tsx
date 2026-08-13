import { useCallback, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { bandIkon } from './bandikon'
import { useTips } from './Tips'
import { flyttingMellom, type Flytting, type Rute } from '../domain/flytting'
import type { Band } from '../domain/bands'

export interface KopibevisProps {
  band: Band
  /**
   * Ruten båndknappen sto i da kommentaren ble kopiert. Uten den — kommer man
   * hit uten å ha gått gjennom knappen — står beviset ferdig landet med én gang.
   */
  fra: Rute | null
}

/** Ruten et element dekker i vinduet, slik flyttingen vil ha den. */
export function ruteAv(element: Element | null | undefined): Rute | null {
  if (!element) return null
  const rute = element.getBoundingClientRect()
  return { venstre: rute.left, topp: rute.top, bredde: rute.width, hoyde: rute.height }
}

/**
 * Båndknappen som ble brukt, landet over lim-inn-kortet.
 *
 * Kvitteringen for kopieringen sier at noe ble kopiert, men ikke hva. Beviset
 * svarer på det: knappen flyter opp fra plassen sin i båndsteget og blir
 * stående over kortet i samme farge, med samme ikon og samme tall — og bærer
 * fortsatt kommentarteksten som en tooltip, så den kan leses en siste gang før
 * den limes inn.
 *
 * Hurtigtastmerket blir igjen i båndsteget. Tasten valgte båndet; når
 * kommentaren alt ligger på utklippstavlen, har den ingen jobb igjen å gjøre.
 *
 * Flukten er målt, ikke gjettet: beviset tegnes der det skal ende, måles, og
 * settes tilbake dit knappen sto — før første opptegning, så det aldri blinker
 * til på plassen sin først. Se `src/domain/flytting.ts`.
 */
export function Kopibevis({ band, fra }: KopibevisProps) {
  const element = useRef<HTMLElement | null>(null)
  const [flytting, setFlytting] = useState<Flytting | null>(null)
  const tips = useTips(band.kommentar)
  const Ikon = bandIkon(band)

  const { ref: festTips, ...tipsprops } = tips.props
  const fest = useCallback(
    (node: HTMLParagraphElement | null) => {
      element.current = node
      festTips(node)
    },
    [festTips],
  )

  useLayoutEffect(() => {
    const til = ruteAv(element.current)
    if (!fra || !til) return
    setFlytting(flyttingMellom(fra, til))
  }, [fra])

  return (
    <>
      <p
        ref={fest}
        className={['kopibevis', `kopibevis--${band.tone}`, flytting && 'kopibevis--flyter']
          .filter(Boolean)
          .join(' ')}
        style={
          flytting
            ? ({
                '--flyt-x': `${flytting.x}px`,
                '--flyt-y': `${flytting.y}px`,
                '--flyt-skala': `${flytting.skala}`,
              } as CSSProperties)
            : undefined
        }
        tabIndex={0}
        {...tipsprops}
      >
        <Ikon className="kopibevis__ikon" />
        {/* Fargen, ikonet og plassen over kortet sier hva tallene er til den
            som ser dem. Denne teksten sier det samme til den som ikke gjør det. */}
        <span className="kun-skjermleser">Kopiert kommentar for </span>
        <span className="kopibevis__verdi">{band.label}</span>
      </p>
      {tips.forklaring}
    </>
  )
}
