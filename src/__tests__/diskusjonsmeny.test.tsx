// @vitest-environment jsdom
/**
 * Diskusjonsmenyen til høyre på en fagside eller fortolkningsside: kolonnen
 * med «Hold åpen» og emojiene, åpning og lukking med pekeren, kategoriene og
 * trådene, en ny tråd med ny kategori, søket, arkivet, én tråd med det bare
 * forfatteren eller en administrator ser, sletting og flytting til en annen
 * side, og en tråd åpnet fra et varsel.
 *
 * Økten og kallene mot databasen er erstattet; det er skjermbildene som prøves.
 * Dra-og-slipp prøves ikke her: testmiljøet har ingen peker (se `useSortering`).
 */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Profil } from '@delt/profil'
import type { Diskusjonsoversikt, Diskusjonssider, Diskusjonstraad } from '../diskusjoner/modell'

function profil(id: string, fornavn: string, ekstra: Partial<Profil> = {}): Profil {
  return {
    id,
    username: fornavn.toLowerCase(),
    first_name: fornavn,
    last_name: 'Nordmann',
    role: 'user',
    avatar_path: null,
    must_change_password: false,
    onboarding_completed: true,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
    ...ekstra,
  }
}

const tilstand = vi.hoisted(() => ({ meg: null as unknown as Profil }))
const KARI = profil('kari', 'Kari')
const OLA = profil('ola', 'Ola')
const ADMIN = profil('admin', 'Anne', { role: 'admin' })

const DOK = (tekst: string) => ({ type: 'doc' as const, content: [{ type: 'paragraph', content: [{ type: 'text', text: tekst }] }] })
const KL = '2026-09-30T10:00:00Z'

const traad = (id: string, kategori_id: string | null, posisjon: number, tittel: string, ekstra = {}) => ({
  id,
  kategori_id,
  forfatter_id: 'ola',
  tittel,
  posisjon,
  opprettet_kl: KL,
  arkivert_kl: null,
  siste_kl: KL,
  kommentarer: 1,
  nye_kommentarer: 0,
  usett: false,
  hjerter: 0,
  mitt_hjerte: false,
  ...ekstra,
})

const OVERSIKT: Diskusjonsoversikt = {
  kategorier: [
    { id: 'dos', navn: 'Dosering', emoji: '💊', posisjon: 0 },
    { id: 'biv', navn: 'Bivirkninger', emoji: '🩺', posisjon: 1 },
  ],
  diskusjoner: [
    traad('t1', 'dos', 0, 'Nyresvikt', { usett: true, nye_kommentarer: 1 }),
    traad('t2', 'dos', 1, 'Barn'),
    traad('t3', 'biv', 0, 'Kvalme', { usett: true }),
    traad('t4', null, 0, 'Uten hjem'),
    traad('t5', 'biv', 1, 'Gammel sak', { arkivert_kl: '2026-09-29T10:00:00Z' }),
  ],
}

const TRAAD: Diskusjonstraad = {
  id: 't1',
  side: 'stoff:litium',
  kategori_id: 'dos',
  forfatter_id: 'ola',
  tittel: 'Nyresvikt',
  tekst: DOK('Hvordan doserer vi ved nyresvikt?'),
  skjult: false,
  opprettet_kl: KL,
  endret_kl: null,
  arkivert_kl: null,
  hjerter: 1,
  mitt_hjerte: false,
  lest_kl: '2026-09-30T12:00:00Z',
  sist_sett: null,
  kommentarer: [
    { id: 'k1', forelder_id: null, forfatter_id: 'kari', tekst: DOK('Halver dosen.'), slettet: false, skjult: false, opprettet_kl: KL, endret_kl: null, hjerter: 0, mitt_hjerte: false },
    { id: 'k2', forelder_id: null, forfatter_id: 'ola', tekst: DOK('Takk!'), slettet: false, skjult: false, opprettet_kl: KL, endret_kl: null, hjerter: 0, mitt_hjerte: false },
  ],
}

