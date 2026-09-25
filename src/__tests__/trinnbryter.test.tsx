// @vitest-environment jsdom
/**
 * Trinnbryteren, prøvd i en nettleser i minnet: at valget kan trykkes, dras og
 * velges med tastaturet, og at knotten legger seg på valget som står. Selve
 * bevegelsen og fokusringen er CSS og prøves ikke her.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { Trinnbryter, trinnVed, type Trinnvalg } from '../components/Trinnbryter'
import { medPekerhendelser, trykkPaaValg } from './hjelp/pekerhendelser'

beforeAll(medPekerhendelser)

afterEach(cleanup)

const VALG: Trinnvalg<string>[] = [
  { verdi: 'a', merke: 'Første' },
  { verdi: 'b', merke: 'Andre' },
  { verdi: 'c', merke: 'Tredje' },
]

/** Sporet begynner 100 px inn i vinduet, og hvert valg er 100 px bredt. */
const VENSTRE = 100
const TRINN = 100

function visBryter(start = 'b') {
  const onVelg = vi.fn()
  function Bryter() {
    const [verdi, setVerdi] = useState(start)
    return (
      <Trinnbryter
        etikett="Margin"
        valg={VALG}
        verdi={verdi}
        onVelg={(v) => {
          onVelg(v)
          setVerdi(v)
        }}
      />
    )
  }
  const { container } = render(<Bryter />)
  const spor = container.querySelector<HTMLElement>('.trinnbryter__spor')!
  spor.getBoundingClientRect = () => ({ left: VENSTRE, width: TRINN * VALG.length }) as DOMRect
  const skala = screen.getByRole('slider', { name: 'Margin' })
  const knott = () => container.querySelector<HTMLElement>('.trinnbryter__knott')
  const bryter = container.querySelector<HTMLElement>('.trinnbryter')!
  return { onVelg, spor, skala, knott, bryter }
}

/** Et punkt i vinduet `x` piksler inn i valgene. */
const ved = (x: number) => ({ clientX: VENSTRE + x, button: 0, pointerId: 7 })

describe('valget under et punkt', () => {
  it('er valget punktet ligger i, med grensen på første piksel i det neste', () => {
    expect(trinnVed(0, 100, 3)).toBe(0)
    expect(trinnVed(99.9, 100, 3)).toBe(0)
    expect(trinnVed(100, 100, 3)).toBe(1)
    expect(trinnVed(199.9, 100, 3)).toBe(1)
    expect(trinnVed(200, 100, 3)).toBe(2)
    expect(trinnVed(299.9, 100, 3)).toBe(2)
  })

  it('er det nærmeste valget utenfor bryteren, og det første før den er målt', () => {
    expect(trinnVed(-40, 100, 3)).toBe(0)
    expect(trinnVed(1000, 100, 3)).toBe(2)
    expect(trinnVed(50, 0, 3)).toBe(0)
  })
})

