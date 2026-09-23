// @vitest-environment jsdom
/**
 * Seksjonene og detaljkortene (`src/components/seksjoner/`), prøvd for seg:
 * åpning og lukking, oppsummeringen, de to nivåene, styringen for siden,
 * søketreff i lukket innhold og nettleserens eget søk.
 */
import { act, cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { Detaljkort, Seksjon } from '../components/seksjoner/Seksjon'
import {
  SeksjonsstyringKilde,
  skufferRundt,
  useSeksjonsstyring,
  type Seksjonsstyring,
} from '../components/seksjoner/Seksjonsstyring'
import { Uthev, Uthevingskilde } from '../components/Uthev'
import { antall, forhandsvisning, ramsOpp } from '../faginnhold/oppsummering'

let redusert = true
const rullet = vi.fn()

beforeAll(() => {
  window.matchMedia = ((sporring: string) => ({
    matches: redusert && sporring.includes('reduce'),
  })) as unknown as typeof window.matchMedia
  Element.prototype.scrollIntoView = function (this: Element) {
    rullet(this)
  }
})

beforeEach(() => {
  redusert = true
  rullet.mockClear()
})

afterEach(cleanup)

/** Venter til bildet etter neste tegning er klart, som styringen gjør før den ruller. */
const nesteBilde = () => act(() => new Promise<void>((ferdig) => requestAnimationFrame(() => ferdig())))

function innholdFor(knapp: HTMLElement): HTMLElement {
  return document.getElementById(knapp.getAttribute('aria-controls')!)!
}

describe('en seksjon', () => {
  it('står lukket med oppsummeringen, og åpnes og lukkes med knappen', async () => {
    const user = userEvent.setup()
    render(
      <Seksjon id="dosering" tittel="Dosering" oppsummering="3 doseringer">
        <p>Innholdet</p>
      </Seksjon>,
    )
    const knapp = screen.getByRole('button', { name: 'Dosering' })
    expect(screen.getByRole('heading', { level: 2, name: 'Dosering' })).toBeTruthy()
    expect(knapp.getAttribute('aria-expanded')).toBe('false')
    // Innholdet står i dokumentet, men skjult på en måte søket i nettleseren finner.
    expect(innholdFor(knapp).getAttribute('hidden')).toBe('until-found')
    expect(screen.getByText('Innholdet')).toBeTruthy()
    expect(screen.getByText('3 doseringer').id).toBe(knapp.getAttribute('aria-describedby'))

    await user.click(knapp)
    expect(knapp.getAttribute('aria-expanded')).toBe('true')
    expect(innholdFor(knapp).hasAttribute('hidden')).toBe(false)
    expect(screen.queryByText('3 doseringer')).toBeNull()
    expect(knapp.hasAttribute('aria-describedby')).toBe(false)

    await user.click(knapp)
    expect(knapp.getAttribute('aria-expanded')).toBe('false')
    expect(innholdFor(knapp).getAttribute('hidden')).toBe('until-found')
  })

  it('skjuler innholdet først når lukkingen har glidd ferdig', async () => {
    redusert = false
    const user = userEvent.setup()
    render(
      <Seksjon id="a" tittel="A" apenFraStart>
        <p>Innholdet</p>
      </Seksjon>,
    )
    const knapp = screen.getByRole('button', { name: 'A' })
    const innhold = innholdFor(knapp)
    expect(innhold.hasAttribute('hidden')).toBe(false)
    await user.click(knapp)
    expect(innhold.hasAttribute('hidden')).toBe(false)
    expect(innhold.parentElement!.hasAttribute('data-glir')).toBe(true)
    act(() => {
      const slutt = new Event('transitionend', { bubbles: true }) as TransitionEvent
      Object.defineProperty(slutt, 'propertyName', { value: 'grid-template-rows' })
      innhold.parentElement!.dispatchEvent(slutt)
    })
    expect(innhold.getAttribute('hidden')).toBe('until-found')
    expect(innhold.parentElement!.hasAttribute('data-glir')).toBe(false)
  })

  it('åpnes med et trykk i hodet, men ikke med knappene der', async () => {
    const user = userEvent.setup()
    const handling = vi.fn()
    render(
      <Seksjon
        id="a"
        tittel="A"
        oppsummering="Kort sagt"
        handlinger={<button onClick={handling}>Rediger</button>}
      >
        <p>Innholdet</p>
      </Seksjon>,
    )
    const knapp = screen.getByRole('button', { name: 'A' })
    await user.click(screen.getByRole('button', { name: 'Rediger' }))
    expect(handling).toHaveBeenCalled()
    expect(knapp.getAttribute('aria-expanded')).toBe('false')
    await user.click(screen.getByText('Kort sagt'))
    expect(knapp.getAttribute('aria-expanded')).toBe('true')
  })

  it('åpnes med tastaturet', async () => {
    const user = userEvent.setup()
    render(
      <Seksjon id="a" tittel="A">
        <p>Innholdet</p>
      </Seksjon>,
    )
    await user.tab()
    const knapp = screen.getByRole('button', { name: 'A' })
    expect(document.activeElement).toBe(knapp)
    await user.keyboard('{Enter}')
    expect(knapp.getAttribute('aria-expanded')).toBe('true')
    await user.keyboard(' ')
    expect(knapp.getAttribute('aria-expanded')).toBe('false')
  })

  it('åpnes når nettleserens eget søk finner noe i den', () => {
    render(
      <Seksjon id="a" tittel="A">
        <Detaljkort id="b" tittel="B">
          <p>Innholdet</p>
        </Detaljkort>
      </Seksjon>,
    )
    const detalj = screen.getByRole('button', { name: 'B', hidden: true })
    act(() => {
      innholdFor(detalj).dispatchEvent(new Event('beforematch'))
      innholdFor(screen.getByRole('button', { name: 'A' })).dispatchEvent(new Event('beforematch'))
    })
    expect(screen.getByRole('button', { name: 'A' }).getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('button', { name: 'B' }).getAttribute('aria-expanded')).toBe('true')
  })

  it('sier hvor mange søketreff den lukkede seksjonen har, uten å fremheve i oppsummeringen', () => {
    render(
      <Uthevingskilde ord={['halv']}>
        <Seksjon id="a" tittel="A" oppsummering={<Uthev tekst="Halveringstid" />}>
          <p>
            <Uthev tekst="Halveringstid og halvparten" />
          </p>
        </Seksjon>
      </Uthevingskilde>,
    )
    const knapp = screen.getByRole('button', { name: 'A' })
    expect(screen.getByText('2 treff')).toBeTruthy()
    expect(knapp.getAttribute('aria-describedby')).toContain(screen.getByText('2 treff').id)
    expect(document.querySelectorAll('mark.sidetreff')).toHaveLength(2)
  })
})

describe('de to nivåene', () => {
  it('har detaljkort med overskrift på nivå 3 i en seksjon', async () => {
    const user = userEvent.setup()
    render(
      <Seksjon id="preparater" tittel="Preparater" apenFraStart>
        <Detaljkort id="tablett" tittel="Tablett" oppsummering="4 preparater">
          <p>Preparatene</p>
        </Detaljkort>
      </Seksjon>,
    )
    const kort = screen.getByRole('group', { name: 'Tablett' })
    expect(within(kort).getByRole('heading', { level: 3 })).toBeTruthy()
    expect(kort.id).toBe('panel-preparater--tablett')
    expect(skufferRundt(screen.getByText('Preparatene'))).toEqual(['preparater', 'preparater/tablett'])
    await user.click(within(kort).getByRole('button', { name: 'Tablett' }))
    expect(screen.getByText('Preparatene').closest('[hidden]')).toBeNull()
  })

  it('stopper en tredje skuff, og detaljkort utenfor en seksjon', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() =>
      render(
        <Seksjon id="a" tittel="A">
          <Seksjon id="b" tittel="B">
            x
          </Seksjon>
        </Seksjon>,
      ),
    ).toThrow(/bare to nivåer/)
    expect(() =>
      render(
        <Detaljkort id="a" tittel="A">
          x
        </Detaljkort>,
      ),
    ).toThrow(/bare to nivåer/)
    expect(() =>
      render(
        <Seksjon id="a" tittel="A">
          <Detaljkort id="b" tittel="B">
            <Detaljkort id="c" tittel="C">
              x
            </Detaljkort>
          </Detaljkort>
        </Seksjon>,
      ),
    ).toThrow(/bare to nivåer/)
    vi.mocked(console.error).mockRestore()
  })
})

