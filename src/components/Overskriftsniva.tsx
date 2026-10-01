import { createContext, useContext, type ReactNode } from 'react'

/**
 * Nivået på den nærmeste overskriften over innholdet (1 for `h1`, 2 for `h2`
 * …), så overskrifter i innholdet kan legge seg under den. Uten noen rundt er
 * det sidens seksjonsnivå.
 */
const Kontekst = createContext(2)

/** Innhold som står under en overskrift på nivå `niva`. */
export function UnderOverskrift({ niva, children }: { niva: number; children: ReactNode }) {
  return <Kontekst.Provider value={niva}>{children}</Kontekst.Provider>
}

/** Nivået på den nærmeste overskriften over der komponenten står. */
export function useOverskriftsniva(): number {
  return useContext(Kontekst)
}
