// @vitest-environment jsdom
/**
 * Idévinduet: lista med sorteringen, siden for én idé med kommentartråden,
 * hjertene, skjemaet for en ny idé og hvem som ser slettknappene.
 *
 * Økten og kallene mot databasen er erstattet; det er skjermbildene som prøves.
 */
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Profil } from '@delt/profil'
import type { Ide, Idetraad, Sortering } from '../ideer/modell'

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

const tilstand = vi.hoisted(() => ({ meg: null as unknown as Profil }))
const KARI = profil('kari', 'Kari', 'Nordmann')
const OLA = profil('ola', 'Ola', 'Svendsen')
const ADMIN = profil('admin', 'Anne', 'Admin', { role: 'admin' })

const DOK = (tekst: string) => ({ type: 'doc' as const, content: [{ type: 'paragraph', content: [{ type: 'text', text: tekst }] }] })

const IDEER: Ide[] = [
  { id: 'i1', forfatter_id: 'kari', kategori: 'fag', tittel: 'Flere TDM-kilder', opprettet_kl: '2026-09-26T10:00:00Z', endret_kl: null, hjerter: 2, mitt_hjerte: false, status: 'planlagt', kommentarer: 3, nye_kommentarer: 1 },
  { id: 'i2', forfatter_id: 'ola', kategori: 'funksjonalitet', tittel: 'Hurtigtast for kopiering', opprettet_kl: '2026-09-27T10:00:00Z', endret_kl: null, hjerter: 0, mitt_hjerte: false, status: null, kommentarer: 0, nye_kommentarer: 0 },
]

const TRAAD: Idetraad = {
  id: 'i1',
  forfatter_id: 'kari',
  kategori: 'fag',
  tittel: 'Flere TDM-kilder',
  tekst: DOK('Beskrivelsen av idéen'),
  opprettet_kl: '2026-09-26T10:00:00Z',
  endret_kl: null,
  hjerter: 2,
  mitt_hjerte: false,
  status: 'planlagt',
  // Kari var sist inne før Olas siste svar.
  sist_sett: '2026-09-26T12:30:00Z',
  lest_kl: '2026-09-27T09:00:00Z',
  kommentarer: [
    { id: 'k1', forelder_id: null, forfatter_id: 'ola', tekst: DOK('Enig!'), slettet: false, opprettet_kl: '2026-09-26T11:00:00Z', endret_kl: null, hjerter: 1, mitt_hjerte: false },
    { id: 'k2', forelder_id: 'k1', forfatter_id: 'kari', tekst: DOK('Takk, Ola'), slettet: false, opprettet_kl: '2026-09-26T12:00:00Z', endret_kl: null, hjerter: 0, mitt_hjerte: false },
    { id: 'k3', forelder_id: 'k2', forfatter_id: 'ola', tekst: DOK('Bare hyggelig'), slettet: false, opprettet_kl: '2026-09-26T13:00:00Z', endret_kl: null, hjerter: 0, mitt_hjerte: false },
  ],
}

const api = vi.hoisted(() => ({
  hentIdeer: vi.fn(),
  hentIdetraad: vi.fn(),
  hentSortering: vi.fn(),
  lagreSortering: vi.fn(async (_s: Sortering) => {}),
  opprettIde: vi.fn(async () => 'ny'),
  endreIde: vi.fn(async () => {}),
  slettIde: vi.fn(async () => {}),
  opprettKommentar: vi.fn(async () => {}),
  endreKommentar: vi.fn(async () => {}),
  slettKommentar: vi.fn(async () => {}),
  settHjerte: vi.fn(async () => {}),
  settIdestatus: vi.fn(async () => {}),
  merkIdeSett: vi.fn(async () => {}),
  hentIdeerMedNytt: vi.fn(async () => 0),
}))

vi.mock('../ideer/api', () => api)
vi.mock('../auth/okt', () => ({ useProfil: () => tilstand.meg, useOkt: () => ({}) }))
vi.mock('../auth/avatarer', () => ({ useAvatarlenker: () => new Map() }))
vi.mock('../auth/api', () => ({ hentAlleProfiler: vi.fn(async () => [KARI, OLA, ADMIN]) }))

const { Ideer } = await import('../components/ideer/Ideer')

beforeAll(() => {
  Element.prototype.scrollIntoView ??= function () {}
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  }
  // TipTap måler markøren; jsdom har ingen oppsett å måle i.
  document.elementFromPoint ??= () => null
  Range.prototype.getClientRects ??= () => ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] }) as unknown as DOMRectList
  Range.prototype.getBoundingClientRect ??= () => new DOMRect()
})

