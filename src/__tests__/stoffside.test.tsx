// @vitest-environment jsdom
/**
 * Stoffsiden, prøvd i en nettleser i minnet: lesemodus, søket på siden,
 * referansene, redigeringen, publiseringen og tilgjengeligheten.
 *
 * Siden er identifisert av stoffets nøkkel (`<Stoffside stoff="bupropion">`),
 * aldri av en analyttkode. Laboratorieanalyttene står som sekundær
 * informasjon etter koblingene i stoffregisteret. Fortolkningsreglene står på
 * fortolkningssidene (`fortolkningsredigering.test.tsx`), ikke her.
 *
 * Databasen er erstattet av en enkel leser og et lager som husker kallene;
 * at databasen selv gjør det den skal, prøves i `stoffsidelesing.test.ts`.
 * Innholdet er syntetisk. Tallene og tekstene er ikke kliniske verdier.
 */
import { readFileSync } from 'node:fs'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { Stoffside } from '../components/stoffside/Stoffside'
import { detaljanker } from '../components/seksjoner/Seksjon'
import { FaginnholdskildeProvider } from '../components/stoffside/Faginnholdskilde'
import { TipsLag } from '../components/Tips'
import { ANALYTTKATALOG } from '../domain/analyttkatalog'
import { STOFFREGISTERDATA, byggStoffregister, type Stoffregister } from '../domain/stoffregister'
import { GRUNNSTRUKTUR } from './hjelp/registerstruktur'
import { THC_KODE } from '../domain/thc'
import { Samtidighetskonflikt, type Faginnholdslager } from '../faginnhold/lagring'
import {
  TOM_STOFFSIDE,
  type Faginnholdsleser,
  type Regelsettutgave,
  type Stoffsidedata,
  type Utgave,
} from '../faginnhold/lesing'
import type { Historikk } from '../faginnhold/historikk'
import type { Objektstatus, Tilstand } from '../faginnhold/modell'
import type { ThcRegelsettutgave } from '../faginnhold/thcregler'
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
import type { Farmakogenetikkleser, Farmakogenetikkutvalg } from '../clinpgx/lesing'
import { lesDiplotypegrunnlag, type Cpicleser, type Cpicutvalg, type Diplotypegrunnlag } from '../cpic/lesing'
import type { Anbefaling, Betingelse, Gen, Par } from '../cpic/modell'
import type { Bivirkningsleser } from '../bivirkninger/lesing'
import { lesKjemiutvalg } from '../kjemi/lesing'
import { lesLabutvalg } from '../farmakologiportalen/lesing'
import { ENTITETER } from '../farmakologiportalen/modell'
import { lesListe } from '../farmakologiportalen/synk'
import type { Bivirkning, Bivirkningsdata } from '../bivirkninger/modell'
import { thcRegelsettutgave } from './hjelp/thcgrunnlag'

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

/** Laboratorieanalyttene koblingene i registeret peker på. */
const katalog = ANALYTTKATALOG

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
 * Et syntetisk regelsett for analyttkoden, AMTNORSUM om ingen annen er gitt.
 * Utkastet har en endret kommentar i det øverste intervallet.
 */
