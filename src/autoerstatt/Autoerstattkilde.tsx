import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Autoerstattlager } from './lagring'
import type { Autoerstattregel } from './regler'

/**
 * Autoerstatt-reglene for hele appen, hentet én gang når brukeren logger inn
 * og på nytt når fanen blir synlig igjen, så endringer en administrator har
 * gjort, kommer med. Editorene og tekstfeltene leser reglene herfra; uten
 * kilden (som i testene) byttes ingenting ut.
 */
export interface Autoerstatt {
  regler: readonly Autoerstattregel[]
  lager: Autoerstattlager
  /** Henter reglene på nytt, etter en endring. */
  hent: () => Promise<void>
}

const Kontekst = createContext<Autoerstatt | null>(null)

const INGEN: readonly Autoerstattregel[] = []

export function AutoerstattProvider({
  lager,
  brukerId,
  children,
}: {
  lager: Autoerstattlager
  /** Den innloggede. Reglene hentes på nytt når den byttes. */
  brukerId: string
  children: ReactNode
}) {
  const [regler, setRegler] = useState<readonly Autoerstattregel[]>(INGEN)
  /** Økes for hver henting; bare svaret på den siste brukes. */
  const hentinger = useRef(0)

  const hent = useCallback(async () => {
    const bestilt = ++hentinger.current
    try {
      const nye = await lager.hent()
      if (bestilt === hentinger.current) setRegler(nye)
    } catch {
      // Uten svar beholdes reglene som er hentet. Å skrive går like godt uten.
    }
  }, [lager])

  useEffect(() => {
    void hent()
    const naarSynlig = () => {
      if (document.visibilityState === 'visible') void hent()
    }
    document.addEventListener('visibilitychange', naarSynlig)
    return () => document.removeEventListener('visibilitychange', naarSynlig)
  }, [brukerId, hent])

  const verdi = useMemo<Autoerstatt>(() => ({ regler, lager, hent }), [regler, lager, hent])
  return <Kontekst.Provider value={verdi}>{children}</Kontekst.Provider>
}

/** Kilden, eller `null` utenfor en {@link AutoerstattProvider}. */
export function useAutoerstatt(): Autoerstatt | null {
  return useContext(Kontekst)
}

/**
 * Reglene, som en funksjon som alltid gir de siste. Editoren lages én gang,
 * men skal bruke regler som kommer eller endres etterpå.
 */
export function useAutoerstattregler(): () => readonly Autoerstattregel[] {
  const regler = useContext(Kontekst)?.regler ?? INGEN
  const siste = useRef(regler)
  siste.current = regler
  return useCallback(() => siste.current, [])
}
