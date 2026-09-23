// @vitest-environment jsdom
/**
 * Veiene mellom fortolkningen og informasjonssidene, prøvd i hele appen.
 *
 * - Sidemenyen fører til informasjonssidene, ikke til fortolkningen.
 * - Analyttkodene i fortolkningsmodulene er lenker til sidene sine.
 * - «Åpne fortolkning» fører tilbake til riktig modul.
 * - Hver side har sin egen adresse, som kan åpnes direkte.
 * - Fortolkningen står uendret bak en åpen informasjonsside, og tastene dens
 *   ligger i ro så lenge den er skjult.
 *
 * Innloggingen og databasen er erstattet: økten er en vanlig bruker, og
 * databasen har ingen sider ennå, bare regelsettene fra før byttet.
 */
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../auth/okt', () => ({
  useProfil: () => ({ role: 'user', first_name: 'Lars', last_name: 'Leser', username: 'leser' }),
}))
vi.mock('../auth/klient', async () => {
  const { DAGENS_REGELSETT } = await import('./hjelp/dagensregler')
  const regelsett = DAGENS_REGELSETT.map((innhold) => ({ innhold }))
  return {
    klient: () => ({
      rpc: async (funksjon: string) => ({ data: funksjon === 'les_intervallregelsett' ? regelsett : null, error: null }),
    }),
  }
})
vi.mock('../components/konto/Kontoknapper', () => ({ Kontoknapper: () => null }))

const { default: App } = await import('../App')
const { dagensKommentar } = await import('./hjelp/dagensregler')
const { TipsLag } = await import('../components/Tips')
const { ShortcutVisibilityProvider } = await import('../hooks/useShortcutVisibility')

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Element.prototype.scrollIntoView ??= function () {}
  window.scrollTo = () => {}
})

beforeEach(() => {
  window.location.hash = ''
})

afterEach(cleanup)

function visApp() {
  render(
    <TipsLag>
      <ShortcutVisibilityProvider>
        <App />
      </ShortcutVisibilityProvider>
    </TipsLag>,
  )
}

/** Fortolkningen, synlig eller skjult. */
function fortolkningen(): HTMLElement {
  return document.querySelector('main.scene:not(.scene--infoside)')!
}

/** Søker opp NOR og velger det beste treffet — koden selv — med tasten 1. */
async function velgNortriptylin(user: ReturnType<typeof userEvent.setup>) {
  await user.keyboard('nor')
  await user.keyboard('1')
  await screen.findByRole('region', { name: 'Velg konsentrasjon' })
}

async function infosideFor(navn: string) {
  return screen.findByRole('heading', { level: 1, name: navn })
}

describe('sidemenyen', () => {
  it('fører til informasjonssiden, med egen adresse', async () => {
    const user = userEvent.setup()
    visApp()
    await user.click(screen.getByRole('button', { name: 'Vis analysemetoder' }))
    await user.click(screen.getByRole('button', { name: /SPFA/ }))
    const lenke = screen.getByRole('link', { name: /Amitriptylin \+ nortriptylin/ })
    expect(lenke.getAttribute('href')).toBe('#/analytt/AMTNORSUM')

    await user.click(lenke)
    await infosideFor('Amitriptylin')
    expect(window.location.hash).toBe('#/analytt/AMTNORSUM')
    expect(fortolkningen().hidden).toBe(true)
    // Siden starter med fokus på navnet, ikke igjen i menyen.
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1 }))
  })
})

describe('adressene', () => {
  it('åpner en informasjonsside direkte fra adressen', async () => {
    window.location.hash = '#/analytt/nor'
    visApp()
    await infosideFor('Nortriptylin')
    expect(document.title).toBe('Nortriptylin (NOR) – OUSFAR')
  })

  it('følger tilbakeknappen', async () => {
    window.location.hash = '#/analytt/NOR'
    visApp()
    await infosideFor('Nortriptylin')
    window.location.hash = '#/'
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    await waitFor(() => expect(fortolkningen().hidden).toBe(false))
    expect(screen.queryByRole('heading', { level: 1, name: 'Nortriptylin' })).toBeNull()
  })
})

describe('mellom fortolkningen og informasjonssiden', () => {
  it('går fra kodepillen til siden og tilbake til samme modul', async () => {
    const user = userEvent.setup()
    visApp()
    await velgNortriptylin(user)
    const pille = await screen.findByRole('link', { name: 'NOR – åpne informasjonssiden' })
    expect(pille.getAttribute('href')).toBe('#/analytt/NOR')

    await user.click(pille)
    await infosideFor('Nortriptylin')
    expect(fortolkningen().hidden).toBe(true)

    await user.click(screen.getByRole('button', { name: 'Åpne fortolkning' }))
    await waitFor(() => expect(fortolkningen().hidden).toBe(false))
    expect(window.location.hash).toBe('#/')
    expect(within(fortolkningen()).getByRole('link', { name: 'NOR – åpne informasjonssiden' })).toBeTruthy()
  })

  it('åpner riktig modul fra en informasjonsside, også for koder som deler modul', async () => {
    const user = userEvent.setup()
    window.location.hash = '#/analytt/OXA'
    visApp()
    await infosideFor('Oksazepam')
    await user.click(screen.getByRole('button', { name: 'Åpne fortolkning' }))
    await waitFor(() => expect(fortolkningen().hidden).toBe(false))
    // Diazepamgruppen har én pille per kode, hver til sin egen side.
    for (const kode of ['DIAZ', 'DMI', 'OXA']) {
      expect(
        within(fortolkningen()).getByRole('link', { name: `${kode} – åpne informasjonssiden` }).getAttribute('href'),
      ).toBe(`#/analytt/${kode}`)
    }
  })

  it('lar fortolkningen ligge i ro mens informasjonssiden vises', async () => {
    // Utklippstavlen er user-events egen, og er tom når testen starter.
    const user = userEvent.setup()
    visApp()
    await velgNortriptylin(user)
    const pille = await screen.findByRole('link', { name: 'NOR – åpne informasjonssiden' })
    await user.click(pille)
    await infosideFor('Nortriptylin')

    // Talltastene velger bånd i fortolkningen, men ikke herfra.
    await user.keyboard('1')
    await user.keyboard('{Enter}')
    expect(await navigator.clipboard.readText()).toBe('')

    // Esc lukker siden, og fortolkningen står der den sto.
    await user.keyboard('{Escape}')
    await waitFor(() => expect(fortolkningen().hidden).toBe(false))
    expect(within(fortolkningen()).getByRole('link', { name: 'NOR – åpne informasjonssiden' })).toBeTruthy()
    // Nå virker tastene igjen: 1 kopierer kommentaren for det første båndet.
    await user.keyboard('1')
    await waitFor(async () => expect(await navigator.clipboard.readText()).toBe(dagensKommentar('NOR', 'under')))
  })
})
