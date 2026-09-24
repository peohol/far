// @vitest-environment jsdom
/**
 * Fagsøket mens treffene henger etter feltet (`useDeferredValue`): `Enter`
 * skal aldri åpne et treff fra søket før, men gå til søkesiden med det som
 * står i feltet. I jsdom rekker React alltid å regne ut søket, så her holdes
 * den utsatte verdien igjen for hånd.
 */
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Fagsok } from '../components/sok/Fagsok'
import { TipsLag } from '../components/Tips'
import { lagSokeindeks } from '../faginnhold/sok'

const utsatt = vi.hoisted(() => ({ holdt: undefined as string | undefined }))

vi.mock('react', async (hent) => {
  const react = await hent<typeof import('react')>()
  return { ...react, useDeferredValue: <T,>(verdi: T): T => (utsatt.holdt ?? verdi) as T }
})

afterEach(() => {
  cleanup()
  utsatt.holdt = undefined
})

const KLAR = {
  status: 'klar' as const,
  indeks: lagSokeindeks([
    { sted: { side: { kode: 'SERT', navn: 'Sertralin' } }, felt: 'navn', tekst: 'Sertralin' },
    { sted: { side: { kode: 'KVE', navn: 'Kvetiapin' } }, felt: 'navn', tekst: 'Kvetiapin' },
  ]),
}

describe('fagsøket mens treffene henger etter feltet', () => {
  it('åpner ikke et treff fra søket før, men går til søkesiden med teksten i feltet', async () => {
    const user = userEvent.setup()
    const onGaaTil = vi.fn()
    render(
      <TipsLag>
        <Fagsok indeks={KLAR} onKrev={() => {}} onGaaTil={onGaaTil} />
      </TipsLag>,
    )
    const felt = screen.getByRole('combobox', { name: 'Søk i fagstoffet' })
    await user.click(felt)
    await user.keyboard('sertralin')
    const liste = screen.getByRole('listbox', { name: 'Treff i fagstoff' })
    expect(within(liste).getAllByRole('option')[0]!.getAttribute('aria-selected')).toBe('true')

    // Nytt søk skrives, men treffene viser fortsatt «sertralin».
    utsatt.holdt = 'sertralin'
    await user.clear(felt)
    await user.keyboard('kvetiapin')
    expect(within(liste).getAllByRole('option')[0]!.textContent).toContain('Sertralin')
    expect(within(liste).queryAllByRole('option', { selected: true })).toHaveLength(0)
    expect(felt.hasAttribute('aria-activedescendant')).toBe(false)

    await user.keyboard('{Enter}')
    expect(onGaaTil).toHaveBeenCalledWith('#/sok?q=kvetiapin')
  })
})
