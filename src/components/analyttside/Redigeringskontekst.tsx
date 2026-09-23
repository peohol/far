import { createContext, useContext, type ReactNode } from 'react'
import type { Utgave } from '../../faginnhold/lesing'
import type { Referanseinnhold } from '../../faginnhold/modell'
import type { Referanse } from '../../faginnhold/referanser'

/**
 * Det redigeringen på en informasjonsside deler: referansebasen det kan
 * velges kilder fra, veien til å legge inn en ny referanse, og
 * gjenopprettingen av en tidligere revisjon fra historikken.
 *
 * Settes opp av siden i redigeringsmodus, slik at editorene dypt inne i et
 * panel ikke må få den sendt ned.
 */
export interface Redigeringsverdi {
  /** Alle referansene i utkastet, arkiverte medregnet. */
  referansebase: readonly Referanse[]
  /** Legger inn en ny referanse i referansebasen og gir den tilbake. */
  opprettReferanse: (innhold: Referanseinnhold) => Promise<Referanse>
  /** Lager en ny revisjon av objektet med innholdet fra `fraRevisjon`. */
  gjenopprett: (utgave: Utgave<unknown>, fraRevisjon: number) => Promise<void>
}

const IKKE_TILGJENGELIG = () => Promise.reject(new Error('Redigering er ikke tilgjengelig her.'))

const Kontekst = createContext<Redigeringsverdi>({
  referansebase: [],
  opprettReferanse: IKKE_TILGJENGELIG,
  gjenopprett: IKKE_TILGJENGELIG,
})

export function Redigeringskilde({ verdi, children }: { verdi: Redigeringsverdi; children: ReactNode }) {
  return <Kontekst.Provider value={verdi}>{children}</Kontekst.Provider>
}

export function useRedigering(): Redigeringsverdi {
  return useContext(Kontekst)
}
