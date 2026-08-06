import { useCallback, useEffect, useRef, useState } from 'react'

export interface Flash {
  /** Teller opp for hver kopiering, så animasjonen starter på nytt hver gang. */
  id: number
  /** Midt på knappen, i vindukoordinater. */
  x: number
  /** Overkanten av knappen, i vindukoordinater. */
  y: number
}

/**
 * Kvitteringen for at kommentaren er kopiert.
 *
 * Blinket festes til knappen som ble brukt, men lever utenfor steget: det
 * starter mens båndknappene fortsatt står, og fortsetter etter at limsteget
 * har overtatt, så bekreftelsen rekker å bli sett uten at arbeidsflyten
 * stopper opp. Derfor holdes posisjonen i vindukoordinater og ikke i
 * layouten til steget under.
 */
export function useCopyFlash(varighet: number) {
  const [flash, setFlash] = useState<Flash | null>(null)
  const teller = useRef(0)
  const timer = useRef<number>()

  const show = useCallback(
    (element: Element | null | undefined) => {
      if (!element) return
      const rute = element.getBoundingClientRect()
      teller.current += 1
      setFlash({ id: teller.current, x: rute.left + rute.width / 2, y: rute.top })
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setFlash(null), varighet)
    },
    [varighet],
  )

  useEffect(() => () => window.clearTimeout(timer.current), [])

  return { flash, show }
}
