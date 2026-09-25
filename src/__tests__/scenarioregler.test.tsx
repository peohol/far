// @vitest-environment jsdom
/**
 * Fortolkningsreglene og simulatoren på analyttsiden, prøvd i en nettleser i
 * minnet. Reglene er de publiserte rusmiddelreglene (grunnlaget de ble
 * importert fra); at de gir det samme som den opprinnelige fortolkningen,
 * prøves i `rusparitet.test.ts`.
 */
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { Analyttside } from '../components/analyttside/Analyttside'
import { FaginnholdskildeProvider } from '../components/analyttside/Faginnholdskilde'
import { Scenarioregler } from '../components/regler/Scenarioregler'
import { ScenarioreglerProvider, type Scenarioreglerkilde } from '../components/regler/Scenarioreglerkilde'
import { TipsLag } from '../components/Tips'
import { FORTOLKNINGSOPPFORINGER, byggKatalog } from '../domain/analyttkatalog'
import { Samtidighetskonflikt, type Faginnholdslager } from '../faginnhold/lagring'
import { rusModulFor } from '../domain/rus'
import { TOM_SIDE, type Faginnholdsleser, type Scenarioregelsettutgave, type Utgave } from '../faginnhold/lesing'
import type { Objektstatus, Tilstand } from '../faginnhold/modell'
import type { Scenarioregelsett } from '../domain/scenario'
import { tilScenarioregler } from '../faginnhold/scenarioregler'
import { RUS_GRUNNLAG, RUS_KOMMENTARER, rusRegelsett, rusScenarioregeldata } from './hjelp/rusgrunnlag'
import { scenariokommentarer } from '../regler/scenarioredigering'

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Element.prototype.scrollIntoView ??= function () {}
  window.scrollTo = () => {}
  // jsdom har `<dialog>`, men ikke det modale laget.
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  }
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
    lesStoffside: vi.fn(async () => TOM_SIDE),
    lesStoffsidenavn: vi.fn(async () => []),
    lesReferanser: vi.fn(async () => []),
    finnInfosider: vi.fn(async () => []),
    finnIntervallregelsett: vi.fn(async () => null),
    finnScenarioregelsett: vi.fn(async () => null),
    lesIntervallregelsett: vi.fn(async () => []),
    lesThcRegelsett: vi.fn(async () => null),
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
    expect(screen.queryByRole('button', { name: 'Åpne alle' })).toBeNull()
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

/* --- Redigeringen ------------------------------------------------------- */

