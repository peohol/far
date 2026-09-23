import { useCallback, useEffect, useRef, useState } from 'react'
import { klar, type Publisertgrunnlag, type Regeltilstand } from '../regler/publiserte'

/**
 * De publiserte regelsettene og referanseområdene, hentet én gang når appen
 * åpnes.
 *
 * `hentPaNytt` henter dem igjen: etter en feil, eller når en administrator kan
 * ha publisert nye regler. Har appen alt regelsettene, blir de stående til de
 * nye er hentet, så steg 2 ikke blinker; en feil da beholder de gamle.
 */
export function usePubliserteRegler(hent: () => Promise<Publisertgrunnlag>): {
  tilstand: Regeltilstand
  hentPaNytt: () => void
} {
  const [tilstand, setTilstand] = useState<Regeltilstand>({ status: 'laster' })
  // Bare det siste svaret teller, om to hentinger skulle krysse hverandre.
  const siste = useRef(0)

  const hentPaNytt = useCallback(() => {
    const denne = (siste.current += 1)
    setTilstand((forrige) => (forrige.status === 'feil' ? { status: 'laster' } : forrige))
    hent().then(
      (grunnlag) => {
        if (denne === siste.current) setTilstand(klar(grunnlag))
      },
      (feil: unknown) => {
        if (denne !== siste.current) return
        const melding = feil instanceof Error ? feil.message : String(feil)
        setTilstand((forrige) => (forrige.status === 'klar' ? forrige : { status: 'feil', melding }))
      },
    )
  }, [hent])

  useEffect(hentPaNytt, [hentPaNytt])

  return { tilstand, hentPaNytt }
}
