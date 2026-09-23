// @vitest-environment jsdom
/**
 * Informasjonssiden, prøvd i en nettleser i minnet: lesemodus, søket på
 * siden, referansene, redigeringen, publiseringen og tilgjengeligheten.
 *
 * Databasen er erstattet av en enkel leser og et lager som husker kallene;
 * at databasen selv gjør det den skal, prøves i `analyttsidelesing.test.ts`.
 * Innholdet er syntetisk. Tallene og tekstene er ikke kliniske verdier.
 */
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { Analyttside } from '../components/analyttside/Analyttside'
import { FaginnholdskildeProvider } from '../components/analyttside/Faginnholdskilde'
import { TipsLag } from '../components/Tips'
import { FORTOLKNINGSOPPFORINGER, byggKatalog } from '../domain/analyttkatalog'
import { Samtidighetskonflikt, type Faginnholdslager } from '../faginnhold/lagring'
import { TOM_SIDE, type Analyttsidedata, type Faginnholdsleser, type Utgave } from '../faginnhold/lesing'
import type { Objektstatus, Tilstand } from '../faginnhold/modell'
import { SITERING } from '../faginnhold/referanser'

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

function utgave<T>(id: string, innhold: T, revisjon = 1, publisert: number | null = 1): Utgave<T> {
  return {
    id,
    revisjon,
    publisert_revisjon: publisert,
    innhold,
    endret_av_fornavn: 'Rita',
    endret_av_etternavn: 'Redaktør',
    endret_kl: '2026-09-22T12:32:00Z',
  }
}

const REF_A = utgave('aaaaaaaa-0000-4000-8000-000000000001', {
  tittel: 'Første kilde',
  forfattere: 'Nordmann O',
  aar: '2020',
  lenke: 'https://example.org/a',
})
const REF_B = utgave('bbbbbbbb-0000-4000-8000-000000000002', {
  tittel: 'Andre kilde',
  forfattere: 'Hansen K',
  aar: '2021',
  lenke: '',
})

/** En side for AMTNORSUM med et datakort, en tekst og tre siteringer. */
function side(tilstand: Tilstand = 'publisert'): Analyttsidedata {
  const utk = tilstand === 'utkast'
  return {
    analytt: utgave('an', { kode: 'AMTNORSUM', hovedside: 'hs', komponenter: ['hs', 'ns'] }),
    infoside: utgave('hs', { navn: 'Amitriptylin', panelreferanser: { farmakodynamikk: [REF_B.id] } }),
    komponenter: [
      { ...utgave('hs', { navn: 'Amitriptylin' }), koder: ['AMTNORSUM'] },
      { ...utgave('ns', { navn: 'Nortriptylin' }), koder: ['NOR'] },
    ],
    elementer: [
      utgave(
        'kort',
        {
          infoside: 'hs',
          panel: 'viktige_data',
          posisjon: 0,
          elementtype: 'referanseomrade',
          data: { nedre: 10, ovre: 20, enhet: 'nmol/L', forbehold: 'Syntetisk forbehold' },
          referanser: [REF_A.id],
        },
        utk ? 2 : 1,
        1,
      ),
      utgave('tekst', {
        infoside: 'hs',
        panel: 'farmakodynamikk',
        posisjon: 0,
        elementtype: 'riktekst',
        data: {
          dokument: {
            type: 'doc',
            content: [
              {
                type: 'paragraph',
                content: [
                  { type: 'text', text: 'Hemmer ' },
                  { type: 'text', text: 'gjenopptaket', marks: [{ type: 'bold' }] },
                  { type: SITERING, attrs: { referanser: [REF_A.id, REF_B.id] } },
                ],
              },
            ],
          },
        },
      }),
    ],
    referanser: [REF_A, REF_B],
  }
}

function status(id: string, revisjon = 1): Objektstatus {
  return { id, type: 'innholdselement', revisjon, endret_kl: null, publisert_revisjon: null, publisert_kl: null }
}

function kilde({
  data = side,
  kanRedigere = false,
}: { data?: (t: Tilstand) => Analyttsidedata; kanRedigere?: boolean } = {}) {
  let nr = 0
  const leser: Faginnholdsleser = {
    lesAnalyttside: vi.fn(async (_kode: string, tilstand: Tilstand) => data(tilstand)),
    lesReferanser: vi.fn(async () => [REF_A, REF_B]),
    finnInfosider: vi.fn(async () => []),
  }
  const lager: Faginnholdslager = {
    opprettUtkast: vi.fn(async () => status(`ny-${++nr}`)),
    lagreUtkast: vi.fn(async (id: string) => status(id, 3)),
    gjenopprettRevisjon: vi.fn(),
    publiserUtkast: vi.fn(async (id: string) => status(id)),
    slettReferanse: vi.fn(),
  }
  return { leser, lager, kanRedigere }
}

