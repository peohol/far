// @vitest-environment jsdom
/**
 * Konsentrasjonene i fagtekstene: tallene som leses, omregningen med høyst to
 * gjeldende sifre, merkingen i rikteksten, visningen i måleenheten brukeren
 * har valgt med boblen over alle enhetene, merkingen i editoren, preferansen
 * på kontoen og kontrollen kuratoren og kontrolløren kjører. Tallene er
 * syntetiske; molekylvekten er en testverdi.
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  finnKonsentrasjoner,
  konsentrasjonIAlleEnheter,
  lesKonsentrasjonstall,
  visKonsentrasjon,
  type Tekstkonsentrasjon,
} from '../enheter/konsentrasjon'
import { klartekst, erTomt, finnNoder, NODER, rensDokument, type Riktekstdokument } from '../faginnhold/riktekst'
import { FORBINDELSER } from '../kjemi/forbindelser'
import { konsentrasjonsrapport } from '../kuratorprotokoll/konsentrasjoner'

const innstillinger = vi.hoisted(() => ({
  hentInnstilling: vi.fn<(nokkel: string) => Promise<unknown>>(),
  lagreInnstilling: vi.fn<(nokkel: string, verdi: unknown) => Promise<void>>(),
}))
vi.mock('../auth/innstillinger', () => ({
  hentInnstilling: innstillinger.hentInnstilling,
  lagreInnstilling: innstillinger.lagreInnstilling,
  lagreSisteValg: (nokkel: string) => (verdi: unknown) => innstillinger.lagreInnstilling(nokkel, verdi),
}))

const { Riktekst } = await import('../components/stoffside/Riktekst')
const { Rikteksteditor } = await import('../components/stoffside/Rikteksteditor')
const { Konsentrasjonskilde } = await import('../components/stoffside/Konsentrasjon')
const { MaleenhetKilde, useMaleenhet } = await import('../enheter/Maleenhet')

/** Molekylvekten (g/mol) testene regner med, slik PubChem skriver den. */
const MW = '300'

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Range.prototype.getClientRects ??= () => ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] }) as unknown as DOMRectList
  Range.prototype.getBoundingClientRect ??= () => new DOMRect()
})

beforeEach(() => {
  localStorage.clear()
  innstillinger.hentInnstilling.mockReset().mockResolvedValue(null)
  innstillinger.lagreInnstilling.mockReset().mockResolvedValue(undefined)
})
afterEach(cleanup)

const k = (verdi: string, enhet: string, forbindelse: string | null = 'citalopram'): Tekstkonsentrasjon => ({ verdi, enhet, forbindelse })

describe('tallene i en konsentrasjon', () => {
  it.each([
    ['50', { komparator: null, tall: [50] }],
    ['0,5', { komparator: null, tall: [0.5] }],
    ['1.5', { komparator: null, tall: [1.5] }],
    ['1 000', { komparator: null, tall: [1000] }],
    ['1 000', { komparator: null, tall: [1000] }],
    ['50–200', { komparator: null, tall: [50, 200] }],
    ['50 - 200', { komparator: null, tall: [50, 200] }],
    ['0,5—1,2', { komparator: null, tall: [0.5, 1.2] }],
    ['< 0,05', { komparator: '<', tall: [0.05] }],
    ['>=10', { komparator: '≥', tall: [10] }],
    ['100–100', { komparator: null, tall: [100, 100] }],
  ])('leser «%s»', (tekst, forventet) => {
    expect(lesKonsentrasjonstall(tekst)).toEqual(forventet)
  })

  it.each(['', 'ca. 50', '200–50', '< 50–100', '50 µg/L', '-5', '1,2,3'])('avviser «%s»', (tekst) => {
    expect(lesKonsentrasjonstall(tekst)).toBeNull()
  })
})

