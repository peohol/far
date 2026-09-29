import { useId, useRef, type ReactNode } from 'react'
import { useSkjuling } from '../../hooks/useSkjuling'
import { Ikon } from '../ikon/Ikon'
import type { Ikonnavn } from '../ikon/register'

/**
 * En trekkspillskuff nederst i idévinduet og i Planlagte oppgaver: de
 * overførte idéene, arkivet og de utførte oppgavene. Den er lukket til den
 * trykkes på, og glir opp og igjen som skuffene ellers i appen
 * (`useSkjuling`). Laget eier om den står åpen, så den står slik den stod når
 * man kommer tilbake fra en side inni.
 */
export function Ideskuff({
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
    <section className="ideskuff" data-apen={apen || undefined} aria-labelledby={`${id}-tittel`}>
      <h3 className="ideskuff__hode">
        <button type="button" className="ideskuff__knapp" aria-expanded={apen} aria-controls={id} onClick={onVeksle}>
          <Ikon navn={ikon} storrelse="ui" />
          <span id={`${id}-tittel`}>{tittel}</span>
          <span className="idegruppe__antall">{antall}</span>
          <span className="ideskuff__pil" aria-hidden="true">
            <Ikon navn="chev" />
          </span>
        </button>
      </h3>
      <div ref={kropp} className="ideskuff__kropp">
        <div ref={inner} id={id} className="ideskuff__inner">
          {forklaring && <p className="ideskuff__forklaring">{forklaring}</p>}
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
