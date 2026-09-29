import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Favorittlager } from './lagring'

/**
 * Brukerens favoritter: fagsidene hen har merket med stjernen på siden, og som
 * står i skuffen «Favoritter» i stoffregisteret.
 *
 * Stjernen og skuffen deler én kilde, så et trykk det ene stedet vises det
 * andre med en gang. Endringen vises før databasen har svart, og lagringene
 * går én og én i den rekkefølgen de ble gjort. Svarer databasen med en feil,
 * hentes det den faktisk har, så det som vises aldri blir stående feil.
 * Favorittene hentes på nytt når fanen blir synlig igjen, så endringer fra en
 * annen maskin kommer med.
 */
export interface Favoritter {
  /** Stoffene, som kanoniske nøkler, i den rekkefølgen de ble lagt til. */
  stoffer: readonly string[]
  /** Om stoffet med denne nøkkelen, eller et navn for det, er favoritt. */
  erFavoritt: (stoff: string) => boolean
  /** Gjør stoffet til favoritt eller ikke. */
  sett: (stoff: string, favoritt: boolean) => void
}

/** Stoffets egen nøkkel for en nøkkel, eller nøkkelen selv når registeret ikke kjenner den. */
export type Kanonisk = (nokkel: string) => string

/**
 * Favorittene som kanoniske nøkler, hver én gang og i den rekkefølgen de ble
 * lagt til. En favoritt som ble merket på en side som senere er slått sammen
 * med en annen, står som stoffet den nå hører til.
 */
export function kanoniskeFavoritter(lagret: readonly string[], kanonisk: Kanonisk): string[] {
  return [...new Set(lagret.map(kanonisk))]
}

const Kontekst = createContext<Favoritter | null>(null)

export function FavorittkildeProvider({
  lager,
  brukerId,
  kanonisk,
  children,
}: {
  lager: Favorittlager
  /** Den innloggede. Favorittene hentes på nytt når den byttes. */
  brukerId: string
  kanonisk: Kanonisk
  children: ReactNode
}) {
  /** Nøklene slik databasen har dem, med endringene som er på vei. */
  const [lagret, setLagret] = useState<readonly string[]>([])
  const gjeldende = useRef(lagret)
  gjeldende.current = lagret
  /** Økes ved hver endring. Et svar som ble bedt om før den siste, er utdatert. */
  const endringer = useRef(0)
  /** Lagringer på vei. Mens noen er ute, kan databasen ennå ha det gamle. */
  const underveis = useRef(0)
  const ko = useRef<Promise<void>>(Promise.resolve())
  /** En lagring feilet, og det databasen faktisk har, skal hentes. */
  const maaHente = useRef(false)

  const hent = useCallback(() => {
    const bestilt = endringer.current
    lager.hent().then(
      (nokler) => {
        if (bestilt === endringer.current && underveis.current === 0) setLagret(nokler)
      },
      // Uten svar vet vi ikke hva databasen har, og lar det som vises stå.
      () => undefined,
    )
  }, [lager])

  useEffect(() => {
    setLagret([])
    hent()
    const naarSynlig = () => {
      if (document.visibilityState === 'visible') hent()
    }
    document.addEventListener('visibilitychange', naarSynlig)
    return () => document.removeEventListener('visibilitychange', naarSynlig)
  }, [brukerId, hent])

  const sett = useCallback(
    (stoff: string, favoritt: boolean) => {
      const maal = kanonisk(stoff)
      const forrige = gjeldende.current
      // Alle nøklene som fører til stoffet, også en gammel nøkkel for det.
      const treff = forrige.filter((s) => kanonisk(s) === maal)
      if (favoritt === treff.length > 0) return
      const skrivinger = favoritt ? [maal] : treff
      const neste = favoritt ? [...forrige, maal] : forrige.filter((s) => !treff.includes(s))

      endringer.current += 1
      gjeldende.current = neste
      setLagret(neste)
      underveis.current += 1
      ko.current = ko.current
        .then(() => Promise.all(skrivinger.map((s) => lager.sett(s, favoritt))))
        // Databasen sa nei: det den har, hentes når køen er tom.
        .then(
          () => undefined,
          () => {
            maaHente.current = true
          },
        )
        .finally(() => {
          underveis.current -= 1
          if (underveis.current > 0 || !maaHente.current) return
          maaHente.current = false
          hent()
        })
    },
    [kanonisk, lager, hent],
  )

  const stoffer = useMemo(() => kanoniskeFavoritter(lagret, kanonisk), [lagret, kanonisk])
  const verdi = useMemo<Favoritter>(() => {
    const sett_ = new Set(stoffer)
    return { stoffer, erFavoritt: (stoff) => sett_.has(kanonisk(stoff)), sett }
  }, [stoffer, kanonisk, sett])

  return <Kontekst.Provider value={verdi}>{children}</Kontekst.Provider>
}

/** Favorittene, eller `null` utenfor en {@link FavorittkildeProvider} — da vises verken stjerne eller skuff. */
export function useFavoritter(): Favoritter | null {
  return useContext(Kontekst)
}
