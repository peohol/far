// @vitest-environment jsdom
/**
 * Det globale fagsøket (`docs/ux-reimagination.md`, del 6.1): rullegardinen
 * i toppmenyen, søkesiden, visningen av treffene og at det som skrives i
 * fagsøket, aldri når tastene i fortolkningen bak.
 */
import { act, cleanup, render, renderHook, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { Fagsok, MAKS_I_RULLEGARDIN } from '../components/sok/Fagsok'
import { GRUPPEGRENSE, Sokeside } from '../components/sok/Sokeside'
import { visTreff } from '../components/sok/treffvisning'
import { TipsLag } from '../components/Tips'
import { lagSokeindeks, sokeord, sokGlobalt, type Sokedokument, type Sokested } from '../faginnhold/sok'
import { erBekreftelse, fokusIFagsok, lagLiggerOver, useKeyboard } from '../hooks/useKeyboard'
import { useSokeindeks, type Lestsokeindeks, type Sokeindekstilstand } from '../hooks/useSokeindeks'
import { erSidesokSnarvei } from '../components/analyttside/Sidesok'
import { erFagsokSnarvei } from '../components/toppmeny/Fagsokfelt'

beforeAll(() => {
  // jsdom ruller ikke.
  window.scrollTo = vi.fn()
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})

afterEach(() => {
  cleanup()
  window.location.hash = ''
})

/* --- Et lite, syntetisk fagstoff ---------------------------------------------- */

const SERTRALIN = { kode: 'SERT', navn: 'Sertralin' }
const KVETIAPIN = { kode: 'KVE', navn: 'Kvetiapin' }

const i = (side: Sokested['side'], rest: Omit<Sokested, 'side'> = {}): Sokested => ({ side, ...rest })
const FARMAKOKINETIKK = { nokkel: 'farmakokinetikk', tittel: 'Farmakokinetikk' }
const PREPARATER = { nokkel: 'preparater', tittel: 'Preparater' }
const INDIKASJON = { nokkel: 'indikasjon', tittel: 'Indikasjon' }

const DOKUMENTER: Sokedokument[] = [
  { sted: i(SERTRALIN), felt: 'navn', tekst: 'Sertralin' },
  { sted: i(SERTRALIN), felt: 'kode', tekst: 'SERT' },
  { sted: i(SERTRALIN), felt: 'alias', tekst: 'Zoloft-stoffet' },
  {
    sted: i(SERTRALIN, { panel: PREPARATER, element: { id: 'form-t', tittel: 'Tablett' }, detaljkort: 'preparat-t' }),
    felt: 'preparat',
    tekst: 'Sertralin Accord',
  },
  {
    sted: i(SERTRALIN, { panel: FARMAKOKINETIKK, element: { id: 'k1', tittel: 'Metabolisme' }, detaljkort: 'k1' }),
    felt: 'overskrift',
    tekst: 'Metabolisme',
  },
  {
    sted: i(SERTRALIN, { panel: FARMAKOKINETIKK, element: { id: 'k1', tittel: 'Metabolisme' }, detaljkort: 'k1' }),
    felt: 'fritekst',
    tekst: 'Sertralin omdannes i leveren, hovedsakelig via CYP2C19.',
  },
  { sted: i(SERTRALIN), felt: 'referanse', tekst: 'Felleskatalogen. Sertralin tabletter.' },
  { sted: i(KVETIAPIN), felt: 'navn', tekst: 'Kvetiapin' },
  { sted: i(KVETIAPIN), felt: 'kode', tekst: 'KVE' },
  {
    sted: i(KVETIAPIN, { panel: INDIKASJON, element: { id: 'e1' } }),
    felt: 'fritekst',
    tekst: 'Bipolar lidelse, også hos pasienter som tidligere har brukt sertralin.',
  },
]

const KLAR: Sokeindekstilstand = { status: 'klar', indeks: lagSokeindeks(DOKUMENTER) }

const beskrivSide = (kode: string) => (kode === 'SERT' ? 'SERT · SPFA › Antidepressiva' : undefined)

function visFagsok(indeks: Sokeindekstilstand = KLAR, sporring?: string) {
  const onKrev = vi.fn()
  const onGaaTil = vi.fn()
  const resultat = render(
    <TipsLag>
      <Fagsok indeks={indeks} onKrev={onKrev} sporring={sporring} beskrivSide={beskrivSide} onGaaTil={onGaaTil} />
    </TipsLag>,
  )
  const felt = screen.getByRole('combobox', { name: 'Søk i fagstoffet' }) as HTMLInputElement
  return { onKrev, onGaaTil, felt, ...resultat }
}

const rader = () => within(screen.getByRole('listbox', { name: 'Treff i fagstoff' })).queryAllByRole('option')

/* --- Rullegardinen ------------------------------------------------------------ */

describe('rullegardinen under fagsøket', () => {
  it('viser de beste treffene med sti, velges med piltastene og åpnes med Enter', async () => {
    const user = userEvent.setup()
    const { felt, onGaaTil, onKrev } = visFagsok()
    await user.click(felt)
    expect(onKrev).toHaveBeenCalled()
    await user.keyboard('sertralin')

    expect(felt.getAttribute('aria-expanded')).toBe('true')
    const alle = rader()
    expect(alle.length).toBe(Math.min(MAKS_I_RULLEGARDIN, sokGlobalt(KLAR.indeks, 'sertralin').length))
    // Stoffet først, med katalogens linje under navnet.
    expect(alle[0]!.textContent).toContain('Sertralin')
    expect(alle[0]!.textContent).toContain('SERT · SPFA › Antidepressiva')
    expect(alle[0]!.getAttribute('aria-selected')).toBe('true')
    expect(felt.getAttribute('aria-activedescendant')).toBe(alle[0]!.id)
    expect(alle[0]!.querySelector('mark')?.textContent).toBe('Sertralin')

    await user.keyboard('{ArrowDown}')
    const andre = rader()[1]!
    expect(andre.getAttribute('aria-selected')).toBe('true')
    expect(andre.getAttribute('href')).toBe('#/analytt/SERT/preparater/preparat-t')
    await user.keyboard('{Enter}')
    expect(onGaaTil).toHaveBeenCalledWith('#/analytt/SERT/preparater/preparat-t')
    // Rullegardinen lukkes, og fokus går ut av feltet.
    expect(felt.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).not.toBe(felt)
  })

  it('går til søkesiden fra «Vis alle treff», og med Enter når ingen rad er valgt', async () => {
    const user = userEvent.setup()
    const { felt, onGaaTil } = visFagsok()
    await user.click(felt)
    await user.keyboard('sertralin')
    const antall = sokGlobalt(KLAR.indeks, 'sertralin', Infinity).length
    await user.click(screen.getByRole('button', { name: `Vis alle treff (${antall})` }))
    expect(onGaaTil).toHaveBeenLastCalledWith('#/sok?q=sertralin')

    await user.click(felt)
    await user.keyboard('{ArrowUp}{Enter}')
    expect(onGaaTil).toHaveBeenLastCalledWith('#/sok?q=sertralin')
  })

  it('lukkes med Escape, som deretter tømmer feltet', async () => {
    const user = userEvent.setup()
    const { felt } = visFagsok()
    await user.click(felt)
    await user.keyboard('kvetiapin')
    expect(felt.getAttribute('aria-expanded')).toBe('true')
    await user.keyboard('{Escape}')
    expect(felt.getAttribute('aria-expanded')).toBe('false')
    expect(felt.value).toBe('kvetiapin')
    await user.keyboard('{Escape}')
    expect(felt.value).toBe('')
  })

  it('åpner et treff med et klikk', async () => {
    const user = userEvent.setup()
    const { felt, onGaaTil } = visFagsok()
    await user.click(felt)
    await user.keyboard('bipolar')
    await user.click(rader()[0]!)
    expect(onGaaTil).toHaveBeenCalledWith('#/analytt/KVE/indikasjon')
    expect(document.activeElement).not.toBe(felt)
  })

  it('sier fra mens fagstoffet hentes, når ingenting treffer og når hentingen feiler', async () => {
    const user = userEvent.setup()
    const { felt, rerender, onKrev } = visFagsok({ status: 'laster' })
    await user.click(felt)
    await user.keyboard('x')
    expect(screen.getByText('Henter fagstoffet …')).toBeTruthy()

    rerender(
      <TipsLag>
        <Fagsok indeks={KLAR} onKrev={onKrev} onGaaTil={vi.fn()} />
      </TipsLag>,
    )
    await user.keyboard('yz')
    expect(screen.getByText('Ingen treff i fagstoffet.')).toBeTruthy()

    rerender(
      <TipsLag>
        <Fagsok indeks={{ status: 'feil', melding: 'nede' }} onKrev={onKrev} onGaaTil={vi.fn()} />
      </TipsLag>,
    )
    onKrev.mockClear()
    await user.click(screen.getByRole('button', { name: 'Prøv igjen' }))
    expect(onKrev).toHaveBeenCalled()
  })

  it('viser søket fra søkesiden i feltet', () => {
    const { felt } = visFagsok(KLAR, 'metabolisme')
    expect(felt.value).toBe('metabolisme')
  })
})

/* --- Tastene i fortolkningen bak ------------------------------------------------ */

describe('fagsøket og tastene i appen', () => {
  function Fortolkningstaster({ tast }: { tast: (navn: string) => void }) {
    useKeyboard({
      '1': () => tast('1'),
      Enter: () => tast('Enter'),
      Escape: () => tast('Escape'),
    })
    return null
  }

  it('er et lag over appen mens det har fokus, så sifre, Enter og Escape ikke når fortolkningen', async () => {
    const user = userEvent.setup()
    const tast = vi.fn()
    const { felt } = visFagsok()
    render(<Fortolkningstaster tast={tast} />)

    await user.click(felt)
    expect(fokusIFagsok()).toBe(true)
    expect(lagLiggerOver()).toBe(true)
    await user.keyboard('sertralin 1{Enter}')
    await user.click(felt)
    await user.keyboard('{Escape}{Escape}')
    expect(tast).not.toHaveBeenCalled()

    // En bekreftelse i fortolkningen (kopiering) er heller ikke mulig derfra.
    expect(erBekreftelse(new KeyboardEvent('keydown', { key: 'Enter' }))).toBe(false)

    // Ut av feltet virker tastene som før.
    act(() => felt.blur())
    expect(lagLiggerOver()).toBe(false)
    await user.keyboard('1')
    expect(tast).toHaveBeenCalledWith('1')
  })

  it('slipper Ctrl/Cmd K og Ctrl/Cmd B gjennom fra fagsøket, så man kan gå mellom de to søkene', async () => {
    const user = userEvent.setup()
    const { felt } = visFagsok()
    await user.click(felt)
    const k = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true })
    const b = new KeyboardEvent('keydown', { key: 'b', metaKey: true })
    expect(erFagsokSnarvei(k)).toBe(true)
    expect(erSidesokSnarvei(b)).toBe(true)

    // Et annet lag over appen går foran.
    act(() => felt.blur())
    const lag = document.createElement('div')
    lag.setAttribute('data-lag', 'test')
    document.body.append(lag)
    expect(erSidesokSnarvei(b)).toBe(false)
    lag.remove()
    expect(erSidesokSnarvei(new KeyboardEvent('keydown', { key: 'b', ctrlKey: true, shiftKey: true }))).toBe(false)
  })
})