describe('visningen i den valgte enheten', () => {
  it('regner om mellom masse og stoffmengde med molekylvekten, med høyst to gjeldende sifre', () => {
    // 50 nmol/L × 300 g/mol = 15 µg/L; 215 nmol/L = 64,5 µg/L → 65.
    expect(visKonsentrasjon(k('50–215', 'nmol/L'), 'µg/L', 300)).toEqual({ tekst: '15–65', enhet: 'µg/L', omregnet: true, somIKilden: false })
    expect(visKonsentrasjon(k('50–215', 'nmol/L'), 'µmol/L', 300)).toEqual({ tekst: '0,05–0,22', enhet: 'µmol/L', omregnet: true, somIKilden: false })
    // 1356 µg/L → 4520 nmol/L → 4500; komparatoren følger med.
    expect(visKonsentrasjon(k('< 1356', 'µg/L'), 'nmol/L', 300).tekst).toBe('< 4500')
  })

  it('viser tallet nøyaktig som i kilden når enheten er den valgte, også skrevet per milliliter', () => {
    expect(visKonsentrasjon(k('125', 'nmol/L'), 'nmol/L', 300)).toEqual({ tekst: '125', enhet: 'nmol/L', omregnet: false, somIKilden: false })
    expect(visKonsentrasjon(k('1 356', 'ng/mL'), 'µg/L', null)).toEqual({ tekst: '1 356', enhet: 'µg/L', omregnet: false, somIKilden: false })
  })

  it('regner om innen masse eller stoffmengde uten molekylvekt, og står som i kilden ellers', () => {
    expect(visKonsentrasjon(k('0,5–1,2', 'mmol/L', null), 'µmol/L', null).tekst).toBe('500–1200')
    expect(visKonsentrasjon(k('0,05', 'mg/L', null), 'µg/L', null).tekst).toBe('50')
    expect(visKonsentrasjon(k('125', 'nmol/L', null), 'µg/L', null)).toEqual({ tekst: '125', enhet: 'nmol/L', omregnet: false, somIKilden: true })
  })

  it('runder på grensene for to gjeldende sifre', () => {
    // 0,125 → 0,13; 0,0995 → 0,1; 99,5 → 100.
    expect(visKonsentrasjon(k('125', 'nmol/L'), 'µmol/L', null).tekst).toBe('0,13')
    expect(visKonsentrasjon(k('99,5', 'nmol/L'), 'µmol/L', null).tekst).toBe('0,1')
    expect(visKonsentrasjon(k('0,0995', 'mg/L'), 'µg/L', null).tekst).toBe('100')
  })

  it('gir tallet i hver av enhetene til boblen, og sier når det ikke kan regnes om', () => {
    expect(konsentrasjonIAlleEnheter(k('50–215', 'nmol/L'), 300)).toEqual([
      { enhet: 'µg/L', tekst: '15–65' },
      { enhet: 'nmol/L', tekst: '50–215' },
      { enhet: 'µmol/L', tekst: '0,05–0,22' },
    ])
    expect(konsentrasjonIAlleEnheter(k('50', 'nmol/L', null), null).map((r) => r.tekst)).toEqual([null, '50', '0,05'])
  })
})

describe('konsentrasjoner i løpende tekst', () => {
  it('finner tall med en enhet som kan regnes om, og ikke doser eller andre enheter', () => {
    const tekst = 'Område 50–200 nmol/L i serum, < 0,05 ng/mL i urin og 1 000 µg/L. Dose 10 mg/dag, 3 mg/dL og CYP2D6 2 mg/L.'
    expect(finnKonsentrasjoner(tekst).map((f) => [f.verdi, f.enhet])).toEqual([
      ['50–200', 'nmol/L'],
      ['< 0,05', 'ng/mL'],
      ['1 000', 'µg/L'],
      ['2', 'mg/L'],
    ])
    const [forste] = finnKonsentrasjoner(tekst)
    expect(tekst.slice(forste!.start, forste!.slutt)).toBe('50–200 nmol/L')
  })
})

