// @vitest-environment jsdom
/**
 * Appskallet fra designsystemet: ikonene, den faste toppmenyen med plassene
 * sidene fyller, fagsøkfeltets snarvei og kontomenyen.
 */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

const loggUt = vi.fn(async () => {})
vi.mock('../auth/okt', () => ({
  useProfil: () => ({ role: 'admin', first_name: 'Anne', last_name: 'Admin', username: 'aadmin', avatar_path: null }),
  useOkt: () => ({ loggUt }),
}))
vi.mock('../auth/avatarer', () => ({ useAvatarlenker: () => new Map() }))
// Dialogene bak valgene har egne tester; her holder det at riktig åpnes.
vi.mock('../components/konto/Kontopanel', () => ({
  Kontopanel: ({ apen }: { apen: boolean }) => (apen ? <p>Kontopanelet</p> : null),
}))
vi.mock('../components/konto/Brukerliste', () => ({
  Brukerliste: ({ apen }: { apen: boolean }) => (apen ? <p>Brukerlista</p> : null),
}))

const { Ikon } = await import('../components/ikon/Ikon')
const { IKONER, IKONFARGER, IKONNAVN } = await import('../components/ikon/register')
const { Toppmeny } = await import('../components/toppmeny/Toppmeny')
const { ToppmenyKilde, ToppmenyInnhold } = await import('../components/toppmeny/Toppmenykilde')
const { Fagsokfelt, erFagsokSnarvei } = await import('../components/toppmeny/Fagsokfelt')
const { Kontomeny } = await import('../components/konto/Kontomeny')
const { TipsLag } = await import('../components/Tips')
const { ShortcutVisibilityProvider } = await import('../hooks/useShortcutVisibility')

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  loggUt.mockClear()
})

function Ramme({ children }: { children: React.ReactNode }) {
  return (
    <ShortcutVisibilityProvider>
      <TipsLag>{children}</TipsLag>
    </ShortcutVisibilityProvider>
  )
}

