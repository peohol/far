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
import {
  TOM_SIDE,
  type Analyttsidedata,
  type Faginnholdsleser,
  type Regelsettutgave,
  type Utgave,
} from '../faginnhold/lesing'
import type { Historikk } from '../faginnhold/historikk'
import type { Objektstatus, Tilstand } from '../faginnhold/modell'
import { kommentarnavn, utenKommentarer } from '../regler/kommentarer'
import type { Intervallregelsett, Intervallregelsettinnhold } from '../regler/modell'
import { SITERING } from '../faginnhold/referanser'
import { formaterTall } from '../faginnhold/paneler'
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
  // jsdom har `<dialog>`, men ikke det modale laget.
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  }
  // jsdom tegner ingenting, så rikteksteditoren får ingen rektangler å rulle etter.
  Range.prototype.getClientRects ??= () => [] as unknown as DOMRectList
  Range.prototype.getBoundingClientRect ??= () => new DOMRect()
})

afterEach(cleanup)

const katalog = byggKatalog(FORTOLKNINGSOPPFORINGER)

/** Redigeringsvinduet med tittelen: skjemaet, knappene i foten og meldingene. */
function redigeringsvindu(tittel: string): HTMLElement {
  return screen.getByRole('dialog', { name: tittel })
}

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

/**
 * Et syntetisk regelsett for AMTNORSUM. Utkastet har en endret kommentar i
 * det øverste intervallet.
 */
function regelsett(tilstand: Tilstand = 'publisert'): Intervallregelsett {
  return {
    analyttkode: 'AMTNORSUM',
    enhet: 'nmol/L',
    desimaler: 0,
    skillepunkter: [10, 1800],
    intervaller: [
      { niva: 'under', handling: null, kommentar: 'k-lav' },
      { niva: 'innenfor', handling: null, kommentar: 'k-middels' },
      { niva: 'over', handling: 'ring_rekvirent', kommentar: 'k-hoy' },
    ],
    ringegrense: 1800,
    cutoff: { innledning: 'k-innledning', kommentar: 'k-middels' },
    kommentarer: [
      { id: 'k-lav', tekst: 'Syntetisk lav kommentar.' },
      { id: 'k-middels', tekst: 'Syntetisk middels kommentar.' },
      { id: 'k-hoy', tekst: tilstand === 'utkast' ? 'Endret syntetisk høy kommentar.' : 'Syntetisk høy kommentar.' },
      { id: 'k-innledning', tekst: 'Syntetisk innledning.' },
    ],
  }
}

const REGELSETT_ID = 'rrrrrrrr-0000-4000-8000-000000000003'
/** Kommentaren som er endret i utkastet. */
const HOY = 'k-hoy'
const HOY_NAVN = 'AMTNORSUM – over referanseområdet, ring rekvirent'

/**
 * Regelsettet og kommentarene det peker på, som egne objekter. Regelsettet er
 * publisert i revisjon 2; kommentaren i det øverste intervallet er endret i
 * utkastet og ikke publisert.
 */
function regelsettutgave(tilstand: Tilstand, revisjon = 2): Regelsettutgave {
  const r = regelsett(tilstand)
  return {
    regelsett: utgave(REGELSETT_ID, utenKommentarer(r), revisjon, 2),
    kommentarer: r.kommentarer.map(({ id, tekst }) =>
      utgave(
        id,
        { navn: kommentarnavn(r, id), tekst, plassholdere: [] },
        id === HOY && tilstand === 'utkast' ? 2 : 1,
        1,
      ),
    ),
  }
}

const IMPORTERT = { utfort_av_fornavn: 'Ada', utfort_av_etternavn: 'Adminsen', utfort_kl: '2026-09-22T08:00:00Z' }
const ENDRET = { utfort_av_fornavn: 'Rita', utfort_av_etternavn: 'Redaktør', utfort_kl: '2026-09-22T12:32:00Z' }

/** Regelsettet ble importert med den middels kommentaren også øverst, og fikk sin egen der. */
const REGELHISTORIKK: Historikk<Intervallregelsettinnhold> = {
  hendelser: [
    { handling: 'opprettet', revisjon: 1, ...IMPORTERT, kilde: 'Syntetisk import' },
    { handling: 'publisert', revisjon: 1, ...IMPORTERT },
    { handling: 'endret', revisjon: 2, ...ENDRET },
    { handling: 'publisert', revisjon: 2, ...ENDRET },
  ],
  revisjoner: [
    {
      revisjon: 1,
      innhold: utenKommentarer({
        ...regelsett(),
        intervaller: regelsett().intervaller.map((i) => (i.kommentar === HOY ? { ...i, kommentar: 'k-middels' } : i)),
      }),
    },
    { revisjon: 2, innhold: utenKommentarer(regelsett()) },
  ],
}

/** Historikken til kommentaren som er endret i utkastet. */
const KOMMENTARHISTORIKK: Historikk<unknown> = {
  hendelser: [
    { handling: 'opprettet', revisjon: 1, ...IMPORTERT, kilde: 'Syntetisk import' },
    { handling: 'publisert', revisjon: 1, ...IMPORTERT },
    { handling: 'endret', revisjon: 2, ...ENDRET },
  ],
  revisjoner: [1, 2].map((revisjon) => ({
    revisjon,
    innhold: regelsettutgave(revisjon === 1 ? 'publisert' : 'utkast').kommentarer.find((k) => k.id === HOY)!.innhold,
  })),
}

/** En side for AMTNORSUM med et datakort, en tekst, tre siteringer og et regelsett. */
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
    regelsett: regelsettutgave(tilstand),
    thcregelsett: null,
    scenarioregelsett: null,
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
    finnIntervallregelsett: vi.fn(async (_kode: string, tilstand: Tilstand) => data(tilstand).regelsett),
    finnScenarioregelsett: vi.fn(async () => null),
    lesIntervallregelsett: vi.fn(async (tilstand: Tilstand) => {
      const regelsett = data(tilstand).regelsett
      return regelsett ? [regelsett.regelsett] : []
    }),
    lesThcRegelsett: vi.fn(async (tilstand: Tilstand) => data(tilstand).thcregelsett),
    lesKommentarer: vi.fn(async (tilstand: Tilstand) => data(tilstand).regelsett?.kommentarer ?? []),
    lesReferanseomrader: vi.fn(async () => new Map()),
    lesHistorikk: vi.fn(async (id: string) =>
      id === HOY ? KOMMENTARHISTORIKK : REGELHISTORIKK,
    ) as Faginnholdsleser['lesHistorikk'],
  }
  const lager: Faginnholdslager = {
    opprettUtkast: vi.fn(async () => status(`ny-${++nr}`)),
    lagreUtkast: vi.fn(async (id: string) => status(id, 3)),
    gjenopprettRevisjon: vi.fn(async (id: string) => status(id, 3)),
    lagreIntervallregelsett: vi.fn(async (id: string) => status(id, 3)),
    lagreScenarioregelsett: vi.fn(async (id: string) => status(id, 3)),
    publiserUtkast: vi.fn(async (id: string) => status(id)),
    slettReferanse: vi.fn(),
  }
  return { leser, lager, kanRedigere, legemidler: legemiddelleser() }
}

/** Knappen som åpner og lukker skuffen med navnet, også når skuffen står skjult. */
function skuffen(navn: string): HTMLElement {
  const knapp = screen.getAllByRole('button', { name: navn, hidden: true }).find((b) => b.hasAttribute('aria-expanded'))
  if (!knapp) throw new Error(`Fant ingen skuff som heter «${navn}»`)
  return knapp
}

