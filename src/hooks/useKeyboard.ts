import { useEffect, useRef } from 'react'

export type KeyHandler = (event: KeyboardEvent) => void

/**
 * Kobler tastatursnarveier til vinduet.
 *
 * Nøkkelen i kartet er `event.key`. Handlingen kjøres bare når ingen
 * modifikatortast holdes nede, slik at nettleserens egne snarveier
 * (Ctrl/Cmd-kombinasjoner) går uforstyrret gjennom. `preventDefault` er opp
 * til den enkelte handlingen.
 *
 * Kartet leses fra en ref, så lytteren settes opp én gang og overlever at
 * handlingene bygges på nytt ved hver rendring.
 */
export function useKeyboard(handlers: Record<string, KeyHandler | undefined>, enabled = true) {
  const ref = useRef(handlers)
  ref.current = handlers

  useEffect(() => {
    if (!enabled) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey) return
      ref.current[event.key]?.(event)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [enabled])
}

/**
 * Tastene som velger et alternativ i søket: 1–9 for de ni første og 0 for det
 * tiende. Analyttnavn og -koder inneholder ingen sifre, så det er trygt å la
 * sifrene velge i stedet for å skrives inn i søkefeltet.
 */
export function digitToIndex(key: string): number | null {
  if (!/^[0-9]$/.test(key)) return null
  return key === '0' ? 9 : Number(key) - 1
}

export function indexToDigit(index: number): string {
  return index === 9 ? '0' : String(index + 1)
}
