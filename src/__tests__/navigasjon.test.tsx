// @vitest-environment jsdom
/**
 * Veiene mellom fortolkningen og informasjonssidene, prøvd i hele appen.
 *
 * - Sidemenyen er stoffregisteret. Den fører til informasjonssidene, ikke til
 *   fortolkningen — også til stoffene uten analyttkode — og filtrerer ikke
 *   søket.
 * - Analyttkodene i fortolkningsmodulene er lenker til sidene sine.
 * - «Åpne fortolkning» fører tilbake til riktig modul.
 * - Stoffer som deler fagsside, har én kanonisk adresse; gamle sekundæradresser videresendes.
 * - Fortolkningen står uendret bak en åpen informasjonsside, og tastene dens
 *   ligger i ro så lenge den er skjult.
 * - Fagsøket i toppmenyen når tastene i fortolkningen aldri, og søkesiden
 *   legger seg over fortolkningen som en informasjonsside.
 *
 * Innloggingen og databasen er erstattet: økten er en vanlig bruker, og
 * databasen har ingen sider ennå, bare regelsettene fra før byttet og siden
 * for ett stoff uten analyttkode.
 */
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../auth/okt', () => ({
  useProfil: () => ({ role: 'user', first_name: 'Lars', last_name: 'Leser', username: 'leser' }),
}))
vi.mock('../auth/klient', async () => {
  const { DAGENS_REGELSETT, publiserteRader } = await import('./hjelp/dagensregler')
  const { rusScenarioregeldata } = await import('./hjelp/rusgrunnlag')
  const { thcRegelsettutgave } = await import('./hjelp/thcgrunnlag')
  // Reglene fortolkningen henter, er de publiserte regelsettene.
  // Og ett stoff uten analyttkode har en publisert side.
  const stoffside = {
    analytt: null,
    infoside: {
      id: 'stoff',
      revisjon: 1,
      publisert_revisjon: 1,
      innhold: { navn: 'Teststoff' },
      endret_av_fornavn: '',
      endret_av_etternavn: '',
      endret_kl: '',
    },
    elementer: [],
    komponenter: [],
    referanser: [],
  }
  const vanlige = publiserteRader(DAGENS_REGELSETT)
  const thc = thcRegelsettutgave()
  const rader: Record<string, unknown> = {
    ...vanlige,
    les_kommentarer: [...vanlige.les_kommentarer, ...thc.kommentarer],
    les_thc_regelsett: thc.regelsett,
    les_scenarioregler: rusScenarioregeldata(),
    les_stoffsidenavn: ['Teststoff'],
    les_stoffside: stoffside,
  }
  return {
    klient: () => ({
      rpc: async (funksjon: string) => ({ data: rader[funksjon] ?? null, error: null }),
    }),
  }
})
vi.mock('../components/konto/Kontomeny', () => ({ Kontomeny: () => null }))

const { default: App } = await import('../App')
const { dagensKommentar } = await import('./hjelp/dagensregler')
const { TipsLag } = await import('../components/Tips')
const { ShortcutVisibilityProvider } = await import('../hooks/useShortcutVisibility')

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Element.prototype.scrollIntoView ??= function () {}
  window.scrollTo = () => {}
})

beforeEach(() => {
  window.location.hash = ''
})

afterEach(cleanup)

function visApp() {
  render(
    <TipsLag>
      <ShortcutVisibilityProvider>
        <App />
      </ShortcutVisibilityProvider>
    </TipsLag>,
  )
}

/** Fortolkningen, synlig eller skjult. */
function fortolkningen(): HTMLElement {
  return document.querySelector('main.scene:not(.scene--infoside):not(.scene--sokeside)')!
}

/** Søker opp NOR og velger det beste treffet — koden selv — med tasten 1. */
async function velgNortriptylin(user: ReturnType<typeof userEvent.setup>) {
  await user.keyboard('nor')
  await user.keyboard('1')
  await screen.findByRole('region', { name: 'Velg konsentrasjon' })
}

async function infosideFor(navn: string) {
  return screen.findByRole('heading', { level: 1, name: navn })
}

describe('sidemenyen', () => {
  it('er stoffregisteret, og fører til informasjonssiden, med egen adresse', async () => {
    const user = userEvent.setup()
    visApp()
    await user.click(screen.getByRole('button', { name: 'Vis stoffregisteret' }))
    const meny = screen.getByRole('navigation', { name: 'Stoffregister' })
    // Søket i fortolkningen filtreres fra hovedsiden, ikke herfra.
    expect(within(meny).queryByRole('radio')).toBeNull()
    await user.click(within(meny).getByRole('button', { name: /^Antidepressiver/ }))
    expect(within(meny).getByRole('heading', { name: 'TCA' })).toBeTruthy()
    const lenke = within(meny).getByRole('link', { name: /Amitriptylin/ })
    expect(lenke.getAttribute('href')).toBe('#/analytt/AMTNORSUM')

    await user.click(lenke)
    await infosideFor('Amitriptylin')
    expect(window.location.hash).toBe('#/analytt/AMTNORSUM')
    expect(fortolkningen().hidden).toBe(true)
    // Siden starter med fokus på navnet, ikke igjen i menyen.
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1 }))
  })

  it('lar filteret for søket stå som det er', async () => {
    const user = userEvent.setup()
    visApp()
    await user.click(screen.getByRole('button', { name: 'Vis stoffregisteret' }))
    // Alt + tall setter filteret på hovedsiden, men ikke mens registeret står åpent.
    await user.keyboard('{Alt>}1{/Alt}')
    await user.keyboard('{Escape}')
    expect(screen.queryByText('Søket er begrenset til')).toBeNull()
  })
})