beforeEach(() => {
  tilstand.meg = KARI
  api.hentIdeer.mockResolvedValue(IDEER)
  api.hentIdetraad.mockResolvedValue(TRAAD)
  api.hentSortering.mockResolvedValue({ forst: 'kategori', deretter: 'tid' })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const apne = () => render(<Ideer apen onLukk={() => {}} />)

describe('lista', () => {
  it('viser idéene som kort under de tre kategoriene', async () => {
    apne()
    const fag = await screen.findByRole('region', { name: /^Fag/ })
    expect(within(fag).getByRole('button', { name: /Flere TDM-kilder/ })).toBeTruthy()
    expect(screen.getByRole('region', { name: /^Funksjonalitet/ })).toBeTruthy()
    // En tom kategori har et kort som starter en ny idé i den.
    expect(within(screen.getByRole('region', { name: /^Annet/ })).getByRole('button', { name: 'Ny idé i annet' })).toBeTruthy()
  })

  it('grupperer etter bruker og lagrer valget, og tid kan ikke velges først', async () => {
    const bruker = userEvent.setup()
    apne()
    await screen.findByRole('region', { name: /^Fag/ })
    const forst = screen.getByRole('group', { name: 'Grupper etter' })
    expect(within(forst).queryByRole('button', { name: 'Tid' })).toBeNull()

    await bruker.click(within(forst).getByRole('button', { name: 'Bruker' }))
    expect(api.lagreSortering).toHaveBeenCalledWith({ forst: 'bruker', deretter: 'tid' })
    expect(screen.getByRole('region', { name: /Kari Nordmann/ })).toBeTruthy()
    expect(screen.getByRole('region', { name: /Ola Svendsen/ })).toBeTruthy()
    const deretter = screen.getByRole('group', { name: 'Sorter etter' })
    expect(within(deretter).getByRole('button', { name: 'Kategori' })).toBeTruthy()
    expect(within(deretter).queryByRole('button', { name: 'Bruker' })).toBeNull()
  })

  it('bruker sorteringen som er lagret på brukeren', async () => {
    api.hentSortering.mockResolvedValue({ forst: 'bruker', deretter: 'kategori' })
    apne()
    expect(await screen.findByRole('region', { name: /Ola Svendsen/ })).toBeTruthy()
  })
})

describe('én idé', () => {
  it('åpnes fra kortet med beskrivelsen og tråden, og tilbake går til lista', async () => {
    const bruker = userEvent.setup()
    apne()
    await bruker.click(await screen.findByRole('button', { name: /Flere TDM-kilder/ }))
    expect(await screen.findByRole('heading', { name: 'Flere TDM-kilder', level: 3 })).toBeTruthy()
    expect(screen.getByText('Beskrivelsen av idéen')).toBeTruthy()
    expect(screen.getByRole('heading', { name: '3 kommentarer' })).toBeTruthy()
    expect(api.hentIdetraad).toHaveBeenCalledWith('i1')

    await bruker.click(screen.getByRole('button', { name: 'Tilbake til idéene' }))
    expect(await screen.findByRole('region', { name: /^Fag/ })).toBeTruthy()
  })

  it('legger en kommentar og svarene under den sammen', async () => {
    const bruker = userEvent.setup()
    apne()
    await bruker.click(await screen.findByRole('button', { name: /Flere TDM-kilder/ }))
    const [skjul] = await screen.findAllByRole('button', { name: 'Skjul kommentaren og svarene' })
    expect(skjul!.getAttribute('aria-expanded')).toBe('true')
    await bruker.click(skjul!)
    const vis = screen.getAllByRole('button', { name: 'Vis kommentaren' })[0]!
    expect(vis.getAttribute('aria-expanded')).toBe('false')
    // Antallet svar som ble lagt sammen, står i hodet.
    expect(screen.getByText('2 svar')).toBeTruthy()
  })

  it('gir hjerte med én gang og lagrer det', async () => {
    const bruker = userEvent.setup()
    apne()
    await bruker.click(await screen.findByRole('button', { name: /Flere TDM-kilder/ }))
    const hjerte = await screen.findByRole('button', { name: 'Gi hjerte til idéen (2)' })
    await bruker.click(hjerte)
    expect(screen.getByRole('button', { name: 'Ta tilbake hjertet på idéen (3)' }).getAttribute('aria-pressed')).toBe('true')
    expect(api.settHjerte).toHaveBeenCalledWith('i1', null, 'kari', true)
  })

  it('lar forfatteren redigere og slette, andre bare gi hjerte og svare', async () => {
    const bruker = userEvent.setup()
    tilstand.meg = OLA
    apne()
    await bruker.click(await screen.findByRole('button', { name: /Flere TDM-kilder/ }))
    await screen.findByRole('heading', { name: 'Flere TDM-kilder', level: 3 })
    expect(screen.queryByRole('button', { name: 'Slett idéen' })).toBeNull()
    // Olas egne kommentarer kan endres og slettes, ikke Karis.
    expect(screen.getAllByRole('button', { name: 'Rediger' })).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: 'Slett kommentaren' })).toHaveLength(2)
  })

  it('lar en administrator slette andres idé, i to trykk', async () => {
    const bruker = userEvent.setup()
    tilstand.meg = ADMIN
    apne()
    await bruker.click(await screen.findByRole('button', { name: /Flere TDM-kilder/ }))
    await bruker.click(await screen.findByRole('button', { name: 'Slett idéen' }))
    expect(api.slettIde).not.toHaveBeenCalled()
    await bruker.click(screen.getByRole('button', { name: 'Bekreft sletting av idéen' }))
    expect(api.slettIde).toHaveBeenCalledWith('i1')
    expect(await screen.findByRole('region', { name: /^Fag/ })).toBeTruthy()
  })
})