/** `matchMedia` finnes ikke i jsdom. */
function bevegelse(rolig: boolean) {
  vi.stubGlobal('matchMedia', (sporring: string) => ({
    matches: rolig && sporring.includes('reduce'),
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

describe('ikonene', () => {
  it('bruker bare fargene designsystemet har tokens for', () => {
    const kjente = new Set(Object.keys(IKONFARGER))
    const farger = (deler: readonly unknown[]): string[] =>
      deler.flatMap((d) => {
        const del = d as { col?: string; kids?: unknown[] }
        return [...(del.col ? [del.col] : []), ...(del.kids ? farger(del.kids) : [])]
      })
    for (const navn of IKONNAVN) {
      const { parts, free = [] } = IKONER[navn]
      for (const farge of farger([...parts, ...free])) expect(kjente, `${navn}: ${farge}`).toContain(farge)
    }
  })

  it('er skjult for skjermlesere uten etikett, og et bilde med', () => {
    bevegelse(false)
    const { container } = render(
      <>
        <Ikon navn="search" />
        <Ikon navn="tox" etikett="Toksisk" />
      </>,
    )
    const pynt = container.querySelector('svg')!
    expect(pynt.getAttribute('aria-hidden')).toBe('true')
    expect(screen.getByRole('img', { name: 'Toksisk' })).toBeTruthy()
  })

  it('tar navngitte størrelser fra tokens, og tall som piksler', () => {
    bevegelse(false)
    const { container } = render(
      <>
        <Ikon navn="search" storrelse="seksjon" />
        <Ikon navn="search" storrelse={24} />
      </>,
    )
    const [navngitt, tall] = [...container.querySelectorAll('svg')] as [SVGSVGElement, SVGSVGElement]
    expect(navngitt.getAttribute('data-storrelse')).toBe('seksjon')
    expect(tall.getAttribute('width')).toBe('24px')
    expect(tall.hasAttribute('data-storrelse')).toBe(false)
  })

  it('spiller én gang når forelderen får pekeren, men ikke med redusert bevegelse', () => {
    for (const rolig of [false, true]) {
      bevegelse(rolig)
      const { container, unmount } = render(
        <button type="button" data-ih="">
          <Ikon navn="search" />
        </button>,
      )
      fireEvent.mouseEnter(container.querySelector('button')!)
      const svg = container.querySelector('svg')!
      expect(svg.hasAttribute('data-spiller')).toBe(!rolig)
      unmount()
    }
  })
})

describe('plassene i toppmenyen', () => {
  function Side() {
    const [trykk, setTrykk] = useState(0)
    return (
      <ToppmenyInnhold spor="handlinger">
        <button type="button" onClick={() => setTrykk((n) => n + 1)}>
          Trykket {trykk}
        </button>
      </ToppmenyInnhold>
    )
  }

  it('legger sidens handlinger i menyen, og de beholder sidens tilstand', async () => {
    render(
      <Ramme>
        <ToppmenyKilde>
          <Toppmeny meny={null} konto={null} theme="lyst" onToggleTheme={() => {}} />
          <main>
            <Side />
          </main>
        </ToppmenyKilde>
      </Ramme>,
    )
    const meny = screen.getByRole('navigation', { name: 'Toppmeny' })
    const knapp = within(meny).getByRole('button', { name: 'Trykket 0' })
    await userEvent.click(knapp)
    expect(within(meny).getByRole('button', { name: 'Trykket 1' })).toBeTruthy()
    expect(within(screen.getByRole('main')).queryByRole('button')).toBeNull()
  })

  it('lar handlingene bli stående i siden når den står uten toppmeny', () => {
    render(<Side />)
    expect(screen.getByRole('button', { name: 'Trykket 0' })).toBeTruthy()
  })

  it('har ikon og navn på hver knapp', () => {
    render(
      <Ramme>
        <ToppmenyKilde>
          <Toppmeny meny={null} konto={null} theme="moerkt" onToggleTheme={() => {}} />
        </ToppmenyKilde>
      </Ramme>,
    )
    const knapper = within(screen.getByRole('navigation', { name: 'Toppmeny' })).getAllByRole('button')
    expect(knapper.map((k) => k.getAttribute('aria-label'))).toEqual(['Vis hurtigtaster', 'Bytt til lyst tema'])
    for (const knapp of knapper) expect(knapp.querySelector('svg.ikon')).not.toBeNull()
  })
})

describe('fagsøkfeltet', () => {
  function Felt() {
    const [verdi, setVerdi] = useState('')
    return <Fagsokfelt verdi={verdi} onEndre={setVerdi} />
  }

  const tast = (valg: KeyboardEventInit) => new KeyboardEvent('keydown', { key: 'k', ...valg })

  it('hentes fram med Ctrl K og Cmd K', () => {
    render(
      <Ramme>
        <Felt />
      </Ramme>,
    )
    const felt = screen.getByRole('searchbox', { name: 'Søk i fagstoffet' })
    for (const valg of [{ ctrlKey: true }, { metaKey: true }]) {
      felt.blur()
      act(() => void window.dispatchEvent(tast(valg)))
      expect(document.activeElement).toBe(felt)
    }
  })

  it('lar tasten være i fred for et redigeringsfelt, et åpent lag og andre kombinasjoner', () => {
    expect(erFagsokSnarvei(tast({ ctrlKey: true }))).toBe(true)
    expect(erFagsokSnarvei(tast({ ctrlKey: true, metaKey: true }))).toBe(false)
    expect(erFagsokSnarvei(tast({ ctrlKey: true, shiftKey: true }))).toBe(false)
    expect(erFagsokSnarvei(tast({}))).toBe(false)

    const lag = document.createElement('div')
    lag.setAttribute('data-lag', 'test')
    document.body.append(lag)
    expect(erFagsokSnarvei(tast({ ctrlKey: true }))).toBe(false)
    lag.remove()

    const redigering = document.createElement('div')
    redigering.contentEditable = 'true'
    redigering.tabIndex = 0
    document.body.append(redigering)
    redigering.focus()
    // jsdom regner ikke ut `isContentEditable`.
    Object.defineProperty(redigering, 'isContentEditable', { value: true })
    expect(erFagsokSnarvei(tast({ ctrlKey: true }))).toBe(false)
    redigering.remove()
  })
})

describe('kontomenyen', () => {
  function vis() {
    render(
      <Ramme>
        <Kontomeny theme="lyst" onToggleTheme={() => {}} />
      </Ramme>,
    )
    return screen.getByRole('button', { name: 'Kontoen din – Anne Admin' })
  }

  /** Menyen avataren styrer. Den står skjult når den er lukket, og har da ikke noe navn å finne den på. */
  const panel = (knapp: HTMLElement) => document.getElementById(knapp.getAttribute('aria-controls')!)!

  it('åpnes fra avataren, er et lag mens den står åpen, og lukkes med Escape', async () => {
    const knapp = vis()
    const meny = panel(knapp)
    expect(meny.hidden).toBe(true)
    expect(knapp.getAttribute('aria-expanded')).toBe('false')

    await userEvent.click(knapp)
    expect(meny.hidden).toBe(false)
    expect(screen.getByRole('group', { name: 'Konto' })).toBe(meny)
    expect(meny.getAttribute('data-lag')).toBe('kontomeny')
    expect(document.activeElement).toBe(within(meny).getByRole('button', { name: /Endre navn og profilbilde/ }))
    expect(within(meny).getByText('Admin', { selector: '.kontomeny__merke' })).toBeTruthy()

    await userEvent.keyboard('{Escape}')
    expect(meny.hidden).toBe(true)
    expect(meny.hasAttribute('data-lag')).toBe(false)
    expect(document.activeElement).toBe(knapp)
  })

  it('lukkes av et trykk utenfor', async () => {
    const knapp = vis()
    await userEvent.click(knapp)
    await userEvent.click(document.body)
    expect(panel(knapp).hidden).toBe(true)
  })

  it('fører til profilen, brukerne og utloggingen', async () => {
    const knapp = vis()
    await userEvent.click(knapp)
    await userEvent.click(screen.getByRole('button', { name: /Brukere/ }))
    expect(screen.getByText('Brukerlista')).toBeTruthy()
    expect(panel(knapp).hidden).toBe(true)

    await userEvent.click(knapp)
    await userEvent.click(screen.getByRole('button', { name: /Endre navn og profilbilde/ }))
    expect(screen.getByText('Kontopanelet')).toBeTruthy()

    await userEvent.click(knapp)
    await userEvent.click(screen.getByRole('button', { name: 'Logg ut' }))
    expect(loggUt).toHaveBeenCalledOnce()
  })
})
