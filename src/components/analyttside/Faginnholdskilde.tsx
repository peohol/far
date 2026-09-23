import { createContext, useContext, type ReactNode } from 'react'
import type { Faginnholdslager } from '../../faginnhold/lagring'
import type { Faginnholdsleser } from '../../faginnhold/lesing'

/**
 * Hvor informasjonssidene henter og lagrer faginnholdet, og om den innloggede
 * får redigere.
 *
 * Appen setter den opp én gang med Supabase-klienten og rollen i profilen;
 * testene setter den opp med en database i minnet eller en enkel erstatning.
 * `kanRedigere` styrer bare hva som vises — rettighetene håndheves av
 * databasen, som avviser endringer fra alle som ikke er administratorer.
 */
export interface Faginnholdskilde {
  leser: Faginnholdsleser
  lager: Faginnholdslager
  kanRedigere: boolean
}

const Kontekst = createContext<Faginnholdskilde | null>(null)

export function FaginnholdskildeProvider({
  kilde,
  children,
}: {
  kilde: Faginnholdskilde
  children: ReactNode
}) {
  return <Kontekst.Provider value={kilde}>{children}</Kontekst.Provider>
}

export function useFaginnholdskilde(): Faginnholdskilde {
  const kilde = useContext(Kontekst)
  if (!kilde) throw new Error('useFaginnholdskilde må stå innenfor <FaginnholdskildeProvider>')
  return kilde
}
