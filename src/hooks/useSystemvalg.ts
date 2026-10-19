import { useEffect, useState } from 'react'
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

function lagret<V extends string>(def: Systemvalg<V>): Valg<V> {
  try {
    return lesValg(def, localStorage.getItem(def.lagring)) ?? def.standard
  } catch {
    return def.standard
  }
}

/**
 * Ett valg som kan stå fast eller følge systemet (`src/domain/systemvalg.ts`),
 * som temaet. Skriptet i `<head>` har alt satt verdien før React monterer;
 * herfra holdes den riktig når brukeren velger, eller når systemet endrer seg
 * mens valget er å følge det. Valget huskes i nettleseren; inne i appen følger
 * det også kontoen (`useKontovalg`).
 */
export function useSystemvalg<V extends string>(def: Systemvalg<V>) {
  const [valg, velg] = useState<Valg<V>>(() => lagret(def))
  const treff = useMediesporring(def.sporring)
  const virkelig = virkeligVerdi(def, valg, treff)

  useEffect(() => {
    document.documentElement.dataset[def.attributt] = virkelig
  }, [def, virkelig])

  useEffect(() => {
    try {
      localStorage.setItem(def.lagring, valg)
    } catch {
      // Privat nettlesermodus e.l. — valget gjelder fortsatt for økten.
    }
  }, [def, valg])

  return { valg, virkelig, velg }
}
