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

interface Oktverdi {
  /** Hva som skal vises nå. Se `domain/tilgang.ts`. */
  tilgang: Tilgang
  profil: Profil | null
  /** Sant når appen ikke er koblet mot brukerdatabasen i det hele tatt. */
  mangler: boolean
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

  const brukerId = okt?.user.id ?? null

  useEffect(() => {
    if (mangler) return
    const { data } = klient().auth.onAuthStateChange((_hendelse, ny) => setOkt(ny))

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
      return
    }
    let gjelder = true
    void api
      .hentProfil(brukerId)
      .catch(() => null)
      .then((hentet) => {
        if (!gjelder) return
        setProfil(hentet)
        setProfilFor(brukerId)
      })
    return () => {
      gjelder = false
    }
  }, [brukerId])

  const oppfriskProfil = useCallback(async () => {
    if (brukerId === null) return
    const hentet = await api.hentProfil(brukerId)
    setProfil(hentet)
    setProfilFor(brukerId)
  }, [brukerId])

  const loggUt = useCallback(async () => {
    await api.loggUt()
  }, [])

  const verdi = useMemo<Oktverdi>(() => {
    const klar = oktAvklart && (brukerId === null || profilFor === brukerId)
    return {
      tilgang: tilgangFor({ klar, harOkt: brukerId !== null, profil }),
      profil,
      mangler,
      loggInn: api.loggInn,
      loggUt,
      settProfil: (ny) => {
        setProfil(ny)
        setProfilFor(ny.id)
      },
      oppfriskProfil,
    }
  }, [oktAvklart, brukerId, profilFor, profil, mangler, loggUt, oppfriskProfil])

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
