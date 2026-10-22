import { useCallback, useEffect, useState } from 'react'
import { lesValg, virkeligVerdi, type Systemvalg, type Valg } from '../domain/systemvalg'

/** Om mediespørringen slår til nå, og følger med når systemet endres. */
export function useMediesporring(sporring: string): boolean {
  const [treff, setTreff] = useState(() => liste(sporring)?.matches ?? false)

  useEffect(() => {
    const medier = liste(sporring)
    if (!medier) return
    const oppdater = () => setTreff(medier.matches)
    oppdater()
    medier.addEventListener?.('change', oppdater)
    return () => medier.removeEventListener?.('change', oppdater)
  }, [sporring])

  return treff
}

/** `matchMedia` finnes ikke overalt (eldre nettlesere, testmiljøet). */
function liste(sporring: string): MediaQueryList | null {
  return typeof window.matchMedia === 'function' ? window.matchMedia(sporring) : null
}

/**
 * Et valg nettleseren husker under `lagring`, som en vanlig tilstand. Det
 * som er husket, leses med `les` når valget tas i bruk; mangler det eller er
 * ugyldig, gjelder `standard`. Bare valg som faktisk tas, huskes, så den som
 * aldri har valgt, følger standarden. Inne i appen følger valget også kontoen
 * (`useKontosynk`).
 */
export function useHusketValg<T extends string>(lagring: string, les: (verdi: unknown) => T | null, standard: T) {
  const [valg, settValg] = useState<T>(() => {
    try {
      return les(localStorage.getItem(lagring)) ?? standard
    } catch {
      return standard
    }
  })

  const velg = useCallback(
    (neste: T) => {
      settValg(neste)
      try {
        localStorage.setItem(lagring, neste)
      } catch {
        // Privat nettlesermodus e.l. — valget gjelder fortsatt for økten.
      }
    },
    [lagring],
  )

  return [valg, velg] as const
}

/**
 * Ett valg som kan stå fast eller følge systemet (`src/domain/systemvalg.ts`),
 * som temaet. Skriptet i `<head>` har alt satt verdien før React monterer;
 * herfra holdes den riktig når brukeren velger, eller når systemet endrer seg
 * mens valget er å følge det. Valget huskes i nettleseren; inne i appen følger
 * det også kontoen (`useKontovalg`).
 */
export function useSystemvalg<V extends string>(def: Systemvalg<V>) {
  const [valg, velg] = useHusketValg<Valg<V>>(def.lagring, (verdi) => lesValg(def, verdi), def.standard)
  const treff = useMediesporring(def.sporring)
  const virkelig = virkeligVerdi(def, valg, treff)

  useEffect(() => {
    document.documentElement.dataset[def.attributt] = virkelig
  }, [def, virkelig])

  return { valg, virkelig, velg }
}
