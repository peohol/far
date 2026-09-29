// @vitest-environment jsdom
/**
 * Oppdatering til en ny versjon: meldingen med «Oppdater nå» når et annet
 * bygg er lagt ut, og at det brukeren holder på med — et vindu som står åpent,
 * et skjema som er halvveis skrevet, fortolkningen — kommer tilbake etter at
 * siden er lastet på nytt.
 *
 * En omlasting er her: bildet tas og legges i fanen, alt tas ned, modulen
 * glemmer det den har lest, og appen tegnes opp på nytt.
 */
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Profil } from '@delt/profil'
import { Oppdateringsmelding } from '../components/Oppdateringsmelding'
import { FORTOLKNINGSOPPFORINGER } from '../domain/analyttkatalog'
import type { Ide } from '../ideer/modell'
import { Bevaringsomrade, useBevart, type Bevaringsform } from '../oppdatering/Bevaring'
import { GYLDIG_I, LAGRINGSNOKKEL, glemBildet, oppdaterOgTaVare, taBilde } from '../oppdatering/bevaring'
import { BYGG, hentUtlagtBygg, nyVersjon } from '../oppdatering/versjon'
import { fortolkningsform, initialState, type State } from '../state'

const tilstand = vi.hoisted(() => ({ meg: null as unknown as Profil }))
const KARI: Profil = {
  id: 'kari',
  username: 'kari.n',
  first_name: 'Kari',
  last_name: 'Nordmann',
  role: 'user',
  avatar_path: null,
  must_change_password: false,
  onboarding_completed: true,
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
}
const IDEER: Ide[] = [
  { id: 'i1', forfatter_id: 'kari', kategori: 'fag', tittel: 'Flere TDM-kilder', opprettet_kl: '2026-09-26T10:00:00Z', endret_kl: null, hjerter: 0, mitt_hjerte: false, arkivert_kl: null, oppgave: null, kommentarer: 0, nye_kommentarer: 0 },
]

const api = vi.hoisted(() => ({
  hentIdeer: vi.fn(async () => [] as Ide[]),
  hentIdetraad: vi.fn(),
  hentSortering: vi.fn(async () => ({ forst: 'kategori', deretter: 'tid' })),
  lagreSortering: vi.fn(async () => {}),
  opprettIde: vi.fn(async () => 'ny'),
  endreIde: vi.fn(async () => {}),
  ryddIdearkiv: vi.fn(async () => {}),
  gjenopprettIde: vi.fn(async () => {}),
  flyttOppgaveTilbake: vi.fn(async () => {}),
  hentIdeerMedNytt: vi.fn(async () => 0),
  hentOppgaver: vi.fn(async () => []),
}))

vi.mock('../ideer/api', () => api)
vi.mock('../varsler/api', () => ({ oppfriskVarsler: () => {} }))
vi.mock('../auth/okt', () => ({ useProfil: () => tilstand.meg, useOkt: () => ({}) }))
vi.mock('../auth/avatarer', () => ({ useAvatarlenker: () => new Map() }))
vi.mock('../auth/api', () => ({ hentAlleProfiler: vi.fn(async () => [KARI]) }))

const { Ideknapp } = await import('../components/ideer/Ideknapp')
const { Redigerbar } = await import('../components/stoffside/Paneler')

beforeAll(() => {
  Element.prototype.scrollIntoView ??= function () {}
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  }
  document.elementFromPoint ??= () => null
  Range.prototype.getClientRects ??= () => ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] }) as unknown as DOMRectList
  Range.prototype.getBoundingClientRect ??= () => new DOMRect()
})

beforeEach(() => {
  tilstand.meg = KARI
  sessionStorage.clear()
  glemBildet()
  api.hentIdeer.mockResolvedValue(IDEER)
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.useRealTimers()
})

/** «Oppdater nå»: bildet legges i fanen, appen tas ned, og den nye versjonen starter. */
function lastInnPaNytt(): void {
  const lastInn = vi.fn()
  oppdaterOgTaVare(lastInn)
  expect(lastInn).toHaveBeenCalledOnce()
  cleanup()
  glemBildet()
}

/* --- Versjonen ------------------------------------------------------------ */

