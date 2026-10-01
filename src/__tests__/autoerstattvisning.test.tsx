// @vitest-environment jsdom
/**
 * Autoerstatt slik brukerne møter den: i rikteksteditoren og tekstfeltene
 * mens det skrives, med angring på tilbaketasten, og administratorenes
 * vindu for å opprette, endre og slette regler. Databasen er erstattet med et
 * lager i minnet.
 */
import type { Editor } from '@tiptap/core'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState, type ReactNode } from 'react'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { AutoerstattProvider } from '../autoerstatt/Autoerstattkilde'
import type { Autoerstattlager } from '../autoerstatt/lagring'
import type { Autoerstattregel } from '../autoerstatt/regler'
import { Autoerstattregler } from '../components/konto/Autoerstattregler'
import { Tekstomrade } from '../components/regler/Regelfelter'
import { Rikteksteditor } from '../components/stoffside/Rikteksteditor'
import { tomtDokument, type Riktekstdokument } from '../faginnhold/riktekst'

beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  }
})

afterEach(cleanup)

/** Et lager i minnet med de tre første reglene. */
function minnelager(): Autoerstattlager & { regler: Autoerstattregel[] } {
  let neste = 0
  const regler: Autoerstattregel[] = [
    { id: 'a', finn: ' - ', erstatt: ' – ' },
    { id: 'b', finn: '--', erstatt: '–' },
    { id: 'c', finn: ' * ', erstatt: ' · ' },
  ]
  return {
    regler,
    hent: async () => regler.map((r) => ({ ...r })),
    opprett: async (finn, erstatt) => {
      regler.push({ id: `ny${++neste}`, finn, erstatt })
    },
    endre: async (id, finn, erstatt) => {
      Object.assign(regler.find((r) => r.id === id)!, { finn, erstatt })
    },
    slett: async (id) => {
      regler.splice(regler.findIndex((r) => r.id === id), 1)
    },
  }
}

function Kilde({ lager, children }: { lager: Autoerstattlager; children: ReactNode }) {
  return (
    <AutoerstattProvider lager={lager} brukerId="meg">
      {children}
    </AutoerstattProvider>
  )
}

/** Teksten i dokumentet, avsnitt for avsnitt. */
function tekst(dokument: Riktekstdokument): string {
  return JSON.stringify(dokument).match(/"text":"((?:[^"\\]|\\.)*)"/g)?.map((t) => JSON.parse(`{${t}}`).text).join('') ?? ''
}

/** Skriver tegn for tegn slik nettleseren gjør: editoren får se hvert tegn først. */
function skriv(editor: Editor, tegn: string) {
  for (const t of tegn) {
    act(() => {
      const { from, to } = editor.state.selection
      const lagInnsetting = () => editor.state.tr.insertText(t, from, to)
      const tatt = editor.view.someProp('handleTextInput', (f) => f(editor.view, from, to, t, lagInnsetting))
      if (!tatt) editor.view.dispatch(lagInnsetting())
    })
  }
}

function tilbake(editor: Editor) {
  act(() => {
    const hendelse = new KeyboardEvent('keydown', { key: 'Backspace' })
    if (!editor.view.someProp('handleKeyDown', (f) => f(editor.view, hendelse))) {
      const { from } = editor.state.selection
      editor.view.dispatch(editor.state.tr.delete(from - 1, from))
    }
  })
}

async function editor(lager: Autoerstattlager | null) {
  let siste = tomtDokument()
  const felt = <Rikteksteditor dokument={tomtDokument()} onEndre={(d) => (siste = d)} etikett="Tekst" referanser={false} />
  render(lager ? <Kilde lager={lager}>{felt}</Kilde> : felt)
  const boks = await screen.findByRole('textbox', { name: 'Tekst' })
  const e = (boks as HTMLElement & { editor: Editor }).editor
  // Reglene hentes når kilden settes opp.
  await act(async () => {})
  return { e, tekst: () => tekst(siste) }
}

