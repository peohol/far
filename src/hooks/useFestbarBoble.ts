import { useCallback, useEffect, useRef, useState, type FocusEvent, type KeyboardEvent, type PointerEvent } from 'react'

/**
 * Hvor lenge boblen blir stående etter at pekeren har forlatt knappen, så den
 * rekker å flytte seg over luften og inn i boblen.
 */
export const LUKKETID = 150

/**
 * En knapp med en boble som åpnes ved peker over, og ved klikk, trykk, Enter
 * eller mellomrom, som referansepillene og konsentrasjonene i teksten. Et
 * klikk fester boblen, så det som står i den kan nås; et nytt klikk, Escape,
 * et trykk utenfor eller fokus som går videre, lukker den. Boblen skal stå i
 * festet, rett etter knappen, så tastaturet og skjermlesere når den i vanlig
 * rekkefølge.
 *
 * `feste` spres på elementet rundt knappen og boblen, `knapp` på knappen.
 */
export function useFestbarBoble<F extends HTMLElement = HTMLSpanElement>() {
  const feste = useRef<F>(null)
  const knapp = useRef<HTMLButtonElement>(null)
  const [peker, setPeker] = useState(false)
  const [festet, setFestet] = useState(false)
  const lukking = useRef<ReturnType<typeof setTimeout>>()
  const apen = peker || festet

  const avbrytLukking = () => clearTimeout(lukking.current)
  useEffect(() => avbrytLukking, [])

  const lukk = useCallback(() => {
    clearTimeout(lukking.current)
    setPeker(false)
    setFestet(false)
  }, [])

  // Et trykk utenfor lukker. På berøring kommer det ingen «pekeren forlot».
  useEffect(() => {
    if (!apen) return
    const paaTrykk = (event: Event) => {
      if (event.target instanceof Node && feste.current?.contains(event.target)) return
      lukk()
    }
    document.addEventListener('pointerdown', paaTrykk, true)
    return () => document.removeEventListener('pointerdown', paaTrykk, true)
  }, [apen, lukk])

  return {
    apen,
    feste: {
      ref: feste,
      // Berøring åpner med trykket, ikke med «pekeren kom»: ellers ville
      // trykket åpnet og lukket boblen i samme bevegelse.
      onPointerEnter: (event: PointerEvent) => {
        if (event.pointerType === 'touch') return
        avbrytLukking()
        setPeker(true)
      },
      onPointerLeave: (event: PointerEvent) => {
        if (event.pointerType === 'touch') return
        avbrytLukking()
        lukking.current = setTimeout(() => setPeker(false), LUKKETID)
      },
      onBlur: (event: FocusEvent) => {
        const neste = event.relatedTarget
        if (neste instanceof Node && feste.current?.contains(neste)) return
        setFestet(false)
      },
      onKeyDown: (event: KeyboardEvent) => {
        if (event.key !== 'Escape' || !apen) return
        event.stopPropagation()
        lukk()
        knapp.current?.focus()
      },
    },
    knapp: {
      ref: knapp,
      'aria-expanded': apen,
      onClick: () => {
        if (festet) lukk()
        else setFestet(true)
      },
    },
  }
}
