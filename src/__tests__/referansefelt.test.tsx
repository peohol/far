// @vitest-environment jsdom
/**
 * Referansefeltet nederst i et kort eller panel, listen med automatiske
 * kilder, og at editoren aldri tilbyr en automatisk kilde.
 */
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { Referansevelger } from '../components/analyttside/Referansevelger'
import { Redigeringskilde } from '../components/analyttside/Redigeringskontekst'
import { Referansefelt } from '../components/referanser/Referansefelt'
import { Referanseliste } from '../components/referanser/Referanseliste'
import { Sidereferanser } from '../components/referanser/Sidereferanser'
import { nummerer, type Referanse } from '../faginnhold/referanser'

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})

afterEach(cleanup)

const REDAKSJONELL: Referanse = { id: 'r', tittel: 'Hiemke C', forfattere: '', aar: '2018', lenke: '' }
const FEST: Referanse = {
  id: 'fest:kilde',
  tittel: 'FEST – Forskrivnings- og ekspedisjonsstøtte',
  forfattere: 'Direktoratet for medisinske produkter',
  aar: '',
  lenke: '',
  automatisk: { kilde: 'FEST', opphav: 'Legemiddeldata fra FEST, uttrekk fra 8. september 2026' },
}
const DMP: Referanse = { id: 'fest:1', tittel: 'Hiemke C et al.', forfattere: '', aar: '', lenke: '', automatisk: { kilde: 'FEST' } }
const REFERANSER = [REDAKSJONELL, FEST, DMP]

function Side({ children }: { children: React.ReactNode }) {
  return (
    <Sidereferanser nummerering={nummerer([['r', 'fest:kilde', 'fest:1']])} referanser={REFERANSER}>
      {children}
    </Sidereferanser>
  )
}

describe('referansefeltet', () => {
  it('viser kildene for hele beholderen som nummerpille, med sporbarheten for en automatisk datakilde', () => {
    render(
      <Side>
        <Referansefelt ider={['r', 'fest:kilde']} niva="panel" />
      </Side>,
    )
    const pille = screen.getByRole('button', { name: 'Referanser 1, 2' })
    const felt = pille.closest('.referansefelt')!
    expect(felt.getAttribute('title')).toBe('Gjelder hele seksjonen')
    expect(felt.textContent).toBe(
      'Kilder1, 2Legemiddeldata fra FEST, uttrekk fra 8. september 2026 · kan ikke redigeres',
    )
  })

  it('viser redaksjonelle og automatiske kilder likt i boblen', async () => {
    const bruker = userEvent.setup()
    render(
      <Side>
        <Referansefelt ider={['r', 'fest:1']} />
      </Side>,
    )
    const pille = screen.getByRole('button', { name: 'Referanser 1, 3' })
    expect(pille.closest('.referansefelt')!.getAttribute('title')).toBe('Gjelder hele kortet')
    // Et kort med bare DMPs referanser har ingen sporbarhetslinje; den står i seksjonens felt.
    expect(pille.closest('.referansefelt')!.textContent).toBe('Kilder1, 3')
    await bruker.click(pille)
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['1Hiemke C · 2018', '3Hiemke C et al.'])
  })

  it('vises ikke uten referanser siden kjenner', () => {
    const { container } = render(
      <Side>
        <Referansefelt ider={['ukjent']} />
        <Referansefelt ider={[]} />
      </Side>,
    )
    expect(container.innerHTML).toBe('')
  })
})

describe('referanselisten', () => {
  it('lister begge opphav sammen, og merker de automatiske som ikke redigerbare', () => {
    render(
      <Side>
        <Referanseliste />
      </Side>,
    )
    const punkter = within(screen.getByRole('region', { name: 'Referanser' })).getAllByRole('listitem')
    expect(punkter.map((li) => [li.getAttribute('value'), li.textContent])).toEqual([
      ['1', 'Hiemke C · 2018'],
      [
        '2',
        'FEST – Forskrivnings- og ekspedisjonsstøtte · Direktoratet for medisinske produkterAutomatisk fra FEST · kan ikke redigeresLegemiddeldata fra FEST, uttrekk fra 8. september 2026',
      ],
      ['3', 'Hiemke C et al.Automatisk fra FEST · kan ikke redigeres'],
    ])
  })
})

describe('editoren', () => {
  it('tilbyr aldri en automatisk kilde, selv om den skulle ligge i referansebasen, men viser den låst', async () => {
    const bruker = userEvent.setup()
    const onEndre = vi.fn()
    render(
      <Redigeringskilde
        verdi={{ referansebase: REFERANSER, opprettReferanse: vi.fn(), gjenopprett: vi.fn() }}
      >
        <Referansevelger tittel="Kilder for kortet" valgte={[]} onEndre={onEndre} />
      </Redigeringskilde>,
    )
    await bruker.type(screen.getByRole('searchbox', { name: 'Finn en referanse' }), 'hiemke')
    const forslag = within(screen.getByRole('list', { name: 'Referanser som passer' })).getAllByRole('button')
    expect(forslag.map((b) => b.textContent)).toEqual(['Legg til: Hiemke C · 2018'])

    await bruker.clear(screen.getByRole('searchbox', { name: 'Finn en referanse' }))
    await bruker.type(screen.getByRole('searchbox', { name: 'Finn en referanse' }), 'FEST')
    // Den automatiske kilden står i treffene, men låst: den kan ikke velges.
    const treff = screen.getByRole('list', { name: 'Referanser som passer' })
    expect(within(treff).queryAllByRole('button')).toEqual([])
    expect(within(treff).getByRole('img', { name: /Automatisk fra FEST/ })).toBeTruthy()
  })
})