const node = (attrs: Record<string, unknown>) => ({ type: 'konsentrasjon', attrs })
const avsnitt = (...content: unknown[]) => ({ type: 'doc', content: [{ type: 'paragraph', content }] })

describe('merkingen i rikteksten', () => {
  it('beholder en konsentrasjon som kan leses, med forbindelsen eller uten', () => {
    const dokument = rensDokument(
      avsnitt(
        { type: 'text', text: 'Område ' },
        node({ verdi: ' 50–200 ', enhet: 'nmol/L', forbindelse: 'citalopram' }),
        node({ verdi: '0,5', enhet: 'mmol/L' }),
      ),
    )
    expect(finnNoder(dokument, NODER.konsentrasjon).map((n) => n.attrs)).toEqual([
      { verdi: '50–200', enhet: 'nmol/L', forbindelse: 'citalopram' },
      { verdi: '0,5', enhet: 'mmol/L', forbindelse: null },
    ])
    // Rensingen endrer ingenting en gang til.
    expect(rensDokument(dokument)).toEqual(dokument)
    expect(klartekst(dokument)).toBe('Område 50–200 nmol/L0,5 mmol/L')
    expect(erTomt(rensDokument(avsnitt(node({ verdi: '5', enhet: 'µg/L' }))))).toBe(false)
  })

  it('gjør en merking som ikke kan leses, til vanlig tekst, og tar ikke med en ugyldig forbindelse', () => {
    const dokument = rensDokument(
      avsnitt(
        node({ verdi: 'ca. 50', enhet: 'nmol/L' }),
        node({ verdi: '3', enhet: 'mg/dL' }),
        node({ verdi: '5', enhet: 'µg/L', forbindelse: 'Ikke en nøkkel' }),
        node({}),
      ),
    )
    expect(dokument.content![0]!.content).toEqual([
      { type: 'text', text: 'ca. 50 nmol/L' },
      { type: 'text', text: '3 mg/dL' },
      { type: 'konsentrasjon', attrs: { verdi: '5', enhet: 'µg/L', forbindelse: null } },
    ])
  })
})

function Velger() {
  const { velg } = useMaleenhet()
  return (
    <button type="button" onClick={() => velg('µmol/L')}>
      Bytt til µmol/L
    </button>
  )
}

function visTekst(dokument: unknown, molvekter = new Map([['citalopram', MW]])) {
  return render(
    <MaleenhetKilde brukerId="ada">
      <Velger />
      <Konsentrasjonskilde molvekter={molvekter} sideforbindelser={[]}>
        <Riktekst dokument={rensDokument(dokument)} />
      </Konsentrasjonskilde>
    </MaleenhetKilde>,
  )
}

