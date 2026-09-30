// @vitest-environment jsdom
/**
 * Konto- og redigeringsflatene i Atlas: det modale laget, endringsloggen,
 * porten med innlogging og førstegangsoppsett, brukerlista med det
 * midlertidige passordet, og statusen for redigeringsmodusen.
 *
 * Økten og brukerdatabasen er erstattet; det er skjermbildene som prøves.
 */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { Profil } from '@delt/profil'
import type { Tilgang } from '../domain/tilgang'

const okt = vi.hoisted(() => ({
  tilgang: 'innlogging' as Tilgang,
  profil: null as Profil | null,
}))

vi.mock('../auth/okt', () => ({
  useOkt: () => ({
    tilgang: okt.tilgang,
    mangler: false,
    loggInn: vi.fn(async () => null),
    loggUt: vi.fn(async () => {}),
    settProfil: vi.fn(),
    forsokPaaNytt: vi.fn(),
  }),
  useProfil: () => okt.profil,
}))
vi.mock('../auth/avatarer', () => ({ useAvatarlenker: () => new Map() }))
vi.mock('../auth/api', () => ({
  hentAlleProfiler: vi.fn(async () => BRUKERE),
  nyttMidlertidigPassord: vi.fn(async () => ({ brukernavn: 'ola.s', midlertidigPassord: 'kvist-mose-47-lind' })),
  opprettBruker: vi.fn(),
  settRolle: vi.fn(),
  fullforOppsett: vi.fn(),
  lastOppAvatar: vi.fn(),
}))

const { Modallag } = await import('../components/Modallag')
const { Ikonknapp } = await import('../components/Ikonknapp')
const { Endringslogg } = await import('../components/Endringslogg')
const { ENDRINGSLOGG } = await import('../data/endringslogg')
const { Port } = await import('../components/konto/Port')
const { Brukerliste } = await import('../components/konto/Brukerliste')
const { statustekst } = await import('../components/stoffside/Redigeringslinje')
const { TipsLag } = await import('../components/Tips')
const { Versjonspille } = await import('../components/Versjonspille')
const { visEndringslogg } = await import('../components/endringsloggvisning')

function profil(id: string, fornavn: string, etternavn: string, ekstra: Partial<Profil> = {}): Profil {
  return {
    id,
    username: `${fornavn.toLowerCase()}.${etternavn[0]!.toLowerCase()}`,
    first_name: fornavn,
    last_name: etternavn,
    role: 'user',
    avatar_path: null,
    must_change_password: false,
    onboarding_completed: true,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
    ...ekstra,
  }
}

const MEG = profil('1', 'Anne', 'Admin', { role: 'admin' })
const BRUKERE = [
  MEG,
  profil('2', 'Kari', 'Nordmann'),
  profil('3', 'Ola', 'Svendsen', { must_change_password: true }),
]

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Element.prototype.scrollIntoView ??= function () {}
  // jsdom har `<dialog>`, men ikke det modale laget.
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  }
})

afterEach(cleanup)

describe('det modale laget', () => {
  it('har tittelen som navn, ikonet foran og en lukkeknapp uten tooltip', async () => {
    const onLukk = vi.fn()
    render(
      <TipsLag>
        <Ikonknapp ikon="menu" etikett="Sidemeny" />
        <Modallag apen tittel="Kontoen din" ikon="user" onLukk={onLukk}>
          <p>Innhold</p>
        </Modallag>
      </TipsLag>,
    )
    const lag = screen.getByRole('dialog', { name: 'Kontoen din' })
    expect(lag.querySelector('.modallag__ikon .ikon')).toBeTruthy()

    // En vanlig ikonknapp får boblen; lukkeknappen ikke, for boblen ville
    // ligget under det modale laget.
    const vanlig = screen.getByRole('button', { name: 'Sidemeny' })
    await userEvent.hover(vanlig)
    expect(document.querySelector('.tipsboble')?.textContent).toBe('Sidemeny')
    await userEvent.unhover(vanlig)
    await waitFor(() => expect(document.querySelector('.tipsboble')).toBeNull())

    const lukk = within(lag).getByRole('button', { name: 'Lukk kontoen din' })
    await userEvent.hover(lukk)
    expect(document.querySelector('.tipsboble')).toBeNull()
    await userEvent.click(lukk)
    expect(onLukk).toHaveBeenCalledOnce()
  })

  it('lukkes av et trykk utenfor panelet, men ikke av en markering som slippes utenfor', async () => {
    const onLukk = vi.fn()
    render(
      <Modallag apen tittel="Idéer" onLukk={onLukk}>
        <p>Tekst som markeres</p>
      </Modallag>,
    )
    const lag = screen.getByRole('dialog', { name: 'Idéer' })
    const tekst = screen.getByText('Tekst som markeres')

    // Trykket begynner i panelet og slipper utenfor: nettleseren sender
    // klikket til den felles forelderen, som er selve bakgrunnen.
    fireEvent.pointerDown(tekst)
    fireEvent.click(lag)
    expect(onLukk).not.toHaveBeenCalled()

    // Og motsatt: begynner utenfor og slipper i panelet.
    fireEvent.pointerDown(lag)
    fireEvent.click(tekst)
    expect(onLukk).not.toHaveBeenCalled()

    await userEvent.click(lag)
    expect(onLukk).toHaveBeenCalledOnce()
  })

  it('legger fokus der `autofokus` peker', () => {
    render(
      <Modallag apen tittel="Endringslogg" onLukk={() => {}} autofokus=".mal">
        <button type="button">Først</button>
        <button type="button" className="mal">
          Målet
        </button>
      </Modallag>,
    )
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Målet' }))
  })
})

