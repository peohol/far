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
import type { Interaksjonsdata } from '../legemiddeldata/fest'
import {
  TOMME_INTERAKSJONER,
  TOMT_UTVALG,
  type Interaksjonsutvalg,
  type Legemiddelleser,
  type Legemiddelutvalg,
} from '../legemiddeldata/lesing'

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

/** Syntetiske legemiddeldata i FESTs form: ett virkestoff med et salt, to former og et fritak. */
const UTVALG: Legemiddelutvalg = {
  ...TOMT_UTVALG,
  kontrollert_kl: '2026-09-23T04:15:00Z',
  kildedato: '2026-09-08T03:09:06',
  virkestoff: [
    { id: 'ID_AMI', navn: 'Amitriptylin', navn_engelsk: null, salter: ['ID_AMISALT'], utgatt: false },
    { id: 'ID_AMISALT', navn: 'Amitriptylinhydroklorid', navn_engelsk: null, salter: [], utgatt: false },
  ],
  styrker: [10, 25, 50].map((verdi) => ({
    id: `ID_S${verdi}`,
    virkestoff_id: 'ID_AMI',
    styrke: { verdi, enhet: 'mg' },
    nevner: null,
    ovre: null,
    operator: null,
    alternativ_styrke: null,
    alternativ_nevner: null,
  })),
  merkevarer: (
    [
      ['ID_M1', 'Tabletto', '53', 'Tablett', '7', 'ID_S10'],
      ['ID_M2', 'Tabletto', '53', 'Tablett', '7', 'ID_S25'],
      ['ID_M3', 'Retardo', '743', 'Depotkapsel, hard', '7', 'ID_S50'],
      ['ID_M4', 'Utlandia', '53', 'Tablett', '11', 'ID_S25'],
    ] as const
  ).map(([id, varenavn, form, formtekst, type, styrke]) => ({
    id,
    varenavn,
    navn_form_styrke: `${varenavn} ${styrke}`,
    legemiddelform: { kode: form, tekst: formtekst },
    legemiddelform_lang: null,
    atc: null,
    reseptgruppe: null,
    preparattype: { kode: type, tekst: type === '11' ? 'Krever godkj. Fritak' : 'Legemiddel' },
    administrasjonsveier: [],
    deling: null,
    kan_knuses: null,
    kan_apnes: null,
    produsent: null,
    referanseprodukt: null,
    preparatomtale: null,
    svart_trekant: false,
    virkestoff_med_styrke: [styrke],
    virkestoff_uten_styrke: [],
    // Tabletto: samme reseptgruppe og vei for begge styrkene, hver sin preparatomtale.
    ...(varenavn === 'Tabletto' && {
      atc: { kode: 'N06AA09', tekst: 'Amitriptylin' },
      reseptgruppe: { kode: 'C', tekst: 'Reseptgruppe C' },
      administrasjonsveier: [{ kode: '53', tekst: 'Oral bruk' }],
      preparatomtale: `https://produktinformasjon.legemiddelsok.no/preparatomtaler/${id}.pdf`,
    }),
    ...(id === 'ID_M2' && { deling: { kode: '2', tekst: 'Delbar i 2' } }),
  })),
  pakninger: [
    {
      id: 'ID_P1',
      varenr: '123456',
      navn_form_styrke: 'Tabletto 10 mg',
      innhold: [
        {
          merkevare_id: 'ID_M1',
          pakningsstorrelse: 30,
          enhet: { kode: 'stk', tekst: 'stykk' },
          pakningstype: { kode: '1', tekst: 'Blisterpakning' },
          mengde: 30,
          antall: null,
        },
      ],
      merkevarer: ['ID_M1'],
      markedsforingsdato: null,
      midlertidig_utgatt_dato: null,
      avregistrert_dato: null,
      byttegrupper: [],
      ean: [],
    },
  ],
}