describe('trinnbryteren', () => {
  it('er en skala som melder valget med merket, og viser alle valgene', () => {
    const { skala, knott } = visBryter()
    expect(skala.getAttribute('min')).toBe('0')
    expect(skala.getAttribute('max')).toBe('2')
    expect(skala.getAttribute('aria-valuetext')).toBe('Andre')
    expect(knott()).toBeTruthy()
    for (const { merke } of VALG) expect(screen.getByText(merke)).toBeTruthy()
    expect(screen.getByText('Andre').className).toContain('trinnbryter__valg--valgt')
  })

  it('velger det som trykkes på, og gir fokus til skalaen uten fokusring', () => {
    const { onVelg, spor, skala, bryter } = visBryter()
    fireEvent.pointerDown(spor, ved(250))
    fireEvent.pointerUp(spor, ved(250))
    expect(onVelg.mock.calls).toEqual([['c']])
    expect(skala.getAttribute('aria-valuetext')).toBe('Tredje')
    expect(document.activeElement).toBe(skala)
    expect(bryter.className).toContain('trinnbryter--peker')

    // Tastaturet tar over der pekeren slapp, og da står ringen igjen.
    fireEvent.keyDown(skala, { key: 'ArrowLeft' })
    expect(bryter.className).not.toContain('trinnbryter--peker')
  })

  it('velger det valget en finger trykker midt på', () => {
    const { onVelg } = visBryter()
    trykkPaaValg('Første')
    expect(onVelg.mock.calls).toEqual([['a']])
  })

  it('velger ved grensen mellom to valg det pekeren står i', () => {
    const { onVelg, spor } = visBryter()
    fireEvent.pointerDown(spor, ved(99.9))
    fireEvent.pointerUp(spor, ved(99.9))
    expect(onVelg).toHaveBeenLastCalledWith('a')
    fireEvent.pointerDown(spor, ved(200))
    fireEvent.pointerUp(spor, ved(200))
    expect(onVelg).toHaveBeenLastCalledWith('c')
  })

  it('lar et trykk på valget som står, være', () => {
    const { onVelg, spor } = visBryter()
    fireEvent.pointerDown(spor, ved(150))
    // En skjelven hånd er fortsatt et trykk, ikke et drag.
    fireEvent.pointerMove(spor, ved(152))
    fireEvent.pointerUp(spor, ved(152))
    expect(onVelg).not.toHaveBeenCalled()
  })

  it('lar knotten følge pekeren når den dras, og legger den på det nærmeste valget når den slippes', () => {
    const { onVelg, spor, skala, knott, bryter } = visBryter()
    // Grepet 10 px til høyre for midten av knotten, som står på «Andre».
    fireEvent.pointerDown(spor, ved(160))
    fireEvent.pointerMove(spor, ved(190))
    expect(bryter.className).toContain('trinnbryter--drar')
    expect(knott()!.style.transform).toBe('translateX(130px)')
    expect(onVelg).not.toHaveBeenCalled()

    // Midten av knotten over i «Tredje»: valget følger med alt under draget.
    fireEvent.pointerMove(spor, ved(215))
    expect(knott()!.style.transform).toBe('translateX(155px)')
    expect(onVelg.mock.calls).toEqual([['c']])

    fireEvent.pointerUp(spor, ved(215))
    expect(bryter.className).not.toContain('trinnbryter--drar')
    expect(knott()!.style.transform).toBe('')
    expect(skala.getAttribute('aria-valuetext')).toBe('Tredje')
    expect(onVelg).toHaveBeenCalledOnce()
  })

  it('holder knotten innenfor bryteren når den dras forbi kanten', () => {
    const { onVelg, spor, knott } = visBryter()
    fireEvent.pointerDown(spor, ved(150))
    fireEvent.pointerMove(spor, ved(900))
    expect(knott()!.style.transform).toBe('translateX(200px)')
    fireEvent.pointerMove(spor, ved(-400))
    expect(knott()!.style.transform).toBe('translateX(0px)')
    fireEvent.pointerUp(spor, ved(-400))
    expect(onVelg).toHaveBeenLastCalledWith('a')
  })

  it('beholder det som er valgt når draget avbrytes', () => {
    const { onVelg, spor, knott, bryter } = visBryter()
    fireEvent.pointerDown(spor, ved(150))
    fireEvent.pointerMove(spor, ved(60))
    expect(onVelg).toHaveBeenLastCalledWith('a')
    fireEvent.pointerCancel(spor, ved(60))
    expect(bryter.className).not.toContain('trinnbryter--drar')
    expect(knott()!.style.transform).toBe('')
    // Pekeren som ble borte, velger ingenting når den slippes.
    fireEvent.pointerUp(spor, ved(250))
    expect(onVelg).toHaveBeenCalledOnce()
  })

  it('bryr seg ikke om andre museknapper enn den vanlige', () => {
    const { onVelg, spor } = visBryter()
    fireEvent.pointerDown(spor, { ...ved(250), button: 2 })
    fireEvent.pointerUp(spor, { ...ved(250), button: 2 })
    expect(onVelg).not.toHaveBeenCalled()
  })

  it('velges med tastaturet gjennom skalaen', () => {
    const { onVelg, skala } = visBryter()
    fireEvent.change(skala, { target: { value: '0' } })
    expect(onVelg.mock.calls).toEqual([['a']])
    expect(skala.getAttribute('aria-valuetext')).toBe('Første')
  })

  it('står på ingen av valgene når verdien ikke er blant dem', () => {
    const { skala, knott } = visBryter('x')
    expect(skala.getAttribute('aria-valuetext')).toBeNull()
    expect(knott()).toBeNull()
    expect(document.querySelector('.trinnbryter__valg--valgt')).toBeNull()
  })
})