const SIDER: Diskusjonssider = {
  fagsider: [
    { side: 'stoff:litium', navn: 'Litium' },
    { side: 'stoff:valproat', navn: 'Valproat' },
  ],
  fortolkninger: [{ side: 'fortolkning:li', navn: 'Fortolkning av Litium' }],
}

/** Diskusjonene på siden en tråd flyttes til. */
const VALPROAT: Diskusjonsoversikt = {
  kategorier: [{ id: 'vdos', navn: 'Dosering', emoji: '💊', posisjon: 0 }],
  diskusjoner: [],
}

const api = vi.hoisted(() => ({
  hentDiskusjoner: vi.fn(),
  hentDiskusjonstraad: vi.fn(),
  hentDiskusjonstekster: vi.fn(),
  merkDiskusjonSett: vi.fn(async () => {}),
  opprettKategori: vi.fn(async () => 'ny-kat'),
  endreKategori: vi.fn(async () => {}),
  flyttKategoriTil: vi.fn(async () => {}),
  losOppKategori: vi.fn(async () => {}),
  opprettDiskusjon: vi.fn(async () => 'ny-traad'),
  settTittel: vi.fn(async () => {}),
  settTekst: vi.fn(async () => {}),
  flyttDiskusjonTil: vi.fn(async () => {}),
  arkiverDiskusjon: vi.fn(async () => {}),
  flyttDiskusjonTilSide: vi.fn(async () => {}),
  slettDiskusjon: vi.fn(async () => {}),
  skjulInnhold: vi.fn(async () => {}),
  opprettKommentar: vi.fn(async () => {}),
  endreKommentar: vi.fn(async () => {}),
  slettKommentar: vi.fn(async () => {}),
  settHjerte: vi.fn(async () => {}),
  hentLaast: vi.fn(),
  lagreLaast: vi.fn(async () => {}),
  hentBredde: vi.fn(),
  lagreBredde: vi.fn(async () => {}),
}))

vi.mock('../diskusjoner/api', () => api)
vi.mock('../auth/okt', () => ({ useProfil: () => tilstand.meg, useOkt: () => ({}) }))
vi.mock('../auth/avatarer', () => ({ useAvatarlenker: () => new Map() }))
vi.mock('../auth/api', () => ({ hentAlleProfiler: vi.fn(async () => [KARI, OLA, ADMIN]) }))

const { Diskusjonsmeny } = await import('../components/diskusjoner/Diskusjonsmeny')
const { taDiskusjon, visDiskusjon } = await import('../components/diskusjoner/diskusjonsvisning')

beforeAll(() => {
  Element.prototype.scrollIntoView ??= function () {}
  Element.prototype.scrollTo ??= function () {}
  // TipTap måler markøren; jsdom har ingen oppsett å måle i.
  document.elementFromPoint ??= () => null
  Range.prototype.getClientRects ??= () => ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] }) as unknown as DOMRectList
  Range.prototype.getBoundingClientRect ??= () => new DOMRect()
})

