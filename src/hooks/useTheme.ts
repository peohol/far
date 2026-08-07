import { useCallback, useEffect, useState } from 'react'

export type Theme = 'lyst' | 'moerkt'

const LAGRINGSNOEKKEL = 'far:tema'

function initialTheme(): Theme {
  return document.documentElement.dataset.tema === 'lyst' ? 'lyst' : 'moerkt'
}

/**
 * Lyst eller mørkt tema. Mørkt er standard; har brukeren valgt selv, gjelder
 * det valget. Startverdien settes av et lite skript i index.html, slik at
 * siden aldri blinker i feil tema før React har rukket å montere.
 */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(initialTheme)

  useEffect(() => {
    document.documentElement.dataset.tema = theme
    try {
      localStorage.setItem(LAGRINGSNOEKKEL, theme)
    } catch {
      // Privat nettlesermodus e.l. — temaet gjelder fortsatt for økten.
    }
  }, [theme])

  const toggle = useCallback(() => {
    setTheme((n) => (n === 'lyst' ? 'moerkt' : 'lyst'))
  }, [])

  return { theme, toggle }
}
