// @vitest-environment jsdom
/**
 * Planlagte oppgaver: lista under statusene med de utførte i en skuff, siden
 * for én oppgave med prompten og den frosne idéen, det bare en administrator
 * kan gjøre, lenken til endringsloggen, og meldingen som lar en angre.
 *
 * Økten og kallene mot databasen er erstattet; det er skjermbildene som prøves.
 */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Profil } from '@delt/profil'
import type { Idetraad } from '../ideer/modell'
import type { Oppgave, Oppgavedetaljer } from '../ideer/oppgaver'
import { ENDRINGSLOGG } from '../data/endringslogg'

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
const ADMIN = profil('admin', 'Anne', 'Admin', { role: 'admin' })
const PUBLISERT = ENDRINGSLOGG[0]!.versjon

const oppgave = (id: string, status: Oppgave['status'], ekstra: Partial<Oppgave> = {}): Oppgave => ({
  id,
  ide_id: `ide-${id}`,
  tittel: `Oppgave ${id}`,
  kategori: 'funksjonalitet',
  forfatter_id: 'kari',
  status,
  nummer: null,
  endringslogg: null,
  har_prompt: false,
  overfort_kl: '2026-09-28T10:00:00Z',
  endret_kl: null,
  klar_kl: null,
  utfort_kl: null,
  ...ekstra,
})

const OPPGAVER: Oppgave[] = [
  oppgave('a', 'ikke_paabegynt'),
  oppgave('b', 'under_arbeid', { har_prompt: true, endret_kl: '2026-09-28T11:00:00Z' }),
  oppgave('c', 'utfort', { har_prompt: true, nummer: 1, endringslogg: PUBLISERT, klar_kl: '2026-09-28T12:00:00Z', utfort_kl: '2026-09-28T13:00:00Z' }),
  oppgave('d', 'utfort', { har_prompt: true, nummer: 2, endringslogg: '99.0.0', klar_kl: '2026-09-28T12:00:00Z', utfort_kl: '2026-09-28T14:00:00Z' }),
]

const detaljer = (o: Oppgave, prompt = ''): Oppgavedetaljer => ({ ...o, prompt })

const IDEEN: Idetraad = {
  id: 'ide-a',
  forfatter_id: 'kari',
  kategori: 'funksjonalitet',
  tittel: 'Oppgave a',
  tekst: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Beskrivelsen fra idéen' }] }] },
  opprettet_kl: '2026-09-26T10:00:00Z',
  endret_kl: null,
  hjerter: 1,
  mitt_hjerte: false,
  arkivert_kl: null,
  oppgave: { id: 'a', status: 'ikke_paabegynt', nummer: null },
  sist_sett: null,
  lest_kl: '2026-09-28T09:00:00Z',
  kommentarer: [
    { id: 'k1', forelder_id: null, forfatter_id: 'kari', tekst: { type: 'doc', content: [] }, slettet: false, opprettet_kl: '2026-09-26T11:00:00Z', endret_kl: null, hjerter: 0, mitt_hjerte: false },
  ],
}

const api = vi.hoisted(() => ({
  hentOppgaver: vi.fn(),
  hentOppgave: vi.fn(),
  lagreOppgaveprompt: vi.fn(async () => {}),
  settOppgaveKlar: vi.fn(async () => {}),
  flyttOppgaveTilbake: vi.fn(async () => {}),
  hentIdetraad: vi.fn(),
  merkIdeSett: vi.fn(async () => {}),
  settHjerte: vi.fn(async () => {}),
}))
const visEndringslogg = vi.hoisted(() => vi.fn())

vi.mock('../ideer/api', () => api)
vi.mock('../components/endringsloggvisning', () => ({ visEndringslogg }))
vi.mock('../auth/okt', () => ({ useProfil: () => tilstand.meg, useOkt: () => ({}) }))
vi.mock('../auth/avatarer', () => ({ useAvatarlenker: () => new Map() }))
vi.mock('../auth/api', () => ({ hentAlleProfiler: vi.fn(async () => [KARI, ADMIN]) }))

