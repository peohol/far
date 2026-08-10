import { useEffect, useRef, type MouseEvent, type ReactNode } from 'react'

export interface DetailsProps {
  /** Overskriften som åpner og lukker, f.eks. «Forklaring». */
  summary: string
  children: ReactNode
}

/**
 * Sammenleggbar seksjon med jevn åpning og lukking — slik `<details>` skal
 * oppføre seg overalt i appen. Selve `<details>`-elementet beholdes for
 * semantikkens skyld; animasjonen går via `grid-template-rows` (0fr ↔ 1fr),
 * som er den eneste måten å gli mot en ukjent høyde på uten å måle den.
 *
 * Åpning og lukking styres utenom React: klikket hindres i å slå om
 * elementet direkte, høyden animeres, og først når lukkeanimasjonen er
 * ferdig fjernes `open`-attributtet — ellers ville innholdet forsvunnet før
 * det rakk å gli igjen. Ved mindre bevegelse gjør CSS-en overgangen
 * umiddelbar, og det samme grepet virker fortsatt.
 */
export function Details({ summary, children }: DetailsProps) {
  const detaljer = useRef<HTMLDetailsElement>(null)
  const kropp = useRef<HTMLDivElement>(null)
  const rydder = useRef<() => void>()

  useEffect(() => () => rydder.current?.(), [])

  /** Kjører `gjor` når glidningen er ferdig — eller straks, om den uteblir. */
  const etterGlidning = (boks: HTMLDivElement, gjor: () => void) => {
    let kjort = false
    const kjor = () => {
      if (kjort) return
      kjort = true
      boks.removeEventListener('transitionend', paaSlutt)
      window.clearTimeout(frist)
      gjor()
    }
    const paaSlutt = (event: TransitionEvent) => {
      if (event.target === boks && event.propertyName === 'grid-template-rows') kjor()
    }
    boks.addEventListener('transitionend', paaSlutt)
    const frist = window.setTimeout(kjor, 400)
    rydder.current = kjor
  }

  const veksle = (event: MouseEvent) => {
    event.preventDefault()
    const det = detaljer.current
    const boks = kropp.current
    if (!det || !boks) return
    rydder.current?.()

    if (!det.open) {
      det.open = true
      boks.style.gridTemplateRows = '0fr'
      void boks.offsetHeight
      boks.style.gridTemplateRows = '1fr'
      // Når glidningen er ferdig, tar CSS-regelen for [open] over igjen.
      etterGlidning(boks, () => {
        boks.style.gridTemplateRows = ''
      })
    } else {
      boks.style.gridTemplateRows = '1fr'
      void boks.offsetHeight
      boks.style.gridTemplateRows = '0fr'
      etterGlidning(boks, () => {
        det.open = false
        boks.style.gridTemplateRows = ''
      })
    }
  }

  return (
    <details ref={detaljer} className="detalj">
      <summary className="detalj__tittel" onClick={veksle}>
        {summary}
      </summary>
      <div ref={kropp} className="detalj__kropp">
        <div className="detalj__inner">{children}</div>
      </div>
    </details>
  )
}
