// @vitest-environment jsdom
/**
 * Fortolkningssteget for rusmidler med reglene fra Supabase, prøvd i en
 * nettleser i minnet: mens reglene hentes, når de ikke kunne hentes, og når
 * de er der. Reglene er de publiserte (grunnlaget de ble importert fra); at de
 * gir det samme som den opprinnelige fortolkningen i hele rutenettet, prøves i
 * `rusparitet.test.ts`.
 */
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { RusStep } from '../components/RusStep'
import { TipsLag } from '../components/Tips'
import { RUS_MODULER, type Rusregler } from '../domain/rus'
import { reglerForModul, tilScenarioregler, type Scenarioreglertilstand } from '../faginnhold/scenarioregler'
import { ShortcutVisibilityProvider } from '../hooks/useShortcutVisibility'
import { RUS_KOMMENTARER, rusRegelsett, rusScenarioregeldata } from './hjelp/rusgrunnlag'

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Element.prototype.scrollIntoView ??= function () {}
  window.scrollBy = () => {}
})

afterEach(cleanup)

const modul = (id: string) => RUS_MODULER.find((m) => m.id === id)!
const klar = (id: string): Rusregler => ({ status: 'klar', regelsett: rusRegelsett(id), kommentarer: RUS_KOMMENTARER })

function visSteg(id: string, regler: Rusregler) {
  const copy = vi.fn(async (_tekst: string) => true)
  render(
    <TipsLag>
      <ShortcutVisibilityProvider>
        <RusStep modul={modul(id)} regler={regler} onBack={vi.fn()} onFinish={vi.fn()} copy={copy} flashAt={vi.fn()} />
      </ShortcutVisibilityProvider>
    </TipsLag>,
  )
  return copy
}

describe('fortolkningssteget for rusmidler', () => {
  it('sier fra mens reglene hentes, og har ingenting å kopiere', () => {
    visSteg('kodeingruppen', { status: 'laster' })
    expect(screen.getByRole('status').textContent).toBe('Fortolkningsreglene hentes …')
    expect(screen.queryByRole('button', { name: /Kopier/ })).toBeNull()
    // Avkryssingen står klar, så brukeren kan begynne.
    expect(screen.getByRole('checkbox', { name: /Kodein/ })).toBeTruthy()
  })

  it('sier hvorfor når reglene ikke kunne hentes, og lar brukeren prøve igjen', async () => {
    const user = userEvent.setup()
    const provIgjen = vi.fn()
    visSteg('kodeingruppen', { status: 'feil', melding: 'Fortolkningsreglene kunne ikke hentes. Nede.', provIgjen })
    expect(screen.getByRole('alert').textContent).toContain('kunne ikke hentes')
    expect(screen.queryByRole('button', { name: /Kopier/ })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Prøv igjen' }))
    expect(provIgjen).toHaveBeenCalledOnce()
  })

  it('fortolker med de publiserte reglene og kopierer kommentarene i rekkefølge', async () => {
    const user = userEvent.setup()
    const copy = visSteg('kodeingruppen', klar('kodeingruppen'))
    await user.keyboard('12')
    await user.type(screen.getByRole('textbox', { name: /Kodein/ }), '1000')
    await user.type(screen.getByRole('textbox', { name: /Morfin/ }), '199')
    expect(screen.getByText('Morfin < 20 % av kodein ⟶ Forenlig med inntak av kodein alene.')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Kopier hovedkommentar' }))
    await user.click(screen.getByRole('button', { name: 'Kopier tilleggskommentar' }))
    expect(copy.mock.calls.map(([tekst]) => tekst)).toEqual([
      RUS_KOMMENTARER.get('hoy-kodein-lav-morfin/kodein'),
      RUS_KOMMENTARER.get('hoy-kodein-lav-morfin/morfin'),
    ])
  })

  it('viser grensen fra regelsettet i hjelpeteksten', async () => {
    const regelsett = rusRegelsett('diazepamgruppen')
    regelsett.parametere[0]!.verdi = 0.125
    visSteg('diazepamgruppen', { status: 'klar', regelsett, kommentarer: RUS_KOMMENTARER })
    // Hjelpeteksten står bare når alle tre er påvist.
    await userEvent.setup().keyboard('123')
    expect(screen.getByText(/høyst 12,5 % av summen/)).toBeTruthy()
  })
})

describe('reglene for en modul', () => {
  const provIgjen = () => {}
  const hentet = (data = rusScenarioregeldata()): Scenarioreglertilstand => ({
    status: 'klar',
    regler: tilScenarioregler(data),
  })

  it('er modulens regelsett med kommentarene', () => {
    const regler = reglerForModul(hentet(), modul('tramadolgruppen'), provIgjen)
    expect(regler).toEqual(klar('tramadolgruppen'))
  })

  it('sier fra når modulen ikke har noe publisert regelsett', () => {
    const data = rusScenarioregeldata()
    data.regelsett = data.regelsett.filter((u) => u.innhold.modul !== 'mdma')
    const regler = reglerForModul(hentet(data), modul('mdma'), provIgjen)
    expect(regler).toMatchObject({ status: 'feil', melding: expect.stringContaining('ingen publiserte regler for MDMA') })
  })

  it('bruker ikke et regelsett som ikke består kontrollen', () => {
    const data = rusScenarioregeldata()
    // Et regelsett som peker på en kommentar som ikke ble med, gir ingen fortolkning.
    data.kommentarer = data.kommentarer.filter((k) => k.id !== 'metadon/hoved')
    const tilstand = hentet(data)
    expect(tilstand.status === 'klar' && tilstand.regler.ugyldige.get('metadon')).toEqual([
      'Scenariet pavist viser til en kommentar som ikke finnes.',
    ])
    expect(reglerForModul(tilstand, modul('metadon'), provIgjen)).toMatchObject({
      status: 'feil',
      melding: expect.stringContaining('Reglene for Metadon er ikke gyldige'),
    })
    // De andre modulene fortolkes som før.
    expect(reglerForModul(tilstand, modul('oksykodon'), provIgjen).status).toBe('klar')
  })

  it('venter mens reglene hentes, og gir feilen videre med en vei til å prøve igjen', () => {
    expect(reglerForModul({ status: 'laster' }, modul('mdma'), provIgjen)).toEqual({ status: 'laster' })
    expect(reglerForModul({ status: 'feil', melding: 'Nede.' }, modul('mdma'), provIgjen)).toEqual({
      status: 'feil',
      melding: 'Nede.',
      provIgjen,
    })
  })
})