beforeEach(() => {
  tilstand.meg = KARI
  api.hentDiskusjoner.mockImplementation(async (side: string) => (side === 'stoff:valproat' ? VALPROAT : OVERSIKT))
  api.hentDiskusjonstraad.mockResolvedValue(TRAAD)
  api.hentDiskusjonstekster.mockResolvedValue([
    { id: 't2', tittel: 'Barn', tekster: ['Dosering hos barn under 12 år'] },
    { id: 't5', tittel: 'Gammel sak', tekster: ['Kvalme og dosering'] },
  ])
  api.hentLaast.mockResolvedValue(null)
  api.hentBredde.mockResolvedValue(null)
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const meny = () => screen.getByRole('complementary', { name: 'Diskusjoner om Litium' })
const panel = () => meny().querySelector<HTMLElement>('.diskusjonspanel')!
const stolpe = () => meny().querySelector<HTMLElement>('.diskusjonsstolpe')!

async function vis() {
  const bruker = userEvent.setup()
  render(<Diskusjonsmeny side="stoff:litium" sidenavn="Litium" sider={SIDER} />)
  await within(stolpe()).findByRole('button', { name: 'Dosering, 1 med nytt' })
  return bruker
}

async function apne() {
  const bruker = await vis()
  fireEvent.mouseEnter(meny())
  await within(panel()).findByRole('heading', { name: /^Dosering/ })
  return bruker
}

describe('kolonnen', () => {
  it('har «Hold åpen» øverst og emojiene med et merke der noe er nytt, også for «Ukategoriserte»', async () => {
    await vis()
    expect(panel().hidden).toBe(true)
    const knapper = within(stolpe()).getAllByRole('button').map((b) => b.getAttribute('aria-label'))
    expect(knapper).toEqual(['Hold diskusjonene åpne', 'Vis diskusjonene', 'Ukategoriserte', 'Dosering, 1 med nytt', 'Bivirkninger, 1 med nytt'])
    expect(document.documentElement.dataset.diskusjonsmeny).toBe('smal')
  })

  it('lukkes med Escape uten at tasten går videre til siden bak', async () => {
    await apne()
    const bak = vi.fn()
    window.addEventListener('keydown', bak)
    fireEvent.keyDown(within(panel()).getByRole('searchbox', { name: 'Søk i trådene' }), { key: 'Escape' })
    window.removeEventListener('keydown', bak)
    expect(bak).not.toHaveBeenCalled()
  })

  it('åpner seg når pekeren kommer inn og lukker seg når den går ut', async () => {
    await apne()
    expect(stolpe().hidden).toBe(true)
    fireEvent.mouseLeave(meny())
    expect(panel().hidden).toBe(true)
  })

  it('står åpen når den holdes åpen, lagrer det på brukeren og gir plass i appen', async () => {
    const bruker = await apne()
    await bruker.click(within(panel()).getByRole('button', { name: 'Hold diskusjonene åpne' }))
    expect(api.lagreLaast).toHaveBeenCalledWith(true)
    fireEvent.mouseLeave(meny())
    expect(panel().hidden).toBe(false)
    expect(document.documentElement.dataset.diskusjonsmeny).toBe('laast')
  })

  it('står åpen fra start når brukeren har valgt det', async () => {
    api.hentLaast.mockResolvedValue(true)
    render(<Diskusjonsmeny side="stoff:litium" sidenavn="Litium" sider={SIDER} />)
    await waitFor(() => expect(panel().hidden).toBe(false))
  })

  it('har en kant som kan dras når den er åpen, og står i bredden brukeren har dratt den til', async () => {
    api.hentBredde.mockResolvedValue(600)
    const { unmount } = render(<Diskusjonsmeny side="stoff:litium" sidenavn="Litium" sider={SIDER} />)
    const rot = document.documentElement.style
    await waitFor(() => expect(rot.getPropertyValue('--diskusjonsbredde')).toBe('600px'))
    expect(within(meny()).queryByRole('separator', { name: 'Bredden på diskusjonene' })).toBeNull()
    fireEvent.mouseEnter(meny())
    expect(within(meny()).getByRole('separator', { name: 'Bredden på diskusjonene' })).toBeTruthy()
    unmount()
    expect(rot.getPropertyValue('--diskusjonsbredde')).toBe('')
  })

  it('lar bredden brukeren endrer, vinne over en lagret bredde som kommer for sent', async () => {
    let svar: (bredde: number) => void = () => undefined
    api.hentBredde.mockReturnValue(new Promise((ferdig) => (svar = ferdig)))
    await apne()
    fireEvent.keyDown(within(meny()).getByRole('separator', { name: 'Bredden på diskusjonene' }), { key: 'Home' })
    const valgt = document.documentElement.style.getPropertyValue('--diskusjonsbredde')
    await act(async () => svar(600))
    expect(document.documentElement.style.getPropertyValue('--diskusjonsbredde')).toBe(valgt)
  })
})

describe('lista', () => {
  it('viser kategoriene med trådene i rekkefølge, «Ukategoriserte» øverst og arkivet lukket nederst', async () => {
    await apne()
    const kategorier = within(panel()).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    expect(kategorier).toEqual(['🫧Ukategoriserte', '💊Dosering1', '🩺Bivirkninger1', 'Arkiv1'])
    const dosering = panel().querySelector<HTMLElement>('[data-kategori="dos"]')!
    expect(within(dosering).getAllByRole('button', { name: /Nyresvikt|Barn/ }).map((b) => b.dataset.traad)).toEqual(['t1', 't2'])
    expect(within(dosering).getByRole('button', { name: /Nyresvikt/ }).querySelector('.nyttprikk')).toBeTruthy()
    // «Ukategoriserte» har ingen knapp for en ny tråd.
    const uten = panel().querySelector<HTMLElement>('.diskusjonskategori--ukategorisert')!
    expect(within(uten).queryByRole('button', { name: 'Ny tråd' })).toBeNull()
    expect(within(panel()).queryByRole('button', { name: /Gammel sak/ })).toBeNull()
  })

  it('flytter en kategori med knappene og lagrer plassen', async () => {
    const bruker = await apne()
    await bruker.click(within(panel()).getByRole('button', { name: 'Handlinger for Dosering' }))
    await bruker.click(within(panel()).getByRole('button', { name: 'Flytt ned' }))
    expect(api.flyttKategoriTil).toHaveBeenCalledWith('dos', 1)
    const kategorier = [...panel().querySelectorAll('.kategoriliste > li')].map((li) => li.getAttribute('data-kategori'))
    expect(kategorier).toEqual(['biv', 'dos'])
  })

  it('løser opp en kategori etter en bekreftelse', async () => {
    const bruker = await apne()
    await bruker.click(within(panel()).getByRole('button', { name: 'Handlinger for Bivirkninger' }))
    await bruker.click(within(panel()).getByRole('button', { name: 'Løs opp Bivirkninger' }))
    expect(api.losOppKategori).not.toHaveBeenCalled()
    await bruker.click(within(panel()).getByRole('button', { name: /Bekreft at Bivirkninger løses opp/ }))
    expect(api.losOppKategori).toHaveBeenCalledWith('biv')
  })

  it('søker i overskriftene og innleggene, også i arkivet, og viser et utdrag', async () => {
    const bruker = await apne()
    await bruker.type(within(panel()).getByRole('searchbox', { name: 'Søk i trådene' }), 'dosering')
    const treff = await within(panel()).findByRole('list', { name: 'Treff' })
    expect(api.hentDiskusjonstekster).toHaveBeenCalledWith('stoff:litium')
    expect(within(treff).getAllByRole('button').map((b) => b.dataset.traad)).toEqual(['t2', 't5'])
    expect(treff.textContent).toContain('Dosering hos barn under 12 år')
  })
})

describe('en ny tråd', () => {
  it('lages i en ny kategori, med feil for et navn eller en emoji som er tatt eller reservert', async () => {
    const bruker = await apne()
    await bruker.click(within(panel()).getAllByRole('button', { name: 'Ny tråd' }).at(-1)!)
    const skjema = within(panel()).getByRole('form', { name: 'Ny tråd' })
    await bruker.selectOptions(within(skjema).getByRole('combobox', { name: 'Kategori' }), '＋ Ny kategori …')
    await bruker.type(within(skjema).getByRole('textbox', { name: 'Kategori' }), 'dosering')
    await bruker.type(within(skjema).getByRole('textbox', { name: 'Emoji' }), '🫧')
    await bruker.type(within(skjema).getByRole('textbox', { name: 'Overskrift' }), 'Interaksjoner')
    await bruker.click(within(skjema).getByRole('button', { name: 'Publiser' }))
    expect(within(skjema).getByRole('alert').textContent).toMatch(/reservert/)

    await bruker.click(within(skjema).getByRole('button', { name: '🧪' }))
    expect(within(skjema).getByRole('alert').textContent).toBe('En annen kategori på siden har det navnet.')
    const navn = within(skjema).getByRole('textbox', { name: 'Kategori' })
    await bruker.clear(navn)
    await bruker.type(navn, 'Interaksjoner')
    await bruker.click(within(skjema).getByRole('button', { name: 'Publiser' }))
    expect(api.opprettDiskusjon).toHaveBeenCalledWith('stoff:litium', {
      tittel: 'Interaksjoner',
      tekst: null,
      kategori: { navn: 'Interaksjoner', emoji: '🧪' },
    })
    await within(panel()).findByRole('heading', { name: 'Nyresvikt' })
  })

  it('begynner i kategorien den ble startet fra', async () => {
    const bruker = await apne()
    const biv = panel().querySelector<HTMLElement>('[data-kategori="biv"]')!
    await bruker.click(within(biv).getByRole('button', { name: 'Ny tråd' }))
    const valg = within(panel()).getByRole('combobox', { name: 'Kategori' }) as HTMLSelectElement
    expect(valg.value).toBe('biv')
  })
})

describe('én tråd', () => {
  it('merkes som sett, og lar alle arkivere og endre overskriften, men bare forfatteren endre innlegget', async () => {
    const bruker = await apne()
    await bruker.click(within(panel()).getByRole('button', { name: /Nyresvikt/ }))
    await within(panel()).findByText('Hvordan doserer vi ved nyresvikt?')
    await waitFor(() => expect(api.merkDiskusjonSett).toHaveBeenCalledWith(TRAAD))
    // Tråden holder menyen åpen.
    fireEvent.mouseLeave(meny())
    expect(panel().hidden).toBe(false)

    expect(within(panel()).queryByRole('button', { name: 'Rediger innlegget' })).toBeNull()
    expect(within(panel()).getByRole('button', { name: 'Endre overskrift' })).toBeTruthy()
    // Egen kommentar kan slettes, andres ikke.
    const kommentarer = panel().querySelectorAll<HTMLElement>('.kommentar')
    expect(within(kommentarer[0]!).getByRole('button', { name: 'Slett kommentaren' })).toBeTruthy()
    expect(within(kommentarer[1]!).queryByRole('button', { name: 'Slett kommentaren' })).toBeNull()

    await bruker.click(within(panel()).getByRole('button', { name: 'Legg tråden i arkivet' }))
    await bruker.click(within(panel()).getByRole('button', { name: 'Bekreft at tråden legges i arkivet' }))
    expect(api.arkiverDiskusjon).toHaveBeenCalledWith('t1', true)
  })

  it('har «Alle tråder» fast over tråden, utenfor det som rulles, som søket i lista', async () => {
    const bruker = await apne()
    const kropp = panel().querySelector<HTMLElement>('.diskusjonspanel__kropp')!
    expect(kropp.contains(within(panel()).getByRole('searchbox', { name: 'Søk i trådene' }))).toBe(false)
    await bruker.click(within(panel()).getByRole('button', { name: /Nyresvikt/ }))
    await within(panel()).findByText('Hvordan doserer vi ved nyresvikt?')
    const tilbake = within(panel()).getByRole('button', { name: 'Alle tråder' })
    expect(kropp.contains(tilbake)).toBe(false)
    expect(within(panel()).queryByRole('searchbox')).toBeNull()
    await bruker.click(tilbake)
    expect(within(panel()).queryByRole('button', { name: 'Alle tråder' })).toBeNull()
    expect(within(panel()).getByRole('heading', { name: /^Dosering/ })).toBeTruthy()
  })

  it('lar en administrator skjule innhold, men ikke slette andres kommentarer', async () => {
    tilstand.meg = ADMIN
    const bruker = await apne()
    await bruker.click(within(panel()).getByRole('button', { name: /Nyresvikt/ }))
    await within(panel()).findByText('Hvordan doserer vi ved nyresvikt?')
    expect(within(panel()).queryByRole('button', { name: 'Slett kommentaren' })).toBeNull()
    await bruker.click(within(panel()).getByRole('button', { name: 'Skjul innholdet i innlegget' }))
    await bruker.click(within(panel()).getByRole('button', { name: 'Bekreft at innholdet i innlegget skjules for godt' }))
    expect(api.skjulInnhold).toHaveBeenCalledWith('t1', null)
    const kommentar = panel().querySelectorAll<HTMLElement>('.kommentar')[0]!
    await bruker.click(within(kommentar).getByRole('button', { name: 'Skjul innholdet i kommentaren' }))
    await bruker.click(within(kommentar).getByRole('button', { name: 'Bekreft at innholdet i kommentaren skjules for godt' }))
    expect(api.skjulInnhold).toHaveBeenCalledWith('t1', 'k1')
  })

  it('er frosset i arkivet til den hentes tilbake', async () => {
    api.hentDiskusjonstraad.mockResolvedValue({ ...TRAAD, arkivert_kl: '2026-09-29T10:00:00Z' })
    const bruker = await apne()
    await bruker.click(within(panel()).getByRole('button', { name: /Nyresvikt/ }))
    await within(panel()).findByText(/Tråden kan leses, men ikke endres/)
    expect(within(panel()).queryByRole('button', { name: 'Endre overskrift' })).toBeNull()
    expect(within(panel()).queryByRole('button', { name: 'Svar' })).toBeNull()
    await bruker.click(within(panel()).getByRole('button', { name: 'Hent tilbake' }))
    expect(api.arkiverDiskusjon).toHaveBeenCalledWith('t1', false)
  })

  it('lar heller ikke en administrator skjule noe i arkivet', async () => {
    tilstand.meg = ADMIN
    api.hentDiskusjonstraad.mockResolvedValue({ ...TRAAD, arkivert_kl: '2026-09-29T10:00:00Z' })
    const bruker = await apne()
    await bruker.click(within(panel()).getByRole('button', { name: /Nyresvikt/ }))
    await within(panel()).findByText(/Tråden kan leses, men ikke endres/)
    expect(within(panel()).queryByRole('button', { name: /^Skjul innholdet/ })).toBeNull()
  })

  it('kan slettes av den som startet den bare til andre har skrevet i den', async () => {
    tilstand.meg = OLA
    const bruker = await apne()
    await bruker.click(within(panel()).getByRole('button', { name: /Nyresvikt/ }))
    await within(panel()).findByText('Hvordan doserer vi ved nyresvikt?')
    // Kari har kommentert.
    expect(within(panel()).queryByRole('button', { name: 'Slett tråden' })).toBeNull()
    cleanup()

    api.hentDiskusjonstraad.mockResolvedValue({ ...TRAAD, kommentarer: TRAAD.kommentarer.filter((k) => k.forfatter_id === 'ola') })
    const igjen = await apne()
    await igjen.click(within(panel()).getByRole('button', { name: /Nyresvikt/ }))
    await within(panel()).findByText('Hvordan doserer vi ved nyresvikt?')
    await igjen.click(within(panel()).getByRole('button', { name: 'Slett tråden' }))
    expect(api.slettDiskusjon).not.toHaveBeenCalled()
    const hentinger = api.hentDiskusjonstraad.mock.calls.length
    await igjen.click(within(panel()).getByRole('button', { name: 'Bekreft sletting av tråden' }))
    expect(api.slettDiskusjon).toHaveBeenCalledWith('t1')
    // Tilbake i lista, uten å prøve å hente den slettede tråden igjen.
    await within(panel()).findByRole('heading', { name: /^Dosering/ })
    expect(api.hentDiskusjonstraad).toHaveBeenCalledTimes(hentinger)
  })

  it('kan ikke slettes av andre, men av en administrator, også i arkivet', async () => {
    const bruker = await apne()
    await bruker.click(within(panel()).getByRole('button', { name: /Nyresvikt/ }))
    await within(panel()).findByText('Hvordan doserer vi ved nyresvikt?')
    expect(within(panel()).queryByRole('button', { name: 'Slett tråden' })).toBeNull()
    cleanup()

    tilstand.meg = ADMIN
    api.hentDiskusjonstraad.mockResolvedValue({ ...TRAAD, arkivert_kl: '2026-09-29T10:00:00Z' })
    const admin = await apne()
    await admin.click(within(panel()).getByRole('button', { name: /Nyresvikt/ }))
    await within(panel()).findByText(/Tråden kan leses, men ikke endres/)
    expect(within(panel()).getByRole('button', { name: 'Slett tråden' })).toBeTruthy()
    // En arkivert tråd flyttes ikke til en annen side.
    expect(within(panel()).queryByRole('button', { name: 'Flytt til en annen side' })).toBeNull()
  })

  it('flyttes til en annen side, i en kategori der, og følges dit', async () => {
    const bruker = await apne()
    await bruker.click(within(panel()).getByRole('button', { name: /Nyresvikt/ }))
    await within(panel()).findByText('Hvordan doserer vi ved nyresvikt?')
    await bruker.click(within(panel()).getByRole('button', { name: 'Flytt til en annen side' }))
    const skjema = within(panel()).getByRole('form', { name: 'Flytt tråden' })
    const sidevalg = within(skjema).getByRole('combobox', { name: 'Side' }) as HTMLSelectElement
    // Siden tråden står på, er ikke blant valgene.
    expect([...sidevalg.options].map((o) => o.value)).toEqual(['', 'stoff:valproat', 'fortolkning:li'])
    expect(within(skjema).getByRole('button', { name: 'Flytt' })).toHaveProperty('disabled', true)

    await bruker.selectOptions(sidevalg, 'Valproat')
    const kategori = (await within(skjema).findByRole('combobox', { name: 'Kategori' })) as HTMLSelectElement
    expect(api.hentDiskusjoner).toHaveBeenCalledWith('stoff:valproat')
    expect(kategori.value).toBe('vdos')
    await bruker.click(within(skjema).getByRole('button', { name: 'Flytt' }))
    expect(api.flyttDiskusjonTilSide).toHaveBeenCalledWith('t1', 'stoff:valproat', { id: 'vdos' })
    await waitFor(() => expect(window.location.hash).toBe('#/stoff/valproat'))
    // Menyen på den siden åpner tråden.
    expect(taDiskusjon('stoff:valproat')).toEqual({ diskusjon: 't1', kommentar: null })
  })

  it('flyttes til en ny kategori på den andre siden, med samme regler for navn og emoji', async () => {
    const bruker = await apne()
    await bruker.click(within(panel()).getByRole('button', { name: /Nyresvikt/ }))
    await within(panel()).findByText('Hvordan doserer vi ved nyresvikt?')
    await bruker.click(within(panel()).getByRole('button', { name: 'Flytt til en annen side' }))
    const skjema = within(panel()).getByRole('form', { name: 'Flytt tråden' })
    await bruker.selectOptions(within(skjema).getByRole('combobox', { name: 'Side' }), 'Valproat')
    await bruker.selectOptions(await within(skjema).findByRole('combobox', { name: 'Kategori' }), '＋ Ny kategori …')
    await bruker.type(within(skjema).getByRole('textbox', { name: 'Kategori' }), 'Dosering')
    await bruker.click(within(skjema).getByRole('button', { name: '🧪' }))
    await bruker.click(within(skjema).getByRole('button', { name: 'Flytt' }))
    expect(within(skjema).getByRole('alert').textContent).toBe('En annen kategori på siden har det navnet.')
    expect(api.flyttDiskusjonTilSide).not.toHaveBeenCalled()

    const navn = within(skjema).getByRole('textbox', { name: 'Kategori' })
    await bruker.clear(navn)
    await bruker.type(navn, 'Graviditet')
    await bruker.click(within(skjema).getByRole('button', { name: 'Flytt' }))
    expect(api.flyttDiskusjonTilSide).toHaveBeenCalledWith('t1', 'stoff:valproat', { navn: 'Graviditet', emoji: '🧪' })
  })

  it('åpnes fra et varsel når menyen for siden står', async () => {
    await vis()
    act(() => visDiskusjon('stoff:litium', 't1'))
    await within(panel()).findByText('Hvordan doserer vi ved nyresvikt?')
    expect(panel().hidden).toBe(false)
    // Også på smale flater, der menyen ellers står skjult til knappen i toppmenyen trykkes.
    expect(meny().hasAttribute('data-mobil')).toBe(true)
  })
})
