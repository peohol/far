import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const LAGRINGSNOEKKEL = 'far:hurtigtaster'

interface ShortcutVisibility {
  /** Om hurtigtastmerkene vises. Selve tastene virker uansett. */
  visible: boolean
  toggle: () => void
}

const Context = createContext<ShortcutVisibility>({ visible: false, toggle: () => {} })

function initial(): boolean {
  try {
    return localStorage.getItem(LAGRINGSNOEKKEL) === 'vis'
  } catch {
    return false
  }
}

/**
 * Styrer om hurtigtastmerkene vises i UI-et. Av som standard — den som kan
 * appen trenger dem ikke, og de stjeler oppmerksomhet.
 *
 * Gjelder bare de faste snarveiene. Tallene på søkealternativene står alltid,
 * siden de endrer seg fra søk til søk og ikke er noe man kan lære seg.
 */
export function ShortcutVisibilityProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(initial)

  useEffect(() => {
    try {
      localStorage.setItem(LAGRINGSNOEKKEL, visible ? 'vis' : 'skjul')
    } catch {
      // Privat nettlesermodus e.l. — valget gjelder fortsatt for økten.
    }
  }, [visible])

  const toggle = useCallback(() => setVisible((v) => !v), [])
  const verdi = useMemo(() => ({ visible, toggle }), [visible, toggle])

  return <Context.Provider value={verdi}>{children}</Context.Provider>
}

export function useShortcutVisibility(): ShortcutVisibility {
  return useContext(Context)
}