describe('endringsloggen', () => {
  it('åpner med fokus på den nyeste føringen, og har bare én føring åpen om gangen', async () => {
    render(<Endringslogg apen onLukk={() => {}} />)
    const lag = screen.getByRole('dialog', { name: 'Endringslogg' })
    const [forste, andre] = within(lag).getAllByRole('button', { expanded: false })
    expect(document.activeElement).toBe(forste)
    expect(forste!.textContent).toContain(ENDRINGSLOGG[0]!.sammendrag)

    await userEvent.click(forste!)
    expect(forste!.getAttribute('aria-expanded')).toBe('true')
    await userEvent.click(andre!)
    expect(andre!.getAttribute('aria-expanded')).toBe('true')
    expect(forste!.getAttribute('aria-expanded')).toBe('false')
  })

  it('åpnes fra andre steder på en bestemt føring, utfoldet og med fokus', () => {
    render(
      <TipsLag>
        <Versjonspille />
      </TipsLag>,
    )
    expect(screen.queryByRole('dialog', { name: 'Endringslogg' })).toBeNull()
    const versjon = ENDRINGSLOGG[2]!
    act(() => visEndringslogg(versjon.versjon))
    const lag = screen.getByRole('dialog', { name: 'Endringslogg' })
    const foring = within(lag).getByRole('button', { name: new RegExp(versjon.sammendrag.slice(0, 30)) })
    expect(foring.getAttribute('aria-expanded')).toBe('true')
    expect(document.activeElement).toBe(foring)
  })
})

describe('porten', () => {
  it('viser merket, overskriften «Logg inn» og at kontoer opprettes av en administrator', () => {
    okt.tilgang = 'innlogging'
    render(<Port />)
    const kort = screen.getByRole('region', { name: 'Logg inn' })
    expect(within(kort).getByLabelText('Brukernavn')).toBeTruthy()
    expect(within(kort).getByLabelText('Passord')).toBeTruthy()
    expect(within(kort).getByRole('button', { name: 'Logg inn' })).toBeTruthy()
    expect(screen.getByText('OUSFAR')).toBeTruthy()
    expect(document.querySelector('.logomerke')?.getAttribute('aria-hidden')).toBe('true')
    expect(screen.getByText('OUSFAR er lukket. Kontoer opprettes av en administrator.')).toBeTruthy()
    // Temaknappen står alene, uten toppmeny.
    expect(screen.getByRole('button', { name: /Bytt til (lyst|mørkt) tema/ })).toBeTruthy()
  })

  it('ber om eget passord i førstegangsoppsettet', () => {
    okt.tilgang = 'oppsett'
    okt.profil = profil('3', 'Ola', 'Svendsen', { must_change_password: true })
    render(<Port />)
    const kort = screen.getByRole('region', { name: 'Velg ditt eget passord' })
    expect(within(kort).getByText(/logget inn med et midlertidig passord/)).toBeTruthy()
    expect(within(kort).getByRole('button', { name: 'Lagre og gå videre' })).toBeTruthy()
    expect(screen.queryByText(/Kontoer opprettes av en administrator/)).toBeNull()
  })
})

describe('brukerlista', () => {
  it('viser rollen i tekst, hvem som må bytte passord, og handlinger med navnet i', async () => {
    okt.profil = MEG
    render(<Brukerliste apen onLukk={() => {}} />)
    const lag = screen.getByRole('dialog', { name: 'Brukere' })
    const rader = await within(lag).findAllByRole('listitem')
    expect(rader.map((rad) => rad.querySelector('.brukerrad__merker')?.textContent)).toEqual([
      'Administrator',
      'Bruker',
      'BrukerMå bytte passord',
    ])
    // Egen rad har ingen handlinger.
    expect(within(rader[0]!).queryAllByRole('button')).toEqual([])
    expect(within(rader[1]!).getByRole('button', { name: 'Gjør til admin: Kari Nordmann' })).toBeTruthy()

    await userEvent.click(within(rader[2]!).getByRole('button', { name: 'Nytt passord for Ola Svendsen' }))
    const kvittering = await within(lag).findByRole('alert')
    expect(within(kvittering).getByText('kvist-mose-47-lind')).toBeTruthy()
    expect(within(kvittering).getByText(/vises bare nå/)).toBeTruthy()
    await userEvent.click(within(kvittering).getByRole('button', { name: 'Jeg har notert passordet' }))
    await waitFor(() => expect(within(lag).queryByRole('alert')).toBeNull())
  })
})

describe('statusen for redigeringsmodusen', () => {
  it('teller det som ikke er publisert', () => {
    expect(statustekst(true, 3, false)).toBe('Henter utkastet …')
    expect(statustekst(false, 0, false)).toBe('Redigerer · ingen upubliserte endringer')
    expect(statustekst(false, 0, true)).toBe('Redigerer · alt er publisert')
    expect(statustekst(false, 1, false)).toBe('Redigerer · utkast med 1 endring')
    expect(statustekst(false, 3, false)).toBe('Redigerer · utkast med 3 endringer')
  })
})
