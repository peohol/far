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
  const dokk = useDokk()

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

/** Merket dokken bærer når gruppene står på hver sin rad (se `toppmeny.css`). */
const TO_RADER = 'data-to-rader'

/**
 * Om gruppene i dokken trenger hver sin rad: når de ikke får plass ved siden
 * av hverandre, med mellomrommet mellom dem.
 */
export function trengerToRader(bredder: readonly number[], mellomrom: number, plass: number) {
  const behov = bredder.reduce((sum, bredde) => sum + bredde, 0) + mellomrom * Math.max(0, bredder.length - 1)
  return behov > plass + 0.5
}

/**
 * Holder dokken på smale flater i orden:
 *
 * - Får ikke gruppene plass på én rad, står de på hver sin (`data-to-rader`),
 *   og dokken blir ikke bredere enn den bredeste raden. Det kan ikke CSS
 *   avgjøre selv: en rad som brytes, gjør boksen rundt like bred som det er
 *   plass til. Mens det søkes på siden, står valget slik det var.
 * - Høyden meldes til resten av appen som `--dokkhoyde`, så siden og det som
 *   står over dokken, gir plass også når den går over to rader. Står plassene
 *   i toppmenyen (brede flater) eller er de tomme, gjelder høyden på én rad
 *   fra `tokens.css`.
 */
function useDokk() {
  const [dokk, setDokk] = useState<HTMLElement | null>(null)

  useEffect(() => {
    if (!dokk || typeof ResizeObserver !== 'function') return
    const rot = document.documentElement.style
    const grupper = Array.from(dokk.querySelectorAll<HTMLElement>(':scope > .toppmeny__gruppe'))
    const maal = () => {
      const stil = getComputedStyle(dokk)
      const fast = stil.position === 'fixed'
      const soker = dokk.querySelector('.sidesok')?.contains(document.activeElement) ?? false
      if (!fast) dokk.removeAttribute(TO_RADER)
      else if (!soker) {
        const px = (verdi: string) => parseFloat(verdi) || 0
        const plass =
          document.documentElement.clientWidth -
          px(stil.left) -
          px(stil.right) -
          px(stil.paddingLeft) -
          px(stil.paddingRight) -
          px(stil.borderLeftWidth) -
          px(stil.borderRightWidth)
        const bredder = grupper.filter((g) => g.getClientRects().length > 0).map((g) => g.getBoundingClientRect().width)
        dokk.toggleAttribute(TO_RADER, trengerToRader(bredder, px(stil.columnGap), plass))
      }
      const hoyde = dokk.getBoundingClientRect().height
      if (hoyde > 0 && fast) rot.setProperty(DOKKHOYDE, `${hoyde}px`)
      else rot.removeProperty(DOKKHOYDE)
    }
    const vakt = new ResizeObserver(maal)
    for (const element of [dokk, ...grupper]) vakt.observe(element)
    window.addEventListener('resize', maal)
    maal()
    return () => {
      vakt.disconnect()
      window.removeEventListener('resize', maal)
      dokk.removeAttribute(TO_RADER)
      rot.removeProperty(DOKKHOYDE)
    }
  }, [dokk])

  return setDokk
}
