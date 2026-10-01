// @vitest-environment jsdom
/**
 * Rikteksten i lesemodus: overskriftene og skillelinjene editoren kan sette
 * inn, vises som de samme elementene som editoren bruker.
 */
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Riktekst } from '../components/stoffside/Riktekst'
import { rensDokument } from '../faginnhold/riktekst'

afterEach(cleanup)

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
})