describe('versjonen som er lagt ut', () => {
  const svar = (data: unknown, ok = true) =>
    vi.fn(async (_url: URL | RequestInfo, _init?: RequestInit) => ({ ok, json: async () => data }) as Response)

  it('leses fra versjonsfila, alltid uten mellomlager', async () => {
    const hent = svar({ bygg: 'abc', versjon: '2.0.0' })
    expect(await hentUtlagtBygg(hent)).toEqual({ bygg: 'abc', versjon: '2.0.0' })
    const [url, valg] = hent.mock.calls[0]!
    expect(String(url)).toMatch(/\/versjon\.json$/)
    expect(valg).toEqual({ cache: 'no-store' })
  })

  it('er ukjent uten fila, med noe annet i den, eller uten nett', async () => {
    expect(await hentUtlagtBygg(svar({}, false))).toBeNull()
    expect(await hentUtlagtBygg(svar('<!doctype html>'))).toBeNull()
    expect(await hentUtlagtBygg(svar({ bygg: '', versjon: '1.0.0' }))).toBeNull()
    expect(await hentUtlagtBygg(vi.fn(async () => Promise.reject(new Error('uten nett'))))).toBeNull()
  })

  it('er ny bare når bygget er et annet enn det som kjører', () => {
    expect(nyVersjon({ bygg: BYGG, versjon: '1.0.0' })).toBeNull()
    expect(nyVersjon(null)).toBeNull()
    expect(nyVersjon({ bygg: `${BYGG}-annet`, versjon: '1.0.1' })).toEqual({ bygg: `${BYGG}-annet`, versjon: '1.0.1' })
  })
})

/* --- Meldingen ------------------------------------------------------------ */

