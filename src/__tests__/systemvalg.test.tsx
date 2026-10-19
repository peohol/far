// @vitest-environment jsdom
/**
 * Valgene som kan stå fast eller følge systemet: temaet og «Reduser
 * bevegelse». Skriptet i `<head>` og hookene skal gi samme verdi, valget skal
 * følge systemet når det endres, og kontoen skal huske det.
 *
 * Databasen bak brukerinnstillingene er erstattet; det er samspillet med
 * valget som prøves.
 */
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const innstillinger = vi.hoisted(() => ({
  hentInnstilling: vi.fn<(nokkel: string) => Promise<unknown>>(),
  lagreInnstilling: vi.fn(async (_nokkel: string, _verdi: unknown) => {}),
}))
// Kontoen bak `auth/innstillinger.ts`, som selv er ekte, så køen i
// `lagreSisteValg` prøves med.
vi.mock('../auth/klient', () => ({
  klient: () => ({
    from: () => ({
      select: () => ({
        eq: (_: string, nokkel: string) => ({
          maybeSingle: () =>
            innstillinger.hentInnstilling(nokkel).then(
              (verdi) => ({ data: verdi === null ? null : { verdi }, error: null }),
              (error: unknown) => ({ data: null, error }),
            ),
        }),
      }),
      upsert: ({ nokkel, verdi }: { nokkel: string; verdi: unknown }) =>
        innstillinger.lagreInnstilling(nokkel, verdi).then(
          () => ({ error: null }),
          (error: unknown) => ({ error }),
        ),
    }),
  }),
}))

import {
  BEVEGELSE,
  lesValg,
  settSystemvalg,
  SYSTEMVALG,
  systemvalgskript,
  TEMA,
  virkeligVerdi,
  type Systemvalg,
} from '../domain/systemvalg'
import { useKontovalg } from '../hooks/useKontovalg'
import { useSystemvalg } from '../hooks/useSystemvalg'

function utsatt<T>() {
  let loes!: (verdi: T) => void
  const lovnad = new Promise<T>((r) => (loes = r))
  return { lovnad, loes }
}

/** Systemet i testen: hvilke mediespørringer som slår til, og hvem som lytter. */
const systemet = {
  treff: new Set<string>(),
  lyttere: new Map<string, Set<() => void>>(),
  sett(sporring: string, treff: boolean) {
    if (treff) this.treff.add(sporring)
    else this.treff.delete(sporring)
    this.lyttere.get(sporring)?.forEach((lytter) => lytter())
  },
}

beforeEach(() => {
  systemet.treff.clear()
  systemet.lyttere.clear()
  vi.stubGlobal('matchMedia', (sporring: string) => ({
    get matches() {
      return systemet.treff.has(sporring)
    },
    addEventListener: (_: string, lytter: () => void) => {
      const lyttere = systemet.lyttere.get(sporring) ?? new Set()
      lyttere.add(lytter)
      systemet.lyttere.set(sporring, lyttere)
    },
    removeEventListener: (_: string, lytter: () => void) => systemet.lyttere.get(sporring)?.delete(lytter),
  }))
  delete document.documentElement.dataset.tema
  delete document.documentElement.dataset.bevegelse
  localStorage.clear()
  innstillinger.hentInnstilling.mockReset()
  innstillinger.lagreInnstilling.mockReset()
  innstillinger.lagreInnstilling.mockImplementation(async () => {})
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('valgene', () => {
  it('godtar bare de faste verdiene og «system»', () => {
    expect(lesValg(TEMA, 'lyst')).toBe('lyst')
    expect(lesValg(TEMA, 'system')).toBe('system')
    expect(lesValg(TEMA, 'blaatt')).toBeNull()
    expect(lesValg(BEVEGELSE, 'redusert')).toBe('redusert')
    expect(lesValg(BEVEGELSE, 'moerkt')).toBeNull()
    expect(lesValg(BEVEGELSE, null)).toBeNull()
  })

  it('gir systemets svar når valget er å følge det, ellers det faste valget', () => {
    expect(virkeligVerdi(TEMA, 'system', true)).toBe('moerkt')
    expect(virkeligVerdi(TEMA, 'system', false)).toBe('lyst')
    expect(virkeligVerdi(TEMA, 'lyst', true)).toBe('lyst')
    expect(virkeligVerdi(BEVEGELSE, 'system', true)).toBe('redusert')
    expect(virkeligVerdi(BEVEGELSE, 'full', true)).toBe('full')
    expect(virkeligVerdi(BEVEGELSE, 'redusert', false)).toBe('redusert')
  })

  it('lar nye brukere følge systemet', () => {
    for (const def of SYSTEMVALG) expect(def.standard).toBe('system')
  })
})

describe('skriptet i <head>', () => {
  const lagret: (string | null)[] = [null, 'system', 'lyst', 'moerkt', 'redusert', 'full', 'tull']

  it('gir samme verdi som appen for hvert lagret valg, med og uten treff i systemet', () => {
    for (const def of SYSTEMVALG as readonly Systemvalg<string>[]) {
      for (const verdi of lagret) {
        for (const treff of [false, true]) {
          localStorage.clear()
          if (verdi !== null) localStorage.setItem(def.lagring, verdi)
          systemet.sett(def.sporring, treff)
          new Function(systemvalgskript())()
          const valg = lesValg(def, verdi) ?? def.standard
          expect(document.documentElement.dataset[def.attributt], `${def.attributt}=${verdi}, treff=${treff}`).toBe(
            virkeligVerdi(def, valg, treff),
          )
        }
      }
    }
  })

  it('klarer seg uten nettleserens minne og uten svar fra systemet', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('privat')
    })
    vi.stubGlobal('matchMedia', () => {
      throw new Error('finnes ikke')
    })
    settSystemvalg(SYSTEMVALG)
    expect(document.documentElement.dataset.tema).toBe('lyst')
    expect(document.documentElement.dataset.bevegelse).toBe('full')
    vi.restoreAllMocks()
  })
})