function regelsett(tilstand: Tilstand = 'publisert', kode = 'AMTNORSUM'): Intervallregelsett {
  return {
    analyttkode: kode,
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

/**
 * Regelsettet og kommentarene det peker på, som egne objekter. Regelsettet er
 * publisert i revisjon 2; kommentaren i det øverste intervallet er endret i
 * utkastet og ikke publisert.
 */
function regelsettutgave(tilstand: Tilstand, revisjon = 2, kode = 'AMTNORSUM'): Regelsettutgave {
  const r = regelsett(tilstand, kode)
  return {
    regelsett: utgave(kode === 'AMTNORSUM' ? REGELSETT_ID : `regelsett-${kode}`, utenKommentarer(r), revisjon, 2),
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

/** Standard for reglene: bare AMTNORSUM har et intervallregelsett. */
function amtnorsumregler(kode: string, tilstand: Tilstand): Regelsettutgave | null {
  return kode === 'AMTNORSUM' ? regelsettutgave(tilstand) : null
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

/** Stoffet siden handler om, slik databasen har det. */
const AMITRIPTYLIN = { id: 'hs', slug: 'amitriptylin', navn: 'Amitriptylin' }

/**
 * Stoffsiden for Amitriptylin med et datakort, en tekst og tre siteringer.
 * Reglene for AMTNORSUM hører ikke til siden; de leses for seg.
 */
function side(tilstand: Tilstand = 'publisert'): Stoffsidedata {
  const utk = tilstand === 'utkast'
  return {
    stoff: AMITRIPTYLIN,
    infoside: utgave('hs', { navn: 'Amitriptylin', slug: 'amitriptylin', panelreferanser: { farmakodynamikk: [REF_B.id] } }),
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

/** En stoffside i databasen med ett syntetisk referanseområde og ingenting annet. */
function enkelSide(stoff: { id: string; slug: string; navn: string }, data: Record<string, unknown>) {
  return (): Stoffsidedata => ({
    stoff,
    infoside: utgave(stoff.id, { navn: stoff.navn, slug: stoff.slug }),
    elementer: [
      utgave(`${stoff.id}-kort`, {
        infoside: stoff.id,
        panel: 'viktige_data',
        posisjon: 0,
        elementtype: 'referanseomrade',
        data,
        referanser: [],
      }),
    ],
    referanser: [],
  })
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
    { id: 'ID_AMI', navn: 'Amitriptylin', navn_engelsk: 'Amitriptyline', salter: ['ID_AMISALT'], utgatt: false },
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
function medKobling(tilstand: Tilstand): Stoffsidedata {
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

interface Kildevalg {
  /** Stoffsiden databasen har, i hver tilstand. Andre nøkler gir {@link TOM_STOFFSIDE}. */
  data?: (t: Tilstand) => Stoffsidedata
  /** Intervallregelsettet for en analyttkode, lest for seg etter koden. */
  regler?: (kode: string, t: Tilstand) => Regelsettutgave | null
  /** THC-syreregelsettet, lest for seg. */
  thc?: (t: Tilstand) => ThcRegelsettutgave | null
  kanRedigere?: boolean
}

/**
 * En falsk leser og et lager som husker kallene. Leseren svarer som
 * `les_stoff`: siden etter stoffets nøkkel, og ingenting for andre nøkler.
 */
function kilde({ data = side, regler = amtnorsumregler, thc = () => null, kanRedigere = false }: Kildevalg = {}) {
  let nr = 0
  const leser: Faginnholdsleser = {
    lesStoffside: vi.fn(async (slug: string, tilstand: Tilstand) => {
      const s = data(tilstand)
      return s.stoff === null || s.stoff.slug === slug ? s : TOM_STOFFSIDE
    }),
    lesStoffliste: vi.fn(async () => []),
    lesReferanser: vi.fn(async () => [REF_A, REF_B]),
    finnIntervallregelsett: vi.fn(async (kode: string, tilstand: Tilstand) => regler(kode, tilstand)),
    finnScenarioregelsett: vi.fn(async () => null),
    lesIntervallregelsett: vi.fn(async (tilstand: Tilstand) => {
      const r = regler('AMTNORSUM', tilstand)
      return r ? [r.regelsett] : []
    }),
    lesThcRegelsett: vi.fn(async (tilstand: Tilstand) => thc(tilstand)),
    lesKommentarer: vi.fn(async (tilstand: Tilstand) => regler('AMTNORSUM', tilstand)?.kommentarer ?? []),
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
    lagreThcRegelsett: vi.fn(async (id: string) => status(id, 3)),
    publiserUtkast: vi.fn(async (id: string) => status(id)),
    slettReferanse: vi.fn(),
  }
  return { leser, lager, kanRedigere, legemidler: legemiddelleser() }
}

/**
 * Knappen som åpner og lukker skuffen med navnet, også når skuffen står skjult.
 * Teksten i knappen teller også: jsdom regner ikke `<sub>` som en del av
 * linjen, så «D<sub>2</sub>-reseptor» får navnet «D 2 -reseptor» der, men
 * ikke i nettleseren.
 */
function skuffen(navn: string): HTMLElement {
  const knapp = screen
    .getAllByRole('button', { name: (tilgjengelig, el) => tilgjengelig === navn || el.textContent === navn, hidden: true })
    .find((b) => b.hasAttribute('aria-expanded'))
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

/** Registeret med inndelingen databasen får første gang. */
const REGISTER = byggStoffregister([], STOFFREGISTERDATA, GRUNNSTRUKTUR)

interface Visningsvalg {
  sted?: string[]
  /** Stoffregisteret siden slår opp i; standard er registeret med inndelingen fra databasen. */
  register?: Stoffregister
}

/** Stoffsiden for stoffet med nøkkelen, slik appen viser den på `#/stoff/<nøkkel>`. */
function vis(stoff: string, k = kilde(), { sted, register = REGISTER }: Visningsvalg = {}) {
  const onApneFortolkning = vi.fn()
  const onLukk = vi.fn()
  render(
    <TipsLag>
      <FaginnholdskildeProvider kilde={k}>
        <Stoffside
          stoff={stoff}
          sted={sted}
          register={register}
          katalog={katalog}
          onApneFortolkning={onApneFortolkning}
          onLukk={onLukk}
        />
      </FaginnholdskildeProvider>
    </TipsLag>,
  )
  return { onApneFortolkning, onLukk, ...k }
}

/** Identitetspanelet: overskriften og det som står rundt den. */
function identiteten(): HTMLElement {
  return screen.getByRole('heading', { level: 1 }).closest('section')!
}

describe('stoffet er sidens identitet', () => {
  it('leser siden etter stoffets nøkkel, og viser ikke fortolkningsreglene', async () => {
    const { leser } = vis('amitriptylin')
    expect(await finnVerdi('10–20 nmol/L')).toBeTruthy()
    expect(leser.lesStoffside).toHaveBeenCalledWith('amitriptylin', 'publisert')
    // Reglene hører til fortolkningssidene: fagsiden leser og viser dem ikke.
    expect(leser.finnIntervallregelsett).not.toHaveBeenCalled()
    expect(leser.lesThcRegelsett).not.toHaveBeenCalled()
    expect(document.querySelector('.regler')).toBeNull()
    expect(screen.queryByRole('region', { name: /^Fortolkning/ })).toBeNull()
    const stoffside = document.querySelector('section.stoffside')!
    expect(stoffside.getAttribute('data-modus')).toBe('lese')
    expect(stoffside.querySelector('.stoffside__paneler')).not.toBeNull()
    expect(document.querySelector('[class*="analyttside"]')).toBeNull()
    expect(document.title).toBe('Amitriptylin – OUSFAR')
  })

  it('viser et stoff i databasen som registeret ikke kjenner, uten kode og uten veien til fortolkningen', async () => {
    const teststoff = { id: 'stoff', slug: 'teststoff', navn: 'Teststoff' }
    const register = byggStoffregister([teststoff], STOFFREGISTERDATA, GRUNNSTRUKTUR)
    const { leser } = vis('teststoff', kilde({ data: enkelSide(teststoff, { nedre: 30, ovre: 60, enhet: 'µmol/L' }) }), {
      register,
    })
    expect(await finnVerdi('30–60 µmol/L')).toBeTruthy()
    expect(leser.lesStoffside).toHaveBeenCalledWith('teststoff', 'publisert')
    expect(leser.finnIntervallregelsett).not.toHaveBeenCalled()
    expect(screen.getByRole('heading', { level: 1, name: 'Teststoff' })).toBeTruthy()
    // Kategorien for stoffene registeret ikke har plassert, og ingen analyse under navnet.
    expect(identiteten().querySelector('.metalinje')!.textContent).toBe('Andre stoffer')
    expect(identiteten().querySelector('.metalinje [data-ikon]')!.getAttribute('data-ikon')).toBe('katPlassholder')
    expect(identiteten().querySelector('.identitet__analyse')).toBeNull()
    expect(screen.queryByRole('button', { name: /åpne fortolkning/i })).toBeNull()
    expect(document.querySelector('.regler')).toBeNull()
    expect(document.title).toBe('Teststoff – OUSFAR')
  })

  it('sier fra når nøkkelen ikke er et stoff, også når den er en analyttkode', async () => {
    vis('finnesikke')
    expect(await screen.findByRole('heading', { level: 1, name: 'Fant ingen fagside for «finnesikke»' })).toBeTruthy()
    cleanup()
    // En analyttkode er ingen stoffnøkkel: HBUP har ingen side av sin egen.
    const { leser } = vis('HBUP')
    expect(await screen.findByRole('heading', { level: 1, name: 'Fant ingen fagside for «HBUP»' })).toBeTruthy()
    expect(leser.lesStoffside).toHaveBeenCalledWith('HBUP', 'publisert')
    expect(document.querySelector('section.stoffside')).not.toBeNull()
  })

  it('viser et stoff i registeret som ikke har noen side i databasen: tom monografi', async () => {
    window.location.hash = '#/stoff/nortriptylin'
    const { leser } = vis(
      'nortriptylin',
      kilde({ data: () => TOM_STOFFSIDE, regler: (kode, t) => (kode === 'NOR' ? regelsettutgave(t, 2, 'NOR') : null) }),
    )
    expect(await screen.findByText('Denne siden har ikke fått faginnhold ennå.')).toBeTruthy()
    expect(document.querySelector('.stoffside__tom')).not.toBeNull()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Nortriptylin')
    expect(leser.lesStoffside).toHaveBeenCalledWith('nortriptylin', 'publisert')
    // Adressen blir stående på stoffet, og reglene står ikke her.
    expect(document.querySelector('.regler')).toBeNull()
    expect(window.location.hash).toBe('#/stoff/nortriptylin')
    window.location.hash = ''
  })

  it('oppretter infosiden med stoffets navn og nøkkel første gang noe lagres, og ingen laboratorieanalytt', async () => {
    const user = userEvent.setup()
    const { lager } = vis('lamotrigin', kilde({ kanRedigere: true, data: () => TOM_STOFFSIDE }))
    await user.click(await screen.findByRole('button', { name: 'Rediger' }))
    expect(await screen.findByText('Siden opprettes i databasen første gang du lagrer noe på den.')).toBeTruthy()
    await user.click(await screen.findByRole('button', { name: 'Legg til: Referanseområde' }))
    const skjema = redigeringsvindu('Referanseområde')
    await user.type(within(skjema).getByLabelText('Nedre grense'), '30')
    await user.type(within(skjema).getByLabelText('Øvre grense'), '60')
    await user.type(within(skjema).getByLabelText('Enhet'), 'µmol/L')
    await user.click(within(skjema).getByRole('button', { name: 'Lagre utkast' }))

    await waitFor(() => expect(lager.opprettUtkast).toHaveBeenCalledTimes(2))
    const kall = vi.mocked(lager.opprettUtkast).mock.calls
    expect(kall[0]).toEqual(['infoside', { navn: 'Lamotrigin', slug: 'lamotrigin' }])
    expect(kall[1]![0]).toBe('innholdselement')
    expect(kall[1]![1]).toMatchObject({ infoside: 'ny-1', panel: 'viktige_data', elementtype: 'referanseomrade' })
    expect(kall.map(([type]) => type)).toEqual(['infoside', 'innholdselement'])
  })
})

describe('Bupropion: metabolitten er sekundær informasjon', () => {
  const BUPROPION = { id: 'bup', slug: 'bupropion', navn: 'Bupropion' }
  const hbupregler = (kode: string, t: Tilstand) => (kode === 'HBUP' ? regelsettutgave(t, 2, 'HBUP') : null)

  it('har tittelen Bupropion, aldri Hydroksybupropion, og viser HBUP med merknaden', async () => {
    const user = userEvent.setup()
    const { leser, onApneFortolkning } = vis(
      'bupropion',
      kilde({ data: enkelSide(BUPROPION, { nedre: 1000, ovre: 2000, enhet: 'nmol/L' }), regler: hbupregler }),
    )
    expect(await finnVerdi(`${formaterTall(1000)}–${formaterTall(2000)} nmol/L`)).toBeTruthy()
    expect(leser.lesStoffside).toHaveBeenCalledWith('bupropion', 'publisert')
    const overskrift = screen.getByRole('heading', { level: 1 })
    expect(overskrift.textContent).toBe('Bupropion')
    expect(screen.queryByRole('heading', { name: /Hydroksybupropion/i })).toBeNull()
    expect(document.title).toBe('Bupropion – OUSFAR')
    expect(identiteten().querySelector('.metalinje')!.textContent).toBe('Antidepressiver › NDRI')

    // HBUP står under navnet som koden, med metoden den inngår i.
    const analyse = identiteten().querySelector('.identitet__analyse') as HTMLElement
    expect(overskrift.compareDocumentPosition(analyse)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(analyse.textContent).toBe(`HBUP·Inngår i${katalog.finn('HBUP')!.analysemetode}`)
    // Hva analytten er for stoffet, og merknaden koblingen har.
    const setning = identiteten().querySelector('.identitet__komponenter')!
    expect(setning.textContent).toBe(
      'HBUP måler hydroksybupropion (kun aktiv metabolitt), en metabolitt av bupropion. ' +
        'Analytten er hydroksybupropion. Referanseområdet gjelder behandling med bupropion.',
    )
    // Ingen andre stoffer er koblet til HBUP, så det er ingen «Se også».
    expect(within(setning as HTMLElement).queryByRole('link')).toBeNull()

    // Koden og «Åpne fortolkning» åpner begge fortolkningen for HBUP.
    await user.click(within(analyse).getByRole('button', { name: 'HBUP – åpne fortolkningen' }))
    await user.click(screen.getByRole('button', { name: 'Åpne fortolkning' }))
    expect(onApneFortolkning.mock.calls).toEqual([[katalog.finn('HBUP')!.fortolkning], [katalog.finn('HBUP')!.fortolkning]])
  })

  it('har tittelen Bupropion også uten side i databasen', async () => {
    vis('bupropion', kilde({ data: () => TOM_STOFFSIDE, regler: hbupregler }))
    expect(await screen.findByText('Denne siden har ikke fått faginnhold ennå.')).toBeTruthy()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Bupropion')
    expect(document.title).toBe('Bupropion – OUSFAR')
  })

  it('gir ikke en gammel side for metabolitten en egen stoffside', () => {
    // En side som fortsatt heter etter metabolitten, er et alias og ikke et stoff.
    const register = byggStoffregister([BUPROPION, { id: 'gammel', slug: 'hydroksybupropion', navn: 'Hydroksybupropion' }])
    expect(register.finn('hydroksybupropion')).toBeUndefined()
    expect(register.kanonisk('Hydroksybupropion')?.slug).toBe('bupropion')
    expect(register.primartStoffFor('HBUP')?.navn).toBe('Bupropion')
  })
})

describe('Nortriptylin: sumanalysen er bare en sekundær kobling', () => {
  const norregler = (kode: string, t: Tilstand) =>
    kode === 'NOR' ? regelsettutgave(t, 2, 'NOR') : kode === 'AMTNORSUM' ? regelsettutgave(t) : null

  it('viser NOR, og AMTNORSUM bare som kode med «Se også» Amitriptylin', async () => {
    const user = userEvent.setup()
    const { onApneFortolkning } = vis('nortriptylin', kilde({ data: () => TOM_STOFFSIDE, regler: norregler }))
    expect(await screen.findByText('Denne siden har ikke fått faginnhold ennå.')).toBeTruthy()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Nortriptylin')

    // Begge kodene står under navnet, NOR først.
    const analyse = identiteten().querySelector('.identitet__analyse') as HTMLElement
    expect(analyse.textContent).toBe(`NOR·AMTNORSUM·Inngår i${katalog.finn('NOR')!.analysemetode}`)
    // Sumanalysen forklares, og lenker til stoffet den primært hører til.
    const setninger = [...identiteten().querySelectorAll('.identitet__komponenter')]
    expect(setninger.map((p) => p.textContent)).toEqual([
      'AMTNORSUM er en sumanalyse og omfatter amitriptylin og nortriptylin. Se også Amitriptylin.',
    ])
    const lenke = within(setninger[0] as HTMLElement).getByRole('link', {
      name: 'Amitriptylin: åpne fagsiden, som også er koblet til AMTNORSUM',
    })
    expect(lenke.getAttribute('href')).toBe('#/stoff/amitriptylin')

    // «Åpne fortolkning» åpner NOR; AMTNORSUM åpnes bare fra koden sin.
    await user.click(screen.getByRole('button', { name: 'Åpne fortolkning' }))
    expect(onApneFortolkning).toHaveBeenLastCalledWith(katalog.finn('NOR')!.fortolkning)
    await user.click(within(analyse).getByRole('button', { name: 'AMTNORSUM – åpne fortolkningen' }))
    expect(onApneFortolkning).toHaveBeenLastCalledWith(katalog.finn('AMTNORSUM')!.fortolkning)
  })

  it('viser datakortene uten merking, siden NOR er den eneste primære analytten', async () => {
    const NORTRIPTYLIN = { id: 'nor', slug: 'nortriptylin', navn: 'Nortriptylin' }
    vis('nortriptylin', kilde({ data: enkelSide(NORTRIPTYLIN, { nedre: 200, ovre: 600, enhet: 'nmol/L' }), regler: norregler }))
    await finnVerdi('200–600 nmol/L')
    const konsentrasjoner = within(screen.getByRole('region', { name: 'Viktige data' })).getByRole('group', {
      name: 'Konsentrasjoner i serum',
    })
    expect(within(konsentrasjoner).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'Referanseområde',
    ])
    expect(document.querySelector('.datakort__gjelder')).toBeNull()
  })
})

describe('THC: to fortolkningsmoduler på samme side', () => {
  it('viser begge kodene, uten regler, og ingen felles «Åpne fortolkning»', async () => {
    const user = userEvent.setup()
    const { leser, onApneFortolkning } = vis(
      'thc',
      kilde({ data: () => TOM_STOFFSIDE, regler: () => null, thc: () => thcRegelsettutgave() }),
    )
    expect(await screen.findByText('Denne siden har ikke fått faginnhold ennå.')).toBeTruthy()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('THC')
    expect(document.title).toBe('THC – OUSFAR')
    expect(identiteten().querySelector('.metalinje')!.textContent).toBe('Cannabinoider')
    // Reglene for begge modulene står på fortolkningssidene deres.
    expect(document.querySelector('.regler')).toBeNull()
    expect(leser.lesThcRegelsett).not.toHaveBeenCalled()

    // Modulene er to, så hver åpnes fra koden sin.
    expect(screen.queryByRole('button', { name: 'Åpne fortolkning' })).toBeNull()
    const analyser = [...identiteten().querySelectorAll('.identitet__analyse')].map((p) => p.textContent)
    expect(analyser).toEqual([
      `THC·Inngår i${katalog.finn('THC')!.analysemetode}`,
      `IRCAK·Inngår i${katalog.finn(THC_KODE)!.analysemetode}`,
    ])
    await user.click(screen.getByRole('button', { name: 'IRCAK – åpne fortolkningen' }))
    expect(onApneFortolkning).toHaveBeenLastCalledWith(katalog.finn(THC_KODE)!.fortolkning)
    await user.click(screen.getByRole('button', { name: 'THC – åpne fortolkningen' }))
    expect(onApneFortolkning).toHaveBeenLastCalledWith(katalog.finn('THC')!.fortolkning)
    // THC-syre er en metabolitt av stoffet, og det sies.
    expect(identiteten().querySelector('.identitet__komponenter')!.textContent).toBe(
      'IRCAK måler THC-syre, en metabolitt av THC.',
    )
  })
})

describe('Diazepam: datakort for hver primære analytt', () => {
  const DIAZEPAM = { id: 'diaz', slug: 'diazepam', navn: 'Diazepam' }
  const kort = (id: string, data: Record<string, unknown>) =>
    utgave(id, { infoside: 'diaz', panel: 'viktige_data', posisjon: 0, elementtype: 'referanseomrade', data, referanser: [] })
  /** Referanseområdet for diazepam (uten `gjelder`) og for N-desmetyldiazepam (`gjelder: 'DMI'`). */
  const diazepamside = (): Stoffsidedata => ({
    stoff: DIAZEPAM,
    infoside: utgave('diaz', { navn: 'Diazepam', slug: 'diazepam' }),
    elementer: [
      kort('diaz-kort', { nedre: 100, ovre: 200, enhet: 'nmol/L' }),
      kort('dmi-kort', { nedre: 300, ovre: 400, enhet: 'nmol/L', gjelder: 'DMI' }),
    ],
    referanser: [],
  })

  it('viser referanseområdet for DIAZ og for DMI, merket med analyttens navn', async () => {
    vis('diazepam', kilde({ data: diazepamside, regler: () => null }))
    await finnVerdi('100–200 nmol/L')
    const konsentrasjoner = within(screen.getByRole('region', { name: 'Viktige data' })).getByRole('group', {
      name: 'Konsentrasjoner i serum',
    })
    const kortene = within(konsentrasjoner).getAllByRole('listitem')
    expect(kortene.map((li) => li.querySelector('h3')!.textContent)).toEqual([
      'Referanseområde, Diazepam',
      'Referanseområde, N-desmetyldiazepam',
    ])
    expect(kortene.map((li) => li.querySelector('.datakort__verdi')!.textContent)).toEqual([
      '100–200 nmol/L',
      '300–400 nmol/L',
    ])
    const analyse = identiteten().querySelector('.identitet__analyse')!
    expect(analyse.textContent).toBe(`DIAZ·DMI·Inngår i${katalog.finn('DIAZ')!.analysemetode}`)
    expect(identiteten().querySelector('.identitet__komponenter')!.textContent).toBe(
      'DMI måler N-desmetyldiazepam, en metabolitt av diazepam.',
    )
  })

  it('åpner den felles modulen, uten å vise reglene for den', async () => {
    const user = userEvent.setup()
    const { onApneFortolkning } = vis('diazepam', kilde({ data: diazepamside, regler: () => null }))
    await finnVerdi('100–200 nmol/L')
    await user.click(screen.getByRole('button', { name: 'Åpne fortolkning' }))
    expect(onApneFortolkning.mock.calls[0]![0].kode).toBe('DIAZ · DMI · OXA')
    expect(document.querySelector('.regler')).toBeNull()
  })

  it('lagrer kortet for DMI med koden det gjelder', async () => {
    const user = userEvent.setup()
    const { lager } = vis('diazepam', kilde({ kanRedigere: true, data: diazepamside, regler: () => null }))
    await finnVerdi('100–200 nmol/L')
    await user.click(screen.getByRole('button', { name: 'Rediger' }))
    await user.click(await screen.findByRole('button', { name: 'Rediger: Referanseområde, N-desmetyldiazepam' }))
    const skjema = redigeringsvindu('Referanseområde, N-desmetyldiazepam')
    const ovre = within(skjema).getByLabelText('Øvre grense')
    await user.clear(ovre)
    await user.type(ovre, '450')
    await user.click(within(skjema).getByRole('button', { name: 'Lagre utkast' }))
    await waitFor(() => expect(lager.lagreUtkast).toHaveBeenCalledTimes(1))
    expect(lager.lagreUtkast).toHaveBeenCalledWith('dmi-kort', 1, {
      infoside: 'diaz',
      panel: 'viktige_data',
      elementtype: 'referanseomrade',
      posisjon: 0,
      data: { nedre: 300, ovre: 450, enhet: 'nmol/L', gjelder: 'DMI' },
      referanser: [],
    })
  })
})

describe('lesemodus', () => {
  it('viser identiteten, datakortet, teksten og referansene', async () => {
    const user = userEvent.setup()
    const { leser } = vis('amitriptylin')
    expect(await finnVerdi('10–20 nmol/L')).toBeTruthy()
    expect(leser.lesStoffside).toHaveBeenCalledWith('amitriptylin', 'publisert')

    expect(screen.getByRole('heading', { level: 1, name: 'Amitriptylin' })).toBeTruthy()
    // Forbeholdet under verdien vises ikke lenger.
    expect(screen.queryByText('Syntetisk forbehold')).toBeNull()
    expect(screen.getByText('gjenopptaket').tagName).toBe('STRONG')

    // Sumanalysen forklares, og det andre stoffet den er koblet til, lenkes til
    // etter nøkkelen — ikke etter en analyttkode.
    const setning = screen.getByText(/er en sumanalyse og omfatter/).closest('p')!
    expect(setning.textContent).toBe(
      'AMTNORSUM er en sumanalyse og omfatter amitriptylin og nortriptylin. Se også Nortriptylin.',
    )
    expect(within(setning).getByRole('link', { name: /Nortriptylin/ }).getAttribute('href')).toBe('#/stoff/nortriptylin')

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

  it('viser kategoriene fra stoffregisteret over navnet, og koden og metoden under', async () => {
    const user = userEvent.setup()
    const { onApneFortolkning } = vis('amitriptylin')
    await finnVerdi('10–20 nmol/L')
    const overskrift = screen.getByRole('heading', { level: 1 })
    const identitet = overskrift.closest('section')!
    const oppforing = katalog.finn('AMTNORSUM')!
    // Over navnet: de samme kategoriene som i sidemenyen.
    const metalinje = identitet.querySelector('.metalinje')!
    expect(metalinje.textContent).toBe('Antidepressiver › TCA')
    expect(metalinje.compareDocumentPosition(overskrift)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    // Under navnet: koden og analysemetoden den inngår i.
    const analyse = identitet.querySelector('.identitet__analyse')!
    expect(overskrift.compareDocumentPosition(analyse)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(analyse.textContent).toBe(`AMTNORSUM·Inngår i${oppforing.analysemetode}`)
    // Koden åpner fortolkningen, som «Åpne fortolkning» i toppmenyen.
    await user.click(within(analyse as HTMLElement).getByRole('button', { name: 'AMTNORSUM – åpne fortolkningen' }))
    expect(onApneFortolkning).toHaveBeenCalledWith(oppforing.fortolkning)
  })

  it('viser hver kategori et stoff står i', async () => {
    vis('lamotrigin', kilde({ data: () => TOM_STOFFSIDE }))
    const identitet = (await screen.findByRole('heading', { level: 1 })).closest('section')!
    expect(identitet.querySelector('.metalinje')!.textContent).toBe('Stemningsstabiliserende·Antiepileptika')
    // Hver kategori med ikonet sitt foran, som i stoffregisteret.
    const ikoner = [...identitet.querySelectorAll('.metalinje [data-ikon]')].map((i) => i.getAttribute('data-ikon'))
    expect(ikoner).toEqual(['katStemningsstabiliserende', 'katAntiepileptika'])
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
    const alle = (t: Tilstand): Stoffsidedata => {
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
    vis('amitriptylin', kilde({ data: alle }))
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
    vis('amitriptylin', kilde(), { sted: ['viktige_data'] })
    await finnVerdi('10–20 nmol/L')
    const viktige = screen.getByRole('region', { name: 'Viktige data' })
    await waitFor(() => expect(rull.mock.contexts).toContain(viktige))
    expect(screen.getByRole('button', { name: 'Farmakodynamikk' }).getAttribute('aria-expanded')).toBe('false')
    rull.mockRestore()
  })

  it('viser bare panelene som har innhold, og ingen redigering for vanlige brukere', async () => {
    vis('amitriptylin')
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

  it('viser navnet fra registeret og sier fra når siden ikke har innhold ennå', async () => {
    vis('nortriptylin', kilde({ data: () => TOM_STOFFSIDE }))
    expect(await screen.findByText('Denne siden har ikke fått faginnhold ennå.')).toBeTruthy()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Nortriptylin')
  })

  it('sier ikke at et ukjent stoff mangler før databasen har svart', async () => {
    const k = kilde()
    let svar: (d: Stoffsidedata) => void = () => {}
    k.leser.lesStoffside = vi.fn(() => new Promise<Stoffsidedata>((r) => (svar = r)))
    vis('finnesikke', k)
    // Databasen kan ha en side registeret ikke kjenner ennå.
    expect(screen.queryByRole('heading', { name: /Fant ingen fagside/ })).toBeNull()
    await act(async () => svar(TOM_STOFFSIDE))
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Fant ingen fagside for «finnesikke»')
  })

  it('sier fra når innholdet ikke lar seg hente', async () => {
    const k = kilde()
    k.leser.lesStoffside = vi.fn(async () => {
      throw new Error('Faginnholdet er ikke satt opp i databasen ennå.')
    })
    vis('amitriptylin', k)
    expect((await screen.findByRole('alert')).textContent).toMatch(/ikke satt opp i databasen/)
  })
})

describe('veiene ut av siden', () => {
  it('åpner fortolkningen stoffets analytt hører til', async () => {
    const user = userEvent.setup()
    const { onApneFortolkning } = vis('nortriptylin')
    await user.click(screen.getByRole('button', { name: 'Åpne fortolkning' }))
    expect(onApneFortolkning).toHaveBeenCalledWith(katalog.finn('NOR')!.fortolkning)
  })

  it('åpner modulen for et stoff som deler fortolkning med andre', async () => {
    const user = userEvent.setup()
    const { onApneFortolkning } = vis('oksazepam', kilde({ data: () => TOM_STOFFSIDE }))
    await user.click(screen.getByRole('button', { name: 'Åpne fortolkning' }))
    // Oksazepam fortolkes i diazepamgruppen.
    expect(onApneFortolkning.mock.calls[0]![0].kode).toBe('DIAZ · DMI · OXA')
  })

  it('lukkes med Esc, men ikke mens det skrives i søket', async () => {
    const user = userEvent.setup()
    const { onLukk } = vis('amitriptylin')
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
    vis('amitriptylin')
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
    vis('amitriptylin')
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
    vis('amitriptylin')
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
    vis('amitriptylin')
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
    vis('amitriptylin')
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
    vis('amitriptylin', kilde(), { sted: ['farmakodynamikk'] })
    await finnVerdi('10–20 nmol/L')
    await waitFor(() => expect(apen('Farmakodynamikk')).toBe(true))
  })

  it('holder bare én seksjon åpen, og har ingen knapp for å åpne alle', async () => {
    const user = userEvent.setup()
    vis('amitriptylin')
    await finnVerdi('10–20 nmol/L')
    expect(screen.queryByRole('button', { name: 'Åpne alle' })).toBeNull()
    await user.click(skuffknapp('Farmakodynamikk'))
    expect(apen('Farmakodynamikk')).toBe(true)
    // Viktige data er ikke et søsken i trekkspillet og står fram uansett.
    expect(hentVerdi('10–20 nmol/L').closest('[hidden]')).toBeNull()
  })

  it('åpner søkets treff i én seksjon om gangen', async () => {
    const user = userEvent.setup()
    vis('amitriptylin')
    await finnVerdi('10–20 nmol/L')
    await user.type(screen.getByRole('searchbox', { name: 'Søk på denne siden' }), 'hemmer')
    await user.click(within(await screen.findByRole('list', { name: 'Hvor treffene står' })).getByRole('button'))
    expect(apen('Farmakodynamikk')).toBe(true)
    expect(hentVerdi('10–20 nmol/L').closest('[hidden]')).toBeNull()
  })

  it('åpner ikke alt i redigeringsmodus; redaktøren åpner seksjonen, også de som bare vises der', async () => {
    const user = userEvent.setup()
    vis('amitriptylin', kilde({ kanRedigere: true }))
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
    vis('amitriptylin', k)
    await finnVerdi('10–20 nmol/L')
    expect(screen.queryByRole('region', { name: 'Preparater' })).toBeNull()
    expect(k.legemidler.les).not.toHaveBeenCalled()
  })

  it('viser formene som overskrifter, styrkene som kort og preparatene i den åpne styrken, med kilden', async () => {
    const user = userEvent.setup()
    const k = kilde({ data: medKobling })
    vis('amitriptylin', k)
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
    vis('amitriptylin', kilde({ data: medKobling }))
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
    vis('amitriptylin', kilde({ data: medKobling }), { sted: ['preparater', 'form-53'] })
    await waitFor(() => expect(skuffknapp('Tablett').getAttribute('aria-expanded')).toBe('true'))
    expect(skuffknapp('Preparater').getAttribute('aria-expanded')).toBe('true')
    expect(skuffknapp('Depotkapsel, hard').getAttribute('aria-expanded')).toBe('false')
  })

  it('finner preparatene i søket på siden, og åpner formen og styrken treffet står i', async () => {
    const user = userEvent.setup()
    vis('amitriptylin', kilde({ data: medKobling }))
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
    vis('amitriptylin', kilde({ data: medKobling }))
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
    vis('amitriptylin', k)
    expect(await screen.findByText('Fikk ikke hentet preparatene')).toBeTruthy()
    expect(hentVerdi('10–20 nmol/L')).toBeTruthy()
  })
})

describe('interaksjonene', () => {
  const skuffknapp = (navn: string) =>
    screen.getAllByRole('button', { name: navn, hidden: true }).find((b) => b.hasAttribute('aria-expanded'))!

  it('viser ikke seksjonen når siden ikke er koblet', async () => {
    const k = kilde()
    vis('amitriptylin', k)
    await finnVerdi('10–20 nmol/L')
    expect(screen.queryByRole('region', { name: 'Interaksjoner' })).toBeNull()
    expect(k.legemidler.interaksjoner).not.toHaveBeenCalled()
  })

  it('slår opp på ATC-koden til preparatene, og viser de alvorligste først', async () => {
    const user = userEvent.setup()
    const k = kilde({ data: medKobling })
    vis('amitriptylin', k)
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

  it('viser den redaksjonelle teksten over interaksjonene fra FEST, og lar redaktøren skrive den', async () => {
    const user = userEvent.setup()
    const medTekst = (tilstand: Tilstand): Stoffsidedata => {
      const s = medKobling(tilstand)
      const tekst = utgave('inter', {
        infoside: 'hs',
        panel: 'interaksjoner',
        posisjon: 0,
        elementtype: 'riktekst',
        data: { dokument: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Syntetisk: obs enzymhemmere.' }] }] } },
      })
      return { ...s, elementer: [...s.elementer, tekst] }
    }
    const { lager } = vis('amitriptylin', kilde({ kanRedigere: true, data: medTekst }))
    // Den lukkede seksjonen oppsummerer både FEST og teksten.
    expect(await screen.findByText('1 bør unngås · 1 forholdsregler bør tas · Syntetisk: obs enzymhemmere.')).toBeTruthy()
    await user.click(skuffknapp('Interaksjoner'))
    const seksjon = screen.getByRole('region', { name: 'Interaksjoner' })
    const tekst = within(seksjon).getByText('Syntetisk: obs enzymhemmere.')
    const forsteKort = within(seksjon).getByRole('button', { name: /^Farligin/, hidden: true })
    expect(tekst.compareDocumentPosition(forsteKort) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // Detaljkortene med interaksjonene står i en liste, ikke i et rutenett som flytter dem.
    expect(forsteKort.closest('.skuff--detalj')!.hasAttribute('data-flyttes')).toBe(false)

    await user.click(screen.getByRole('button', { name: 'Rediger' }))
    await user.click(await screen.findByRole('button', { name: 'Rediger: Interaksjoner' }))
    const skjema = redigeringsvindu('Interaksjoner')
    await user.click(within(skjema).getByRole('button', { name: 'Lagre utkast' }))
    await waitFor(() => expect(lager.lagreUtkast).toHaveBeenCalledTimes(1))
    expect(vi.mocked(lager.lagreUtkast).mock.calls[0]![2]).toMatchObject({ panel: 'interaksjoner', elementtype: 'riktekst', posisjon: 0 })
  })

  it('finner stoffene i søket på siden, også i lukkede detaljkort', async () => {
    const user = userEvent.setup()
    vis('amitriptylin', kilde({ data: medKobling }))
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
    vis('amitriptylin', k)
    expect(await screen.findByText('Ikke vurdert av DMP')).toBeTruthy()
    expect(screen.getByText(/DMP har ikke vurdert interaksjonene for Amitriptylin \(N06AA09\) ennå/)).toBeTruthy()
    cleanup()

    const feil = kilde({ data: medKobling })
    feil.legemidler.interaksjoner = vi.fn(async () => {
      throw new Error('Nettverksfeil')
    })
    vis('amitriptylin', feil)
    expect(await screen.findByText('Fikk ikke hentet interaksjonene')).toBeTruthy()
    expect(hentVerdi('10–20 nmol/L')).toBeTruthy()
  })
})

describe('redigeringsmodus', () => {
  it('viser utkastet og alle panelene, med «Sist redigert»', async () => {
    const user = userEvent.setup()
    const { leser } = vis('amitriptylin', kilde({ kanRedigere: true }))
    await finnVerdi('10–20 nmol/L')
    await user.click(screen.getByRole('button', { name: 'Rediger' }))
    await waitFor(() => expect(leser.lesStoffside).toHaveBeenLastCalledWith('amitriptylin', 'utkast'))
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

  it('har tomme seksjoner for virkninger og bivirkninger mellom farmakodynamikken og indikasjonen', async () => {
    const user = userEvent.setup()
    const { lager } = vis('amitriptylin', kilde({ kanRedigere: true }))
    await finnVerdi('10–20 nmol/L')
    // Uten innhold står de ikke på siden for den som leser.
    for (const panel of ['Virkninger', 'Bivirkninger']) expect(screen.queryByRole('heading', { level: 2, name: panel })).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Rediger' }))
    await screen.findByRole('heading', { level: 2, name: 'Virkninger' })
    const titler = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    const plass = (navn: string) => titler.indexOf(navn)
    expect(plass('Farmakodynamikk')).toBeLessThan(plass('Virkninger'))
    expect(plass('Virkninger')).toBe(plass('Bivirkninger') - 1)
    expect(plass('Bivirkninger')).toBeLessThan(plass('Indikasjon'))

    const seksjon = screen.getByRole('region', { name: 'Bivirkninger' })
    expect(seksjon.querySelector('[data-ikon="bivirkning"]')).not.toBeNull()
    expect(screen.getByRole('region', { name: 'Virkninger' }).querySelector('[data-ikon="virkning"]')).not.toBeNull()
    // Redaktøren åpner seksjonen for å legge til det første kortet.
    await user.click(within(seksjon).getAllByRole('button', { name: 'Bivirkninger' }).find((b) => b.hasAttribute('aria-expanded'))!)
    await user.click(within(seksjon).getByRole('button', { name: 'Legg til kort' }))
    // Det nye kortet har overskrift og tekst, som kortene i farmakokinetikken.
    const skjema = screen.getByRole('dialog')
    expect(within(skjema).getByLabelText('Overskrift')).toBeTruthy()
    expect(skjema.querySelector('[data-ikon="bivirkning"]')).not.toBeNull()
    expect(lager.opprettUtkast).not.toHaveBeenCalled()
  })

  it('redigerer i et eget vindu over siden, med fokus i det første feltet', async () => {
    const user = userEvent.setup()
    vis('amitriptylin', kilde({ kanRedigere: true }))
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
    const { lager } = vis('amitriptylin', kilde({ kanRedigere: true }))
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
    const { lager } = vis('amitriptylin', kilde({ kanRedigere: true }))
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
    const { lager } = vis('amitriptylin', kilde({ kanRedigere: true }))
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
    const { lager } = vis('amitriptylin', kilde({ kanRedigere: true }))
    await finnVerdi('10–20 nmol/L')
    await user.click(screen.getByRole('button', { name: 'Rediger' }))
    await user.click(await screen.findByRole('button', { name: 'Legg til: Tid til steady state' }))
    const skjema = redigeringsvindu('Tid til steady state')
    const fyll = async (rad: HTMLElement, felt: Record<string, string>) => {
      for (const [merke, verdi] of Object.entries(felt)) await user.type(within(rad).getByLabelText(merke), verdi)
    }
    await fyll(within(skjema).getByRole('group', { name: 'Rad 1' }), {
      Legemiddelform: 'Peroralt',
      'Typisk verdi': '5',
      Enhet: 'døgn',
    })
    await user.click(within(skjema).getByRole('button', { name: 'Legg til rad' }))
    const depot = within(skjema).getByRole('group', { name: 'Rad 2' })
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

  it('legger inn t½ for moderstoffet og en metabolitt, med stoffet på hver rad', async () => {
    const user = userEvent.setup()
    const { lager } = vis('amitriptylin', kilde({ kanRedigere: true }))
    await finnVerdi('10–20 nmol/L')
    await user.click(screen.getByRole('button', { name: 'Rediger' }))
    await user.click(await screen.findByRole('button', { name: 'Legg til: Halveringstid' }))
    const skjema = redigeringsvindu('Halveringstid')
    const fyll = async (rad: HTMLElement, felt: Record<string, string>) => {
      for (const [merke, verdi] of Object.entries(felt)) await user.type(within(rad).getByLabelText(merke), verdi)
    }
    await fyll(within(skjema).getByRole('group', { name: 'Rad 1' }), { 'Typisk verdi': '25', Enhet: 'timer' })
    await user.click(within(skjema).getByRole('button', { name: 'Legg til rad' }))
    await fyll(within(skjema).getByRole('group', { name: 'Rad 2' }), { Stoff: 'Nortriptylin', 'Typisk verdi': '26', Enhet: 'timer' })

    // Med flere rader må hver si hva den gjelder.
    await user.click(within(skjema).getByRole('button', { name: 'Lagre utkast' }))
    expect(within(skjema).getByRole('alert').textContent).toBe('Rad 1: Oppgi legemiddelformen eller stoffet når kortet har flere.')
    await user.type(within(within(skjema).getByRole('group', { name: 'Rad 1' })).getByLabelText('Stoff'), 'Amitriptylin')

    await user.click(within(skjema).getByRole('button', { name: 'Lagre utkast' }))
    await waitFor(() => expect(lager.opprettUtkast).toHaveBeenCalledTimes(1))
    expect(vi.mocked(lager.opprettUtkast).mock.calls[0]![1]).toMatchObject({
      panel: 'viktige_data',
      elementtype: 'halveringstid',
      data: {
        former: [
          { stoff: 'Amitriptylin', form: '', typisk: 25, min: null, maks: null, enhet: 'timer' },
          { stoff: 'Nortriptylin', form: '', typisk: 26, min: null, maks: null, enhet: 'timer' },
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
    vis('amitriptylin', k)
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
    const { lager } = vis('amitriptylin', kilde({ kanRedigere: true }))
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
    const { lager } = vis('amitriptylin', kilde({ kanRedigere: true }))
    await finnVerdi('10–20 nmol/L')
    await user.click(screen.getByRole('button', { name: 'Rediger' }))
    // Datakortet har en revisjon som ikke er publisert. En kommentar
    // fortolkningsreglene peker på, er også endret, men reglene publiseres på
    // fortolkningssiden og er ikke med. Statusen i toppmenyen teller det som
    // ikke er publisert.
    expect(await screen.findByText('Redigerer · utkast med 1 endring')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Publiser' }))
    const oppsummering = screen.getByRole('dialog', { name: 'Publiser endringene' })
    await waitFor(() =>
      expect(within(oppsummering).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Viktige data']),
    )
    expect(lager.publiserUtkast).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Publiser nå' }))
    await waitFor(() => expect(lager.publiserUtkast).toHaveBeenCalledWith('kort', 2))
    expect(vi.mocked(lager.publiserUtkast).mock.calls).toEqual([['kort', 2]])
  })

  it('publiserer en ny side med siden først, uten steg for analytter eller komponenter', async () => {
    const user = userEvent.setup()
    // Siden er opprettet i redigeringen og aldri publisert; reglene er uendret.
    const ny = (tilstand: Tilstand): Stoffsidedata => {
      const s = side(tilstand)
      return {
        ...s,
        infoside: utgave('hs', { navn: 'Amitriptylin', slug: 'amitriptylin' }, 1, null),
        elementer: [{ ...s.elementer[0]!, revisjon: 1, publisert_revisjon: null }],
        referanser: [],
      }
    }
    const { lager } = vis(
      'amitriptylin',
      kilde({ kanRedigere: true, data: ny, regler: (kode) => (kode === 'AMTNORSUM' ? regelsettutgave('publisert') : null) }),
    )
    await finnVerdi('10–20 nmol/L')
    await user.click(screen.getByRole('button', { name: 'Rediger' }))
    expect(await screen.findByText('Redigerer · utkast med 2 endringer')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Publiser' }))
    const oppsummering = screen.getByRole('dialog', { name: 'Publiser endringene' })
    expect(within(oppsummering).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Siden Amitriptylin og kildene for panelene',
      'Viktige data',
    ])
    await user.click(screen.getByRole('button', { name: 'Publiser nå' }))
    await waitFor(() => expect(lager.publiserUtkast).toHaveBeenCalledTimes(2))
    // Siden før kortet på den, og ingenting annet.
    expect(vi.mocked(lager.publiserUtkast).mock.calls).toEqual([
      ['hs', 1],
      ['kort', 1],
    ])
  })

  it('oppretter bare stoffets egen side første gang noe lagres, med navnet og nøkkelen', async () => {
    const user = userEvent.setup()
    const k = kilde({ kanRedigere: true, data: () => TOM_STOFFSIDE })
    const { lager } = vis('amitriptylin', k)
    await user.click(await screen.findByRole('button', { name: 'Rediger' }))
    await apneSkuff(user, 'Preparater')
    await user.click(await screen.findByRole('button', { name: 'Legg til: Koblingen til legemiddeldataene' }))
    const skjema = redigeringsvindu('Koblingen til legemiddeldataene')
    // Søket står ferdig utfylt med stoffets navn, og likt navn er et forslag.
    expect((within(skjema).getByLabelText('Søk etter virkestoff') as HTMLInputElement).value).toBe('Amitriptylin')
    expect(await within(skjema).findByText(/Forslag: samme navn som siden/)).toBeTruthy()
    expect(within(skjema).getByText(/salt eller ester av Amitriptylin/)).toBeTruthy()
    await user.click(within(skjema).getByRole('button', { name: 'Koble siden til Amitriptylin' }))
    await user.click(within(skjema).getByRole('button', { name: 'Lagre utkast' }))

    await waitFor(() => expect(lager.opprettUtkast).toHaveBeenCalledTimes(2))
    const kall = vi.mocked(lager.opprettUtkast).mock.calls
    // Amitriptylin-siden lages med nøkkelen fra registeret. Nortriptylin, som
    // også er koblet til AMTNORSUM, får ingen side, og ingen analytt lagres.
    expect(kall[0]).toEqual(['infoside', { navn: 'Amitriptylin', slug: 'amitriptylin' }])
    // Koblingen lagres med FESTs ID; navnet er med for historikken.
    expect(kall[1]).toEqual([
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
    let slipp: (d: Stoffsidedata) => void = () => {}
    const k = kilde({ kanRedigere: true })
    k.leser.lesStoffside = vi.fn((_slug: string, tilstand: Tilstand) =>
      tilstand === 'utkast' ? new Promise<Stoffsidedata>((r) => (slipp = r)) : Promise.resolve(side('publisert')),
    )
    vis('amitriptylin', k)
    await finnVerdi('10–20 nmol/L')
    await user.click(screen.getByRole('button', { name: 'Rediger' }))

    // Det publiserte står fortsatt, men kan ikke endres mens utkastet hentes.
    expect(screen.getAllByRole('status').some((s) => s.textContent?.includes('Henter utkastet …'))).toBe(true)
    expect(screen.getByRole('button', { name: 'Publiser' }).getAttribute('aria-disabled')).toBe('true')
    expect(screen.queryByRole('button', { name: 'Rediger: Referanseområde' })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Legg til/ })).toBeNull()

    await act(async () => slipp(side('utkast')))
    expect(await screen.findByRole('button', { name: 'Rediger: Referanseområde' })).toBeTruthy()
  })

  it('gjør et kort som noen andre alt har lagt inn, til en konflikt', async () => {
    const user = userEvent.setup()
    const k = kilde({ kanRedigere: true })
    let andreHarLagret = false
    k.leser.lesStoffside = vi.fn(async (_slug: string, tilstand: Tilstand) => {
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
    vis('amitriptylin', k)
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
    vis('amitriptylin', kilde({ kanRedigere: true }))
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
      'Kode',
      'Overskrift 1',
      'Overskrift 2',
      'Punktliste',
      'Nummerert liste',
      'Sitat',
      'Sett inn skillelinje',
      'Lenke',
      'Sett inn spesialtegn',
      'Sett inn referanse',
    ])
    // Knappene har de samme bokstavene som hurtigtastene.
    expect(within(rad).getByRole('button', { name: 'Fet' }).textContent).toBe('B')
    expect(within(rad).getByRole('button', { name: 'Kursiv' }).textContent).toBe('I')
    expect(within(rad).getByRole('button', { name: 'Overskrift 1' }).getAttribute('aria-keyshortcuts')).toBe('Control+Alt+1')
    expect(screen.getByRole('textbox', { name: 'Farmakodynamikk' })).toBeTruthy()
    // Siteringen i teksten vises med forfatter og år mens den redigeres.
    expect(screen.getByLabelText('Referanse: Nordmann 2020; Hansen 2021')).toBeTruthy()
    await act(async () => {})
  })
})

describe('kortene i farmakokinetikken', () => {
  /**
   * En tekst som er lengre enn oppsummeringen av et lukket kort får plass til,
   * så kortet har mer å vise og kan åpnes.
   */
  const LANG = 'Syntetisk tekst som er lengre enn det oppsummeringen av et lukket kort får plass til, så kortet har mer å vise og må åpnes for at resten skal leses.'

  /** To kinetikkort, Absorpsjon og Metabolisme, med teksten i `tekster` (eller `LANG`). */
  const medKort =
    (tekster: Partial<Record<'k1' | 'k2', string>> = {}) =>
    (tilstand: Tilstand): Stoffsidedata => {
      const data = side(tilstand)
      const kort = (id: 'k1' | 'k2', tittel: string, posisjon: number) =>
        utgave(id, {
          infoside: 'hs',
          panel: 'farmakokinetikk',
          posisjon,
          elementtype: 'kinetikkort',
          data: {
            tittel,
            dokument: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: tekster[id] ?? LANG }] }] },
          },
        })
      return { ...data, elementer: [...data.elementer, kort('k1', 'Absorpsjon', 0), kort('k2', 'Metabolisme', 0)] }
    }

  it('flytter et kort, og lagrer bare det som får ny plass', async () => {
    const user = userEvent.setup()
    const { lager } = vis('amitriptylin', kilde({ kanRedigere: true, data: medKort() }))
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
    vis('amitriptylin', kilde({ data: medKort() }))
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
    vis('amitriptylin', kilde({ data: medKort({ k1: `${LANG} Om metabolisme.` }) }))
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

  it('flytter kortene i rutenettet synlig når brukeren åpner dem', async () => {
    const user = userEvent.setup()
    vis('amitriptylin', kilde({ data: medKort() }))
    await finnVerdi('10–20 nmol/L')
    await apneSkuff(user, 'Farmakokinetikk')
    const kort = document.querySelectorAll('.skuffrutenett > li > .skuff--detalj')
    expect(kort).toHaveLength(2)
    for (const k of kort) expect(k.hasAttribute('data-flyttes')).toBe(true)
    await apneSkuff(user, 'Absorpsjon')
    expect(skuffen('Absorpsjon').getAttribute('aria-expanded')).toBe('true')
    // Kortet står åpent med én gang; det er rutenettet som flytter det.
    expect(document.querySelector('[data-skuff="farmakokinetikk/k1"] .skuff__inner')!.hasAttribute('hidden')).toBe(false)
  })

  it('viser farmakogenetikken som en egen seksjon, med ett kort som står åpent', async () => {
    const user = userEvent.setup()
    const data = (tilstand: Tilstand): Stoffsidedata => {
      const s = medKort()(tilstand)
      const cyp = utgave('cyp', {
        infoside: 'hs',
        panel: 'farmakogenetikk',
        posisjon: 0,
        elementtype: 'kinetikkort',
        data: {
          tittel: 'CYP-enzymer (substrat)',
          dokument: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: `${LANG} CYP2D6.` }] }] },
        },
      })
      return { ...s, elementer: [...s.elementer, cyp] }
    }
    vis('amitriptylin', kilde({ data }))
    await finnVerdi('10–20 nmol/L')
    const seksjoner = [...document.querySelectorAll('.skuff--seksjon')].map((s) => s.getAttribute('data-skuff'))
    expect(seksjoner.indexOf('farmakogenetikk')).toBe(seksjoner.indexOf('farmakokinetikk') + 1)
    await apneSkuff(user, 'Farmakogenetikk')
    expect(skuffen('CYP-enzymer (substrat)').getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText(`${LANG} CYP2D6.`)).toBeTruthy()
  })

  it('viser et kort uten noe mer å vise som et fast kort med hele teksten, som ikke kan åpnes', async () => {
    const user = userEvent.setup()
    vis('amitriptylin', kilde({ data: medKort({ k1: '44 %' }) }))
    await finnVerdi('10–20 nmol/L')
    await apneSkuff(user, 'Farmakokinetikk')
    const fast = document.getElementById(detaljanker('farmakokinetikk', 'k1'))!
    expect(fast.classList).toContain('skuff--fast')
    expect(within(fast).getByRole('heading', { level: 3, name: 'Absorpsjon' })).toBeTruthy()
    // Ingen knapp og ingen pil: det er ingenting å åpne.
    expect(within(fast).queryByRole('button')).toBeNull()
    expect(fast.querySelector('.skuff__pil')).toBeNull()
    // Hele teksten står fram, og ikke i noen skjult kropp.
    const tekst = within(fast).getByText('44 %')
    expect(tekst.closest('[hidden]')).toBeNull()
    expect(fast.querySelector('.skuff__kropp')).toBeNull()
    // Kortet med mer å vise kan fortsatt åpnes.
    expect(skuffen('Metabolisme').getAttribute('aria-expanded')).toBe('false')
  })

  it('går til et treff i et fast kort og åpner seksjonen det står i', async () => {
    const user = userEvent.setup()
    vis('amitriptylin', kilde({ data: medKort({ k1: '44 % biotilgjengelighet' }) }))
    await finnVerdi('10–20 nmol/L')
    expect(skuffen('Farmakokinetikk').getAttribute('aria-expanded')).toBe('false')
    await user.type(screen.getByRole('searchbox', { name: 'Søk på denne siden' }), 'biotilgjengelighet')
    const steder = within(await screen.findByRole('list', { name: 'Hvor treffene står' }))
    await user.click(steder.getByRole('button', { name: 'Farmakokinetikk › Absorpsjon' }))
    expect(skuffen('Farmakokinetikk').getAttribute('aria-expanded')).toBe('true')
    const aktivt = document.querySelector('mark.sidetreff--aktiv')!
    expect(aktivt.closest('.skuff--fast')?.id).toBe(detaljanker('farmakokinetikk', 'k1'))
    expect(aktivt.closest('[hidden]')).toBeNull()
  })

  it('lar redaktøren åpne også et kort uten noe mer å vise, for å komme til knappene', async () => {
    const user = userEvent.setup()
    vis('amitriptylin', kilde({ kanRedigere: true, data: medKort({ k1: '44 %' }) }))
    await finnVerdi('10–20 nmol/L')
    await user.click(screen.getByRole('button', { name: 'Rediger' }))
    await apneSkuff(user, 'Farmakokinetikk')
    await apneSkuff(user, 'Absorpsjon')
    expect(await screen.findByRole('button', { name: 'Rediger: Absorpsjon' })).toBeTruthy()
  })

  it('fjerner et kort først etter en bekreftelse, uten å slette det', async () => {
    const user = userEvent.setup()
    const { lager } = vis('amitriptylin', kilde({ kanRedigere: true, data: medKort() }))
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

  it('viser kortene i bivirkningene for den som leser', async () => {
    const user = userEvent.setup()
    const data = (tilstand: Tilstand): Stoffsidedata => {
      const s = medKort()(tilstand)
      const kort = utgave('bv', {
        infoside: 'hs',
        panel: 'bivirkninger',
        posisjon: 0,
        elementtype: 'kinetikkort',
        data: { tittel: 'Vanlige', dokument: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Munntørrhet.' }] }] } },
      })
      return { ...s, elementer: [...s.elementer, kort] }
    }
    vis('amitriptylin', kilde({ data }))
    await finnVerdi('10–20 nmol/L')
    expect(screen.queryByRole('heading', { level: 2, name: 'Virkninger' })).toBeNull()
    await apneSkuff(user, 'Bivirkninger')
    expect(screen.getByRole('region', { name: 'Bivirkninger' }).textContent).toContain('Munntørrhet.')
  })

  it('har faste kort i to undergrupper i «Avhengighet, toleranse og tilbakeslagseffekter»', async () => {
    const user = userEvent.setup()
    const SEKSJON = 'Avhengighet, toleranse og tilbakeslagseffekter'
    const ADAPTASJON = 'Fysiologisk adaptasjon'
    const LAERING = 'Lærings- og motivasjonsfenomener'
    const data = (tilstand: Tilstand): Stoffsidedata => {
      const s = medKort()(tilstand)
      const kort = utgave('tol', {
        infoside: 'hs',
        panel: 'avhengighet_toleranse',
        posisjon: 0,
        elementtype: 'kinetikkort',
        data: { tittel: 'Toleranseutvikling', dokument: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: LANG }] }] } },
      })
      return { ...s, elementer: [...s.elementer, kort] }
    }
    vis('amitriptylin', kilde({ kanRedigere: true, data }))
    await finnVerdi('10–20 nmol/L')
    const titler = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(titler.indexOf(SEKSJON)).toBeGreaterThan(titler.indexOf('Farmakokinetikk'))
    const seksjon = screen.getByRole('region', { name: SEKSJON })
    expect(seksjon.querySelector('[data-ikon="avhengighet"]')).not.toBeNull()
    expect(seksjon.querySelector('[data-ikon="toleranse"]')).not.toBeNull()
    // For den som leser, står bare undergruppen med innhold, og kortet står i den.
    await apneSkuff(user, SEKSJON)
    expect(within(seksjon).getByRole('heading', { level: 3, name: ADAPTASJON })).toBeTruthy()
    expect(within(seksjon).queryByRole('heading', { level: 3, name: LAERING })).toBeNull()
    expect(within(seksjon).getByRole('heading', { level: 4, name: 'Toleranseutvikling' })).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Rediger' }))
    await apneSkuff(user, SEKSJON)
    const omrade = screen.getByRole('region', { name: SEKSJON })
    expect(within(omrade).getByRole('heading', { level: 3, name: LAERING })).toBeTruthy()
    // I redigeringsmodus står begge undergruppene, og hvert kort som mangler,
    // legges til for seg i sin gruppe; det som finnes, ikke en gang til.
    await apneSkuff(user, ADAPTASJON)
    const adaptasjon = within(omrade).getByRole('group', { name: ADAPTASJON })
    expect(within(adaptasjon).getByRole('button', { name: 'Legg til: Abstinens, seponeringssyndrom og rebound-effekter' })).toBeTruthy()
    expect(within(adaptasjon).queryByRole('button', { name: 'Legg til: Toleranseutvikling' })).toBeNull()
    expect(within(omrade).queryByRole('button', { name: 'Legg til kort' })).toBeNull()

    // Det faste kortet flyttes ikke, og overskriften kan ikke endres.
    expect(screen.queryByRole('button', { name: /^Flytt (opp|ned): Toleranseutvikling$/ })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Rediger: Toleranseutvikling' }))
    expect(within(screen.getByRole('dialog')).queryByLabelText('Overskrift')).toBeNull()
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Avbryt' }))

    await apneSkuff(user, LAERING)
    const laering = within(omrade).getByRole('group', { name: LAERING })
    expect(within(laering).getByRole('button', { name: 'Legg til: Addiksjon' })).toBeTruthy()
    await user.click(within(laering).getByRole('button', { name: 'Legg til: Lært mestringsavhengighet' }))
    const nytt = screen.getByRole('dialog')
    expect(within(nytt).queryByLabelText('Overskrift')).toBeNull()
    expect(nytt.querySelector('[data-ikon="krykke"]')).not.toBeNull()
  })

  it('har «Toksisitet og forgiftning» og «Graviditet, amming og reproduksjon» med faste kort, skjult når de er tomme', async () => {
    const user = userEvent.setup()
    const TOKS = 'Toksisitet og forgiftning'
    const GRAV = 'Graviditet, amming og reproduksjon'
    const data = (tilstand: Tilstand): Stoffsidedata => {
      const s = medKort()(tilstand)
      const kort = utgave('antidot', {
        infoside: 'hs',
        panel: 'toksisitet_forgiftning',
        posisjon: 5,
        elementtype: 'kinetikkort',
        data: {
          tittel: 'Behandling ved forgiftning',
          dokument: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: `${LANG} Motgiftsomtale.` }] }] },
        },
      })
      return { ...s, elementer: [...s.elementer, kort] }
    }
    vis('amitriptylin', kilde({ kanRedigere: true, data }))
    await finnVerdi('10–20 nmol/L')
    // Graviditeten har ikke noe innhold og står ikke for den som leser.
    const titler = () => screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(titler()).toContain(TOKS)
    expect(titler()).not.toContain(GRAV)
    const toks = screen.getByRole('region', { name: TOKS })
    expect(toks.querySelector('[data-ikon="forgiftning"]')).not.toBeNull()
    expect(toks.querySelector('[data-ikon="antidot"]')).not.toBeNull()
    // Lukket sier seksjonen hvilke kort den har; bare kortet med innhold står.
    expect(toks.querySelector('.skuff__oppsummering')?.textContent).toBe('Behandling ved forgiftning')
    await apneSkuff(user, TOKS)
    expect(within(toks).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Behandling ved forgiftning'])
    expect(within(toks).queryByRole('button', { name: /^Legg til/ })).toBeNull()

    // Søket på siden finner teksten i kortet.
    await user.type(screen.getByRole('searchbox', { name: 'Søk på denne siden' }), 'motgiftsomtale')
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Treff 1 av 1'))
    expect(document.querySelector('mark.sidetreff')?.closest('#panel-toksisitet_forgiftning')).not.toBeNull()
    await user.clear(screen.getByRole('searchbox', { name: 'Søk på denne siden' }))

    // I redigeringsmodus står begge seksjonene, med de faste kortene som mangler, og ingen kort med fri overskrift.
    await user.click(screen.getByRole('button', { name: 'Rediger' }))
    await apneSkuff(user, TOKS)
    const toksRed = screen.getByRole('region', { name: TOKS })
    expect(within(toksRed).getAllByRole('button', { name: /^Legg til: / }).map((b) => b.getAttribute('aria-label'))).toEqual([
      'Legg til: Toksisk dose og eksponering',
      'Legg til: Toksiske konsentrasjoner',
      'Legg til: Klinisk forgiftningsbilde',
      'Legg til: Alvorlige komplikasjoner',
      'Legg til: Toksikokinetiske særtrekk',
    ])
    expect(within(toksRed).queryByRole('button', { name: 'Legg til kort' })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Flytt (opp|ned): Behandling ved forgiftning$/ })).toBeNull()

    // Toksisiteten står mellom bivirkningene og indikasjonen, graviditeten rett før avhengigheten.
    const rekkefolge = titler()
    expect(rekkefolge.slice(rekkefolge.indexOf('Bivirkninger'), rekkefolge.indexOf('Indikasjon') + 1)).toEqual(['Bivirkninger', TOKS, 'Indikasjon'])
    expect(rekkefolge[rekkefolge.indexOf('Avhengighet, toleranse og tilbakeslagseffekter') - 1]).toBe(GRAV)
    await apneSkuff(user, GRAV)
    const grav = screen.getByRole('region', { name: GRAV })
    expect(grav.querySelector('[data-ikon="svangerskap"]')).not.toBeNull()
    expect(within(grav).getAllByRole('button', { name: /^Legg til: / }).map((b) => b.textContent)).toEqual([
      'Graviditet',
      'Perinatal og neonatal påvirkning',
      'Amming',
      'Fertilitet og reproduksjon',
    ])
    await user.click(within(grav).getByRole('button', { name: 'Legg til: Amming' }))
    const nytt = screen.getByRole('dialog')
    expect(within(nytt).queryByLabelText('Overskrift')).toBeNull()
    expect(nytt.querySelector('[data-ikon="amming"]')).not.toBeNull()
  })
})

describe('mekanismekortene i farmakodynamikken', () => {
  /**
   * Farmakodynamikken som to mekanismekort i stedet for teksten: en
   * antagonist med kilde og utdypende tekst, og et eldre kort for et mål uten
   * effekt og uten utdypende tekst, med feltene kortene hadde før (som ikke
   * vises lenger).
   */
  const tekst = (t: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: t }] }] })
  const medMekanismer = (tilstand: Tilstand): Stoffsidedata => {
    const data = side(tilstand)
    const kort = (id: string, posisjon: number, kortdata: Record<string, unknown>, referanser: string[] = []) =>
      utgave(id, { infoside: 'hs', panel: 'farmakodynamikk', posisjon, elementtype: 'mekanismekort', data: kortdata, referanser })
    return {
      ...data,
      elementer: [
        ...data.elementer.filter((e) => e.id !== 'tekst'),
        kort('m1', 0, { maal: 'D2-reseptor', mekanisme: 'antagonisme', dokument: tekst('Syntetisk utdyping.') }, [REF_A.id]),
        kort('m2', 1, {
          maal: 'D1-reseptor',
          effekt: 'Ingen effekt',
          mekanisme: 'ingen_effekt',
          retning: 'ingen',
          kvalifikasjon: 'Ingen affinitet',
          merknad: 'Syntetisk merknad.',
        }),
      ],
    }
  }
  const kortet = (id: string) => document.getElementById(detaljanker('farmakodynamikk', id))!

  it('viser målet med subtypen senket og effekten som en farget pille på de lukkede kortene', async () => {
    const user = userEvent.setup()
    vis('amitriptylin', kilde({ data: medMekanismer }))
    await finnVerdi('10–20 nmol/L')
    // Seksjonen oppsummerer målene stoffet virker på.
    expect(skuffen('Farmakodynamikk').closest('.skuff')!.querySelector('.skuff__oppsummering')!.textContent).toBe('D2-reseptor')
    await apneSkuff(user, 'Farmakodynamikk')

    expect(kortet('m1').querySelector('.skuff__tittel sub')!.textContent).toBe('2')
    const pille = kortet('m1').querySelector('.skuff__oppsummering .merke')!
    expect(pille.textContent).toBe('Antagonist')
    expect(pille.classList).toContain('merke--alvorlig')
    expect([...kortet('m1').classList]).toEqual(expect.arrayContaining(['mekanismekort--redusert', 'system-dopamin']))
    expect(kortet('m1').querySelector('.skuff__ikon .ikon')!.getAttribute('data-ikon')).toBe('mekAntagonisme')

    // D1 har ingen utdypende tekst, så kortet er fast og viser bare effekten, i grått.
    // De eldre feltene, som kvalifikasjonen og merknaden, vises ikke.
    expect(kortet('m2').classList).toContain('skuff--fast')
    expect(within(kortet('m2')).queryByRole('button')).toBeNull()
    expect(kortet('m2').querySelector('.infokort__innhold')!.textContent).toBe('Ingen effekt')
    expect(kortet('m2').querySelector('.infokort__innhold .merke')!.classList).toContain('merke--noytral')
    expect(kortet('m2').classList).toContain('mekanismekort--noytral')
    expect(kortet('m2').querySelector('.skuff__ikon')).toBeNull()

    expect(screen.queryByText('gjenopptaket')).toBeNull()
  })

  it('finner et fast mekanismekort på effekten', async () => {
    const user = userEvent.setup()
    vis('amitriptylin', kilde({ data: medMekanismer }))
    await finnVerdi('10–20 nmol/L')
    await user.type(screen.getByRole('searchbox', { name: 'Søk på denne siden' }), 'Ingen effekt')
    const steder = within(await screen.findByRole('list', { name: 'Hvor treffene står' }))
    await user.click(steder.getByRole('button', { name: 'Farmakodynamikk › D1-reseptor' }))
    expect(skuffen('Farmakodynamikk').getAttribute('aria-expanded')).toBe('true')
    expect(document.querySelector('mark.sidetreff--aktiv')!.closest('.skuff--fast')).toBe(kortet('m2'))
    expect(kortet('m2').querySelector('.merke mark')).not.toBeNull()
  })

  it('viser effekten, den utdypende teksten og kildene i det åpnede kortet, og ikke mekanismen og retningen', async () => {
    const user = userEvent.setup()
    vis('amitriptylin', kilde({ data: medMekanismer }))
    await finnVerdi('10–20 nmol/L')
    await apneSkuff(user, 'Farmakodynamikk')
    await apneSkuff(user, 'D2-reseptor')
    const innhold = kortet('m1').querySelector<HTMLElement>('.skuff__innhold')!
    expect(innhold.querySelector('.mekanismekort__effekt .merke--alvorlig')!.textContent).toBe('Antagonist')
    expect(within(innhold).getByText('Syntetisk utdyping.')).toBeTruthy()
    expect(within(innhold).queryByText(/Antagonisme|Reduseres|Mekanisme|Retning/)).toBeNull()
    expect(kortet('m1').querySelector('.referansefelt--element')).not.toBeNull()
  })

  it('fremhever søketreff i målet også over subtypen, og på effekten', async () => {
    const user = userEvent.setup()
    vis('amitriptylin', kilde({ data: medMekanismer }))
    await finnVerdi('10–20 nmol/L')
    const sok = screen.getByRole('searchbox', { name: 'Søk på denne siden' })
    await user.type(sok, 'D2-res')
    await waitFor(() => expect(kortet('m1').querySelector('.skuff__tittel mark.sidetreff')).not.toBeNull())
    const merke = kortet('m1').querySelector('.skuff__tittel mark.sidetreff')!
    expect(merke.textContent).toBe('D2-res')
    expect(merke.querySelector('sub')!.textContent).toBe('2')

    await user.clear(sok)
    await user.type(sok, 'Antagonist')
    await waitFor(() => expect(kortet('m1').querySelector('.skuff__innhold .merke mark.sidetreff')).not.toBeNull())
  })

  it('legger til et mekanismekort, og viser effekten slik den blir mens mekanismen velges', async () => {
    const user = userEvent.setup()
    const { lager } = vis('amitriptylin', kilde({ kanRedigere: true, data: medMekanismer }))
    await finnVerdi('10–20 nmol/L')
    await user.click(screen.getByRole('button', { name: 'Rediger' }))
    await apneSkuff(user, 'Farmakodynamikk')
    await user.click(await screen.findByRole('button', { name: 'Legg til mekanismekort' }))
    const vindu = redigeringsvindu('Nytt kort')
    const skjema = within(vindu)

    await user.click(skjema.getByRole('button', { name: 'Lagre utkast' }))
    expect(skjema.getByRole('alert').textContent).toBe('Oppgi målproteinet eller prosessen.')

    await user.type(skjema.getByLabelText('Målprotein eller prosess'), '5-HT1A-reseptor')
    await user.click(skjema.getByRole('button', { name: 'Lagre utkast' }))
    expect(skjema.getByRole('alert').textContent).toBe('Velg mekanismen.')

    await user.selectOptions(skjema.getByLabelText('Mekanisme'), 'partiell_agonisme')
    const forhandsvisning = vindu.querySelector('.mekanismeskjema__forhandsvisning')!
    expect(forhandsvisning.querySelector('.merke')!.textContent).toBe('Partiell agonist')
    expect(forhandsvisning.querySelector('.merke')!.classList).toContain('merke--toksisk')
    expect(forhandsvisning.classList).toContain('system-serotonin')
    expect(forhandsvisning.querySelector('.ikon')!.getAttribute('data-ikon')).toBe('mekPartiellAgonisme')
    await user.click(skjema.getByRole('button', { name: 'Lagre utkast' }))

    await waitFor(() => expect(lager.opprettUtkast).toHaveBeenCalledTimes(1))
    expect(vi.mocked(lager.opprettUtkast).mock.calls[0]).toEqual([
      'innholdselement',
      expect.objectContaining({
        panel: 'farmakodynamikk',
        posisjon: 2,
        elementtype: 'mekanismekort',
        data: { maal: '5-HT1A-reseptor', mekanisme: 'partiell_agonisme' },
      }),
    ])
  })

  it('redigerer et mekanismekort og beholder kildene, og fjerner et først etter en bekreftelse', async () => {
    const user = userEvent.setup()
    const { lager } = vis('amitriptylin', kilde({ kanRedigere: true, data: medMekanismer }))
    await finnVerdi('10–20 nmol/L')
    await user.click(screen.getByRole('button', { name: 'Rediger' }))
    await apneSkuff(user, 'Farmakodynamikk')
    await apneSkuff(user, 'D2-reseptor')
    await user.click(await screen.findByRole('button', { name: 'Rediger: D2-reseptor' }))
    const skjema = within(redigeringsvindu('D2-reseptor'))
    await user.selectOptions(skjema.getByLabelText('Mekanisme'), 'invers_agonisme')
    await user.click(skjema.getByRole('button', { name: 'Lagre utkast' }))
    await waitFor(() => expect(lager.lagreUtkast).toHaveBeenCalledTimes(1))
    expect(vi.mocked(lager.lagreUtkast).mock.calls[0]).toEqual([
      'm1',
      1,
      expect.objectContaining({
        elementtype: 'mekanismekort',
        data: { maal: 'D2-reseptor', mekanisme: 'invers_agonisme', dokument: tekst('Syntetisk utdyping.') },
        referanser: [REF_A.id],
      }),
    ])

    await apneSkuff(user, 'D1-reseptor')
    await user.click(await screen.findByRole('button', { name: 'Fjern: D1-reseptor' }))
    expect(lager.lagreUtkast).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: 'Bekreft: fjern D1-reseptor' }))
    await waitFor(() => expect(lager.lagreUtkast).toHaveBeenCalledTimes(2))
    expect(vi.mocked(lager.lagreUtkast).mock.calls[1]![2]).toMatchObject({ panel: 'fjernet', elementtype: 'mekanismekort' })
  })
})

describe('historikken', () => {
  it('åpner historikken for et kort fra «Sist redigert»', async () => {
    const user = userEvent.setup()
    const { leser } = vis('amitriptylin', kilde({ kanRedigere: true }))
    await finnVerdi('10–20 nmol/L')
    await user.click(screen.getByRole('button', { name: 'Rediger' }))
    await user.click(await screen.findByRole('button', { name: /Vis historikken for referanseområde/ }))
    await screen.findByRole('dialog', { name: 'Historikk: Referanseområde' })
    expect(leser.lesHistorikk).toHaveBeenCalledWith('kort')
  })
})

describe('innhold hentet fra en kilde', () => {
  /** Siden etter importen: innhold fra PDF-en og et indikasjonssammendrag fra Felleskatalogen. */
  function importert(tilstand: Tilstand): Stoffsidedata {
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
    vis('amitriptylin', kilde({ data: importert, kanRedigere: true }))
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

describe('farmakogenetikken fra ClinPGx', () => {
  /** Lengre enn oppsummeringen av et lukket kort, så det redaksjonelle kortet kan åpnes. */
  const REDAKSJONELL =
    'Syntetisk redaksjonell tekst. Den er lengre enn det oppsummeringen av et lukket kort får plass til, så kortet har mer å vise når det åpnes og leses i sin helhet.'
  const genref = (symbol: string) => ({ id: `PA-${symbol}`, symbol })
  const grunnlag = {
    navn: '',
    gener: [] as { id: string; symbol: string }[],
    legemidler: [{ id: 'PA1', navn: 'amitriptyline' }],
    sammendrag: '',
    dosering: false,
    alternativ: false,
    annen_veiledning: false,
    barn: false,
    litteratur: [],
    kjemikalier: ['PA1'],
  }
  const klinisk = {
    navn: '',
    typer: ['Metabolism/PK'],
    sykdommer: [],
    fenotyper: [],
    legemidler: [],
    retningslinjer: [],
    preparatomtaler: [],
    kjemikalier: ['PA1'],
  }

  /** Syntetiske data i formen `les_farmakogenetikk` gir; tekstene er ikke kliniske. */
  const UTVALG_PGX: Farmakogenetikkutvalg = {
    kilde: 'ClinPGx',
    kontrollert_kl: new Date().toISOString(),
    kjemikalier: [
      { id: 'PA1', navn: 'amitriptyline', finnes: true, sist_hentet_kl: new Date().toISOString(), feil: null, feil_kl: null },
    ],
    retningslinjer: [
      {
        ...grunnlag,
        id: 'PA902',
        navn: 'Syntetisk DPWG-retningslinje',
        kilde: 'DPWG',
        gener: [genref('CYP2D6')],
        sammendrag: 'Syntetisk sammendrag fra DPWG.',
      },
      {
        ...grunnlag,
        id: 'PA901',
        navn: 'Syntetisk CPIC-retningslinje',
        kilde: 'CPIC',
        gener: [genref('CYP2D6'), genref('CYP2C19')],
        sammendrag: 'Syntetisk sammendrag fra CPIC.\n\nAndre avsnitt.',
        dosering: true,
        litteratur: [{ tittel: 'Syntetisk artikkel', aar: 2016, lenke: 'https://doi.org/10.0000/syntetisk', pmid: null, doi: '10.0000/syntetisk' }],
      },
    ],
    preparatomtaler: [
      { ...grunnlag, id: 'PA903', navn: 'Syntetisk preparatomtale', kilde: 'FDA', gener: [genref('CYP2D6')], sammendrag: 'Syntetisk omtale.', testing: 'Actionable PGx' },
    ],
    kliniske: [
      { ...klinisk, id: 'PA911', nummer: '911', niva: '3', gener: [genref('ABCB1')], variant: 'rs0000001', rsid: 'rs0000001', poeng: 2 },
      {
        ...klinisk,
        id: 'PA910',
        nummer: '910',
        niva: '1A',
        gener: [genref('CYP2D6')],
        variant: 'CYP2D6*1, CYP2D6*4',
        rsid: null,
        poeng: 100,
        fenotyper: [{ allel: '*1/*1', fenotype: 'Syntetisk fenotype.' }],
      },
    ],
  }

  function pgxleser(utvalg: Farmakogenetikkutvalg = UTVALG_PGX): Farmakogenetikkleser {
    return {
      les: vi.fn(async () => utvalg),
      sok: vi.fn(async () => [
        { id: 'PA1', navn: 'amitriptyline', atc: ['N06AA09'], typer: ['Drug'] },
        { id: 'PA2', navn: 'amitriptylinoxide', atc: [], typer: ['Drug'] },
      ]),
      hent: vi.fn(async () => ({ status: 'fullfort' as const, hentet: 1, feilet: 0 })),
    }
  }

  /** Siden koblet til ClinPGx, med et redaksjonelt kort i «Farmakogenetikk». */
  function medPgx({ redaksjonelt = true, kjemikalier = [{ clinpgx_id: 'PA1', navn: 'amitriptyline' }] } = {}) {
    return (tilstand: Tilstand): Stoffsidedata => {
      const s = medKobling(tilstand)
      return {
        ...s,
        elementer: [
          ...s.elementer,
          ...(kjemikalier.length > 0
            ? [
                utgave('pgxkobling', {
                  infoside: 'hs',
                  panel: 'farmakogenetikk',
                  posisjon: 0,
                  elementtype: 'clinpgxkobling',
                  data: { kjemikalier },
                  referanser: [],
                }),
              ]
            : []),
          ...(redaksjonelt
            ? [
                utgave('cyp', {
                  infoside: 'hs',
                  panel: 'farmakogenetikk',
                  posisjon: 0,
                  elementtype: 'kinetikkort',
                  data: {
                    tittel: 'CYP-enzymer (substrat)',
                    dokument: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: REDAKSJONELL }] }] },
                  },
                }),
              ]
            : []),
        ],
      }
    }
  }

  function pgxkilde(opp: Parameters<typeof kilde>[0] = {}, leser = pgxleser()) {
    return { ...kilde(opp), farmakogenetikk: leser }
  }

  it('leser ikke ClinPGx når siden ikke er koblet', async () => {
    const k = pgxkilde({ data: medPgx({ kjemikalier: [], redaksjonelt: false }) })
    vis('amitriptylin', k)
    await finnVerdi('10–20 nmol/L')
    expect(screen.queryByRole('region', { name: 'Farmakogenetikk' })).toBeNull()
    expect(k.farmakogenetikk.les).not.toHaveBeenCalled()
  })

  it('viser de redaksjonelle kortene først, så retningslinjene, preparatomtalene og de kliniske annotasjonene', async () => {
    const user = userEvent.setup()
    const k = pgxkilde({ data: medPgx() })
    vis('amitriptylin', k)
    // Den lukkede seksjonen oppsummerer genene og organisasjonene, så de redaksjonelle kortene.
    expect(await screen.findByText('CYP2D6 · CYP2C19 · CPIC + DPWG · CYP-enzymer (substrat)')).toBeTruthy()
    expect(k.farmakogenetikk.les).toHaveBeenCalledWith(['PA1'])
    await apneSkuff(user, 'Farmakogenetikk')
    const seksjon = screen.getByRole('region', { name: 'Farmakogenetikk' })
    // Det redaksjonelle kortet står ikke åpent alene når ClinPGx har noe ved siden av.
    expect(skuffen('CYP-enzymer (substrat)').getAttribute('aria-expanded')).toBe('false')

    const rekkefolge = [
      skuffen('CYP-enzymer (substrat)'),
      within(seksjon).getByRole('heading', { name: 'Retningslinjer' }),
      skuffen('CPIC · CYP2D6, CYP2C19'),
      skuffen('DPWG · CYP2D6'),
      within(seksjon).getByRole('heading', { name: 'Farmakogenetiske preparatomtaler' }),
      skuffen('FDA · CYP2D6'),
      within(seksjon).getByRole('heading', { name: 'Kliniske annotasjoner' }),
      skuffen('CYP2D6*1, CYP2D6*4'),
      skuffen('Lavere evidensnivå'),
    ]
    for (let i = 1; i < rekkefolge.length; i += 1) {
      expect(rekkefolge[i - 1]!.compareDocumentPosition(rekkefolge[i]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    }

    await user.click(skuffen('CPIC · CYP2D6, CYP2C19'))
    const cpic = screen.getByText('Syntetisk sammendrag fra CPIC.').closest('.interaksjon') as HTMLElement
    expect(within(cpic).getByText('Andre avsnitt.')).toBeTruthy()
    expect(within(cpic).getByText('CPIC')).toBeTruthy()
    expect(within(cpic).getByText('Dosering')).toBeTruthy()
    expect(within(cpic).getByRole('link', { name: /Les hele i ClinPGx/ }).getAttribute('href')).toBe(
      'https://www.clinpgx.org/guidelineAnnotation/PA901',
    )
    // Publikasjonen ClinPGx oppgir, står i kortets referansefelt, og ClinPGx i seksjonens.
    expect(within(cpic).getByRole('button', { name: /^Referanse \d+$/ })).toBeTruthy()
    const liste = screen.getByRole('region', { name: 'Referanser' })
    expect(within(liste).getAllByText('Automatisk fra ClinPGx').length).toBe(2)
    expect(liste.textContent).toContain('Utdrag av farmakogenetiske data fra ClinPGx, omformet av OUSFAR, lisens CC BY-SA 4.0, sist hentet')
    // Lisensen krever lenke til seg; bruksvilkårene står ved siden av.
    expect(within(liste).getByRole('link', { name: 'Lisens: CC BY-SA 4.0' }).getAttribute('href')).toBe(
      'https://creativecommons.org/licenses/by-sa/4.0/',
    )
    expect(within(liste).getByRole('link', { name: 'Bruksvilkår hos ClinPGx' }).getAttribute('href')).toBe(
      'https://www.clinpgx.org/page/dataUsagePolicy',
    )

    await user.click(skuffen('Lavere evidensnivå'))
    const lavere = within(seksjon).getByRole('table')
    expect(within(lavere).getByRole('link', { name: /rs0000001/ }).getAttribute('href')).toBe(
      'https://www.clinpgx.org/clinicalAnnotation/911',
    )
    expect(within(seksjon).getByText(/^Referanseinformasjon fra ClinPGx, ikke en anbefaling for den enkelte pasient · sist hentet/)).toBeTruthy()
  })

  it('sier fra når ClinPGx ikke har noe, når kjemikaliet ikke er hentet, og når lesingen feiler', async () => {
    vis('amitriptylin', pgxkilde({ data: medPgx({ redaksjonelt: false }) }, pgxleser({ ...UTVALG_PGX, retningslinjer: [], preparatomtaler: [], kliniske: [] })))
    expect(await screen.findByText(/ClinPGx har ingen retningslinjer, preparatomtaler eller kliniske annotasjoner for amitriptyline/)).toBeTruthy()
    cleanup()

    vis('amitriptylin', pgxkilde({ data: medPgx({ redaksjonelt: false }) }, pgxleser({ ...UTVALG_PGX, kjemikalier: [], retningslinjer: [], preparatomtaler: [], kliniske: [] })))
    expect(await screen.findByText('amitriptyline (PA1) er ikke hentet fra ClinPGx ennå. Den ukentlige oppdateringen henter det.')).toBeTruthy()
    cleanup()

    const feil = pgxleser()
    feil.les = vi.fn(async () => {
      throw new Error('Nettverksfeil')
    })
    vis('amitriptylin', pgxkilde({ data: medPgx() }, feil))
    expect(await screen.findByText(/Fikk ikke hentet farmakogenetikken fra ClinPGx\. Nettverksfeil/)).toBeTruthy()
    // Det redaksjonelle står der fortsatt.
    expect(screen.getAllByText(REDAKSJONELL).length).toBeGreaterThan(0)
  })

  it('finner gener og organisasjoner i søket på siden, og åpner kortet treffet står i', async () => {
    const user = userEvent.setup()
    vis('amitriptylin', pgxkilde({ data: medPgx() }))
    await screen.findByText(/CPIC \+ DPWG/)
    await user.type(screen.getByRole('searchbox', { name: 'Søk på denne siden' }), 'CYP2C19')
    const steder = within(await screen.findByRole('list', { name: 'Hvor treffene står' }))
    await user.click(steder.getAllByRole('button', { name: /Farmakogenetikk › CPIC · CYP2D6, CYP2C19/ })[0]!)
    expect(skuffen('Farmakogenetikk').getAttribute('aria-expanded')).toBe('true')
    expect(skuffen('CPIC · CYP2D6, CYP2C19').getAttribute('aria-expanded')).toBe('true')
  })

  it('åpner kortet adressen peker på', async () => {
    vis('amitriptylin', pgxkilde({ data: medPgx() }), { sted: ['farmakogenetikk', 'clinpgx-klinisk-PA910'] })
    await waitFor(() => expect(skuffen('CYP2D6*1, CYP2D6*4').getAttribute('aria-expanded')).toBe('true'))
    expect(skuffen('Farmakogenetikk').getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText('Syntetisk fenotype.')).toBeTruthy()
  })

  it('kobler siden med ID-en fra ClinPGx, foreslår på ATC-koden, og henter dataene etter lagringen', async () => {
    const user = userEvent.setup()
    const k = pgxkilde({ kanRedigere: true, data: medPgx({ kjemikalier: [] }) })
    vis('amitriptylin', k)
    await screen.findByText(/1 bør unngås/)
    await user.click(screen.getByRole('button', { name: 'Rediger' }))
    await apneSkuff(user, 'Farmakogenetikk')
    await user.click(await screen.findByRole('button', { name: 'Legg til: Koblingen til ClinPGx' }))
    const skjema = redigeringsvindu('Koblingen til ClinPGx')
    // Søket begynner på det engelske navnet fra FEST.
    expect((within(skjema).getByRole('searchbox', { name: 'Slå opp i ClinPGx' }) as HTMLInputElement).value).toBe('Amitriptyline')
    await waitFor(() => expect(k.farmakogenetikk.sok).toHaveBeenCalledWith('Amitriptyline'), { timeout: 2000 })
    expect(await within(skjema).findByText(/Forslag: samme ATC-kode som preparatene \(N06AA09\)/)).toBeTruthy()
    // Et forslag er ikke en kobling: ingenting er lagret før det er valgt.
    expect(within(skjema).getByText(/Siden er ikke koblet/)).toBeTruthy()
    await user.click(within(skjema).getByRole('button', { name: 'Koble siden til amitriptyline i ClinPGx' }))
    await user.click(within(skjema).getByRole('button', { name: 'Lagre utkast' }))
    await waitFor(() => expect(k.lager.opprettUtkast).toHaveBeenCalledTimes(1))
    expect(vi.mocked(k.lager.opprettUtkast).mock.calls[0]![1]).toMatchObject({
      panel: 'farmakogenetikk',
      elementtype: 'clinpgxkobling',
      data: { kjemikalier: [{ clinpgx_id: 'PA1', navn: 'amitriptyline' }] },
    })
    await waitFor(() => expect(k.farmakogenetikk.hent).toHaveBeenCalledWith(['PA1']))
  })

  /* --- Anbefalingene fra CPIC ------------------------------------------------ */

  const naa = new Date().toISOString()
  const betingelse = (gen: string, felt: Partial<Betingelse>): Betingelse => ({
    gen,
    oppslagsverdi: null,
    fenotype: null,
    aktivitetsverdi: null,
    allelstatus: null,
    implikasjon: null,
    ...felt,
  })
  const anbefaling = (id: string, cyp2d6: [string, string], tekst: string): Anbefaling => ({
    id,
    retningslinje_id: '900',
    legemiddel_id: 'RxNorm:1',
    betingelser: [
      betingelse('CYP2C19', { oppslagsverdi: 'Normal Metabolizer', fenotype: 'Normal Metabolizer', aktivitetsverdi: 'n/a' }),
      betingelse('CYP2D6', { oppslagsverdi: cyp2d6[1], fenotype: cyp2d6[0], aktivitetsverdi: cyp2d6[1], implikasjon: `Syntetisk implikasjon for ${cyp2d6[0]}.` }),
    ],
    oppslagsnokkel: { CYP2C19: 'Normal Metabolizer', CYP2D6: cyp2d6[1] },
    anbefaling: tekst,
    klassifisering: 'Strong',
    populasjon: 'general',
    kommentarer: 'n/a',
    dosejustering: true,
    alternativt_legemiddel: false,
    annen_veiledning: false,
  })
  const par = (id: string, gen: string, retningslinje: string | null, niva: string): Par => ({
    id,
    gen,
    legemiddel_id: 'RxNorm:1',
    retningslinje_id: retningslinje,
    brukt_i_anbefaling: retningslinje !== null,
    cpic_niva: niva,
    clinpgx_niva: null,
    pgx_testing: null,
    pmid: [],
    fjernet: false,
    fjernet_dato: null,
    fjernet_grunn: null,
  })
  const gen = (symbol: string, oppslagsmetode: Gen['oppslagsmetode']): Gen => ({
    symbol,
    kromosom: null,
    clinpgx_id: null,
    hgnc_id: null,
    ncbi_id: null,
    ensembl_id: null,
    oppslagsmetode,
    merknad_diplotyper: null,
    merknad_allelnavn: null,
    url: null,
  })

  /** Syntetiske data i formen `les_cpic` gir; tekstene er ikke kliniske. */
  const UTVALG_CPIC: Cpicutvalg = {
    kilde: { navn: 'CPIC', release: 'v1.60.1', release_dato: '2026-08-12T00:00:00Z', skjemaversjon: '82', endret_kl: naa, kontrollert_kl: naa },
    legemidler: [
      {
        id: 'RxNorm:1',
        navn: 'amitriptyline',
        clinpgx_id: 'PA1',
        rxnorm: '1',
        drugbank: null,
        atc: ['N06AA09'],
        umls: null,
        retningslinje_id: '900',
        flytskjema_url: 'https://files.cpicpgx.org/syntetisk.jpg',
      },
    ],
    par: [par('1', 'CYP2C19', '900', 'A'), par('2', 'CYP2D6', '900', 'A'), par('3', 'ABCB1', null, 'D')],
    retningslinjer: [
      {
        id: '900',
        navn: 'Syntetisk CPIC-retningslinje',
        url: 'https://cpicpgx.org/guidelines/syntetisk',
        gener: ['CYP2C19', 'CYP2D6'],
        clinpgx_id: 'PA901',
        bruksmerknad: null,
        publikasjoner: [
          // Den samme publikasjonen som ClinPGx oppgir for retningslinjen.
          { id: '1', retningslinje_id: '900', tittel: 'Syntetisk artikkel', forfattere: [], tidsskrift: null, aar: 2016, maaned: null, volum: null, side: null, pmid: null, pmcid: null, doi: '10.0000/syntetisk', url: null },
        ],
      },
    ],
    anbefalinger: [
      anbefaling('11', ['Intermediate Metabolizer', '1.0'], 'Syntetisk anbefaling ved redusert aktivitet.'),
      anbefaling('12', ['Intermediate Metabolizer', '0.5'], 'Syntetisk anbefaling ved redusert aktivitet.'),
      anbefaling('13', ['Poor Metabolizer', '0.0'], 'Syntetisk anbefaling ved manglende aktivitet.'),
    ],
    gener: [gen('ABCB1', 'PHENOTYPE'), gen('CYP2C19', 'PHENOTYPE'), gen('CYP2D6', 'ACTIVITY_SCORE')],
    genresultater: [],
  }

  /** Syntetiske tabeller fra diplotype til resultat, i formen `les_cpic_diplotyper` gir. */
  const resultat = (id: string, symbol: string, navn: string, aktivitetsverdi = 'n/a') => ({
    id,
    gen: symbol,
    resultat: navn,
    aktivitetsverdi,
    ehr_prioritet: null,
    konsultasjonstekst: null,
  })
  const kombinasjon = (id: string, genresultat: string, funksjoner: [string, string], verdier: [string, string, string], diplotyper: string[]) => ({
    id,
    genresultat_id: genresultat,
    oppslagsnokkel: {},
    funksjon1: funksjoner[0],
    funksjon2: funksjoner[1],
    aktivitetsverdi1: verdier[0],
    aktivitetsverdi2: verdier[1],
    total_aktivitetsverdi: verdier[2],
    beskrivelse: null,
    diplotyper,
  })
  const allel = (navn: string, funksjon: string, aktivitetsverdi: string | null) => ({ navn, funksjon, klinisk_funksjon: funksjon, aktivitetsverdi })
  const DIPLOTYPER_CPIC: Record<string, Diplotypegrunnlag> = {
    CYP2D6: {
      kilde: UTVALG_CPIC.kilde,
      gen: { ...gen('CYP2D6', 'ACTIVITY_SCORE'), merknad_diplotyper: 'Syntetisk merknad om diplotypene.' },
      genresultater: [resultat('r1', 'CYP2D6', 'Intermediate Metabolizer', '1.0'), resultat('r2', 'CYP2D6', 'Ultrarapid Metabolizer', '3.0')],
      oppslag: [
        kombinasjon('o1', 'r1', ['Normal function', 'No function'], ['1.0', '0.0', '1.0'], ['*1/*4', '*2/*4']),
        kombinasjon('o2', 'r2', ['Increased function', 'Normal function'], ['2.0', '1.0', '3.0'], ['*1/*1x2']),
      ],
      alleler: [allel('*1', 'Normal function', '1.0'), allel('*2', 'Normal function', '1.0'), allel('*4', 'No function', '0.0'), allel('*1x2', 'Increased function', '2.0')],
    },
    CYP2C19: {
      kilde: UTVALG_CPIC.kilde,
      gen: gen('CYP2C19', 'PHENOTYPE'),
      genresultater: [resultat('r3', 'CYP2C19', 'Normal Metabolizer')],
      oppslag: [kombinasjon('o3', 'r3', ['Normal function', 'Normal function'], ['n/a', 'n/a', 'n/a'], ['*1/*1'])],
      alleler: [allel('*1', 'Normal function', null)],
    },
  }

  function cpicleser(utvalg: Cpicutvalg = UTVALG_CPIC): Cpicleser {
    return {
      les: vi.fn(async () => utvalg),
      diplotyper: vi.fn(async (symbol: string) => DIPLOTYPER_CPIC[symbol] ?? lesDiplotypegrunnlag(null)),
      hent: vi.fn(async () => ({ status: 'uendret' as const, release: 'v1.60.1' })),
    }
  }

  function medCpic(opp: Parameters<typeof kilde>[0] = {}, leser = cpicleser()) {
    return { ...pgxkilde(opp), cpic: leser }
  }

  it('viser CPICs anbefalinger for seg, over ClinPGx-dataene, med kilde og versjon', async () => {
    const user = userEvent.setup()
    const k = medCpic({ data: medPgx() })
    vis('amitriptylin', k)
    // Den lukkede seksjonen nevner anbefalingene fra CPIC.
    expect(await screen.findByText('CYP2D6 · CYP2C19 · CPIC + DPWG · 3 CPIC-anbefalinger · CYP-enzymer (substrat)')).toBeTruthy()
    expect(k.cpic.les).toHaveBeenCalledWith(['PA1'])
    await apneSkuff(user, 'Farmakogenetikk')
    const seksjon = screen.getByRole('region', { name: 'Farmakogenetikk' })
    const rekkefolge = [
      skuffen('CYP-enzymer (substrat)'),
      within(seksjon).getByRole('heading', { name: 'Anbefalinger fra CPIC' }),
      skuffen('Syntetisk CPIC-retningslinje'),
      skuffen('Andre gen–legemiddel-par i CPIC'),
      within(seksjon).getByRole('heading', { name: 'Retningslinjer' }),
      skuffen('CPIC · CYP2D6, CYP2C19'),
    ]
    for (let i = 1; i < rekkefolge.length; i += 1) {
      expect(rekkefolge[i - 1]!.compareDocumentPosition(rekkefolge[i]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    }
    expect(within(seksjon).getByText(/når pasientens farmakogenetiske resultat allerede er kjent\. De sier ikke hvem som bør testes\./)).toBeTruthy()
    expect(within(seksjon).getByText(/^Anbefalinger fra CPIC, release v1\.60\.1 av 12\. august 2026 · sist kontrollert/)).toBeTruthy()

    await user.click(skuffen('Syntetisk CPIC-retningslinje'))
    const kort = screen.getByText('Gen og resultattype').closest('.interaksjon') as HTMLElement
    expect(kort.textContent).toContain('CYP2D6: slås opp på aktivitetsverdi')
    expect(kort.textContent).toContain('CYP2C19: slås opp på fenotype')
    expect(kort.textContent).toContain('CYP2D6 – amitriptyline: CPIC-nivå A')
    // De to anbefalingene som bare skiller seg i aktivitetsverdien, står i én rad.
    const rader = within(kort).getAllByRole('listitem')
    expect(rader).toHaveLength(2)
    expect(within(rader[0]!).getByText('CYP2D6 Intermediate Metabolizer, aktivitetsverdi 0.5 eller 1.0')).toBeTruthy()
    expect(within(rader[0]!).getByText('Styrke: Strong')).toBeTruthy()
    expect(within(rader[0]!).getByText('Syntetisk anbefaling ved redusert aktivitet.')).toBeTruthy()
    // Hvorfor raden gjelder: implikasjonen og CPICs ID-er står under «Mer om anbefalingen».
    expect(within(rader[0]!).getByText('Mer om anbefalingen')).toBeTruthy()
    expect(within(rader[0]!).getByText('Syntetisk implikasjon for Intermediate Metabolizer.')).toBeTruthy()
    expect(within(rader[0]!).getByText('11, 12')).toBeTruthy()
    expect(within(kort).getByRole('link', { name: /Les retningslinjen/ }).getAttribute('href')).toBe('https://cpicpgx.org/guidelines/syntetisk')
    expect(within(kort).getByRole('link', { name: /Flytskjema fra CPIC/ }).getAttribute('href')).toBe('https://files.cpicpgx.org/syntetisk.jpg')

    // CPIC står som kilde i seksjonen, og publikasjonen ClinPGx også oppgir, står én gang.
    const liste = screen.getByRole('region', { name: 'Referanser' })
    expect(within(liste).getAllByText('Automatisk fra CPIC')).toHaveLength(1)
    expect(liste.textContent).toContain(
      'Utdrag av strukturerte farmakogenetiske anbefalinger fra CPIC, release v1.60.1 av 12. august 2026, omformet av OUSFAR, lisens CC0 1.0',
    )
    expect(within(liste).getByRole('link', { name: /Lisens: CC0 1\.0/ }).getAttribute('href')).toBe('https://creativecommons.org/publicdomain/zero/1.0/')
    expect(within(liste).getAllByText(/Syntetisk artikkel/)).toHaveLength(1)
    // Numrene følger leserekkefølgen: CPIC står over ClinPGx i seksjonen.
    const cpicNr = within(liste).getByText(/CPIC – Clinical Pharmacogenetics/).closest('li')!
    const clinpgxNr = within(liste).getByText(/ClinPGx – PharmGKB, CPIC og PharmCAT/).closest('li')!
    expect(cpicNr.compareDocumentPosition(clinpgxNr) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    await user.click(skuffen('Andre gen–legemiddel-par i CPIC'))
    const tabell = within(seksjon).getByRole('table')
    expect(within(tabell).getByText('ABCB1')).toBeTruthy()
    expect(within(tabell).getByText('D')).toBeTruthy()
  })

  it('slår opp CPICs anbefaling etter et kjent resultat, sier hvorfor, og lagrer ikke valgene', async () => {
    const user = userEvent.setup()
    const lagretFor = window.localStorage.length
    // CPICs resultatliste for CYP2D6: Intermediate Metabolizer er 0.5 eller 1.0 i disse syntetiske dataene.
    const genresultat = (id: string, resultat: string, aktivitetsverdi: string) => ({
      id,
      gen: 'CYP2D6',
      resultat,
      aktivitetsverdi,
      ehr_prioritet: null,
      konsultasjonstekst: null,
    })
    const utvalg: Cpicutvalg = {
      ...UTVALG_CPIC,
      genresultater: [
        genresultat('1', 'Intermediate Metabolizer', '0.5'),
        genresultat('2', 'Intermediate Metabolizer', '1.0'),
        genresultat('3', 'Poor Metabolizer', '0.0'),
      ],
    }
    vis('amitriptylin', medCpic({ data: medPgx() }, cpicleser(utvalg)))
    await screen.findByText(/3 CPIC-anbefalinger/)
    await apneSkuff(user, 'Farmakogenetikk')
    const seksjon = screen.getByRole('region', { name: 'Farmakogenetikk' })
    // Oppslaget står øverst i CPIC-gruppen.
    expect(
      skuffen('Slå opp anbefaling etter kjent resultat').compareDocumentPosition(skuffen('Syntetisk CPIC-retningslinje')) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    await user.click(skuffen('Slå opp anbefaling etter kjent resultat'))
    const kort = within(seksjon).getByLabelText('CYP2D6, resultat').closest('.interaksjon') as HTMLElement
    expect(within(kort).getByText(/allerede er kjent og fortolket/)).toBeTruthy()
    expect(within(kort).getByText('Velg resultatet for CYP2C19 og CYP2D6 for å se anbefalingen for amitriptyline.')).toBeTruthy()

    // Ett gen er ikke nok: det andre fylles ikke inn.
    await user.selectOptions(within(kort).getByLabelText('CYP2D6, resultat'), 'Intermediate Metabolizer')
    expect(within(kort).getByText(/Anbefalingene bygger også på CYP2C19\./)).toBeTruthy()
    expect(within(kort).queryByRole('region', { name: 'Anbefaling fra CPIC' })).toBeNull()

    await user.selectOptions(within(kort).getByLabelText('CYP2C19, resultat'), 'Normal Metabolizer')
    let treff = within(kort).getByRole('region', { name: 'Anbefaling fra CPIC' })
    expect(within(treff).getByText('Syntetisk anbefaling ved redusert aktivitet.')).toBeTruthy()
    expect(within(treff).getByText('Styrke: Strong')).toBeTruthy()
    expect(within(treff).getByText('Syntetisk implikasjon for Intermediate Metabolizer.')).toBeTruthy()
    expect(treff.textContent).toContain('Valgt: CYP2C19 Normal Metabolizer.')
    expect(treff.textContent).toContain('Valgt: CYP2D6 Intermediate Metabolizer. CPIC har samme anbefaling for aktivitetsverdi 0.5 og 1.0.')
    expect(treff.textContent).toContain('Anbefalinger 11, 12 i CPIC, retningslinjen «Syntetisk CPIC-retningslinje»')
    expect(treff.textContent).toContain('CPIC, release v1.60.1 av 12. august 2026. Gjelder bruk av et allerede kjent resultat, ikke hvem som bør testes.')
    expect(within(treff).getByRole('link', { name: /Les retningslinjen/ }).getAttribute('href')).toBe('https://cpicpgx.org/guidelines/syntetisk')

    // Med den eksakte aktivitetsverdien gjelder raden én anbefaling.
    await user.selectOptions(within(kort).getByLabelText('CYP2D6, aktivitetsverdi'), '0.5')
    treff = within(kort).getByRole('region', { name: 'Anbefaling fra CPIC' })
    expect(treff.textContent).toContain('Valgt: CYP2D6 Intermediate Metabolizer, aktivitetsverdi 0.5.')
    expect(treff.textContent).toContain('Anbefaling 12 i CPIC')

    // Valgene står verken i adressen eller i nettleseren.
    expect(window.location.hash).not.toMatch(/Metabolizer|0\.5/)
    expect(window.localStorage.length).toBe(lagretFor)

    await user.click(within(kort).getByRole('button', { name: 'Nullstill valgene' }))
    expect(within(kort).queryByRole('region', { name: 'Anbefaling fra CPIC' })).toBeNull()
    expect((within(kort).getByLabelText('CYP2D6, resultat') as HTMLSelectElement).value).toBe('')
  })

  it('oversetter en diplotype med CPICs tabell og viser oversettelsen før anbefalingen, uten å sende diplotypen', async () => {
    const user = userEvent.setup()
    const lagretFor = window.localStorage.length
    const k = medCpic({ data: medPgx() })
    vis('amitriptylin', k)
    await screen.findByText(/3 CPIC-anbefalinger/)
    await apneSkuff(user, 'Farmakogenetikk')
    const seksjon = screen.getByRole('region', { name: 'Farmakogenetikk' })
    await user.click(skuffen('Slå opp anbefaling etter kjent resultat'))
    const kort = within(seksjon).getByLabelText('CYP2D6, resultat').closest('.interaksjon') as HTMLElement
    // Tabellen hentes først når brukeren ber om den.
    expect(k.cpic.diplotyper).not.toHaveBeenCalled()
    const knapper = within(kort).getAllByRole('button', { name: 'Oversett fra diplotype' })
    expect(knapper).toHaveLength(2)

    await user.click(knapper[1]!)
    const felt = await within(kort).findByLabelText('CYP2D6, diplotype')
    expect(within(kort).getByText(/Søk i CPICs tabell \(3 diplotyper\)/)).toBeTruthy()
    expect(within(kort).getByText('CPICs merknad om diplotypene: Syntetisk merknad om diplotypene.')).toBeTruthy()
    // Rekkefølgen på allelene spiller ingen rolle, og hvert treff viser hva det blir.
    await user.type(felt, '4/1')
    const liste = within(kort).getByRole('list', { name: 'Diplotyper for CYP2D6 i CPIC' })
    expect(within(liste).getAllByRole('button').map((b) => b.textContent)).toEqual(['*1/*4'])
    expect(within(liste).getByText('Intermediate Metabolizer, aktivitetsverdi 1.0')).toBeTruthy()
    await user.keyboard('{Enter}')

    const oversettelse = within(kort).getByRole('region', { name: 'Oversettelsen av CYP2D6 *1/*4' })
    expect(oversettelse.textContent).toContain('*1: Normal function, aktivitetsverdi 1.0; *4: No function, aktivitetsverdi 0.0')
    expect(oversettelse.textContent).toContain('Normal function og No function (aktivitetsverdi 1.0 + 0.0 = 1.0)')
    expect(oversettelse.textContent).toContain('Intermediate Metabolizer, aktivitetsverdi 1.0')
    expect((within(kort).getByLabelText('CYP2D6, resultat') as HTMLSelectElement).value).toBe('Intermediate Metabolizer')
    expect((within(kort).getByLabelText('CYP2D6, aktivitetsverdi') as HTMLSelectElement).value).toBe('1.0')
    // Oversettelsen står før anbefalingen.
    expect(within(kort).getByText(/Anbefalingene bygger også på CYP2C19\./)).toBeTruthy()

    await user.click(within(kort).getByRole('button', { name: 'Oversett fra diplotype' }))
    await user.type(await within(kort).findByLabelText('CYP2C19, diplotype'), '*1/*1{Enter}')
    const treff = within(kort).getByRole('region', { name: 'Anbefaling fra CPIC' })
    expect(oversettelse.compareDocumentPosition(treff) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(treff.textContent).toContain('Valgt: CYP2D6 *1/*4, som CPICs tabell oversetter til Intermediate Metabolizer, aktivitetsverdi 1.0.')
    expect(treff.textContent).toContain('Valgt: CYP2C19 *1/*1, som CPICs tabell oversetter til Normal Metabolizer.')
    expect(treff.textContent).toContain('Anbefaling 11 i CPIC')

    // Bare gensymbolet gikk til databasen; diplotypen står verken i adressen eller i nettleseren.
    expect(vi.mocked(k.cpic.diplotyper).mock.calls).toEqual([['CYP2D6'], ['CYP2C19']])
    expect(window.location.hash).not.toMatch(/\*1|%2A1/)
    expect(window.localStorage.length).toBe(lagretFor)

    // Et resultat valgt for hånd erstatter diplotypen.
    await user.selectOptions(within(kort).getByLabelText('CYP2D6, resultat'), 'Poor Metabolizer')
    expect(within(kort).queryByRole('region', { name: 'Oversettelsen av CYP2D6 *1/*4' })).toBeNull()
    expect(kort.querySelector('.cpic-oppslag__svar')!.textContent).not.toContain('*1/*4')
  })

  it('sier fra når CPIC ikke har diplotypen, eller ingen anbefaling for resultatet den gir', async () => {
    const user = userEvent.setup()
    vis('amitriptylin', medCpic({ data: medPgx() }))
    await screen.findByText(/3 CPIC-anbefalinger/)
    await apneSkuff(user, 'Farmakogenetikk')
    const seksjon = screen.getByRole('region', { name: 'Farmakogenetikk' })
    await user.click(skuffen('Slå opp anbefaling etter kjent resultat'))
    const kort = within(seksjon).getByLabelText('CYP2D6, resultat').closest('.interaksjon') as HTMLElement
    await user.click(within(kort).getAllByRole('button', { name: 'Oversett fra diplotype' })[1]!)
    const felt = await within(kort).findByLabelText('CYP2D6, diplotype')

    // En skrivemåte CPIC ikke har, oversettes ikke, og Enter velger ingenting.
    await user.type(felt, '*1/*1xN{Enter}')
    expect(within(kort).getByText(/CPIC har ingen diplotype for CYP2D6 som passer «\*1\/\*1xN»\. Den oversettes ikke/)).toBeTruthy()
    expect((within(kort).getByLabelText('CYP2D6, resultat') as HTMLSelectElement).value).toBe('')

    // Ultrarapid Metabolizer har ingen anbefaling for legemiddelet her: oversettelsen vises, men ingenting velges.
    await user.clear(felt)
    await user.type(felt, '*1/*1x2')
    await user.click(within(kort).getByRole('button', { name: '*1/*1x2' }))
    const oversettelse = within(kort).getByRole('region', { name: 'Oversettelsen av CYP2D6 *1/*1x2' })
    expect(oversettelse.textContent).toContain('Ultrarapid Metabolizer, aktivitetsverdi 3.0')
    expect(oversettelse.textContent).toContain(
      'CPIC har ingen anbefaling for amitriptyline ved CYP2D6 Ultrarapid Metabolizer med aktivitetsverdi 3.0. OUSFAR viser ingen anbefaling for det.',
    )
    expect((within(kort).getByLabelText('CYP2D6, resultat') as HTMLSelectElement).value).toBe('')

    await user.click(within(kort).getByRole('button', { name: 'Fjern diplotypen' }))
    expect(within(kort).queryByRole('region', { name: /Oversettelsen av/ })).toBeNull()
    expect(within(kort).getAllByRole('button', { name: 'Oversett fra diplotype' })).toHaveLength(2)
  })

  it('sier fra når CPIC ikke har legemiddelet, når dataene ikke er hentet, og når lesingen feiler', async () => {
    const tom = { ...UTVALG_CPIC, legemidler: [], par: [], retningslinjer: [], anbefalinger: [], gener: [] }
    vis('amitriptylin', medCpic({ data: medPgx({ redaksjonelt: false }) }, cpicleser(tom)))
    expect(await screen.findByText('CPIC har ingen gen–legemiddel-par eller anbefalinger for amitriptyline (CPIC, release v1.60.1 av 12. august 2026).')).toBeTruthy()
    cleanup()

    vis('amitriptylin', medCpic({ data: medPgx({ redaksjonelt: false }) }, cpicleser({ ...tom, kilde: { ...tom.kilde, endret_kl: null, kontrollert_kl: null } })))
    expect(await screen.findByText('Anbefalingene fra CPIC er ikke hentet ennå. Den ukentlige oppdateringen henter dem.')).toBeTruthy()
    cleanup()

    const feil = cpicleser()
    feil.les = vi.fn(async () => {
      throw new Error('Nettverksfeil')
    })
    vis('amitriptylin', medCpic({ data: medPgx() }, feil))
    expect(await screen.findByText(/Fikk ikke hentet anbefalingene fra CPIC\. Nettverksfeil/)).toBeTruthy()
    // ClinPGx-dataene står der fortsatt.
    expect(await screen.findByText(/CPIC \+ DPWG/)).toBeTruthy()
  })

  it('finner CPICs resultatkategorier i søket på siden, og åpner kortet', async () => {
    const user = userEvent.setup()
    vis('amitriptylin', medCpic({ data: medPgx() }))
    await screen.findByText(/3 CPIC-anbefalinger/)
    await user.type(screen.getByRole('searchbox', { name: 'Søk på denne siden' }), 'Poor Metabolizer')
    const steder = within(await screen.findByRole('list', { name: 'Hvor treffene står' }))
    await user.click(steder.getAllByRole('button', { name: /Farmakogenetikk › Syntetisk CPIC-retningslinje/ })[0]!)
    expect(skuffen('Farmakogenetikk').getAttribute('aria-expanded')).toBe('true')
    expect(skuffen('Syntetisk CPIC-retningslinje').getAttribute('aria-expanded')).toBe('true')
  })

  it('deler et langt CPIC-kort etter gen-resultat, og åpner delen søket på siden har treff i', async () => {
    const user = userEvent.setup()
    const fenotyper = ['Poor Metabolizer', 'Normal Metabolizer', 'Ultrarapid Metabolizer']
    const mange = Array.from({ length: 13 }, (_, i) =>
      anbefaling(`2${i}`, [fenotyper[i % 3]!, `${i}.0`], i === 7 ? 'Syntetisk sjelden anbefaling.' : `Syntetisk anbefaling nummer ${i}.`),
    )
    vis('amitriptylin', medCpic({ data: medPgx() }, cpicleser({ ...UTVALG_CPIC, anbefalinger: mange })))
    await screen.findByText(/13 CPIC-anbefalinger/)
    await apneSkuff(user, 'Farmakogenetikk')
    await user.click(skuffen('Syntetisk CPIC-retningslinje'))
    const del = (tittel: string) => screen.getByText(tittel, { selector: '.cpic__deltittel' }).closest('details') as HTMLDetailsElement
    expect(del('CYP2D6 Poor Metabolizer').open).toBe(false)
    expect(del('CYP2D6 Normal Metabolizer').open).toBe(false)
    await user.type(screen.getByRole('searchbox', { name: 'Søk på denne siden' }), 'sjelden')
    await waitFor(() => expect(del('CYP2D6 Normal Metabolizer').open).toBe(true))
    expect(del('CYP2D6 Poor Metabolizer').open).toBe(false)
  })

  it('åpner delene i et langt CPIC-kort adressen peker på, så et treff fra fagsøket ikke står skjult', async () => {
    const user = userEvent.setup()
    const fenotyper = ['Poor Metabolizer', 'Normal Metabolizer', 'Ultrarapid Metabolizer']
    const mange = Array.from({ length: 13 }, (_, i) => anbefaling(`2${i}`, [fenotyper[i % 3]!, `${i}.0`], `Syntetisk anbefaling nummer ${i}.`))
    vis('amitriptylin', medCpic({ data: medPgx() }, cpicleser({ ...UTVALG_CPIC, anbefalinger: mange })), { sted: ['farmakogenetikk', 'cpic-900'] })
    const del = (tittel: string) => screen.getByText(tittel, { selector: '.cpic__deltittel' }).closest('details') as HTMLDetailsElement
    await waitFor(() => expect(del('CYP2D6 Poor Metabolizer').open).toBe(true))
    for (const f of fenotyper) expect(del(`CYP2D6 ${f}`).open).toBe(true)
    // Brukeren kan lukke dem igjen.
    await user.click(screen.getByText('CYP2D6 Poor Metabolizer', { selector: '.cpic__deltittel' }))
    await waitFor(() => expect(del('CYP2D6 Poor Metabolizer').open).toBe(false))
  })

  it('åpner CPIC-kortet adressen peker på', async () => {
    vis('amitriptylin', medCpic({ data: medPgx() }), { sted: ['farmakogenetikk', 'cpic-900'] })
    await waitFor(() => expect(skuffen('Syntetisk CPIC-retningslinje').getAttribute('aria-expanded')).toBe('true'))
    expect(skuffen('Farmakogenetikk').getAttribute('aria-expanded')).toBe('true')
  })

  it('lar administratoren hente CPIC-dataene på nytt i redigeringen', async () => {
    const user = userEvent.setup()
    const k = medCpic({ kanRedigere: true, data: medPgx() })
    vis('amitriptylin', k)
    await screen.findByText(/3 CPIC-anbefalinger/)
    await user.click(screen.getByRole('button', { name: 'Rediger' }))
    await apneSkuff(user, 'Farmakogenetikk')
    await user.click(await screen.findByRole('button', { name: 'Hent fra CPIC nå' }))
    expect(await screen.findByText('CPIC-dataene er kontrollert og uendret.')).toBeTruthy()
    expect(k.cpic.hent).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(k.cpic.les).toHaveBeenCalledTimes(2))
  })

  it('henter tabellen fra diplotype på nytt og oversetter igjen når administratoren har hentet fra CPIC', async () => {
    const user = userEvent.setup()
    const leser = cpicleser()
    let hentet = false
    leser.les = vi.fn(async () => (hentet ? { ...UTVALG_CPIC, kilde: { ...UTVALG_CPIC.kilde, kontrollert_kl: new Date().toISOString() } } : UTVALG_CPIC))
    // Syntetisk: etter hentingen står *1/*4 under Poor Metabolizer i CPICs tabell.
    const endret: Diplotypegrunnlag = {
      ...DIPLOTYPER_CPIC.CYP2D6!,
      genresultater: [resultat('r9', 'CYP2D6', 'Poor Metabolizer', '0.0')],
      oppslag: [kombinasjon('o9', 'r9', ['No function', 'No function'], ['0.0', '0.0', '0.0'], ['*1/*4'])],
    }
    leser.diplotyper = vi.fn(async (symbol: string) => (hentet && symbol === 'CYP2D6' ? endret : DIPLOTYPER_CPIC[symbol]!))
    leser.hent = vi.fn(async () => {
      hentet = true
      return { status: 'fullfort' as const, release: 'v1.60.1' }
    })
    vis('amitriptylin', medCpic({ kanRedigere: true, data: medPgx() }, leser))
    await screen.findByText(/3 CPIC-anbefalinger/)
    await apneSkuff(user, 'Farmakogenetikk')
    const seksjon = screen.getByRole('region', { name: 'Farmakogenetikk' })
    await user.click(skuffen('Slå opp anbefaling etter kjent resultat'))
    const kort = within(seksjon).getByLabelText('CYP2D6, resultat').closest('.interaksjon') as HTMLElement
    await user.click(within(kort).getAllByRole('button', { name: 'Oversett fra diplotype' })[1]!)
    await user.type(await within(kort).findByLabelText('CYP2D6, diplotype'), '*1/*4{Enter}')
    expect((within(kort).getByLabelText('CYP2D6, resultat') as HTMLSelectElement).value).toBe('Intermediate Metabolizer')

    await user.click(screen.getByRole('button', { name: 'Rediger' }))
    await user.click(await screen.findByRole('button', { name: 'Hent fra CPIC nå' }))
    await waitFor(() => expect(leser.diplotyper).toHaveBeenCalledTimes(2))
    const nytt = screen.getByLabelText('CYP2D6, resultat').closest('.interaksjon') as HTMLElement
    await waitFor(() => expect((within(nytt).getByLabelText('CYP2D6, resultat') as HTMLSelectElement).value).toBe('Poor Metabolizer'))
    expect(within(nytt).getByRole('region', { name: 'Oversettelsen av CYP2D6 *1/*4' }).textContent).toContain('Poor Metabolizer, aktivitetsverdi 0.0')
  })
})

describe('bivirkningene fra preparatomtalene', () => {
  /** Syntetiske bivirkninger i formen `les_bivirkninger` gir. Ingen av dem er fra en preparatomtale. */
  function rad(organsystem: Bivirkning['organsystem'], frekvens: Bivirkning['frekvens'], tekst: string, ekstra: Partial<Bivirkning> = {}): Bivirkning {
    return { kilde: 'k1', kontekst: null, organsystem, frekvens, tekst, fotnote: null, posisjon: 0, ...ekstra }
  }
  const MANGE = Array.from({ length: 10 }, (_, i) => rad('nevrologiske', 'vanlige', `Syntetisk nevrologisk bivirkning ${i + 1}`, { posisjon: i }))
  const DATA: Bivirkningsdata = {
    kilder: [
      {
        id: 'k1',
        nokkel: 'syntetisk-spc',
        type: 'spc',
        tittel: 'Syntetisk preparatomtale',
        preparat: 'Syntetisk preparat',
        innehaver: 'Syntetisk innehaver',
        spc_versjon: '1',
        revisjonsdato: '2026-01-31',
        lenke: 'https://example.org/syntetisk',
        kontrollert: '2026-02-01',
        kontrollert_av: 'Syntetisk kontrollør',
        merknad: null,
        importert_kl: '2026-02-02T10:00:00Z',
        importert_av: 'Syntetisk importør',
        kontekster: [],
      },
    ],
    bivirkninger: [
      ...MANGE,
      rad('nevrologiske', 'sjeldne', 'Syntetisk sjelden bivirkning'),
      rad('hud', 'vanlige', 'Syntetisk hudbivirkning', { fotnote: 'Syntetisk fotnote' }),
      rad('gastrointestinale', 'ikke_kjent', 'Syntetisk bivirkning med ukjent frekvens'),
    ],
  }

  function bivirkningskilde(data: Bivirkningsdata | Error = DATA) {
    const leser: Bivirkningsleser = { les: vi.fn(async () => (data instanceof Error ? Promise.reject(data) : data)) }
    return { ...kilde(), bivirkninger: leser }
  }

  /** Overskriftene på gruppene i seksjonen, i rekkefølge. */
  function gruppene(): string[] {
    const seksjon = screen.getByRole('region', { name: 'Bivirkninger' })
    return [...seksjon.querySelectorAll('.overskriftskort > .skuff__hode .skuff__tittelTekst')].map((t) => t.textContent ?? '')
  }

  /** Overskriftene på kortene i en gruppe, i rekkefølge. */
  function kortene(gruppe: string): string[] {
    const kort = skuffen(gruppe).closest('.overskriftskort')!
    return [...kort.querySelectorAll('.underkortrutenett .skuff__tittelTekst')].map((t) => t.textContent ?? '')
  }

  const visning = () => screen.getByRole('slider', { name: 'Vis bivirkningene etter' })

  it('viser ikke seksjonen når siden ikke har bivirkninger, og leser dem etter stoffets nøkkel', async () => {
    const k = bivirkningskilde({ kilder: [], bivirkninger: [] })
    vis('amitriptylin', k)
    await finnVerdi('10–20 nmol/L')
    expect(k.bivirkninger.les).toHaveBeenCalledWith('amitriptylin')
    expect(screen.queryByRole('region', { name: 'Bivirkninger' })).toBeNull()
  })

  it('grupperer etter frekvens fra den høyeste, med bryteren øverst og bare gruppene som har noe', async () => {
    const user = userEvent.setup()
    vis('amitriptylin', bivirkningskilde())
    // Den lukkede seksjonen oppsummerer det samme i begge visningene.
    expect(await screen.findByText('13 bivirkninger · 3 organsystemer')).toBeTruthy()
    await apneSkuff(user, 'Bivirkninger')
    const seksjon = screen.getByRole('region', { name: 'Bivirkninger' })
    expect(visning().getAttribute('aria-valuetext')).toBe('Frekvens')
    expect(visning().compareDocumentPosition(skuffen('Vanlige')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(gruppene()).toEqual(['Vanlige', 'Sjeldne', 'Ikke kjent'])
    // Hver frekvens står med ikonet og det den betyr.
    const vanlige = skuffen('Vanlige').closest('.overskriftskort')!
    expect(vanlige.querySelector('.overskriftskort__ikon')).toBeTruthy()
    expect(within(vanlige as HTMLElement).getByText('≥ 1/100 til < 1/10')).toBeTruthy()
    expect(within(seksjon).queryByText('Svært vanlige')).toBeNull()
    expect(within(seksjon).queryByText('Mindre vanlige')).toBeNull()
    // Med én tabell står ingen tabellnavn over gruppene.
    expect(seksjon.querySelector('.bivirkninger__tabell')).toBeNull()

    await user.click(skuffen('Vanlige'))
    expect(kortene('Vanlige')).toEqual(['Nevrologiske sykdommer', 'Hud- og underhudssykdommer'])
    // Organsystemene har hvert sitt ikon.
    expect(vanlige.querySelectorAll('.underkortrutenett .skuff__ikon')).toHaveLength(2)
  })

  it('har ett åpent kort per nivå, også blant organsystemene i en frekvens', async () => {
    const user = userEvent.setup()
    vis('amitriptylin', bivirkningskilde())
    await apneSkuff(user, 'Bivirkninger')
    await user.click(skuffen('Vanlige'))
    await user.click(skuffen('Sjeldne'))
    expect(skuffen('Vanlige').getAttribute('aria-expanded')).toBe('false')
    expect(skuffen('Sjeldne').getAttribute('aria-expanded')).toBe('true')

    await user.click(skuffen('Vanlige'))
    const nevro = within(skuffen('Vanlige').closest('.overskriftskort') as HTMLElement)
    const [nevrologiske, hud] = nevro.getAllByRole('button', { name: /sykdommer$/ })
    await user.click(nevrologiske!)
    expect(nevrologiske!.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText('Syntetisk nevrologisk bivirkning 10')).toBeTruthy()
    await user.click(hud!)
    expect(nevrologiske!.getAttribute('aria-expanded')).toBe('false')
    expect(hud!.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText('Syntetisk fotnote')).toBeTruthy()
  })

  it('kan åpne hvert kombinasjonskort, med oppsummeringen lukket og punktlista åpen', async () => {
    const user = userEvent.setup()
    vis('amitriptylin', bivirkningskilde())
    await apneSkuff(user, 'Bivirkninger')
    const seksjon = screen.getByRole('region', { name: 'Bivirkninger' })
    for (const gruppe of ['Vanlige', 'Sjeldne', 'Ikke kjent']) {
      await user.click(skuffen(gruppe))
      expect(seksjon.querySelector('.underkortrutenett .skuff--fast')).toBeNull()
    }
    // Også et kort med én kort bivirkning og ingen fotnote åpnes og lukkes.
    const ukjent = within(skuffen('Ikke kjent').closest('.overskriftskort') as HTMLElement).getByRole('button', { name: /Gastrointestinale sykdommer/ })
    expect(ukjent.getAttribute('aria-expanded')).toBe('true')
    const kortet = ukjent.closest('.skuff') as HTMLElement
    expect(within(kortet).getByRole('listitem').textContent).toBe('Syntetisk bivirkning med ukjent frekvens')
    await user.click(ukjent)
    expect(ukjent.getAttribute('aria-expanded')).toBe('false')
    expect(kortet.querySelector('.skuff__oppsummering')?.textContent).toContain('Syntetisk bivirkning med ukjent frekvens')
  })

  it('holder tabellene i en preparatomtale hver for seg, med navnet og frekvensgrunnlaget over', async () => {
    const user = userEvent.setup()
    const tabell = (nokkel: string, frekvensgrunnlag: string) => ({ nokkel, navn: 'Syntetisk indikasjon', frekvensgrunnlag, merknad: null })
    const data: Bivirkningsdata = {
      kilder: [{ ...DATA.kilder[0]!, kontekster: [tabell('per-pasient', 'per pasient'), tabell('per-infusjon', 'per infusjon')] }],
      bivirkninger: [
        rad('generelle', 'vanlige', 'Syntetisk feber', { kontekst: 'per-pasient' }),
        rad('generelle', 'mindre_vanlige', 'Syntetisk feber', { kontekst: 'per-infusjon' }),
      ],
    }
    vis('amitriptylin', bivirkningskilde(data))
    expect(await screen.findByText('2 bivirkninger · 1 organsystem · 2 tabeller')).toBeTruthy()
    await apneSkuff(user, 'Bivirkninger')
    const tabellene = within(screen.getByRole('region', { name: 'Bivirkninger' })).getAllByRole('group', { name: 'Syntetisk indikasjon' })
    expect(tabellene.map((t) => t.querySelector('.bivirkninger__tabellinfo')?.textContent)).toEqual([
      'Frekvensgrunnlag: per pasient',
      'Frekvensgrunnlag: per infusjon',
    ])
    // Den samme bivirkningen står i hver sin tabell, med hver sin frekvens; den blandes ikke.
    const overskrifter = (t: HTMLElement) => [...t.querySelectorAll('.overskriftskort > .skuff__hode .skuff__tittelTekst')].map((x) => x.textContent)
    expect(tabellene.map(overskrifter)).toEqual([['Vanlige'], ['Mindre vanlige']])
    fireEvent.change(visning(), { target: { value: '1' } })
    expect(tabellene.map(overskrifter)).toEqual([
      ['Generelle lidelser og reaksjoner på administrasjonsstedet'],
      ['Generelle lidelser og reaksjoner på administrasjonsstedet'],
    ])
  })

  it('åpner kortet en lenke peker på i en av flere tabeller', async () => {
    const data: Bivirkningsdata = {
      kilder: [{ ...DATA.kilder[0]!, kontekster: [{ nokkel: 'voksne', navn: 'Syntetisk: voksne', frekvensgrunnlag: null, merknad: null }] }],
      bivirkninger: [rad('hud', 'vanlige', 'Syntetisk A'), rad('hud', 'sjeldne', 'Syntetisk B', { kontekst: 'voksne' })],
    }
    vis('amitriptylin', bivirkningskilde(data), { sted: ['bivirkninger', 'tabell-syntetisk-spc_voksne--organsystem-hud'] })
    const gruppe = await screen.findByRole('group', { name: 'Syntetisk: voksne' })
    await waitFor(() => expect(within(gruppe).getByRole('button', { name: /Hud- og underhudssykdommer/ }).getAttribute('aria-expanded')).toBe('true'))
    expect(visning().getAttribute('aria-valuetext')).toBe('Organsystem')
  })

  it('snur grupperingen med bryteren, med de samme bivirkningene', async () => {
    const user = userEvent.setup()
    vis('amitriptylin', bivirkningskilde())
    await apneSkuff(user, 'Bivirkninger')
    const fraFrekvens = [...screen.getByRole('region', { name: 'Bivirkninger' }).querySelectorAll('.bivirkninger__liste > li')].map((li) => li.textContent).sort()
    fireEvent.change(visning(), { target: { value: '1' } })
    expect(visning().getAttribute('aria-valuetext')).toBe('Organsystem')
    expect(gruppene()).toEqual(['Nevrologiske sykdommer', 'Gastrointestinale sykdommer', 'Hud- og underhudssykdommer'])
    await user.click(skuffen('Nevrologiske sykdommer'))
    expect(kortene('Nevrologiske sykdommer')).toEqual(['Vanlige', 'Sjeldne'])
    // Frekvensen står med navnet og definisjonen også inne i et organsystem.
    expect(within(skuffen('Nevrologiske sykdommer').closest('.overskriftskort') as HTMLElement).getByText('< 1/1 000', { exact: false })).toBeTruthy()
    const fraOrgansystem = [...screen.getByRole('region', { name: 'Bivirkninger' }).querySelectorAll('.bivirkninger__liste > li')].map((li) => li.textContent).sort()
    expect(fraOrgansystem).toEqual(fraFrekvens)
    expect(fraOrgansystem).toHaveLength(13)
  })

  it('åpner visningen en lenke peker på', async () => {
    vis('amitriptylin', bivirkningskilde(), { sted: ['bivirkninger', 'organsystem-hud'] })
    await waitFor(() => expect(skuffen('Hud- og underhudssykdommer').getAttribute('aria-expanded')).toBe('true'))
    expect(visning().getAttribute('aria-valuetext')).toBe('Organsystem')
  })

  it('har preparatomtalen i seksjonens referansefelt, med versjonen og importen', async () => {
    const user = userEvent.setup()
    vis('amitriptylin', bivirkningskilde())
    await apneSkuff(user, 'Bivirkninger')
    const liste = screen.getByRole('region', { name: 'Referanser' })
    expect(within(liste).getByText('Automatisk fra Preparatomtale (SPC)')).toBeTruthy()
    expect(liste.textContent).toContain('Syntetisk preparatomtale')
    expect(liste.textContent).toMatch(/versjon 1, revidert .+, importert .+ av Syntetisk importør, kontrollert .+ av Syntetisk kontrollør/)
  })

  it('finner en bivirkning med søket på siden og viser hvor den står', async () => {
    const user = userEvent.setup()
    vis('amitriptylin', bivirkningskilde())
    await screen.findByText('13 bivirkninger · 3 organsystemer')
    await user.type(screen.getByRole('searchbox', { name: 'Søk på denne siden' }), 'ukjent frekvens')
    await waitFor(() =>
      expect(within(screen.getByRole('list', { name: 'Hvor treffene står' })).getByRole('button').textContent).toBe(
        'Bivirkninger › Gastrointestinale sykdommer',
      ),
    )
  })

  it('passer på smale og brede flater: rutenett som bryter, lange navn som brytes, og definisjonen på egen linje når det er trangt', () => {
    const seksjoner = readFileSync('src/styles/seksjoner.css', 'utf8')
    const bivirkninger = readFileSync('src/styles/bivirkninger.css', 'utf8')
    // Underkortene står i det samme rutenettet som detaljkortene: så mange kolonner som får plass, én på en smal flate.
    expect(seksjoner).toMatch(/\.skuffrutenett\s*\{[^}]*repeat\(auto-fill, minmax\(min\(100%/)
    expect(seksjoner).toMatch(/\.overskriftskort > \.skuff__hode \.skuff__tittelTekst\s*\{[^}]*overflow-wrap:\s*anywhere/)
    expect(bivirkninger).toMatch(/\.bivirkninger__liste\s*\{[^}]*overflow-wrap:\s*anywhere/)
    expect(bivirkninger).toMatch(/@media \(max-width: 47\.5em\)\s*\{\s*\.overskriftskort > \.skuff__hode \.bivirkninger__definisjon\s*\{\s*flex-basis:\s*100%/)
  })

  it('sier fra når bivirkningene ikke kunne hentes, i redigeringen', async () => {
    const user = userEvent.setup()
    vis('amitriptylin', { ...bivirkningskilde(new Error('Syntetisk feil')), kanRedigere: true })
    await finnVerdi('10–20 nmol/L')
    await user.click(screen.getByRole('button', { name: 'Rediger' }))
    await apneSkuff(user, 'Bivirkninger')
    expect(await screen.findByText(/Fikk ikke hentet bivirkningene\. Syntetisk feil/)).toBeTruthy()
  })
})

describe('kjemiske grunndata', () => {
  const pubchemdata = (cid: number, tittel: string, formel: string, molvekt: string, inchikey: string) => ({
    cid,
    data: { cid, tittel, formel, molvekt, inchikey, iupac: null, monoisotopisk_masse: null, ladning: 0, enheter: 1, stereo: {} },
    sist_hentet_kl: '2026-10-08T03:15:00Z',
  })

  function kjemikilde(forbindelser: ReturnType<typeof pubchemdata>[]) {
    const les = vi.fn(async () => lesKjemiutvalg({ kilde: 'PubChem', forbindelser }))
    return { ...kilde(), kjemi: { les } }
  }

  it('viser stoffet og metabolitten med formel, molekylvekt og lenke til PubChem', async () => {
    const user = userEvent.setup()
    const k = kjemikilde([
      pubchemdata(2160, 'Amitriptyline', 'C20H23N', '277.4', 'KRMDCWKBEZIMAB-UHFFFAOYSA-N'),
      pubchemdata(4543, 'Nortriptyline', 'C19H21N', '263.4', 'PHVGLTMQBUFIQQ-UHFFFAOYSA-N'),
    ])
    vis('amitriptylin', k)
    expect(await screen.findByText('Amitriptylin 277,4 g/mol · Nortriptylin 263,4 g/mol')).toBeTruthy()
    expect(k.kjemi.les).toHaveBeenCalledWith(['2160', '4543'])
    await apneSkuff(user, 'Kjemiske grunndata')
    const seksjon = screen.getByRole('region', { name: 'Kjemiske grunndata' })
    const rader = within(seksjon).getAllByRole('row').slice(1)
    expect(rader.map((r) => within(r).getByRole('rowheader').textContent)).toEqual(['Amitriptylin', 'NortriptylinMetabolitt'])
    expect(within(rader[1]!).getByText('263,4 g/mol')).toBeTruthy()
    const lenke = within(rader[1]!).getByRole('link', { name: /CID 4543/ })
    expect(lenke.getAttribute('href')).toBe('https://pubchem.ncbi.nlm.nih.gov/compound/4543')
    // Formelen med tallene senket.
    expect(rader[0]!.querySelectorAll('sub')).toHaveLength(2)
    expect(within(seksjon).getByText('PubChem')).toBeTruthy()
  })

  it('viser forbindelsene også før dataene er hentet', async () => {
    const user = userEvent.setup()
    vis('amitriptylin', kjemikilde([]))
    await apneSkuff(user, 'Kjemiske grunndata')
    const seksjon = screen.getByRole('region', { name: 'Kjemiske grunndata' })
    expect(within(seksjon).getAllByText('Hentes fra PubChem ved neste oppdatering.')).toHaveLength(2)
  })
})

describe('analyse ved norske laboratorier', () => {
  /** Det `les_laboratorieanalyser` gir for komponentene, bygd av utdraget fra portalen. */
  function labutvalg(komponenter: readonly string[]) {
    const filer: Record<string, string> = {
      enhet: 'units',
      provemateriale: 'sampletypes',
      institusjon: 'institutions',
      laboratorium: 'labs',
      komponent: 'components',
      analyse: 'analyses',
    }
    const enheter = new Map<string, string>()
    const lest: Record<string, { id: string; data: object }[]> = {}
    for (const e of ENTITETER) {
      const rader = JSON.parse(readFileSync(`src/__tests__/data/farmakologiportalen/${filer[e.navn]}.json`, 'utf8')) as unknown[]
      lest[e.navn] = lesListe(e, rader, enheter).rader
      if (e.navn === 'enhet') for (const r of lest.enhet!) enheter.set(r.id, (r.data as { navn: string }).navn)
    }
    const valgte = lest.komponent!.filter((k) => komponenter.includes(k.id) || (k.data as { gruppe: string[] }).gruppe.some((g) => komponenter.includes(g)))
    const ider = new Set(valgte.map((k) => k.id))
    return lesLabutvalg({
      kilde: { kontrollert_kl: '2026-10-08T04:40:00Z', endret_kl: '2026-10-08T04:40:00Z' },
      komponenter: valgte,
      analyser: lest.analyse!.filter((a) => ider.has((a.data as { komponent_id: string }).komponent_id)),
      laboratorier: lest.laboratorium,
      institusjoner: lest.institusjon,
    })
  }

  const pubchem = (cid: number, molvekt: string, inchikey: string) => ({
    cid,
    data: { cid, tittel: '', formel: 'C', molvekt, inchikey, iupac: null, monoisotopisk_masse: null, ladning: 0, enheter: 1, stereo: {} },
    sist_hentet_kl: '2026-10-08T03:15:00Z',
  })

  function labkilde() {
    const laboratorier = { les: vi.fn(async (ider: readonly string[]) => labutvalg(ider)) }
    const kjemi = {
      les: vi.fn(async () =>
        lesKjemiutvalg({
          kilde: 'PubChem',
          forbindelser: [pubchem(444, '239.74', 'SNPPWIUOZRMYNY-UHFFFAOYSA-N'), pubchem(446, '255.74', 'AKOAEVOSDHIVFX-UHFFFAOYSA-N')],
        }),
      ),
    }
    const data = enkelSide({ id: 'bup', slug: 'bupropion', navn: 'Bupropion' }, { nedre: 1000, ovre: 2000, enhet: 'nmol/L' })
    return { ...kilde({ data }), laboratorier, kjemi }
  }

  const enhet = () => screen.getByRole('slider', { name: 'Vis måleområdene i' })

  it('viser én tabell per matrise med laboratorium, metode og måleområde, og bytter enhet', async () => {
    const user = userEvent.setup()
    const k = labkilde()
    vis('bupropion', k)
    await apneSkuff(user, 'Analyse ved norske laboratorier')
    expect(k.laboratorier.les).toHaveBeenCalledWith(['529', '794'])
    const seksjon = screen.getByRole('region', { name: 'Analyse ved norske laboratorier' })
    const tabeller = within(seksjon).getAllByRole('table')
    expect(tabeller.map((t) => t.getAttribute('aria-labelledby') && document.getElementById(t.getAttribute('aria-labelledby')!)?.textContent)).toEqual([
      'Serum',
      'Fullblod',
    ])
    const [serum] = tabeller
    expect(within(serum!).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Analytt', 'Laboratorium', 'Metode', 'Måleområde (µg/L)', 'Benevning'])
    const haukeland = within(serum!).getAllByRole('row').find((r) => r.textContent?.includes('Haukeland'))!
    expect(haukeland.textContent).toContain('Hydroksybupropion')
    expect(haukeland.textContent).toContain('LC-MS/MS')
    expect(haukeland.textContent).toContain('73—2000')
    expect(within(haukeland).getByRole('link', { name: /73—2000/ }).getAttribute('href')).toBe('https://farmakologiportalen.no/analysis/?id=10147')
    expect(within(haukeland).getByRole('link', { name: /Haukeland/ }).getAttribute('href')).toMatch(/^https:\/\/farmakologiportalen\.no\/lab\/\?id=\d+$/)

    fireEvent.change(enhet(), { target: { value: '1' } })
    expect(enhet().getAttribute('aria-valuetext')).toBe('nmol/L')
    expect(within(serum!).getAllByRole('columnheader').map((h) => h.textContent)).toContain('Måleområde (nmol/L)')
    expect(haukeland.textContent).toContain('280—8000')
    // Portalen står som kilde i referansefeltet, med når dataene sist ble kontrollert.
    expect(within(seksjon).getByText('Laboratorieanalyser fra Farmakologiportalen, sist kontrollert 8. oktober 2026')).toBeTruthy()
    expect(within(seksjon).getByRole('button', { name: 'Referanse 1' })).toBeTruthy()
  })

  it('viser ikke seksjonen når portalen ikke har noe for stoffet', async () => {
    const k = { ...kilde(), laboratorier: { les: vi.fn(async () => lesLabutvalg({})) } }
    vis('amitriptylin', k)
    await finnVerdi('10–20 nmol/L')
    await waitFor(() => expect(k.laboratorier.les).toHaveBeenCalled())
    expect(skuffen('Kjemiske grunndata')).toBeTruthy()
    expect(() => skuffen('Analyse ved norske laboratorier')).toThrow()
  })
})