/** Syntetiske interaksjoner i FESTs form: én av hver relevans, mot en ATC-kode og en klasse. */
function interaksjon(
  id: string,
  relevans: [string, string],
  med: string,
  egen: string,
  tillegg: Partial<Interaksjonsdata> = {},
): Interaksjonsdata & { id: string } {
  return {
    id,
    relevans: { kode: relevans[0], tekst: relevans[1] },
    klinisk_konsekvens: `Endret effekt ved samtidig bruk av ${med}.`,
    mekanisme: null,
    handtering: null,
    situasjonskriterier: [],
    kildegrunnlag: null,
    referanser: [],
    substansgrupper: [
      { navn: null, substanser: [{ navn: med, atc: { kode: 'X01AA01', tekst: med }, virkestoff_id: null }] },
      { navn: null, substanser: [{ navn: 'Amitriptylin', atc: { kode: egen, tekst: '' }, virkestoff_id: null }] },
    ],
    ...tillegg,
  }
}

const INTERAKSJONER: Interaksjonsutvalg = {
  interaksjoner: [
    interaksjon('ID_I1', ['2', 'Forholdsregler bør tas'], 'Testhemmer', 'N06AA', {
      situasjonskriterier: ['Gjelder ved høye doser.'],
      handtering: 'Dosetilpasning: Juster dosen.\nMonitorering: Mål serumkonsentrasjonen.',
      kildegrunnlag: { kode: '4', tekst: 'Indirekte data' },
      referanser: [{ kilde: 'Testkilde', lenke: 'https://example.org/kilde' }],
    }),
    interaksjon('ID_I2', ['1', 'Bør unngås'], 'Farligin', 'N06AA09'),
    interaksjon('ID_I3', ['3', 'Ingen tiltak nødvendig'], 'Ufarligin', 'N06AA09'),
  ],
  ikke_vurdert: [],
}

/** En side med koblingen til legemiddeldataene. */
function medKobling(tilstand: Tilstand): Analyttsidedata {
  const data = side(tilstand)
  return {
    ...data,
    elementer: [
      ...data.elementer,
      utgave('kobling', {
        infoside: 'hs',
        panel: 'preparater',
        posisjon: 0,
        elementtype: 'legemiddelkobling',
        data: { virkestoff: [{ fest_id: 'ID_AMI', navn: 'Amitriptylin' }] },
        referanser: [],
      }),
    ],
  }
}

function legemiddelleser(): Legemiddelleser {
  return {
    les: vi.fn(async (ider: readonly string[]) => (ider.includes('ID_AMI') ? UTVALG : TOMT_UTVALG)),
    sok: vi.fn(async () => [
      { id: 'ID_AMISALT', navn: 'Amitriptylinhydroklorid', navn_engelsk: null, salt_av: ['Amitriptylin'], preparater: 0 },
      { id: 'ID_AMI', navn: 'Amitriptylin', navn_engelsk: 'Amitriptyline', salt_av: [], preparater: 4 },
    ]),
    interaksjoner: vi.fn(async ({ atc }) => (atc.includes('N06AA09') ? INTERAKSJONER : TOMME_INTERAKSJONER)),
  }
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
  return { leser, lager, kanRedigere, legemidler: legemiddelleser() }
}

function vis(kode: string, k = kilde(), sted?: string[]) {
  const onApneFortolkning = vi.fn()
  const onLukk = vi.fn()
  render(
    <TipsLag>
      <FaginnholdskildeProvider kilde={k}>
        <Analyttside
          kode={kode}
          sted={sted}
          katalog={katalog}
          onApneFortolkning={onApneFortolkning}
          onLukk={onLukk}
        />
      </FaginnholdskildeProvider>
    </TipsLag>,
  )
  return { onApneFortolkning, onLukk, ...k }
}

