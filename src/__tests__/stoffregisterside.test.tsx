// @vitest-environment jsdom
/**
 * Helsiden for stoffregisteret (`#/stoffregister`), prøvd med et lager i
 * minnet som endrer inndelingen slik databasen gjør (`endreStruktur`):
 * kategoriene som seksjoner med stoffene som kort, oppsummeringen, veien til
 * fagsiden og fortolkningen, arkivet med angring, redigeringen og
 * papirkurven, som bare administratorer ser. Reglene i selve databasen
 * prøves i `stoffregisterdb.test.ts`.
 */
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { Fagsidebanner, Fagsidemeny } from '../components/stoffregister/Fagsidestatus'
import { Registerhandlingskilde } from '../components/stoffregister/Registerhandling'
import { Stoffregisterside } from '../components/stoffregister/Stoffregisterside'
import { TipsLag } from '../components/Tips'
import { ANALYTTKATALOG } from '../domain/analyttkatalog'
import type { Registerlager } from '../stoffregister/api'
import { StoffregisterkildeProvider, useLagStoffregisterkilde } from '../stoffregister/Stoffregisterkilde'
import { endreStruktur, type Registerdatabase, type Registerendring, type Registerside } from '../stoffregister/modell'
import { GRUNNSTRUKTUR, kategoriid } from './hjelp/registerstruktur'

