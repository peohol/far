// @vitest-environment jsdom
/**
 * Steg 2 på de publiserte regelsettene i databasen, prøvd i hele appen.
 *
 * - Knappene, pillene og kommentarene kommer fra regelsettet databasen gir,
 *   ikke fra noe som ligger i appen: et publisert regelsett med en annen
 *   grense og kommentar gir andre knapper og kopierer den nye teksten.
 * - Referanseområdet under analyttnavnet er det informasjonssiden har, lest
 *   fra databasen sammen med regelsettene.
 * - Mens regelsettene hentes, og når hentingen feiler eller koden ikke har
 *   noe regelsett, er det ingen knapper og ingenting å kopiere.
 * - «Prøv igjen» henter regelsettene på nytt.
 *
 * Regelsettene er de fra før byttet, eller syntetiske endringer av dem.
 */
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { Intervallregelsett } from '../regler/modell'

type Svar = { data: Record<string, unknown> | null; error: unknown }

/**
 * Svaret databasen gir på neste henting av regelsettene: regelsettene og
 * kommentarene i hvert sitt kall, fra det samme svaret.
 */
const svar = vi.hoisted(() => ({
  neste: [] as (() => Promise<Svar>)[],
  aktivt: null as Promise<Svar> | null,
}))

vi.mock('../auth/okt', () => ({
  useProfil: () => ({ role: 'user', first_name: 'Lars', last_name: 'Leser', username: 'leser' }),
}))
vi.mock('../auth/klient', () => ({
  klient: () => ({
    rpc: async (funksjon: string) => {
      if (funksjon === 'les_intervallregelsett' && svar.neste.length > 0) svar.aktivt = svar.neste.shift()!()
      if (!['les_intervallregelsett', 'les_kommentarer', 'les_referanseomrader'].includes(funksjon) || !svar.aktivt) {
        return { data: null, error: null }
      }
      const { data, error } = await svar.aktivt
      return { data: data?.[funksjon] ?? null, error }
    },
  }),
}))
vi.mock('../components/konto/Kontoknapper', () => ({ Kontoknapper: () => null }))

const { default: App } = await import('../App')
const { TipsLag } = await import('../components/Tips')
const { ShortcutVisibilityProvider } = await import('../hooks/useShortcutVisibility')
const { DAGENS_REGELSETT, dagensKommentar, dagensRegelsett, publiserteRader } = await import('./hjelp/dagensregler')
const { regelsettvalg } = await import('../domain/valg')

/** Teksten på knappene regelsettet fra før byttet gir for NOR. */
const NOR_KNAPPER = regelsettvalg(dagensRegelsett('NOR')).map((v) => v.label)

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Element.prototype.scrollIntoView ??= function () {}
  window.scrollTo = () => {}
})

afterEach(() => {
  cleanup()
  svar.neste = []
  svar.aktivt = null
  window.location.hash = ''
})

/** Databasen svarer med disse regelsettene, kommentarene og referanseområdene som de publiserte. */
function publisert(regelsett: Intervallregelsett[], referanseomrader?: Parameters<typeof publiserteRader>[1]) {
  return () => Promise.resolve({ data: publiserteRader(regelsett, referanseomrader), error: null })
}

/** Databasen svarer når testen sier fra. */
function venter() {
  let svarNa!: () => void
  const lovnad = new Promise<void>((ferdig) => (svarNa = ferdig))
  svar.neste.push(() => lovnad.then(publisert(DAGENS_REGELSETT)))
  return svarNa
}

async function tilSteg2(kode: string) {
  const user = userEvent.setup()
  render(
    <TipsLag>
      <ShortcutVisibilityProvider>
        <App />
      </ShortcutVisibilityProvider>
    </TipsLag>,
  )
  await user.keyboard(kode.toLowerCase())
  await user.keyboard('1')
  const steg = await screen.findByRole('region', { name: 'Velg konsentrasjon' })
  return { user, steg }
}

function knappene(steg: HTMLElement): string[] {
  return [...steg.querySelectorAll('.bandknapp .bandknapp__verdi')].map((k) => k.textContent ?? '')
}

