import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from 'react'

/** Et barn i beholderen: hvor det står og hvor stort det er, målt fra beholderens hjørne. */
interface Boks {
  x: number
  y: number
  bredde: number
  hoyde: number
}

interface Opptak {
  tid: number
  hoyde: number
  barn: Map<Element, Boks>
}

/** Et opptak som ikke ble fulgt av en tegning så lenge, gjelder ikke lenger. */
const FERSKHET = 500

/** Innholdet i et element som endrer størrelse, er tonet inn etter så stor del av tiden. */
const INNTONING = 0.4

/** Mindre enn en halv piksel er ingen flytting. */
const ulik = (a: number, b: number) => Math.abs(a - b) > 0.5
const mellom = (fra: number, til: number, e: number) => fra + (til - fra) * e

/**
 * Lar barna i en beholder gli fra der de sto til der de havner når oppsettet
 * endres (FLIP), så øyet kan følge dem. Et barn som endrer størrelse — et kort
 * som åpnes over hele bredden — vokser eller krymper dit, og innholdet tones
 * inn slik det skal stå; naboene som skyves til en annen rad, glir dit.
 * Beholderens høyde glir med, så det som står under, ikke hopper.
 *
 * Kall funksjonen kroken gir rett før endringen (i klikkhandleren); flyttingen
 * spilles av etter neste tegning. En endring uten det — søket som åpner et
 * kort — skjer straks. `fart` er et fart-token fra `tokens.css`; det er 0 ved
 * `prefers-reduced-motion`, og da flytter ingenting seg. `etter` kalles når
 * alt står på plass.
 */
export function useFlytting(
  beholder: RefObject<HTMLElement>,
  { fart = '--fart-flyt', etter }: { fart?: string; etter?: () => void } = {},
): () => void {
  const opptak = useRef<Opptak | null>(null)
  const stopp = useRef<(() => void) | null>(null)
  const nar = useRef(etter)
  nar.current = etter

  const husk = useCallback(() => {
    const boks = beholder.current
    if (!boks) return
    opptak.current = {
      tid: performance.now(),
      hoyde: boks.getBoundingClientRect().height,
      barn: new Map(barnI(boks).map((el) => [el, maal(el, boks)])),
    }
  }, [beholder])

  // Uten avhengigheter: det er tegningen etter opptaket som spilles av.
  useLayoutEffect(() => {
    const forrige = opptak.current
    opptak.current = null
    const boks = beholder.current
    if (!forrige || !boks || performance.now() - forrige.tid > FERSKHET) return
    stopp.current?.()
    stopp.current = spill(boks, forrige, lesFart(boks, fart), lesKurve(boks), () => {
      stopp.current = null
      nar.current?.()
    })
  })

  useEffect(() => () => stopp.current?.(), [])

  return husk
}

function barnI(boks: HTMLElement): HTMLElement[] {
  return Array.from(boks.children).filter((el): el is HTMLElement => el instanceof HTMLElement)
}

function maal(el: Element, boks: HTMLElement): Boks {
  const r = el.getBoundingClientRect()
  const o = boks.getBoundingClientRect()
  return { x: r.left - o.left, y: r.top - o.top, bredde: r.width, hoyde: r.height }
}

interface Bane {
  el: HTMLElement
  fra: Boks
  til: Boks
  /** Innholdet i et element som endrer størrelse, holdes i den endelige bredden mens det glir. */
  innhold: HTMLElement[]
  dx: number
  dy: number
}

