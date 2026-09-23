// @vitest-environment jsdom
/**
 * Referansepillen, boblen og referanselisten, prøvd i en nettleser i minnet.
 *
 * Pillen skal kunne brukes med mus, berøring og tastatur, og være forståelig
 * for skjermlesere. Komponentene settes opp alene, med en syntetisk side —
 * analyttsidene bygges i en senere arbeidspakke.
 */
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { Referanseliste } from '../components/referanser/Referanseliste'
import { Referansepille } from '../components/referanser/Referansepille'
import { Sidereferanser } from '../components/referanser/Sidereferanser'
import { SITERING, sidereferanser, type Referanse, type Sidegrunnlag } from '../faginnhold/referanser'

beforeAll(() => {
  // jsdom mangler ResizeObserver, som plasseringen av boblen bruker.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})

afterEach(cleanup)

const REFERANSER: Referanse[] = [
  { id: 'a', tittel: 'Første kilde', forfattere: 'Nordmann O', aar: '2019', lenke: 'https://example.org/a' },
  { id: 'b', tittel: 'Andre kilde', forfattere: 'Hansen K', aar: '2020', lenke: '' },
  { id: 'c', tittel: 'Tredje kilde', forfattere: '', aar: '2021', lenke: 'https://example.org/c' },
  { id: 'd', tittel: 'Ubrukt kilde', forfattere: '', aar: '', lenke: '' },
]

function sitering(...referanser: string[]) {
  return { type: SITERING, attrs: { referanser } }
}

/** En side med en panelreferanse, en kortreferanse og siteringer i teksten. */
const SIDE: Sidegrunnlag = {
  panelreferanser: { dynamikk: ['c'] },
  elementer: [
    {
      id: 'kort',
      panel: 'dynamikk',
      posisjon: 0,
      referanser: ['b'],
      data: { tekst: { type: 'doc', content: [{ type: 'paragraph', content: [sitering('a', 'b', 'c')] }] } },
    },
  ],
}

function Side() {
  const { nummerering } = sidereferanser(SIDE, REFERANSER, ['dynamikk'])
  return (
    <Sidereferanser nummerering={nummerering} referanser={REFERANSER}>
      <h2>
        Farmakodynamikk <Referansepille ider={['c']} niva="panel" />
      </h2>
      <h3>
        Kort <Referansepille ider={['b']} niva="element" />
      </h3>
      <p>
        Tekst med sitering
        <Referansepille ider={['a', 'b', 'c']} />. Mer tekst.
      </p>
      <button type="button">Etter</button>
      <Referanseliste />
    </Sidereferanser>
  )
}

function pille(navn: RegExp | string) {
  return screen.getByRole('button', { name: navn })
}

/** Boblen pillen styrer. */
function bobleTil(knapp: HTMLElement) {
  return document.getElementById(knapp.getAttribute('aria-controls')!)!
}

describe('pillen', () => {
  it('viser numrene på siden, komprimert, og har et navn skjermlesere kan lese', () => {
    render(<Side />)
    // Panelet først (C = 1), så kortet (B = 2), så teksten (A = 3).
    expect(pille('Referanse 1')).toHaveProperty('textContent', '1')
    expect(pille('Referanse 2')).toHaveProperty('textContent', '2')
    const inline = pille('Referanser 1–3')
    expect(inline.textContent).toBe('1–3')
    expect(inline.closest('sup')).not.toBeNull()
    expect(pille('Referanse 1').closest('sup')).toBeNull()
    for (const knapp of screen.getAllByRole('button', { name: /Referanse/ })) {
      expect(knapp.getAttribute('aria-expanded')).toBe('false')
    }
  })

  it('åpnes ved peker over, og lukkes når pekeren går', async () => {
    const bruker = userEvent.setup()
    render(<Side />)
    const inline = pille('Referanser 1–3')
    await bruker.hover(inline)
    expect(inline.getAttribute('aria-expanded')).toBe('true')
    expect(within(bobleTil(inline)).getAllByRole('listitem').map((p) => p.textContent)).toEqual([
      '1Tredje kilde · 2021 · https://example.org/c',
      '2Andre kilde · Hansen K · 2020',
      '3Første kilde · Nordmann O · 2019 · https://example.org/a',
    ])

    await bruker.unhover(inline)
    await waitFor(() => expect(inline.getAttribute('aria-expanded')).toBe('false'))
  })

  it('blir stående når pekeren flytter seg inn i boblen', async () => {
    const bruker = userEvent.setup()
    render(<Side />)
    const inline = pille('Referanser 1–3')
    await bruker.hover(inline)
    const lenke = within(bobleTil(inline)).getByRole('link', { name: 'https://example.org/a' })
    await bruker.hover(lenke)
    await new Promise((ferdig) => setTimeout(ferdig, 250))
    expect(inline.getAttribute('aria-expanded')).toBe('true')
    expect(lenke.getAttribute('target')).toBe('_blank')
    expect(lenke.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it('festes med et klikk, og lukkes med et nytt klikk eller et klikk utenfor', async () => {
    const bruker = userEvent.setup()
    render(<Side />)
    const inline = pille('Referanser 1–3')
    await bruker.click(inline)
    await bruker.unhover(inline)
    await new Promise((ferdig) => setTimeout(ferdig, 250))
    expect(inline.getAttribute('aria-expanded')).toBe('true')

    await bruker.click(inline)
    expect(inline.getAttribute('aria-expanded')).toBe('false')

    await bruker.click(inline)
    expect(inline.getAttribute('aria-expanded')).toBe('true')
    await bruker.click(screen.getByRole('button', { name: 'Etter' }))
    expect(inline.getAttribute('aria-expanded')).toBe('false')
  })

  it('åpnes og lukkes med trykk på berøringsskjerm', async () => {
    const bruker = userEvent.setup()
    render(<Side />)
    const inline = pille('Referanser 1–3')
    await bruker.pointer({ keys: '[TouchA]', target: inline })
    expect(inline.getAttribute('aria-expanded')).toBe('true')
    // Fingeren løftes: boblen skal bli stående til noe annet berøres.
    await new Promise((ferdig) => setTimeout(ferdig, 250))
    expect(inline.getAttribute('aria-expanded')).toBe('true')

    await bruker.pointer({ keys: '[TouchA]', target: screen.getByText(/Mer tekst/) })
    expect(inline.getAttribute('aria-expanded')).toBe('false')
  })

  it('brukes med tastaturet: Enter og mellomrom åpner, Tab når lenkene, Escape lukker', async () => {
    const bruker = userEvent.setup()
    render(<Side />)
    const inline = pille('Referanser 1–3')
    act(() => inline.focus())

    await bruker.keyboard('{Enter}')
    expect(inline.getAttribute('aria-expanded')).toBe('true')

    // Boblen står rett etter knappen: Tab går inn i den, til lenkene.
    const boble = within(bobleTil(inline))
    await bruker.tab()
    expect(document.activeElement).toBe(boble.getByRole('link', { name: 'https://example.org/c' }))
    await bruker.tab()
    expect(document.activeElement).toBe(boble.getByRole('link', { name: 'https://example.org/a' }))

    await bruker.keyboard('{Escape}')
    expect(inline.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(inline)

    await bruker.keyboard(' ')
    expect(inline.getAttribute('aria-expanded')).toBe('true')
    await bruker.keyboard(' ')
    expect(inline.getAttribute('aria-expanded')).toBe('false')
  })

  it('lukkes når fokus går videre forbi boblen', async () => {
    const bruker = userEvent.setup()
    render(<Side />)
    const inline = pille('Referanser 1–3')
    act(() => inline.focus())
    await bruker.keyboard('{Enter}')
    await bruker.tab()
    await bruker.tab()
    await bruker.tab()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Etter' }))
    expect(inline.getAttribute('aria-expanded')).toBe('false')
  })

  it('viser ingenting når ingen av referansene er kjent på siden', () => {
    const { container } = render(
      <Sidereferanser nummerering={new Map()} referanser={REFERANSER}>
        <Referansepille ider={['a']} />
      </Sidereferanser>,
    )
    expect(container.innerHTML).toBe('')
  })
})

describe('referanselisten', () => {
  it('viser referansene som brukes, i nummerrekkefølge, med lenkene klikkbare', () => {
    render(<Side />)
    const liste = screen.getByRole('region', { name: 'Referanser' })
    const punkter = within(liste).getAllByRole('listitem')
    expect(punkter.map((p) => [p.getAttribute('value'), p.textContent])).toEqual([
      ['1', 'Tredje kilde · 2021 · https://example.org/c'],
      ['2', 'Andre kilde · Hansen K · 2020'],
      ['3', 'Første kilde · Nordmann O · 2019 · https://example.org/a'],
    ])
    expect(within(liste).queryByText(/Ubrukt/)).toBeNull()
    expect(within(liste).getAllByRole('link').map((l) => l.getAttribute('href'))).toEqual([
      'https://example.org/c',
      'https://example.org/a',
    ])
  })

  it('vises ikke når siden ikke har referanser', () => {
    const { container } = render(
      <Sidereferanser nummerering={new Map()} referanser={REFERANSER}>
        <Referanseliste />
      </Sidereferanser>,
    )
    expect(container.innerHTML).toBe('')
  })
})
