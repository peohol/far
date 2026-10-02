// @vitest-environment jsdom
/**
 * Direktelenkene i appen: brikken i teksten med navnet slik det er nå,
 * forhåndsvisningen og klikket som går dit; knappen i verktøyraden som bare
 * godtar lenker til noe som finnes; «Kopier lenke»; og en lenke limt inn i
 * adressefeltet.
 */
import { act, cleanup, render, renderHook, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Lenkemal } from '../direktelenker/mal'
import { lesLenkemaal, type Lenkemaal } from '../direktelenker/modell'
import { rensDokument, type Riktekstdokument } from '../faginnhold/riktekst'

const TRAAD = '0b8f6d7e-1c2a-4b3d-9e8f-123456789abc'
const IDE = '1c9f6d7e-1c2a-4b3d-9e8f-123456789abc'
const KOMMENTAR = '9a8b7c6d-5e4f-4a3b-8c2d-0123456789ab'
const BORTE = '2d9f6d7e-1c2a-4b3d-9e8f-123456789abc'

const dok = (tekst: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: tekst }] }] })
const forfatter = { first_name: 'Kari', last_name: 'Nordmann', username: 'kari' }

/** Det databasen svarer for hvert mål; det som ikke står her, finnes ikke. */
function svarFor(mal: Lenkemal): Lenkemaal | null {
  if (mal.id === TRAAD)
    return lesLenkemaal(mal, {
      slag: 'diskusjon',
      id: TRAAD,
      side: 'stoff:bupropion',
      tittel: 'Maksdose ved nyresvikt',
      kategori: { navn: 'Dosering', emoji: '💊' },
      forfatter,
      opprettet_kl: '2026-10-01T10:00:00Z',
      tekst: dok('Hva gjør vi ved eGFR under 30?'),
      arkivert_kl: null,
      kommentarer: 2,
      kommentar: mal.kommentar
        ? { id: KOMMENTAR, forfatter: { first_name: 'Ola', last_name: 'Hansen', username: 'ola' }, tekst: dok('Halver dosen.'), slettet: false, skjult: false }
        : null,
    })
  if (mal.id === IDE)
    return lesLenkemaal(mal, {
      slag: 'ide',
      id: IDE,
      tittel: 'Mørk modus',
      idekategori: 'funksjonalitet',
      forfatter,
      opprettet_kl: '2026-10-01T10:00:00Z',
      tekst: null,
      arkivert_kl: null,
      overfort: false,
      kommentarer: 0,
      kommentar: null,
    })
  return null
}

const hentLenkemaal = vi.fn(async (mal: Lenkemal) => svarFor(mal))
vi.mock('../direktelenker/api', () => ({ hentLenkemaal: (mal: Lenkemal) => hentLenkemaal(mal) }))

const { Riktekst } = await import('../components/stoffside/Riktekst')
const { Rikteksteditor } = await import('../components/stoffside/Rikteksteditor')
const { Direktelenkekilde } = await import('../components/direktelenker/Direktelenkekilde')
const { Kopilenkeknapp } = await import('../components/direktelenker/Kopilenkeknapp')
const { lyttEtterDiskusjon, taDiskusjon } = await import('../components/diskusjoner/diskusjonsvisning')
const { lyttEtterIde } = await import('../components/ideer/idevisning')
const { useRute } = await import('../hooks/useRute')

const SIDER = { fagsider: [{ side: 'stoff:bupropion' as const, navn: 'Bupropion' }], fortolkninger: [] }

function tekstMed(...brikker: Record<string, unknown>[]): Riktekstdokument {
  return rensDokument({
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Se ' }, ...brikker.map((attrs) => ({ type: 'direktelenke', attrs }))] }],
  })
}

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
  hentLenkemaal.mockClear()
  window.location.hash = '#/'
})
afterEach(cleanup)