/** Spiller av flyttingen fra `forrige` til oppsettet nå. Gir en funksjon som stopper den og rydder. */
function spill(boks: HTMLElement, forrige: Opptak, ms: number, kurve: (t: number) => number, ferdig: () => void) {
  const baner: Bane[] = []
  const alle = barnI(boks)
  const endelig = new Map(alle.map((el) => [el, maal(el, boks)]))
  for (const el of alle) {
    const fra = forrige.barn.get(el)
    if (!fra) continue
    const til = endelig.get(el)!
    const vokser = ulik(fra.bredde, til.bredde) || ulik(fra.hoyde, til.hoyde)
    if (!vokser && !ulik(fra.x, til.x) && !ulik(fra.y, til.y)) continue
    const innhold = vokser ? barnI(el) : []
    baner.push({ el, fra, til, innhold, dx: 0, dy: 0 })
  }
  const hoyde = boks.getBoundingClientRect().height
  const glirHoyde = ulik(forrige.hoyde, hoyde)
  if (ms <= 0 || (baner.length === 0 && !glirHoyde)) {
    ferdig()
    return () => {}
  }

  // Et barn som vokser, skal ikke strekke naboene i raden sin: alle andre står
  // i sin endelige høyde mens det glir.
  const faste = alle.filter((el) => !baner.some((b) => b.el === el && b.innhold.length > 0))
  for (const el of faste) el.style.height = `${endelig.get(el)!.hoyde}px`
  boks.style.alignItems = 'start'
  // Innholdet står i den endelige bredden hele veien og klippes av rammen.
  for (const b of baner) {
    if (b.innhold.length === 0) continue
    for (const del of b.innhold) {
      del.style.width = `${del.getBoundingClientRect().width}px`
      del.style.flex = 'none'
    }
    b.el.style.overflow = 'hidden'
  }

  let ramme = 0
  const start = performance.now()
  const rydd = () => {
    cancelAnimationFrame(ramme)
    boks.style.removeProperty('height')
    boks.style.removeProperty('align-items')
    for (const el of faste) el.style.removeProperty('height')
    for (const b of baner) {
      for (const egenskap of ['transform', 'width', 'height', 'overflow']) b.el.style.removeProperty(egenskap)
      for (const del of b.innhold) for (const egenskap of ['width', 'flex', 'opacity']) del.style.removeProperty(egenskap)
    }
  }
  const steg = (na: number) => {
    const t = Math.min(1, Math.max(0, (na - start) / ms))
    const e = kurve(t)
    // Først størrelsene, så oppsettet de gir, så forskyvningene som legger alt der det skal stå nå.
    if (glirHoyde) boks.style.height = `${mellom(forrige.hoyde, hoyde, e)}px`
    for (const b of baner) {
      if (b.innhold.length === 0) continue
      b.el.style.width = `${mellom(b.fra.bredde, b.til.bredde, e)}px`
      b.el.style.height = `${mellom(b.fra.hoyde, b.til.hoyde, e)}px`
      const synlig = String(Math.min(1, t / INNTONING))
      for (const del of b.innhold) del.style.opacity = synlig
    }
    const o = boks.getBoundingClientRect()
    const steder = baner.map((b) => {
      const r = b.el.getBoundingClientRect()
      return { x: r.left - o.left - b.dx, y: r.top - o.top - b.dy }
    })
    baner.forEach((b, i) => {
      b.dx = mellom(b.fra.x, b.til.x, e) - steder[i]!.x
      b.dy = mellom(b.fra.y, b.til.y, e) - steder[i]!.y
      b.el.style.transform = `translate(${b.dx}px, ${b.dy}px)`
    })
    if (t < 1) {
      ramme = requestAnimationFrame(steg)
    } else {
      rydd()
      ferdig()
    }
  }
  // Første bilde tegnes nå, så det endelige oppsettet aldri blinker fram.
  steg(start)
  return rydd
}

/** Et fart-token (`340ms`, `0.34s`) i millisekunder; 0 når det mangler. */
function lesFart(el: Element, token: string): number {
  const verdi = getComputedStyle(el).getPropertyValue(token).trim()
  const tall = parseFloat(verdi)
  if (!Number.isFinite(tall)) return 0
  return verdi.endsWith('ms') ? tall : verdi.endsWith('s') ? tall * 1000 : 0
}

/** `--kurve` som funksjon av tiden. Uten token: en myk utfasing. */
function lesKurve(el: Element): (t: number) => number {
  const treff = /cubic-bezier\(([^)]+)\)/.exec(getComputedStyle(el).getPropertyValue('--kurve'))
  const tall = treff?.[1]!.split(',').map(Number) ?? []
  if (tall.length !== 4 || tall.some((n) => !Number.isFinite(n))) return (t) => 1 - (1 - t) ** 3
  const [x1, y1, x2, y2] = tall as [number, number, number, number]
  const bezier = (a: number, b: number, s: number) => 3 * a * s * (1 - s) ** 2 + 3 * b * s * s * (1 - s) + s ** 3
  return (t) => {
    if (t <= 0 || t >= 1) return t
    // Finn s der x(s) = t (halvering; x er stigende for gyldige kurver), og gi y(s).
    let lav = 0
    let hoy = 1
    for (let i = 0; i < 20; i++) {
      const s = (lav + hoy) / 2
      if (bezier(x1, x2, s) < t) lav = s
      else hoy = s
    }
    return bezier(y1, y2, (lav + hoy) / 2)
  }
}