describe('meldingen om en ny versjon', () => {
  it('står ikke så lenge bygget som kjører, er det som er lagt ut', async () => {
    const hent = vi.fn(async () => ({ bygg: BYGG, versjon: '1.0.0' }))
    render(<Oppdateringsmelding aktiv hent={hent} />)
    await waitFor(() => expect(hent).toHaveBeenCalled())
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('sier fra om en ny versjon, kan ikke lukkes, og oppdaterer med «Oppdater nå»', async () => {
    const oppdater = vi.fn()
    render(<Oppdateringsmelding aktiv hent={async () => ({ bygg: 'nytt', versjon: '9.9.9' })} oppdater={oppdater} />)
    const melding = await screen.findByRole('alert')
    expect(melding.textContent).toContain('En ny versjon av OUSFAR er klar (9.9.9).')
    expect(melding.textContent).toContain('Det du holder på med, blir stående.')
    expect(within(melding).getAllByRole('button').map((b) => b.textContent)).toEqual(['Oppdater nå'])

    await userEvent.click(within(melding).getByRole('button', { name: 'Oppdater nå' }))
    expect(oppdater).toHaveBeenCalledOnce()
    expect(within(melding).getByRole('button', { name: 'Oppdaterer …' })).toHaveProperty('disabled', true)
  })

  it('spør igjen når fanen får fokus, og med én gang en del av appen ikke lar seg laste', async () => {
    const hent = vi.fn(async () => ({ bygg: BYGG, versjon: '1.0.0' }))
    render(<Oppdateringsmelding aktiv hent={hent} />)
    await waitFor(() => expect(hent).toHaveBeenCalledTimes(1))
    act(() => void window.dispatchEvent(new Event('focus')))
    act(() => void window.dispatchEvent(new Event('vite:preloadError')))
    expect(hent).toHaveBeenCalledTimes(3)
  })

  it('legger seg i det øverste modale laget, så den kan trykkes på også da', async () => {
    const lag = document.createElement('dialog')
    lag.setAttribute('open', '')
    document.body.append(lag)
    render(<Oppdateringsmelding aktiv hent={async () => ({ bygg: 'nytt', versjon: '9.9.9' })} />)
    expect(lag.contains(await screen.findByRole('alert'))).toBe(true)

    // Lukkes laget, flytter den ut igjen.
    act(() => lag.removeAttribute('open'))
    await waitFor(() => expect(lag.contains(screen.getByRole('alert'))).toBe(false))
    lag.remove()
  })

  it('spør ikke i utviklingsserveren', async () => {
    const hent = vi.fn(async () => ({ bygg: 'nytt', versjon: '9.9.9' }))
    render(<Oppdateringsmelding aktiv={false} hent={hent} />)
    act(() => void window.dispatchEvent(new Event('focus')))
    expect(hent).not.toHaveBeenCalled()
  })
})

/* --- Det som tas vare på --------------------------------------------------- */

function Teller({ navn = 'teller', start = 0 }: { navn?: string; start?: number }) {
  const [verdi, setVerdi, gjenopprettet] = useBevart(navn, start)
  return (
    <button type="button" data-gjenopprettet={gjenopprettet || undefined} onClick={() => setVerdi((v) => v + 1)}>
      {verdi}
    </button>
  )
}

describe('det som tas vare på gjennom en oppdatering', () => {
  it('kommer tilbake én gang, i den nye versjonen, med områdene rundt i navnet', async () => {
    render(
      <Bevaringsomrade navn="side">
        <Teller />
      </Bevaringsomrade>,
    )
    await userEvent.click(screen.getByRole('button'))
    await userEvent.click(screen.getByRole('button'))
    expect(taBilde().verdier).toEqual({ 'side/teller': 2 })

    lastInnPaNytt()
    expect(sessionStorage.getItem(LAGRINGSNOKKEL)).not.toBeNull()
    const { unmount } = render(
      <Bevaringsomrade navn="side">
        <Teller />
      </Bevaringsomrade>,
    )
    expect(screen.getByRole('button').textContent).toBe('2')
    expect(screen.getByRole('button').dataset.gjenopprettet).toBe('true')
    // Bildet er lest og slettet fra fanen.
    expect(sessionStorage.getItem(LAGRINGSNOKKEL)).toBeNull()

    // Den samme komponenten senere begynner på nytt.
    unmount()
    render(
      <Bevaringsomrade navn="side">
        <Teller />
      </Bevaringsomrade>,
    )
    expect(screen.getByRole('button').textContent).toBe('0')
  })

  it('henter en verdi under et navn som først kommer til senere, som når et element får ID-en sin', async () => {
    render(<Teller navn="rediger:e1" />)
    await userEvent.click(screen.getByRole('button'))
    lastInnPaNytt()

    const { rerender } = render(<Teller navn="rediger:ny" />)
    expect(screen.getByRole('button').textContent).toBe('0')
    rerender(<Teller navn="rediger:e1" />)
    await waitFor(() => expect(screen.getByRole('button').textContent).toBe('1'))
  })

  it('slipper ikke inn en verdi av et annet slag enn utgangspunktet', () => {
    sessionStorage.setItem(LAGRINGSNOKKEL, JSON.stringify({ tatt: Date.now(), verdier: { teller: 'to' }, rulling: [] }))
    render(<Teller />)
    expect(screen.getByRole('button').textContent).toBe('0')
  })

  it('bruker ikke et bilde som er for gammelt til å være fra en oppdatering', () => {
    sessionStorage.setItem(LAGRINGSNOKKEL, JSON.stringify({ tatt: Date.now() - 10 * 60_000, verdier: { teller: 5 }, rulling: [] }))
    render(<Teller />)
    expect(screen.getByRole('button').textContent).toBe('0')
  })

  it('gir ikke tilbake noe lenge etter at den nye versjonen startet', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    sessionStorage.setItem(LAGRINGSNOKKEL, JSON.stringify({ tatt: Date.now(), verdier: { teller: 5 }, rulling: [] }))
    // Bildet leses første gang noe spør etter det, når appen starter; komponenten
    // som hadde verdien, kommer til først mye senere.
    render(<Teller navn="annet" />)
    vi.setSystemTime(Date.now() + GYLDIG_I + 1)
    render(<Teller />)
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['0', '0'])
  })

  it('tar ikke vare på det som ikke tåler JSON, men gjør det med en egen form', async () => {
    const KART: Bevaringsform<Map<string, number>> = {
      lagre: (kart) => [...kart],
      les: (lagret) => (Array.isArray(lagret) ? new Map(lagret as [string, number][]) : undefined),
    }
    function Kart({ form }: { form?: Bevaringsform<Map<string, number>> }) {
      const [kart, setKart] = useBevart(form ? 'med-form' : 'uten-form', () => new Map<string, number>(), form)
      return (
        <button type="button" onClick={() => setKart(new Map([['a', 1]]))}>
          {[...kart].join(';') || 'tomt'}
        </button>
      )
    }
    render(
      <>
        <Kart />
        <Kart form={KART} />
      </>,
    )
    for (const knapp of screen.getAllByRole('button')) await userEvent.click(knapp)
    expect(Object.keys(taBilde().verdier)).toEqual(['med-form'])

    lastInnPaNytt()
    render(
      <>
        <Kart />
        <Kart form={KART} />
      </>,
    )
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['tomt', 'a,1'])
  })
})

/* --- Fortolkningen -------------------------------------------------------- */