describe('konsentrasjonen i lesemodus', () => {
  it('vises i den valgte enheten, følger et nytt valg, og viser kilden og alle enhetene i boblen', async () => {
    const bruker = userEvent.setup()
    localStorage.setItem('far:maleenhet', 'µg/L')
    visTekst(avsnitt({ type: 'text', text: 'Område ' }, node({ verdi: '50–215', enhet: 'nmol/L', forbindelse: 'citalopram' })))
    const knapp = screen.getByRole('button', { name: /15–65 µg\/L/ })
    expect(knapp.getAttribute('data-omregnet')).toBe('true')

    await bruker.click(knapp)
    expect(knapp.getAttribute('aria-expanded')).toBe('true')
    const tabell = screen.getByRole('table', { name: 'Konsentrasjonen i alle enheter' })
    const rader = within(tabell)
      .getAllByRole('row')
      .map((r) => [...r.children].map((c) => c.textContent))
    expect(rader).toEqual([
      ['I kilden', '50–215 nmol/L'],
      ['µg/L', '15–65'],
      ['nmol/L', '50–215'],
      ['µmol/L', '0,05–0,22'],
    ])
    expect(within(tabell).getAllByRole('row').find((r) => r.getAttribute('aria-current'))?.textContent).toBe('µg/L15–65')
    expect(screen.getByText(/Citalopram/).textContent).toContain('300 g/mol')

    // Escape lukker boblen og gir fokus tilbake.
    await bruker.keyboard('{Escape}')
    expect(knapp.getAttribute('aria-expanded')).toBe('false')

    await bruker.click(screen.getByRole('button', { name: 'Bytt til µmol/L' }))
    expect(screen.getByRole('button', { name: /0,05–0,22 µmol\/L/ })).toBeTruthy()
    await waitFor(() => expect(innstillinger.lagreInnstilling).toHaveBeenLastCalledWith('maleenhet', 'µmol/L'))
  })

  it('står som i kilden og sier hvorfor når molekylvekten mangler', async () => {
    localStorage.setItem('far:maleenhet', 'µg/L')
    visTekst(avsnitt(node({ verdi: '125', enhet: 'nmol/L', forbindelse: 'citalopram' })), new Map())
    const knapp = screen.getByRole('button', { name: /125 nmol\/L/ })
    expect(knapp.hasAttribute('data-omregnet')).toBe(false)
    fireEvent.pointerEnter(knapp.parentElement!, { pointerType: 'mouse' })
    expect(await screen.findByText(/trengs molekylvekten fra PubChem/)).toBeTruthy()
    expect(within(screen.getByRole('table')).getByText('kan ikke regnes om')).toBeTruthy()
  })
})

describe('preferansen på kontoen', () => {
  it('legger kontoens valg over det nettleseren husket, og lagrer det nettleseren har når kontoen ikke har noe', async () => {
    localStorage.setItem('far:maleenhet', 'µmol/L')
    innstillinger.hentInnstilling.mockResolvedValue('nmol/L')
    visTekst(avsnitt(node({ verdi: '50', enhet: 'nmol/L' })))
    expect(await screen.findByRole('button', { name: /^50 nmol\/L/ })).toBeTruthy()
    expect(innstillinger.hentInnstilling).toHaveBeenCalledWith('maleenhet')
    cleanup()

    innstillinger.hentInnstilling.mockResolvedValue(null)
    localStorage.setItem('far:maleenhet', 'µmol/L')
    visTekst(avsnitt(node({ verdi: '50', enhet: 'nmol/L' })))
    await waitFor(() => expect(innstillinger.lagreInnstilling).toHaveBeenCalledWith('maleenhet', 'µmol/L'))
    expect(screen.getByRole('button', { name: /0,05 µmol\/L/ })).toBeTruthy()
  })
})

