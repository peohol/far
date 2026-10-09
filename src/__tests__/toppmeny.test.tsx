// @vitest-environment jsdom
/**
 * Appskallet fra designsystemet: ikonene, den faste toppmenyen med plassene
 * sidene fyller, fagsøkfeltets snarvei, idéknappen, adminmenyen og kontomenyen.
 */
import { readFileSync } from 'node:fs'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { Datakildestatus, Kjoring } from '../datakilder/status'

const loggUt = vi.fn(async () => {})
const rolle = vi.hoisted(() => ({ verdi: 'admin' }))
vi.mock('../auth/okt', () => ({
  useProfil: () => ({ role: rolle.verdi, first_name: 'Anne', last_name: 'Admin', username: 'aadmin', avatar_path: null }),
  useOkt: () => ({ loggUt }),
}))
vi.mock('../auth/avatarer', () => ({ useAvatarlenker: () => new Map() }))
const ideerMedNytt = vi.hoisted(() => ({ antall: 0 }))
vi.mock('../ideer/api', () => ({ hentIdeerMedNytt: async () => ideerMedNytt.antall }))
// Dialogene bak valgene har egne tester; her holder det at riktig åpnes.
vi.mock('../components/konto/Kontopanel', () => ({
  Kontopanel: ({ apen }: { apen: boolean }) => (apen ? <p>Kontopanelet</p> : null),
}))
vi.mock('../components/konto/Brukerliste', () => ({
  Brukerliste: ({ apen }: { apen: boolean }) => (apen ? <p>Brukerlista</p> : null),
}))
const datakildepanel = vi.hoisted(() => ({ lukk: null as null | (() => void) }))
vi.mock('../components/konto/Datakilder', () => ({
  Datakilder: ({ apen, onLukk }: { apen: boolean; onLukk: () => void }) => {
    datakildepanel.lukk = onLukk
    return apen ? <p>Datakildene</p> : null
  },
}))
vi.mock('../components/konto/Autoerstattregler', () => ({
  Autoerstattregler: ({ apen }: { apen: boolean }) => (apen ? <p>Autoerstatt-reglene</p> : null),
}))
vi.mock('../components/ideer/Ideer', () => ({
  Ideer: ({ apen, onOppgaver }: { apen: boolean; onOppgaver: (oppgave?: string) => void }) =>
    apen ? (
      <>
        <p>Idéene</p>
        <button onClick={() => onOppgaver('o1')}>Til oppgaven</button>
      </>
    ) : null,
}))
vi.mock('../components/ideer/Oppgaver', () => ({
  Oppgaver: ({ apen, oppgave, onIdeer }: { apen: boolean; oppgave?: string; onIdeer: () => void }) =>
    apen ? (
      <>
        <p>Oppgavene {oppgave}</p>
        <button onClick={onIdeer}>Til idéene</button>
      </>
    ) : null,
}))

const { Ikon } = await import('../components/ikon/Ikon')
const { IKONER, IKONFARGER, IKONNAVN } = await import('../components/ikon/register')
const { Toppmeny } = await import('../components/toppmeny/Toppmeny')
const { ToppmenyKilde, ToppmenyInnhold } = await import('../components/toppmeny/Toppmenykilde')
const { Fagsokfelt, erFagsokSnarvei } = await import('../components/toppmeny/Fagsokfelt')
const { Kontomeny } = await import('../components/konto/Kontomeny')
const { Adminmeny } = await import('../components/konto/Adminmeny')
const { DATAKILDER } = await import('../datakilder/status')
const { Ideknapp } = await import('../components/ideer/Ideknapp')
const { TipsLag } = await import('../components/Tips')
const { ShortcutVisibilityProvider, useShortcutVisibility } = await import('../hooks/useShortcutVisibility')

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
  rolle.verdi = 'admin'
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

  it('lar klikket lande på ikonet, ikke på delene som tegnes på nytt', () => {
    // Fokus fra et museklikk spiller animasjonen og bytter ut delene mellom
    // trykk og slipp. Treffer pekeren delene, sender nettleseren ikke klikket.
    const css = readFileSync('src/styles/ikon.css', 'utf8')
    expect(css).toMatch(/\.ikon \*\s*\{[^}]*pointer-events:\s*none/)
  })
})

