import { createContext, useContext, useMemo, type ReactNode } from 'react'
import type { Nummerering, Referanse } from '../../faginnhold/referanser'

/**
 * Referansene på én informasjonsside: numrene og selve referansene.
 *
 * Numrene regnes ut én gang for hele siden (`sidereferanser` i
 * `src/faginnhold/referanser.ts`) og deles med alle pillene gjennom denne
 * konteksten, så en sitering dypt inne i en tekst ikke må få dem sendt ned.
 */
export interface Referansekilde {
  nummerering: Nummerering
  referanser: ReadonlyMap<string, Referanse>
}

const Kontekst = createContext<Referansekilde>({ nummerering: new Map(), referanser: new Map() })

export function Sidereferanser({
  nummerering,
  referanser,
  children,
}: {
  nummerering: Nummerering
  referanser: readonly Referanse[]
  children: ReactNode
}) {
  const verdi = useMemo(
    () => ({ nummerering, referanser: new Map(referanser.map((r) => [r.id, r])) }),
    [nummerering, referanser],
  )
  return <Kontekst.Provider value={verdi}>{children}</Kontekst.Provider>
}

export function useSidereferanser(): Referansekilde {
  return useContext(Kontekst)
}
