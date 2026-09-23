// @vitest-environment jsdom
/**
 * Fortolkningsreglene og simulatoren på analyttsiden, prøvd i en nettleser i
 * minnet. Reglene er de publiserte rusmiddelreglene (grunnlaget de ble
 * importert fra); at de gir det samme som den opprinnelige fortolkningen,
 * prøves i `rusparitet.test.ts`.
 */
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { Analyttside } from '../components/analyttside/Analyttside'
import { FaginnholdskildeProvider } from '../components/analyttside/Faginnholdskilde'
import { Scenarioregler } from '../components/regler/Scenarioregler'
import { ScenarioreglerProvider, type Scenarioreglerkilde } from '../components/regler/Scenarioreglerkilde'
import { TipsLag } from '../components/Tips'
import { FORTOLKNINGSOPPFORINGER, byggKatalog } from '../domain/analyttkatalog'
import type { Faginnholdslager } from '../faginnhold/lagring'
import { rusModulFor } from '../domain/rus'
import { TOM_SIDE, type Faginnholdsleser } from '../faginnhold/lesing'
import { tilScenarioregler } from '../faginnhold/scenarioregler'
import { RUS_KOMMENTARER, rusRegelsett, rusScenarioregeldata } from './hjelp/rusgrunnlag'

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

/** Reglene for modulen koden fortolkes i. */
function regler(kode: string) {
  const modul = rusModulFor(katalog.finn(kode)!.fortolkning)
  if (!modul) throw new Error(`ingen rusmiddelmodul for ${kode}`)
  return { modul, regelsett: rusRegelsett(modul.id), kommentarer: RUS_KOMMENTARER }
}

const HENTET: Scenarioreglerkilde = {
  tilstand: { status: 'klar', regler: tilScenarioregler(rusScenarioregeldata()) },
  provIgjen: () => {},
}

function visSide(kode: string, { kilde = HENTET, sted }: { kilde?: Scenarioreglerkilde; sted?: readonly string[] } = {}) {
  const leser: Faginnholdsleser = {
    lesAnalyttside: vi.fn(async () => TOM_SIDE),
    lesReferanser: vi.fn(async () => []),
    finnInfosider: vi.fn(async () => []),
    finnIntervallregelsett: vi.fn(async () => null),
    lesIntervallregelsett: vi.fn(async () => []),
    lesKommentarer: vi.fn(async () => []),
    lesReferanseomrader: vi.fn(async () => new Map()),
    lesHistorikk: vi.fn(async () => {
      throw new Error('ikke i bruk')
    }),
  }
  const lager = {} as Faginnholdslager
  render(
    <TipsLag>
      <FaginnholdskildeProvider kilde={{ leser, lager, kanRedigere: false }}>
        <ScenarioreglerProvider kilde={kilde}>
          <Analyttside kode={kode} sted={sted} katalog={katalog} onApneFortolkning={vi.fn()} onLukk={vi.fn()} />
        </ScenarioreglerProvider>
      </FaginnholdskildeProvider>
    </TipsLag>,
  )
}

/** Reglene for modulen, med seksjonen og simulatoren åpnet slik brukeren gjør det. */
async function visSimulator(user: ReturnType<typeof userEvent.setup>, kode: string) {
  render(<Scenarioregler {...regler(kode)} />)
  await user.click(screen.getByRole('button', { name: 'Fortolkningsregler' }))
  await user.click(screen.getByRole('button', { name: 'Prøv reglene' }))
}

const truffet = () => document.querySelector('.scenario[aria-current="true"]')
const status = () => screen.getByRole('status').textContent

describe('på analyttsiden', () => {
  it('står reglene på sidene til hver analytt i modulen, og ikke på andre sider', async () => {
    visSide('OXA')
    expect(await screen.findByRole('heading', { level: 2, name: 'Fortolkningsregler' })).toBeTruthy()
    cleanup()
    visSide('NOR')
    await screen.findByText('Denne siden har ikke fått faginnhold ennå.')
    expect(screen.queryByRole('heading', { level: 2, name: 'Fortolkningsregler' })).toBeNull()
  })

  it('viser ingen regler før de er hentet, eller når de ikke kunne hentes', async () => {
    for (const tilstand of [{ status: 'laster' }, { status: 'feil', melding: 'Nede.' }] as const) {
      visSide('OXA', { kilde: { tilstand, provIgjen: () => {} } })
      await screen.findByRole('heading', { level: 1 })
      expect(screen.queryByRole('heading', { level: 2, name: 'Fortolkningsregler' })).toBeNull()
      cleanup()
    }
  })

  it('står lukket, med antall scenarier og grensene i oppsummeringen', async () => {
    const user = userEvent.setup()
    render(<Scenarioregler {...regler('DIAZ')} />)
    const knapp = screen.getByRole('button', { name: 'Fortolkningsregler' })
    expect(knapp.getAttribute('aria-expanded')).toBe('false')
    expect(document.querySelector('.skuff__oppsummering')?.textContent).toBe(
      '8 scenarier · Oksazepam som andel av diazepam + N-desmetyldiazepam: 10 %',
    )
    await user.click(knapp)
    expect(knapp.getAttribute('aria-expanded')).toBe('true')
    // Kommentartekstene og simulatoren er detaljkort i seksjonen, lukket til de åpnes.
    for (const navn of ['Kommentartekstene', 'Prøv reglene']) {
      expect(screen.getByRole('button', { name: navn }).getAttribute('aria-expanded')).toBe('false')
    }
    expect(document.getElementById('panel-fortolkning--simulator')).toBeTruthy()
  })

  it('åpner simulatoren fra en direktelenke', async () => {
    visSide('OXA', { sted: ['fortolkning', 'simulator'] })
    const simulator = await screen.findByRole('button', { name: 'Prøv reglene' })
    expect(simulator.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('button', { name: 'Fortolkningsregler' }).getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('button', { name: 'Åpne alle' })).toBeTruthy()
  })

  it('viser en modul med én analytt uten simulator', () => {
    render(<Scenarioregler {...regler('MDO')} />)
    expect(document.querySelectorAll('.scenario')).toHaveLength(1)
    expect(screen.queryByRole('heading', { name: 'Prøv reglene' })).toBeNull()
  })
})