describe('redigeringen', () => {
  const REGELSETT_ID = 'regelsett/diazepamgruppen'
  const GRENSE = 'Oksazepam som andel av diazepam + N-desmetyldiazepam'

  function utgave<T>(id: string, innhold: T, revisjon = 1, publisert: number | null = 1): Utgave<T> {
    return {
      id,
      revisjon,
      publisert_revisjon: publisert,
      innhold,
      endret_av_fornavn: 'Rita',
      endret_av_etternavn: 'Redaktør',
      endret_kl: '2026-09-25T08:00:00Z',
    }
  }

  /**
   * Diazepamgruppen slik den er importert, publisert i revisjon 1. Utkastet
   * (revisjon `revisjon`) har grensen flyttet til 11 %.
   */
  function scenarioutgave(tilstand: Tilstand, revisjon = 2): Scenarioregelsettutgave {
    const r: Scenarioregelsett = rusRegelsett('diazepamgruppen')
    if (tilstand === 'utkast') r.parametere[0]!.verdi = 0.11
    const ider = new Set(scenariokommentarer(r))
    return {
      regelsett: utgave(REGELSETT_ID, r, tilstand === 'utkast' ? revisjon : 1, 1),
      kommentarer: RUS_GRUNNLAG.kommentarer.filter((k) => ider.has(k.id)).map((k) => utgave(k.id, k.innhold)),
    }
  }

  const status = (id: string, revisjon = 3): Objektstatus => ({
    id,
    type: 'scenarioregelsett',
    revisjon,
    endret_kl: null,
    publisert_revisjon: null,
    publisert_kl: null,
  })

  async function visRedigering() {
    const user = userEvent.setup()
    const leser: Faginnholdsleser = {
      lesAnalyttside: vi.fn(async () => TOM_SIDE),
      lesStoffside: vi.fn(async () => TOM_SIDE),
      lesStoffsidenavn: vi.fn(async () => []),
      lesReferanser: vi.fn(async () => []),
      finnInfosider: vi.fn(async () => []),
      finnIntervallregelsett: vi.fn(async () => null),
      finnScenarioregelsett: vi.fn(async (_modul: string, tilstand: Tilstand) => scenarioutgave(tilstand)),
      lesIntervallregelsett: vi.fn(async () => []),
      lesThcRegelsett: vi.fn(async () => null),
      lesKommentarer: vi.fn(async () => []),
      lesReferanseomrader: vi.fn(async () => new Map()),
      lesHistorikk: vi.fn(async () => ({ hendelser: [], revisjoner: [] })),
    }
    const lager = {
      lagreScenarioregelsett: vi.fn(async (id: string) => status(id)),
      publiserUtkast: vi.fn(async (id: string) => status(id)),
    } as unknown as Faginnholdslager
    const kilde: Scenarioreglerkilde = { ...HENTET, provIgjen: vi.fn() }
    render(
      <TipsLag>
        <FaginnholdskildeProvider kilde={{ leser, lager, kanRedigere: true }}>
          <ScenarioreglerProvider kilde={kilde}>
            <Analyttside kode="OXA" katalog={katalog} onApneFortolkning={vi.fn()} onLukk={vi.fn()} />
          </ScenarioreglerProvider>
        </FaginnholdskildeProvider>
      </TipsLag>,
    )
    await user.click(await screen.findByRole('button', { name: 'Rediger' }))
    // Utkastet er hentet når grensen i det står i oppsummeringen.
    await screen.findByText(`8 scenarier · ${GRENSE}: 11 %`)
    const seksjon = screen.getByRole('region', { name: 'Fortolkningsregler' })
    await user.click(within(seksjon).getByRole('button', { name: 'Fortolkningsregler' }))
    return { user, leser, lager, kilde, seksjon }
  }

  async function apneSkjema(user: ReturnType<typeof userEvent.setup>, seksjon: HTMLElement) {
    await user.click(within(seksjon).getByRole('button', { name: 'Rediger reglene' }))
    return screen.getByRole('form', { name: 'Rediger: Fortolkningsreglene for Diazepam + N-desmetyldiazepam + oksazepam' })
  }

  it('viser utkastet, hva som ikke er publisert, og ingen redigering for vanlige brukere', async () => {
    const { seksjon } = await visRedigering()
    expect(within(seksjon).getByText(`Ikke publisert: Grenser: Grense 1.`)).toBeTruthy()
    expect(within(seksjon).getByRole('button', { name: /^Sist redigert av Rita Redaktør/ })).toBeTruthy()
    expect(within(seksjon).getByRole('button', { name: 'Historikken for hver kommentar' })).toBeTruthy()
    cleanup()
    visSide('OXA')
    await screen.findByRole('heading', { level: 2, name: 'Fortolkningsregler' })
    expect(screen.queryByRole('button', { name: 'Rediger reglene' })).toBeNull()
  })

  it('lagrer en flyttet grense og en egen tekst som utkast, og simulatoren prøver skjemaet på grensen', async () => {
    const { user, lager, seksjon } = await visRedigering()
    const skjema = await apneSkjema(user, seksjon)

    const grense = within(skjema).getByLabelText(`${GRENSE} i prosent`)
    expect((grense as HTMLInputElement).value).toBe('11')
    await user.clear(grense)
    await user.type(grense, '12')

    // Hovedkommentaren i scenario 5 deler teksten med andre, og det sies.
    const scenario5 = within(skjema).getByRole('group', { name: 'Scenario 5' })
    const hoved = within(scenario5).getByRole('group', { name: 'Hovedkommentar · limes inn på DIAZ' })
    expect(within(hoved).getByText('Samme tekst brukes også i scenario 1, 4 og 8. Endringen gjelder alle.')).toBeTruthy()
    await user.click(within(hoved).getByRole('button', { name: 'Gi kommentaren egen tekst' }))
    expect(within(hoved).queryByText(/Samme tekst brukes også/)).toBeNull()
    // Valget sier hvilken tekst som er hvilken, og hvor hver brukes.
    const valg = [...within(hoved).getByLabelText('Bruker teksten').querySelectorAll('option')].map((o) => o.textContent)
    expect(valg[0]).toMatch(/^Tekst 1 \(scenario 1, 4 og 8\): 3500 nmol\/L/)
    expect(valg.filter((v) => /^Tekst \d \(scenario 5\): 3500 nmol\/L/.test(v ?? ''))).toHaveLength(1)
    expect(valg).toHaveLength(7)
    const tekst = within(hoved).getByLabelText('Kommentartekst')
    await user.clear(tekst)
    await user.type(tekst, ' Syntetisk egen tekst. ')

    // Simulatoren følger grensen i skjemaet, rett på og rett over.
    await user.click(within(skjema).getByRole('button', { name: 'Prøv utkastet' }))
    const simulator = within(skjema).getByRole('group', { name: 'Prøv utkastet' })
    for (const navn of [/^Diazepam/, /desmetyldiazepam/i, /Oksazepam/]) {
      await user.click(within(simulator).getByRole('checkbox', { name: navn }))
    }
    const [diaz, dmi, oxa] = within(simulator).getAllByRole('textbox')
    await user.type(diaz!, '400')
    await user.type(dmi!, '600')
    await user.type(oxa!, '120')
    const scenario = () => within(simulator).getByRole('status').textContent
    expect(scenario()).toBe('Scenario 7 gjelder, OXA / (DIAZ + DMI) = 12 %.')
    await user.type(oxa!, ',1')
    expect(scenario()).toBe('Scenario 8 gjelder, OXA / (DIAZ + DMI) = 12,01 %.')

    await user.click(within(skjema).getByRole('button', { name: 'Lagre utkast' }))
    await waitFor(() => expect(lager.lagreScenarioregelsett).toHaveBeenCalled())
    const [id, revisjon, innhold, kommentarer] = vi.mocked(lager.lagreScenarioregelsett).mock.calls[0]!
    expect([id, revisjon]).toEqual([REGELSETT_ID, 2])
    const ny = kommentarer[0]!.id
    const forventet = rusRegelsett('diazepamgruppen')
    forventet.parametere[0]!.verdi = 0.12
    const u = forventet.scenarier.find((s) => s.nokkel === 'diaz_oxa')!.utfall
    if (u.type === 'kommentarer') u.plasseringer[0]!.kommentar = ny
    expect(innhold).toEqual(forventet)
    // Den nye teksten lagres som en ny kommentar; de andre er urørt.
    expect(kommentarer).toEqual([
      {
        id: ny,
        revisjon: null,
        innhold: {
          navn: 'Diazepam + N-desmetyldiazepam + oksazepam – påvist DIAZ + OXA – Hovedkommentar',
          tekst: 'Syntetisk egen tekst.',
          plassholdere: [],
        },
      },
    ])
  })

  it('lagrer ikke et utkast med en tom tekst, og sier hvilken', async () => {
    const { user, lager, seksjon } = await visRedigering()
    const skjema = await apneSkjema(user, seksjon)
    const scenario3 = within(skjema).getByRole('group', { name: 'Scenario 3' })
    await user.clear(within(scenario3).getByLabelText('Kommentartekst'))
    await user.click(within(skjema).getByRole('button', { name: 'Lagre utkast' }))
    const varsel = within(skjema).getByRole('alert')
    expect(varsel.textContent).toContain('Tekst 3: Kommentaren mangler tekst.')
    expect(lager.lagreScenarioregelsett).not.toHaveBeenCalled()
  })

  it('lar brukeren sammenligne og velge ved en konflikt, uten å miste det som er gjort', async () => {
    const { user, lager, leser, seksjon } = await visRedigering()
    vi.mocked(lager.lagreScenarioregelsett).mockRejectedValueOnce(new Samtidighetskonflikt(3, 2))
    vi.mocked(leser.finnScenarioregelsett).mockResolvedValueOnce(scenarioutgave('publisert'))
    const skjema = await apneSkjema(user, seksjon)
    const grense = within(skjema).getByLabelText(`${GRENSE} i prosent`)
    await user.clear(grense)
    await user.type(grense, '12,5')
    await user.click(within(skjema).getByRole('button', { name: 'Lagre utkast' }))

    expect(await within(skjema).findByText(/Noen andre har lagret reglene/)).toBeTruthy()
    expect((grense as HTMLInputElement).value).toBe('12,5')
    await user.click(within(skjema).getByRole('button', { name: 'Sammenlign med deres' }))
    expect(await within(skjema).findByText('revisjon 1', { exact: false })).toBeTruthy()
    expect(skjema.querySelector('.regelredigering__konflikt')!.textContent).toContain('12,5 %')

    await user.click(within(skjema).getByRole('button', { name: 'Lagre mine over deres' }))
    await waitFor(() => expect(lager.lagreScenarioregelsett).toHaveBeenCalledTimes(2))
    const [id, revisjon, innhold] = vi.mocked(lager.lagreScenarioregelsett).mock.calls[1]!
    expect([id, revisjon]).toEqual([REGELSETT_ID, 1])
    expect(innhold.parametere[0]!.verdi).toBe(0.125)
  })

  it('publiserer regelsettet med det som er endret, og henter reglene fortolkningen bruker på nytt', async () => {
    const { user, lager, kilde } = await visRedigering()
    await user.click(screen.getByRole('button', { name: 'Publiser' }))
    const vindu = screen.getByRole('dialog', { name: 'Publiser endringene' })
    expect(within(vindu).getByRole('listitem').textContent).toBe(
      'Fortolkningsreglene for Diazepam + N-desmetyldiazepam + oksazepam (Grenser: Grense 1)',
    )
    await user.click(within(vindu).getByRole('button', { name: 'Publiser nå' }))
    await waitFor(() => expect(lager.publiserUtkast).toHaveBeenCalledWith(REGELSETT_ID, 2))
    await waitFor(() => expect(kilde.provIgjen).toHaveBeenCalled())
  })
})
