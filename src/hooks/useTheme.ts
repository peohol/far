import { useCallback, useEffect, useState } from 'react'

export type Theme = 'lyst' | 'moerkt'

const LAGRINGSNOEKKEL = 'far:tema'

/** Nøkkelen temaet lagres under i brukerinnstillingene. Se `useKontotema`. */
export const TEMANOKKEL = 'tema'

/** Et lagret tema, eller `null` når verdien mangler eller er ugyldig. */
export function lesTema(verdi: unknown): Theme | null {
  return verdi === 'lyst' || verdi === 'moerkt' ? verdi : null
}

export function motsattTema(theme: Theme): Theme {
  return theme === 'lyst' ? 'moerkt' : 'lyst'
}

function initialTheme(): Theme {
  return document.documentElement.dataset.tema === 'lyst' ? 'lyst' : 'moerkt'
}

/**
 * Lyst eller mørkt tema. Mørkt er standard; har brukeren valgt selv, gjelder
 * det valget. Startverdien settes av et lite skript i index.html, slik at
 * siden aldri blinker i feil tema før React har rukket å montere. Valget
 * huskes i nettleseren; inne i appen følger det også kontoen (`useKontotema`).
 */
export function useTheme() {
  const [theme, velg] = useState<Theme>(initialTheme)

  useEffect(() => {
    document.documentElement.dataset.tema = theme
    try {
      localStorage.setItem(LAGRINGSNOEKKEL, theme)
    } catch {
      // Privat nettlesermodus e.l. — temaet gjelder fortsatt for økten.
    }
  }, [theme])

  const toggle = useCallback(() => velg(motsattTema), [])

  return { theme, toggle, velg }
}
