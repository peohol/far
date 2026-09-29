// @vitest-environment jsdom
/**
 * Bjella og varselvinduet: tallet for uleste i de valgte kategoriene, lista
 * med de nye først, hvor et varsel leder, «Merk som lest» og innstillingene.
 *
 * Økten, endringsloggen og kallene mot databasen er erstattet; det er
 * skjermbildene som prøves.
 */
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Profil } from '@delt/profil'
import type { Endring } from '../domain/versjon'
import type { Endringsloggstatus, Varselliste, Varselvalg } from '../varsler/modell'

function profil(id: string, fornavn: string): Profil {
  return {
    id,
    username: fornavn.toLowerCase(),
    first_name: fornavn,
    last_name: 'Nordmann',
    role: 'user',
    avatar_path: null,
    must_change_password: false,
    onboarding_completed: true,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
  }
}

const KARI = profil('kari', 'Kari')
const OLA = profil('ola', 'Ola')

const endring = (versjon: string, sammendrag: string): Endring => ({
  versjon,
  dato: '2026-09-29',
  sammendrag,
  typer: ['Funksjonalitet'],
  omfang: 'Mindre omfang',
  punkter: ['Noe'],
})

const LISTE: Varselliste = {
  lest_kl: '2026-09-29T12:00:00Z',
  varsler: [
    {
      kilde: 'database',
      id: 'v-ide',
      kategori: 'mine_ideer',
      ide: { id: 'i1', tittel: 'Mørk modus', forfatterId: 'kari' },
      hendelser: [{ kl: '2026-09-29T11:00:00Z', av: 'ola', kommentar: 'k1', svarTil: null }],
      oppdatert_kl: '2026-09-29T11:00:00Z',
      lest: false,
    },
    {
      kilde: 'database',
      id: 'v-aktiv',
      kategori: 'aktive_ideer',
      ide: { id: 'i2', tittel: 'Flere kilder', forfatterId: 'ola' },
      hendelser: [{ kl: '2026-09-29T10:00:00Z', av: 'ola', kommentar: 'k2', svarTil: null }],
      oppdatert_kl: '2026-09-29T10:00:00Z',
      lest: false,
    },
    {
      kilde: 'database',
      id: 'v-fortolkning',
      kategori: 'fortolkning',
      ide: null,
      hendelser: [
        {
          kl: '2026-09-28T10:00:00Z',
          av: 'ola',
          objekt: { id: 'o1', type: 'kommentar', navn: 'Uten kode – kommentar', analyttkode: null },
        },
      ],
      oppdatert_kl: '2026-09-28T10:00:00Z',
      lest: true,
    },
  ],
}

const api = vi.hoisted(() => ({
  hentVarsler: vi.fn(),
  hentUleste: vi.fn(),
  merkVarslerLest: vi.fn(async (_ider: readonly string[] | null, _til: string) => {}),
  hentVarselvalg: vi.fn(),
  lagreVarselvalg: vi.fn(async (_valg: Varselvalg) => {}),
  hentEndringsloggstatus: vi.fn(),
  lagreEndringsloggstatus: vi.fn(async (_status: Endringsloggstatus) => {}),
  lyttEtterOppfrisking: vi.fn(() => () => {}),
}))
const visIde = vi.hoisted(() => vi.fn())
const visEndringslogg = vi.hoisted(() => vi.fn())

vi.mock('../varsler/api', () => api)
vi.mock('../auth/okt', () => ({ useProfil: () => KARI }))
vi.mock('../auth/api', () => ({ hentAlleProfiler: vi.fn(async () => [KARI, OLA]) }))
vi.mock('../components/ideer/idevisning', () => ({ visIde }))
vi.mock('../components/endringsloggvisning', () => ({ visEndringslogg }))
vi.mock('../data/endringslogg', () => ({
  ENDRINGSLOGG: [endring('2.1.0', 'Varsler i toppmenyen'), endring('2.0.0', 'Noe eldre')],
}))

const { Varselknapp } = await import('../components/varsler/Varselknapp')

beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  }
})

