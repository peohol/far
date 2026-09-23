// @vitest-environment jsdom
/**
 * Fortolkningsreglene og simulatoren på analyttsiden, prøvd i en nettleser i
 * minnet. Reglene er dagens rusmiddelregler; at de gir det samme som dagens
 * fortolkning, prøves i `rusparitet.test.ts`.
 */
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { Analyttside } from '../components/analyttside/Analyttside'
import { FaginnholdskildeProvider } from '../components/analyttside/Faginnholdskilde'
import { Scenarioregler, scenarioreglerFor } from '../components/regler/Scenarioregler'
import { TipsLag } from '../components/Tips'
import { FORTOLKNINGSOPPFORINGER, byggKatalog } from '../domain/analyttkatalog'
import type { Faginnholdslager } from '../faginnhold/lagring'
import { TOM_SIDE, type Faginnholdsleser } from '../faginnhold/lesing'

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

function regler(kode: string) {
  const funnet = scenarioreglerFor(katalog.finn(kode)!.fortolkning)
  if (!funnet) throw new Error(`ingen scenarioregler for ${kode}`)
  return funnet
}

function visSide(kode: string) {
  const leser: Faginnholdsleser = {
    lesAnalyttside: vi.fn(async () => TOM_SIDE),
    lesReferanser: vi.fn(async () => []),
    finnInfosider: vi.fn(async () => []),
  }
  const lager = {} as Faginnholdslager
  render(
    <TipsLag>
      <FaginnholdskildeProvider kilde={{ leser, lager, kanRedigere: false }}>
        <Analyttside kode={kode} katalog={katalog} onApneFortolkning={vi.fn()} onLukk={vi.fn()} />
      </FaginnholdskildeProvider>
    </TipsLag>,
  )
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
    render(<Scenarioregler {...regler('AMF1')} />)
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
    render(<Scenarioregler {...regler('KOD')} />)
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
    render(<Scenarioregler {...regler('DIAZ')} />)
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
