// @vitest-environment jsdom
/**
 * Seksjonene og detaljkortene (`src/components/seksjoner/`), prøvd for seg:
 * åpning og lukking, oppsummeringen, de to nivåene, styringen for siden,
 * regelen om én åpen skuff per nivå, rullingen, søketreff i lukket innhold og
 * nettleserens eget søk.
 */
import { readFileSync } from 'node:fs'
import { act, cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { useRef, useState } from 'react'
import { Detaljkort, Seksjon } from '../components/seksjoner/Seksjon'
import {
  SeksjonsstyringKilde,
  skufferRundt,
  useFastSted,
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
  Element.prototype.scrollIntoView = function (this: Element, valg?: boolean | ScrollIntoViewOptions) {
    rullet(this, valg)
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

  it('åpnes med et trykk i hodet, men ikke med knappene i overskriften', async () => {
    const user = userEvent.setup()
    const pille = vi.fn()
    render(
      <Seksjon id="a" tittel="A" oppsummering="Kort sagt" tittelTillegg={<button onClick={pille}>1</button>}>
        <p>Innholdet</p>
      </Seksjon>,
    )
    const knapp = screen.getByRole('button', { name: 'A' })
    await user.click(screen.getByRole('button', { name: '1' }))
    expect(pille).toHaveBeenCalled()
    expect(knapp.getAttribute('aria-expanded')).toBe('false')
    await user.click(screen.getByText('Kort sagt'))
    expect(knapp.getAttribute('aria-expanded')).toBe('true')
  })

  it('åpnes når en handling i hodet trykkes, siden den virker på innholdet', async () => {
    const user = userEvent.setup()
    const handling = vi.fn()
    render(
      <Seksjon id="a" tittel="A" handlinger={<button onClick={handling}>Rediger</button>}>
        <p>Innholdet</p>
      </Seksjon>,
    )
    const knapp = screen.getByRole('button', { name: 'A' })
    await user.click(screen.getByRole('button', { name: 'Rediger' }))
    expect(handling).toHaveBeenCalledTimes(1)
    expect(knapp.getAttribute('aria-expanded')).toBe('true')
    // En åpen skuff lukkes ikke av handlingen.
    await user.click(screen.getByRole('button', { name: 'Rediger' }))
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
    expect(rullet).toHaveBeenCalledWith(screen.getByTestId('treff'), expect.objectContaining({ block: 'center' }))
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
    expect(rullet).toHaveBeenCalledWith(
      document.getElementById('panel-kinetikk--metabolisme'),
      expect.objectContaining({ block: 'start' }),
    )
  })

  /** Et område som alltid står fram, som «Viktige data». */
  function Fast() {
    const ref = useRef<HTMLDivElement>(null)
    useFastSted('viktige', ref)
    return (
      <div ref={ref} data-testid="fast">
        Nøkkeltallene
      </div>
    )
  }

  it('ruller til et sted som alltid står fram, uten å åpne eller lukke noe', async () => {
    const user = userEvent.setup()
    function Hel() {
      return (
        <SeksjonsstyringKilde>
          <Fanger />
          <Fast />
          <Seksjon id="dosering" tittel="Dosering">
            <p>Dosene</p>
          </Seksjon>
        </SeksjonsstyringKilde>
      )
    }
    render(<Hel />)
    await user.click(screen.getByRole('button', { name: 'Dosering' }))
    rullet.mockClear()
    act(() => styring!.apne(['viktige']))
    await nesteBilde()
    expect(rullet).toHaveBeenCalledWith(screen.getByTestId('fast'), expect.objectContaining({ block: 'start' }))
    // Seksjonen som sto åpen, står fortsatt åpen.
    expect(apen('Dosering')).toBe(true)
  })

  it('ruller til stedet som alltid står fram når det kommer etter lenken', async () => {
    function Senere() {
      const [vis, setVis] = useState(false)
      return (
        <SeksjonsstyringKilde>
          <Fanger />
          <button onClick={() => setVis(true)}>Hent</button>
          {vis && <Fast />}
        </SeksjonsstyringKilde>
      )
    }
    const user = userEvent.setup()
    render(<Senere />)
    act(() => styring!.apne(['viktige']))
    await nesteBilde()
    expect(rullet).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Hent' }))
    await nesteBilde()
    expect(rullet).toHaveBeenCalledWith(screen.getByTestId('fast'), expect.objectContaining({ block: 'start' }))
  })

  it('har ingen «åpne alle»', () => {
    render(<Side />)
    expect(styring).not.toHaveProperty('settAlle')
    expect(styring).not.toHaveProperty('alleApne')
  })
})

describe('én åpen skuff per nivå', () => {
  let styring: Seksjonsstyring | null = null
  function Fanger() {
    styring = useSeksjonsstyring()
    return null
  }

  /** Tre seksjoner; Kinetikk har tre detaljkort. Viktige data står åpen fra start. */
  function Side({ utenStyring = false }: { utenStyring?: boolean }) {
    const seksjoner = (
      <>
        <Fanger />
        <Seksjon id="viktige" tittel="Viktige" apenFraStart>
          <p>Kjernen</p>
        </Seksjon>
        <Seksjon id="kinetikk" tittel="Kinetikk">
          <Detaljkort id="absorpsjon" tittel="Absorpsjon">
            <p>Opptaket</p>
          </Detaljkort>
          <Detaljkort id="metabolisme" tittel="Metabolisme">
            <p>
              Via <span data-testid="treff">CYP2D6</span>
            </p>
          </Detaljkort>
          <Detaljkort id="eliminasjon" tittel="Eliminasjon">
            <p>Utskillelsen</p>
          </Detaljkort>
        </Seksjon>
        <Seksjon id="dosering" tittel="Dosering">
          <p>Dosene</p>
        </Seksjon>
      </>
    )
    return utenStyring ? seksjoner : <SeksjonsstyringKilde>{seksjoner}</SeksjonsstyringKilde>
  }

  const knapp = (navn: string) => screen.getByRole('button', { name: navn, hidden: true })
  /**
   * Skuffene som står åpne og synlige, i rekkefølgen på siden. Et detaljkort
   * husker at det sto åpent mens seksjonen er lukket, men står da skjult.
   */
  const apne = () =>
    ['Viktige', 'Kinetikk', 'Absorpsjon', 'Metabolisme', 'Eliminasjon', 'Dosering'].filter(
      (n) => knapp(n).getAttribute('aria-expanded') === 'true' && !knapp(n).closest('[hidden]'),
    )

  it('lukker de andre hovedseksjonene når en åpnes', async () => {
    const user = userEvent.setup()
    render(<Side />)
    expect(apne()).toEqual(['Viktige'])
    await user.click(knapp('Kinetikk'))
    expect(apne()).toEqual(['Kinetikk'])
    await user.click(knapp('Dosering'))
    expect(apne()).toEqual(['Dosering'])
    // Den som lukker den åpne, får alle lukket.
    await user.click(knapp('Dosering'))
    expect(apne()).toEqual([])
  })

  it('lukker de andre detaljkortene i seksjonen, og lar seksjonen stå åpen', async () => {
    const user = userEvent.setup()
    render(<Side />)
    await user.click(knapp('Kinetikk'))
    await user.click(knapp('Absorpsjon'))
    expect(apne()).toEqual(['Kinetikk', 'Absorpsjon'])
    await user.click(knapp('Eliminasjon'))
    expect(apne()).toEqual(['Kinetikk', 'Eliminasjon'])
    await user.click(knapp('Metabolisme'))
    expect(apne()).toEqual(['Kinetikk', 'Metabolisme'])
    // Kortet som sto åpent, står åpent igjen når seksjonen åpnes på nytt.
    await user.click(knapp('Dosering'))
    expect(apne()).toEqual(['Dosering'])
    await user.click(knapp('Kinetikk'))
    expect(apne()).toEqual(['Kinetikk', 'Metabolisme'])
  })

  it('følger regelen også i en seksjon uten styring for siden', async () => {
    const user = userEvent.setup()
    render(<Side utenStyring />)
    await user.click(knapp('Kinetikk'))
    await user.click(knapp('Absorpsjon'))
    await user.click(knapp('Eliminasjon'))
    expect(knapp('Absorpsjon').getAttribute('aria-expanded')).toBe('false')
    expect(knapp('Eliminasjon').getAttribute('aria-expanded')).toBe('true')
  })

  it('ender i samme tilstand når en direktelenke åpner et sted', () => {
    render(<Side />)
    act(() => styring!.apne(['kinetikk', 'eliminasjon']))
    expect(apne()).toEqual(['Kinetikk', 'Eliminasjon'])
    act(() => styring!.apne(['kinetikk', 'absorpsjon']))
    expect(apne()).toEqual(['Kinetikk', 'Absorpsjon'])
    act(() => styring!.apne(['dosering']))
    expect(apne()).toEqual(['Dosering'])
  })

  it('ender i samme tilstand når søket åpner skuffene rundt et treff', async () => {
    const user = userEvent.setup()
    render(<Side />)
    await user.click(knapp('Kinetikk'))
    await user.click(knapp('Absorpsjon'))
    await user.click(knapp('Dosering'))
    act(() => styring!.apneTil(screen.getByTestId('treff')))
    expect(apne()).toEqual(['Kinetikk', 'Metabolisme'])
  })

  it('ender i samme tilstand når nettleserens eget søk åpner en skuff, uten å rulle selv', async () => {
    const user = userEvent.setup()
    render(<Side />)
    await user.click(knapp('Kinetikk'))
    await user.click(knapp('Absorpsjon'))
    await user.click(knapp('Dosering'))
    await nesteBilde()
    rullet.mockClear()
    act(() => {
      innholdFor(knapp('Metabolisme')).dispatchEvent(new Event('beforematch'))
    })
    expect(apne()).toEqual(['Kinetikk', 'Metabolisme'])
    // Søsknene er lukket straks, før nettleseren ruller til treffet.
    expect(innholdFor(knapp('Dosering')).getAttribute('hidden')).toBe('until-found')
    expect(innholdFor(knapp('Absorpsjon')).getAttribute('hidden')).toBe('until-found')
    await nesteBilde()
    expect(rullet).not.toHaveBeenCalled()
  })

  it('lar den første som står åpen fra start, være den åpne, og lukker den når en annen åpnes', () => {
    render(
      <SeksjonsstyringKilde>
        <Fanger />
        <Seksjon id="a" tittel="A" apenFraStart>
          x
        </Seksjon>
        <Seksjon id="b" tittel="B" apenFraStart>
          y
        </Seksjon>
      </SeksjonsstyringKilde>,
    )
    expect(knapp('A').getAttribute('aria-expanded')).toBe('true')
    expect(knapp('B').getAttribute('aria-expanded')).toBe('false')
    act(() => styring!.apne(['b']))
    expect(knapp('A').getAttribute('aria-expanded')).toBe('false')
    expect(knapp('B').getAttribute('aria-expanded')).toBe('true')
  })
})

describe('rullingen', () => {
  const knapp = (navn: string) => screen.getByRole('button', { name: navn, hidden: true })
  const rulletTil = vi.fn()
  const VINDU = 800
  const RULLET = 1000
  /** Toppmenyen over og luften under: det synlige feltet er 800 − 88 − 28 = 684 px høyt. */
  const OVER = 88
  const UNDER = 28

  beforeEach(() => {
    rulletTil.mockClear()
    window.scrollTo = rulletTil as unknown as typeof window.scrollTo
    Object.defineProperty(window, 'innerHeight', { value: VINDU, configurable: true })
    Object.defineProperty(window, 'scrollY', { value: RULLET, configurable: true })
    Object.defineProperty(document.documentElement, 'scrollHeight', { value: 100_000, configurable: true })
    const ekte = window.getComputedStyle.bind(window)
    vi.spyOn(window, 'getComputedStyle').mockImplementation((el, pseudo) => {
      if (!(el as Element).hasAttribute?.('data-skuff')) return ekte(el, pseudo)
      return { ...ekte(el, pseudo), scrollMarginTop: `${OVER}px`, scrollMarginBottom: `${UNDER}px` } as CSSStyleDeclaration
    })
  })

  afterEach(() => vi.mocked(window.getComputedStyle).mockRestore())

  function Side() {
    return (
      <SeksjonsstyringKilde>
        <Seksjon id="a" tittel="A" apenFraStart>
          <p>Første</p>
        </Seksjon>
        <Seksjon id="b" tittel="B">
          <Detaljkort id="k" tittel="K">
            <p>Kortet</p>
          </Detaljkort>
        </Seksjon>
      </SeksjonsstyringKilde>
    )
  }

  /**
   * Gir skuffen et sted i vinduet: toppen `top` px ned, et hode på `hode` px
   * og innhold på `innhold` px når den har glidd ferdig — men ennå ikke
   * glidd fram, som rett etter at den er åpnet.
   */
  function plasser(id: string, { top, hode, innhold }: { top: number; hode: number; innhold: number }) {
    const skuff = document.getElementById(id)!
    const inner = innholdFor(within(skuff).getAllByRole('button', { hidden: true })[0]!)
    skuff.getBoundingClientRect = () => ({ top, height: hode }) as DOMRect
    inner.getBoundingClientRect = () => ({ top: top + hode, height: 0 }) as DOMRect
    Object.defineProperty(inner, 'scrollHeight', { value: innhold, configurable: true })
    return skuff
  }

  it('midtstiller en skuff som får plass i det synlige feltet når den er åpnet', async () => {
    const user = userEvent.setup()
    render(<Side />)
    plasser('panel-b', { top: 300, hode: 60, innhold: 200 })
    await user.click(knapp('B'))
    await nesteBilde()
    // 260 px høy i et felt på 684: 212 px luft over og under.
    expect(rulletTil).toHaveBeenCalledWith({ top: RULLET + 300 - OVER - 212, behavior: 'auto' })
    expect(rullet).not.toHaveBeenCalled()
  })

  it('legger toppen av en skuff som er høyere enn feltet, rett under toppmenyen', async () => {
    const user = userEvent.setup()
    render(<Side />)
    plasser('panel-b', { top: 300, hode: 60, innhold: 900 })
    await user.click(knapp('B'))
    await nesteBilde()
    expect(rulletTil).toHaveBeenCalledWith({ top: RULLET + 300 - OVER, behavior: 'auto' })
  })

  it('gjør det samme for et detaljkort, målt uten kortene i det', async () => {
    const user = userEvent.setup()
    render(<Side />)
    await user.click(knapp('B'))
    plasser('panel-b--k', { top: -50, hode: 40, innhold: 100 })
    await nesteBilde()
    rulletTil.mockClear()
    await user.click(knapp('K'))
    await nesteBilde()
    // 140 px høyt: (684 − 140) / 2 = 272 px luft.
    expect(rulletTil).toHaveBeenLastCalledWith({ top: RULLET - 50 - OVER - 272, behavior: 'auto' })
  })

  it('ruller ikke når skuffen lukkes', async () => {
    const user = userEvent.setup()
    render(<Side />)
    await user.click(knapp('A'))
    await nesteBilde()
    expect(rulletTil).not.toHaveBeenCalled()
    expect(rullet).not.toHaveBeenCalled()
  })

  it('ruller jevnt og lar skuffen gli, men lukker søsknene straks', async () => {
    redusert = false
    const user = userEvent.setup()
    render(<Side />)
    plasser('panel-b', { top: 300, hode: 60, innhold: 900 })
    await user.click(knapp('B'))
    // Søskenet over lukkes uten å gli, så toppen av skuffen står stille mens siden ruller dit.
    const a = document.getElementById('panel-a')!
    expect(a.hasAttribute('data-stille')).toBe(true)
    expect(innholdFor(knapp('A')).getAttribute('hidden')).toBe('until-found')
    const b = document.getElementById('panel-b')!
    expect(b.hasAttribute('data-stille')).toBe(false)
    expect(innholdFor(knapp('B')).parentElement!.hasAttribute('data-glir')).toBe(true)
    await nesteBilde()
    expect(rulletTil).toHaveBeenCalledWith({ top: RULLET + 300 - OVER, behavior: 'smooth' })
  })

  it('åpner uten å gli og ruller straks for den som har bedt om mindre bevegelse', async () => {
    const user = userEvent.setup()
    render(<Side />)
    plasser('panel-b', { top: 300, hode: 60, innhold: 200 })
    await user.click(knapp('B'))
    expect(innholdFor(knapp('B')).parentElement!.hasAttribute('data-glir')).toBe(false)
    expect(innholdFor(knapp('B')).hasAttribute('hidden')).toBe(false)
    await nesteBilde()
    expect(rulletTil).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'auto' }))
  })

  /** Sier at skuffen har glidd ferdig. */
  function gliddFerdig(id: string) {
    const kropp = document.getElementById(id)!.querySelector('.skuff__kropp')!
    act(() => {
      const slutt = new Event('transitionend') as TransitionEvent
      Object.defineProperty(slutt, 'propertyName', { value: 'grid-template-rows' })
      kropp.dispatchEvent(slutt)
    })
  }

  it('justerer etter den virkelige høyden når skuffen har glidd ferdig', async () => {
    redusert = false
    const user = userEvent.setup()
    render(<Side />)
    plasser('panel-b', { top: 300, hode: 60, innhold: 200 })
    await user.click(knapp('B'))
    await nesteBilde()
    expect(rulletTil).toHaveBeenCalledTimes(1)
    // Ferdig åpnet ble skuffen 40 px høyere enn ventet (luft under som også glir): 300 px, 192 px luft.
    const skuff = document.getElementById('panel-b')!
    skuff.getBoundingClientRect = () => ({ top: 300, height: 300 }) as DOMRect
    const inner = innholdFor(knapp('B'))
    inner.getBoundingClientRect = () => ({ top: 360, height: 200 }) as DOMRect
    gliddFerdig('panel-b')
    expect(rulletTil).toHaveBeenCalledTimes(2)
    expect(rulletTil).toHaveBeenLastCalledWith({ top: RULLET + 300 - OVER - 192, behavior: 'smooth' })
  })

  it('lar siden ligge når brukeren har begynt å rulle selv før skuffen har glidd ferdig', async () => {
    redusert = false
    const user = userEvent.setup()
    render(<Side />)
    plasser('panel-b', { top: 300, hode: 60, innhold: 200 })
    await user.click(knapp('B'))
    await nesteBilde()
    act(() => {
      window.dispatchEvent(new Event('wheel'))
    })
    gliddFerdig('panel-b')
    expect(rulletTil).toHaveBeenCalledTimes(1)
  })

  it('bruker toppmenyen og luften under som grenser for feltet', () => {
    const css = readFileSync('src/styles/seksjoner.css', 'utf8')
    expect(css).toMatch(/\.skuff\s*\{[^}]*scroll-margin-block:\s*var\(--toppmeny-offset\)/)
    expect(css).toMatch(/\.skuff\s*\{\s*scroll-margin-bottom:\s*var\(--dokk-offset\)/)
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