describe('lesemodus', () => {
  it('viser identiteten, datakortet, teksten og referansene', async () => {
    const user = userEvent.setup()
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

    // Teksten står i en lukket seksjon til den åpnes.
    await user.click(screen.getByRole('button', { name: 'Farmakodynamikk' }))

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

describe('seksjonene', () => {
  /** Knappen som åpner og lukker seksjonen. */
  const skuffknapp = (navn: string) =>
    screen.getAllByRole('button', { name: navn, hidden: true }).find((b) => b.hasAttribute('aria-expanded'))!
  const apen = (navn: string) => skuffknapp(navn).getAttribute('aria-expanded') === 'true'

  it('viser viktige data åpent og resten lukket med en oppsummering', async () => {
    vis('AMTNORSUM')
    await screen.findByText('10–20 nmol/L')
    expect(apen('Viktige data')).toBe(true)
    expect(apen('Farmakodynamikk')).toBe(false)
    // Oppsummeringen er begynnelsen av teksten, med teksten selv skjult.
    expect(screen.getByText('Hemmer gjenopptaket')).toBeTruthy()
    expect(screen.getByText('gjenopptaket', { selector: 'strong' }).closest('[hidden]')).not.toBeNull()
  })

  it('åpner seksjonen søket finner et treff i, og gjør treffet aktivt', async () => {
    const user = userEvent.setup()
    vis('AMTNORSUM')
    await screen.findByText('10–20 nmol/L')
    await user.type(screen.getByRole('searchbox', { name: 'Søk på denne siden' }), 'hemmer')
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Treff 1 av 1'))
    // Den lukkede seksjonen sier at den har et treff.
    expect(screen.getByText('1 treff')).toBeTruthy()
    await user.click(within(screen.getByRole('list', { name: 'Hvor treffene står' })).getByRole('button'))
    expect(apen('Farmakodynamikk')).toBe(true)
    expect(document.querySelector('mark.sidetreff--aktiv')?.closest('[hidden]')).toBeNull()

    await user.click(skuffknapp('Farmakodynamikk'))
    expect(apen('Farmakodynamikk')).toBe(false)
    await user.type(screen.getByRole('searchbox', { name: 'Søk på denne siden' }), '{Enter}')
    expect(apen('Farmakodynamikk')).toBe(true)
  })

  it('åpner stedet adressen peker på', async () => {
    vis('AMTNORSUM', kilde(), ['farmakodynamikk'])
    await screen.findByText('10–20 nmol/L')
    await waitFor(() => expect(apen('Farmakodynamikk')).toBe(true))
  })

  it('åpner og lukker alle seksjonene', async () => {
    const user = userEvent.setup()
    vis('AMTNORSUM')
    await screen.findByText('10–20 nmol/L')
    await user.click(screen.getByRole('button', { name: 'Åpne alle' }))
    expect(apen('Farmakodynamikk') && apen('Viktige data')).toBe(true)
    await user.click(screen.getByRole('button', { name: 'Lukk alle' }))
    expect(apen('Farmakodynamikk') || apen('Viktige data')).toBe(false)
  })

  it('åpner alt i redigeringsmodus, også panelene som bare vises der', async () => {
    const user = userEvent.setup()
    vis('AMTNORSUM', kilde({ kanRedigere: true }))
    await screen.findByText('10–20 nmol/L')
    await user.click(screen.getByRole('button', { name: 'Rediger' }))
    await screen.findByRole('button', { name: 'Legg til: Dosering' })
    expect(apen('Dosering') && apen('Farmakodynamikk')).toBe(true)
  })
})

describe('preparatene', () => {
  const skuffknapp = (navn: string) =>
    screen.getAllByRole('button', { name: navn, hidden: true }).find((b) => b.hasAttribute('aria-expanded'))!

  it('viser ikke seksjonen når siden ikke er koblet', async () => {
    const k = kilde()
    vis('AMTNORSUM', k)
    await screen.findByText('10–20 nmol/L')
    expect(screen.queryByRole('region', { name: 'Preparater' })).toBeNull()
    expect(k.legemidler.les).not.toHaveBeenCalled()
  })

  it('viser preparatene fra legemiddeldataene gruppert etter form, med kilden', async () => {
    const user = userEvent.setup()
    const k = kilde({ data: medKobling })
    vis('AMTNORSUM', k)
    // Lukket står oppsummeringen; formene og fritakene er detaljkort.
    expect(
      await screen.findByText('2 preparater · 2 legemiddelformer · 3 styrker · 1 med godkjenningsfritak'),
    ).toBeTruthy()
    expect(k.legemidler.les).toHaveBeenCalledWith(['ID_AMI'])
    await user.click(skuffknapp('Preparater'))
    expect(screen.getByText('1 preparat · 10–25 mg')).toBeTruthy()
    expect(skuffknapp('Tablett').getAttribute('aria-expanded')).toBe('false')
    await user.click(skuffknapp('Tablett'))
    expect(screen.getByText('Tabletto')).toBeTruthy()
    expect(screen.getByText('30 stk, blisterpakning (varenr. 123456)')).toBeTruthy()
    // Det styrkene har likt står på preparatet, resten på hver styrke.
    expect(screen.getByText('Reseptgruppe C · Oral bruk')).toBeTruthy()
    expect(screen.getByText('Delbar i 2')).toBeTruthy()
    expect(
      screen.getAllByRole('link', { name: 'Preparatomtale' }).map((a) => a.getAttribute('href')),
    ).toEqual([
      'https://produktinformasjon.legemiddelsok.no/preparatomtaler/ID_M1.pdf',
      'https://produktinformasjon.legemiddelsok.no/preparatomtaler/ID_M2.pdf',
    ])
    expect(skuffknapp('Krever godkjenningsfritak')).toBeTruthy()
    expect(
      within(screen.getByRole('region', { name: 'Preparater' })).getByText(
        /Kilde: FEST, Direktoratet for medisinske produkter, uttrekk fra 8\. september 2026/,
      ),
    ).toBeTruthy()
  })

  it('finner preparatene i søket på siden, også i lukkede detaljkort', async () => {
    const user = userEvent.setup()
    vis('AMTNORSUM', kilde({ data: medKobling }))
    await screen.findByText(/2 preparater/)
    await user.type(screen.getByRole('searchbox', { name: 'Søk på denne siden' }), 'retardo')
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Treff 1 av 1'))
    const steder = within(screen.getByRole('list', { name: 'Hvor treffene står' }))
    await user.click(steder.getByRole('button', { name: /Depotkapsel, hard/ }))
    expect(skuffknapp('Depotkapsel, hard').getAttribute('aria-expanded')).toBe('true')
  })

  it('sier fra når preparatene ikke kan hentes, uten at resten av siden faller', async () => {
    const k = kilde({ data: medKobling })
    k.legemidler.les = vi.fn(async () => {
      throw new Error('Nettverksfeil')
    })
    vis('AMTNORSUM', k)
    expect(await screen.findByText('Fikk ikke hentet preparatene')).toBeTruthy()
    expect(screen.getByText('10–20 nmol/L')).toBeTruthy()
  })
})

describe('interaksjonene', () => {
  const skuffknapp = (navn: string) =>
    screen.getAllByRole('button', { name: navn, hidden: true }).find((b) => b.hasAttribute('aria-expanded'))!

  it('viser ikke seksjonen når siden ikke er koblet', async () => {
    const k = kilde()
    vis('AMTNORSUM', k)
    await screen.findByText('10–20 nmol/L')
    expect(screen.queryByRole('region', { name: 'Interaksjoner' })).toBeNull()
    expect(k.legemidler.interaksjoner).not.toHaveBeenCalled()
  })

  it('slår opp på ATC-koden til preparatene, og viser de alvorligste først', async () => {
    const user = userEvent.setup()
    const k = kilde({ data: medKobling })
    vis('AMTNORSUM', k)
    // «Ingen tiltak nødvendig» telles ikke og vises ikke.
    expect(await screen.findByText('1 bør unngås · 1 forholdsregler bør tas')).toBeTruthy()
    expect(k.legemidler.interaksjoner).toHaveBeenCalledWith({ atc: ['N06AA09'], virkestoff: ['ID_AMI', 'ID_AMISALT'] })
    await user.click(skuffknapp('Interaksjoner'))
    const seksjon = screen.getByRole('region', { name: 'Interaksjoner' })
    const kort = within(seksjon)
      .getAllByRole('button', { hidden: true })
      .filter((b) => b.hasAttribute('aria-expanded') && b !== skuffknapp('Interaksjoner'))
      .map((b) => b.textContent)
    expect(kort[0]).toMatch(/^Farligin/)
    expect(kort[1]).toMatch(/^Testhemmer/)
    expect(within(seksjon).queryByText(/Ufarligin/)).toBeNull()

    await user.click(skuffknapp('Testhemmer'))
    expect(screen.getByText('Gjelder ved høye doser.')).toBeTruthy()
    expect(screen.getByText('Dosetilpasning:')).toBeTruthy()
    expect(screen.getByText('Mål serumkonsentrasjonen.')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Testkilde' }).getAttribute('href')).toBe('https://example.org/kilde')
    expect(screen.getByText(/De der DMP mener ingen tiltak er nødvendig, vises ikke\./)).toBeTruthy()
  })

  it('finner stoffene i søket på siden, også i lukkede detaljkort', async () => {
    const user = userEvent.setup()
    vis('AMTNORSUM', kilde({ data: medKobling }))
    await screen.findByText(/1 bør unngås/)
    await user.type(screen.getByRole('searchbox', { name: 'Søk på denne siden' }), 'farligin')
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/^Treff 1 av/))
    const steder = within(screen.getByRole('list', { name: 'Hvor treffene står' }))
    await user.click(steder.getAllByRole('button', { name: /Interaksjoner.*Farligin/ })[0]!)
    expect(skuffknapp('Farligin').getAttribute('aria-expanded')).toBe('true')
  })

  it('sier fra når stoffet ikke er vurdert, og når interaksjonene ikke kan hentes', async () => {
    const k = kilde({ data: medKobling })
    k.legemidler.interaksjoner = vi.fn(async () => ({
      interaksjoner: [],
      ikke_vurdert: [{ id: 'ID_V', atc: [{ kode: 'N06AA09', tekst: 'Amitriptylin' }] }],
    }))
    vis('AMTNORSUM', k)
    expect(await screen.findByText('Ikke vurdert av DMP')).toBeTruthy()
    expect(screen.getByText(/DMP har ikke vurdert interaksjonene for Amitriptylin \(N06AA09\) ennå/)).toBeTruthy()
    cleanup()

    const feil = kilde({ data: medKobling })
    feil.legemidler.interaksjoner = vi.fn(async () => {
      throw new Error('Nettverksfeil')
    })
    vis('AMTNORSUM', feil)
    expect(await screen.findByText('Fikk ikke hentet interaksjonene')).toBeTruthy()
    expect(screen.getByText('10–20 nmol/L')).toBeTruthy()
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
    await user.click(await screen.findByRole('button', { name: 'Legg til: Koblingen til legemiddeldataene' }))
    const skjema = screen.getByRole('form', { name: 'Rediger: Koblingen til legemiddeldataene' })
    // Søket står ferdig utfylt med sidens navn, og likt navn er et forslag.
    expect((within(skjema).getByLabelText('Søk etter virkestoff') as HTMLInputElement).value).toBe('Amitriptylin')
    expect(await within(skjema).findByText(/Forslag: samme navn som siden/)).toBeTruthy()
    expect(within(skjema).getByText(/salt eller ester av Amitriptylin/)).toBeTruthy()
    await user.click(within(skjema).getByRole('button', { name: 'Koble siden til Amitriptylin' }))
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
    // Koblingen lagres med FESTs ID; navnet er med for historikken.
    expect(kall[2]).toEqual([
      'innholdselement',
      {
        infoside: 'ny-1',
        panel: 'preparater',
        elementtype: 'legemiddelkobling',
        posisjon: 0,
        data: { virkestoff: [{ fest_id: 'ID_AMI', navn: 'Amitriptylin' }] },
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
  /** To kinetikkort, Absorpsjon og Metabolisme, med teksten i `tekster` (eller «Syntetisk»). */
  const medKort =
    (tekster: Partial<Record<'k1' | 'k2', string>> = {}) =>
    (tilstand: Tilstand): Analyttsidedata => {
      const data = side(tilstand)
      const kort = (id: 'k1' | 'k2', tittel: string, posisjon: number) =>
        utgave(id, {
          infoside: 'hs',
          panel: 'farmakokinetikk',
          posisjon,
          elementtype: 'kinetikkort',
          data: {
            tittel,
            dokument: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: tekster[id] ?? 'Syntetisk' }] }] },
          },
        })
      return { ...data, elementer: [...data.elementer, kort('k1', 'Absorpsjon', 0), kort('k2', 'Metabolisme', 0)] }
    }

  it('flytter et kort, og lagrer bare det som får ny plass', async () => {
    const user = userEvent.setup()
    const { lager } = vis('AMTNORSUM', kilde({ kanRedigere: true, data: medKort() }))
    await screen.findByText('10–20 nmol/L')
    await user.click(screen.getByRole('button', { name: 'Rediger' }))
    await user.click(await screen.findByRole('button', { name: 'Flytt ned: Absorpsjon' }))
    // Begge sto på plass 0, i ID-rekkefølge. Metabolisme blir stående på 0;
    // bare Absorpsjon får ny plass og lagres.
    await waitFor(() => expect(lager.lagreUtkast).toHaveBeenCalledTimes(1))
    expect(lager.lagreUtkast).toHaveBeenCalledWith('k1', 1, expect.objectContaining({ posisjon: 1 }))
  })

  it('åpner både seksjonen og kortet når søket går til et treff i et lukket kort', async () => {
    const user = userEvent.setup()
    vis('AMTNORSUM', kilde({ data: medKort() }))
    await screen.findByText('10–20 nmol/L')
    const skuffknapp = (navn: string) =>
      screen.getAllByRole('button', { name: navn, hidden: true }).find((b) => b.hasAttribute('aria-expanded'))!
    expect(skuffknapp('Farmakokinetikk').getAttribute('aria-expanded')).toBe('false')
    expect(skuffknapp('Absorpsjon').getAttribute('aria-expanded')).toBe('false')

    await user.type(screen.getByRole('searchbox', { name: 'Søk på denne siden' }), 'syntetisk')
    const steder = within(await screen.findByRole('list', { name: 'Hvor treffene står' }))
    await user.click(steder.getByRole('button', { name: 'Farmakokinetikk › Absorpsjon' }))

    expect(skuffknapp('Farmakokinetikk').getAttribute('aria-expanded')).toBe('true')
    expect(skuffknapp('Absorpsjon').getAttribute('aria-expanded')).toBe('true')
    expect(skuffknapp('Metabolisme').getAttribute('aria-expanded')).toBe('false')
    // Treffet er det aktive, og står ikke lenger skjult.
    const aktivt = document.querySelector('mark.sidetreff--aktiv')!
    expect(aktivt.closest('[data-skuff="farmakokinetikk/k1"]')).not.toBeNull()
    expect(aktivt.closest('[hidden]')).toBeNull()
  })

  it('går til titteltreffet når søket treffer tittelen på et lukket kort', async () => {
    const user = userEvent.setup()
    // «metabolisme» står i teksten i Absorpsjon og i tittelen på Metabolisme.
    vis('AMTNORSUM', kilde({ data: medKort({ k1: 'Syntetisk metabolisme.' }) }))
    await screen.findByText('10–20 nmol/L')
    const skuffknapp = (navn: string) =>
      screen.getAllByRole('button', { name: navn, hidden: true }).find((b) => b.hasAttribute('aria-expanded'))!

    await user.type(screen.getByRole('searchbox', { name: 'Søk på denne siden' }), 'metabolisme')
    expect(await screen.findByText('Treff 1 av 2')).toBeTruthy()
    const steder = within(await screen.findByRole('list', { name: 'Hvor treffene står' }))
    await user.click(steder.getByRole('button', { name: 'Farmakokinetikk › Metabolisme' }))

    expect(skuffknapp('Farmakokinetikk').getAttribute('aria-expanded')).toBe('true')
    expect(skuffknapp('Metabolisme').getAttribute('aria-expanded')).toBe('true')
    expect(skuffknapp('Absorpsjon').getAttribute('aria-expanded')).toBe('false')
    // Det aktive treffet er det i tittelen på Metabolisme, og det står synlig.
    expect(screen.getByText('Treff 2 av 2')).toBeTruthy()
    const aktivt = document.querySelector('mark.sidetreff--aktiv')!
    expect(aktivt.textContent?.toLowerCase()).toBe('metabolisme')
    expect(aktivt.closest('.skuff__knapp')?.closest('[data-skuff="farmakokinetikk/k2"]')).not.toBeNull()
    expect(aktivt.closest('[hidden]')).toBeNull()
  })

  it('fjerner et kort først etter en bekreftelse, uten å slette det', async () => {
    const user = userEvent.setup()
    const { lager } = vis('AMTNORSUM', kilde({ kanRedigere: true, data: medKort() }))
    await screen.findByText('10–20 nmol/L')
    await user.click(screen.getByRole('button', { name: 'Rediger' }))
    await user.click(await screen.findByRole('button', { name: 'Fjern: Metabolisme' }))
    expect(lager.lagreUtkast).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Bekreft: fjern Metabolisme' }))
    await waitFor(() => expect(lager.lagreUtkast).toHaveBeenCalledTimes(1))
    expect(vi.mocked(lager.lagreUtkast).mock.calls[0]![2]).toMatchObject({ panel: 'fjernet', elementtype: 'kinetikkort' })
  })
})

describe('innhold hentet fra en kilde', () => {
  /** Siden etter importen: innhold fra PDF-en og et indikasjonssammendrag fra Felleskatalogen. */
  function importert(tilstand: Tilstand): Analyttsidedata {
    const grunn = side(tilstand)
    const fraKilde = <T,>(u: Utgave<T>, kilde: string): Utgave<T> => ({ ...u, kilde })
    return {
      ...grunn,
      elementer: [
        fraKilde(grunn.elementer[0]!, 'Importert fra Psykofarmaka.pdf, side 7'),
        fraKilde(
          utgave('ind', {
            infoside: 'hs',
            panel: 'indikasjon',
            posisjon: 0,
            elementtype: 'riktekst',
            data: {
              dokument: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Syntetisk indikasjon.' }] }] },
            },
          }),
          'Hentet fra Felleskatalogen 23.09.2026',
        ),
      ],
    }
  }

  it('viser kilden ved «Sist redigert»', async () => {
    const user = userEvent.setup()
    vis('AMTNORSUM', kilde({ data: importert, kanRedigere: true }))
    // Teksten står både i den lukkede seksjonens oppsummering og i innholdet.
    await screen.findAllByText('Syntetisk indikasjon.')
    await user.click(screen.getByRole('button', { name: 'Rediger' }))
    expect(
      await screen.findByText('Sist redigert av Rita Redaktør 22.09.2026 kl. 14:32 · Importert fra Psykofarmaka.pdf, side 7'),
    ).toBeTruthy()
    expect(
      screen.getByText('Sist redigert av Rita Redaktør 22.09.2026 kl. 14:32 · Hentet fra Felleskatalogen 23.09.2026'),
    ).toBeTruthy()
  })
})
