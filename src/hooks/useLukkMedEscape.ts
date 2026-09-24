import { useEffect, useRef } from 'react'
import { lagLiggerOver, skrivesIFelt } from './useKeyboard'

/**
 * `Escape` lukker siden som står over fortolkningen — stoffsiden eller
 * søkesiden — men ikke fra et felt, et åpent redigeringsskjema eller et lag
 * over den. En annen lytter som alt har brukt tasten, går foran.
 */
export function useLukkMedEscape(onLukk: () => void) {
  const lukk = useRef(onLukk)
  lukk.current = onLukk
  useEffect(() => {
    const paaTast = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      if (event.ctrlKey || event.metaKey || event.altKey) return
      if (lagLiggerOver() || skrivesIFelt()) return
      if (document.querySelector('.analyttside .redigering')) return
      event.preventDefault()
      lukk.current()
    }
    window.addEventListener('keydown', paaTast)
    return () => window.removeEventListener('keydown', paaTast)
  }, [])
}