describe('brikken i teksten', () => {
  it('viser siden, emojien og overskriften slik de er nå, og er en lenke med hele adressen', async () => {
    render(
      <Direktelenkekilde sider={SIDER}>
        <Riktekst dokument={tekstMed({ slag: 'diskusjon', id: TRAAD, etikett: 'Gammelt navn' })} />
      </Direktelenkekilde>,
    )
    const lenke = screen.getByRole('link', { name: /Gammelt navn/ })
    expect(lenke.getAttribute('href')).toBe(`${window.location.origin}${window.location.pathname}#/diskusjon/${TRAAD}`)
    await waitFor(() => expect(lenke.textContent).toBe('Diskusjon: Bupropion💊 Maksdose ved nyresvikt'))
  })

  it('viser en forhåndsvisning når pekeren hviler på den, og går til tråden og kommentaren ved klikk', async () => {
    const bruker = userEvent.setup()
    const varslet = vi.fn()
    const slutt = lyttEtterDiskusjon(varslet)
    render(
      <Direktelenkekilde sider={SIDER}>
        <Riktekst dokument={tekstMed({ slag: 'diskusjon', id: TRAAD, kommentar: KOMMENTAR, etikett: 'Lagret' })} />
      </Direktelenkekilde>,
    )
    const lenke = await screen.findByRole('link', { name: /kommentar fra Ola Hansen/ })
    await bruker.hover(lenke)
    const boble = await screen.findByRole('tooltip')
    expect(boble.textContent).toContain('Diskusjon · Bupropion')
    expect(boble.textContent).toContain('Kari Nordmann')
    expect(boble.textContent).toContain('Hva gjør vi ved eGFR under 30?')
    expect(boble.textContent).toContain('Kommentar fra Ola Hansen')
    expect(boble.textContent).toContain('Halver dosen.')

    await bruker.click(lenke)
    await waitFor(() => expect(window.location.hash).toBe('#/stoff/bupropion'))
    expect(varslet).toHaveBeenCalled()
    expect(taDiskusjon('stoff:bupropion')).toEqual({ diskusjon: TRAAD, kommentar: KOMMENTAR })
    slutt()
  })

  it('åpner en idé i Idéer', async () => {
    const bruker = userEvent.setup()
    const apnet = vi.fn()
    const slutt = lyttEtterIde(apnet)
    render(<Riktekst dokument={tekstMed({ slag: 'ide', id: IDE, etikett: 'Idé' })} />)
    const lenke = await screen.findByRole('link', { name: /Idéer.*Mørk modus/ })
    await bruker.click(lenke)
    await waitFor(() => expect(apnet).toHaveBeenCalledWith({ id: IDE, kommentar: null }))
    expect(window.location.hash).toBe('#/')
    slutt()
  })

  it('er overstreket og fører ingen steder når det den peker på, er borte', async () => {
    const bruker = userEvent.setup()
    render(<Riktekst dokument={tekstMed({ slag: 'diskusjon', id: BORTE, etikett: 'Slettet tråd' })} />)
    const lenke = screen.getByRole('link', { name: /Slettet tråd/ })
    await waitFor(() => expect(lenke.hasAttribute('data-borte')).toBe(true))
    await bruker.click(lenke)
    expect(window.location.hash).toBe('#/')
  })
})

