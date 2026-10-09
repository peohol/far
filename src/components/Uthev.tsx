import { createContext, useContext, type ReactNode } from 'react'
import { treffIntervaller } from '../faginnhold/sok'

/**
 * Fremhevingen av søketreff på stoffsiden.
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

/**
 * Teksten, med søketreffene fremhevet. `brudd` gir posisjonene i teksten der
 * linjen kan brytes (`<wbr>`); treffene finnes i teksten som den er, så et
 * søk på det som står, alltid gir et merke.
 */
export function Uthev({ tekst, brudd }: { tekst: string; brudd?: (tekst: string) => readonly number[] }) {
  const ord = useContext(Sokeord)
  const treff = treffIntervaller(tekst, ord)
  const bruddsteder = brudd?.(tekst) ?? []
  if (treff.length === 0 && bruddsteder.length === 0) return <>{tekst}</>

  /** Tekstbiten fra `fra` til `til`, med brytepunktene som faller inni den. */
  const bit = (fra: number, til: number): ReactNode[] => {
    const deler: ReactNode[] = []
    let forrige = fra
    for (const sted of bruddsteder) {
      if (sted <= fra || sted >= til) continue
      deler.push(tekst.slice(forrige, sted), <wbr key={`b${sted}`} />)
      forrige = sted
    }
    deler.push(tekst.slice(forrige, til))
    return deler
  }

  const deler: ReactNode[] = []
  let forrige = 0
  for (const [start, slutt] of treff) {
    if (start > forrige) deler.push(...bit(forrige, start))
    deler.push(
      <mark key={start} className={TREFFKLASSE}>
        {bit(start, slutt)}
      </mark>,
    )
    forrige = slutt
  }
  if (forrige < tekst.length) deler.push(...bit(forrige, tekst.length))
  return <>{deler}</>
}