describe('stoffene uten analyttkode', () => {
  it('står i registeret, og fører til siden etter navnet', async () => {
    const user = userEvent.setup()
    visApp()
    await user.click(screen.getByRole('button', { name: 'Vis stoffregisteret' }))
    // Teststoffet står ikke i registeret, og havner derfor i «Andre stoffer».
    await user.click(await screen.findByRole('button', { name: /^Andre stoffer/ }))
    // En vanlig bruker kan ikke lage nye sider.
    expect(screen.queryByLabelText('Ny stoffside')).toBeNull()
    const lenke = screen.getByRole('link', { name: 'Teststoff' })
    expect(lenke.getAttribute('href')).toBe('#/stoff/Teststoff')

    await user.click(lenke)
    await infosideFor('Teststoff')
    expect(window.location.hash).toBe('#/stoff/Teststoff')
    expect(fortolkningen().hidden).toBe(true)
    expect(screen.queryByRole('button', { name: 'Åpne fortolkning' })).toBeNull()
  })
})

describe('adressene', () => {
  it('åpner en informasjonsside direkte fra adressen', async () => {
    window.location.hash = '#/analytt/nor'
    visApp()
    await infosideFor('Nortriptylin')
    expect(document.title).toBe('Nortriptylin (NOR) – OUSFAR')
  })

  it('følger tilbakeknappen', async () => {
    window.location.hash = '#/analytt/NOR'
    visApp()
    await infosideFor('Nortriptylin')
    window.location.hash = '#/'
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    await waitFor(() => expect(fortolkningen().hidden).toBe(false))
    expect(screen.queryByRole('heading', { level: 1, name: 'Nortriptylin' })).toBeNull()
  })
})


describe('kanoniske fagssider', () => {
  it.each([
    ['DMI', 'DIAZ', 'Diazepam'],
    ['OTRAM', 'TRAM', 'Tramadol'],
    ['UETS', 'UETGS', 'Etanol'],
  ])('sender %s til den felles siden %s', async (fra, til, navn) => {
    window.location.hash = `#/analytt/${fra}`
    visApp()
    await infosideFor(navn)
    await waitFor(() => expect(window.location.hash).toBe(`#/analytt/${til}`))
  })

  it('samler THC og THC-syre på én side med begge fortolkningssystemene', async () => {
    window.location.hash = '#/analytt/IRCAK'
    visApp()
    await infosideFor('THC og THC-syre')
    await waitFor(() => expect(window.location.hash).toBe('#/analytt/THC'))
    expect(await screen.findByRole('heading', { level: 2, name: 'Fortolkningsregler – THC i serum' })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2, name: 'Fortolkningsregler – THC-syre i urin' })).toBeTruthy()
  })
})

