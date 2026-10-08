// @vitest-environment jsdom
/**
 * Lange tekster i trådene: bare de første linjene vises, til knappen under
 * viser resten, og legger den sammen igjen. En tekst som bare er litt lengre
 * enn det som vises, vises hel.
 *
 * Testmiljøet har ingen oppsett: høyden på teksten og høyden som vises
 * (`--langtekst-hoyde`, målt med en prøve) settes her.
 */
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Langtekst } from '../components/traad/Langtekst'

const VIST = 200
let tekstHoyde = 0

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(() => tekstHoyde)
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => new DOMRect(0, 0, VIST, 0))
  Element.prototype.scrollIntoView ??= function () {}
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const vis = () => render(<Langtekst hva="innlegget"><p>Teksten</p></Langtekst>)

describe('Langtekst', () => {
  it('viser en kort tekst hel, uten knapp', () => {
    tekstHoyde = 120
    vis()
    expect(screen.queryByRole('button')).toBeNull()
    expect(document.querySelector('.langtekst')!.hasAttribute('data-lang')).toBe(false)
  })

  it('viser også en tekst som bare er litt lengre enn det som vises, hel', () => {
    tekstHoyde = VIST * 1.2
    vis()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('legger en lang tekst sammen, viser hele med knappen og legger den sammen igjen', async () => {
    tekstHoyde = 900
    const bruker = userEvent.setup()
    vis()
    const rot = document.querySelector<HTMLElement>('.langtekst')!
    expect(rot.hasAttribute('data-lang')).toBe(true)
    expect(rot.hasAttribute('data-apen')).toBe(false)
    const knapp = screen.getByRole('button', { name: 'Vis hele innlegget' })
    expect(knapp.getAttribute('aria-expanded')).toBe('false')
    expect(document.getElementById(knapp.getAttribute('aria-controls')!)!.style.getPropertyValue('--langtekst-hel')).toBe('900px')

    await bruker.click(knapp)
    expect(rot.hasAttribute('data-apen')).toBe(true)
    expect(knapp.getAttribute('aria-expanded')).toBe('true')
    expect(knapp.textContent).toBe('Vis mindre')

    await bruker.click(knapp)
    expect(rot.hasAttribute('data-apen')).toBe(false)
    expect(knapp.textContent).toBe('Vis hele innlegget')
  })
})