describe('merkingen i editoren', () => {
  it('merker en konsentrasjon med tallet og enheten som i kilden og forbindelsen, og forhåndsviser den', async () => {
    const bruker = userEvent.setup()
    localStorage.setItem('far:maleenhet', 'µg/L')
    const onEndre = vi.fn<(d: Riktekstdokument) => void>()
    const citalopram = FORBINDELSER.finn('citalopram')!
    render(
      <Konsentrasjonskilde molvekter={new Map([['citalopram', MW]])} sideforbindelser={[citalopram]}>
        <Rikteksteditor dokument={rensDokument(avsnitt({ type: 'text', text: 'Område ' }))} onEndre={onEndre} etikett="TDM" />
      </Konsentrasjonskilde>,
    )
    await bruker.click(screen.getByRole('button', { name: /Merk en konsentrasjon/ }))
    const panel = screen.getByRole('group', { name: 'Konsentrasjon' })
    const merk = within(panel).getByRole('button', { name: 'Merk i teksten' })
    expect(merk).toHaveProperty('disabled', true)
    // Den eneste forbindelsen på siden er valgt på forhånd.
    expect((within(panel).getByLabelText('Forbindelsen som er målt') as HTMLSelectElement).value).toBe('citalopram')

    await bruker.type(within(panel).getByLabelText('Tall eller område, som i kilden'), '50–215')
    await bruker.type(within(panel).getByLabelText('Enhet, som i kilden'), 'mg/dL')
    expect(within(panel).getByRole('alert').textContent).toMatch(/Enheten må være/)
    expect(merk).toHaveProperty('disabled', true)
    await bruker.clear(within(panel).getByLabelText('Enhet, som i kilden'))
    await bruker.type(within(panel).getByLabelText('Enhet, som i kilden'), 'nmol/L')
    expect(within(panel).getByText(/Vises for deg som 15–65 µg\/L/)).toBeTruthy()

    await bruker.click(merk)
    expect(screen.queryByRole('group', { name: 'Konsentrasjon' })).toBeNull()
    const sist = onEndre.mock.lastCall![0]
    expect(finnNoder(sist, NODER.konsentrasjon).map((n) => n.attrs)).toEqual([{ verdi: '50–215', enhet: 'nmol/L', forbindelse: 'citalopram' }])
    // I editoren står tallet som i kilden.
    expect(screen.getByLabelText('Konsentrasjon: 50–215 nmol/L (Citalopram)').textContent).toBe('50–215 nmol/L')
  })

  it('har ikke knappen der referansene er slått av, men beholder merkingen', async () => {
    render(
      <Rikteksteditor
        dokument={rensDokument(avsnitt(node({ verdi: '5', enhet: 'µg/L' })))}
        onEndre={() => {}}
        etikett="Idé"
        referanser={false}
      />,
    )
    expect(screen.queryByRole('button', { name: /Merk en konsentrasjon/ })).toBeNull()
    expect(await screen.findByText('5 µg/L')).toBeTruthy()
  })
})

describe('kontrollen for kuratoren og kontrolløren', () => {
  it('lister de merkede med det som hindrer omregningen, og tallene som står umerket', () => {
    const elementer = [
      {
        innhold: {
          panel: 'tdm',
          data: {
            tittel: 'Prøvetaking',
            dokument: avsnitt(
              { type: 'text', text: 'Område ' },
              node({ verdi: '50–200', enhet: 'nmol/L', forbindelse: 'citalopram' }),
              { type: 'text', text: ', ved forgiftning over 1 000 µg/L.' },
              { type: 'text', text: '5 mg/L', marks: [{ type: 'code' }] },
            ),
          },
        },
      },
      {
        innhold: {
          panel: 'farmakokinetikk',
          data: {
            dokument: avsnitt(
              node({ verdi: '0,5', enhet: 'mmol/L' }),
              node({ verdi: 'ca. 3', enhet: 'nmol/L', forbindelse: 'litium' }),
              node({ verdi: '3', enhet: 'nmol/L', forbindelse: 'finnes-ikke' }),
            ),
          },
        },
      },
      { innhold: { panel: 'fjernet', data: { dokument: avsnitt({ type: 'text', text: '7 µg/L' }) } } },
    ]
    const { merket, umerket } = konsentrasjonsrapport('citalopram', elementer)
    expect(merket.map((m) => [m.hvor, m.tekst, m.feil])).toEqual([
      ['tdm · Prøvetaking', '50–200 nmol/L', false],
      ['farmakokinetikk', '0,5 mmol/L', false],
      ['farmakokinetikk', 'ca. 3 nmol/L', true],
      ['farmakokinetikk', '3 nmol/L', true],
    ])
    expect(merket[0]!.merknader).toEqual([])
    expect(merket[1]!.merknader).toEqual(['forbindelsen er ikke oppgitt, så tallet regnes bare om innen masse eller stoffmengde'])
    expect(merket[2]!.merknader.join(' ')).toMatch(/kan ikke leses.*hører ikke til fagsiden/)
    expect(merket[3]!.merknader).toEqual(['forbindelsen «finnes-ikke» finnes ikke i src/data/forbindelser.ts'])
    expect(umerket).toEqual([{ hvor: 'tdm · Prøvetaking', tekst: '1 000 µg/L', utdrag: ', ved forgiftning over 1 000 µg/L.' }])
  })
})
