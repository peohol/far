import { useEffect, useRef, useState, type ReactElement, type SVGProps } from 'react'
import { IKONER, IKONFARGER, type Ikondefinisjon, type Ikondel, type Ikonnavn } from './register'

/**
 * Størrelsene ikonene er tegnet for. Verdiene er tokens i `tokens.css`, så de
 * kan justeres ett sted:
 *
 * - `tekst` følger skriftstørrelsen rundt (1em)
 * - `ui` knapper og toppmenyen (20 px)
 * - `underpunkt` underkort i trekkspillet (30 px)
 * - `seksjon` ikonsirkelen i trekkspillet (36 px)
 * - `konsept` datakortene i viktige data (60 px)
 * - `plot` miniplottene for t½ og tss (80 px)
 */
export type Ikonstorrelse = 'tekst' | 'ui' | 'underpunkt' | 'seksjon' | 'konsept' | 'plot'

export interface IkonProps extends Omit<SVGProps<SVGSVGElement>, 'children' | 'ref'> {
  navn: Ikonnavn
  /** En av størrelsene over, eller en CSS-lengde. Utelates: følger teksten. */
  storrelse?: Ikonstorrelse | number | string
  /**
   * Gir ikonet `role="img"` og et navn for skjermlesere. Uten er det
   * dekorativt og skjult for hjelpemiddelteknologi — da skal navnet stå på
   * knappen eller i teksten ved siden av.
   */
  etikett?: string
}

const STORRELSER: readonly string[] = ['tekst', 'ui', 'underpunkt', 'seksjon', 'konsept', 'plot']

/** Brukeren har bedt om mindre bevegelse. CSS-en slår også av animasjonene. */
function roligBevegelse(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Hvor stor andel av ikonet som må være i bildet før det spiller første gang.
 */
const SYNLIG = 0.6

/**
 * Ett OUSFAR-ikon fra Atlas-registeret.
 *
 * Ikonet spiller en kort animasjon én gang når nærmeste `[data-ih]`-forelder
 * (ellers forelderen) får pekeren over seg eller fokus, og første gang det
 * kommer i bildet. Det er aldri kontinuerlig bevegelse, og ingenting spilles
 * med `prefers-reduced-motion`.
 *
 * Fargen på hver del kommer fra semantiske tokens, så samme ikon virker i
 * lyst og mørkt tema. Farge er aldri eneste betydningsbærer: ikonet står
 * alltid sammen med tekst, eller har `etikett`.
 */
export function Ikon({ navn, storrelse = 'tekst', etikett, className, ...rest }: IkonProps) {
  const svg = useRef<SVGSVGElement>(null)
  const [spilt, setSpilt] = useState(0)
  const definisjon: Ikondefinisjon = IKONER[navn] ?? IKONER.fallback

  useEffect(() => {
    const el = svg.current
    if (!el || roligBevegelse()) return
    const vert = el.parentElement?.closest<HTMLElement>('[data-ih]') ?? el.parentElement
    const spill = () => setSpilt((n) => n + 1)
    vert?.addEventListener('mouseenter', spill)
    vert?.addEventListener('focusin', spill)
    let observator: IntersectionObserver | undefined
    if (typeof IntersectionObserver === 'function') {
      observator = new IntersectionObserver(
        (oppforinger) => {
          if (!oppforinger[0]?.isIntersecting) return
          spill()
          observator?.disconnect()
        },
        { threshold: SYNLIG },
      )
      observator.observe(el)
    }
    return () => {
      vert?.removeEventListener('mouseenter', spill)
      vert?.removeEventListener('focusin', spill)
      observator?.disconnect()
    }
  }, [])

  const navngitt = STORRELSER.includes(String(storrelse))
  const lengde = typeof storrelse === 'number' ? `${storrelse}px` : navngitt ? undefined : storrelse
  const spiller = spilt > 0

  return (
    <svg
      ref={svg}
      className={['ikon', className].filter(Boolean).join(' ')}
      viewBox={`0 0 ${definisjon.vb} ${definisjon.vb}`}
      width={lengde ?? '1em'}
      height={lengde ?? '1em'}
      data-ikon={navn}
      data-storrelse={navngitt ? storrelse : undefined}
      data-rutenett={definisjon.vb}
      data-spiller={spiller ? '' : undefined}
      focusable="false"
      {...(etikett ? { role: 'img', 'aria-label': etikett } : { 'aria-hidden': true })}
      {...rest}
    >
      <g transform={definisjon.rot}>
        {/* Nøkkelen tegner delene på nytt for hver avspilling, så animasjonen
            starter fra begynnelsen i stedet for å bli stående ferdig. */}
        <g key={spilt} data-anim={definisjon.ga}>
          {definisjon.parts.map((del, i) => tegn(del, i))}
        </g>
      </g>
      {definisjon.free && <g key={`fri-${spilt}`}>{definisjon.free.map((del, i) => tegn(del, i))}</g>}
    </svg>
  )
}

/** Én del av tegningen. Utseendet for rolle og farge står i `ikon.css`. */
function tegn(del: Ikondel, i: number): ReactElement {
  if (del.t === 'g') {
    return (
      <g key={i} data-anim={del.anim}>
        {del.kids.map((barn, j) => tegn(barn, j))}
      </g>
    )
  }
  const Element = del.t
  // En linje som tegnes opp, måles i andeler av seg selv.
  const lengde = del.pl ?? (del.anim === 'draw' ? 1 : undefined)
  return (
    <Element
      key={i}
      {...del.a}
      data-rolle={del.role}
      data-farge={del.col ? IKONFARGER[del.col] : undefined}
      data-anim={del.anim}
      // Kurvene i miniplottene er tegnet med tynnere strek enn resten.
      data-tynn={del.w ? '' : undefined}
      pathLength={lengde}
      strokeDasharray={del.s?.strokeDasharray}
    />
  )
}
