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
import { HENTER_MER, visTreff } from '../components/sok/treffvisning'
import { TipsLag } from '../components/Tips'
import { lagSokeindeks, sok, sokeord, sokGlobalt, type Sokedokument, type Sokested } from '../faginnhold/sok'
import { erBekreftelse, fokusIFagsok, lagLiggerOver, useKeyboard, VIST_FORTOLKNING } from '../hooks/useKeyboard'
import { useSokeindeks, type Lestsokeindeks, type Sokeindekstilstand } from '../hooks/useSokeindeks'
import { erSidesokSnarvei } from '../components/stoffside/Sidesok'
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

// Hvert sted er på en stoffside, etter stoffets nøkkel. Koden er bare en vei inn.
const SERTRALIN = { stoff: 'sertralin', navn: 'Sertralin' }
const KVETIAPIN = { stoff: 'kvetiapin', navn: 'Kvetiapin' }

const i = (side: Sokested['side'], rest: Omit<Sokested, 'side'> = {}): Sokested => ({ side, ...rest })
const FARMAKOKINETIKK = { nokkel: 'farmakokinetikk', tittel: 'Farmakokinetikk' }
const PREPARATER = { nokkel: 'preparater', tittel: 'Preparater' }
const INDIKASJON = { nokkel: 'indikasjon', tittel: 'Indikasjon' }