/* --- Søkesiden ----------------------------------------------------------------- */

function visSokeside(q: string, indeks: Sokeindekstilstand = KLAR) {
  const onKrev = vi.fn()
  const onLukk = vi.fn()
  render(
    <TipsLag>
      <Sokeside q={q} indeks={indeks} onKrev={onKrev} beskrivSide={beskrivSide} onLukk={onLukk} />
    </TipsLag>,
  )
  return { onKrev, onLukk }
}

describe('søkesiden', () => {
  it('viser søket, antallet og treffene i grupper i rangeringens rekkefølge, med dyplenker', () => {
    const { onKrev } = visSokeside('sertralin')
    expect(onKrev).toHaveBeenCalled()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('«sertralin»')
    const antall = sokGlobalt(KLAR.indeks, 'sertralin', Infinity).length
    expect(screen.getByText(`${antall} treff i 2 monografer`)).toBeTruthy()
    expect(document.title).toBe('«sertralin» – Søk i fagstoff – OUSFAR')

    // Referansen står på siden selv, og siden er alt med som stoffet.
    const grupper = screen.getAllByRole('heading', { level: 2 }).map((h) => h.firstChild?.textContent)
    expect(grupper).toEqual(['Stoff', 'Preparater', 'I teksten'])

    const stoff = screen.getByRole('region', { name: /^Stoff/ })
    expect(within(stoff).getByRole('link').getAttribute('href')).toBe('#/analytt/SERT')
    const tekst = screen.getByRole('region', { name: /^I teksten/ })
    const lenker = within(tekst).getAllByRole('link').map((a) => a.getAttribute('href'))
    expect(lenker).toContain('#/analytt/SERT/farmakokinetikk/k1')
    expect(lenker).toContain('#/analytt/KVE/indikasjon')
  })

  it('filtrerer på gruppe med knappene øverst', async () => {
    const user = userEvent.setup()
    visSokeside('sertralin')
    await user.click(screen.getByRole('button', { name: /^Preparater/ }))
    expect(screen.getByRole('button', { name: /^Preparater/ }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.firstChild?.textContent)).toEqual(['Preparater'])
    await user.click(screen.getByRole('button', { name: /^Alle/ }))
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(3)
    // En gruppe uten treff kan ikke velges.
    expect((screen.getByRole('button', { name: /^Referanser/ }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('viser referansene i en egen gruppe når det bare er de som treffer', () => {
    visSokeside('felleskatalogen')
    const referanser = screen.getByRole('region', { name: /^Referanser/ })
    expect(within(referanser).getByRole('link').getAttribute('href')).toBe('#/analytt/SERT')
  })

  it('viser de første treffene i en stor gruppe, og resten på forespørsel', async () => {
    const user = userEvent.setup()
    const mange: Sokedokument[] = Array.from({ length: GRUPPEGRENSE + 5 }, (_, n) => ({
      sted: i({ kode: `K${n}`, navn: `Stoff ${n}` }, { panel: INDIKASJON, element: { id: `e${n}` } }),
      felt: 'fritekst',
      tekst: `Tekst om depresjon nummer ${n}`,
    }))
    visSokeside('depresjon', { status: 'klar', indeks: lagSokeindeks(mange) })
    const gruppe = screen.getByRole('region', { name: /^I teksten/ })
    expect(within(gruppe).getAllByRole('link')).toHaveLength(GRUPPEGRENSE)
    await user.click(within(gruppe).getByRole('button', { name: `Vis alle ${GRUPPEGRENSE + 5}` }))
    expect(within(gruppe).getAllByRole('link')).toHaveLength(GRUPPEGRENSE + 5)
  })

  it('lukkes med Escape og Lukk-knappen', async () => {
    const user = userEvent.setup()
    const { onLukk } = visSokeside('sertralin')
    await user.keyboard('{Escape}')
    expect(onLukk).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: 'Lukk' }))
    expect(onLukk).toHaveBeenCalledTimes(2)
  })

  it('ber om et søk, sier fra om ingen treff og om feil', async () => {
    const user = userEvent.setup()
    visSokeside('')
    expect(screen.getByText('Skriv det du leter etter i søkefeltet øverst.')).toBeTruthy()
    cleanup()
    visSokeside('finnesikke')
    expect(screen.getByText('Ingen treff')).toBeTruthy()
    cleanup()
    const { onKrev } = visSokeside('sertralin', { status: 'feil', melding: 'nede' })
    onKrev.mockClear()
    await user.click(screen.getByRole('button', { name: 'Prøv igjen' }))
    expect(onKrev).toHaveBeenCalled()
  })

  it('sier fra når legemiddeldataene ikke kom med i indeksen', () => {
    visSokeside('sertralin', { status: 'klar', indeks: { ...KLAR.indeks, festfeil: 'nede' } })
    expect(screen.getByRole('note').textContent).toContain('FEST')
  })
})

/* --- Visningen av et treff ----------------------------------------------------- */

describe('visningen av et treff', () => {
  const vis = (sporring: string, felt: Sokedokument['felt']) => {
    const treff = sokGlobalt(KLAR.indeks, sporring, Infinity).find((t) => t.dokument.felt === felt)!
    return visTreff(treff, sokeord(sporring), beskrivSide)
  }

  it('viser stoffet med navnet som tittel, og et annet navn i utdraget', () => {
    const alias = vis('zoloft', 'alias')
    expect(alias.tittel.tekst).toBe('Sertralin')
    expect(alias.utdrag?.tekst).toBe('Zoloft-stoffet')
    expect(alias.sti).toEqual(['SERT · SPFA › Antidepressiva'])
    expect(alias.gruppe).toBe('stoff')
    // Uten linje fra katalogen står koden.
    expect(vis('kve', 'navn').sti).toEqual(['KVE'])
  })

  it('viser preparatnavnet som tittel og formen i stien', () => {
    const preparat = vis('accord', 'preparat')
    expect(preparat.tittel.tekst).toBe('Sertralin Accord')
    expect(preparat.sti).toEqual(['Sertralin', 'Preparater', 'Tablett'])
    expect(preparat.type).toBe('Preparat')
    expect(preparat.ikon).toBe('prep')
  })

  it('viser kortet som tittel og treffet i utdraget for løpende tekst', () => {
    const tekst = vis('cyp2c19', 'fritekst')
    expect(tekst.tittel.tekst).toBe('Metabolisme')
    expect(tekst.sti).toEqual(['Sertralin', 'Farmakokinetikk'])
    expect(tekst.utdrag?.tekst).toContain('CYP2C19')
    expect(tekst.adresse).toBe('#/analytt/SERT/farmakokinetikk/k1')
    // Uten kort er det seksjonen som er tittelen.
    expect(vis('bipolar', 'fritekst').tittel.tekst).toBe('Indikasjon')
  })

  it('viser referansen som tittel, under sidens referanser', () => {
    const referanse = vis('felleskatalogen', 'referanse')
    expect(referanse.tittel.tekst).toBe('Felleskatalogen. Sertralin tabletter.')
    expect(referanse.sti).toEqual(['Sertralin', 'Referanser'])
    expect(referanse.gruppe).toBe('referanse')
  })
})

/* --- Indeksen ------------------------------------------------------------------- */

describe('indeksen fagsøket bruker', () => {
  const indeks: Lestsokeindeks = KLAR.indeks

  it('hentes først når den trengs, én gang, og på nytt etter en feil', async () => {
    const hent = vi.fn().mockRejectedValueOnce(new Error('nede')).mockResolvedValue(indeks)
    const { result } = renderHook(() => useSokeindeks(hent))
    expect(result.current.tilstand.status).toBe('uhentet')
    expect(hent).not.toHaveBeenCalled()

    act(() => result.current.krev())
    await waitFor(() => expect(result.current.tilstand).toEqual({ status: 'feil', melding: 'nede' }))
    act(() => result.current.krev())
    await waitFor(() => expect(result.current.tilstand.status).toBe('klar'))
    act(() => result.current.krev())
    expect(hent).toHaveBeenCalledTimes(2)
  })

  it('hentes på nytt når den er utdatert, og beholder den gamle til den nye er der', async () => {
    let svar: (verdi: Lestsokeindeks) => void = () => {}
    const hent = vi
      .fn()
      .mockResolvedValueOnce(indeks)
      .mockReturnValueOnce(new Promise<Lestsokeindeks>((r) => (svar = r)))
    const { result } = renderHook(() => useSokeindeks(hent))
    act(() => result.current.krev())
    await waitFor(() => expect(result.current.tilstand.status).toBe('klar'))

    act(() => {
      result.current.foreld()
      result.current.krev()
    })
    expect(hent).toHaveBeenCalledTimes(2)
    expect(result.current.tilstand.status).toBe('klar')
    const ny = lagSokeindeks(DOKUMENTER.slice(0, 1))
    await act(async () => svar(ny))
    expect(result.current.tilstand).toEqual({ status: 'klar', indeks: ny })
  })

  it('hentes med én gang når den er utdatert og noe alt viser den', async () => {
    const ny = lagSokeindeks(DOKUMENTER.slice(0, 1))
    const hent = vi.fn().mockResolvedValueOnce(indeks).mockResolvedValueOnce(ny)
    const { result } = renderHook(() => useSokeindeks(hent))
    act(() => result.current.krev())
    await waitFor(() => expect(result.current.tilstand.status).toBe('klar'))

    act(() => result.current.foreld())
    expect(hent).toHaveBeenCalledTimes(1)
    act(() => result.current.foreld(true))
    expect(hent).toHaveBeenCalledTimes(2)
    await waitFor(() => expect(result.current.tilstand).toEqual({ status: 'klar', indeks: ny }))
  })
})
