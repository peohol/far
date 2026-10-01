// @vitest-environment jsdom
/**
 * Den ene regelen for når et tastetrykk er fortolkningens: mens den vises, og
 * fokus står i den eller ingen steder. Står fokus et annet sted på siden —
 * diskusjonstråden, en editor, toppmenyen — beholder elementet der de tastene
 * det selv bruker (`tastenGjelderFortolkningen` i `hooks/useKeyboard.ts`).
 */
import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  erBekreftelse,
  SKJULT_FORTOLKNING,
  tastenGjelderFortolkningen,
  useKeyboard,
  VIST_FORTOLKNING,
} from '../hooks/useKeyboard'

afterEach(cleanup)

const enter = () => new KeyboardEvent('keydown', { key: 'Enter' })
const tast = (key: string) => new KeyboardEvent('keydown', { key })

function Fortolkningstaster({ trykket }: { trykket: (navn: string) => void }) {
  useKeyboard({ '1': () => trykket('1'), Enter: () => trykket('Enter') })
  return null
}

/** Fortolkningen med et felt i, og resten av siden med en tråd og en knapp. */
function visSiden(tilstand = VIST_FORTOLKNING) {
  const trykket = vi.fn()
  render(
    <>
      <button type="button">Varsler</button>
      <main data-fortolkning={tilstand}>
        <Fortolkningstaster trykket={trykket} />
        <input aria-label="Konsentrasjon" />
      </main>
      <aside>
        <textarea aria-label="Svar i tråden" />
      </aside>
    </>,
  )
  return {
    trykket,
    tallfelt: screen.getByRole('textbox', { name: 'Konsentrasjon' }),
    traad: screen.getByRole('textbox', { name: 'Svar i tråden' }),
    knapp: screen.getByRole('button', { name: 'Varsler' }),
  }
}

describe('tastene i fortolkningen', () => {
  it('lar Enter bekrefte når fokus står i fortolkningen eller ingen steder', () => {
    const { tallfelt } = visSiden()
    expect(erBekreftelse(enter())).toBe(true)
    act(() => tallfelt.focus())
    expect(erBekreftelse(enter())).toBe(true)
  })

  it('gir linjeskift i diskusjonstråden i stedet for å kopiere en kommentar', async () => {
    const user = userEvent.setup()
    const { traad, trykket } = visSiden()
    await user.click(traad)
    expect(erBekreftelse(enter())).toBe(false)
    expect(erBekreftelse(tast(' '))).toBe(false)
    await user.keyboard('første linje{Enter}2')
    expect(traad).toHaveProperty('value', 'første linje\n2')
    expect(trykket).not.toHaveBeenCalled()
  })

  it('lar Enter trykke knappen som har fokus, men sifrene velge i fortolkningen', () => {
    const { knapp } = visSiden()
    act(() => knapp.focus())
    expect(erBekreftelse(enter())).toBe(false)
    expect(tastenGjelderFortolkningen(tast('1'))).toBe(true)
  })

  it('virker igjen når fokus er tilbake i fortolkningen', async () => {
    const user = userEvent.setup()
    const { traad, trykket } = visSiden()
    await user.click(traad)
    act(() => traad.blur())
    await user.keyboard('1')
    expect(trykket).toHaveBeenCalledWith('1')
  })

  it('ligger i ro mens fortolkningen står skjult', () => {
    visSiden(SKJULT_FORTOLKNING)
    expect(erBekreftelse(enter())).toBe(false)
    expect(tastenGjelderFortolkningen(tast('1'))).toBe(false)
  })

  it('gjelder et steg som står alene, uten flaten rundt seg', () => {
    render(<input aria-label="Felt" />)
    act(() => screen.getByRole('textbox', { name: 'Felt' }).focus())
    expect(erBekreftelse(enter())).toBe(true)
  })
})
