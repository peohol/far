import { useMemo } from 'react'
import { klar, type Publisertgrunnlag, type Regeltilstand } from '../regler/publiserte'
import { useHenting } from './useHenting'

/**
 * De publiserte regelsettene og referanseområdene, hentet én gang når appen
 * åpnes og på nytt ved `hentPaNytt` ({@link useHenting}).
 */
export function usePubliserteRegler(hent: () => Promise<Publisertgrunnlag>): {
  tilstand: Regeltilstand
  hentPaNytt: () => void
} {
  const { tilstand: henting, hentPaNytt } = useHenting(hent)
  const tilstand = useMemo(() => (henting.status === 'klar' ? klar(henting.data) : henting), [henting])
  return { tilstand, hentPaNytt }
}
