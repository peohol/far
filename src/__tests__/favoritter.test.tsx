// @vitest-environment jsdom
/**
 * Favorittene i hele appen: stjernen på fagsiden og skuffen «Favoritter» i
 * stoffregisteret.
 *
 * - Skuffen står fast mellom «Vis underkategorier» og den første kategorien,
 *   og er lukket til den åpnes.
 * - Stjernen legger stoffet til og fjerner det igjen, og skuffen viser det med
 *   en gang. Krysset ved en favoritt i skuffen fjerner den også.
 * - En favoritt merket under et gammelt navn for stoffet står som stoffet, og
 *   fjernes med det.
 * - Sier databasen nei, vises det databasen faktisk har.
 *
 * Innloggingen og databasen er erstattet: økten er en vanlig bruker, og
 * favorittene ligger i en liste i minnet.
 */
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const databasen = vi.hoisted(() => ({
  favoritter: [] as string[],
  kall: [] as { funksjon: string; argumenter: Record<string, unknown> }[],
  /** Svarer lagringen med en feil. */
  avviser: false,
}))

vi.mock('../auth/okt', () => ({
  useProfil: () => ({ id: 'leser', role: 'user', first_name: 'Lars', last_name: 'Leser', username: 'leser' }),
}))
vi.mock('../auth/klient', async () => {
  const { DAGENS_REGELSETT } = await import('./hjelp/dagensregler')
  const { publiserteStoffrader } = await import('./hjelp/stoffreferanseomrader')
  const { rusScenarioregeldata } = await import('./hjelp/rusgrunnlag')
  const { thcRegelsettutgave } = await import('./hjelp/thcgrunnlag')
  const vanlige = publiserteStoffrader(DAGENS_REGELSETT)
  const thc = thcRegelsettutgave()
  const rader: Record<string, unknown> = {
    ...vanlige,
    les_kommentarer: [...vanlige.les_kommentarer, ...thc.kommentarer],
    les_thc_regelsett: thc.regelsett,
    les_scenarioregler: rusScenarioregeldata(),
    les_stoffregister: { kategorier: [], plasseringer: [], status: [], sider: [] },
  }
  return {
    klient: () => ({
      rpc: async (funksjon: string, argumenter: Record<string, unknown> = {}) => {
        databasen.kall.push({ funksjon, argumenter })
        if (funksjon === 'les_stoffavoritter') return { data: [...databasen.favoritter], error: null }
        if (funksjon === 'sett_stoffavoritt') {
          if (databasen.avviser) return { data: null, error: { code: '42501', message: 'nei', details: null, hint: null } }
          const stoff = argumenter.stoff as string
          databasen.favoritter = databasen.favoritter.filter((s) => s !== stoff)
          if (argumenter.favoritt) databasen.favoritter.push(stoff)
          return { data: null, error: null }
        }
        if (funksjon === 'finn_intervallregelsett') {
          const regelsett = vanlige.les_intervallregelsett.find((r) => r.innhold.analyttkode === argumenter.analyttkode)
          return { data: regelsett ?? null, error: null }
        }
        return { data: rader[funksjon] ?? null, error: null }
      },
    }),
  }
})
vi.mock('../components/konto/Kontomeny', () => ({ Kontomeny: () => null }))

const { default: App } = await import('../App')
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
  databasen.favoritter = []
  databasen.kall = []
  databasen.avviser = false
})

afterEach(() => {
  cleanup()
})

function visApp() {
  render(
    <TipsLag>
      <ShortcutVisibilityProvider>
        <App />
      </ShortcutVisibilityProvider>
    </TipsLag>,
  )
}

function menyen() {
  return screen.getByRole('navigation', { name: 'Stoffregister' })
}

function favorittskuffen() {
  return within(menyen()).getByRole('button', { name: /^Favoritter/ })
}

/** Innholdet i favorittskuffen. */
function favorittene() {
  return document.getElementById(favorittskuffen().getAttribute('aria-controls')!)!
}

