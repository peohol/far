// @vitest-environment jsdom
/**
 * Rikteksten i lesemodus og editoren: overskriftene, skillelinjene, sitatene
 * og koden editoren kan sette inn, og tegnmenyen. Overskriftene legger seg
 * under den nærmeste overskriften rundt teksten.
 */
import { act, cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { UnderOverskrift } from '../components/Overskriftsniva'
import { Riktekst } from '../components/stoffside/Riktekst'
import { Rikteksteditor } from '../components/stoffside/Rikteksteditor'
import { rensDokument, type Riktekstdokument } from '../faginnhold/riktekst'

afterEach(cleanup)

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  // Editoren ruller markøren fram når den får fokus; jsdom kan ikke måle.
  Range.prototype.getClientRects ??= () => ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] }) as unknown as DOMRectList
  Range.prototype.getBoundingClientRect ??= () => new DOMRect()
})

const overskrifter = (): Riktekstdokument =>
  rensDokument({
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Nivå 1' }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Nivå 2' }] },
    ],
  })

describe('rikteksten i lesemodus', () => {
  it('viser overskrifter under sidens egne og en skillelinje mellom avsnittene', () => {
    const { container } = render(
      <Riktekst
        dokument={rensDokument({
          type: 'doc',
          content: [
            { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Dosering' }] },
            { type: 'paragraph', content: [{ type: 'text', text: 'Første avsnitt' }] },
            { type: 'horizontalRule' },
            { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Voksne' }] },
          ],
        })}
      />,
    )
    expect(screen.getByRole('heading', { level: 3, name: 'Dosering' })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 4, name: 'Voksne' })).toBeTruthy()
    expect(screen.getByRole('separator')).toBeTruthy()
    expect([...container.firstElementChild!.children].map((e) => e.tagName)).toEqual(['H3', 'P', 'HR', 'H4'])
  })

  it('legger overskriftene under overskriften rundt teksten, og aldri dypere enn h6', () => {
    render(
      <UnderOverskrift niva={4}>
        <Riktekst dokument={overskrifter()} />
      </UnderOverskrift>,
    )
    expect(screen.getByRole('heading', { level: 5, name: 'Nivå 1' }).getAttribute('data-niva')).toBe('1')
    expect(screen.getByRole('heading', { level: 6, name: 'Nivå 2' }).getAttribute('data-niva')).toBe('2')
    cleanup()

    render(
      <UnderOverskrift niva={5}>
        <Riktekst dokument={overskrifter()} />
      </UnderOverskrift>,
    )
    expect(screen.getAllByRole('heading', { level: 6 }).map((h) => h.textContent)).toEqual(['Nivå 1', 'Nivå 2'])
  })

  it('viser overskriftene i editoren som i lesemodus, under overskriften rundt', async () => {
    const { container } = render(
      <UnderOverskrift niva={3}>
        <Rikteksteditor dokument={overskrifter()} onEndre={() => {}} etikett="Tekst" referanser={false} />
      </UnderOverskrift>,
    )
    await screen.findByRole('textbox', { name: 'Tekst' })
    const felt = container.querySelector('.riktekstfelt')!
    expect([...felt.children].map((e) => `${e.tagName}:${e.getAttribute('data-niva')}`)).toEqual(['H4:1', 'H5:2'])
  })
})

describe('sitater og kode i lesemodus', () => {
  it('viser sitatet som et sitat og koden som kode', () => {
    const { container } = render(
      <Riktekst
        dokument={rensDokument({
          type: 'doc',
          content: [
            { type: 'blockquote', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Sitert' }] }] },
            { type: 'paragraph', content: [{ type: 'text', text: 'f(x)', marks: [{ type: 'code' }] }] },
          ],
        })}
      />,
    )
    expect(container.querySelector('blockquote > p')?.textContent).toBe('Sitert')
    expect(container.querySelector('p > code')?.textContent).toBe('f(x)')
  })
})

describe('tegnmenyen', () => {
  beforeEach(() => localStorage.clear())

  const visEditor = () => {
    const endringer: Riktekstdokument[] = []
    render(<Rikteksteditor dokument={rensDokument(null)} onEndre={(d) => endringer.push(d)} etikett="Tekst" referanser={false} />)
    return endringer
  }

  it('åpnes ved knappen med gruppene fra mdeditz, setter inn tegn og blir stående til Escape', async () => {
    const user = userEvent.setup()
    const endringer = visEditor()
    const knapp = await screen.findByRole('button', { name: 'Sett inn spesialtegn' })
    expect(knapp.getAttribute('aria-haspopup')).toBe('dialog')

    await user.click(knapp)
    const meny = screen.getByRole('dialog', { name: 'Spesialtegn' })
    expect(knapp.getAttribute('aria-expanded')).toBe('true')
    const faner = within(within(meny).getByRole('group', { name: 'Grupper' })).getAllByRole('button')
    expect(faner.map((f) => f.textContent)).toEqual([
      'Piler',
      'Matematikk',
      'Gresk',
      'Typografi',
      'Merker',
      'Valuta og enheter',
      'Tastatur',
      'Bokstaver',
    ])

    await user.click(within(meny).getByRole('button', { name: 'Gresk' }))
    await user.click(within(meny).getByRole('button', { name: 'Alfa' }))
    await user.click(within(meny).getByRole('button', { name: 'Beta' }))
    expect(JSON.stringify(endringer.at(-1))).toContain('αβ')
    // Menyen blir stående for neste tegn.
    expect(screen.getByRole('dialog', { name: 'Spesialtegn' })).toBe(meny)

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Spesialtegn' })).toBeNull()
    expect(knapp.getAttribute('aria-expanded')).toBe('false')

    // Neste gang står de sist brukte først, og gruppa man stod i, er valgt.
    await user.click(knapp)
    const igjen = screen.getByRole('dialog', { name: 'Spesialtegn' })
    const nyeFaner = within(within(igjen).getByRole('group', { name: 'Grupper' })).getAllByRole('button')
    expect(nyeFaner[0]!.textContent).toBe('Nylig')
    expect(within(igjen).getByRole('button', { name: 'Gresk' }).getAttribute('aria-pressed')).toBe('true')
    await user.click(nyeFaner[0]!)
    expect(within(within(igjen).getByRole('group', { name: 'Nylig' })).getAllByRole('button').map((b) => b.textContent)).toEqual(['β', 'α'])

    // Et trykk utenfor lukker også.
    await user.click(document.body)
    expect(screen.queryByRole('dialog', { name: 'Spesialtegn' })).toBeNull()
    await act(async () => {})
  })

  it('tar fokus inn i menyen når den åpnes med tastaturet, og piltastene bytter gruppe', async () => {
    const user = userEvent.setup()
    visEditor()
    const knapp = await screen.findByRole('button', { name: 'Sett inn spesialtegn' })
    knapp.focus()
    await user.keyboard('{Enter}')
    const meny = screen.getByRole('dialog', { name: 'Spesialtegn' })
    expect(document.activeElement).toBe(within(meny).getByRole('button', { name: 'Piler' }))
    await user.keyboard('{ArrowRight}')
    await act(() => new Promise((ferdig) => requestAnimationFrame(() => ferdig(undefined))))
    expect(within(meny).getByRole('button', { name: 'Matematikk' }).getAttribute('aria-pressed')).toBe('true')
    expect(document.activeElement).toBe(within(meny).getByRole('button', { name: 'Matematikk' }))
  })
})