describe('fortolkningen gjennom en oppdatering', () => {
  const analytt = FORTOLKNINGSOPPFORINGER[0]!
  const form = fortolkningsform(FORTOLKNINGSOPPFORINGER)

  it('tas vare på med analyttens kode, og leses tilbake som analytten i den nye versjonen', () => {
    const state: State = { ...initialState, query: analytt.kode.toLowerCase(), analyte: analytt, bandKey: 'over', metodefilter: 'SPFA' }
    const lagret = JSON.parse(JSON.stringify(form.lagre(state))) as Record<string, unknown>
    expect(lagret.analyte).toBe(analytt.kode)
    const lest = form.les(lagret)
    expect(lest).toEqual(state)
    expect(lest?.analyte).toBe(analytt)
  })

  it('begynner på nytt, med filteret i behold, når analytten ikke finnes lenger', () => {
    const lest = form.les({ ...(form.lagre({ ...initialState, analyte: analytt, metodefilter: 'SPFA' }) as object), analyte: 'FINNESIKKE' })
    expect(lest).toEqual({ ...initialState, metodefilter: 'SPFA' })
  })

  it('godtar ikke noe som ikke ser ut som en fortolkning', () => {
    expect(form.les('fortolkning')).toBeUndefined()
    expect(form.les(null)).toBeUndefined()
    expect(form.les({ ...initialState, kontroll: 'ukjent', etgValg: 'ukjent' })).toEqual(initialState)
  })
})

/* --- Et vindu og et skjema ------------------------------------------------- */

describe('et vindu med et skjema som er halvveis skrevet', () => {
  it('står åpent med det som er skrevet etter oppdateringen, og regnes fortsatt som ulagret', async () => {
    const bruker = userEvent.setup()
    render(<Ideknapp />)
    await bruker.click(screen.getByRole('button', { name: 'Idéer og planlagte oppgaver' }))
    await bruker.click(screen.getByRole('button', { name: 'Idéer' }))
    await bruker.click(await screen.findByRole('button', { name: 'Ny idé' }))
    await bruker.type(screen.getByLabelText('Overskrift'), 'Varsel om ny versjon')

    lastInnPaNytt()
    render(<Ideknapp />)
    const vindu = await screen.findByRole('dialog', { name: 'Idéer' })
    expect(within(vindu).getByRole('form', { name: 'Ny idé' })).toBeTruthy()
    expect(within(vindu).getByLabelText('Overskrift')).toHaveProperty('value', 'Varsel om ny versjon')

    // Utkastet er ikke lagret: å lukke vinduet spør først.
    await bruker.click(within(vindu).getByRole('button', { name: 'Lukk idéer' }))
    expect(within(vindu).getByText('Du har endringer som ikke er lagret.')).toBeTruthy()
    expect(api.opprettIde).not.toHaveBeenCalled()
  })

  it('åpner vinduet på lista som før, neste gang det åpnes', async () => {
    const bruker = userEvent.setup()
    render(<Ideknapp />)
    await bruker.click(screen.getByRole('button', { name: 'Idéer og planlagte oppgaver' }))
    await bruker.click(screen.getByRole('button', { name: 'Idéer' }))
    await bruker.click(await screen.findByRole('button', { name: 'Ny idé' }))

    lastInnPaNytt()
    render(<Ideknapp />)
    const vindu = await screen.findByRole('dialog', { name: 'Idéer' })
    await bruker.click(within(vindu).getByRole('button', { name: 'Lukk idéer' }))
    await bruker.click(screen.getByRole('button', { name: 'Idéer og planlagte oppgaver' }))
    await bruker.click(screen.getByRole('button', { name: 'Idéer' }))
    expect(await screen.findByText('Flere TDM-kilder')).toBeTruthy()
    expect(screen.queryByRole('form', { name: 'Ny idé' })).toBeNull()
  })
})

describe('et redigeringsvindu på en stoffside', () => {
  const element = (revisjon: number) =>
    ({ id: 'e1', panel: 'p', posisjon: 0, elementtype: 'riktekst', data: {}, referanser: [], utgave: { revisjon } }) as never

  function Element({ revisjon }: { revisjon: number }) {
    return (
      <Bevaringsomrade navn="stoff:litium">
        <Redigerbar
          navn="Indikasjoner"
          element={element(revisjon)}
          redigerer
          visning={null}
          skjema={() => <p>Redigeringsvinduet</p>}
        />
      </Bevaringsomrade>
    )
  }

  it('står åpent etter oppdateringen når ingen har lagret elementet i mellomtiden', async () => {
    render(<Element revisjon={3} />)
    await userEvent.click(screen.getByRole('button', { name: 'Rediger: Indikasjoner' }))
    lastInnPaNytt()
    render(<Element revisjon={3} />)
    expect(screen.getByText('Redigeringsvinduet')).toBeTruthy()
  })

  it('åpner ikke et utkast mot en revisjon som ikke lenger er den nyeste', async () => {
    render(<Element revisjon={3} />)
    await userEvent.click(screen.getByRole('button', { name: 'Rediger: Indikasjoner' }))
    lastInnPaNytt()
    render(<Element revisjon={4} />)
    expect(screen.queryByText('Redigeringsvinduet')).toBeNull()
  })
})