describe('favorittskuffen i stoffregisteret', () => {
  it('står lukket mellom bryteren og den første kategorien, og sier hvordan en favoritt legges til', async () => {
    const user = userEvent.setup()
    visApp()
    await user.click(screen.getByRole('button', { name: 'Vis stoffregisteret' }))
    const skuff = favorittskuffen()
    expect(skuff.getAttribute('aria-expanded')).toBe('false')
    expect(skuff.textContent).toContain('0')

    // Rekkefølgen i menyen: bryteren, favorittene, så kategoriene.
    const bryter = within(menyen()).getByRole('switch', { name: 'Vis underkategorier' })
    const forsteKategori = menyen().querySelector('.menyliste .menyskuff__tittel')!
    expect(bryter.compareDocumentPosition(skuff) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(skuff.compareDocumentPosition(forsteKategori) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // Favorittene står utenfor lista som ruller.
    expect(skuff.closest('.menyliste')).toBeNull()

    await user.click(skuff)
    expect(skuff.getAttribute('aria-expanded')).toBe('true')
    expect(favorittene().textContent).toContain('Trykk på stjernen på en fagside')
  })
})

// Hele appen tegnes opp og klikkes gjennom; alene tar det rundt fire sekunder,
// så standardgrensen på fem gir ingen margin på en travel CI-maskin.
describe('stjernen på fagsiden', { timeout: 20_000 }, () => {
  it('legger stoffet til i favorittene og fjerner det igjen, og skuffen følger med', async () => {
    const user = userEvent.setup()
    window.location.hash = '#/stoff/bupropion'
    visApp()
    await screen.findByRole('heading', { level: 1, name: 'Bupropion' })

    await user.click(await screen.findByRole('button', { name: 'Legg til i favoritter' }))
    expect(screen.getByRole('button', { name: 'Fjern fra favoritter' })).toBeTruthy()
    await waitFor(() => expect(databasen.favoritter).toEqual(['bupropion']))

    await user.click(screen.getByRole('button', { name: 'Vis stoffregisteret' }))
    await user.click(favorittskuffen())
    const lenke = within(favorittene()).getByRole('link', { name: /^Bupropion/ })
    expect(lenke.getAttribute('href')).toBe('#/stoff/bupropion')

    // Stjernen skrus av igjen: favoritten forsvinner fra skuffen.
    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('button', { name: 'Fjern fra favoritter' }))
    expect(screen.getByRole('button', { name: 'Legg til i favoritter' })).toBeTruthy()
    expect(within(favorittene()).queryByRole('link')).toBeNull()
    await waitFor(() => expect(databasen.favoritter).toEqual([]))
  })

  it('er av igjen når favoritten fjernes med krysset i skuffen', async () => {
    databasen.favoritter = ['nortriptylin', 'bupropion']
    const user = userEvent.setup()
    window.location.hash = '#/stoff/bupropion'
    visApp()
    await screen.findByRole('button', { name: 'Fjern fra favoritter' })

    await user.click(screen.getByRole('button', { name: 'Vis stoffregisteret' }))
    await user.click(favorittskuffen())
    // Alfabetisk, som resten av menyen.
    expect(within(favorittene()).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual([
      '#/stoff/bupropion',
      '#/stoff/nortriptylin',
    ])
    await user.click(within(favorittene()).getByRole('button', { name: 'Fjern Bupropion fra favoritter' }))
    expect(within(favorittene()).getAllByRole('link')).toHaveLength(1)
    await waitFor(() => expect(databasen.favoritter).toEqual(['nortriptylin']))
    expect(screen.getByRole('button', { name: 'Legg til i favoritter', hidden: true })).toBeTruthy()
  })

  it('viser en favoritt merket under et gammelt navn som stoffet, og fjerner den med det', async () => {
    databasen.favoritter = ['hydroksybupropion']
    const user = userEvent.setup()
    window.location.hash = '#/stoff/bupropion'
    visApp()
    await user.click(await screen.findByRole('button', { name: 'Fjern fra favoritter' }))
    await waitFor(() =>
      expect(databasen.kall).toContainEqual({
        funksjon: 'sett_stoffavoritt',
        argumenter: { stoff: 'hydroksybupropion', favoritt: false },
      }),
    )
    expect(databasen.favoritter).toEqual([])
  })

  it('viser det databasen har når lagringen avvises', async () => {
    databasen.avviser = true
    const user = userEvent.setup()
    window.location.hash = '#/stoff/bupropion'
    visApp()
    await user.click(await screen.findByRole('button', { name: 'Legg til i favoritter' }))
    // Favorittene hentes på nytt etter avvisningen, og stjernen er av.
    await waitFor(() => expect(databasen.kall.filter((k) => k.funksjon === 'les_stoffavoritter')).toHaveLength(2))
    await screen.findByRole('button', { name: 'Legg til i favoritter' })
    expect(databasen.favoritter).toEqual([])
  })
})
