// @vitest-environment jsdom
/**
 * Idévinduet: lista med sorteringen og skuffene for de overførte og de
 * arkiverte, siden for én idé med kommentartråden, hjertene, skjemaet for en
 * ny idé, hvem som ser slettknappene, og det en administrator gjør med en idé.
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
  { id: 'i1', forfatter_id: 'kari', kategori: 'fag', tittel: 'Flere TDM-kilder', opprettet_kl: '2026-09-26T10:00:00Z', endret_kl: null, hjerter: 2, mitt_hjerte: false, arkivert_kl: null, oppgave: null, kommentarer: 3, nye_kommentarer: 1 },
  { id: 'i2', forfatter_id: 'ola', kategori: 'funksjonalitet', tittel: 'Hurtigtast for kopiering', opprettet_kl: '2026-09-27T10:00:00Z', endret_kl: null, hjerter: 0, mitt_hjerte: false, arkivert_kl: null, oppgave: null, kommentarer: 0, nye_kommentarer: 0 },
  { id: 'i3', forfatter_id: 'ola', kategori: 'fag', tittel: 'Overført idé', opprettet_kl: '2026-09-20T10:00:00Z', endret_kl: null, hjerter: 1, mitt_hjerte: false, arkivert_kl: null, oppgave: { id: 'o1', status: 'under_arbeid', nummer: null }, kommentarer: 0, nye_kommentarer: 0 },
  { id: 'i4', forfatter_id: 'kari', kategori: 'annet', tittel: 'Arkivert idé', opprettet_kl: '2026-09-21T10:00:00Z', endret_kl: null, hjerter: 0, mitt_hjerte: false, arkivert_kl: new Date(Date.now() - 20 * 86_400_000).toISOString(), oppgave: null, kommentarer: 1, nye_kommentarer: 0 },
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
  arkivert_kl: null,
  oppgave: null,
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
  arkiverIde: vi.fn(async () => {}),
  gjenopprettIde: vi.fn(async () => {}),
  ryddIdearkiv: vi.fn(async () => {}),
  overforIde: vi.fn(async () => 'o-ny'),
  flyttOppgaveTilbake: vi.fn(async () => {}),
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

const onOppgaver = vi.fn()
const apne = () => render(<Ideer apen onLukk={() => {}} onOppgaver={onOppgaver} />)

describe('lista', () => {
  it('viser idéene som kort under de tre kategoriene', async () => {
    apne()
    const fag = await screen.findByRole('region', { name: /^Fag/ })
    expect(within(fag).getByRole('button', { name: /Flere TDM-kilder/ })).toBeTruthy()
    expect(screen.getByRole('region', { name: /^Funksjonalitet/ })).toBeTruthy()
    // Overførte og arkiverte idéer står ikke under kategoriene.
    expect(within(fag).queryByRole('button', { name: /Overført idé/ })).toBeNull()
    expect(within(screen.getByRole('region', { name: /^Annet/ })).queryByRole('button', { name: /Arkivert idé/ })).toBeNull()
  })

  it('har en knapp for en ny idé under hver kategori, også når den har idéer, som starter med kategorien valgt', async () => {
    const bruker = userEvent.setup()
    apne()
    const fag = await screen.findByRole('region', { name: /^Fag/ })
    const knapper = within(fag).getAllByRole('button')
    expect(knapper.at(-1)!.getAttribute('aria-label')).toBe('Ny idé i fag')
    expect(within(screen.getByRole('region', { name: /^Annet/ })).getByRole('button', { name: 'Ny idé i annet' })).toBeTruthy()

    await bruker.click(knapper.at(-1)!)
    expect((screen.getByRole('radio', { name: 'Fag' }) as HTMLInputElement).checked).toBe(true)
  })

  it('har ingen knapp for en ny idé under hver bruker', async () => {
    api.hentSortering.mockResolvedValue({ forst: 'bruker', deretter: 'tid' })
    apne()
    const ola = await screen.findByRole('region', { name: /Ola Svendsen/ })
    expect(within(ola).queryByRole('button', { name: /Ny idé/ })).toBeNull()
  })

  it('har de overførte idéene i en lukket skuff, der et kort åpner oppgaven', async () => {
    const bruker = userEvent.setup()
    apne()
    const skuff = await screen.findByRole('button', { name: /Planlagte oppgaver 1/ })
    expect(skuff.getAttribute('aria-expanded')).toBe('false')
    await bruker.click(skuff)
    expect(skuff.getAttribute('aria-expanded')).toBe('true')
    const kort = screen.getByRole('button', { name: /Overført idé/ })
    expect(within(kort).getByText('Under arbeid')).toBeTruthy()
    await bruker.click(kort)
    expect(onOppgaver).toHaveBeenCalledWith('o1')
  })

  it('har arkivet i en lukket skuff nederst, med når idéene slettes, og arkiverte idéer kan leses men ikke kommenteres', async () => {
    const bruker = userEvent.setup()
    api.hentIdetraad.mockResolvedValue({ ...TRAAD, id: 'i4', tittel: 'Arkivert idé', arkivert_kl: IDEER[3]!.arkivert_kl })
    apne()
    const knapper = await screen.findAllByRole('button', { name: /^(Planlagte oppgaver|Ikke aktuelt) \d/ })
    expect(knapper.map((k) => k.textContent)).toEqual(['Planlagte oppgaver1', 'Ikke aktuelt1'])
    await bruker.click(knapper[1]!)
    const kort = screen.getByRole('button', { name: /Arkivert idé/ })
    expect(within(kort).getByText('Slettes om 40 dager')).toBeTruthy()

    await bruker.click(kort)
    expect(await screen.findByRole('heading', { name: 'Arkivert idé', level: 3 })).toBeTruthy()
    expect(screen.getByRole('note').textContent).toMatch(/Ikke aktuelt\. Idéen slettes automatisk/)
    expect(screen.queryByRole('button', { name: 'Skriv en kommentar' })).toBeNull()
    expect(screen.getByText(/Tråden er frosset/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Svar' })).toBeNull()
    expect((screen.getByRole('button', { name: '2 hjerter på idéen' }) as HTMLButtonElement).disabled).toBe(true)
    // Bare en administrator kan gjenopprette.
    expect(screen.queryByRole('button', { name: 'Gjenopprett' })).toBeNull()
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

describe('det nye', () => {
  it('viser de nye kommentarene på kortet', async () => {
    apne()
    const kort = await screen.findByRole('button', { name: /Flere TDM-kilder/ })
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
    // Ingen andre enn administratorer kan arkivere eller overføre.
    expect(screen.queryByRole('button', { name: 'Ikke aktuelt' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Overfør til planlagte oppgaver' })).toBeNull()
  })
})

describe('det en administrator gjør med en idé', () => {
  const tilIdeen = async (bruker: ReturnType<typeof userEvent.setup>) => {
    tilstand.meg = ADMIN
    apne()
    await bruker.click(await screen.findByRole('button', { name: /Flere TDM-kilder/ }))
    await screen.findByRole('heading', { name: 'Flere TDM-kilder', level: 3 })
  }

  it('legger den i «Ikke aktuelt», og kan angre fra meldingen nederst', async () => {
    const bruker = userEvent.setup()
    await tilIdeen(bruker)
    await bruker.click(screen.getByRole('button', { name: 'Ikke aktuelt' }))
    expect(api.arkiverIde).toHaveBeenCalledWith('i1')
    expect(await screen.findByRole('region', { name: /^Fag/ })).toBeTruthy()
    const melding = screen.getByRole('status')
    expect(melding.textContent).toMatch(/Idéen er lagt i «Ikke aktuelt»/)

    const hentinger = api.hentIdeer.mock.calls.length
    await bruker.click(within(melding).getByRole('button', { name: 'Angre' }))
    expect(api.gjenopprettIde).toHaveBeenCalledWith('i1')
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull())
    expect(api.hentIdeer.mock.calls.length).toBeGreaterThan(hentinger)
  })

  it('overfører den til planlagte oppgaver, og kan angre fra meldingen nederst', async () => {
    const bruker = userEvent.setup()
    await tilIdeen(bruker)
    await bruker.click(screen.getByRole('button', { name: 'Overfør til planlagte oppgaver' }))
    expect(api.overforIde).toHaveBeenCalledWith('i1')
    const melding = await screen.findByRole('status')
    expect(melding.textContent).toMatch(/overført til planlagte oppgaver/)
    await bruker.click(within(melding).getByRole('button', { name: 'Angre' }))
    expect(api.flyttOppgaveTilbake).toHaveBeenCalledWith('o-ny')
  })

  it('blir stående på idéen med feilen når det ikke gikk', async () => {
    const bruker = userEvent.setup()
    api.arkiverIde.mockRejectedValueOnce(new Error('Noe gikk galt. Prøv igjen.'))
    await tilIdeen(bruker)
    await bruker.click(screen.getByRole('button', { name: 'Ikke aktuelt' }))
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Flere TDM-kilder', level: 3 })).toBeTruthy()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('gjenoppretter en arkivert idé, eller sletter den for godt', async () => {
    const bruker = userEvent.setup()
    const arkivert = { ...TRAAD, arkivert_kl: '2026-09-28T10:00:00Z' }
    api.hentIdetraad.mockResolvedValueOnce(arkivert).mockResolvedValueOnce(TRAAD)
    await tilIdeen(bruker)
    await bruker.click(screen.getByRole('button', { name: 'Gjenopprett' }))
    expect(api.gjenopprettIde).toHaveBeenCalledWith('i1')
    // Hentet på nytt: åpen igjen, med knappene for å arkivere og overføre.
    expect(await screen.findByRole('button', { name: 'Ikke aktuelt' })).toBeTruthy()

    cleanup()
    api.hentIdetraad.mockResolvedValue(arkivert)
    await tilIdeen(bruker)
    await bruker.click(screen.getByRole('button', { name: 'Slett idéen for godt' }))
    await bruker.click(screen.getByRole('button', { name: 'Bekreft sletting av idéen for godt' }))
    expect(api.slettIde).toHaveBeenCalledWith('i1')
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
