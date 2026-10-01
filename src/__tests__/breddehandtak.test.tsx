// @vitest-environment jsdom
/**
 * Breddehåndtaket, prøvd i en nettleser i minnet: at kanten kan dras og flyttes
 * med tastaturet innenfor grensene, og at bredden meldes underveis og lagres
 * når den er ferdig endret. Grensene og bredden er gitt; i appen måles de.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { Breddehandtak, type Breddemaal } from '../components/Breddehandtak'
import { medPekerhendelser } from './hjelp/pekerhendelser'

beforeAll(medPekerhendelser)

afterEach(cleanup)

function visHandtak(kant: 'venstre' | 'hoyre' = 'venstre', start = 500) {
  const naa: Breddemaal = { bredde: start, minst: 448, mest: 900 }
  const onEndre = vi.fn((bredde: number) => void (naa.bredde = bredde))
  const onFerdig = vi.fn()
  render(<Breddehandtak etikett="Bredden" kant={kant} maal={() => ({ ...naa })} onEndre={onEndre} onFerdig={onFerdig} />)
  return { handtak: screen.getByRole('separator', { name: 'Bredden' }), onEndre, onFerdig }
}

const ved = (x: number) => ({ clientX: x, button: 0, pointerId: 3 })

describe('med pekeren', () => {
  it('gjør flaten bredere når venstre kant dras til venstre, og lagrer når den slippes', () => {
    const { handtak, onEndre, onFerdig } = visHandtak()
    fireEvent.pointerDown(handtak, ved(1000))
    expect(handtak.dataset.drar).toBeDefined()
    fireEvent.pointerMove(handtak, ved(900))
    expect(onEndre).toHaveBeenLastCalledWith(600)
    expect(onFerdig).not.toHaveBeenCalled()
    fireEvent.pointerUp(handtak, ved(880))
    expect(onFerdig).toHaveBeenCalledWith(620)
    expect(handtak.dataset.drar).toBeUndefined()
  })

  it('holder bredden innenfor grensene', () => {
    const { handtak, onEndre, onFerdig } = visHandtak()
    fireEvent.pointerDown(handtak, ved(1000))
    fireEvent.pointerMove(handtak, ved(1500))
    expect(onEndre).toHaveBeenLastCalledWith(448)
    fireEvent.pointerMove(handtak, ved(0))
    expect(onEndre).toHaveBeenLastCalledWith(900)
    fireEvent.pointerUp(handtak, ved(0))
    expect(onFerdig).toHaveBeenCalledWith(900)
  })

  it('følger retningen når håndtaket står på høyre kant', () => {
    const { handtak, onFerdig } = visHandtak('hoyre')
    fireEvent.pointerDown(handtak, ved(1000))
    fireEvent.pointerUp(handtak, ved(1050))
    expect(onFerdig).toHaveBeenCalledWith(550)
  })

  it('lagrer ingenting for et trykk uten drag, og går til minste bredde ved dobbeltklikk', () => {
    const { handtak, onFerdig } = visHandtak()
    fireEvent.pointerDown(handtak, ved(1000))
    fireEvent.pointerUp(handtak, ved(1000))
    expect(onFerdig).not.toHaveBeenCalled()
    fireEvent.doubleClick(handtak)
    expect(onFerdig).toHaveBeenCalledWith(448)
  })
})

describe('med tastaturet', () => {
  it('flytter kanten med piltastene, Shift for større steg, og lagrer når tasten slippes', () => {
    const { handtak, onEndre, onFerdig } = visHandtak()
    fireEvent.keyDown(handtak, { key: 'ArrowLeft' })
    expect(onEndre).toHaveBeenLastCalledWith(516)
    fireEvent.keyDown(handtak, { key: 'ArrowLeft', shiftKey: true })
    expect(onEndre).toHaveBeenLastCalledWith(580)
    expect(onFerdig).not.toHaveBeenCalled()
    fireEvent.keyUp(handtak, { key: 'ArrowLeft' })
    expect(onFerdig).toHaveBeenCalledWith(580)
    fireEvent.keyDown(handtak, { key: 'ArrowRight' })
    expect(onEndre).toHaveBeenLastCalledWith(564)
  })

  it('går til minste og største bredde med Home og End, og melder bredden og grensene', () => {
    const { handtak, onEndre } = visHandtak()
    expect(handtak.getAttribute('aria-valuenow')).toBe('500')
    expect(handtak.getAttribute('aria-valuemin')).toBe('448')
    expect(handtak.getAttribute('aria-valuemax')).toBe('900')
    fireEvent.keyDown(handtak, { key: 'End' })
    expect(onEndre).toHaveBeenLastCalledWith(900)
    expect(handtak.getAttribute('aria-valuenow')).toBe('900')
    fireEvent.keyDown(handtak, { key: 'Home' })
    expect(onEndre).toHaveBeenLastCalledWith(448)
  })

  it('lar andre taster være', () => {
    const { handtak, onEndre, onFerdig } = visHandtak()
    fireEvent.keyDown(handtak, { key: 'Enter' })
    fireEvent.keyUp(handtak, { key: 'Enter' })
    expect(onEndre).not.toHaveBeenCalled()
    expect(onFerdig).not.toHaveBeenCalled()
  })
})

describe('et drag som avbrytes', () => {
  it('setter bredden tilbake og lagrer ingenting', () => {
    const { handtak, onEndre, onFerdig } = visHandtak()
    fireEvent.pointerDown(handtak, ved(1000))
    fireEvent.pointerMove(handtak, ved(900))
    fireEvent.pointerCancel(handtak, ved(900))
    expect(onEndre).toHaveBeenLastCalledWith(500)
    expect(onFerdig).not.toHaveBeenCalled()
  })
})
