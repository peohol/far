// @vitest-environment jsdom
/**
 * Veiene mellom fortolkningen og stoffsidene, prøvd i hele appen.
 *
 * - En fagside er alltid en stoffside, med stoffets nøkkel i adressen
 *   (`#/stoff/bupropion`). En analyttkode som HBUP er aldri en side, en
 *   sidetittel eller en adresse; den er koblet til et stoff i
 *   stoffregisteret, og det er koblingen som fører mellom de to.
 * - Sidemenyen er stoffregisteret. Den fører til stoffsidene, ikke til
 *   fortolkningen — også til stoffene uten analyttkode — og filtrerer ikke
 *   søket. Kodene står ved stoffene som sekundær informasjon.
 * - Analyttkodene i fortolkningsmodulene lenker til stoffet de primært er
 *   koblet til: HBUP til Bupropion, DMI til Diazepam.
 * - «Åpne fortolkning» og kodeknappene på stoffsiden fører tilbake til riktig
 *   modul, som fortolker etter koden.
 * - Gamle adresser etter analyttkoden (`#/analytt/HBUP`) åpner stoffsiden, og
 *   adressefeltet skrives om uten en ny oppføring i historikken.
 * - Fortolkningen står uendret bak en åpen stoffside, og tastene dens ligger
 *   i ro så lenge den er skjult.
 * - Fagsøket i toppmenyen når tastene i fortolkningen aldri, og søkesiden
 *   legger seg over fortolkningen som en stoffside.
 *
 * Innloggingen og databasen er erstattet: økten er en vanlig bruker, og
 * databasen har bare regelsettene fra før byttet, referanseområdekortene på
 * stoffsidene og siden for ett stoff som ikke står i registeret. Hvert kall
 * til databasen noteres, så testene kan se hva som ble lest etter hva.
 */
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

/** Kallene appen har gjort til databasen, i rekkefølge. */
const databasen = vi.hoisted(() => ({ kall: [] as { funksjon: string; argumenter: Record<string, unknown> }[] }))

vi.mock('../auth/okt', () => ({
  useProfil: () => ({ role: 'user', first_name: 'Lars', last_name: 'Leser', username: 'leser' }),
}))
vi.mock('../auth/klient', async () => {
  const { DAGENS_REGELSETT } = await import('./hjelp/dagensregler')
  const { publiserteStoffrader } = await import('./hjelp/stoffreferanseomrader')
  const { rusScenarioregeldata } = await import('./hjelp/rusgrunnlag')
  const { thcRegelsettutgave } = await import('./hjelp/thcgrunnlag')
  const { GRUNNSTRUKTUR } = await import('./hjelp/registerstruktur')
  // Ett stoff registeret ikke kjenner, har en publisert side i databasen.
  const teststoff = { id: 'stoff', slug: 'teststoff', navn: 'Teststoff' }
  const stoffside = {
    stoff: teststoff,
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
    referanser: [],
  }
  // Reglene fortolkningen henter, er de publiserte regelsettene.
  const vanlige = publiserteStoffrader(DAGENS_REGELSETT)
  const thc = thcRegelsettutgave()
  const rader: Record<string, unknown> = {
    ...vanlige,
    les_kommentarer: [...vanlige.les_kommentarer, ...thc.kommentarer],
    les_thc_regelsett: thc.regelsett,
    les_scenarioregler: rusScenarioregeldata(),
    les_stoffregister: { ...GRUNNSTRUKTUR, sider: [teststoff] },
  }
  return {
    klient: () => ({
      rpc: async (funksjon: string, argumenter: Record<string, unknown> = {}) => {
        databasen.kall.push({ funksjon, argumenter })
        // Stoffsiden leses etter nøkkelen; bare teststoffet har en side.
        if (funksjon === 'les_stoff') return { data: argumenter.stoff === teststoff.slug ? stoffside : null, error: null }
        // Regelsettet for én analyttkode, slik stoffsiden leser det.
        if (funksjon === 'finn_intervallregelsett') {
          const regelsett = vanlige.les_intervallregelsett.find((r) => r.innhold.analyttkode === argumenter.analyttkode)
          return { data: regelsett ?? null, error: null }
        }
        return { data: rader[funksjon] ?? null, error: null }
      },
    }),
  }
})
vi.mock('../components/konto/Kontomeny', () => ({ Kontomeny: () => null }))

