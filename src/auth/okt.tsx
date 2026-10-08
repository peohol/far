/**
 * Økten appen kjører i: hvem som er logget inn, og profilen vedkommende har.
 *
 * Tilstanden ligger ett sted, slik at portvakten foran appen, verktøylinja og
 * kontopanelet aldri kan se ulike ting. Profilen hentes rett etter økten, og
 * `klar` slås ikke på før begge deler er avklart — ellers ville den kliniske
 * appen rukket å blinke fram for en som egentlig skal til oppsettet.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import type { Profil } from '@delt/profil'
import { tilgangFor, type Tilgang } from '../domain/tilgang'
import * as api from './api'
import { erKonfigurert, klient } from './klient'
import { tomMellomlageret } from './mellomlager'

interface Oktverdi {
  /** Hva som skal vises nå. Se `domain/tilgang.ts`. */
  tilgang: Tilgang
  profil: Profil | null
  /** Sant når appen ikke er koblet mot brukerdatabasen i det hele tatt. */
  mangler: boolean
  /** Henter profilen på nytt etter at oppslaget gikk galt. */
  forsokPaaNytt: () => void
  loggInn: (brukernavn: string, passord: string) => Promise<string | null>
  loggUt: () => Promise<void>
  /** Legger en nyskrevet profil til grunn uten å hente den på nytt. */
  settProfil: (profil: Profil) => void
  oppfriskProfil: () => Promise<void>
}

const Sammenheng = createContext<Oktverdi | null>(null)

export function OktProvider({ children }: { children: ReactNode }) {
  const mangler = !erKonfigurert()
  const [okt, setOkt] = useState<Session | null>(null)
  const [oktAvklart, setOktAvklart] = useState(mangler)
  const [profil, setProfil] = useState<Profil | null>(null)
  /** Brukeren profilen i tilstanden hører til. Holder de to i takt. */
  const [profilFor, setProfilFor] = useState<string | null>(null)
  const [profilfeil, setProfilfeil] = useState(false)
  /** Økes for å hente profilen på nytt etter en feil. */
  const [forsok, setForsok] = useState(0)

  const brukerId = okt?.user.id ?? null

  useEffect(() => {
    if (mangler) return
    const { data } = klient().auth.onAuthStateChange((hendelse, ny) => {
      // Det som er lagret i nettleseren, hører til den som var logget inn.
      if (hendelse === 'SIGNED_OUT') void tomMellomlageret()
      setOkt(ny)
    })

    void klient()
      .auth.getSession()
      .then(({ data: { session } }) => setOkt(session))
      .catch(() => setOkt(null))
      .finally(() => setOktAvklart(true))

    return () => data.subscription.unsubscribe()
  }, [mangler])

  useEffect(() => {
    if (brukerId === null) {
      setProfil(null)
      setProfilFor(null)
      setProfilfeil(false)
      return
    }
    let gjelder = true

    void (async () => {
      try {
        const hentet = await api.hentProfil(brukerId)
        if (!gjelder) return
        if (!hentet) {
          // Økten står, men raden er borte: kontoen er fjernet mens fanen sto
          // åpen. Da hører brukeren hjemme på innloggingssiden.
          await api.loggUt()
          return
        }
        setProfil(hentet)
        setProfilfeil(false)
        setProfilFor(brukerId)
      } catch {
        if (!gjelder) return
        // Nettet eller tjenesten svarte ikke. Uten dette ville brukeren blitt
        // stående på en tom skjerm til noen lastet siden på nytt: økten er
        // avklart, og oppslaget prøves ikke om igjen av seg selv.
        setProfil(null)
        setProfilfeil(true)
        setProfilFor(brukerId)
      }
    })()

    return () => {
      gjelder = false
    }
  }, [brukerId, forsok])

  const forsokPaaNytt = useCallback(() => {
    setProfilfeil(false)
    setProfilFor(null)
    setForsok((runde) => runde + 1)
  }, [])

  const oppfriskProfil = useCallback(async () => {
    if (brukerId === null) return
    const hentet = await api.hentProfil(brukerId)
    setProfil(hentet)
    setProfilfeil(false)
    setProfilFor(brukerId)
  }, [brukerId])

  const loggUt = useCallback(async () => {
    await api.loggUt()
  }, [])

  const verdi = useMemo<Oktverdi>(() => {
    const klar = oktAvklart && (brukerId === null || profilFor === brukerId)
    return {
      tilgang: tilgangFor({ klar, harOkt: brukerId !== null, profil, profilfeil }),
      profil,
      mangler,
      forsokPaaNytt,
      loggInn: api.loggInn,
      loggUt,
      settProfil: (ny) => {
        setProfil(ny)
        setProfilFor(ny.id)
      },
      oppfriskProfil,
    }
  }, [
    oktAvklart,
    brukerId,
    profilFor,
    profil,
    profilfeil,
    mangler,
    loggUt,
    forsokPaaNytt,
    oppfriskProfil,
  ])

  return <Sammenheng.Provider value={verdi}>{children}</Sammenheng.Provider>
}

export function useOkt(): Oktverdi {
  const verdi = useContext(Sammenheng)
  if (!verdi) throw new Error('useOkt må stå innenfor <OktProvider>')
  return verdi
}

/**
 * Profilen til den innloggede brukeren, der det er gitt at noen er inne —
 * altså overalt inne i appen og i kontopanelet.
 */
export function useProfil(): Profil {
  const { profil } = useOkt()
  if (!profil) throw new Error('Ingen profil i økten')
  return profil
}