describe('reglene', () => {
  it('viser hvert scenario med hva som er påvist, vilkårene og hvor kommentarene havner', () => {
    render(<Scenarioregler {...regler('DIAZ')} />)
    const rader = [...document.querySelectorAll('.scenario')]
    expect(rader).toHaveLength(8)
    expect(screen.getByText('10 %')).toBeTruthy()
    const felles = rader[6]!
    expect(felles.textContent).toContain('Påvist DIAZ, DMI og OXA')
    expect(felles.textContent).toContain('OXA / (DIAZ + DMI) ≤ 10 %')
    expect(felles.textContent).toContain('Hovedkommentar: tekst 5 på DIAZ')
    expect(felles.textContent).toContain('Tilleggskommentar: tekst 6 på DMI og OXA')
    expect(rader[0]!.textContent).toContain('Ikke påvist DMI og OXA')
  })

  it('viser gråsonen for kodein og morfin som manuell vurdering', () => {
    render(<Scenarioregler {...regler('KOD')} />)
    const grasone = [...document.querySelectorAll('.scenario')].find((r) =>
      r.textContent?.includes('Vurder manuelt'),
    )!
    expect(grasone.textContent).toContain('MOR / KOD ≥ 20 %')
    expect(grasone.textContent).toContain('MOR / KOD ≤ 100 %')
    expect(grasone.textContent).toContain('Morfin = 20–100 % av kodein. Vurder manuelt.')
  })
})

describe('simulatoren', () => {
  it('ber om avkrysning, og viser scenariet og hvor kommentarene limes inn', async () => {
    const user = userEvent.setup()
    await visSimulator(user, 'AMF1')
    expect(status()).toBe('Ingen scenario gjelder ennå.')
    expect(screen.getByText('Kryss av for hvilke av analyttene som er påvist.')).toBeTruthy()

    await user.click(screen.getByRole('checkbox', { name: /Metamfetamin/ }))
    await user.click(screen.getByRole('checkbox', { name: /^Amfetamin/ }))
    expect(status()).toBe('Scenario 3 gjelder.')
    expect(truffet()?.textContent).toContain('Scenario 3')

    // Hovedkommentaren på metamfetamin, tilleggskommentaren på amfetamin.
    const plasseringer = [...document.querySelectorAll('.simulator .plassering')]
    const vist = plasseringer.map((p) => [
      p.querySelector('.plassering__merke')?.textContent,
      p.querySelector('.plassering__koder')?.textContent,
    ])
    expect(vist).toEqual([
      ['Hovedkommentar', 'MAF1'],
      ['Tilleggskommentar', 'AMF1'],
    ])
  })

  it('regner forholdstallet, og følger grensen rett på og rett over', async () => {
    const user = userEvent.setup()
    await visSimulator(user, 'KOD')
    await user.click(screen.getByRole('checkbox', { name: /Kodein/ }))
    await user.click(screen.getByRole('checkbox', { name: /Morfin/ }))
    expect(screen.getByText('Fyll inn de målte konsentrasjonene, så avgjøres regelen.')).toBeTruthy()

    const [kodein, morfin] = screen.getAllByRole('textbox')
    await user.type(kodein!, '1000')
    await user.type(morfin!, '200')
    expect(status()).toMatch(/^Scenario \d gjelder, MOR \/ KOD = 20 %\.$/)
    expect(truffet()?.textContent).toContain('Vurder manuelt')
    expect(screen.getByRole('heading', { name: 'Til plenum' })).toBeTruthy()

    await user.type(morfin!, '0')
    expect(status()).toMatch(/MOR \/ KOD = 200 %/)
    expect(truffet()?.textContent).toContain('Hovedkommentar for morfin')

    await user.click(screen.getByRole('button', { name: 'Nullstill' }))
    expect(status()).toBe('Ingen scenario gjelder ennå.')
    expect(truffet()).toBeNull()
  })

  it('bruker den samme grensen som reglene, og ber om tall bare når alle tre er påvist', async () => {
    const user = userEvent.setup()
    await visSimulator(user, 'DIAZ')
    await user.click(screen.getByRole('checkbox', { name: /^Diazepam/ }))
    await user.click(screen.getByRole('checkbox', { name: /Oksazepam/ }))
    expect(screen.queryAllByRole('textbox')).toHaveLength(0)
    expect(status()).toBe('Scenario 5 gjelder.')

    await user.click(screen.getByRole('checkbox', { name: /desmetyldiazepam/i }))
    const [diaz, dmi, oxa] = screen.getAllByRole('textbox')
    await user.type(diaz!, '400')
    await user.type(dmi!, '600')
    await user.type(oxa!, '100')
    expect(status()).toBe('Scenario 7 gjelder, OXA / (DIAZ + DMI) = 10 %.')
    await user.clear(oxa!)
    await user.type(oxa!, '101')
    expect(status()).toBe('Scenario 8 gjelder, OXA / (DIAZ + DMI) = 10,1 %.')
  })
})