const { default: App } = await import('../App')
const { dagensKommentar, dagensRegelsett } = await import('./hjelp/dagensregler')
const { regelsettvalg } = await import('../domain/valg')
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
  databasen.kall = []
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

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

/** Stoffsiden, når den står åpen. */
function stoffsiden(): HTMLElement | null {
  return document.querySelector('main.scene--infoside')
}

/** Søker opp NOR og velger det beste treffet — koden selv — med tasten 1. */
async function velgNortriptylin(user: ReturnType<typeof userEvent.setup>) {
  await user.keyboard('nor')
  await user.keyboard('1')
  await screen.findByRole('region', { name: 'Velg konsentrasjon' })
}

/** Navnet kodepillen i fortolkningen har: koden, og stoffet den fører til. */
function pillenavn(kode: string, stoff: string): string {
  return `${kode} – åpne fagsiden for ${stoff}`
}

/**
 * Søker opp koden i fortolkningen og åpner modulen den fortolkes i — av seg
 * selv når søket bare gir den, ellers med det beste treffet — og gir tilbake
 * kodepillen for den.
 */
async function velgKode(user: ReturnType<typeof userEvent.setup>, kode: string, stoff: string) {
  await user.keyboard(kode.toLowerCase())
  const navn = pillenavn(kode, stoff)
  if (!within(fortolkningen()).queryByRole('link', { name: navn })) await user.keyboard('1')
  return within(fortolkningen()).findByRole('link', { name: navn })
}

async function stoffsideFor(navn: string) {
  return screen.findByRole('heading', { level: 1, name: navn })
}

function knappene(steg: HTMLElement): string[] {
  return [...steg.querySelectorAll('.bandknapp .bandknapp__verdi')].map((k) => k.textContent ?? '')
}