const DOKUMENTER: Sokedokument[] = [
  { sted: i(SERTRALIN), felt: 'navn', tekst: 'Sertralin' },
  { sted: i(SERTRALIN), felt: 'kode', tekst: 'SERT' },
  { sted: i(SERTRALIN), felt: 'komponent', tekst: 'Desmetylsertralin' },
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

/** Linja under et stoff, som `stoffbeskrivelse` gir den: kategorien og analyttene. */
const BESKRIVELSE = 'Antidepressiver › SSRI · analytt SERT'
const beskrivSide = (stoff: string) => (stoff === 'sertralin' ? BESKRIVELSE : undefined)

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
    // Stoffet først, med kategorien og analytten under navnet.
    expect(alle[0]!.textContent).toContain('Sertralin')
    expect(alle[0]!.textContent).toContain(BESKRIVELSE)
    expect(alle[0]!.getAttribute('href')).toBe('#/stoff/sertralin')
    expect(alle[0]!.getAttribute('aria-selected')).toBe('true')
    expect(felt.getAttribute('aria-activedescendant')).toBe(alle[0]!.id)
    expect(alle[0]!.querySelector('mark')?.textContent).toBe('Sertralin')

    await user.keyboard('{ArrowDown}')
    const andre = rader()[1]!
    expect(andre.getAttribute('aria-selected')).toBe('true')
    expect(andre.getAttribute('href')).toBe('#/stoff/sertralin/preparater/preparat-t')
    await user.keyboard('{Enter}')
    expect(onGaaTil).toHaveBeenCalledWith('#/stoff/sertralin/preparater/preparat-t')
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
    expect(onGaaTil).toHaveBeenCalledWith('#/stoff/kvetiapin/indikasjon')
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
    render(
      <main data-fortolkning={VIST_FORTOLKNING}>
        <Fortolkningstaster tast={tast} />
      </main>,
    )

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
    expect(within(stoff).getByRole('link').getAttribute('href')).toBe('#/stoff/sertralin')
    const tekst = screen.getByRole('region', { name: /^I teksten/ })
    const lenker = within(tekst).getAllByRole('link').map((a) => a.getAttribute('href'))
    expect(lenker).toContain('#/stoff/sertralin/farmakokinetikk/k1')
    expect(lenker).toContain('#/stoff/kvetiapin/indikasjon')
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
    expect(within(referanser).getByRole('link').getAttribute('href')).toBe('#/stoff/sertralin')
  })

  it('viser de første treffene i en stor gruppe, og resten på forespørsel', async () => {
    const user = userEvent.setup()
    const mange: Sokedokument[] = Array.from({ length: GRUPPEGRENSE + 5 }, (_, n) => ({
      sted: i({ stoff: `stoff-${n}`, navn: `Stoff ${n}` }, { panel: INDIKASJON, element: { id: `e${n}` } }),
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
  /** Som `vis`, men for treffet i feltet selv om et bedre treff står på samme sted. */
  const visFelt = (sporring: string, felt: Sokedokument['felt']) => {
    const treff = sok(DOKUMENTER, sporring, Infinity).find((t) => t.dokument.felt === felt)!
    return visTreff(treff, sokeord(sporring), beskrivSide)
  }

  it('viser stoffet med navnet som tittel, og et annet navn i utdraget', () => {
    const alias = vis('zoloft', 'alias')
    expect(alias.tittel.tekst).toBe('Sertralin')
    expect(alias.utdrag?.tekst).toBe('Zoloft-stoffet')
    expect(alias.sti).toEqual([BESKRIVELSE])
    expect(alias.gruppe).toBe('stoff')
    expect(alias.adresse).toBe('#/stoff/sertralin')
    // Uten noe å si om stoffet står det at det er en stoffside — aldri koden.
    expect(visFelt('kve', 'kode').sti).toEqual(['Fagside'])
    expect(visFelt('kve', 'kode').tittel.tekst).toBe('Kvetiapin')
  })

  it('viser en analytts komponent under stoffets navn, og peker på stoffsiden', () => {
    const komponent = vis('desmetylsertralin', 'komponent')
    expect(komponent.tittel.tekst).toBe('Sertralin')
    expect(komponent.utdrag?.tekst).toBe('Desmetylsertralin')
    expect(komponent.sti).toEqual([BESKRIVELSE])
    expect(komponent.adresse).toBe('#/stoff/sertralin')
    expect(komponent.nokkel).toBe(vis('sertralin', 'navn').nokkel)
    // Koden er stoffets egen vei inn, og gjentas ikke under navnet.
    expect(visFelt('sert', 'kode').tittel.tekst).toBe('Sertralin')
    expect(visFelt('sert', 'kode').utdrag).toBeUndefined()
    expect(visFelt('sert', 'kode').adresse).toBe('#/stoff/sertralin')
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
    expect(tekst.adresse).toBe('#/stoff/sertralin/farmakokinetikk/k1')
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

describe('søket mens fagstoffet hentes', () => {
  const underveis: Sokeindekstilstand = { ...KLAR, henterMer: true }

  it('viser treffene i det som er hentet, og at mer er på vei', async () => {
    const user = userEvent.setup()
    const { felt } = visFagsok(underveis)
    await user.click(felt)
    await user.keyboard('sertralin')
    expect(rader()[0]!.textContent).toContain('Sertralin')
    expect(screen.getByText(HENTER_MER)).toBeTruthy()

    // Uten treff ennå står det ikke at det ikke finnes noen.
    await user.clear(felt)
    await user.keyboard('finnesikke')
    expect(screen.queryByText('Ingen treff i fagstoffet.')).toBeNull()
    expect(screen.getByText(HENTER_MER)).toBeTruthy()
  })

  it('sier det ikke når alt er hentet', async () => {
    const user = userEvent.setup()
    const { felt } = visFagsok()
    await user.click(felt)
    await user.keyboard('sertralin')
    expect(screen.queryByText(HENTER_MER)).toBeNull()
  })

  it('sier på søkesiden at flere treff kan komme', () => {
    visSokeside('sertralin', underveis)
    expect(screen.getByText(new RegExp(HENTER_MER))).toBeTruthy()
    expect(screen.getByRole('region', { name: /^Stoff/ })).toBeTruthy()
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

  it('kan søkes i mens den hentes, med det som alt er lest', async () => {
    const delvise = lagSokeindeks(DOKUMENTER.slice(0, 1))
    let svar: (verdi: Lestsokeindeks) => void = () => {}
    const hent = vi.fn((delvis: (indeks: Lestsokeindeks) => void) => {
      delvis(delvise)
      return new Promise<Lestsokeindeks>((r) => (svar = r))
    })
    const { result } = renderHook(() => useSokeindeks(hent))
    act(() => result.current.krev())
    expect(result.current.tilstand).toEqual({ status: 'klar', indeks: delvise, henterMer: true })
    // Den hentes ikke én gang til mens resten er på vei.
    act(() => result.current.krev())
    expect(hent).toHaveBeenCalledTimes(1)
    await act(async () => svar(indeks))
    expect(result.current.tilstand).toEqual({ status: 'klar', indeks })
  })

  it('beholder en hel indeks framfor en delvis når den hentes på nytt', async () => {
    const delvise = lagSokeindeks(DOKUMENTER.slice(0, 1))
    let svar: (verdi: Lestsokeindeks) => void = () => {}
    const hent = vi
      .fn()
      .mockResolvedValueOnce(indeks)
      .mockImplementationOnce((delvis: (indeks: Lestsokeindeks) => void) => {
        delvis(delvise)
        return new Promise<Lestsokeindeks>((r) => (svar = r))
      })
    const { result } = renderHook(() => useSokeindeks(hent))
    act(() => result.current.krev())
    await waitFor(() => expect(result.current.tilstand.status).toBe('klar'))

    act(() => result.current.foreld(true))
    expect(result.current.tilstand).toEqual({ status: 'klar', indeks })
    const ny = lagSokeindeks(DOKUMENTER.slice(0, 2))
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
