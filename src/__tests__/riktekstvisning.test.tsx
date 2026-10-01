// @vitest-environment jsdom
/**
 * Rikteksten i lesemodus: overskriftene og skillelinjene editoren kan sette
 * inn. Overskriftene legger seg under den nærmeste overskriften rundt teksten.
 */
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { UnderOverskrift } from '../components/Overskriftsniva'
import { Riktekst } from '../components/stoffside/Riktekst'
import { Rikteksteditor } from '../components/stoffside/Rikteksteditor'
import { rensDokument, type Riktekstdokument } from '../faginnhold/riktekst'

afterEach(cleanup)

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