describe('styringen for siden', () => {
  let styring: Seksjonsstyring | null = null
  function Fanger() {
    styring = useSeksjonsstyring()
    return null
  }

  function Side({ medKort = true }: { medKort?: boolean }) {
    return (
      <SeksjonsstyringKilde>
        <Fanger />
        <Seksjon id="kinetikk" tittel="Kinetikk">
          {medKort && (
            <Detaljkort id="metabolisme" tittel="Metabolisme">
              <p>
                Via <span data-testid="treff">CYP2D6</span>
              </p>
            </Detaljkort>
          )}
        </Seksjon>
        <Seksjon id="dosering" tittel="Dosering">
          <p>Dosene</p>
        </Seksjon>
      </SeksjonsstyringKilde>
    )
  }

  const apen = (navn: string) =>
    screen.getByRole('button', { name: navn, hidden: true }).getAttribute('aria-expanded') === 'true'

  it('åpner skuffene rundt et treff og ruller det fram', async () => {
    render(<Side />)
    act(() => styring!.apneTil(screen.getByTestId('treff')))
    expect(apen('Kinetikk')).toBe(true)
    expect(apen('Metabolisme')).toBe(true)
    expect(apen('Dosering')).toBe(false)
    // Søket åpner uten å gli, så treffet står der det skal når det rulles fram.
    expect(document.getElementById('panel-kinetikk')!.hasAttribute('data-stille')).toBe(true)
    await nesteBilde()
    expect(rullet).toHaveBeenCalledWith(screen.getByTestId('treff'))
  })

  it('åpner et sted fra en lenke, også når detaljkortet kommer senere', async () => {
    function Senere() {
      const [kort, setKort] = useState(false)
      return (
        <>
          <button onClick={() => setKort(true)}>Hent</button>
          <Side medKort={kort} />
        </>
      )
    }
    const user = userEvent.setup()
    render(<Senere />)
    act(() => styring!.apne(['kinetikk', 'metabolisme']))
    expect(apen('Kinetikk')).toBe(true)
    await user.click(screen.getByRole('button', { name: 'Hent' }))
    expect(apen('Metabolisme')).toBe(true)
    await nesteBilde()
    expect(rullet).toHaveBeenCalledWith(document.getElementById('panel-kinetikk--metabolisme'))
  })

  it('åpner og lukker alle', async () => {
    render(<Side />)
    expect(styring!.alleApne).toBe(false)
    act(() => styring!.settAlle(true))
    expect(['Kinetikk', 'Metabolisme', 'Dosering'].every(apen)).toBe(true)
    expect(styring!.alleApne).toBe(true)
    act(() => styring!.settAlle(false))
    expect(['Kinetikk', 'Metabolisme', 'Dosering'].some(apen)).toBe(false)
  })
})

describe('oppsummeringene', () => {
  it('ramser opp delene uten tomme og gjentatte', () => {
    expect(ramsOpp(['Absorpsjon', '', null, ' Metabolisme ', 'Absorpsjon', false])).toBe('Absorpsjon · Metabolisme')
    expect(ramsOpp([])).toBe('')
  })

  it('kutter en forhåndsvisning ved et ordskille og viser at noe er utelatt', () => {
    expect(forhandsvisning('Kort  tekst.')).toBe('Kort tekst.')
    const lang = 'Metaboliseres i leveren, hovedsakelig via CYP2D6, til en aktiv metabolitt med lengre halveringstid.'
    expect(forhandsvisning(lang, 40)).toBe('Metaboliseres i leveren, hovedsakelig …')
  })

  it('bøyer antallet', () => {
    expect(antall(1, 'rad', 'rader')).toBe('1 rad')
    expect(antall(3, 'rad', 'rader')).toBe('3 rader')
  })
})
