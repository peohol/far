// @vitest-environment jsdom
/**
 * THC-syrereglene på analyttsiden for IRCAK, prøvd i en nettleser i minnet:
 * oversikten, tekstbolkene og simulatoren. Simulatoren fortolker med den
 * samme motoren og de samme komponentene som fortolkningsmodulen
 * (`thcsteg.test.tsx`), med reglene siden viser.
 */
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { Analyttside } from '../components/analyttside/Analyttside'
import { FaginnholdskildeProvider } from '../components/analyttside/Faginnholdskilde'
import { Thcregler } from '../components/regler/Thcregler'
import { TipsLag } from '../components/Tips'
import { FORTOLKNINGSOPPFORINGER, byggKatalog } from '../domain/analyttkatalog'
import { THC_KODE } from '../domain/thc'
import { fortolkThc, tomThcInndata } from '../domain/thcMotor'
import { THC_TEKSTBOLKER, THC_TEKSTNOKLER } from '../domain/thcTekster'
import type { Faginnholdslager } from '../faginnhold/lagring'
import { TOM_SIDE, type Faginnholdsleser } from '../faginnhold/lesing'
import type { ThcRegelsettutgave } from '../faginnhold/thcregler'
import { THC_MODELL, THC_REGELSETT, THC_TEKSTER, thcRegelsettutgave } from './hjelp/thcgrunnlag'

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Element.prototype.scrollIntoView ??= function () {}
  window.scrollTo = () => {}
})

afterEach(cleanup)

const katalog = byggKatalog(FORTOLKNINGSOPPFORINGER)

function visSide(kode: string, sted?: readonly string[]) {
  const thcregelsett = thcRegelsettutgave()
  const leser: Faginnholdsleser = {
    lesAnalyttside: vi.fn(async (k: string) => ({ ...TOM_SIDE, thcregelsett: k === THC_KODE ? thcregelsett : null })),
    lesStoffside: vi.fn(async () => TOM_SIDE),
    lesStoffsidenavn: vi.fn(async () => []),
    lesReferanser: vi.fn(async () => []),
    finnInfosider: vi.fn(async () => []),
    finnIntervallregelsett: vi.fn(async () => null),
    finnScenarioregelsett: vi.fn(async () => null),
    lesIntervallregelsett: vi.fn(async () => []),
    lesThcRegelsett: vi.fn(async () => thcregelsett),
    lesKommentarer: vi.fn(async () => []),
    lesReferanseomrader: vi.fn(async () => new Map()),
    lesHistorikk: vi.fn(async () => {
      throw new Error('ikke i bruk')
    }),
  }
  render(
    <TipsLag>
      <FaginnholdskildeProvider kilde={{ leser, lager: {} as Faginnholdslager, kanRedigere: false }}>
        <Analyttside kode={kode} sted={sted} katalog={katalog} onApneFortolkning={vi.fn()} onLukk={vi.fn()} />
      </FaginnholdskildeProvider>
    </TipsLag>,
  )
}

function visRegler(utgave: ThcRegelsettutgave = thcRegelsettutgave()) {
  render(
    <TipsLag>
      <Thcregler utgave={utgave} redigerer={false} />
    </TipsLag>,
  )
}

const gruppe = (navn: string) => within(screen.getByRole('group', { name: navn }))