describe('useSystemvalg', () => {
  it('følger systemet når det endres, så lenge valget er å følge det', () => {
    const { result } = renderHook(() => useSystemvalg(TEMA))
    expect(result.current.valg).toBe('system')
    expect(document.documentElement.dataset.tema).toBe('lyst')

    act(() => systemet.sett(TEMA.sporring, true))
    expect(result.current.virkelig).toBe('moerkt')
    expect(document.documentElement.dataset.tema).toBe('moerkt')

    act(() => result.current.velg('lyst'))
    expect(document.documentElement.dataset.tema).toBe('lyst')
    expect(localStorage.getItem('far:tema')).toBe('lyst')
    // Et fast valg står, uansett hva systemet sier.
    act(() => systemet.sett(TEMA.sporring, false))
    act(() => systemet.sett(TEMA.sporring, true))
    expect(document.documentElement.dataset.tema).toBe('lyst')
  })

  it('setter «Reduser bevegelse» på <html> og husker valget', () => {
    systemet.sett(BEVEGELSE.sporring, true)
    const { result } = renderHook(() => useSystemvalg(BEVEGELSE))
    expect(document.documentElement.dataset.bevegelse).toBe('redusert')
    act(() => result.current.velg('full'))
    expect(document.documentElement.dataset.bevegelse).toBe('full')
    expect(localStorage.getItem('far:bevegelse')).toBe('full')
  })

  it('tar med seg det nettleseren husket fra før', () => {
    localStorage.setItem('far:tema', 'moerkt')
    const { result } = renderHook(() => useSystemvalg(TEMA))
    expect(result.current.valg).toBe('moerkt')
  })
})