beforeEach(() => {
  api.hentVarsler.mockResolvedValue(LISTE)
  api.hentUleste.mockResolvedValue({ mine_ideer: 1, aktive_ideer: 1 })
  api.hentVarselvalg.mockResolvedValue({})
  api.hentEndringsloggstatus.mockResolvedValue(null)
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const bjella = () => screen.getByRole('button', { name: /^Varsler/ })

async function apne() {
  const bruker = userEvent.setup()
  render(<Varselknapp />)
  await waitFor(() => expect(bjella().getAttribute('aria-label')).toBe('Varsler (3 uleste)'))
  await bruker.click(bjella())
  const vindu = await screen.findByRole('dialog', { name: 'Varsler' })
  await within(vindu).findByRole('region', { name: 'Nye' })
  return { bruker, vindu }
}

describe('bjella', () => {
  it('teller de uleste fra databasen og den nyeste føringen, og lagrer der en ny bruker begynner i loggen', async () => {
    render(<Varselknapp />)
    await waitFor(() => expect(bjella().getAttribute('aria-label')).toBe('Varsler (3 uleste)'))
    expect(screen.getByText('3')).toBeTruthy()
    expect(api.lagreEndringsloggstatus).toHaveBeenCalledWith({ fra: '2.0.0', lest: [] })
  })

  it('teller ikke det brukeren har slått av', async () => {
    api.hentVarselvalg.mockResolvedValue({ aktive_ideer: false, funksjonalitet: false })
    render(<Varselknapp />)
    await waitFor(() => expect(bjella().getAttribute('aria-label')).toBe('Varsler (1 uleste)'))
  })

  it('har ikke noe tall uten uleste', async () => {
    api.hentUleste.mockResolvedValue({})
    api.hentEndringsloggstatus.mockResolvedValue({ fra: '2.1.0', lest: [] })
    render(<Varselknapp />)
    await waitFor(() => expect(api.hentUleste).toHaveBeenCalled())
    expect(bjella().getAttribute('aria-label')).toBe('Varsler')
  })
})

describe('vinduet', () => {
  it('viser de nye først og de leste under «Tidligere»', async () => {
    const { vindu } = await apne()
    const nye = within(vindu).getByRole('region', { name: 'Nye' })
    expect(within(nye).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      expect.stringContaining('Varsler i toppmenyen'),
      expect.stringContaining('Ola Nordmann kommenterte idéen din'),
      expect.stringContaining('Ola Nordmann kommenterte en idé du har kommentert'),
    ])
    const tidligere = within(vindu).getByRole('region', { name: 'Tidligere' })
    expect(within(tidligere).getByText('Fortolkningen er endret')).toBeTruthy()
    expect(within(tidligere).getByText('Kommentaren «Uten kode – kommentar»')).toBeTruthy()
  })

  it('åpner idéen og merker varselet lest', async () => {
    const { bruker, vindu } = await apne()
    await bruker.click(within(vindu).getByRole('button', { name: 'Ola Nordmann kommenterte idéen din' }))
    expect(api.merkVarslerLest).toHaveBeenCalledWith(['v-ide'], LISTE.lest_kl)
    expect(visIde).toHaveBeenCalledWith('i1')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('åpner føringen i endringsloggen og husker at den er lest', async () => {
    const { bruker, vindu } = await apne()
    await bruker.click(within(vindu).getByRole('button', { name: 'Varsler i toppmenyen' }))
    expect(visEndringslogg).toHaveBeenCalledWith('2.1.0')
    expect(api.lagreEndringsloggstatus).toHaveBeenLastCalledWith({ fra: '2.0.0', lest: ['2.1.0'] })
  })

  it('merker ett eller alle lest', async () => {
    const { bruker, vindu } = await apne()
    const aktiv = within(vindu).getByText(/kommenterte en idé du har kommentert/).closest('li')!
    await bruker.click(within(aktiv).getByRole('button', { name: 'Merk som lest' }))
    expect(api.merkVarslerLest).toHaveBeenCalledWith(['v-aktiv'], LISTE.lest_kl)
    expect(within(within(vindu).getByRole('region', { name: 'Tidligere' })).getByText(/kommenterte en idé du har kommentert/)).toBeTruthy()

    await bruker.click(within(vindu).getByRole('button', { name: 'Merk alle som lest' }))
    expect(api.merkVarslerLest).toHaveBeenLastCalledWith(null, LISTE.lest_kl)
    expect(api.lagreEndringsloggstatus).toHaveBeenLastCalledWith({ fra: '2.0.0', lest: ['2.1.0'] })
    expect(within(vindu).queryByRole('region', { name: 'Nye' })).toBeNull()
    expect((within(vindu).getByRole('button', { name: 'Merk alle som lest' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('lar brukeren slå av de valgfrie kategoriene, men ikke de obligatoriske, og skjuler favorittene', async () => {
    const { bruker, vindu } = await apne()
    await bruker.click(within(vindu).getByRole('button', { name: 'Varselinnstillinger' }))
    const innstillinger = await screen.findByRole('dialog', { name: 'Varselinnstillinger' })
    const brytere = within(innstillinger).getAllByRole('switch') as HTMLInputElement[]
    expect(brytere.map((b) => [b.closest('label')!.querySelector('.varselinnstilling__tittel')!.textContent, b.checked, b.disabled])).toEqual([
      ['Endringer i fortolkningen', true, true],
      ['Kommentarer til mine idéer og kommentarer', true, true],
      ['Kommentarer til idéer jeg har vært aktiv i', true, false],
      ['Ny eller endret funksjonalitet i appen', true, false],
    ])
    await bruker.click(brytere[2]!)
    expect(api.lagreVarselvalg).toHaveBeenCalledWith({ aktive_ideer: false })
    await waitFor(() => expect(bjella().getAttribute('aria-label')).toBe('Varsler (2 uleste)'))

    await bruker.click(within(innstillinger).getByRole('button', { name: 'Tilbake til varslene' }))
    const nye = within(await screen.findByRole('dialog', { name: 'Varsler' })).getByRole('region', { name: 'Nye' })
    expect(within(nye).queryByText(/kommenterte en idé du har kommentert/)).toBeNull()
  })
})
