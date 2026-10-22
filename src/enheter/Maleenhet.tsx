import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useKontosynk } from '../hooks/useKontovalg'
import { useHusketValg } from '../hooks/useSystemvalg'
import { lesVisningsenhet, STANDARDENHET, type Visningsenhet } from './konsentrasjon'

/**
 * Preferansen «Måleenhet»: enheten konsentrasjonene vises i, både i
 * fagtekstene og i «Analyse ved norske laboratorier». Ett valg for hele appen,
 * husket i nettleseren og lagret på kontoen, så det følger brukeren.
 */
export interface Maleenhetstyring {
  enhet: Visningsenhet
  velg: (enhet: Visningsenhet) => void
}

/** Nøkkelen i nettleserens minne og i brukerinnstillingene. */
export const MALEENHET = { lagring: 'far:maleenhet', konto: 'maleenhet' } as const

const Kontekst = createContext<Maleenhetstyring | null>(null)

/** Står rundt appen når noen er logget inn. */
export function MaleenhetKilde({ brukerId, children }: { brukerId: string; children: ReactNode }) {
  const [enhet, settEnhet] = useHusketValg(MALEENHET.lagring, lesVisningsenhet, STANDARDENHET)
  const velg = useKontosynk(MALEENHET.konto, lesVisningsenhet, enhet, settEnhet, brukerId)
  const styring = useMemo(() => ({ enhet, velg }), [enhet, velg])
  return <Kontekst.Provider value={styring}>{children}</Kontekst.Provider>
}

/**
 * Måleenheten brukeren har valgt. Uten `MaleenhetKilde` rundt seg (som når en
 * del av appen vises for seg) huskes valget bare i nettleseren.
 */
export function useMaleenhet(): Maleenhetstyring {
  const kilde = useContext(Kontekst)
  const [enhet, velg] = useHusketValg(MALEENHET.lagring, lesVisningsenhet, STANDARDENHET)
  return kilde ?? { enhet, velg }
}