describe.each([
  { def: TEMA as Systemvalg<string>, a: 'lyst', b: 'moerkt' },
  { def: BEVEGELSE as Systemvalg<string>, a: 'redusert', b: 'full' },
])('$def.konto på kontoen', ({ def, a, b }) => {
  it('legger kontoens valg over det nettleseren husket', async () => {
    innstillinger.hentInnstilling.mockResolvedValue(a)
    const { result } = renderHook(() => useKontovalg(def, 'ada'))

    await waitFor(() => expect(result.current.valg).toBe(a))
    expect(innstillinger.hentInnstilling).toHaveBeenCalledWith(def.konto)
    expect(document.documentElement.dataset[def.attributt]).toBe(a)
    expect(localStorage.getItem(def.lagring)).toBe(a)
    expect(innstillinger.lagreInnstilling).not.toHaveBeenCalled()
  })

  it('lagrer valget nettleseren står i når kontoen ikke har noe', async () => {
    localStorage.setItem(def.lagring, b)
    innstillinger.hentInnstilling.mockResolvedValue(null)
    renderHook(() => useKontovalg(def, 'ada'))

    await waitFor(() => expect(innstillinger.lagreInnstilling).toHaveBeenCalledWith(def.konto, b))
  })

  it('lar kontoen være når den ikke svarer, og overser ugyldige verdier', async () => {
    innstillinger.hentInnstilling.mockRejectedValueOnce(new Error('nede'))
    const { result, unmount } = renderHook(() => useKontovalg(def, 'ada'))
    await waitFor(() => expect(innstillinger.hentInnstilling).toHaveBeenCalled())
    await act(async () => {})
    expect(result.current.valg).toBe('system')
    expect(innstillinger.lagreInnstilling).not.toHaveBeenCalled()
    unmount()

    innstillinger.hentInnstilling.mockResolvedValue('blaatt')
    renderHook(() => useKontovalg(def, 'ada'))
    await waitFor(() => expect(innstillinger.lagreInnstilling).toHaveBeenCalledWith(def.konto, 'system'))
  })

  it('lagrer hvert valg på kontoen, også å følge systemet', async () => {
    innstillinger.hentInnstilling.mockResolvedValue(b)
    const { result } = renderHook(() => useKontovalg(def, 'ada'))
    await waitFor(() => expect(result.current.valg).toBe(b))

    for (const valg of [a, 'system', b]) {
      act(() => result.current.velg(valg))
      expect(result.current.valg).toBe(valg)
      await waitFor(() => expect(innstillinger.lagreInnstilling).toHaveBeenLastCalledWith(def.konto, valg))
    }
  })

  it('et svar som ble bedt om før brukeren valgte, overstyrer ikke valget', async () => {
    const svar = utsatt<unknown>()
    innstillinger.hentInnstilling.mockReturnValueOnce(svar.lovnad)
    const { result } = renderHook(() => useKontovalg(def, 'ada'))

    act(() => result.current.velg(a))
    await act(async () => svar.loes(b))
    expect(result.current.valg).toBe(a)
  })

  it('henter valget på nytt når fanen blir synlig, så et valg på en annen maskin slår gjennom', async () => {
    innstillinger.hentInnstilling.mockResolvedValue(b)
    const { result } = renderHook(() => useKontovalg(def, 'ada'))
    await waitFor(() => expect(innstillinger.hentInnstilling).toHaveBeenCalledTimes(1))

    innstillinger.hentInnstilling.mockResolvedValue(a)
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await waitFor(() => expect(result.current.valg).toBe(a))
  })

  it('venter med å hente mens et valg fortsatt lagres', async () => {
    innstillinger.hentInnstilling.mockResolvedValue(b)
    const lagring = utsatt<void>()
    const { result } = renderHook(() => useKontovalg(def, 'ada'))
    await waitFor(() => expect(result.current.valg).toBe(b))

    innstillinger.lagreInnstilling.mockReturnValueOnce(lagring.lovnad)
    act(() => result.current.velg(a))
    // Kontoen viser ennå det gamle valget: det skal ikke vippe valget tilbake.
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(result.current.valg).toBe(a)
    await act(async () => lagring.loes())
  })

  it('lagrer valgene etter hverandre, så det siste blir stående', async () => {
    innstillinger.hentInnstilling.mockResolvedValue(b)
    const forste = utsatt<void>()
    const { result } = renderHook(() => useKontovalg(def, 'ada'))
    await waitFor(() => expect(result.current.valg).toBe(b))

    innstillinger.lagreInnstilling.mockReturnValueOnce(forste.lovnad)
    act(() => result.current.velg(a))
    await waitFor(() => expect(innstillinger.lagreInnstilling).toHaveBeenCalledTimes(1))
    act(() => result.current.velg('system'))
    act(() => result.current.velg(a))
    // Den neste lagringen venter til den første har svart, og bare det siste
    // av valgene som ventet, sendes.
    await act(async () => {})
    expect(innstillinger.lagreInnstilling).toHaveBeenCalledTimes(1)

    await act(async () => forste.loes())
    await waitFor(() => expect(innstillinger.lagreInnstilling).toHaveBeenCalledTimes(2))
    expect(innstillinger.lagreInnstilling.mock.calls.map(([, verdi]) => verdi)).toEqual([a, a])
    expect(result.current.valg).toBe(a)
  })
})