/**
 * Åpner skuffen med navnet, slik brukeren gjør. Bare én skuff per nivå står
 * åpen, så også en redaktør åpner seksjonen som skal redigeres.
 */
async function apneSkuff(user: ReturnType<typeof userEvent.setup>, navn: string) {
  const knapp = await waitFor(() => skuffen(navn))
  if (knapp.getAttribute('aria-expanded') !== 'true') await user.click(knapp)
}

/**
 * Verdien på et datakort. Forleddet, tallet og enheten står i hvert sitt
 * element, så teksten sammenlignes for hele verdien.
 */
function erVerdi(tekst: string) {
  return (_: string, el: Element | null) => !!el?.matches('.datakort__verdi') && el.textContent === tekst
}
const finnVerdi = (tekst: string) => screen.findByText(erVerdi(tekst))
const hentVerdi = (tekst: string) => screen.getByText(erVerdi(tekst))

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
    expect(await finnVerdi('10–20 nmol/L')).toBeTruthy()
    expect(leser.lesAnalyttside).toHaveBeenCalledWith('AMTNORSUM', 'publisert')

    expect(screen.getByRole('heading', { level: 1, name: /Amitriptylin/ })).toBeTruthy()
    // Forbeholdet under verdien vises ikke lenger.
    expect(screen.queryByText('Syntetisk forbehold')).toBeNull()
    expect(screen.getByText('gjenopptaket').tagName).toBe('STRONG')

    // Sumanalysen forklares, og komponenten med egen kode lenker dit.
    const setning = screen.getByText(/er en sumanalyse og omfatter/).closest('p')!
    expect(setning.textContent).toBe('AMTNORSUM er en sumanalyse og omfatter amitriptylin og nortriptylin (NOR).')
    expect(within(setning).getByRole('link', { name: /NOR/ }).getAttribute('href')).toBe('#/analytt/NOR')

    // Datakortet (panel 2) siterer A, teksten i panel 3 A og B, panelet B:
    // A blir 1 og B blir 2, og listen nederst følger numrene.
    expect(screen.getByRole('button', { name: 'Referanse 1' })).toBeTruthy()

    // Teksten står i en lukket seksjon til den åpnes.
    await user.click(screen.getByRole('button', { name: 'Farmakodynamikk' }))
    expect(screen.getByRole('button', { name: 'Referanse 2' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Referanser 1, 2' })).toBeTruthy()
    const liste = screen.getByRole('region', { name: 'Referanser' })
    expect(within(liste).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Første kilde · Nordmann O · 2020 · https://example.org/a',
      'Andre kilde · Hansen K · 2021',
    ])
  })

  it('viser koden, metoden og kategorien i metalinjen over navnet', async () => {
    vis('AMTNORSUM')
    await finnVerdi('10–20 nmol/L')
    const identitet = screen.getByRole('heading', { level: 1 }).closest('section')!
    const oppforing = katalog.finn('AMTNORSUM')!
    const metalinje = identitet.querySelector('.metalinje')!
    expect(within(metalinje as HTMLElement).getByText('AMTNORSUM').className).toBe('metalinje__kode')
    expect(metalinje.textContent).toContain(oppforing.analysemetode)
    // Linjen står før navnet.
    expect(metalinje.compareDocumentPosition(screen.getByRole('heading', { level: 1 }))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    )
  })

  it('grupperer viktige data i konsentrasjoner og kinetikk, med t₁/₂ og tₛₛ som symboler og en verdi per form', async () => {
    const kort = (id: string, elementtype: string, posisjon: number, data: Record<string, unknown>) =>
      utgave(id, {
        infoside: 'hs',
        panel: 'viktige_data',
        posisjon,
        elementtype,
        data: { nedre: null, ovre: null, forbehold: '', ...data },
        referanser: [],
      })
    const alle = (t: Tilstand): Analyttsidedata => {
      const s = side(t)
      return {
        ...s,
        elementer: [
          ...s.elementer,
          kort('tox', 'toksisk_omrade', 1, { nedre: 3600, enhet: 'nmol/L' }),
          kort('hl', 'halveringstid', 3, { nedre: 7, ovre: 7, enhet: 'timer' }),
          kort('ss', 'steady_state', 4, {
            former: [
              { form: 'Peroralt', typisk: 5, min: null, maks: null, enhet: 'døgn' },
              { form: 'Depotinjeksjon', typisk: null, min: 2, maks: 4, enhet: 'måneder' },
            ],
          }),
        ],
      }
    }
    vis('AMTNORSUM', kilde({ data: alle }))
    await finnVerdi('10–20 nmol/L')
    const viktige = screen.getByRole('region', { name: 'Viktige data' })
    const gruppe = (navn: string) => within(viktige).getByRole('group', { name: navn })
    const titler = (el: HTMLElement) => within(el).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)

    // Konsentrasjonene: etiketten og ikonet står alltid, ikke bare fargen.
    const konsentrasjoner = gruppe('Konsentrasjoner i serum')
    expect(titler(konsentrasjoner)).toEqual(['Referanseområde', 'Toksisk område'])
    for (const li of within(konsentrasjoner).getAllByRole('listitem')) expect(li.querySelector('svg.ikon')).not.toBeNull()
    // En nedre grense alene står med «>» i samme store skrift som tallet.
    const toksisk = within(konsentrasjoner).getByText(erVerdi(`> ${formaterTall(3600)} nmol/L`))
    expect([...toksisk.querySelectorAll('.datakort__tall')].map((el) => el.textContent)).toEqual(['>', formaterTall(3600)])

    // Kinetikken: symbolet med senket skrift, og ordet bare for skjermlesere.
    const kinetikk = gruppe('Kinetikk')
    const overskrifter = within(kinetikk).getAllByRole('heading', { level: 3 })
    expect(overskrifter.map((h) => h.querySelector('.datakort__symbol')?.innerHTML)).toEqual([
      't<sub>1/2</sub>',
      't<sub>ss</sub>',
    ])
    expect(overskrifter.map((h) => h.querySelector('.datakort__symbol')?.getAttribute('aria-hidden'))).toEqual([
      'true',
      'true',
    ])
    expect(overskrifter.map((h) => h.querySelector('.kun-skjermleser')?.textContent)).toEqual([
      'Halveringstid',
      'Tid til steady state',
    ])
    expect(overskrifter.map((h) => h.querySelector('.datakort__etikett'))).toEqual([null, null])
    // Et eldre kort med ett tall står som før, uten form.
    expect(within(kinetikk).getByText(erVerdi('7 timer'))).toBeTruthy()
    // Formene står side om side, med ikon og navn over verdien.
    const former = overskrifter[1]!.closest('li')!.querySelectorAll('.datakort__form')
    expect([...former].map((f) => f.querySelector('.datakort__formnavn')?.textContent)).toEqual([
      'Peroralt: ',
      'Depotinjeksjon: ',
    ])
    expect([...former].map((f) => f.querySelector('svg.ikon')?.getAttribute('data-ikon'))).toEqual(['tablet', 'syringe'])
    expect(within(kinetikk).getByText(erVerdi('5 døgn'))).toBeTruthy()
    expect(within(kinetikk).getByText(erVerdi('2–4 måneder'))).toBeTruthy()
  })

  it('går til viktige data fra en lenke uten å åpne eller lukke seksjoner', async () => {
    const rull = vi.spyOn(Element.prototype, 'scrollIntoView')
    vis('AMTNORSUM', kilde(), ['viktige_data'])
    await finnVerdi('10–20 nmol/L')
    const viktige = screen.getByRole('region', { name: 'Viktige data' })
    await waitFor(() => expect(rull.mock.contexts).toContain(viktige))
    expect(screen.getByRole('button', { name: 'Farmakodynamikk' }).getAttribute('aria-expanded')).toBe('false')
    rull.mockRestore()
  })

  it('viser bare panelene som har innhold, og ingen redigering for vanlige brukere', async () => {
    vis('AMTNORSUM')
    await finnVerdi('10–20 nmol/L')
    // Viktige data står fram, uten tittel.
    expect(screen.getByRole('region', { name: 'Viktige data' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Viktige data' })).toBeNull()
    // Kildene for et helt panel står i referansefeltet nederst, ikke i overskriften.
    const dynamikk = screen.getByRole('heading', { level: 2, name: 'Farmakodynamikk' })
    expect(within(dynamikk).queryByRole('button', { name: /Referanse/ })).toBeNull()
    const felt = screen.getByRole('region', { name: 'Farmakodynamikk', hidden: true }).querySelector('.referansefelt')!
    expect(felt.textContent).toBe('Kilder2')
    expect(felt.getAttribute('title')).toBe('Gjelder hele seksjonen')
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
    await finnVerdi('10–20 nmol/L')
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
    await finnVerdi('10–20 nmol/L')
    await user.keyboard('{Control>}b{/Control}')
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
    await user.keyboard('nmol')
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Treff 1 av 1'))
    expect(
      within(screen.getByRole('list', { name: 'Hvor treffene står' })).getByRole('button').textContent,
    ).toBe('Viktige data › Referanseområde')
  })

  it('hentes fram med Ctrl B og Cmd B, men ikke fra et redigeringsfelt', async () => {
    const user = userEvent.setup()
    vis('AMTNORSUM')
    await finnVerdi('10–20 nmol/L')
    const sok = screen.getByRole('searchbox', { name: 'Søk på denne siden' })
    await user.keyboard('{Meta>}b{/Meta}')
    expect(document.activeElement).toBe(sok)
    sok.blur()
    // Skråstreken var snarveien før; nå er den bare et tegn.
    await user.keyboard('/')
    expect(document.activeElement).not.toBe(sok)

    // I riktekst er Ctrl B fet skrift.
    const redigerbart = document.createElement('div')
    redigerbart.contentEditable = 'true'
    redigerbart.tabIndex = 0
    document.body.append(redigerbart)
    redigerbart.focus()
    // jsdom regner ikke ut `isContentEditable`.
    Object.defineProperty(redigerbart, 'isContentEditable', { value: true })
    const tast = new KeyboardEvent('keydown', { key: 'b', ctrlKey: true, bubbles: true, cancelable: true })
    redigerbart.dispatchEvent(tast)
    expect(tast.defaultPrevented).toBe(false)
    redigerbart.remove()
  })

  it('ser bort fra store og små bokstaver og aksenter', async () => {
    const user = userEvent.setup()
    vis('AMTNORSUM')
    await finnVerdi('10–20 nmol/L')
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

  it('viser viktige data alltid, utenfor trekkspillet, og resten lukket med en oppsummering', async () => {
    vis('AMTNORSUM')
    await finnVerdi('10–20 nmol/L')
    const viktige = screen.getByRole('region', { name: 'Viktige data' })
    expect(viktige.closest('[data-skuff], [hidden]')).toBeNull()
    expect(viktige.querySelector('[data-skuff]')).toBeNull()
    expect(apen('Farmakodynamikk')).toBe(false)
    // Oppsummeringen er begynnelsen av teksten, med teksten selv skjult.
    expect(screen.getByText('Hemmer gjenopptaket')).toBeTruthy()
    expect(screen.getByText('gjenopptaket', { selector: 'strong' }).closest('[hidden]')).not.toBeNull()
  })

  it('åpner seksjonen søket finner et treff i, og gjør treffet aktivt', async () => {
    const user = userEvent.setup()
    vis('AMTNORSUM')
    await finnVerdi('10–20 nmol/L')
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
    await finnVerdi('10–20 nmol/L')
    await waitFor(() => expect(apen('Farmakodynamikk')).toBe(true))
  })

  it('holder bare én seksjon åpen, og har ingen knapp for å åpne alle', async () => {
    const user = userEvent.setup()
    vis('AMTNORSUM')
    await finnVerdi('10–20 nmol/L')
    expect(screen.queryByRole('button', { name: 'Åpne alle' })).toBeNull()
    await user.click(skuffknapp('Farmakodynamikk'))
    expect(apen('Farmakodynamikk')).toBe(true)
    // Viktige data er ikke et søsken i trekkspillet og står fram uansett.
    expect(hentVerdi('10–20 nmol/L').closest('[hidden]')).toBeNull()
  })

  it('åpner søkets treff i én seksjon om gangen', async () => {
    const user = userEvent.setup()
    vis('AMTNORSUM')
    await finnVerdi('10–20 nmol/L')
    await user.type(screen.getByRole('searchbox', { name: 'Søk på denne siden' }), 'hemmer')
    await user.click(within(await screen.findByRole('list', { name: 'Hvor treffene står' })).getByRole('button'))
    expect(apen('Farmakodynamikk')).toBe(true)
    expect(hentVerdi('10–20 nmol/L').closest('[hidden]')).toBeNull()
  })

  it('åpner ikke alt i redigeringsmodus; redaktøren åpner seksjonen, også de som bare vises der', async () => {
    const user = userEvent.setup()
    vis('AMTNORSUM', kilde({ kanRedigere: true }))
    await finnVerdi('10–20 nmol/L')
    await user.click(skuffknapp('Farmakodynamikk'))
    await user.click(screen.getByRole('button', { name: 'Rediger' }))
    await screen.findByRole('heading', { level: 2, name: 'Dosering' })
    // Det som sto åpent, står fortsatt åpent, og bare det.
    await screen.findByRole('button', { name: 'Rediger: Farmakodynamikk' })
    expect(apen('Farmakodynamikk')).toBe(true)
    expect(apen('Dosering')).toBe(false)
    expect(screen.queryByRole('button', { name: 'Legg til: Dosering' })).toBeNull()

    await user.click(skuffknapp('Dosering'))
    expect(await screen.findByRole('button', { name: 'Legg til: Dosering' })).toBeTruthy()
    expect(apen('Farmakodynamikk')).toBe(false)

    // «Kilder for panelet» i hodet åpner seksjonen skjemaet står i.
    const indikasjon = screen.getByRole('region', { name: 'Indikasjon' })
    await user.click(within(indikasjon).getByRole('button', { name: 'Kilder for panelet' }))
    expect(apen('Indikasjon')).toBe(true)
    expect(apen('Dosering')).toBe(false)
  })
})

describe('preparatene', () => {
  const skuffknapp = (navn: string) =>
    screen.getAllByRole('button', { name: navn, hidden: true }).find((b) => b.hasAttribute('aria-expanded'))!

  it('viser ikke seksjonen når siden ikke er koblet', async () => {
    const k = kilde()
    vis('AMTNORSUM', k)
    await finnVerdi('10–20 nmol/L')
    expect(screen.queryByRole('region', { name: 'Preparater' })).toBeNull()
    expect(k.legemidler.les).not.toHaveBeenCalled()
  })

  it('viser formene som overskrifter, styrkene som kort og preparatene i den åpne styrken, med kilden', async () => {
    const user = userEvent.setup()
    const k = kilde({ data: medKobling })
    vis('AMTNORSUM', k)
    // Lukket står oppsummeringen. Fritaket telles, men er ikke en egen gruppe.
    expect(
      await screen.findByText('3 preparater · 2 legemiddelformer · 3 styrker · 1 med godkjenningsfritak'),
    ).toBeTruthy()
    expect(k.legemidler.les).toHaveBeenCalledWith(['ID_AMI'])
    await user.click(skuffknapp('Preparater'))
    expect(screen.getByText('2 styrker · 10–25 mg · 2 preparater')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Krever godkjenningsfritak' })).toBeNull()
    await user.click(skuffknapp('Tablett'))

    // Ett kort per styrke, uansett antall preparater, med antallet som beskrivelse.
    const styrker = within(screen.getByRole('list', { name: 'Styrker, tablett' }))
    const [ti, tjuefem] = styrker.getAllByRole('button', { expanded: false })
    expect([ti!.textContent, tjuefem!.textContent]).toEqual(['10 mg1 preparat', '25 mg2 preparater'])
    expect(tjuefem!.getAttribute('aria-describedby')).toBeTruthy()

    // Åpnet står preparatnavnene alfabetisk, og fritaket er et merke i samme liste.
    await user.click(tjuefem!)
    expect(tjuefem!.getAttribute('aria-expanded')).toBe('true')
    const navn = within(screen.getByRole('list', { name: 'Preparater med 25 mg' })).getAllByRole('button')
    expect(navn.map((b) => b.textContent)).toEqual(['Tabletto', 'UtlandiaGodkjenningsfritak'])
    expect(navn[0]!.getAttribute('aria-haspopup')).toBe('dialog')

    // Bare én styrke står åpen.
    await user.click(ti!)
    expect(ti!.getAttribute('aria-expanded')).toBe('true')
    expect(tjuefem!.getAttribute('aria-expanded')).toBe('false')

    // FEST er kilden i seksjonens referansefelt: en nummerert referanse, med
    // uttrekket og kontrollen ved siden av, ikke en løpende «Kilde: …».
    // Preparatene står etter viktige data og farmakodynamikken, som har kilde
    // 1 og 2, så FEST blir 3.
    const preparater = screen.getByRole('region', { name: 'Preparater' })
    expect(within(preparater).queryByText(/Kilde: FEST/)).toBeNull()
    const felt = preparater.querySelector(':scope > * .referansefelt--panel')!
    expect(within(felt as HTMLElement).getByRole('button', { name: 'Referanse 3' })).toBeTruthy()
    expect(felt.textContent).toMatch(
      /Legemiddeldata fra FEST, uttrekk fra 8\. september 2026, sist kontrollert 23\. september 2026$/,
    )
    // I listen nederst står FEST sammen med de redaksjonelle, merket som automatisk.
    const liste = screen.getByRole('region', { name: 'Referanser' })
    const [, , fest] = within(liste).getAllByRole('listitem')
    expect(fest!.getAttribute('value')).toBe('3')
    expect(fest!.textContent).toMatch(/^FEST – Forskrivnings- og ekspedisjonsstøtte · Direktoratet for medisinske produkter/)
    expect(within(fest!).getByText('Automatisk fra FEST')).toBeTruthy()
  })

  it('åpner preparatvinduet med alle styrkene, og gir fokuset tilbake når det lukkes', async () => {
    const user = userEvent.setup()
    vis('AMTNORSUM', kilde({ data: medKobling }))
    await apneSkuff(user, 'Preparater')
    await apneSkuff(user, 'Tablett')
    await user.click(screen.getByRole('button', { name: /^25 mg/ }))
    const tabletto = screen.getByRole('button', { name: 'Tabletto' })
    await user.click(tabletto)

    const vindu = screen.getByRole('dialog', { name: 'Tabletto' })
    expect(vindu.hasAttribute('open')).toBe(true)
    expect(within(vindu).getByText('Amitriptylin · Tablett')).toBeTruthy()
    const fakta = (navn: string) => within(vindu).getByText(navn).nextElementSibling?.textContent
    expect([fakta('Reseptgruppe'), fakta('Administrasjon'), fakta('ATC'), fakta('Virkestoff')]).toEqual([
      'C',
      'Oral bruk',
      'N06AA09',
      'Amitriptylin',
    ])

    // Alle styrkene står i vinduet. Den det ble åpnet fra, står åpen og er merket.
    const [ti, tjuefem] = within(vindu).getAllByRole('button', { name: /pakning/ })
    expect([ti!.textContent, tjuefem!.textContent]).toEqual(['10 mg1 pakning', '25 mg0 pakninger'])
    expect(tjuefem!.getAttribute('aria-expanded')).toBe('true')
    expect(ti!.getAttribute('aria-expanded')).toBe('false')
    const rad25 = tjuefem!.closest('li')!
    expect(within(rad25).getByText('Åpnet herfra')).toBeTruthy()
    // Delingen står med FESTs egne ord, som tekst og ikke bare som ikon.
    expect(rad25.querySelector('.handteringsmerke')!.textContent).toBe('Deling: Delbar i 2')
    // Preparatomtalen er ulik for styrkene, og står ved hver av dem.
    expect(within(rad25).getByRole('link', { name: /Preparatomtale/ }).getAttribute('href')).toBe(
      'https://produktinformasjon.legemiddelsok.no/preparatomtaler/ID_M2.pdf',
    )

    // En annen styrke åpnes for seg, med pakningene og varenummeret.
    await user.click(ti!)
    expect(tjuefem!.getAttribute('aria-expanded')).toBe('false')
    const tabell = within(ti!.closest('li')!).getByRole('table')
    expect(within(tabell).getAllByRole('row').map((r) => r.textContent)).toEqual(['PakningVarenr.', '30 stk, blisterpakning123456'])
    // FEST er kilden i vinduet også, med samme nummer som i referanselisten.
    const liste = screen.getByRole('region', { name: 'Referanser' })
    const fest = within(liste)
      .getAllByRole('listitem')
      .find((r) => r.textContent?.startsWith('FEST'))!
    expect(within(vindu).getByRole('button', { name: `Referanse ${fest.getAttribute('value')}` })).toBeTruthy()

    await user.click(within(vindu).getByRole('button', { name: 'Lukk preparatet' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Tabletto' }))

    // Et trykk på bakgrunnen lukker også, og fritaket står som merke i vinduet.
    await user.click(screen.getByRole('button', { name: /^Utlandia/ }))
    const fritak = screen.getByRole('dialog', { name: 'Utlandia' })
    expect(within(fritak).getByText('Godkjenningsfritak')).toBeTruthy()
    await user.click(fritak)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('åpner legemiddelformen fra en direktelenke', async () => {
    vis('AMTNORSUM', kilde({ data: medKobling }), ['preparater', 'form-53'])
    await waitFor(() => expect(skuffknapp('Tablett').getAttribute('aria-expanded')).toBe('true'))
    expect(skuffknapp('Preparater').getAttribute('aria-expanded')).toBe('true')
    expect(skuffknapp('Depotkapsel, hard').getAttribute('aria-expanded')).toBe('false')
  })

  it('finner preparatene i søket på siden, og åpner formen og styrken treffet står i', async () => {
    const user = userEvent.setup()
    vis('AMTNORSUM', kilde({ data: medKobling }))
    await screen.findByText(/3 preparater/)
    const felt = screen.getByRole('searchbox', { name: 'Søk på denne siden' })
    await user.type(felt, 'retardo')
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Treff 1 av 1'))
    const steder = within(screen.getByRole('list', { name: 'Hvor treffene står' }))
    await user.click(steder.getByRole('button', { name: /Depotkapsel, hard/ }))
    expect(skuffknapp('Depotkapsel, hard').getAttribute('aria-expanded')).toBe('true')

    // Treffet står i en lukket styrke; Enter går dit og åpner den.
    await user.clear(felt)
    await user.type(felt, 'utlandia{Enter}')
    await waitFor(() => expect(skuffknapp('Tablett').getAttribute('aria-expanded')).toBe('true'))
    expect(screen.getByRole('button', { name: /^25 mg/ }).getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('button', { name: /^10 mg/ }).getAttribute('aria-expanded')).toBe('false')
  })

  it('åpner styrken når nettleserens eget søk finner noe i den', async () => {
    const user = userEvent.setup()
    vis('AMTNORSUM', kilde({ data: medKobling }))
    await apneSkuff(user, 'Preparater')
    await apneSkuff(user, 'Tablett')
    const knapp = screen.getByRole('button', { name: /^10 mg/ })
    const innhold = document.getElementById(knapp.getAttribute('aria-controls')!)!
    expect(innhold.getAttribute('hidden')).toBe('until-found')
    act(() => {
      innhold.dispatchEvent(new Event('beforematch'))
    })
    expect(knapp.getAttribute('aria-expanded')).toBe('true')
    expect(innhold.hasAttribute('hidden')).toBe(false)
  })

  it('sier fra når preparatene ikke kan hentes, uten at resten av siden faller', async () => {
    const k = kilde({ data: medKobling })
    k.legemidler.les = vi.fn(async () => {
      throw new Error('Nettverksfeil')
    })
    vis('AMTNORSUM', k)
    expect(await screen.findByText('Fikk ikke hentet preparatene')).toBeTruthy()
    expect(hentVerdi('10–20 nmol/L')).toBeTruthy()
  })
})

describe('interaksjonene', () => {
  const skuffknapp = (navn: string) =>
    screen.getAllByRole('button', { name: navn, hidden: true }).find((b) => b.hasAttribute('aria-expanded'))!

  it('viser ikke seksjonen når siden ikke er koblet', async () => {
    const k = kilde()
    vis('AMTNORSUM', k)
    await finnVerdi('10–20 nmol/L')
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
    // DMPs referanse står i kortets referansefelt, i samme nummerering som resten.
    const testhemmer = screen.getByText('Gjelder ved høye doser.').closest('.interaksjon') as HTMLElement
    const felt = testhemmer.querySelector('.referansefelt') as HTMLElement
    const pille = within(felt).getByRole('button', { name: /^Referanse \d+$/ })
    await user.click(pille)
    expect(within(felt).getByRole('link', { name: 'https://example.org/kilde' }).getAttribute('href')).toBe(
      'https://example.org/kilde',
    )
    expect(felt.textContent).toContain('Testkilde · https://example.org/kilde')
    const liste = screen.getByRole('region', { name: 'Referanser' })
    const oppforing = within(liste)
      .getAllByRole('listitem')
      .find((li) => li.textContent?.startsWith('Testkilde · https://example.org/kilde'))!
    expect(oppforing.getAttribute('value')).toBe(pille.textContent)
    expect(within(oppforing).getByText('Automatisk fra FEST')).toBeTruthy()
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
    expect(hentVerdi('10–20 nmol/L')).toBeTruthy()
  })
})

describe('redigeringsmodus', () => {
  it('viser utkastet og alle panelene, med «Sist redigert»', async () => {
    const user = userEvent.setup()
    const { leser } = vis('AMTNORSUM', kilde({ kanRedigere: true }))
    await finnVerdi('10–20 nmol/L')
    await user.click(screen.getByRole('button', { name: 'Rediger' }))
    await waitFor(() => expect(leser.lesAnalyttside).toHaveBeenLastCalledWith('AMTNORSUM', 'utkast'))
    expect(screen.getByRole('button', { name: 'Avslutt redigering' }).getAttribute('aria-pressed')).toBe('true')
    // I redigeringsmodus står bare redigeringen i menyen.
    for (const navn of ['Åpne fortolkning', 'Rediger', 'Lukk']) {
      expect(screen.queryByRole('button', { name: navn })).toBeNull()
    }
    for (const panel of ['Dosering', 'Indikasjon', 'Farmakokinetikk', 'Serumkonsentrasjoner ved ulike doser']) {
      expect(screen.getByRole('heading', { level: 2, name: panel })).toBeTruthy()
    }
    expect(screen.getAllByText('Sist redigert av Rita Redaktør 22.09.2026 kl. 14:32').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Legg til: Halveringstid' })).toBeTruthy()
  })

  it('redigerer i et eget vindu over siden, med fokus i det første feltet', async () => {
    const user = userEvent.setup()
    vis('AMTNORSUM', kilde({ kanRedigere: true }))
    await finnVerdi('10–20 nmol/L')
    await user.click(screen.getByRole('button', { name: 'Rediger' }))
    await user.click(await screen.findByRole('button', { name: 'Rediger: Referanseområde' }))

    const vindu = redigeringsvindu('Referanseområde')
    expect(within(vindu).getByRole('form', { name: 'Rediger: Referanseområde' })).toBeTruthy()
    expect(document.activeElement).toBe(within(vindu).getByLabelText('Nedre grense'))
    // Kortet står fortsatt på siden bak vinduet.
    expect(hentVerdi('10–20 nmol/L')).toBeTruthy()

    await user.click(within(vindu).getByRole('button', { name: 'Avbryt' }))
    expect(screen.queryByRole('dialog', { name: 'Referanseområde' })).toBeNull()
    // Fokuset går tilbake til knappen vinduet ble åpnet fra.
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Rediger: Referanseområde' }))
  })

  it('lukkes rett når ingenting er endret, men spør før endringer forkastes', async () => {
    const user = userEvent.setup()
    const { lager } = vis('AMTNORSUM', kilde({ kanRedigere: true }))
    await finnVerdi('10–20 nmol/L')
    await user.click(screen.getByRole('button', { name: 'Rediger' }))
    const rediger = await screen.findByRole('button', { name: 'Rediger: Referanseområde' })

    await user.click(rediger)
    await user.click(within(redigeringsvindu('Referanseområde')).getByRole('button', { name: 'Lukk redigeringen' }))
    expect(screen.queryByRole('dialog', { name: 'Referanseområde' })).toBeNull()

    await user.click(rediger)
    const vindu = redigeringsvindu('Referanseområde')
    await user.type(within(vindu).getByLabelText('Enhet'), 'x')
    // Escape går gjennom nettleserens `cancel`, som vinduet stanser.
    const escape = new Event('cancel', { cancelable: true })
    act(() => void vindu.dispatchEvent(escape))
    expect(escape.defaultPrevented).toBe(true)
    expect(within(vindu).getByRole('alert').textContent).toMatch(/endringer som ikke er lagret/)
    expect(document.activeElement).toBe(within(vindu).getByRole('button', { name: 'Fortsett å redigere' }))

    await user.click(within(vindu).getByRole('button', { name: 'Fortsett å redigere' }))
    expect((within(vindu).getByLabelText('Enhet') as HTMLInputElement).value).toBe('nmol/Lx')
    await user.click(within(vindu).getByRole('button', { name: 'Lukk redigeringen' }))
    await user.click(within(vindu).getByRole('button', { name: 'Forkast endringene' }))
    expect(screen.queryByRole('dialog', { name: 'Referanseområde' })).toBeNull()
    expect(lager.lagreUtkast).not.toHaveBeenCalled()
  })

  it('lagrer et datakort mot revisjonen som ble åpnet', async () => {
    const user = userEvent.setup()
    const { lager } = vis('AMTNORSUM', kilde({ kanRedigere: true }))
    await finnVerdi('10–20 nmol/L')
    await user.click(screen.getByRole('button', { name: 'Rediger' }))
    await user.click(await screen.findByRole('button', { name: 'Rediger: Referanseområde' }))

    const skjema = redigeringsvindu('Referanseområde')
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
      data: { nedre: 10, ovre: 25.5, enhet: 'nmol/L' },
      referanser: [REF_A.id],
    })
  })

  it('avviser en nedre grense over den øvre, uten å lagre', async () => {
    const user = userEvent.setup()
    const { lager } = vis('AMTNORSUM', kilde({ kanRedigere: true }))
    await finnVerdi('10–20 nmol/L')
    await user.click(screen.getByRole('button', { name: 'Rediger' }))
    await user.click(await screen.findByRole('button', { name: 'Rediger: Referanseområde' }))
    const skjema = redigeringsvindu('Referanseområde')
    const nedre = within(skjema).getByLabelText('Nedre grense')
    await user.clear(nedre)
    await user.type(nedre, '30')
    await user.click(within(skjema).getByRole('button', { name: 'Lagre utkast' }))
    expect(within(skjema).getByRole('alert').textContent).toBe('Nedre grense kan ikke være høyere enn øvre.')
    expect(lager.lagreUtkast).not.toHaveBeenCalled()
  })

  it('legger inn tₛₛ for to legemiddelformer, og avviser en typisk verdi utenfor området', async () => {
    const user = userEvent.setup()
    const { lager } = vis('AMTNORSUM', kilde({ kanRedigere: true }))
    await finnVerdi('10–20 nmol/L')
    await user.click(screen.getByRole('button', { name: 'Rediger' }))
    await user.click(await screen.findByRole('button', { name: 'Legg til: Tid til steady state' }))
    const skjema = redigeringsvindu('Tid til steady state')
    const fyll = async (rad: HTMLElement, felt: Record<string, string>) => {
      for (const [merke, verdi] of Object.entries(felt)) await user.type(within(rad).getByLabelText(merke), verdi)
    }
    await fyll(within(skjema).getByRole('group', { name: 'Legemiddelform 1' }), {
      Legemiddelform: 'Peroralt',
      'Typisk verdi': '5',
      Enhet: 'døgn',
    })
    await user.click(within(skjema).getByRole('button', { name: 'Legg til legemiddelform' }))
    const depot = within(skjema).getByRole('group', { name: 'Legemiddelform 2' })
    await fyll(depot, { Legemiddelform: 'Depotinjeksjon', 'Typisk verdi': '5', Minimum: '2', Maksimum: '4', Enhet: 'måneder' })

    await user.click(within(skjema).getByRole('button', { name: 'Lagre utkast' }))
    expect(within(skjema).getByRole('alert').textContent).toMatch(/^Depotinjeksjon: /)
    expect(lager.opprettUtkast).not.toHaveBeenCalled()

    await user.clear(within(depot).getByLabelText('Typisk verdi'))
    await user.click(within(skjema).getByRole('button', { name: 'Lagre utkast' }))
    await waitFor(() => expect(lager.opprettUtkast).toHaveBeenCalledTimes(1))
    expect(vi.mocked(lager.opprettUtkast).mock.calls[0]![1]).toMatchObject({
      panel: 'viktige_data',
      elementtype: 'steady_state',
      data: {
        former: [
          { form: 'Peroralt', typisk: 5, min: null, maks: null, enhet: 'døgn' },
          { form: 'Depotinjeksjon', typisk: null, min: 2, maks: 4, enhet: 'måneder' },
        ],
      },
    })
  })

  it('sier fra når noen andre har lagret i mellomtiden, og beholder det som ble skrevet', async () => {
    const user = userEvent.setup()
    const k = kilde({ kanRedigere: true })
    k.lager.lagreUtkast = vi.fn(async () => {
      throw new Samtidighetskonflikt(3, 2)
    })
    vis('AMTNORSUM', k)
    await finnVerdi('10–20 nmol/L')
    await user.click(screen.getByRole('button', { name: 'Rediger' }))
    await user.click(await screen.findByRole('button', { name: 'Rediger: Referanseområde' }))
    const skjema = redigeringsvindu('Referanseområde')
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
    await finnVerdi('10–20 nmol/L')
    await user.click(screen.getByRole('button', { name: 'Rediger' }))
    await user.click(await screen.findByRole('button', { name: 'Rediger: Referanseområde' }))
    const skjema = redigeringsvindu('Referanseområde')

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
    await finnVerdi('10–20 nmol/L')
    await user.click(screen.getByRole('button', { name: 'Rediger' }))
    // Datakortet og en kommentar regelsettet peker på, har revisjoner som ikke
    // er publisert. Regelsettet selv er publisert og er ikke med.
    // Statuspillen i toppmenyen teller det som ikke er publisert.
    expect(await screen.findByText('Redigerer · utkast med 2 endringer')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Publiser' }))
    const oppsummering = screen.getByRole('dialog', { name: 'Publiser endringene' })
    await waitFor(() =>
      expect(within(oppsummering).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
        'Viktige data',
        `Kommentar: ${HOY_NAVN}`,
      ]),
    )
    expect(lager.publiserUtkast).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Publiser nå' }))
    await waitFor(() => expect(lager.publiserUtkast).toHaveBeenCalledWith(HOY, 2))
    expect(vi.mocked(lager.publiserUtkast).mock.calls).toEqual([
      ['kort', 2],
      [HOY, 2],
    ])
  })

  it('oppretter siden, med komponentene, første gang noe lagres', async () => {
    const user = userEvent.setup()
    const k = kilde({ kanRedigere: true, data: () => TOM_SIDE })
    k.leser.finnInfosider = vi.fn(async () => [utgave('nortriptylin', { navn: 'Nortriptylin' })])
    const { lager, leser } = vis('AMTNORSUM', k)
    await user.click(screen.getByRole('button', { name: 'Rediger' }))
    await apneSkuff(user, 'Preparater')
    await user.click(await screen.findByRole('button', { name: 'Legg til: Koblingen til legemiddeldataene' }))
    const skjema = redigeringsvindu('Koblingen til legemiddeldataene')
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
    await finnVerdi('10–20 nmol/L')
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
    await finnVerdi('10–20 nmol/L')
    await user.click(screen.getByRole('button', { name: 'Rediger' }))
    await user.click(await screen.findByRole('button', { name: 'Legg til: Halveringstid' }))
    const skjema = redigeringsvindu('Halveringstid')
    await user.type(within(skjema).getByLabelText('Typisk verdi'), '3')
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
    await finnVerdi('10–20 nmol/L')
    await user.click(screen.getByRole('button', { name: 'Rediger' }))
    await apneSkuff(user, 'Farmakodynamikk')
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
    await finnVerdi('10–20 nmol/L')
    await user.click(screen.getByRole('button', { name: 'Rediger' }))
    await apneSkuff(user, 'Farmakokinetikk')
    await apneSkuff(user, 'Absorpsjon')
    await user.click(await screen.findByRole('button', { name: 'Flytt ned: Absorpsjon' }))
    // Begge sto på plass 0, i ID-rekkefølge. Metabolisme blir stående på 0;
    // bare Absorpsjon får ny plass og lagres.
    await waitFor(() => expect(lager.lagreUtkast).toHaveBeenCalledTimes(1))
    expect(lager.lagreUtkast).toHaveBeenCalledWith('k1', 1, expect.objectContaining({ posisjon: 1 }))
  })

  it('åpner både seksjonen og kortet når søket går til et treff i et lukket kort', async () => {
    const user = userEvent.setup()
    vis('AMTNORSUM', kilde({ data: medKort() }))
    await finnVerdi('10–20 nmol/L')
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
    await finnVerdi('10–20 nmol/L')
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
    await finnVerdi('10–20 nmol/L')
    await user.click(screen.getByRole('button', { name: 'Rediger' }))
    await apneSkuff(user, 'Farmakokinetikk')
    await apneSkuff(user, 'Metabolisme')
    await user.click(await screen.findByRole('button', { name: 'Fjern: Metabolisme' }))
    expect(lager.lagreUtkast).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Bekreft: fjern Metabolisme' }))
    await waitFor(() => expect(lager.lagreUtkast).toHaveBeenCalledTimes(1))
    expect(vi.mocked(lager.lagreUtkast).mock.calls[0]![2]).toMatchObject({ panel: 'fjernet', elementtype: 'kinetikkort' })
  })
})

describe('fortolkningsreglene', () => {
  /** Siden i redigeringsmodus, med reglene fra utkastet. */
  async function redigerer(k = kilde({ kanRedigere: true })) {
    const user = userEvent.setup()
    const verdier = vis('AMTNORSUM', k)
    await finnVerdi('10–20 nmol/L')
    await user.click(screen.getByRole('button', { name: 'Rediger' }))
    await screen.findByText('Endret syntetisk høy kommentar.')
    return { user, ...verdier }
  }

  /** Seksjonen «Fortolkning», åpnet. Den er lukket når siden vises. */
  async function apneFortolkning(user = userEvent.setup()) {
    const seksjon = await screen.findByRole('region', { name: 'Fortolkning' })
    const knapp = within(seksjon).getByRole('button', { name: 'Fortolkning' })
    expect(knapp.getAttribute('aria-expanded')).toBe('false')
    await user.click(knapp)
    return seksjon
  }

  it('viser reglene som en tabell, med ringegrensen og cut-off', async () => {
    vis('AMTNORSUM')
    // Lukket sier seksjonen hva den inneholder.
    expect((await screen.findByText('3 områder · Ringegrense 1800 nmol/L · Cut-off')).textContent).toBeTruthy()
    const seksjon = await apneFortolkning()
    expect(seksjon.id).toBe('panel-fortolkning')
    const rader = within(seksjon)
      .getAllByRole('row')
      .slice(1)
      .map((rad) => [...rad.querySelectorAll('th, td')].map((c) => c.textContent))
    expect(rader).toEqual([
      ['< 10', 'Syntetisk lav kommentar.', ''],
      ['10 – 1799', 'Syntetisk middels kommentar.', ''],
      ['≥ 1800', 'Syntetisk høy kommentar.', 'Ring rekvirent'],
      ['Til stede under cut-off', 'Syntetisk innledning. Syntetisk middels kommentar.', ''],
    ])
    expect(within(seksjon).getByText('Ringegrense: 1800 nmol/L')).toBeTruthy()
    expect(within(seksjon).queryByRole('button', { name: 'Rediger reglene' })).toBeNull()
  })

  it('simulerer en verdi på og rundt grensene, og cut-off', async () => {
    const user = userEvent.setup()
    vis('AMTNORSUM')
    const seksjon = await apneFortolkning(user)
    // Simulatoren er et detaljkort i seksjonen, med sin egen adresse.
    const simulator = within(seksjon).getByRole('group', { name: 'Simulator' })
    expect(simulator.id).toBe('panel-fortolkning--simulator')
    await user.click(within(simulator).getByRole('button', { name: 'Simulator' }))
    const felt = within(simulator).getByLabelText('Målt konsentrasjon (nmol/L)')
    const svar = () => seksjon.querySelector('.regler__svar')!.textContent

    await user.type(felt, '1799,5')
    expect(svar()).toBe('10 – 1799 nmol/L · Innenfor referanseområdetSyntetisk middels kommentar.Ingen ekstra handling.')
    await user.clear(felt)
    await user.type(felt, '1800')
    expect(svar()).toBe('≥ 1800 nmol/L · Over referanseområdetSyntetisk høy kommentar.Ring rekvirent.')
    await user.click(within(seksjon).getByRole('checkbox', { name: 'Til stede under cut-off' }))
    expect(svar()).toBe('Til stede under cut-offSyntetisk innledning. Syntetisk middels kommentar.Ingen ekstra handling.')
  })

  it('lagrer en flyttet grense og en endret kommentar som utkast, med ringegrensen', async () => {
    const { user, lager } = await redigerer()
    const seksjon = screen.getByRole('region', { name: 'Fortolkning' })
    await user.click(within(seksjon).getByRole('button', { name: 'Rediger reglene' }))
    const skjema = screen.getByRole('form', { name: 'Rediger: Fortolkningsreglene for AMTNORSUM' })

    const grense = within(skjema).getByLabelText('Grense mellom intervall 2 og 3')
    await user.clear(grense)
    await user.type(grense, '2000')
    // Kommentaren til intervall 2 brukes også av cut-off, og det sies.
    const intervall2 = within(skjema).getByRole('group', { name: 'Intervall 2: 10 – 1999 nmol/L' })
    const tekst = within(intervall2).getByLabelText('Kommentartekst')
    expect(within(intervall2).getByText(/brukes også av cut-off/)).toBeTruthy()
    await user.clear(tekst)
    await user.type(tekst, ' Ny syntetisk kommentar. ')

    // Simulatoren prøver det som står i skjemaet.
    await user.type(within(skjema).getByLabelText('Målt konsentrasjon (nmol/L)'), '1999')
    expect(skjema.querySelector('.regler__svar')!.textContent).toMatch(/Ny syntetisk kommentar/)

    await user.click(within(skjema).getByRole('button', { name: 'Lagre utkast' }))
    await waitFor(() => expect(lager.lagreIntervallregelsett).toHaveBeenCalled())
    const [id, revisjon, innhold, kommentarer] = vi.mocked(lager.lagreIntervallregelsett).mock.calls[0]!
    expect([id, revisjon]).toEqual([REGELSETT_ID, 2])
    // Regelsettet lagres uten tekstene; den endrede teksten lagres i kommentaren.
    expect(innhold).toEqual({ ...utenKommentarer(regelsett('utkast')), skillepunkter: [10, 2000], ringegrense: 2000 })
    expect(kommentarer).toEqual([
      {
        id: 'k-middels',
        revisjon: 1,
        innhold: { navn: 'AMTNORSUM – innenfor referanseområdet', tekst: 'Ny syntetisk kommentar.', plassholdere: [] },
      },
    ])
    expect(lager.lagreUtkast).not.toHaveBeenCalled()
  })

  it('deler og slår sammen intervaller, og avviser en grense utenfor intervallet', async () => {
    const { user, lager } = await redigerer()
    await user.click(screen.getByRole('button', { name: 'Rediger reglene' }))
    const skjema = screen.getByRole('form', { name: 'Rediger: Fortolkningsreglene for AMTNORSUM' })
    const intervall2 = within(skjema).getByRole('group', { name: 'Intervall 2: 10 – 1799 nmol/L' })
    await user.click(within(intervall2).getByRole('button', { name: 'Del intervallet' }))
    await user.type(within(intervall2).getByLabelText('Ny grense inne i intervallet'), '5000')
    await user.click(within(intervall2).getByRole('button', { name: 'Del her' }))
    expect(within(intervall2).getByRole('alert').textContent).toBe('Grensen må ligge inne i intervallet.')
    const ny = within(intervall2).getByLabelText('Ny grense inne i intervallet')
    await user.clear(ny)
    await user.type(ny, '500')
    await user.click(within(intervall2).getByRole('button', { name: 'Del her' }))
    expect(within(skjema).getByRole('group', { name: 'Intervall 3: 500 – 1799 nmol/L' })).toBeTruthy()

    await user.click(
      within(within(skjema).getByRole('group', { name: 'Intervall 2: 10 – 499 nmol/L' })).getByRole('button', {
        name: 'Slå sammen med intervallet over',
      }),
    )
    await user.click(within(skjema).getByRole('button', { name: 'Lagre utkast' }))
    await waitFor(() => expect(lager.lagreIntervallregelsett).toHaveBeenCalled())
    expect(vi.mocked(lager.lagreIntervallregelsett).mock.calls[0]!.slice(2)).toEqual([
      utenKommentarer(regelsett('utkast')),
      [],
    ])
  })

  it('lar brukeren sammenligne og velge ved en konflikt, uten å miste det som er gjort', async () => {
    const k = kilde({ kanRedigere: true })
    const { user, lager, leser } = await redigerer(k)
    vi.mocked(lager.lagreIntervallregelsett).mockRejectedValueOnce(new Samtidighetskonflikt(3, 2))
    vi.mocked(leser.finnIntervallregelsett).mockResolvedValueOnce(regelsettutgave('publisert', 3))
    await user.click(screen.getByRole('button', { name: 'Rediger reglene' }))
    const skjema = screen.getByRole('form', { name: 'Rediger: Fortolkningsreglene for AMTNORSUM' })
    const tekst = within(within(skjema).getByRole('group', { name: /^Intervall 1/ })).getByLabelText('Kommentartekst')
    await user.clear(tekst)
    await user.type(tekst, 'Min syntetiske kommentar.')
    await user.click(within(skjema).getByRole('button', { name: 'Lagre utkast' }))

    expect(await within(skjema).findByText(/Noen andre har lagret reglene/)).toBeTruthy()
    expect((tekst as HTMLTextAreaElement).value).toBe('Min syntetiske kommentar.')
    await user.click(within(skjema).getByRole('button', { name: 'Sammenlign med deres' }))
    expect(await within(skjema).findByText('revisjon 3', { exact: false })).toBeTruthy()
    // Rødt er deres, grønt er ditt.
    expect(skjema.querySelector('del')?.textContent).toBe('Syntetisk lav')
    expect(skjema.querySelector('ins')?.textContent).toBe('Min syntetiske')

    await user.click(within(skjema).getByRole('button', { name: 'Lagre mine over deres' }))
    await waitFor(() => expect(lager.lagreIntervallregelsett).toHaveBeenCalledTimes(2))
    const [id, revisjon, , kommentarer] = vi.mocked(lager.lagreIntervallregelsett).mock.calls[1]!
    expect([id, revisjon]).toEqual([REGELSETT_ID, 3])
    expect(kommentarer).toEqual([
      expect.objectContaining({ id: 'k-lav', revisjon: 1, innhold: expect.objectContaining({ tekst: 'Min syntetiske kommentar.' }) }),
      // Den høye kommentaren er ulik i deres utgave, og det brukeren har, lagres over.
      expect.objectContaining({ id: HOY, revisjon: 1, innhold: expect.objectContaining({ tekst: 'Endret syntetisk høy kommentar.' }) }),
    ])
  })

  it('viser historikken med hvem, når og hva som er endret, og gjenoppretter som en ny revisjon', async () => {
    const { user, lager } = await redigerer()
    const seksjon = await apneFortolkning(user)
    await user.click(within(seksjon).getByRole('button', { name: /Vis historikken for fortolkningsreglene/ }))
    const vindu = await screen.findByRole('dialog', { name: 'Historikk: Fortolkningsreglene' })

    expect(await within(vindu).findByText('Revisjon 2: endret (utkastet nå)')).toBeTruthy()
    expect(within(vindu).getAllByText('av Rita Redaktør 22.09.2026 kl. 14:32').length).toBeGreaterThan(0)
    expect(within(vindu).getByText('Syntetisk import')).toBeTruthy()
    // Regelsettet eier ikke tekstene: endringen er at det øverste intervallet
    // fikk sin egen kommentar, vist med navnet.
    expect(within(vindu).getByRole('heading', { name: 'Intervall 3' })).toBeTruthy()
    expect([...vindu.querySelectorAll('del')].map((d) => d.textContent?.trim())).toEqual(['innenfor referanseområdet'])
    expect([...vindu.querySelectorAll('ins')].map((d) => d.textContent?.trim())).toEqual([
      'over referanseområdet, ring rekvirent',
    ])
    expect(vindu.textContent).not.toContain('Syntetisk høy kommentar.')

    // Side om side viser alle feltene, med det endrede merket.
    await user.click(within(vindu).getByRole('button', { name: 'Side om side' }))
    expect(within(vindu).getByRole('columnheader', { name: 'Revisjon 1' })).toBeTruthy()
    expect(vindu.querySelectorAll('tr.historikk__endret')).toHaveLength(1)

    // Revisjon 1 gjenopprettes som en ny revisjon av utkastet.
    await user.click(within(vindu).getByRole('button', { name: /Revisjon 1: opprettet/ }))
    await user.click(within(vindu).getByRole('button', { name: 'Gjenopprett revisjon 1' }))
    await user.click(within(vindu).getByRole('button', { name: 'Gjenopprett nå' }))
    await waitFor(() => expect(lager.gjenopprettRevisjon).toHaveBeenCalledWith(REGELSETT_ID, 2, 1))
  })

  it('viser historikken for hver kommentar for seg, ord for ord, og gjenoppretter den', async () => {
    const { user, lager, leser } = await redigerer()
    const seksjon = screen.getByRole('region', { name: 'Fortolkning' })
    await user.click(within(seksjon).getByText('Historikken for hver kommentar'))
    await user.click(within(seksjon).getByRole('button', { name: new RegExp(`historikken for kommentaren «${HOY_NAVN}»`) }))
    const vindu = await screen.findByRole('dialog', { name: `Historikk: Kommentaren «${HOY_NAVN}»` })
    expect(leser.lesHistorikk).toHaveBeenCalledWith(HOY)

    expect(await within(vindu).findByText('Revisjon 2: endret (utkastet nå)')).toBeTruthy()
    expect([...vindu.querySelectorAll('del')].map((d) => d.textContent)).toEqual(['Syntetisk'])
    expect([...vindu.querySelectorAll('ins')].map((d) => d.textContent)).toEqual(['Endret syntetisk'])

    await user.click(within(vindu).getByRole('button', { name: /Revisjon 1: opprettet/ }))
    await user.click(within(vindu).getByRole('button', { name: 'Gjenopprett revisjon 1' }))
    await user.click(within(vindu).getByRole('button', { name: 'Gjenopprett nå' }))
    await waitFor(() => expect(lager.gjenopprettRevisjon).toHaveBeenCalledWith(HOY, 2, 1))
  })

  it('åpner historikken for et kort fra «Sist redigert»', async () => {
    const { user, leser } = await redigerer()
    await user.click(screen.getByRole('button', { name: /Vis historikken for referanseområde/ }))
    await screen.findByRole('dialog', { name: 'Historikk: Referanseområde' })
    expect(leser.lesHistorikk).toHaveBeenCalledWith('kort')
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