describe('sidemenyen', () => {
  it('er stoffregisteret, og lenker hvert stoff til stoffsiden etter nøkkelen, med kodene som sekundær tekst', async () => {
    const user = userEvent.setup()
    visApp()
    await user.click(screen.getByRole('button', { name: 'Vis stoffregisteret' }))
    const meny = screen.getByRole('navigation', { name: 'Stoffregister' })
    // Søket i fortolkningen filtreres fra hovedsiden, ikke herfra.
    expect(within(meny).queryByRole('radio')).toBeNull()
    // Hver lenke i menyen går til en stoffside, aldri til en analyttkode.
    const adresser = [...meny.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')!)
    expect(adresser.length).toBeGreaterThan(20)
    // Utenom den ene lenken til hele stoffregisteret.
    expect(adresser.filter((a) => !/^#\/stoff\/[a-z0-9]+(-[a-z0-9]+)*$/.test(a))).toEqual(['#/stoffregister'])
    expect(within(meny).getByRole('link', { name: 'Åpne hele stoffregisteret' })).toBeTruthy()

    await user.click(within(meny).getByRole('button', { name: /^Antidepressiver/ }))
    expect(within(meny).getByRole('heading', { name: 'TCA' })).toBeTruthy()
    const bupropion = within(meny).getByRole('link', { name: /^Bupropion/ })
    expect(bupropion.getAttribute('href')).toBe('#/stoff/bupropion')
    expect(bupropion.querySelector('.menyanalytt__navn')?.textContent).toBe('Bupropion')
    expect(bupropion.querySelector('.menyanalytt__kode')?.textContent).toBe('HBUP')
    // Sumanalysen står ved stoffet den primært hører til.
    const amitriptylin = within(meny).getByRole('link', { name: /^Amitriptylin/ })
    expect(amitriptylin.getAttribute('href')).toBe('#/stoff/amitriptylin')
    expect(amitriptylin.querySelector('.menyanalytt__kode')?.textContent).toBe('AMTNORSUM')

    await user.click(bupropion)
    await stoffsideFor('Bupropion')
    expect(window.location.hash).toBe('#/stoff/bupropion')
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
  it('står i registeret, og fører til siden etter nøkkelen', async () => {
    const user = userEvent.setup()
    visApp()
    await user.click(screen.getByRole('button', { name: 'Vis stoffregisteret' }))
    // Teststoffet står ikke i registeret, og havner derfor i «Andre stoffer».
    await user.click(await screen.findByRole('button', { name: /^Andre stoffer/ }))
    // En vanlig bruker kan ikke lage nye sider.
    expect(screen.queryByLabelText('Ny fagside')).toBeNull()
    const lenke = screen.getByRole('link', { name: 'Teststoff' })
    expect(lenke.getAttribute('href')).toBe('#/stoff/teststoff')

    await user.click(lenke)
    await stoffsideFor('Teststoff')
    expect(window.location.hash).toBe('#/stoff/teststoff')
    expect(fortolkningen().hidden).toBe(true)
    expect(screen.queryByRole('button', { name: 'Åpne fortolkning' })).toBeNull()
    expect(databasen.kall).toContainEqual({ funksjon: 'les_stoff', argumenter: { stoff: 'teststoff', sidetilstand: 'publisert' } })
  })
})

describe('fortolkningssidene', () => {
  it('gir analytten som fortolkes, sin egen adresse, og tilbakeknappen går til søket med søket i behold', async () => {
    const user = userEvent.setup()
    visApp()
    await velgNortriptylin(user)
    expect(window.location.hash).toBe('#/fortolkning/nor')

    window.location.hash = '#/'
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Velg konsentrasjon' })).toBeNull())
    expect(within(fortolkningen()).getByRole('textbox', { name: 'Søk etter analytt eller kode' })).toHaveProperty('value', 'nor')
  })

  it('åpner analytten direkte fra adressen, også en modul med flere koder', async () => {
    window.location.hash = '#/fortolkning/nor'
    visApp()
    await screen.findByRole('region', { name: 'Velg konsentrasjon' })
    cleanup()

    window.location.hash = '#/fortolkning/diaz-dmi-oxa'
    visApp()
    await waitFor(() => expect(window.location.hash).toBe('#/fortolkning/diaz-dmi-oxa'))
    expect(await within(fortolkningen()).findByRole('link', { name: pillenavn('DMI', 'Diazepam') })).toBeTruthy()
  })

  it('går til søket for en analytt som ikke finnes, uten å legge noe i historikken', async () => {
    window.location.hash = '#/fortolkning/finnesikke'
    visApp()
    await waitFor(() => expect(window.location.hash).toBe('#/'))
    expect(within(fortolkningen()).getByRole('textbox', { name: 'Søk etter analytt eller kode' })).toBeTruthy()
  })
})

describe('adressene', () => {
  it('åpner en stoffside direkte fra adressen, med stoffnavnet som tittel', async () => {
    window.location.hash = '#/stoff/nortriptylin'
    visApp()
    await stoffsideFor('Nortriptylin')
    expect(document.title).toBe('Nortriptylin – OUSFAR')
  })

  it('følger tilbakeknappen', async () => {
    window.location.hash = '#/stoff/nortriptylin'
    visApp()
    await stoffsideFor('Nortriptylin')
    window.location.hash = '#/'
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    await waitFor(() => expect(fortolkningen().hidden).toBe(false))
    expect(screen.queryByRole('heading', { level: 1, name: 'Nortriptylin' })).toBeNull()
  })

  it.each([
    ['venlafaksin', 'Venlafaksin'],
    ['amitriptylin', 'Amitriptylin'],
    ['nortriptylin', 'Nortriptylin'],
    ['paliperidon', 'Paliperidon'],
    ['etanol', 'Etanol'],
    ['thc', 'THC'],
    ['bupropion', 'Bupropion'],
  ])('har stoffnavnet som tittel på #/stoff/%s', async (slug, navn) => {
    window.location.hash = `#/stoff/${slug}`
    visApp()
    const overskrift = await stoffsideFor(navn)
    expect(overskrift.textContent).toBe(navn)
    expect(document.title).toBe(`${navn} – OUSFAR`)
    expect(window.location.hash).toBe(`#/stoff/${slug}`)
    // Ingen kode, og ingen sammenslått tittel fra før («THC og THC-syre»).
    expect(within(stoffsiden()!).queryByText(/THC og THC-syre/)).toBeNull()
    expect(document.title).not.toMatch(/\(/)
  })
})

describe('gamle adresser etter analyttkoden', () => {
  it('åpner Bupropion-siden for #/analytt/HBUP, og skriver adressen om uten en ny oppføring i historikken', async () => {
    window.location.hash = '#/analytt/HBUP'
    const oppforinger = window.history.length
    const erstatt = vi.spyOn(window.history, 'replaceState')
    const legg = vi.spyOn(window.history, 'pushState')
    visApp()
    await stoffsideFor('Bupropion')
    await waitFor(() => expect(window.location.hash).toBe('#/stoff/bupropion'))
    expect(erstatt.mock.calls.map(([, , adresse]) => adresse)).toEqual(['#/stoff/bupropion'])
    expect(legg).not.toHaveBeenCalled()
    expect(window.history.length).toBe(oppforinger)
    expect(document.title).toBe('Bupropion – OUSFAR')
    // Koden er ikke sidens navn.
    expect(screen.queryByRole('heading', { level: 1, name: /HBUP|Hydroksybupropion/ })).toBeNull()
  })

  it.each([
    ['DMI', 'diazepam', 'Diazepam'],
    ['OTRAM', 'tramadol', 'Tramadol'],
    ['UETS', 'etanol', 'Etanol'],
    ['UETGS', 'etanol', 'Etanol'],
    ['IRCAK', 'thc', 'THC'],
    ['VENSUM', 'venlafaksin', 'Venlafaksin'],
    ['AMTNORSUM', 'amitriptylin', 'Amitriptylin'],
    ['RISPSUM', 'risperidon', 'Risperidon'],
    ['PALI', 'paliperidon', 'Paliperidon'],
    ['nor', 'nortriptylin', 'Nortriptylin'],
  ])('sender #/analytt/%s videre til #/stoff/%s', async (kode, slug, navn) => {
    window.location.hash = `#/analytt/${kode}`
    const erstatt = vi.spyOn(window.history, 'replaceState')
    visApp()
    await stoffsideFor(navn)
    await waitFor(() => expect(window.location.hash).toBe(`#/stoff/${slug}`))
    expect(erstatt.mock.calls.map(([, , adresse]) => adresse)).toEqual([`#/stoff/${slug}`])
  })

  it('sender seksjonen med fortolkningsreglene til seksjonen for koden på stoffsiden', async () => {
    window.location.hash = '#/analytt/IRCAK/fortolkning'
    visApp()
    await stoffsideFor('THC')
    await waitFor(() => expect(window.location.hash).toBe('#/stoff/thc/fortolkning-ircak'))
  })

  it('åpner ingen fagside for en kode som ikke er koblet til noe stoff', async () => {
    window.location.hash = '#/analytt/FINNESIKKE'
    const erstatt = vi.spyOn(window.history, 'replaceState')
    visApp()
    await waitFor(() => expect(fortolkningen().hidden).toBe(false))
    expect(stoffsiden()).toBeNull()
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull()
    expect(screen.queryByText(/Fant ingen fagside/)).toBeNull()
    expect(erstatt).not.toHaveBeenCalled()
    expect(databasen.kall.filter((k) => k.funksjon === 'les_stoff')).toEqual([])
  })
})

describe('kodepillene i fortolkningen', () => {
  it.each([
    ['HBUP', 'Bupropion', '#/stoff/bupropion'],
    ['DMI', 'Diazepam', '#/stoff/diazepam'],
    ['OTRAM', 'Tramadol', '#/stoff/tramadol'],
    ['IRCAK', 'THC', '#/stoff/thc'],
    ['UETGS', 'Etanol', '#/stoff/etanol'],
    ['UETS', 'Etanol', '#/stoff/etanol'],
    ['AMTNORSUM', 'Amitriptylin', '#/stoff/amitriptylin'],
    ['NOR', 'Nortriptylin', '#/stoff/nortriptylin'],
  ])('fører %s til stoffsiden for %s, uten at koden blir tittel eller adresse', async (kode, navn, adresse) => {
    const user = userEvent.setup()
    visApp()
    const pille = await velgKode(user, kode, navn)
    expect(pille.getAttribute('href')).toBe(adresse)
    expect(pille.textContent).toBe(kode)

    await user.click(pille)
    await stoffsideFor(navn)
    expect(window.location.hash).toBe(adresse)
    await waitFor(() => expect(document.title).toBe(`${navn} – OUSFAR`))
    expect(screen.queryByRole('heading', { level: 1, name: kode })).toBeNull()
    expect(window.location.hash).not.toContain(kode)
  })
})

describe('mellom fortolkningen og stoffsiden', () => {
  it('går fra kodepillen til siden og tilbake til samme modul', async () => {
    const user = userEvent.setup()
    visApp()
    await velgNortriptylin(user)
    const pille = await screen.findByRole('link', { name: pillenavn('NOR', 'Nortriptylin') })
    expect(pille.getAttribute('href')).toBe('#/stoff/nortriptylin')

    await user.click(pille)
    await stoffsideFor('Nortriptylin')
    expect(fortolkningen().hidden).toBe(true)

    await user.click(screen.getByRole('button', { name: 'Åpne fortolkning' }))
    await waitFor(() => expect(fortolkningen().hidden).toBe(false))
    expect(window.location.hash).toBe('#/fortolkning/nor')
    expect(within(fortolkningen()).getByRole('link', { name: pillenavn('NOR', 'Nortriptylin') })).toBeTruthy()
  })

  it('har «Åpne fagside» i toppmenyen mens en modul fortolkes, og kommer tilbake til samme modul', async () => {
    const user = userEvent.setup()
    visApp()
    // Uten valgt analytt er det ingen stoffside å åpne.
    expect(screen.queryByRole('button', { name: 'Åpne fagside' })).toBeNull()
    await velgNortriptylin(user)

    await user.click(screen.getByRole('button', { name: 'Åpne fagside' }))
    await stoffsideFor('Nortriptylin')
    expect(window.location.hash).toBe('#/stoff/nortriptylin')
    // Stoffsiden har sine egne handlinger i stedet.
    expect(screen.queryByRole('button', { name: 'Åpne fagside' })).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Åpne fortolkning' }))
    await waitFor(() => expect(fortolkningen().hidden).toBe(false))
    expect(await screen.findByRole('region', { name: 'Velg konsentrasjon' })).toBeTruthy()
  })

  it('går fra «Åpne fagside» mens HBUP fortolkes til Bupropion-siden', async () => {
    const user = userEvent.setup()
    visApp()
    await velgKode(user, 'HBUP', 'Bupropion')
    await user.click(screen.getByRole('button', { name: 'Åpne fagside' }))
    await stoffsideFor('Bupropion')
    expect(window.location.hash).toBe('#/stoff/bupropion')
  })

  it('åpner HBUP-modulen fra «Åpne fortolkning» på Bupropion-siden, med reglene lest etter koden', async () => {
    const user = userEvent.setup()
    window.location.hash = '#/stoff/bupropion'
    visApp()
    await stoffsideFor('Bupropion')
    // Reglene på siden er HBUP-regelsettet, lest etter koden.
    const regler = (await screen.findByRole('heading', { level: 2, name: 'Fortolkning' })).closest('section')!
    expect(regler.textContent).toContain('Kommentaren fortolkningen gir for HBUP, etter målt konsentrasjon.')
    // Identitetspanelet sier hva HBUP er for stoffet, som sekundær informasjon.
    const identitet = document.querySelector('.identitet')!
    expect(within(identitet as HTMLElement).getByRole('button', { name: 'HBUP – åpne fortolkningen' })).toBeTruthy()
    expect(identitet.querySelector('.identitet__komponenter')?.textContent).toBe(
      'HBUP måler hydroksybupropion (kun aktiv metabolitt), en metabolitt av bupropion. ' +
        'Analytten er hydroksybupropion. Referanseområdet gjelder behandling med bupropion.',
    )

    await user.click(screen.getByRole('button', { name: 'Åpne fortolkning' }))
    await waitFor(() => expect(fortolkningen().hidden).toBe(false))
    expect(window.location.hash).toBe('#/fortolkning/hbup')
    const steg = within(fortolkningen()).getByRole('region', { name: 'Velg konsentrasjon' })
    expect(within(steg).getByRole('heading', { level: 1 }).textContent).toMatch(/^Hydroksybupropion/)
    expect(within(steg).getByRole('link', { name: pillenavn('HBUP', 'Bupropion') })).toBeTruthy()
    // Knappene er HBUP-regelsettets.
    const hbup = regelsettvalg(dagensRegelsett('HBUP')).map((v) => v.label)
    await waitFor(() => expect(knappene(steg)).toEqual(hbup))

    // Reglene er lest etter analyttkoden. Stoffets nøkkel er bare brukt til å
    // lese monografien — det finnes ikke noe regelsett for Bupropion — og
    // diskusjonene på siden.
    expect(
      databasen.kall.filter((k) => k.funksjon === 'finn_intervallregelsett').map((k) => k.argumenter.analyttkode),
    ).toEqual(['HBUP'])
    const etterStoffet = databasen.kall.filter((k) =>
      Object.values(k.argumenter).some((v) => typeof v === 'string' && /bupropion/i.test(v)),
    )
    expect(etterStoffet.map((k) => k.funksjon).filter((f) => f !== 'diskusjonsoversikt')).toEqual(['les_stoff'])
  })

  it('har ingen felles «Åpne fortolkning» på THC-siden, men en kodeknapp for THC og for IRCAK', async () => {
    const user = userEvent.setup()
    window.location.hash = '#/stoff/thc'
    visApp()
    await stoffsideFor('THC')
    // THC og IRCAK fortolkes i hver sin modul, med hver sin seksjon på siden.
    expect(await screen.findByRole('heading', { level: 2, name: 'Fortolkningsregler – THC' })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2, name: 'Fortolkningsregler – THC-syre i urin' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Åpne fortolkning' })).toBeNull()
    expect(screen.getByRole('button', { name: 'THC – åpne fortolkningen' })).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'IRCAK – åpne fortolkningen' }))
    await waitFor(() => expect(fortolkningen().hidden).toBe(false))
    expect(await within(fortolkningen()).findByRole('link', { name: pillenavn('IRCAK', 'THC') })).toBeTruthy()
    expect(within(fortolkningen()).queryByRole('region', { name: 'Velg konsentrasjon' })).toBeNull()
  })

  it('åpner riktig modul fra en stoffside, også for koder som deler modul', async () => {
    const user = userEvent.setup()
    window.location.hash = '#/stoff/oksazepam'
    visApp()
    await stoffsideFor('Oksazepam')
    await user.click(screen.getByRole('button', { name: 'Åpne fortolkning' }))
    await waitFor(() => expect(fortolkningen().hidden).toBe(false))
    // DIAZ og metabolitten DMI er koblet til diazepam; OXA til oksazepam.
    const pillene = [...fortolkningen().querySelectorAll('.metalinje a')].map((a) => [
      a.textContent,
      a.getAttribute('href'),
    ])
    expect(pillene).toEqual([
      ['DIAZ', '#/stoff/diazepam'],
      ['DMI', '#/stoff/diazepam'],
      ['OXA', '#/stoff/oksazepam'],
    ])
    // Modulen har koder for to stoffer, og dermed én knapp til hver stoffside.
    expect(screen.queryByRole('button', { name: 'Åpne fagside' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Åpne fagsiden for Diazepam' }).textContent).toBe('Diazepam')
    // Modulen fortolker med reglene appen hentet.
    await user.click(within(fortolkningen()).getByRole('checkbox', { name: /Oksazepam/ }))
    expect(within(fortolkningen()).getByRole('button', { name: 'Kopier hovedkommentar' })).toBeTruthy()
    // Knappen for et av stoffene fører til stoffsiden for det.
    await user.click(screen.getByRole('button', { name: 'Åpne fagsiden for Oksazepam' }))
    await stoffsideFor('Oksazepam')
  })

  it('lar fortolkningen ligge i ro mens stoffsiden vises', async () => {
    // Utklippstavlen er user-events egen, og er tom når testen starter.
    const user = userEvent.setup()
    visApp()
    await velgNortriptylin(user)
    const pille = await screen.findByRole('link', { name: pillenavn('NOR', 'Nortriptylin') })
    await user.click(pille)
    await stoffsideFor('Nortriptylin')

    // Talltastene velger bånd i fortolkningen, men ikke herfra.
    await user.keyboard('1')
    await user.keyboard('{Enter}')
    expect(await navigator.clipboard.readText()).toBe('')

    // Esc lukker siden, og fortolkningen står der den sto.
    await user.keyboard('{Escape}')
    await waitFor(() => expect(fortolkningen().hidden).toBe(false))
    expect(within(fortolkningen()).getByRole('link', { name: pillenavn('NOR', 'Nortriptylin') })).toBeTruthy()
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
    // Databasen her har ingen side for kvetiapin, men stoffet står i
    // registeret og er indeksert likevel, med adressen etter nøkkelen.
    const sokesiden = screen.getByRole('region', { name: '«kvetiapin»' })
    const treff = await within(sokesiden).findByRole('link', { name: /Kvetiapin/ })
    expect(treff.getAttribute('href')).toBe('#/stoff/kvetiapin')
  })
})
