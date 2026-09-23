import { createContext, useContext, type ReactNode } from 'react'
import { treffIntervaller } from '../faginnhold/sok'

/**
 * Fremhevingen av søketreff på informasjonssiden.
 *
 * Ordene det søkes etter, deles med all tekst på siden gjennom denne
 * konteksten. Hver tekst som vises, går gjennom {@link Uthev}, som setter
 * treffene i `<mark>`. Søket på siden teller og blar mellom merkene; se
 * `Sidesok`.
 */
const Sokeord = createContext<readonly string[]>([])

export function Uthevingskilde({ ord, children }: { ord: readonly string[]; children: ReactNode }) {
  return <Sokeord.Provider value={ord}>{children}</Sokeord.Provider>
}

/** Ordene det søkes etter på siden, slik de sammenlignes. Tom når det ikke søkes. */
export function useSokeord(): readonly string[] {
  return useContext(Sokeord)
}

/** Klassen hvert treff har. Søket finner treffene på den. */
export const TREFFKLASSE = 'sidetreff'

/** Teksten, med søketreffene fremhevet. */
export function Uthev({ tekst }: { tekst: string }) {
  const ord = useContext(Sokeord)
  const treff = treffIntervaller(tekst, ord)
  if (treff.length === 0) return <>{tekst}</>

  const deler: ReactNode[] = []
  let forrige = 0
  for (const [start, slutt] of treff) {
    if (start > forrige) deler.push(tekst.slice(forrige, start))
    deler.push(
      <mark key={start} className={TREFFKLASSE}>
        {tekst.slice(start, slutt)}
      </mark>,
    )
    forrige = slutt
  }
  if (forrige < tekst.length) deler.push(tekst.slice(forrige))
  return <>{deler}</>
}
