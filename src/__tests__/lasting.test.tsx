// @vitest-environment jsdom
/**
 * Lasteindikatoren: hentingene appen gjør gjennom klienten telles, unntatt
 * dem i bakgrunnen, og streken øverst vises bare når en henting varer.
 */
import { act, cleanup, render } from '@testing-library/react'
import { createClient } from '@supabase/supabase-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { iBakgrunnen, pagaendeHentinger, sporetFetch } from '../auth/aktivitet'
import { LASTEINDIKATOR_FORSINKELSE_MS, Lasteindikator } from '../components/Lasteindikator'

/** En `fetch` som svarer først når testen sier fra. */
function ventendeFetch() {
  const svar: (() => void)[] = []
  const signaler: (AbortSignal | null | undefined)[] = []
  const fetch = vi.fn((_: unknown, init?: RequestInit) => {
    signaler.push(init?.signal)
    return new Promise<Response>((r) => svar.push(() => r(new Response('null', { status: 200 }))))
  })
  return { fetch, signaler, svarAlle: () => svar.splice(0).forEach((s) => s()) }
}

function klientMed() {
  return createClient('https://eksempel.supabase.co', 'nokkel', {
    global: { fetch: sporetFetch },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('hentingene appen gjør', () => {
  it('telles mens de er på vei', async () => {
    const nett = ventendeFetch()
    vi.stubGlobal('fetch', nett.fetch)
    // Kallet går først når noen venter på svaret.
    const kall = Promise.resolve(klientMed().rpc('les_noe'))
    await vi.waitFor(() => expect(nett.fetch).toHaveBeenCalled())
    expect(pagaendeHentinger()).toBe(1)
    nett.svarAlle()
    await kall
    expect(pagaendeHentinger()).toBe(0)
  })

  it('telles ikke når de gjøres i bakgrunnen', async () => {
    const nett = ventendeFetch()
    vi.stubGlobal('fetch', nett.fetch)
    const kall = Promise.resolve(iBakgrunnen(klientMed()).rpc('les_noe', { a: 1 }))
    await vi.waitFor(() => expect(nett.fetch).toHaveBeenCalled())
    expect(pagaendeHentinger()).toBe(0)
    // Signalet bare merker kallet og avbryter det aldri.
    expect(nett.signaler[0]?.aborted).toBe(false)
    nett.svarAlle()
    expect((await kall).error).toBeNull()
  })

  it('telles også når de feiler', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Nettet er nede')))
    await sporetFetch('https://eksempel.supabase.co').catch(() => {})
    expect(pagaendeHentinger()).toBe(0)
  })
})

describe('lasteindikatoren', () => {
  it('vises når en henting varer, og forsvinner når den er ferdig', async () => {
    vi.useFakeTimers()
    let svar: () => void = () => {}
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((r) => (svar = () => r(new Response(''))))))
    const { container } = render(<Lasteindikator />)
    const strek = container.querySelector('.lasteindikator')!
    expect(strek.getAttribute('data-vis')).toBe('nei')

    let henting!: Promise<Response>
    act(() => {
      henting = sporetFetch('https://eksempel.supabase.co')
    })
    // En kort henting blinker ikke.
    act(() => vi.advanceTimersByTime(LASTEINDIKATOR_FORSINKELSE_MS - 1))
    expect(strek.getAttribute('data-vis')).toBe('nei')
    act(() => vi.advanceTimersByTime(1))
    expect(strek.getAttribute('data-vis')).toBe('ja')
    expect(strek.getAttribute('aria-hidden')).toBe('false')

    await act(async () => {
      svar()
      await henting
    })
    expect(strek.getAttribute('data-vis')).toBe('nei')
  })
})
