// @vitest-environment jsdom
/**
 * Temaet på kontoen: valget hentes når brukeren er inne, lagres når det
 * byttes, og det nettleseren alt husket, blir med når kontoen ikke har noe.
 *
 * Brukerinnstillingene er erstattet; det er samspillet med temaet som prøves.
 */
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const innstillinger = vi.hoisted(() => ({
  hentInnstilling: vi.fn<(nokkel: string) => Promise<unknown>>(),
  lagreInnstilling: vi.fn(async (_nokkel: string, _verdi: unknown) => {}),
}))
vi.mock('../auth/innstillinger', () => innstillinger)

import { useKontotema } from '../hooks/useKontotema'

function utsatt<T>() {
  let loes!: (verdi: T) => void
  const lovnad = new Promise<T>((r) => (loes = r))
  return { lovnad, loes }
}

beforeEach(() => {
  document.documentElement.dataset.tema = 'moerkt'
  localStorage.clear()
  innstillinger.hentInnstilling.mockReset()
  innstillinger.lagreInnstilling.mockClear()
})
afterEach(cleanup)

describe('temaet på kontoen', () => {
  it('legger kontoens valg over det nettleseren husket', async () => {
    innstillinger.hentInnstilling.mockResolvedValue('lyst')
    const { result } = renderHook(() => useKontotema('ada'))

    await waitFor(() => expect(result.current.theme).toBe('lyst'))
    expect(innstillinger.hentInnstilling).toHaveBeenCalledWith('tema')
    expect(document.documentElement.dataset.tema).toBe('lyst')
    expect(localStorage.getItem('far:tema')).toBe('lyst')
    expect(innstillinger.lagreInnstilling).not.toHaveBeenCalled()
  })

  it('lagrer temaet nettleseren står i når kontoen ikke har noe valg', async () => {
    document.documentElement.dataset.tema = 'lyst'
    innstillinger.hentInnstilling.mockResolvedValue(null)
    renderHook(() => useKontotema('ada'))

    await waitFor(() => expect(innstillinger.lagreInnstilling).toHaveBeenCalledWith('tema', 'lyst'))
  })

  it('lar kontoen være når den ikke svarer, og overser ugyldige verdier', async () => {
    innstillinger.hentInnstilling.mockRejectedValueOnce(new Error('nede'))
    const { result, unmount } = renderHook(() => useKontotema('ada'))
    await waitFor(() => expect(innstillinger.hentInnstilling).toHaveBeenCalled())
    await act(async () => {})
    expect(result.current.theme).toBe('moerkt')
    expect(innstillinger.lagreInnstilling).not.toHaveBeenCalled()
    unmount()

    innstillinger.hentInnstilling.mockResolvedValue('blaatt')
    renderHook(() => useKontotema('ada'))
    await waitFor(() => expect(innstillinger.lagreInnstilling).toHaveBeenCalledWith('tema', 'moerkt'))
  })

  it('lagrer hvert bytte på kontoen', async () => {
    innstillinger.hentInnstilling.mockResolvedValue('moerkt')
    const { result } = renderHook(() => useKontotema('ada'))
    await waitFor(() => expect(innstillinger.hentInnstilling).toHaveBeenCalled())

    act(() => result.current.toggle())
    expect(result.current.theme).toBe('lyst')
    await waitFor(() => expect(innstillinger.lagreInnstilling).toHaveBeenLastCalledWith('tema', 'lyst'))

    act(() => result.current.toggle())
    expect(result.current.theme).toBe('moerkt')
    await waitFor(() => expect(innstillinger.lagreInnstilling).toHaveBeenLastCalledWith('tema', 'moerkt'))
  })

  it('et svar som ble bedt om før brukeren byttet, overstyrer ikke byttet', async () => {
    const svar = utsatt<unknown>()
    innstillinger.hentInnstilling.mockReturnValueOnce(svar.lovnad)
    const { result } = renderHook(() => useKontotema('ada'))

    act(() => result.current.toggle())
    await act(async () => svar.loes('moerkt'))
    expect(result.current.theme).toBe('lyst')
  })

  it('henter valget på nytt når fanen blir synlig, så et bytte på en annen maskin slår gjennom', async () => {
    innstillinger.hentInnstilling.mockResolvedValue('moerkt')
    const { result } = renderHook(() => useKontotema('ada'))
    await waitFor(() => expect(innstillinger.hentInnstilling).toHaveBeenCalledTimes(1))

    innstillinger.hentInnstilling.mockResolvedValue('lyst')
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await waitFor(() => expect(result.current.theme).toBe('lyst'))
  })

  it('venter med å hente mens et bytte fortsatt lagres', async () => {
    innstillinger.hentInnstilling.mockResolvedValue('moerkt')
    const lagring = utsatt<void>()
    const { result } = renderHook(() => useKontotema('ada'))
    await waitFor(() => expect(innstillinger.hentInnstilling).toHaveBeenCalledTimes(1))

    innstillinger.lagreInnstilling.mockReturnValueOnce(lagring.lovnad)
    act(() => result.current.toggle())
    // Kontoen viser ennå det gamle valget: det skal ikke vippe temaet tilbake.
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(result.current.theme).toBe('lyst')
    await act(async () => lagring.loes())
  })

  it('lagrer byttene etter hverandre, så det siste valget blir stående', async () => {
    innstillinger.hentInnstilling.mockResolvedValue('moerkt')
    const forste = utsatt<void>()
    const { result } = renderHook(() => useKontotema('ada'))
    await waitFor(() => expect(innstillinger.hentInnstilling).toHaveBeenCalledTimes(1))

    innstillinger.lagreInnstilling.mockReturnValueOnce(forste.lovnad)
    act(() => result.current.toggle())
    await waitFor(() => expect(innstillinger.lagreInnstilling).toHaveBeenCalledTimes(1))
    act(() => result.current.toggle())
    act(() => result.current.toggle())
    // Den neste lagringen venter til den første har svart, og bare det siste
    // av valgene som ventet, sendes.
    await act(async () => {})
    expect(innstillinger.lagreInnstilling).toHaveBeenCalledTimes(1)

    await act(async () => forste.loes())
    await waitFor(() => expect(innstillinger.lagreInnstilling).toHaveBeenCalledTimes(2))
    expect(innstillinger.lagreInnstilling.mock.calls.map(([, verdi]) => verdi)).toEqual(['lyst', 'lyst'])
    expect(result.current.theme).toBe('lyst')
  })
})