beforeAll(() => {
  // Uten animasjoner, så kortene står åpne med en gang.
  window.matchMedia = ((sporring: string) => ({
    matches: sporring.includes('reduce'),
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Element.prototype.scrollIntoView ??= function () {}
  window.scrollTo = () => {}
})

afterEach(cleanup)

const OPPSUMMERING = {
  type: 'doc' as const,
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Et syntetisk sammendrag.' }] }],
}

/** En fagside registeret ikke har plassert, med bare et navn, og Bupropion med en oppsummering. */
const SIDER: Registerside[] = [
  { id: 'stoff', slug: 'teststoff', navn: 'Teststoff', innhold: false, oppsummering: null },
  { id: 'bup', slug: 'bupropion', navn: 'Bupropion', innhold: true, oppsummering: OPPSUMMERING },
]

/** Et lager i minnet: endringene gjøres som i databasen, og `les` gir det som står der nå. */
function lagLager(): Registerlager & { data: Registerdatabase } {
  const data: Registerdatabase = { sider: SIDER, struktur: GRUNNSTRUKTUR }
  const endre = async (e: Registerendring) => {
    data.struktur = endreStruktur(data.struktur, e)
  }
  let nye = 0
  return {
    data,
    les: vi.fn(async () => ({ sider: data.sider, struktur: data.struktur })),
    opprettKategori: vi.fn(async (navn: string, forelder: string | null) => {
      const id = `ny-${++nye}`
      const posisjon = data.struktur.kategorier.filter((k) => k.forelder === forelder).length
      data.struktur = {
        ...data.struktur,
        kategorier: [...data.struktur.kategorier, { id, forelder, navn, posisjon, ikon: null, arkivert_kl: null }],
      }
      return id
    }),
    endreKategori: vi.fn((kategori: string, navn: string) => endre({ type: 'endre-kategori', kategori, navn })),
    flyttKategori: vi.fn((kategori: string, forelder: string | null, indeks: number) =>
      endre({ type: 'flytt-kategori', kategori, forelder, indeks }),
    ),
    arkiverKategori: vi.fn((kategori: string, arkivert: boolean) => endre({ type: 'arkiver-kategori', kategori, arkivert })),
    slettKategori: vi.fn((kategori: string) => endre({ type: 'slett-kategori', kategori })),
    plasserStoff: vi.fn((stoff: string, fra: string | null, til: string | null) =>
      endre({ type: 'plasser-stoff', stoff, fra, til }),
    ),
    arkiverStoff: vi.fn((stoff: string, arkivert: boolean) =>
      endre({ type: 'sett-status', stoff, status: arkivert ? 'arkivert' : null }),
    ),
    slettStoff: vi.fn((stoff: string) => endre({ type: 'sett-status', stoff, status: 'papirkurv' })),
    gjenopprettStoff: vi.fn((stoff: string) => endre({ type: 'sett-status', stoff, status: null })),
    slettStoffForGodt: vi.fn((stoff: string) => endre({ type: 'sett-status', stoff, status: 'fjernet' })),
    tomPapirkurven: vi.fn(async () => {
      const i = data.struktur.status.filter((r) => r.status === 'papirkurv')
      data.struktur = {
        ...data.struktur,
        status: data.struktur.status.map((r) => (r.status === 'papirkurv' ? { ...r, status: 'fjernet' as const } : r)),
      }
      return i.length
    }),
    rydd: vi.fn(async () => 0),
  }
}

function Side({ lager, admin, children }: { lager: Registerlager; admin: boolean; children?: ReactNode }) {
  const kilde = useLagStoffregisterkilde({ lager, admin })
  return (
    <StoffregisterkildeProvider kilde={kilde}>
      {children ?? <Stoffregisterside katalog={ANALYTTKATALOG} onApneFortolkning={onApneFortolkning} onLukk={onLukk} />}
    </StoffregisterkildeProvider>
  )
}

const onApneFortolkning = vi.fn()
const onLukk = vi.fn()

async function vis({ admin = false, lager = lagLager() } = {}) {
  onApneFortolkning.mockClear()
  onLukk.mockClear()
  render(
    <TipsLag>
      <Side lager={lager} admin={admin} />
    </TipsLag>,
  )
  await screen.findByText(/stoffer i \d+ kategorier/)
  return lager
}

/** Åpner seksjonen eller kortet med navnet, og gir det som står i det. */
async function apne(navn: string, i: HTMLElement = document.body): Promise<HTMLElement> {
  const knapp = within(i).getByRole('button', { name: new RegExp(`^${navn}`) })
  if (knapp.getAttribute('aria-expanded') !== 'true') await userEvent.click(knapp)
  return document.getElementById(knapp.getAttribute('aria-controls')!)!
}

describe('lesevisningen', () => {
  it('viser en seksjon per kategori med underkategoriene som mellomtitler, og «Andre stoffer» sist', async () => {
    await vis()
    expect(screen.getByRole('heading', { level: 1, name: 'Stoffregister' })).toBeTruthy()
    expect(document.title).toBe('Stoffregister – OUSFAR')
    const titler = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(titler.slice(-2)).toEqual(['Andre stoffer', 'Arkiv'])
    const antidepressiver = await apne('Antidepressiver')
    expect(within(antidepressiver).getByRole('heading', { level: 3, name: 'NDRI' })).toBeTruthy()
  })

  it('åpner et stoff som kort med oppsummeringen og veiene til fagsiden og fortolkningen', async () => {
    await vis()
    const kort = await apne('Bupropion', await apne('Antidepressiver'))
    expect(within(kort).getByText('Et syntetisk sammendrag.')).toBeTruthy()
    expect(within(kort).getByRole('link', { name: 'Åpne fagside' }).getAttribute('href')).toBe('#/stoff/bupropion')
    await userEvent.click(within(kort).getByRole('button', { name: 'Åpne fortolkning' }))
    expect(onApneFortolkning).toHaveBeenCalledWith(ANALYTTKATALOG.finn('HBUP')!.fortolkning)
    // Står i én kategori.
    expect(within(kort).getByText('Antidepressiver › NDRI')).toBeTruthy()

    const teststoff = await apne('Teststoff', await apne('Andre stoffer'))
    expect(within(teststoff).getByText('Ingen oppsummering ennå. Den skrives på fagsiden.')).toBeTruthy()
    expect(within(teststoff).queryByRole('button', { name: 'Åpne fortolkning' })).toBeNull()
  })

  it('lukker siden med Escape', async () => {
    await vis()
    await userEvent.keyboard('{Escape}')
    expect(onLukk).toHaveBeenCalled()
  })
})

describe('arkivet og papirkurven', () => {
  it('arkiverer et stoff fra kortet, viser det i arkivet, og angrer', async () => {
    const lager = await vis()
    const kort = await apne('Teststoff', await apne('Andre stoffer'))
    await userEvent.click(within(kort).getByRole('button', { name: 'Arkiver' }))
    expect(lager.arkiverStoff).toHaveBeenCalledWith('teststoff', true)
    expect(await screen.findByText('Teststoff er arkivert.')).toBeTruthy()

    const arkiv = await apne('Arkiv')
    expect(within(arkiv).getByRole('link', { name: 'Teststoff' }).getAttribute('href')).toBe('#/stoff/teststoff')
    await userEvent.click(screen.getByRole('button', { name: 'Angre' }))
    await waitFor(() => expect(lager.arkiverStoff).toHaveBeenLastCalledWith('teststoff', false))
    await waitFor(() => expect(within(arkiv).getByText('Ingenting er arkivert.')).toBeTruthy())
  })

  it('lar alle slette en side med bare et navn, men bare administratorer ser papirkurven', async () => {
    const lager = await vis()
    expect(screen.queryByRole('heading', { name: 'Papirkurv' })).toBeNull()
    // Bupropion har innhold og er koblet til fortolkningen: den kan bare arkiveres.
    const bupropion = await apne('Bupropion', await apne('Antidepressiver'))
    expect(within(bupropion).getByRole('button', { name: 'Arkiver' })).toBeTruthy()
    expect(within(bupropion).queryByRole('button', { name: 'Slett Bupropion' })).toBeNull()
    // Én seksjon er åpen om gangen: denne lukker «Antidepressiver».
    const kort = await apne('Teststoff', await apne('Andre stoffer'))

    await userEvent.click(within(kort).getByRole('button', { name: 'Slett Teststoff' }))
    await userEvent.click(within(kort).getByRole('button', { name: 'Bekreft sletting av Teststoff' }))
    expect(lager.slettStoff).toHaveBeenCalledWith('teststoff')
    expect(await screen.findByText('Teststoff er slettet.')).toBeTruthy()
  })

  it('viser papirkurven for administratorer, med gjenoppretting og tømming', async () => {
    const lager = lagLager()
    lager.data.struktur = endreStruktur(lager.data.struktur, { type: 'sett-status', stoff: 'teststoff', status: 'papirkurv' })
    await vis({ admin: true, lager })
    const papirkurv = await apne('Papirkurv')
    expect(within(papirkurv).getByText(/slettes for godt etter 30 dager/)).toBeTruthy()
    expect(within(papirkurv).getByRole('link', { name: 'Teststoff' })).toBeTruthy()

    await userEvent.click(screen.getByRole('button', { name: 'Tøm papirkurven' }))
    await userEvent.click(screen.getByRole('button', { name: 'Bekreft tømming' }))
    expect(lager.tomPapirkurven).toHaveBeenCalled()
    await waitFor(() => expect(within(papirkurv).getByText('Papirkurven er tom.')).toBeTruthy())
  })
})

describe('redigeringen', () => {
  it('lager, gir nytt navn til og sletter en kategori, og viser det med en gang i lesevisningen', async () => {
    const lager = await vis()
    await userEvent.click(screen.getByRole('button', { name: 'Rediger stoffregisteret' }))
    expect(screen.getByText(/Stoffene står alltid alfabetisk/)).toBeTruthy()

    await userEvent.type(screen.getByLabelText('Ny kategori'), 'Testkategori{Enter}')
    expect(lager.opprettKategori).toHaveBeenCalledWith('Testkategori', null)
    const ny = (await screen.findByRole('heading', { level: 3, name: 'Testkategori' })).closest('li')!

    await userEvent.click(within(ny).getByRole('button', { name: 'Gi nytt navn' }))
    const felt = within(ny).getByLabelText('Nytt navn på Testkategori')
    await userEvent.clear(felt)
    await userEvent.type(felt, 'Omdøpt{Enter}')
    expect(lager.endreKategori).toHaveBeenCalledWith('ny-1', 'Omdøpt')
    const omdopt = (await screen.findByRole('heading', { level: 3, name: 'Omdøpt' })).closest('li')!

    // En tom kategori kan alle slette.
    await userEvent.click(within(omdopt).getByRole('button', { name: 'Slett Omdøpt' }))
    await userEvent.click(within(omdopt).getByRole('button', { name: 'Bekreft sletting av Omdøpt' }))
    expect(lager.slettKategori).toHaveBeenCalledWith('ny-1')
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Omdøpt' })).toBeNull())

    await userEvent.click(screen.getByRole('button', { name: 'Ferdig' }))
    expect(screen.queryByLabelText('Ny kategori')).toBeNull()
  })

  it('flytter en kategori ned med knappen', async () => {
    const lager = await vis()
    await userEvent.click(screen.getByRole('button', { name: 'Rediger stoffregisteret' }))
    const forste = screen.getAllByRole('heading', { level: 3 })[0]!
    // Kategoriens egen knapp står før underkategorienes.
    await userEvent.click(within(forste.closest('li')!).getAllByRole('button', { name: 'Flytt ned' })[0]!)
    expect(lager.flyttKategori).toHaveBeenCalledWith(forste.textContent, null, 1)
    await waitFor(() => expect(screen.getAllByRole('heading', { level: 3 })[1]!.textContent).toBe(forste.textContent))
  })

  it('lar bare administratorer slette en kategori med stoffer', async () => {
    await vis()
    await userEvent.click(screen.getByRole('button', { name: 'Rediger stoffregisteret' }))
    expect(screen.queryByRole('button', { name: 'Slett Antidepressiver' })).toBeNull()
    cleanup()
    await vis({ admin: true })
    await userEvent.click(screen.getByRole('button', { name: 'Rediger stoffregisteret' }))
    expect(screen.getByRole('button', { name: 'Slett Antidepressiver' })).toBeTruthy()
  })

  it('legger et stoff i en kategori til fra kortet, og tar det ut igjen', async () => {
    const lager = await vis()
    const kort = await apne('Teststoff', await apne('Andre stoffer'))
    const ssri = kategoriid('Antidepressiver', 'SSRI')
    await userEvent.selectOptions(within(kort).getByLabelText('Legg Teststoff til i en kategori'), ssri)
    expect(lager.plasserStoff).toHaveBeenCalledWith('teststoff', null, ssri)
    // Stoffet står nå under SSRI, og ikke lenger i «Andre stoffer».
    const antidepressiver = await apne('Antidepressiver')
    const iSsri = await apne('Teststoff', antidepressiver)
    await userEvent.click(within(iSsri).getByRole('button', { name: 'Ta Teststoff ut av Antidepressiver › SSRI' }))
    expect(lager.plasserStoff).toHaveBeenLastCalledWith('teststoff', ssri, null)
    await waitFor(() => expect(within(antidepressiver).queryByRole('button', { name: /^Teststoff/ })).toBeNull())
  })
})

describe('på fagsiden', () => {
  /** Menyen og meldingen øverst på fagsiden til stoffet, slik `Stoffside` viser dem. */
  async function visFagside(slug: string, { admin = false, lager = lagLager() } = {}) {
    render(
      <TipsLag>
        <Side lager={lager} admin={admin}>
          <Registerhandlingskilde>
            <Fagsidebanner slug={slug} />
            <Fagsidemeny slug={slug} />
          </Registerhandlingskilde>
        </Side>
      </TipsLag>,
    )
    await waitFor(() => expect(lager.les).toHaveBeenCalled())
    return lager
  }

  it('arkiverer og sletter fagsiden fra menyen, og henter den tilbake fra meldingen', async () => {
    const lager = await visFagside('teststoff')
    await userEvent.click(await screen.findByRole('button', { name: 'Mer for fagsiden' }))
    expect(screen.getByRole('button', { name: /Slett fagsiden/ })).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: /Arkiver fagsiden/ }))
    expect(lager.arkiverStoff).toHaveBeenCalledWith('teststoff', true)
    // En arkivert side har ingen meny, men en melding som henter den tilbake.
    expect(await screen.findByText(/Fagsiden er arkivert/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Mer for fagsiden' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Hent tilbake' }))
    expect(lager.arkiverStoff).toHaveBeenLastCalledWith('teststoff', false)
    expect(await screen.findByRole('button', { name: 'Mer for fagsiden' })).toBeTruthy()
  })

  it('lar ikke en fagside fortolkningen lenker til, slettes', async () => {
    await visFagside('bupropion', { admin: true })
    await userEvent.click(await screen.findByRole('button', { name: 'Mer for fagsiden' }))
    expect(screen.getByRole('button', { name: /Arkiver fagsiden/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Slett fagsiden/ })).toBeNull()
  })

  it('sier når en fagside i papirkurven slettes for godt, og gjenoppretter den', async () => {
    const lager = lagLager()
    lager.data.struktur = endreStruktur(lager.data.struktur, { type: 'sett-status', stoff: 'teststoff', status: 'papirkurv' })
    await visFagside('teststoff', { admin: true, lager })
    expect(await screen.findByText(/Fagsiden ligger i papirkurven og slettes for godt/)).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Gjenopprett' }))
    expect(lager.gjenopprettStoff).toHaveBeenCalledWith('teststoff')
    await waitFor(() => expect(screen.queryByText(/Fagsiden ligger i papirkurven/)).toBeNull())
  })
})

describe('når registeret ikke kan hentes', () => {
  it('sier fra, og prøver igjen', async () => {
    const lager = lagLager()
    vi.mocked(lager.les).mockRejectedValueOnce(new Error('Stoffregisteret er ikke satt opp i databasen ennå.'))
    render(
      <TipsLag>
        <Side lager={lager} admin={false} />
      </TipsLag>,
    )
    expect((await screen.findByRole('alert')).textContent).toContain('Stoffregisteret er ikke satt opp i databasen ennå.')
    await userEvent.click(screen.getByRole('button', { name: 'Prøv igjen' }))
    expect(await screen.findByText(/stoffer i \d+ kategorier/)).toBeTruthy()
  })
})
