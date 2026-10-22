import { useCallback, useEffect, useMemo, useRef } from 'react'
import { hentInnstilling, lagreSisteValg } from '../auth/innstillinger'
import { lesValg, type Systemvalg } from '../domain/systemvalg'
import { useSystemvalg } from './useSystemvalg'

/**
 * Et valg som kan følge systemet (`useSystemvalg`), for den innloggede
 * brukeren lagret på kontoen, så det følger med til andre maskiner og
 * nettlesere (`useKontosynk`).
 */
export function useKontovalg<V extends string>(def: Systemvalg<V>, brukerId: string) {
  const { valg, virkelig, velg: settValg } = useSystemvalg(def)
  const les = useCallback((verdi: unknown) => lesValg(def, verdi), [def])
  const velg = useKontosynk(def.konto, les, valg, settValg, brukerId)
  return { valg, virkelig, velg }
}

/**
 * Holder et valg nettleseren husker (`valg`, `settValg`) i takt med kontoen,
 * under nøkkelen `konto` i brukerinnstillingene. Nettleserens eget minne gir
 * fortsatt riktig verdi fra første bilde; kontoens valg legges over så snart
 * det er hentet (lest med `les`), og hentes på nytt når fanen blir synlig
 * igjen. Gir tilbake `velg`, som setter valget og lagrer det på kontoen.
 *
 * Har kontoen ikke noe valg ennå, lagres det valget nettleseren alt står i —
 * så det brukeren valgte før dette fantes, blir med. `les` må være den samme
 * funksjonen hver gang.
 */
export function useKontosynk<T>(
  konto: string,
  les: (verdi: unknown) => T | null,
  valg: T,
  settValg: (valg: T) => void,
  brukerId: string,
): (valg: T) => void {
  const gjeldende = useRef(valg)
  gjeldende.current = valg
  /**
   * Økes for hvert bytte brukeren gjør her. Et svar fra kontoen som ble bedt
   * om før siste bytte, er utdatert og skal ikke overstyre det.
   */
  const bytter = useRef(0)
  /** Lagringer på vei. Mens noen er ute, kan kontoen ennå vise det gamle valget. */
  const underveis = useRef(0)
  const sendSiste = useMemo(() => lagreSisteValg<T>(konto), [konto])

  const lagre = useCallback(
    (neste: T) => {
      underveis.current += 1
      sendSiste(neste)
        .catch(() => undefined)
        .finally(() => {
          underveis.current -= 1
        })
    },
    [sendSiste],
  )

  useEffect(() => {
    let gjelder = true

    const hent = () => {
      const bestilt = bytter.current
      hentInnstilling(konto).then(
        (fraKonto) => {
          if (!gjelder || bestilt !== bytter.current || underveis.current > 0) return
          const lest = les(fraKonto)
          if (lest !== null) settValg(lest)
          else lagre(gjeldende.current)
        },
        // Uten svar vet vi ikke hva kontoen har, og lar den være i fred.
        () => undefined,
      )
    }

    const naarSynlig = () => {
      if (document.visibilityState === 'visible') hent()
    }

    hent()
    document.addEventListener('visibilitychange', naarSynlig)
    return () => {
      gjelder = false
      document.removeEventListener('visibilitychange', naarSynlig)
    }
  }, [konto, les, brukerId, settValg, lagre])

  return useCallback(
    (neste: T) => {
      bytter.current += 1
      settValg(neste)
      lagre(neste)
    },
    [settValg, lagre],
  )
}