describe('THC-syrereglene på analyttsiden', () => {
  it('står på siden for IRCAK, og ikke på andre sider', async () => {
    visSide(THC_KODE)
    expect(await screen.findByRole('heading', { level: 2, name: 'Fortolkningsregler' })).toBeTruthy()
    cleanup()
    visSide('NOR')
    await screen.findByText('Denne siden har ikke fått faginnhold ennå.')
    expect(screen.queryByRole('heading', { level: 2, name: 'Fortolkningsregler' })).toBeNull()
  })

  it('åpner simulatoren fra en direktelenke', async () => {
    visSide(THC_KODE, ['fortolkning', 'simulator'])
    const simulator = await screen.findByRole('button', { name: 'Prøv reglene' })
    expect(simulator.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('button', { name: 'Fortolkningsregler' }).getAttribute('aria-expanded')).toBe('true')
  })

  it('oppsummerer reglene og viser grensene, marginene og kurvene hvert bruksmønster avgjøres av', () => {
    visRegler()
    expect(document.querySelector('.skuff__oppsummering')?.textContent).toBe('3 nivåer · Standardmargin 90 %')
    const grenser = [...document.querySelectorAll('.regler__grense')].map((g) => g.textContent)
    expect(grenser).toEqual([
      'Nivå «lav»under 20',
      'Nivå «middels høy»20–40',
      'Nivå «høy»40 eller mer',
      'SikkerhetsmarginerIngen · 90 % · 99 %',
      'Standard90 %',
      'Måleusikkerhet THC-syre20 %',
      'Kreatinin5 %',
      'Under cut-off50 % høyere',
      'Varsel ved mer enn30 dager',
    ])
    expect(document.querySelector('.regler__monstre')?.textContent).toBe(
      'Kronisk brukOver den gule kurven: vanskelig å avgjøre. Over den røde: nytt inntak.' +
        'EnkeltinntakOver den grønne kurven: vanskelig å avgjøre. Over den gule: nytt inntak.',
    )
  })

  it('viser hver tekstbolk med når den brukes og teksten', () => {
    visRegler()
    const bolker = [...document.querySelectorAll('.regeltekst')]
    expect(bolker).toHaveLength(THC_TEKSTNOKLER.length)
    THC_TEKSTNOKLER.forEach((nokkel, i) => {
      expect(bolker[i]!.querySelector('.regeltekst__nummer')?.textContent).toBe(THC_TEKSTBOLKER[nokkel].tittel)
      expect(bolker[i]!.querySelector('.kommentartekst')?.textContent).toBe(THC_TEKSTER[nokkel])
    })
  })

  it('fortolker i simulatoren med reglene siden viser, og sier hvilke bolker kommentaren består av', async () => {
    const user = userEvent.setup()
    visRegler()
    await user.click(screen.getByRole('button', { name: 'Fortolkningsregler' }))
    await user.click(screen.getByRole('button', { name: 'Prøv reglene' }))
    await user.type(gruppe('Forrige prøve').getByRole('textbox', { name: 'IRCAK' }), '120')
    await user.type(gruppe('Forrige prøve').getByLabelText('Prøvedato'), '2026-02-01')
    await user.type(gruppe('Denne prøven').getByRole('textbox', { name: 'IRCAK' }), '80')
    await user.type(gruppe('Denne prøven').getByLabelText('Prøvedato'), '2026-02-08')

    const forventet = fortolkThc(
      {
        ...tomThcInndata(THC_REGELSETT),
        forrigeVerdi: '120',
        forrigeDato: '2026-02-01',
        aktuellVerdi: '80',
        aktuellDato: '2026-02-08',
      },
      THC_MODELL,
    )
    if (forventet.type !== 'kommentar') throw new Error('Tilfellet skal gi en kommentar.')
    const simulator = within(document.querySelector<HTMLElement>('.simulator')!)
    expect(simulator.getByText(forventet.kommentar)).toBeTruthy()
    expect(simulator.getByRole('status').textContent).toBe(
      `Tekstbolker: ${forventet.bolker.map((b) => THC_TEKSTBOLKER[b].tittel).join(', ')}.`,
    )
    // Kurvene og forklaringen står som i modulen, men det er ingenting å kopiere.
    expect(simulator.getByText('Forklaring')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Kopier/ })).toBeNull()

    await user.click(simulator.getByRole('button', { name: 'Nullstill' }))
    expect(gruppe('Denne prøven').getByRole('textbox', { name: 'IRCAK' })).toHaveProperty('value', '')
  })

  it('viser feilene i stedet for reglene når regelsettet ikke består kontrollen', () => {
    visRegler(thcRegelsettutgave({ regler: { ...THC_REGELSETT, varsel_dager_mellom: 0 } }))
    expect(document.querySelector('.skuff__oppsummering')?.textContent).toBe('Reglene er ikke gyldige')
    expect(document.querySelector('.mangelliste')?.textContent).toMatch(/helt antall døgn/)
    expect(screen.queryByRole('button', { name: 'Prøv reglene' })).toBeNull()
  })
})
