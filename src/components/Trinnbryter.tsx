import { useRef, useState, type CSSProperties, type PointerEvent } from 'react'

/** Ett valg på bryteren: verdien det står for og merket som vises. */
export interface Trinnvalg<T> {
  verdi: T
  merke: string
}

export interface TrinnbryterProps<T> {
  /** Navnet skjermlesere oppgir. */
  etikett: string
  /** Valgene fra venstre mot høyre. */
  valg: readonly Trinnvalg<T>[]
  /** Står den på en verdi som ikke er blant valgene, står knotten på ingen av dem. */
  verdi: T
  onVelg: (verdi: T) => void
  /** Id-en til det som forklarer valget, som et tips. */
  beskrevetAv?: string
}

/** Hvor mange piksler pekeren må flytte seg før et trykk blir et drag. */
const DRAGTERSKEL = 4

/** Valget som ligger ved `x`, målt fra venstre kant av valgene. Utenfor bryteren er det nærmeste. */
export function trinnVed(x: number, trinnbredde: number, antall: number): number {
  if (!(trinnbredde > 0)) return 0
  return Math.min(antall - 1, Math.max(0, Math.floor(x / trinnbredde)))
}

/** Hvor valgene begynner i vinduet, og hvor bredt hvert av dem er. */
function maal(spor: HTMLElement, antall: number) {
  const rute = spor.getBoundingClientRect()
  const stil = getComputedStyle(spor)
  const px = (verdi: string) => parseFloat(verdi) || 0
  const venstrekant = px(stil.borderLeftWidth) + px(stil.paddingLeft)
  const hoyrekant = px(stil.borderRightWidth) + px(stil.paddingRight)
  return { venstre: rute.left + venstrekant, trinnbredde: (rute.width - venstrekant - hoyrekant) / antall }
}

interface Grep {
  peker: number
  startX: number
  /** Hvor langt fra midten av knotten den ble grepet, så den ikke rykker når draget begynner. */
  forskyvning: number
  drar: boolean
}

/**
 * En bryter med noen få faste valg side om side, der en knott glir til valget
 * som står. Et valg velges ved å trykke på det, eller ved å dra knotten dit;
 * slippes den mellom to valg, legger den seg på det nærmeste.
 *
 * Tastaturet og skjermleserne har en vanlig skala under bryteren: den er
 * usynlig, men tar imot fokus, og piltastene, Home og End flytter den ett
 * valg av gangen, som før. Den melder valget med merket (`aria-valuetext`).
 * Samme mønster som `.bryter`, der avkryssingen ligger usynlig i bryteren.
 * For tastereglene er den en skala, så mellomrom og `Enter` bekrefter som
 * ellers i fortolkningen (`src/domain/tastatur.ts`).
 *
 * Bevegelsene følger fartstokenene, så de står stille ved redusert bevegelse.
 */
export function Trinnbryter<T>({ etikett, valg, verdi, onVelg, beskrevetAv }: TrinnbryterProps<T>) {
  const felt = useRef<HTMLInputElement>(null)
  const grep = useRef<Grep | null>(null)
  // Hvor knotten står mens den dras, i piksler fra første valg. Ellers står den på valget.
  const [dratt, setDratt] = useState<number | null>(null)
  // Sant når fokus kom fra pekeren. Da står ikke fokusringen før tastaturet tas i bruk.
  const [pekerfokus, setPekerfokus] = useState(false)

  const valgt = valg.findIndex((v) => Object.is(v.verdi, verdi))
  const velg = (indeks: number) => {
    const neste = valg[indeks]
    if (neste && indeks !== valgt) onVelg(neste.verdi)
  }

  const slipp = () => {
    grep.current = null
    setDratt(null)
  }

  const paaNed = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    // Fokus flyttes til skalaen, så tastaturet tar over der pekeren slapp.
    event.preventDefault()
    setPekerfokus(true)
    felt.current?.focus({ preventScroll: true })
    event.currentTarget.setPointerCapture?.(event.pointerId)
    const { venstre, trinnbredde } = maal(event.currentTarget, valg.length)
    const x = event.clientX - venstre
    const paaKnotten = valgt >= 0 && trinnVed(x, trinnbredde, valg.length) === valgt
    grep.current = {
      peker: event.pointerId,
      startX: event.clientX,
      forskyvning: paaKnotten ? x - (valgt + 0.5) * trinnbredde : 0,
      drar: false,
    }
  }

  const paaFlytt = (event: PointerEvent<HTMLDivElement>) => {
    const g = grep.current
    if (!g || g.peker !== event.pointerId) return
    if (!g.drar && Math.abs(event.clientX - g.startX) < DRAGTERSKEL) return
    g.drar = true
    const { venstre, trinnbredde } = maal(event.currentTarget, valg.length)
    const halv = trinnbredde / 2
    const midt = Math.min(
      valg.length * trinnbredde - halv,
      Math.max(halv, event.clientX - venstre - g.forskyvning),
    )
    setDratt(midt - halv)
    velg(trinnVed(midt, trinnbredde, valg.length))
  }

  const paaOpp = (event: PointerEvent<HTMLDivElement>) => {
    const g = grep.current
    if (!g || g.peker !== event.pointerId) return
    // Et trykk uten drag velger det som står under pekeren; draget har alt valgt underveis.
    if (!g.drar) {
      const { venstre, trinnbredde } = maal(event.currentTarget, valg.length)
      velg(trinnVed(event.clientX - venstre, trinnbredde, valg.length))
    }
    slipp()
  }

  const stil = { '--antall': valg.length, '--trinn': Math.max(valgt, 0) } as CSSProperties

  return (
    <div
      className={['trinnbryter', dratt !== null && 'trinnbryter--drar', pekerfokus && 'trinnbryter--peker']
        .filter(Boolean)
        .join(' ')}
      style={stil}
    >
      <input
        ref={felt}
        className="trinnbryter__felt"
        type="range"
        min={0}
        max={valg.length - 1}
        step={1}
        value={valgt}
        aria-label={etikett}
        aria-describedby={beskrevetAv}
        aria-valuetext={valg[valgt]?.merke}
        onChange={(e) => velg(Number(e.target.value))}
        onKeyDown={() => setPekerfokus(false)}
        onBlur={() => setPekerfokus(false)}
      />
      {/* Merkene er rene ledetekster for øyet — skalaen over melder selv
          hvilket valg som står. */}
      <div
        className="trinnbryter__spor"
        aria-hidden="true"
        onPointerDown={paaNed}
        onPointerMove={paaFlytt}
        onPointerUp={paaOpp}
        onPointerCancel={slipp}
        onLostPointerCapture={slipp}
      >
        {valgt >= 0 && (
          <span
            className="trinnbryter__knott"
            style={dratt === null ? undefined : { transform: `translateX(${dratt}px)` }}
          />
        )}
        {valg.map((v, i) => (
          <span
            key={v.merke}
            className={`trinnbryter__valg${i === valgt ? ' trinnbryter__valg--valgt' : ''}`}
          >
            {v.merke}
          </span>
        ))}
      </div>
    </div>
  )
}