describe('autoerstatt i rikteksteditoren', () => {
  it('bytter ut mens det skrives, og bare med mellomrommene i regelen', async () => {
    const { e, tekst } = await editor(minnelager())
    skriv(e, 'a - b a-b a -b a--b 2 * 3 2*3')
    expect(tekst()).toBe('a – b a-b a -b a–b 2 · 3 2*3')
  })

  it('setter tilbake det som ble skrevet med tilbaketasten rett etterpå', async () => {
    const { e, tekst } = await editor(minnelager())
    skriv(e, 'x--')
    expect(tekst()).toBe('x–')
    tilbake(e)
    expect(tekst()).toBe('x--')
    // Bare rett etter: et nytt tegn gjør tilbaketasten vanlig igjen.
    skriv(e, ' - y')
    tilbake(e)
    expect(tekst()).toBe('x-- – ')
  })

  it('bytter ingenting uten reglene', async () => {
    const { e, tekst } = await editor(null)
    skriv(e, 'a - b')
    expect(tekst()).toBe('a - b')
  })
})

describe('autoerstatt i tekstfeltene', () => {
  function Felt() {
    const [verdi, setVerdi] = useState('')
    return <Tekstomrade merke="Kommentar" verdi={verdi} onEndre={setVerdi} />
  }

  it('bytter ut mens det skrives, og angrer med tilbaketasten', async () => {
    render(
      <Kilde lager={minnelager()}>
        <Felt />
      </Kilde>,
    )
    await act(async () => {})
    const felt = screen.getByRole('textbox', { name: 'Kommentar' }) as HTMLTextAreaElement
    await userEvent.type(felt, 'a - b a-b 1--2')
    expect(felt.value).toBe('a – b a-b 1–2')
    await userEvent.type(felt, ' * ')
    expect(felt.value).toBe('a – b a-b 1–2 · ')
    await userEvent.type(felt, '{Backspace}')
    expect(felt.value).toBe('a – b a-b 1–2 * ')
  })
})

describe('vinduet for autoerstatt-reglene', () => {
  const vindu = (lager: Autoerstattlager) =>
    render(
      <Kilde lager={lager}>
        <Autoerstattregler apen onLukk={() => {}} />
      </Kilde>,
    )

  const rader = () => screen.getAllByRole('listitem').map((li) => li.querySelector('.autoerstatt__regel')?.textContent)

  it('viser reglene med mellomrommene synlige', async () => {
    vindu(minnelager())
    await waitFor(() => expect(rader()).toEqual(['␣-␣→␣–␣', '--→–', '␣*␣→␣·␣']))
  })

  it('oppretter, endrer og sletter regler', async () => {
    const lager = minnelager()
    vindu(lager)
    await waitFor(() => expect(rader()).toHaveLength(3))

    await userEvent.click(screen.getByRole('button', { name: 'Ny regel' }))
    await userEvent.type(screen.getByLabelText('Når det skrives'), ' -> ')
    await userEvent.type(screen.getByLabelText('Byttes det med'), ' → ')
    await userEvent.click(screen.getByRole('button', { name: 'Lagre' }))
    await waitFor(() => expect(lager.regler.at(-1)).toMatchObject({ finn: ' -> ', erstatt: ' → ' }))
    await waitFor(() => expect(rader()).toContain('␣->␣→␣→␣'))

    await userEvent.click(screen.getByRole('button', { name: 'Endre regelen «--» til «–»' }))
    const med = screen.getByLabelText('Byttes det med')
    await userEvent.clear(med)
    await userEvent.type(med, '—')
    await userEvent.click(screen.getByRole('button', { name: 'Lagre' }))
    await waitFor(() => expect(lager.regler.find((r) => r.id === 'b')?.erstatt).toBe('—'))

    const slett = screen.getByRole('button', { name: 'Slett regelen « * » til « · »' })
    await userEvent.click(slett)
    await userEvent.click(screen.getByRole('button', { name: 'Bekreft sletting av regelen « * » til « · »' }))
    await waitFor(() => expect(lager.regler.map((r) => r.id)).not.toContain('c'))
    await waitFor(() => expect(rader()).toHaveLength(3))
  })

  it('sier fra før lagring om en regel som ikke kan lagres', async () => {
    vindu(minnelager())
    await waitFor(() => expect(rader()).toHaveLength(3))
    await userEvent.click(screen.getByRole('button', { name: 'Ny regel' }))
    await userEvent.type(screen.getByLabelText('Når det skrives'), '--')
    await userEvent.type(screen.getByLabelText('Byttes det med'), '—')
    await userEvent.click(screen.getByRole('button', { name: 'Lagre' }))
    expect(within(screen.getByRole('alert')).getByText('Det finnes alt en regel for denne teksten.')).toBeTruthy()
  })
})