function vis(kode: string, k = kilde()) {
  const onApneFortolkning = vi.fn()
  const onLukk = vi.fn()
  render(
    <TipsLag>
      <FaginnholdskildeProvider kilde={k}>
        <Analyttside kode={kode} katalog={katalog} onApneFortolkning={onApneFortolkning} onLukk={onLukk} />
      </FaginnholdskildeProvider>
    </TipsLag>,
  )
  return { onApneFortolkning, onLukk, ...k }
}

describe('lesemodus', () => {
  it('viser identiteten, datakortet, teksten og referansene', async () => {
    const { leser } = vis('AMTNORSUM')
    expect(await screen.findByText('10–20 nmol/L')).toBeTruthy()
    expect(leser.lesAnalyttside).toHaveBeenCalledWith('AMTNORSUM', 'publisert')

    expect(screen.getByRole('heading', { level: 1, name: /Amitriptylin/ })).toBeTruthy()
    expect(screen.getByText('Syntetisk forbehold')).toBeTruthy()
    expect(screen.getByText('gjenopptaket').tagName).toBe('STRONG')

    // Sumanalysen forklares, og komponenten med egen kode lenker dit.
    const setning = screen.getByText(/er en sumanalyse og omfatter/).closest('p')!
    expect(setning.textContent).toBe('AMTNORSUM er en sumanalyse og omfatter amitriptylin og nortriptylin (NOR).')
    expect(within(setning).getByRole('link', { name: /NOR/ }).getAttribute('href')).toBe('#/analytt/NOR')

    // Datakortet (panel 2) siterer A, teksten i panel 3 A og B, panelet B:
    // A blir 1 og B blir 2, og listen nederst følger numrene.
    expect(screen.getByRole('button', { name: 'Referanse 1' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Referanse 2' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Referanser 1, 2' })).toBeTruthy()
    const liste = screen.getByRole('region', { name: 'Referanser' })
    expect(within(liste).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Første kilde · Nordmann O · 2020 · https://example.org/a',
      'Andre kilde · Hansen K · 2021',
    ])
  })

  it('viser bare panelene som har innhold, og ingen redigering for vanlige brukere', async () => {
    vis('AMTNORSUM')
    await screen.findByText('10–20 nmol/L')
    // Overskriften til et panel med egne kilder bærer referansepillen.
    expect(screen.getByRole('heading', { level: 2, name: 'Viktige data' })).toBeTruthy()
    const dynamikk = screen.getByRole('heading', { level: 2, name: /^Farmakodynamikk/ })
    expect(within(dynamikk).getByRole('button', { name: 'Referanse 2' })).toBeTruthy()
    expect(screen.queryByRole('heading', { level: 2, name: 'Dosering' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Rediger' })).toBeNull()
  })

  it('viser koden fra datasettene og sier fra når siden ikke har innhold ennå', async () => {
    vis('NOR', kilde({ data: () => TOM_SIDE }))
    expect(await screen.findByText('Denne siden har ikke fått faginnhold ennå.')).toBeTruthy()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Nortriptylin')
  })

  it('sier fra om en kode som ikke finnes', () => {
    vis('FINNESIKKE')
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/Fant ingen analytt med koden FINNESIKKE/)
  })

  it('sier fra når innholdet ikke lar seg hente', async () => {
    const k = kilde()
    k.leser.lesAnalyttside = vi.fn(async () => {
      throw new Error('Faginnholdet er ikke satt opp i databasen ennå.')
    })
    vis('AMTNORSUM', k)
    expect((await screen.findByRole('alert')).textContent).toMatch(/ikke satt opp i databasen/)
  })
})

describe('veiene ut av siden', () => {
  it('åpner fortolkningen koden hører til', async () => {
    const user = userEvent.setup()
    const { onApneFortolkning } = vis('NOR')
    await user.click(screen.getByRole('button', { name: 'Åpne fortolkning' }))
    expect(onApneFortolkning).toHaveBeenCalledWith(katalog.finn('NOR')!.fortolkning)
  })

  it('åpner modulen for en kode som deler fortolkning med andre', async () => {
    const user = userEvent.setup()
    const { onApneFortolkning } = vis('OXA', kilde({ data: () => TOM_SIDE }))
    await user.click(screen.getByRole('button', { name: 'Åpne fortolkning' }))
    // Oksazepam fortolkes i diazepamgruppen.
    expect(onApneFortolkning.mock.calls[0]![0].kode).toBe('DIAZ · DMI · OXA')
  })

  it('lukkes med Esc, men ikke mens det skrives i søket', async () => {
    const user = userEvent.setup()
    const { onLukk } = vis('AMTNORSUM')
    await screen.findByText('10–20 nmol/L')
    const sok = screen.getByRole('searchbox', { name: 'Søk på denne siden' })
    await user.click(sok)
    await user.keyboard('nmol')
    await user.keyboard('{Escape}')
    // Første Esc tømmer søket.
    expect((sok as HTMLInputElement).value).toBe('')
    expect(onLukk).not.toHaveBeenCalled()
    sok.blur()
    await user.keyboard('{Escape}')
    expect(onLukk).toHaveBeenCalledTimes(1)
  })
})

describe('søket på siden', () => {
  it('fremhever og teller treffene, og viser hvor de står', async () => {
    const user = userEvent.setup()
    vis('AMTNORSUM')
    await screen.findByText('10–20 nmol/L')
    await user.keyboard('/')
    const sok = screen.getByRole('searchbox', { name: 'Søk på denne siden' })
    expect(document.activeElement).toBe(sok)
    await user.keyboard('kilde')

    // «kilde» står i begge referansene i listen nederst.
    await waitFor(() => expect(document.querySelectorAll('mark.sidetreff')).toHaveLength(2))
    expect(screen.getByRole('status').textContent).toBe('Treff 1 av 2')
    await user.keyboard('{Enter}')
    expect(screen.getByRole('status').textContent).toBe('Treff 2 av 2')
    expect(document.querySelector('mark.sidetreff--aktiv')?.textContent).toBe('kilde')

    await user.clear(sok)
    await user.keyboard('forbehold')
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Treff 1 av 1'))
    expect(
      within(screen.getByRole('list', { name: 'Hvor treffene står' })).getByRole('button').textContent,
    ).toBe('Viktige data › Referanseområde')
  })

  it('ser bort fra store og små bokstaver og aksenter', async () => {
    const user = userEvent.setup()
    vis('AMTNORSUM')
    await screen.findByText('10–20 nmol/L')
    await user.type(screen.getByRole('searchbox', { name: 'Søk på denne siden' }), 'GJENOPPTAKET')
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Treff 1 av 1'))
    expect(document.querySelector('mark.sidetreff')?.textContent).toBe('gjenopptaket')
  })
})

describe('redigeringsmodus', () => {
  it('viser utkastet og alle panelene, med «Sist redigert»', async () => {
    const user = userEvent.setup()
    const { leser } = vis('AMTNORSUM', kilde({ kanRedigere: true }))
    await screen.findByText('10–20 nmol/L')
    await user.click(screen.getByRole('button', { name: 'Rediger' }))
    await waitFor(() => expect(leser.lesAnalyttside).toHaveBeenLastCalledWith('AMTNORSUM', 'utkast'))
    expect(screen.getByRole('button', { name: 'Avslutt redigering' }).getAttribute('aria-pressed')).toBe('true')
    for (const panel of ['Dosering', 'Indikasjon', 'Farmakokinetikk', 'Serumkonsentrasjoner ved ulike doser']) {
      expect(screen.getByRole('heading', { level: 2, name: panel })).toBeTruthy()
    }
    expect(screen.getAllByText('Sist redigert av Rita Redaktør 22.09.2026 kl. 14:32').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Legg til: Halveringstid' })).toBeTruthy()
  })

  it('lagrer et datakort mot revisjonen som ble åpnet', async () => {
    const user = userEvent.setup()
    const { lager } = vis('AMTNORSUM', kilde({ kanRedigere: true }))
    await screen.findByText('10–20 nmol/L')
    await user.click(screen.getByRole('button', { name: 'Rediger' }))
    await user.click(await screen.findByRole('button', { name: 'Rediger: Referanseområde' }))

    const skjema = screen.getByRole('form', { name: 'Rediger: Referanseområde' })
    const ovre = within(skjema).getByLabelText('Øvre grense')
    await user.clear(ovre)
    await user.type(ovre, '25,5')
    await user.click(within(skjema).getByRole('button', { name: 'Lagre utkast' }))

    await waitFor(() => expect(lager.lagreUtkast).toHaveBeenCalledTimes(1))
    expect(lager.lagreUtkast).toHaveBeenCalledWith('kort', 2, {
      infoside: 'hs',
      panel: 'viktige_data',
      elementtype: 'referanseomrade',
      posisjon: 0,
      data: { nedre: 10, ovre: 25.5, enhet: 'nmol/L', forbehold: 'Syntetisk forbehold' },
      referanser: [REF_A.id],
    })
  })

  it('avviser en nedre grense over den øvre, uten å lagre', async () => {
    const user = userEvent.setup()
    const { lager } = vis('AMTNORSUM', kilde({ kanRedigere: true }))
    await screen.findByText('10–20 nmol/L')
    await user.click(screen.getByRole('button', { name: 'Rediger' }))
    await user.click(await screen.findByRole('button', { name: 'Rediger: Referanseområde' }))
    const skjema = screen.getByRole('form', { name: 'Rediger: Referanseområde' })
    const nedre = within(skjema).getByLabelText('Nedre grense')
    await user.clear(nedre)
    await user.type(nedre, '30')
    await user.click(within(skjema).getByRole('button', { name: 'Lagre utkast' }))
    expect(within(skjema).getByRole('alert').textContent).toBe('Nedre grense kan ikke være høyere enn øvre.')
    expect(lager.lagreUtkast).not.toHaveBeenCalled()
  })

  it('sier fra når noen andre har lagret i mellomtiden, og beholder det som ble skrevet', async () => {
    const user = userEvent.setup()
    const k = kilde({ kanRedigere: true })
    k.lager.lagreUtkast = vi.fn(async () => {
      throw new Samtidighetskonflikt(3, 2)
    })
    vis('AMTNORSUM', k)
    await screen.findByText('10–20 nmol/L')
    await user.click(screen.getByRole('button', { name: 'Rediger' }))
    await user.click(await screen.findByRole('button', { name: 'Rediger: Referanseområde' }))
    const skjema = screen.getByRole('form', { name: 'Rediger: Referanseområde' })
    await user.clear(within(skjema).getByLabelText('Enhet'))
    await user.type(within(skjema).getByLabelText('Enhet'), 'µmol/L')
    await user.click(within(skjema).getByRole('button', { name: 'Lagre utkast' }))

    expect((await within(skjema).findByRole('alert')).textContent).toMatch(/Noen andre har lagret/)
    expect((within(skjema).getByLabelText('Enhet') as HTMLInputElement).value).toBe('µmol/L')
    expect(screen.getByRole('button', { name: 'Hent nyeste utgave' })).toBeTruthy()
  })

  it('velger kilder fra referansebasen og legger inn nye', async () => {
    const user = userEvent.setup()
    const { lager } = vis('AMTNORSUM', kilde({ kanRedigere: true }))
    await screen.findByText('10–20 nmol/L')
    await user.click(screen.getByRole('button', { name: 'Rediger' }))
    await user.click(await screen.findByRole('button', { name: 'Rediger: Referanseområde' }))
    const skjema = screen.getByRole('form', { name: 'Rediger: Referanseområde' })

    await user.type(within(skjema).getByLabelText('Finn en referanse'), 'hansen')
    await user.click(within(skjema).getByRole('button', { name: /Legg til: Andre kilde/ }))
    await user.click(within(skjema).getByRole('button', { name: 'Ny referanse …' }))
    await user.type(within(skjema).getByLabelText('Lenke'), 'ikke en lenke')
    await user.click(within(skjema).getByRole('button', { name: 'Lagre referansen' }))
    expect(within(skjema).getByRole('alert').textContent).toMatch(/begynner med http/)
    await user.clear(within(skjema).getByLabelText('Lenke'))
    await user.type(within(skjema).getByLabelText('Tittel'), 'Ny syntetisk kilde')
    await user.click(within(skjema).getByRole('button', { name: 'Lagre referansen' }))
    await waitFor(() =>
      expect(lager.opprettUtkast).toHaveBeenCalledWith('referanse', {
        tittel: 'Ny syntetisk kilde',
        forfattere: '',
        aar: '',
        lenke: '',
      }),
    )

    await user.click(within(skjema).getByRole('button', { name: 'Lagre utkast' }))
    await waitFor(() => expect(lager.lagreUtkast).toHaveBeenCalled())
    const innhold = vi.mocked(lager.lagreUtkast).mock.calls[0]![2] as { referanser: string[] }
    expect(innhold.referanser).toEqual([REF_A.id, REF_B.id, 'ny-1'])
  })

  it('publiserer de upubliserte endringene etter en oppsummering', async () => {
    const user = userEvent.setup()
    const { lager } = vis('AMTNORSUM', kilde({ kanRedigere: true }))
    await screen.findByText('10–20 nmol/L')
    await user.click(screen.getByRole('button', { name: 'Rediger' }))
    // Bare datakortet har en revisjon som ikke er publisert.
    await user.click(await screen.findByRole('button', { name: 'Publiser endringene (1)' }))
    const oppsummering = screen.getByRole('region', { name: /Redigeringsmodus/ })
    expect(within(oppsummering).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Viktige data'])
    expect(lager.publiserUtkast).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Publiser nå' }))
    await waitFor(() => expect(lager.publiserUtkast).toHaveBeenCalledWith('kort', 2))
  })

  it('oppretter siden, med komponentene, første gang noe lagres', async () => {
    const user = userEvent.setup()
    const k = kilde({ kanRedigere: true, data: () => TOM_SIDE })
    k.leser.finnInfosider = vi.fn(async () => [utgave('nortriptylin', { navn: 'Nortriptylin' })])
    const { lager, leser } = vis('AMTNORSUM', k)
    await user.click(screen.getByRole('button', { name: 'Rediger' }))
    await user.click(await screen.findByRole('button', { name: 'Legg til: Preparatnavn' }))
    const skjema = screen.getByRole('form', { name: 'Rediger: Preparatnavn' })
    await user.type(within(skjema).getByLabelText(/Preparatnavn, ett per linje/), 'Zeta{Enter}alfa{Enter}Zeta')
    await user.click(within(skjema).getByRole('button', { name: 'Lagre utkast' }))

    await waitFor(() => expect(lager.opprettUtkast).toHaveBeenCalledTimes(3))
    expect(leser.finnInfosider).toHaveBeenCalledWith(['Amitriptylin', 'Nortriptylin'], 'utkast')
    const kall = vi.mocked(lager.opprettUtkast).mock.calls
    // Nortriptylin finnes alt og gjenbrukes; Amitriptylin lages.
    expect(kall[0]).toEqual(['infoside', { navn: 'Amitriptylin' }])
    expect(kall[1]).toEqual([
      'laboratorieanalytt',
      { kode: 'AMTNORSUM', hovedside: 'ny-1', komponenter: ['ny-1', 'nortriptylin'] },
    ])
    // Navnene lagres hver for seg, alfabetisk og uten gjentakelser.
    expect(kall[2]).toEqual([
      'innholdselement',
      {
        infoside: 'ny-1',
        panel: 'identitet',
        elementtype: 'preparater',
        posisjon: 0,
        data: { navn: ['alfa', 'Zeta'] },
        referanser: [],
      },
    ])
  })
})

describe('overgangen til redigering', () => {
  it('viser ingen redigeringsknapper før utkastet er hentet', async () => {
    const user = userEvent.setup()
    let slipp: (d: Analyttsidedata) => void = () => {}
    const k = kilde({ kanRedigere: true })
    k.leser.lesAnalyttside = vi.fn((_kode: string, tilstand: Tilstand) =>
      tilstand === 'utkast' ? new Promise<Analyttsidedata>((r) => (slipp = r)) : Promise.resolve(side('publisert')),
    )
    vis('AMTNORSUM', k)
    await screen.findByText('10–20 nmol/L')
    await user.click(screen.getByRole('button', { name: 'Rediger' }))

    // Det publiserte står fortsatt, men kan ikke endres mens utkastet hentes.
    expect(screen.getByText('Henter utkastet …')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Rediger: Referanseområde' })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Legg til/ })).toBeNull()

    await act(async () => slipp(side('utkast')))
    expect(await screen.findByRole('button', { name: 'Rediger: Referanseområde' })).toBeTruthy()
  })

  it('gjør et kort som noen andre alt har lagt inn, til en konflikt', async () => {
    const user = userEvent.setup()
    const k = kilde({ kanRedigere: true })
    let andreHarLagret = false
    k.leser.lesAnalyttside = vi.fn(async (_kode: string, tilstand: Tilstand) => {
      const data = side(tilstand)
      if (!andreHarLagret) return data
      const halveringstid = utgave('ht', {
        infoside: 'hs',
        panel: 'viktige_data',
        posisjon: 3,
        elementtype: 'halveringstid',
        data: { nedre: 1, ovre: 2, enhet: 'timer', forbehold: '' },
      })
      return { ...data, elementer: [...data.elementer, halveringstid] }
    })
    k.lager.opprettUtkast = vi.fn(async () => {
      andreHarLagret = true
      throw new Error('Innholdet ble ikke godtatt. Kontroller feltene og prøv igjen.')
    })
    vis('AMTNORSUM', k)
    await screen.findByText('10–20 nmol/L')
    await user.click(screen.getByRole('button', { name: 'Rediger' }))
    await user.click(await screen.findByRole('button', { name: 'Legg til: Halveringstid' }))
    const skjema = screen.getByRole('form', { name: 'Rediger: Halveringstid' })
    await user.type(within(skjema).getByLabelText('Nedre grense'), '3')
    await user.type(within(skjema).getByLabelText('Enhet'), 'timer')
    await user.click(within(skjema).getByRole('button', { name: 'Lagre utkast' }))

    expect((await within(skjema).findByRole('alert')).textContent).toMatch(/Noen andre har lagret/)
    expect(screen.getByRole('button', { name: 'Hent nyeste utgave' })).toBeTruthy()
  })
})

describe('rikteksteditoren', () => {
  it('har en verktøyrad med bare den tillatte formateringen', async () => {
    const user = userEvent.setup()
    vis('AMTNORSUM', kilde({ kanRedigere: true }))
    await screen.findByText('10–20 nmol/L')
    await user.click(screen.getByRole('button', { name: 'Rediger' }))
    await user.click(await screen.findByRole('button', { name: 'Rediger: Farmakodynamikk' }))

    const rad = await screen.findByRole('toolbar', { name: 'Formatering – Farmakodynamikk' })
    expect(within(rad).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual([
      'Fet',
      'Kursiv',
      'Understreket',
      'Senket skrift',
      'Hevet skrift',
      'Punktliste',
      'Nummerert liste',
      'Lenke',
      'Sett inn symbol',
      'Sett inn referanse',
    ])
    expect(screen.getByRole('textbox', { name: 'Farmakodynamikk' })).toBeTruthy()
    // Siteringen i teksten vises med forfatter og år mens den redigeres.
    expect(screen.getByLabelText('Referanse: Nordmann 2020; Hansen 2021')).toBeTruthy()
    await act(async () => {})
  })
})

describe('kortene i farmakokinetikken', () => {
  const medKort = (tilstand: Tilstand): Analyttsidedata => {
    const data = side(tilstand)
    const kort = (id: string, tittel: string, posisjon: number) =>
      utgave(id, {
        infoside: 'hs',
        panel: 'farmakokinetikk',
        posisjon,
        elementtype: 'kinetikkort',
        data: { tittel, dokument: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Syntetisk' }] }] } },
      })
    return { ...data, elementer: [...data.elementer, kort('k1', 'Absorpsjon', 0), kort('k2', 'Metabolisme', 0)] }
  }

  it('flytter et kort, og lagrer bare det som får ny plass', async () => {
    const user = userEvent.setup()
    const { lager } = vis('AMTNORSUM', kilde({ kanRedigere: true, data: medKort }))
    await screen.findByText('10–20 nmol/L')
    await user.click(screen.getByRole('button', { name: 'Rediger' }))
    await user.click(await screen.findByRole('button', { name: 'Flytt ned: Absorpsjon' }))
    // Begge sto på plass 0, i ID-rekkefølge. Metabolisme blir stående på 0;
    // bare Absorpsjon får ny plass og lagres.
    await waitFor(() => expect(lager.lagreUtkast).toHaveBeenCalledTimes(1))
    expect(lager.lagreUtkast).toHaveBeenCalledWith('k1', 1, expect.objectContaining({ posisjon: 1 }))
  })

  it('fjerner et kort først etter en bekreftelse, uten å slette det', async () => {
    const user = userEvent.setup()
    const { lager } = vis('AMTNORSUM', kilde({ kanRedigere: true, data: medKort }))
    await screen.findByText('10–20 nmol/L')
    await user.click(screen.getByRole('button', { name: 'Rediger' }))
    await user.click(await screen.findByRole('button', { name: 'Fjern: Metabolisme' }))
    expect(lager.lagreUtkast).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Bekreft: fjern Metabolisme' }))
    await waitFor(() => expect(lager.lagreUtkast).toHaveBeenCalledTimes(1))
    expect(vi.mocked(lager.lagreUtkast).mock.calls[0]![2]).toMatchObject({ panel: 'fjernet', elementtype: 'kinetikkort' })
  })
})