describe('knappen i verktøyraden', () => {
  async function apnePanel() {
    const bruker = userEvent.setup()
    const onEndre = vi.fn()
    render(
      <Direktelenkekilde sider={SIDER}>
        <Rikteksteditor dokument={rensDokument(dok('Tekst'))} onEndre={onEndre} etikett="Kommentar" referanser={false} direktelenker />
      </Direktelenkekilde>,
    )
    await bruker.click(screen.getByRole('button', { name: /Sett inn direktelenke/ }))
    const panel = screen.getByRole('group', { name: 'Direktelenke' })
    const felt = within(panel).getByRole('textbox')
    const settInn = within(panel).getByRole('button', { name: 'Sett inn i teksten' })
    return { bruker, onEndre, panel, felt, settInn }
  }

  it('finnes bare når den er slått på', () => {
    render(<Rikteksteditor dokument={rensDokument(dok('Tekst'))} onEndre={() => {}} etikett="Fagtekst" />)
    expect(screen.queryByRole('button', { name: /Sett inn direktelenke/ })).toBeNull()
  })

  it('avviser det som ikke er en direktelenke i appen, og lenker til noe som ikke finnes', async () => {
    const { bruker, panel, felt, settInn } = await apnePanel()
    await bruker.type(felt, 'https://example.com/#/diskusjon/x')
    expect(within(panel).getByRole('alert').textContent).toMatch(/ikke en lenke til en diskusjon/)
    expect(settInn).toHaveProperty('disabled', true)

    await bruker.clear(felt)
    await bruker.click(felt)
    await bruker.paste(`${window.location.origin}/#/diskusjon/${BORTE}`)
    expect(await within(panel).findByText('Lenken peker på noe som ikke finnes lenger.')).toBeTruthy()
    expect(settInn).toHaveProperty('disabled', true)
  })

  it('viser hva en gyldig lenke peker på, og setter den inn som en brikke med navnet', async () => {
    const { bruker, onEndre, panel, felt, settInn } = await apnePanel()
    await bruker.click(felt)
    await bruker.paste(`${window.location.origin}/#/diskusjon/${TRAAD}/${KOMMENTAR}`)
    expect(await within(panel).findByText('Maksdose ved nyresvikt')).toBeTruthy()
    await waitFor(() => expect(settInn).toHaveProperty('disabled', false))
    await bruker.click(settInn)

    expect(screen.queryByRole('group', { name: 'Direktelenke' })).toBeNull()
    const siste = onEndre.mock.calls.at(-1)![0] as Riktekstdokument
    expect(siste.content![0]!.content).toContainEqual({
      type: 'direktelenke',
      attrs: { slag: 'diskusjon', id: TRAAD, kommentar: KOMMENTAR, etikett: 'Bupropion · 💊 Maksdose ved nyresvikt · kommentar fra Ola Hansen' },
    })
  })
})

describe('«Kopier lenke»', () => {
  it('legger hele lenken på utklippstavlen og sier fra', async () => {
    const bruker = userEvent.setup()
    const skriv = vi.spyOn(navigator.clipboard, 'writeText')
    render(<Kopilenkeknapp mal={{ slag: 'ide', id: IDE, kommentar: KOMMENTAR }} hva="kommentaren" />)
    await bruker.click(screen.getByRole('button', { name: 'Kopier lenke til kommentaren' }))
    expect(skriv).toHaveBeenCalledWith(`${window.location.origin}${window.location.pathname}#/ide/${IDE}/${KOMMENTAR}`)
    expect(await screen.findByText('Lenke kopiert')).toBeTruthy()
  })
})

describe('en lenke limt inn i adressefeltet', () => {
  it('gis videre og står ikke igjen; siden man var på, blir stående', async () => {
    window.location.hash = '#/stoff/bupropion'
    const onLenke = vi.fn()
    const { result } = renderHook(() => useRute(onLenke))
    expect(result.current[0]).toEqual({ side: 'stoff', stoff: 'bupropion' })

    act(() => {
      window.location.hash = `#/ide/${IDE}/${KOMMENTAR}`
    })
    await waitFor(() => expect(onLenke).toHaveBeenCalledWith({ slag: 'ide', id: IDE, kommentar: KOMMENTAR }))
    expect(window.location.hash).toBe('#/stoff/bupropion')
    expect(result.current[0]).toEqual({ side: 'stoff', stoff: 'bupropion' })
  })

  it('følges også når appen åpnes med den', () => {
    window.location.hash = `#/diskusjon/${TRAAD}`
    const onLenke = vi.fn()
    renderHook(() => useRute(onLenke))
    expect(onLenke).toHaveBeenCalledWith({ slag: 'diskusjon', id: TRAAD, kommentar: null })
    expect(window.location.hash).toBe('#/')
  })
})
