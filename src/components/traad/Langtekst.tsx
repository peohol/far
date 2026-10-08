import { useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { maalLengde } from '../Breddehandtak'
import { Ikon } from '../ikon/Ikon'

/**
 * En lang tekst i en tråd — innlegget i en diskusjon eller en kommentar — vist
 * bare med de første linjene, som forsvinner bak en toning. Knappen under
 * viser hele teksten (feltet glir ut) og legger den sammen igjen.
 *
 * Hvor mye som vises, står i `--langtekst-hoyde` (`traad.css`). En tekst som
 * bare er litt lengre, vises hel: det lønner seg ikke å skjule et par linjer.
 * Hvor høy hele teksten er, måles hele tiden, så feltet følger med når bredden
 * endres eller et bilde lastes.
 */
export function Langtekst({ hva, children }: { hva: string; children: ReactNode }) {
  const flate = useRef<HTMLDivElement>(null)
  const innhold = useRef<HTMLDivElement>(null)
  const [hel, setHel] = useState(0)
  const [lang, setLang] = useState(false)
  const [apen, setApen] = useState(false)
  const id = useId()

  useLayoutEffect(() => {
    const ytre = flate.current
    const indre = innhold.current
    if (!ytre || !indre) return
    const maal = () => {
      const hoyde = indre.offsetHeight
      setHel(hoyde)
      setLang(hoyde > maalLengde(ytre, 'var(--langtekst-hoyde)') * VERDT_AA_SKJULE)
    }
    maal()
    if (typeof ResizeObserver !== 'function') return
    const vakt = new ResizeObserver(maal)
    vakt.observe(indre)
    return () => vakt.disconnect()
  }, [])

  const veksle = () => {
    // Legges teksten sammen mens toppen av den er rullet ut av syne, rulles den fram igjen.
    if (apen) requestAnimationFrame(() => flate.current?.scrollIntoView({ block: 'nearest' }))
    setApen(!apen)
  }

  return (
    <div className="langtekst" data-lang={lang || undefined} data-apen={apen || undefined}>
      <div
        ref={flate}
        id={id}
        className="langtekst__flate"
        style={{ '--langtekst-hel': `${hel}px` } as CSSProperties}
      >
        <div ref={innhold}>{children}</div>
      </div>
      {lang && (
        <button type="button" className="idehandling langtekst__knapp" aria-expanded={apen} aria-controls={id} onClick={veksle}>
          <Ikon navn="chev" storrelse="ui" />
          <span>{apen ? 'Vis mindre' : `Vis hele ${hva}`}</span>
        </button>
      )}
    </div>
  )
}

/** Hvor mye lengre enn det som vises, teksten må være før resten skjules. */
const VERDT_AA_SKJULE = 1.3