describe('mellom fortolkningen og informasjonssiden', () => {
  it('går fra kodepillen til siden og tilbake til samme modul', async () => {
    const user = userEvent.setup()
    visApp()
    await velgNortriptylin(user)
    const pille = await screen.findByRole('link', { name: 'NOR – åpne informasjonssiden' })
    expect(pille.getAttribute('href')).toBe('#/analytt/NOR')

    await user.click(pille)
    await infosideFor('Nortriptylin')
    expect(fortolkningen().hidden).toBe(true)

    await user.click(screen.getByRole('button', { name: 'Åpne fortolkning' }))
    await waitFor(() => expect(fortolkningen().hidden).toBe(false))
    expect(window.location.hash).toBe('#/')
    expect(within(fortolkningen()).getByRole('link', { name: 'NOR – åpne informasjonssiden' })).toBeTruthy()
  })

  it('har «Åpne stoffside» i toppmenyen mens en modul fortolkes, og kommer tilbake til samme modul', async () => {
    const user = userEvent.setup()
    visApp()
    // Uten valgt analytt er det ingen stoffside å åpne.
    expect(screen.queryByRole('button', { name: 'Åpne stoffside' })).toBeNull()
    await velgNortriptylin(user)

    await user.click(screen.getByRole('button', { name: 'Åpne stoffside' }))
    await infosideFor('Nortriptylin')
    expect(window.location.hash).toBe('#/analytt/NOR')
    // Stoffsiden har sine egne handlinger i stedet.
    expect(screen.queryByRole('button', { name: 'Åpne stoffside' })).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Åpne fortolkning' }))
    await waitFor(() => expect(fortolkningen().hidden).toBe(false))
    expect(await screen.findByRole('region', { name: 'Velg konsentrasjon' })).toBeTruthy()
  })

  it('åpner riktig modul fra en informasjonsside, også for koder som deler modul', async () => {
    const user = userEvent.setup()
    window.location.hash = '#/analytt/OXA'
    visApp()
    await infosideFor('Oksazepam')
    await user.click(screen.getByRole('button', { name: 'Åpne fortolkning' }))
    await waitFor(() => expect(fortolkningen().hidden).toBe(false))
    // Diazepam og N-desmetyldiazepam deler fagsside; oksazepam har sin egen.
    expect(
      within(fortolkningen()).getByRole('link', { name: 'DIAZ – åpne informasjonssiden' }).getAttribute('href'),
    ).toBe('#/analytt/DIAZ')
    expect(
      within(fortolkningen()).getByRole('link', { name: 'DMI – åpne informasjonssiden' }).getAttribute('href'),
    ).toBe('#/analytt/DIAZ')
    expect(
      within(fortolkningen()).getByRole('link', { name: 'OXA – åpne informasjonssiden' }).getAttribute('href'),
    ).toBe('#/analytt/OXA')
    // Modulen fortolker med reglene appen hentet.
    await user.click(within(fortolkningen()).getByRole('checkbox', { name: /Oksazepam/ }))
    expect(within(fortolkningen()).getByRole('button', { name: 'Kopier hovedkommentar' })).toBeTruthy()
  })

  it('lar fortolkningen ligge i ro mens informasjonssiden vises', async () => {
    // Utklippstavlen er user-events egen, og er tom når testen starter.
    const user = userEvent.setup()
    visApp()
    await velgNortriptylin(user)
    const pille = await screen.findByRole('link', { name: 'NOR – åpne informasjonssiden' })
    await user.click(pille)
    await infosideFor('Nortriptylin')

    // Talltastene velger bånd i fortolkningen, men ikke herfra.
    await user.keyboard('1')
    await user.keyboard('{Enter}')
    expect(await navigator.clipboard.readText()).toBe('')

    // Esc lukker siden, og fortolkningen står der den sto.
    await user.keyboard('{Escape}')
    await waitFor(() => expect(fortolkningen().hidden).toBe(false))
    expect(within(fortolkningen()).getByRole('link', { name: 'NOR – åpne informasjonssiden' })).toBeTruthy()
    // Nå virker tastene igjen: 1 kopierer kommentaren for det første båndet.
    await user.keyboard('1')
    await waitFor(async () => expect(await navigator.clipboard.readText()).toBe(dagensKommentar('NOR', 'under')))
  })
})

describe('fagsøket i hele appen', () => {
  it('hentes med Ctrl K fra fortolkningen, uten at det som skrives når tastene der', async () => {
    const user = userEvent.setup()
    // Utklippstavlen kan ha noe fra testen før; merket viser om noe kopieres.
    const urort = 'ingenting kopiert'
    await navigator.clipboard.writeText(urort)
    visApp()
    await velgNortriptylin(user)

    await user.keyboard('{Control>}k{/Control}')
    const fagsok = screen.getByRole('combobox', { name: 'Søk i fagstoffet' })
    expect(document.activeElement).toBe(fagsok)
    // 1 ville kopiert kommentaren for det første båndet, og Esc gått tilbake til søket.
    await user.keyboard('1')
    await user.keyboard('{Escape}{Escape}')
    expect(await navigator.clipboard.readText()).toBe(urort)
    expect(screen.getByRole('region', { name: 'Velg konsentrasjon' })).toBeTruthy()

    // Enter uten valgt treff går til søkesiden, over fortolkningen. Pil opp
    // fra det første treffet velger ingen.
    await user.keyboard('amitriptylin{ArrowUp}{Enter}')
    expect(window.location.hash).toBe('#/sok?q=amitriptylin')
    expect(await screen.findByRole('heading', { level: 1, name: '«amitriptylin»' })).toBeTruthy()
    expect(fortolkningen().hidden).toBe(true)
    expect(await navigator.clipboard.readText()).toBe(urort)

    // Esc lukker søkesiden, og fortolkningen står der den sto.
    await user.keyboard('{Escape}')
    await waitFor(() => expect(fortolkningen().hidden).toBe(false))
    expect(within(fortolkningen()).getByRole('region', { name: 'Velg konsentrasjon' })).toBeTruthy()
    await user.keyboard('1')
    await waitFor(async () => expect(await navigator.clipboard.readText()).toBe(dagensKommentar('NOR', 'under')))
  })

  it('åpner søkesiden direkte fra adressen, med søket i feltet', async () => {
    window.location.hash = '#/sok?q=kvetiapin'
    visApp()
    expect(await screen.findByRole('heading', { level: 1, name: '«kvetiapin»' })).toBeTruthy()
    expect((screen.getByRole('combobox', { name: 'Søk i fagstoffet' }) as HTMLInputElement).value).toBe('kvetiapin')
    // Databasen her har ingen informasjonssider, men analyttsiden for koden
    // finnes likevel, med navnet fra katalogen.
    const sokesiden = screen.getByRole('region', { name: '«kvetiapin»' })
    const treff = await within(sokesiden).findByRole('link', { name: /Kvetiapin/ })
    expect(treff.getAttribute('href')).toBe('#/analytt/KVE')
  })
})
