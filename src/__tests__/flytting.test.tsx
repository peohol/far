// @vitest-environment jsdom
/**
 * Flyttingen av kortene i et rutenett (`useFlytting`): jsdom har ikke noe
 * oppsett, så her står hvert element der testen sier, og tiden styres av
 * falske klokker.
 */
import { act, render } from '@testing-library/react'
import { useRef, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useFlytting } from '../hooks/useFlytting'

/** Oppsettet testen bestemmer: element-ID → [x, y, bredde, høyde] i gjeldende tilstand. */
let oppsett: Record<string, [number, number, number, number]> = {}

function Rutenett({ fart, etter }: { fart: string; etter: () => void }) {
  const boks = useRef<HTMLDivElement>(null)
  const [apen, setApen] = useState(false)
  const husk = useFlytting(boks, { etter })
  return (
    <div ref={boks} data-testid="boks" style={{ ['--fart-flyt' as string]: fart }}>
      <button
        id="a"
        onClick={() => {
          husk()
          setApen((a) => !a)
        }}
      >
        <span>innhold</span>
      </button>
      <div id="b" data-apen={apen || undefined} />
    </div>
  )
}

/** Et element står der `oppsett` sier, pluss den forskyvningen kroken har lagt på. */
function rekt(this: HTMLElement): DOMRect {
  const [x, y, bredde, hoyde] = oppsett[this.id || this.dataset.testid!] ?? [0, 0, 0, 0]
  const flytt = /translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec(this.style.transform)
  const dx = flytt ? Number(flytt[1]) : 0
  const dy = flytt ? Number(flytt[2]) : 0
  const b = this.style.width ? parseFloat(this.style.width) : bredde
  const h = this.style.height ? parseFloat(this.style.height) : hoyde
  return { x: x + dx, y: y + dy, left: x + dx, top: y + dy, width: b, height: h, right: x + dx + b, bottom: y + dy + h, toJSON: () => ({}) }
}

describe('flyttingen av kortene', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] })
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(rekt)
    oppsett = { boks: [0, 0, 300, 100], a: [0, 0, 100, 100], b: [110, 0, 100, 100] }
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('lar naboen gli fra der den sto, og kortet vokse, til alt står på plass', () => {
    const etter = vi.fn()
    const { getByTestId, container } = render(<Rutenett fart="200ms" etter={etter} />)
    const a = container.querySelector<HTMLElement>('#a')!
    const b = container.querySelector<HTMLElement>('#b')!
    const boks = getByTestId('boks')

    // Kortet a åpnes over hele bredden, og b skyves ned på neste rad.
    act(() => {
      a.click()
      oppsett = { boks: [0, 0, 300, 250], a: [0, 0, 300, 140], b: [0, 150, 100, 100] }
    })
    // Første bilde: alt står der det sto.
    expect(b.style.transform).toBe('translate(110px, -150px)')
    expect(a.style.width).toBe('100px')
    expect(a.style.height).toBe('100px')
    expect(boks.style.height).toBe('100px')
    // Innholdet står i den endelige bredden og tones inn.
    expect(a.querySelector('span')!.style.opacity).toBe('0')
    expect(etter).not.toHaveBeenCalled()

    // Halvveis står b mellom de to plassene, og kortet er mellom de to størrelsene.
    act(() => vi.advanceTimersByTime(100))
    const [, x, y] = /translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec(b.style.transform)!.map(Number)
    expect(x).toBeGreaterThan(0)
    expect(x).toBeLessThan(110)
    expect(y).toBeLessThan(0)
    expect(y).toBeGreaterThan(-150)
    expect(parseFloat(a.style.width)).toBeGreaterThan(100)
    expect(parseFloat(a.style.width)).toBeLessThan(300)

    // Ferdig: ingen stiler igjen, og `etter` er kalt én gang.
    act(() => vi.advanceTimersByTime(200))
    for (const el of [a, b, boks, a.querySelector('span')!]) expect(el.getAttribute('style') ?? '').not.toMatch(/transform|width|height|opacity|align-items/)
    expect(etter).toHaveBeenCalledTimes(1)
  })

  it('flytter ingenting uten fart, som ved redusert bevegelse', () => {
    const etter = vi.fn()
    const { container } = render(<Rutenett fart="0ms" etter={etter} />)
    const b = container.querySelector<HTMLElement>('#b')!
    act(() => {
      container.querySelector<HTMLElement>('#a')!.click()
      oppsett = { boks: [0, 0, 300, 250], a: [0, 0, 300, 140], b: [0, 150, 100, 100] }
    })
    expect(b.style.transform).toBe('')
    expect(etter).toHaveBeenCalledTimes(1)
  })
})