describe('steg 2 på regelsettene i databasen', () => {
  it('viser knappene og kopierer kommentaren det publiserte regelsettet gir', async () => {
    svar.neste.push(publisert(DAGENS_REGELSETT))
    const { user, steg } = await tilSteg2('NOR')
    await waitFor(() => expect(knappene(steg)).toEqual(NOR_KNAPPER))
    expect(NOR_KNAPPER.length).toBeGreaterThanOrEqual(3)
    await user.keyboard('2')
    await waitFor(async () => expect(await navigator.clipboard.readText()).toBe(dagensKommentar('NOR', 'innenfor')))
  })

  it('følger et regelsett og en kommentar som er endret og publisert, uten at appen endres', async () => {
    const nor = dagensRegelsett('NOR')
    const ny = { id: nor.kommentarer[0]!.id, tekst: 'Syntetisk ny kommentar for testen.' }
    const endret: Intervallregelsett = {
      ...nor,
      skillepunkter: [nor.skillepunkter[0]! - 5, ...nor.skillepunkter.slice(1)],
      kommentarer: [ny, ...nor.kommentarer.slice(1)],
    }
    svar.neste.push(publisert(DAGENS_REGELSETT.map((r) => (r.analyttkode === 'NOR' ? endret : r))))
    const { user, steg } = await tilSteg2('NOR')
    await waitFor(() => expect(knappene(steg)[0]).toBe(`< ${nor.skillepunkter[0]! - 5}`))
    await user.keyboard('1')
    await waitFor(async () => expect(await navigator.clipboard.readText()).toBe(ny.tekst))
  })

  it('viser referanseområdet informasjonssiden har, også når det er endret der', async () => {
    svar.neste.push(publisert(DAGENS_REGELSETT, { NOR: { nedre: 210, ovre: 590, enhet: 'nmol/L' } }))
    const { steg } = await tilSteg2('NOR')
    await waitFor(() => expect(within(steg).getByText('210 – 590 nmol/L')).toBeTruthy())
  })

  it('har ingen knapper mens regelsettene hentes, og viser referanseområdet når det er hentet', async () => {
    const svarNa = venter()
    const { user, steg } = await tilSteg2('NOR')
    expect(within(steg).getByText('Henter fortolkningsreglene …')).toBeTruthy()
    expect(knappene(steg)).toEqual([])
    expect(within(steg).queryByText('Referanseområde')).toBeNull()
    expect(within(steg).queryByText('Ringegrense')).toBeNull()

    await navigator.clipboard.writeText('før')
    await user.keyboard('1')
    expect(await navigator.clipboard.readText()).toBe('før')

    svarNa()
    await waitFor(() => expect(knappene(steg)).toEqual(NOR_KNAPPER))
    expect(within(steg).getByText('Ringegrense')).toBeTruthy()
    expect(within(steg).getByText('200 – 600 nmol/L')).toBeTruthy()
  })

  it('sier fra når hentingen feiler, og henter på nytt med «Prøv igjen»', async () => {
    svar.neste.push(() => Promise.resolve({ data: null, error: { message: 'Nettverket svarte ikke.' } }))
    svar.neste.push(publisert(DAGENS_REGELSETT))
    const { user, steg } = await tilSteg2('NOR')
    const melding = await within(steg).findByRole('alert')
    expect(melding.textContent).toContain('Fikk ikke hentet fortolkningsreglene.')
    expect(knappene(steg)).toEqual([])

    await user.click(within(melding).getByRole('button', { name: 'Prøv igjen' }))
    await waitFor(() => expect(knappene(steg)).toEqual(NOR_KNAPPER))
    expect(within(steg).queryByRole('alert')).toBeNull()
  })

  it('sier fra når koden ikke har noe publisert regelsett', async () => {
    svar.neste.push(publisert(DAGENS_REGELSETT.filter((r) => r.analyttkode !== 'NOR')))
    const { steg } = await tilSteg2('NOR')
    expect((await within(steg).findByRole('alert')).textContent).toBe(
      'Det finnes ingen publiserte fortolkningsregler for NOR.',
    )
    expect(knappene(steg)).toEqual([])
    // Referanseområdet er informasjonssidens, og står likevel.
    expect(within(steg).getByText('200 – 600 nmol/L')).toBeTruthy()
  })
})
