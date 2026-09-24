import { useCallback, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { flyttingMellom, type Flytting, type Rute } from '../domain/flytting'
import { Ikon } from './ikon/Ikon'
import type { Ikonnavn } from './ikon/register'
import { useTips } from './Tips'
import type { BandTone } from '../domain/bands'

/**
 * Fargetonen beviset bæres i — den samme som knappen det kom fra. `noytral` er
 * for knapper som ikke er et konsentrasjonsbånd og derfor ikke skal låne
 * nivåfargene: der ville fargen sagt noe klinisk som ikke er ment.
 */
export type Bevistone = BandTone | 'noytral'

export interface KopibevisProps {
  tone: Bevistone
  /** Ikonet knappen bar, der den hadde ett. */
  ikon?: Ikonnavn
  /** Teksten som sto på knappen. */
  tekst: string
  /** Kommentaren som ble kopiert. Henger på beviset som et tips. */
  kommentar: string
  /**
   * Ruten knappen sto i da kommentaren ble kopiert. Uten den — kommer man
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
 * Knappen som ble brukt, landet over lim-inn-kortet.
 *
 * Kvitteringen for kopieringen sier at noe ble kopiert, men ikke hva. Beviset
 * svarer på det: knappen flyter opp fra plassen sin i steget foran og blir
 * stående over kortet i samme farge, med samme ikon og samme tekst — og bærer
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
export function Kopibevis({ tone, ikon, tekst, kommentar, fra }: KopibevisProps) {
  const element = useRef<HTMLElement | null>(null)
  const [flytting, setFlytting] = useState<Flytting | null>(null)
  const tips = useTips(kommentar)

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
        className={['kopibevis', `kopibevis--${tone}`, flytting && 'kopibevis--flyter']
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
        {ikon && <Ikon navn={ikon} className="kopibevis__ikon" />}
        {/* Fargen, ikonet og plassen over kortet sier hva teksten er til den
            som ser dem. Dette sier det samme til den som ikke gjør det. */}
        <span className="kun-skjermleser">Kopiert kommentar for </span>
        <span className="kopibevis__verdi">{tekst}</span>
      </p>
      {tips.forklaring}
    </>
  )
}
