import { useId, useRef, type ReactNode } from 'react'
import { useSkjuling } from '../hooks/useSkjuling'
import { Ikon } from './ikon/Ikon'
import type { Ikonnavn } from './ikon/register'
import '../styles/skuff.css'

/**
 * En trekkspillskuff nederst i et vindu: de overførte idéene, arkivet og de
 * utførte oppgavene i idévinduet og Planlagte oppgaver, og arkivet i
 * varslene. Den er lukket til den trykkes på, og glir opp og igjen som
 * skuffene ellers i appen (`useSkjuling`). Laget eier om den står åpen, så den står slik den stod når
 * man kommer tilbake fra en side inni.
 */
export function Skuff({
  tittel,
  ikon,
  antall,
  forklaring,
  apen,
  onVeksle,
  children,
}: {
  tittel: string
  ikon: Ikonnavn
  antall: number
  /** En kort linje øverst i skuffen om hva som ligger der. */
  forklaring?: ReactNode
  apen: boolean
  onVeksle: () => void
  children: ReactNode
}) {
  const kropp = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const id = useId()
  useSkjuling(kropp, inner, apen)

  return (
    <section className="skuff" data-apen={apen || undefined} aria-labelledby={`${id}-tittel`}>
      <h3 className="skuff__hode">
        <button type="button" className="skuff__knapp" aria-expanded={apen} aria-controls={id} onClick={onVeksle}>
          <Ikon navn={ikon} storrelse="ui" />
          <span id={`${id}-tittel`}>{tittel}</span>
          <span className="skuff__antall">{antall}</span>
          <span className="skuff__pil" aria-hidden="true">
            <Ikon navn="chev" />
          </span>
        </button>
      </h3>
      <div ref={kropp} className="skuff__kropp">
        <div ref={inner} id={id} className="skuff__inner">
          {forklaring && <p className="skuff__forklaring">{forklaring}</p>}
          {children}
        </div>
      </div>
    </section>
  )
}

/** Hvilke skuffer i et lag som står åpne, etter navn. */
export function veksleSkuff(apne: ReadonlySet<string>, navn: string): ReadonlySet<string> {
  const neste = new Set(apne)
  if (!neste.delete(navn)) neste.add(navn)
  return neste
}