/** Knappene foran kontoen, slik appen legger dem i toppmenyen. */
function Verktoy() {
  return (
    <>
      <Ideknapp />
      <Adminmeny />
    </>
  )
}

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
          <Toppmeny meny={null} konto={null} />
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
          <Toppmeny meny={null} verktoy={<Verktoy />} konto={null} />
        </ToppmenyKilde>
      </Ramme>,
    )
    const knapper = within(screen.getByRole('navigation', { name: 'Toppmeny' })).getAllByRole('button')
    expect(knapper.map((k) => k.getAttribute('aria-label'))).toEqual(['Idéer og planlagte oppgaver', 'Administrasjon'])
    for (const knapp of knapper) expect(knapp.querySelector('svg.ikon')).not.toBeNull()
  })

  it('viser ikke adminmenyen for andre enn administratorer', () => {
    rolle.verdi = 'user'
    render(
      <Ramme>
        <ToppmenyKilde>
          <Toppmeny meny={null} verktoy={<Verktoy />} konto={null} />
        </ToppmenyKilde>
      </Ramme>,
    )
    const knapper = within(screen.getByRole('navigation', { name: 'Toppmeny' })).getAllByRole('button')
    expect(knapper.map((k) => k.getAttribute('aria-label'))).toEqual(['Idéer og planlagte oppgaver'])
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

/** Menyen en knapp styrer. Den står skjult når den er lukket, og har da ikke noe navn å finne den på. */
const panel = (knapp: HTMLElement) => document.getElementById(knapp.getAttribute('aria-controls')!)!

describe('kontomenyen', () => {
  /** Temaet og hurtigtastene slik appen holder dem, så bryterne kan prøves. */
  function Konto() {
    const [theme, setTheme] = useState<'lyst' | 'moerkt'>('lyst')
    const { visible } = useShortcutVisibility()
    return (
      <>
        <Kontomeny theme={theme} onToggleTheme={() => setTheme((t) => (t === 'lyst' ? 'moerkt' : 'lyst'))} />
        <output>
          {theme} {visible ? 'med' : 'uten'} hurtigtaster
        </output>
      </>
    )
  }

  function vis() {
    render(
      <Ramme>
        <Konto />
      </Ramme>,
    )
    return screen.getByRole('button', { name: 'Kontoen din – Anne Admin' })
  }

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

  it('har bare profilen, preferansene og utloggingen', async () => {
    const knapp = vis()
    await userEvent.click(knapp)
    const valg = within(panel(knapp)).getAllByRole('button')
    expect(valg.map((v) => v.textContent)).toEqual(['Endre navn og profilbilde', 'Preferanser', 'Logg ut'])
  })

  it('folder ut preferansene med hurtigtastene og temaet, og de virker derfra', async () => {
    const knapp = vis()
    await userEvent.click(knapp)
    const meny = panel(knapp)
    const preferanser = within(meny).getByRole('button', { name: 'Preferanser' })
    const skuff = document.getElementById(preferanser.getAttribute('aria-controls')!)!
    expect(preferanser.getAttribute('aria-expanded')).toBe('false')
    expect(skuff.hasAttribute('hidden')).toBe(true)

    await userEvent.click(preferanser)
    expect(preferanser.getAttribute('aria-expanded')).toBe('true')
    expect(skuff.hasAttribute('hidden')).toBe(false)

    const hurtigtaster = within(skuff).getByRole('switch', { name: 'Vis hurtigtaster' }) as HTMLInputElement
    const tema = within(skuff).getByRole('switch', { name: 'Mørkt tema' }) as HTMLInputElement
    expect([hurtigtaster.checked, tema.checked]).toEqual([false, false])
    await userEvent.click(tema)
    await userEvent.click(hurtigtaster)
    expect([hurtigtaster.checked, tema.checked]).toEqual([true, true])
    expect(screen.getByRole('status').textContent).toBe('moerkt med hurtigtaster')
    // Bryterne er inni menyen: den står åpen.
    expect(meny.hidden).toBe(false)

    // Neste gang menyen åpnes, står skuffen lukket igjen.
    await userEvent.keyboard('{Escape}')
    await userEvent.click(knapp)
    expect(preferanser.getAttribute('aria-expanded')).toBe('false')
  })

  it('lukkes når fokus tabuleres ut av den, også bakover forbi avataren', async () => {
    const knapp = vis()
    await userEvent.click(knapp)
    const meny = panel(knapp)
    await userEvent.tab({ shift: true })
    expect(document.activeElement).toBe(knapp)
    expect(meny.hidden).toBe(false)
    await userEvent.tab({ shift: true })
    expect(meny.hidden).toBe(true)
    expect(meny.hasAttribute('data-lag')).toBe(false)
  })

  it('står åpen når noe i den som ikke tar fokus trykkes, som navnet', async () => {
    const knapp = vis()
    await userEvent.click(knapp)
    await userEvent.click(screen.getByText('aadmin'))
    expect(panel(knapp).hidden).toBe(false)
  })

  it('lukkes av et trykk utenfor', async () => {
    const knapp = vis()
    await userEvent.click(knapp)
    await userEvent.click(document.body)
    expect(panel(knapp).hidden).toBe(true)
  })

  it('fører til profilen og utloggingen', async () => {
    const knapp = vis()
    await userEvent.click(knapp)
    await userEvent.click(screen.getByRole('button', { name: /Endre navn og profilbilde/ }))
    expect(screen.getByText('Kontopanelet')).toBeTruthy()
    expect(panel(knapp).hidden).toBe(true)

    await userEvent.click(knapp)
    await userEvent.click(screen.getByRole('button', { name: 'Logg ut' }))
    expect(loggUt).toHaveBeenCalledOnce()
  })
})

describe('adminmenyen', () => {
  it('fører til brukerne, datakildene og autoerstatt-reglene, og er et eget lag', async () => {
    render(
      <Ramme>
        <Adminmeny />
      </Ramme>,
    )
    const knapp = screen.getByRole('button', { name: 'Administrasjon' })
    await userEvent.click(knapp)
    const meny = panel(knapp)
    expect(meny.getAttribute('data-lag')).toBe('adminmeny')
    expect(within(meny).getAllByRole('button').map((v) => v.textContent)).toEqual(['Brukere', 'Datakilder', 'Autoerstatt'])

    await userEvent.click(within(meny).getByRole('button', { name: 'Brukere' }))
    expect(screen.getByText('Brukerlista')).toBeTruthy()
    expect(meny.hidden).toBe(true)

    await userEvent.click(knapp)
    await userEvent.click(within(meny).getByRole('button', { name: 'Datakilder' }))
    expect(screen.getByText('Datakildene')).toBeTruthy()

    await userEvent.click(knapp)
    await userEvent.click(within(meny).getByRole('button', { name: 'Autoerstatt' }))
    expect(screen.getByText('Autoerstatt-reglene')).toBeTruthy()
  })

  it('har en prikk når en datakilde bør ses over, og ser etter på nytt når «Datakilder» lukkes', async () => {
    const na = new Date().toISOString()
    const kjoring = (kilde: Kjoring['kilde'], status: Kjoring['status']): Kjoring => ({
      kilde, id: 1, status, utlost_av: 'cron', startet_kl: na, avsluttet_kl: na, release: null, versjon: null,
      feil: status === 'feilet' ? 'Portalen svarte 503' : null, endringer: { klinisk: 0, metadata: 0, grunnlag: 0 },
    })
    const iOrden = DATAKILDER.map((k) => kjoring(k, 'uendret'))
    const status = vi.fn(async (): Promise<Datakildestatus> => ({
      kjoringer: iOrden.map((k) => (k.kilde === 'farmakologiportalen' ? kjoring(k.kilde, 'feilet') : k)),
      endringer: [],
    }))
    const leser = { status, hentNa: vi.fn() }
    render(
      <Ramme>
        <Adminmeny leser={leser} />
      </Ramme>,
    )
    const knapp = await screen.findByRole('button', { name: 'Administrasjon (Farmakologiportalen bør ses over)' })
    expect(status).toHaveBeenCalledWith(1)
    expect(knapp.parentElement!.querySelector('.toppmeny__prikk')).toBeTruthy()
    await userEvent.click(knapp)
    expect(within(panel(knapp)).getByRole('img', { name: 'Farmakologiportalen bør ses over' })).toBeTruthy()

    // Hentet på nytt og i orden: prikken forsvinner når panelet lukkes.
    status.mockResolvedValue({ kjoringer: iOrden, endringer: [] })
    await userEvent.click(within(panel(knapp)).getByRole('button', { name: /^Datakilder/ }))
    expect(screen.getByText('Datakildene')).toBeTruthy()
    act(() => datakildepanel.lukk?.())
    expect(await screen.findByRole('button', { name: 'Administrasjon' })).toBeTruthy()
    expect(document.querySelector('.adminmeny .toppmeny__prikk')).toBeNull()
  })
})

describe('idémenyen', () => {
  const MENY = 'Idéer og planlagte oppgaver'
  const velg = async (valg: string, knapp = screen.getByRole('button', { name: new RegExp(`^${MENY}`) })) => {
    await userEvent.click(knapp)
    await userEvent.click(within(panel(knapp)).getByRole('button', { name: new RegExp(`^${valg}`) }))
  }

  it('har ett valg for idéene og ett for de planlagte oppgavene', async () => {
    render(
      <Ramme>
        <Ideknapp />
      </Ramme>,
    )
    const knapp = screen.getByRole('button', { name: MENY })
    await userEvent.click(knapp)
    const meny = panel(knapp)
    expect(meny.getAttribute('data-lag')).toBe('idemeny')
    expect(within(meny).getAllByRole('button').map((v) => v.textContent)).toEqual(['Idéer', 'Planlagte oppgaver'])

    await userEvent.click(within(meny).getByRole('button', { name: 'Idéer' }))
    expect(screen.getByText('Idéene')).toBeTruthy()
    expect(meny.hidden).toBe(true)
  })

  it('åpner de planlagte oppgavene rett fra menyen, og går mellom lagene med bare ett åpent', async () => {
    render(
      <Ramme>
        <Ideknapp />
      </Ramme>,
    )
    await velg('Planlagte oppgaver')
    expect(screen.getByText('Oppgavene')).toBeTruthy()
    expect(screen.queryByText('Idéene')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Til idéene' }))
    expect(screen.getByText('Idéene')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Til oppgaven' }))
    expect(screen.getByText('Oppgavene o1')).toBeTruthy()
    expect(screen.queryByText('Idéene')).toBeNull()
  })

  it('har en prikk og antallet i navnet, på knappen og valget, når noen har kommentert noe nytt', async () => {
    ideerMedNytt.antall = 2
    try {
      const { container } = render(
        <Ramme>
          <Ideknapp />
        </Ramme>,
      )
      const knapp = await screen.findByRole('button', { name: `${MENY} (nye kommentarer på 2 idéer)` })
      expect(container.querySelector('.toppmeny__prikk')).not.toBeNull()
      await userEvent.click(knapp)
      expect(within(panel(knapp)).getByRole('img', { name: 'nye kommentarer på 2 idéer' })).toBeTruthy()
    } finally {
      ideerMedNytt.antall = 0
    }
  })

  it('ser etter nye kommentarer igjen når fanen får fokus', async () => {
    render(
      <Ramme>
        <Ideknapp />
      </Ramme>,
    )
    const knapp = screen.getByRole('button', { name: MENY })
    ideerMedNytt.antall = 1
    try {
      await act(async () => {
        window.dispatchEvent(new Event('focus'))
      })
      expect(knapp.getAttribute('aria-label')).toBe(`${MENY} (nye kommentarer på én idé)`)
    } finally {
      ideerMedNytt.antall = 0
    }
  })
})
