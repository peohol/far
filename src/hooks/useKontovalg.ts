import { useCallback, useEffect, useMemo, useRef } from 'react'
import { hentInnstilling, lagreSisteValg } from '../auth/innstillinger'
import { lesValg, type Systemvalg, type Valg } from '../domain/systemvalg'
import { useSystemvalg } from './useSystemvalg'

/**
 * Et valg som kan følge systemet (`useSystemvalg`), for den innloggede
 * brukeren lagret på kontoen, så det følger med til andre maskiner og
 * nettlesere. Nettleserens eget minne gir fortsatt riktig verdi fra første
 * bilde; kontoens valg legges over så snart det er hentet, og hentes på nytt
 * når fanen blir synlig igjen.
 *
 * Har kontoen ikke noe valg ennå, lagres det valget nettleseren alt står i —
 * så det brukeren valgte før dette fantes, blir med.
 */
export function useKontovalg<V extends string>(def: Systemvalg<V>, brukerId: string) {
  const { valg, virkelig, velg: settValg } = useSystemvalg(def)
  const gjeldende = useRef(valg)
  gjeldende.current = valg
  /**
   * Økes for hvert bytte brukeren gjør her. Et svar fra kontoen som ble bedt
   * om før siste bytte, er utdatert og skal ikke overstyre det.
   */
  const bytter = useRef(0)
  /** Lagringer på vei. Mens noen er ute, kan kontoen ennå vise det gamle valget. */
  const underveis = useRef(0)
  const sendSiste = useMemo(() => lagreSisteValg<Valg<V>>(def.konto), [def])

  const lagre = useCallback(
    (neste: Valg<V>) => {
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
      hentInnstilling(def.konto).then(
        (fraKonto) => {
          if (!gjelder || bestilt !== bytter.current || underveis.current > 0) return
          const lest = lesValg(def, fraKonto)
          if (lest) settValg(lest)
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
  }, [def, brukerId, settValg, lagre])

  const velg = useCallback(
    (neste: Valg<V>) => {
      bytter.current += 1
      settValg(neste)
      lagre(neste)
    },
    [settValg, lagre],
  )

  return { valg, virkelig, velg }
}
