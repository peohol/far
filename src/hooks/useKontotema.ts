import { useCallback, useEffect, useRef } from 'react'
import { hentInnstilling, lagreInnstilling } from '../auth/innstillinger'
import { TEMANOKKEL, lesTema, motsattTema, useTheme, type Theme } from './useTheme'

/**
 * Temaet til den innloggede brukeren, lagret på kontoen, så valget følger
 * med til andre maskiner og nettlesere. Nettleserens eget minne (se
 * `useTheme`) gir fortsatt riktig tema fra første bilde; kontoens valg legges
 * over så snart det er hentet, og hentes på nytt når fanen blir synlig igjen.
 *
 * Har kontoen ikke noe valg ennå, lagres det temaet nettleseren alt står i —
 * så det brukeren valgte før dette fantes, blir med.
 */
export function useKontotema(brukerId: string) {
  const { theme, velg } = useTheme()
  const gjeldende = useRef(theme)
  gjeldende.current = theme
  /**
   * Økes for hvert bytte brukeren gjør her. Et svar fra kontoen som ble bedt
   * om før siste bytte, er utdatert og skal ikke overstyre det.
   */
  const bytter = useRef(0)
  /** Lagringer på vei. Mens noen er ute, kan kontoen ennå vise det gamle valget. */
  const underveis = useRef(0)

  const lagre = useCallback((tema: Theme) => {
    underveis.current += 1
    void lagreInnstilling(TEMANOKKEL, tema)
      .catch(() => undefined)
      .finally(() => {
        underveis.current -= 1
      })
  }, [])

  useEffect(() => {
    let gjelder = true

    const hent = () => {
      const bestilt = bytter.current
      hentInnstilling(TEMANOKKEL).then(
        (lagret) => {
          if (!gjelder || bestilt !== bytter.current || underveis.current > 0) return
          const tema = lesTema(lagret)
          if (tema) velg(tema)
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
  }, [brukerId, velg, lagre])

  const toggle = useCallback(() => {
    const neste = motsattTema(gjeldende.current)
    bytter.current += 1
    velg(neste)
    lagre(neste)
  }, [velg, lagre])

  return { theme, toggle }
}