const { Oppgaver } = await import('../components/ideer/Oppgaver')
const { Angretoast } = await import('../components/Angretoast')

beforeAll(() => {
  Element.prototype.scrollIntoView ??= function () {}
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  }
})

beforeEach(() => {
  tilstand.meg = KARI
  api.hentOppgaver.mockResolvedValue(OPPGAVER)
  api.hentOppgave.mockImplementation(async (id: string) => detaljer(OPPGAVER.find((o) => o.id === id)!))
  api.hentIdetraad.mockResolvedValue(IDEEN)
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const apne = (oppgave?: string) => render(<Oppgaver apen oppgave={oppgave} onLukk={() => {}} onIdeer={() => {}} />)

describe('lista', () => {
  it('viser oppgavene under de tre statusene, og de utførte i en lukket skuff', async () => {
    apne()
    const ikke = await screen.findByRole('region', { name: /^Ikke påbegynt/ })
    expect(within(ikke).getByRole('button', { name: /Oppgave a/ })).toBeTruthy()
    expect(within(ikke).getByText('Ingen prompt ennå')).toBeTruthy()
    expect(within(screen.getByRole('region', { name: /^Under arbeid/ })).getByRole('button', { name: /Oppgave b/ })).toBeTruthy()
    expect(within(screen.getByRole('region', { name: /^Klar til implementering/ })).getByText('Ingen oppgaver.')).toBeTruthy()

    const skuff = screen.getByRole('button', { name: /Utførte oppgaver 2/ })
    expect(skuff.getAttribute('aria-expanded')).toBe('false')
  })

  it('gir de utførte nummeret sitt, de nyeste først, og en knapp til endringsloggen når føringen er publisert', async () => {
    const bruker = userEvent.setup()
    apne()
    await bruker.click(await screen.findByRole('button', { name: /Utførte oppgaver/ }))
    const skuff = screen.getByRole('region', { name: 'Utførte oppgaver' })
    const kort = within(skuff).getAllByRole('button', { name: /^OPG-/ })
    expect(kort.map((k) => k.textContent?.slice(0, 7))).toEqual(['OPG-002', 'OPG-001'])

    // OPG-002 peker på en versjon som ikke er publisert ennå.
    expect(within(skuff).queryByRole('button', { name: /Se OPG-002/ })).toBeNull()
    await bruker.click(within(skuff).getByRole('button', { name: `Se OPG-001 i endringsloggen (versjon ${PUBLISERT})` }))
    expect(visEndringslogg).toHaveBeenCalledWith(PUBLISERT)
  })

  it('åpner en oppgave fra kortet, og tilbake går til lista', async () => {
    const bruker = userEvent.setup()
    apne()
    await bruker.click(await screen.findByRole('button', { name: /Oppgave b/ }))
    expect(await screen.findByRole('heading', { name: 'Oppgave b', level: 3 })).toBeTruthy()
    await bruker.click(screen.getByRole('button', { name: 'Tilbake til oppgavene' }))
    expect(await screen.findByRole('region', { name: /^Under arbeid/ })).toBeTruthy()
  })
})

describe('én oppgave', () => {
  it('åpnes rett fra idéene, med idéen og den frosne tråden under', async () => {
    apne('a')
    expect(await screen.findByRole('heading', { name: 'Oppgave a', level: 3 })).toBeTruthy()
    expect(api.hentOppgave).toHaveBeenCalledWith('a')
    expect(await screen.findByText('Beskrivelsen fra idéen')).toBeTruthy()
    expect(api.hentIdetraad).toHaveBeenCalledWith('ide-a')
    expect(screen.getByText(/Tråden er frosset/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Skriv en kommentar' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Svar' })).toBeNull()
  })

  it('er bare til lesing for andre enn administratorer', async () => {
    api.hentOppgave.mockResolvedValue(detaljer(OPPGAVER[1]!, 'Legg til en knapp.'))
    apne('b')
    expect(await screen.findByText('Legg til en knapp.')).toBeTruthy()
    expect(screen.queryByRole('textbox', { name: 'Prompt' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Klar til implementering' })).toBeNull()
    expect(screen.queryByRole('button', { name: /Flytt tilbake/ })).toBeNull()
  })

  it('lar en administrator skrive prompten, og merke oppgaven klar først når den er lagret', async () => {
    const bruker = userEvent.setup()
    tilstand.meg = ADMIN
    apne('a')
    const felt = await screen.findByRole('textbox', { name: 'Prompt' })
    const klar = screen.getByRole('button', { name: 'Klar til implementering' }) as HTMLButtonElement
    expect(klar.disabled).toBe(true)

    await bruker.type(felt, 'Legg til en knapp.')
    expect(klar.disabled).toBe(true)
    api.hentOppgave.mockResolvedValue(detaljer({ ...OPPGAVER[0]!, status: 'under_arbeid', har_prompt: true }, 'Legg til en knapp.'))
    await bruker.click(screen.getByRole('button', { name: 'Lagre prompten' }))
    expect(api.lagreOppgaveprompt).toHaveBeenCalledWith('a', 'Legg til en knapp.')
    await waitFor(() => expect((screen.getByRole('button', { name: 'Klar til implementering' }) as HTMLButtonElement).disabled).toBe(false))
    expect(screen.queryByRole('button', { name: 'Lagre prompten' })).toBeNull()

    await bruker.click(screen.getByRole('button', { name: 'Klar til implementering' }))
    expect(api.settOppgaveKlar).toHaveBeenCalledWith('a', true)
  })

  it('spør før prompten forlates med endringer som ikke er lagret', async () => {
    const bruker = userEvent.setup()
    tilstand.meg = ADMIN
    apne('a')
    await bruker.type(await screen.findByRole('textbox', { name: 'Prompt' }), 'Halvferdig')
    await bruker.click(screen.getByRole('button', { name: 'Tilbake til oppgavene' }))
    expect(screen.getByText('Du har endringer som ikke er lagret.')).toBeTruthy()
    await bruker.click(screen.getByRole('button', { name: 'Forkast endringene' }))
    expect(await screen.findByRole('region', { name: /^Ikke påbegynt/ })).toBeTruthy()
  })

  it('slipper vakten når endringene er forkastet ved lukking, så laget kan lukkes neste gang', async () => {
    const bruker = userEvent.setup()
    tilstand.meg = ADMIN
    const lukk = vi.fn()
    const vis = (apen: boolean, oppgave?: string) => <Oppgaver apen={apen} oppgave={oppgave} onLukk={lukk} onIdeer={() => {}} />
    const { rerender } = render(vis(true, 'a'))
    await bruker.type(await screen.findByRole('textbox', { name: 'Prompt' }), 'Halvferdig')
    await bruker.click(screen.getByRole('button', { name: 'Lukk planlagte oppgaver' }))
    expect(lukk).not.toHaveBeenCalled()
    await bruker.click(screen.getByRole('button', { name: 'Forkast endringene' }))
    expect(lukk).toHaveBeenCalledOnce()

    rerender(vis(false))
    rerender(vis(true))
    await screen.findByRole('region', { name: /^Ikke påbegynt/ })
    lukk.mockClear()
    await bruker.click(screen.getByRole('button', { name: 'Lukk planlagte oppgaver' }))
    expect(lukk).toHaveBeenCalled()
    expect(screen.queryByText('Du har endringer som ikke er lagret.')).toBeNull()

    // Samme oppgave åpnes igjen uten det som ble forkastet.
    rerender(vis(false))
    rerender(vis(true, 'a'))
    await waitFor(() => expect((screen.getByRole('textbox', { name: 'Prompt' }) as HTMLTextAreaElement).value).toBe(''))
  })

  it('lar en administrator flytte oppgaven tilbake til idéene, i to trykk', async () => {
    const bruker = userEvent.setup()
    tilstand.meg = ADMIN
    apne('b')
    await bruker.click(await screen.findByRole('button', { name: 'Flytt tilbake til idéer' }))
    expect(api.flyttOppgaveTilbake).not.toHaveBeenCalled()
    await bruker.click(screen.getByRole('button', { name: 'Bekreft: flytt tilbake til idéer' }))
    expect(api.flyttOppgaveTilbake).toHaveBeenCalledWith('b')
    expect(await screen.findByRole('region', { name: /^Under arbeid/ })).toBeTruthy()
  })

  it('viser en utført oppgave med nummeret og knappen til endringsloggen, og uten noe å endre', async () => {
    const bruker = userEvent.setup()
    tilstand.meg = ADMIN
    api.hentOppgave.mockResolvedValue(detaljer(OPPGAVER[2]!, 'Gjort.'))
    apne('c')
    expect((await screen.findByRole('note')).textContent).toMatch(/Utført som OPG-001/)
    expect(screen.queryByRole('textbox', { name: 'Prompt' })).toBeNull()
    expect(screen.queryByRole('button', { name: /Flytt tilbake/ })).toBeNull()
    await bruker.click(screen.getByRole('button', { name: 'Se i endringsloggen' }))
    expect(visEndringslogg).toHaveBeenCalledWith(PUBLISERT)
  })
})

describe('meldingen med «Angre»', () => {
  it('forsvinner etter ti sekunder', () => {
    vi.useFakeTimers()
    try {
      const ferdig = vi.fn()
      render(<Angretoast angring={{ nokkel: 1, melding: 'Gjort.', angre: async () => {} }} onFerdig={ferdig} />)
      act(() => vi.advanceTimersByTime(9_900))
      expect(ferdig).not.toHaveBeenCalled()
      act(() => vi.advanceTimersByTime(200))
      expect(ferdig).toHaveBeenCalledOnce()
    } finally {
      vi.useRealTimers()
    }
  })

  it('sier fra og blir stående når angringen ikke gikk', async () => {
    const ferdig = vi.fn()
    render(<Angretoast angring={{ nokkel: 1, melding: 'Gjort.', angre: async () => Promise.reject(new Error('nei')) }} onFerdig={ferdig} />)
    fireEvent.click(screen.getByRole('button', { name: 'Angre' }))
    expect(await screen.findByText('Fikk ikke angret. Prøv igjen.')).toBeTruthy()
    expect(ferdig).not.toHaveBeenCalled()
  })

  it('står stille mens angringen pågår, og begynner på nytt om den feiler', async () => {
    vi.useFakeTimers()
    try {
      const ferdig = vi.fn()
      let avvis: (grunn: Error) => void = () => {}
      const angre = () => new Promise<void>((_, nei) => (avvis = nei))
      render(<Angretoast angring={{ nokkel: 1, melding: 'Gjort.', angre }} onFerdig={ferdig} />)
      act(() => vi.advanceTimersByTime(9_000))
      fireEvent.click(screen.getByRole('button', { name: 'Angre' }))
      act(() => vi.advanceTimersByTime(5_000))
      expect(ferdig).not.toHaveBeenCalled()
      expect(screen.getByRole('button', { name: 'Angrer …' })).toBeTruthy()

      await act(async () => avvis(new Error('nei')))
      expect(screen.getByText('Fikk ikke angret. Prøv igjen.')).toBeTruthy()
      act(() => vi.advanceTimersByTime(9_900))
      expect(ferdig).not.toHaveBeenCalled()
      act(() => vi.advanceTimersByTime(200))
      expect(ferdig).toHaveBeenCalledOnce()
    } finally {
      vi.useRealTimers()
    }
  })
})
