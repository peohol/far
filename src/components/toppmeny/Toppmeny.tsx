import { useEffect, useState, type ReactNode } from 'react'
import { TOPPMENYSPOR, useMeldSpor, type Toppmenygruppe, type Toppmenyspor } from './Toppmenykilde'

export interface ToppmenyProps {
  /** Sidemenyen — knappen som åpner den, først i menyen. */
  meny: ReactNode
  /** Globalt fagsøk. Tar resten av bredden, og har forrang på smale flater. */
  sok?: ReactNode
  /** Knappene foran kontoen: idéene, adminmenyen og varslene. */
  verktoy?: ReactNode
  /** Kontoen, sist i menyen. */
  konto: ReactNode
}

/**
 * Den ene faste toppmenyen: en svevende pille øverst i vinduet, over alt
 * innhold, i rekkefølgen sidemeny · fagsøk · sidens egne handlinger · skille
 * · idéer, adminmeny, varsler og konto. Ingen logo.
 *
 * Sidene fyller sine plasser i menyen med `ToppmenyInnhold` (se
 * `TOPPMENYSPOR`). På smale flater flyttes de til en dokk nederst i vinduet.
 * Får ikke alt plass på én rad der, står hovedgruppen (søket i siden og
 * hovedhandlingen) på første rad og resten på andre.
 *
 * Menyen tar `--toppmeny-offset` av vinduet øverst; innhold og ankere legger
 * seg under den (se `tokens.css`).
 */
export function Toppmeny({ meny, sok, verktoy, konto }: ToppmenyProps) {
  const dokk = useDokkhoyde()

  return (
    <header className="toppmeny" data-toppmeny="">
      <nav className="toppmeny__pille" aria-label="Toppmeny">
        {meny}
        <div className="toppmeny__sok">{sok}</div>
        <div ref={dokk} className="toppmeny__kontekst" role="group" aria-label="Sidehandlinger">
          {(Object.keys(TOPPMENYSPOR) as Toppmenygruppe[]).map((gruppe) => (
            <div key={gruppe} className="toppmeny__gruppe" data-gruppe={gruppe}>
              {TOPPMENYSPOR[gruppe].map((navn) => (
                <Spor key={navn} navn={navn} />
              ))}
            </div>
          ))}
        </div>
        <span className="toppmeny__skille" aria-hidden="true" />
        {verktoy && <div className="toppmeny__verktoy">{verktoy}</div>}
        {konto}
      </nav>
    </header>
  )
}

function Spor({ navn }: { navn: Toppmenyspor }) {
  return <div ref={useMeldSpor(navn)} className="toppmeny__spor" data-spor={navn} />
}

/** Dokkens målte høyde, på dokumentet (se `tokens.css`). */
const DOKKHOYDE = '--dokkhoyde'

/**
 * Melder dokkens høyde til resten av appen mens sidens plasser står i den, så
 * siden og det som står over dokken, gir plass også når den går over to
 * rader. Står plassene i toppmenyen (brede flater) eller er de tomme, gjelder
 * høyden på én rad fra `tokens.css`.
 */
function useDokkhoyde() {
  const [dokk, setDokk] = useState<HTMLElement | null>(null)

  useEffect(() => {
    if (!dokk || typeof ResizeObserver !== 'function') return
    const rot = document.documentElement.style
    const maal = () => {
      const hoyde = dokk.getBoundingClientRect().height
      if (hoyde > 0 && getComputedStyle(dokk).position === 'fixed') rot.setProperty(DOKKHOYDE, `${hoyde}px`)
      else rot.removeProperty(DOKKHOYDE)
    }
    const vakt = new ResizeObserver(maal)
    vakt.observe(dokk)
    maal()
    return () => {
      vakt.disconnect()
      rot.removeProperty(DOKKHOYDE)
    }
  }, [dokk])

  return setDokk
}