describe('status og det nye', () => {
  it('viser statusen og de nye kommentarene på kortet', async () => {
    apne()
    const kort = await screen.findByRole('button', { name: /Flere TDM-kilder/ })
    expect(within(kort).getByText('Planlagt')).toBeTruthy()
    expect(within(kort).getByRole('img', { name: '3 kommentarer, 1 ny' })).toBeTruthy()
  })

  it('merker idéen som sett, og viser hvilke kommentarer som var nye', async () => {
    const bruker = userEvent.setup()
    apne()
    await bruker.click(await screen.findByRole('button', { name: /Flere TDM-kilder/ }))
    await screen.findByRole('heading', { name: 'Flere TDM-kilder', level: 3 })
    await waitFor(() => expect(api.merkIdeSett).toHaveBeenCalledWith(expect.objectContaining({ id: 'i1', lest_kl: '2026-09-27T09:00:00Z' })))
    // Bare Olas svar etter forrige besøk er nytt; Karis egne er aldri det.
    expect(screen.getAllByText('Ny')).toHaveLength(1)
    // Ingen andre enn administratorer ser statusvalgene.
    expect(screen.queryByRole('group', { name: 'Status' })).toBeNull()
  })

  it('lar en administrator gi idéen status', async () => {
    const bruker = userEvent.setup()
    tilstand.meg = ADMIN
    apne()
    await bruker.click(await screen.findByRole('button', { name: /Flere TDM-kilder/ }))
    const status = await screen.findByRole('group', { name: 'Status' })
    expect(within(status).getByRole('button', { name: 'Planlagt' }).getAttribute('aria-pressed')).toBe('true')
    await bruker.click(within(status).getByRole('button', { name: 'Gjennomført' }))
    expect(api.settIdestatus).toHaveBeenCalledWith('i1', 'gjennomfort')
    expect(within(status).getByRole('button', { name: 'Gjennomført' }).getAttribute('aria-pressed')).toBe('true')
    await bruker.click(within(status).getByRole('button', { name: 'Ingen' }))
    expect(api.settIdestatus).toHaveBeenLastCalledWith('i1', null)
  })
})

describe('en ny idé', () => {
  it('krever kategori og overskrift, og åpner idéen når den er publisert', async () => {
    const bruker = userEvent.setup()
    apne()
    await bruker.click(await screen.findByRole('button', { name: 'Ny idé' }))
    await bruker.click(screen.getByRole('button', { name: 'Publiser' }))
    expect(screen.getByRole('alert').textContent).toBe('Velg en kategori.')

    await bruker.click(screen.getByRole('radio', { name: 'Funksjonalitet' }))
    await bruker.click(screen.getByRole('button', { name: 'Publiser' }))
    expect(screen.getByRole('alert').textContent).toBe('Skriv en overskrift.')

    await bruker.type(screen.getByLabelText('Overskrift'), '  Mørkt tema i utskriften ')
    await bruker.click(screen.getByRole('button', { name: 'Publiser' }))
    await waitFor(() =>
      expect(api.opprettIde).toHaveBeenCalledWith({ kategori: 'funksjonalitet', tittel: 'Mørkt tema i utskriften', tekst: null }),
    )
    expect(api.hentIdetraad).toHaveBeenCalledWith('ny')
  })

  it('kan ikke forlates mens den lagres', async () => {
    const bruker = userEvent.setup()
    let svar!: (id: string) => void
    api.opprettIde.mockImplementationOnce(() => new Promise<string>((r) => (svar = r)))
    apne()
    await bruker.click(await screen.findByRole('button', { name: 'Ny idé' }))
    await bruker.click(screen.getByRole('radio', { name: 'Fag' }))
    await bruker.type(screen.getByLabelText('Overskrift'), 'Underveis')
    await bruker.click(screen.getByRole('button', { name: 'Publiser' }))

    await bruker.click(screen.getByRole('button', { name: 'Tilbake til idéene' }))
    expect(screen.getByRole('button', { name: 'Lagrer …' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Forkast/ })).toBeNull()

    svar('ny')
    expect(await screen.findByRole('heading', { name: 'Flere TDM-kilder', level: 3 })).toBeTruthy()
  })
})
