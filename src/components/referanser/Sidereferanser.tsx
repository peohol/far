import { createContext, useContext, useMemo, type ReactNode } from 'react'
import type { Nummerering, Referanse } from '../../faginnhold/referanser'

/**
 * Referansene på én stoffside: numrene, selve referansene og hva hvert
 * panels referansefelt viser — redaksjonelle og automatiske sammen.
 *
 * Numrene regnes ut én gang for hele siden (`referanseunivers` i
 * `src/faginnhold/stoffside.ts`) og deles med alle pillene gjennom denne
 * konteksten, så en sitering dypt inne i en tekst ikke må få dem sendt ned.
 */
export interface Referansekilde {
  nummerering: Nummerering
  referanser: ReadonlyMap<string, Referanse>
  /** Panelnøkkel → referansene i panelets referansefelt. */
  panelreferanser: Readonly<Record<string, readonly string[]>>
}

const Kontekst = createContext<Referansekilde>({ nummerering: new Map(), referanser: new Map(), panelreferanser: {} })

const INGEN: Readonly<Record<string, readonly string[]>> = {}

export function Sidereferanser({
  nummerering,
  referanser,
  panelreferanser = INGEN,
  children,
}: {
  nummerering: Nummerering
  referanser: readonly Referanse[]
  panelreferanser?: Readonly<Record<string, readonly string[]>>
  children: ReactNode
}) {
  const verdi = useMemo(
    () => ({ nummerering, referanser: new Map(referanser.map((r) => [r.id, r])), panelreferanser }),
    [nummerering, referanser, panelreferanser],
  )
  return <Kontekst.Provider value={verdi}>{children}</Kontekst.Provider>
}

export function useSidereferanser(): Referansekilde {
  return useContext(Kontekst)
}
