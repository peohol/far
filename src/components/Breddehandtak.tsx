import { useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'

/** Bredden en flate kan ha, i piksler. */
export interface Breddegrenser {
  minst: number
  mest: number
}

/** Bredden flaten skal ha nå, og grensene den kan ha. */
export interface Breddemaal extends Breddegrenser {
  bredde: number
}

/** Hvor mange piksler én piltast flytter kanten, og med Shift. */
const STEG = 16
const LANGT_STEG = 64

/**
 * Hvor mange piksler en CSS-lengde (gjerne et token, som `var(--x)`) er inne
 * i `i`. Lengden måles på et usynlig element, så CSS forblir eneste kilde til
 * grensene, også når de avhenger av vinduet.
 */
export function maalLengde(i: HTMLElement, lengde: string): number {
  const prove = document.createElement('div')
  prove.style.cssText = `position:absolute;visibility:hidden;pointer-events:none;height:0;width:${lengde}`
  i.appendChild(prove)
  const bredde = prove.getBoundingClientRect().width
  prove.remove()
  return bredde
}

const klem = (bredde: number, { minst, mest }: Breddegrenser) => Math.round(Math.min(mest, Math.max(minst, bredde)))

interface Grep {
  peker: number
  startX: number
  startbredde: number
  grenser: Breddegrenser
}

/**
 * Kanten på en flate som kan dras for å gjøre flaten bredere eller smalere.
 *
 * Pekeren drar kanten; et dobbeltklikk setter flaten tilbake til den minste
 * bredden. For tastaturet og skjermleserne er håndtaket en skillelinje
 * (`role="separator"`) som tar imot fokus: piltastene flytter kanten (med
 * Shift i større steg), og Home og End gir minste og største bredde.
 *
 * Håndtaket eier ikke bredden. Den som bruker det, viser bredden underveis
 * (`onEndre`) og lagrer den når draget er sluppet eller tasten er sluppet
 * (`onFerdig`). Bredden og grensene måles når de trengs (`maal`), så de
 * følger vinduet. Mål bredden flaten skal ha, ikke den den har: glir flaten
 * mot en ny bredde, er den underveis en annen.
 */
export function Breddehandtak({
  etikett,
  kant = 'venstre',
  maal: maalFlate,
  onEndre,
  onFerdig,
}: {
  /** Navnet skjermlesere oppgir. */
  etikett: string
  /** Kanten håndtaket står på. Dras den utover, blir flaten bredere. */
  kant?: 'venstre' | 'hoyre'
  maal: () => Breddemaal
  /** Bredden mens den endres. */
  onEndre: (bredde: number) => void
  /** Bredden når den er ferdig endret, til lagring. */
  onFerdig: (bredde: number) => void
}) {
  const grep = useRef<Grep | null>(null)
  const [drar, setDrar] = useState(false)
  const [verdi, setVerdi] = useState<Breddemaal>({ bredde: 0, minst: 0, mest: 0 })
  // Bredden tastene har endret til, og som lagres når tasten slippes.
  const tastet = useRef<number | null>(null)
  const retning = kant === 'venstre' ? -1 : 1

  /** Bredden og grensene nå, også for skjermleserne. */
  const maal = () => {
    const m = maalFlate()
    const naa = { ...m, bredde: klem(m.bredde, m) }
    setVerdi(naa)
    return naa
  }
  // Det holder å måle når håndtaket kommer fram; siden måles det når det tas i bruk.
  useLayoutEffect(() => void maal(), [])

  const sett = (bredde: number, g: Breddegrenser) => {
    const ny = klem(bredde, g)
    setVerdi({ ...g, bredde: ny })
    onEndre(ny)
    return ny
  }

  const paaNed = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    // Ingen markering av tekst og ingen fokusring mens det dras.
    event.preventDefault()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    const { bredde, ...g } = maal()
    grep.current = { peker: event.pointerId, startX: event.clientX, startbredde: bredde, grenser: g }
    setDrar(true)
  }

  const paaFlytt = (event: PointerEvent<HTMLDivElement>) => {
    const g = grep.current
    if (!g || g.peker !== event.pointerId) return
    sett(g.startbredde + retning * (event.clientX - g.startX), g.grenser)
  }

  const slipp = (event: PointerEvent<HTMLDivElement>) => {
    const g = grep.current
    if (!g || g.peker !== event.pointerId) return
    grep.current = null
    setDrar(false)
    const ny = klem(g.startbredde + retning * (event.clientX - g.startX), g.grenser)
    if (ny !== g.startbredde) onFerdig(ny)
  }

  // Et drag som avbrytes (ikke slippes), setter bredden tilbake.
  const avbryt = () => {
    const g = grep.current
    if (!g) return
    grep.current = null
    setDrar(false)
    onEndre(g.startbredde)
  }

  const paaTast = (event: KeyboardEvent<HTMLDivElement>) => {
    const { bredde, ...g } = maal()
    const steg = event.shiftKey ? LANGT_STEG : STEG
    const ny =
      event.key === 'ArrowLeft'
        ? bredde - retning * steg
        : event.key === 'ArrowRight'
          ? bredde + retning * steg
          : event.key === 'Home'
            ? g.minst
            : event.key === 'End'
              ? g.mest
              : null
    if (ny === null) return
    event.preventDefault()
    tastet.current = sett(ny, g)
  }

  const paaTastOpp = () => {
    if (tastet.current === null) return
    onFerdig(tastet.current)
    tastet.current = null
  }

  return (
    <div
      className="breddehandtak"
      data-kant={kant}
      data-drar={drar || undefined}
      role="separator"
      aria-orientation="vertical"
      aria-label={etikett}
      aria-valuenow={verdi.bredde}
      aria-valuemin={verdi.minst}
      aria-valuemax={verdi.mest}
      aria-valuetext={`${verdi.bredde} piksler`}
      tabIndex={0}
      title={`${etikett}. Dobbeltklikk for minste bredde.`}
      onPointerDown={paaNed}
      onPointerMove={paaFlytt}
      onPointerUp={slipp}
      onPointerCancel={avbryt}
      onLostPointerCapture={avbryt}
      onDoubleClick={() => {
        const g = maal()
        onFerdig(sett(g.minst, g))
      }}
      onFocus={() => void maal()}
      onKeyDown={paaTast}
      onKeyUp={paaTastOpp}
    />
  )
}
