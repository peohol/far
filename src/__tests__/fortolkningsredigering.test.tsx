// @vitest-environment jsdom
/**
 * Redigeringen av reglene og kommentarene en fortolkning gir, på
 * fortolkningssiden (`#/fortolkning/<nøkkel>/rediger`), prøvd i en nettleser i
 * minnet: reglene slik de står i utkastet, simulatoren, redigeringen av
 * konsentrasjonsreglene og kommentarene, konflikter, historikken og
 * publiseringen. Scenarioreglene og THC-syrereglene prøves i
 * `scenarioregler.test.tsx`, `thcregler.test.tsx` og `thcredigering.test.tsx`.
 *
 * Databasen er erstattet av en enkel leser og et lager som husker kallene.
 * Innholdet er syntetisk. Tallene og tekstene er ikke kliniske verdier.
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { Fortolkningsredigering } from '../components/regler/Fortolkningsredigering'
import { FaginnholdskildeProvider } from '../components/stoffside/Faginnholdskilde'
import { TipsLag } from '../components/Tips'
import { ANALYTTKATALOG } from '../domain/analyttkatalog'
import { ETG_ANALYTT } from '../domain/etg'
import { Samtidighetskonflikt, type Faginnholdslager } from '../faginnhold/lagring'
import type { Faginnholdsleser, Regelsettutgave, Utgave } from '../faginnhold/lesing'
import type { Historikk } from '../faginnhold/historikk'
import type { Objektstatus, Tilstand } from '../faginnhold/modell'
import { kommentarnavn, utenKommentarer } from '../regler/kommentarer'
import type { Intervallregelsett, Intervallregelsettinnhold } from '../regler/modell'
import { falskLeser } from './hjelp/falskleser'

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
})

afterEach(cleanup)

const katalog = ANALYTTKATALOG

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
      utgave(id, { navn: kommentarnavn(r, id), tekst, plassholdere: [] }, id === HOY && tilstand === 'utkast' ? 2 : 1, 1),
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

function status(id: string, revisjon = 1): Objektstatus {
  return { id, type: 'kommentar', revisjon, endret_kl: null, publisert_revisjon: null, publisert_kl: null }
}

/** En falsk leser med regelsettet for AMTNORSUM, og et lager som husker kallene. */
function kilde(regler: (kode: string, t: Tilstand) => Regelsettutgave | null = (kode, t) =>
  kode === 'AMTNORSUM' ? regelsettutgave(t) : null) {
  const leser: Faginnholdsleser = falskLeser({
    finnIntervallregelsett: vi.fn(async (kode: string, tilstand: Tilstand) => regler(kode, tilstand)),
    lesHistorikk: vi.fn(async (id: string) => (id === HOY ? KOMMENTARHISTORIKK : REGELHISTORIKK)) as Faginnholdsleser['lesHistorikk'],
  })
  const lager: Faginnholdslager = {
    opprettUtkast: vi.fn(async (_type: string) => status('ny')),
    lagreUtkast: vi.fn(async (id: string) => status(id, 3)),
    gjenopprettRevisjon: vi.fn(async (id: string) => status(id, 3)),
    lagreIntervallregelsett: vi.fn(async (id: string) => status(id, 3)),
    lagreScenarioregelsett: vi.fn(async (id: string) => status(id, 3)),
    lagreThcRegelsett: vi.fn(async (id: string) => status(id, 3)),
    publiserUtkast: vi.fn(async (id: string) => status(id)),
    slettReferanse: vi.fn(),
  }
  return { leser, lager, kanRedigere: true }
}

/** Redigeringen av fortolkningen koden hører til, AMTNORSUM om ingen annen er gitt. */
function vis(k = kilde(), fortolkning = katalog.finn('AMTNORSUM')!.fortolkning, sted?: string[]) {
  const onPublisert = vi.fn()
  const onAvslutt = vi.fn()
  render(
    <TipsLag>
      <FaginnholdskildeProvider kilde={k}>
        <Fortolkningsredigering
          fortolkning={fortolkning}
          sted={sted}
          katalog={katalog}
          onPublisert={onPublisert}
          onAvslutt={onAvslutt}
        />
      </FaginnholdskildeProvider>
    </TipsLag>,
  )
  return { onPublisert, onAvslutt, ...k }
}

/** Redigeringen med utkastet hentet. */
async function redigerer(k = kilde()) {
  const user = userEvent.setup()
  const verdier = vis(k)
  await screen.findByText('Endret syntetisk høy kommentar.')
  return { user, ...verdier }
}

/** Seksjonen «Fortolkning». Den er den eneste delen av reglene, og står åpen. */
async function fortolkningen() {
  const seksjon = await screen.findByRole('region', { name: 'Fortolkning' })
  await waitFor(() =>
    expect(within(seksjon).getByRole('button', { name: 'Fortolkning' }).getAttribute('aria-expanded')).toBe('true'),
  )
  return seksjon
}

/** Regelsett for DIAZ og DMI, men ikke OXA, i modulen de deler. */
function diazOgDmi(kode: string, t: Tilstand): Regelsettutgave | null {
  if (kode !== 'DIAZ' && kode !== 'DMI') return null
  const u = regelsettutgave(t)
  return { ...u, regelsett: { ...u.regelsett, id: `regelsett-${kode}`, innhold: { ...u.regelsett.innhold, analyttkode: kode } } }
}

/** Om seksjonen med navnet står åpen. */
const apen = (navn: string) =>
  within(screen.getByRole('region', { name: navn })).getByRole('button', { name: navn }).getAttribute('aria-expanded')

describe('siden', () => {
  it('leser utkastet til reglene for hver kode i modulen, og har navnet på fortolkningen', async () => {
    const { leser } = vis()
    expect(await screen.findByRole('heading', { level: 1, name: 'Fortolkning av Sum: Amitriptylin + nortriptylin' })).toBeTruthy()
    expect(screen.getByText('Rediger fortolkningen')).toBeTruthy()
    await fortolkningen()
    expect(vi.mocked(leser.finnIntervallregelsett).mock.calls).toEqual(
      expect.arrayContaining([
        ['AMTNORSUM', 'utkast'],
        ['AMTNORSUM', 'publisert'],
      ]),
    )
    // Fortolkningen hører ikke til noen fagside.
    expect(leser.lesStoffside).not.toHaveBeenCalled()
    expect(document.title).toBe('Rediger: Fortolkning av Sum: Amitriptylin + nortriptylin – OUSFAR')
  })

  it('har én seksjon per kode med regler når modulen dekker flere koder', async () => {
    const { leser } = vis(kilde(diazOgDmi), katalog.finn('DMI')!.fortolkning)
    expect(await screen.findByRole('region', { name: 'Fortolkningsregler – DIAZ' })).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Fortolkningsregler – DMI' }).id).toBe('panel-fortolkning-dmi')
    expect(screen.queryByRole('region', { name: /OXA/ })).toBeNull()
    expect(new Set(vi.mocked(leser.finnIntervallregelsett).mock.calls.map(([kode]) => kode))).toEqual(
      new Set(['DIAZ', 'DMI', 'OXA']),
    )
    // Med flere deler står de lukket, så redaktøren velger hva som skal redigeres.
    expect(screen.getAllByRole('button', { name: 'Rediger reglene' })).toHaveLength(2)
  })

  it('åpner delen adressen peker på, og har bare én del åpen om gangen', async () => {
    const user = userEvent.setup()
    vis(kilde(diazOgDmi), katalog.finn('DMI')!.fortolkning, ['fortolkning-dmi'])
    await screen.findByRole('region', { name: 'Fortolkningsregler – DIAZ' })
    await waitFor(() => expect(apen('Fortolkningsregler – DMI')).toBe('true'))
    expect(apen('Fortolkningsregler – DIAZ')).toBe('false')

    await user.click(
      within(screen.getByRole('region', { name: 'Fortolkningsregler – DIAZ' })).getByRole('button', {
        name: 'Fortolkningsregler – DIAZ',
      }),
    )
    await waitFor(() => expect(apen('Fortolkningsregler – DIAZ')).toBe('true'))
    expect(apen('Fortolkningsregler – DMI')).toBe('false')
  })

  it('sier fra når fortolkningen ikke har regler som kan redigeres her', async () => {
    vis(kilde(), ETG_ANALYTT)
    expect(await screen.findByText('Denne fortolkningen har ingen regler eller kommentarer som kan redigeres her.')).toBeTruthy()
    expect(document.querySelector('.regler')).toBeNull()
  })

  it('sier fra når reglene ikke kan hentes, og prøver igjen', async () => {
    const user = userEvent.setup()
    const k = kilde()
    vi.mocked(k.leser.finnIntervallregelsett).mockRejectedValueOnce(new Error('Nede.'))
    vis(k)
    expect((await screen.findByRole('alert')).textContent).toContain('Fikk ikke hentet reglene. Nede.')
    await user.click(screen.getByRole('button', { name: 'Prøv igjen' }))
    expect(await screen.findByText('Endret syntetisk høy kommentar.')).toBeTruthy()
  })

  it('går tilbake til fortolkningen med «Avslutt redigering» og Escape, men ikke fra et åpent skjema', async () => {
    const { user, onAvslutt } = await redigerer()
    await user.click(screen.getByRole('button', { name: 'Avslutt redigering' }))
    expect(onAvslutt).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onAvslutt).toHaveBeenCalledTimes(2)
    await user.click(screen.getByRole('button', { name: 'Rediger reglene' }))
    expect(screen.getByRole('form', { name: 'Rediger: Fortolkningsreglene for AMTNORSUM' })).toBeTruthy()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onAvslutt).toHaveBeenCalledTimes(2)
  })

  it('publiserer det som er endret etter en oppsummering, og sier fra til fortolkningen', async () => {
    const { user, lager, onPublisert } = await redigerer()
    // Kommentaren i det øverste intervallet er endret; regelsettet selv er publisert.
    expect(await screen.findByText('Redigerer · utkast med 1 endring')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Publiser' }))
    const oppsummering = screen.getByRole('dialog', { name: 'Publiser endringene' })
    expect(within(oppsummering).getAllByRole('listitem').map((li) => li.textContent)).toEqual([`Kommentar: ${HOY_NAVN}`])
    expect(lager.publiserUtkast).not.toHaveBeenCalled()
    await user.click(within(oppsummering).getByRole('button', { name: 'Publiser nå' }))
    await waitFor(() => expect(onPublisert).toHaveBeenCalled())
    expect(vi.mocked(lager.publiserUtkast).mock.calls).toEqual([[HOY, 2]])
  })
})

describe('konsentrasjonsreglene', () => {
  it('viser reglene som en tabell, med ringegrensen og cut-off', async () => {
    vis()
    const seksjon = await fortolkningen()
    expect(seksjon.id).toBe('panel-fortolkning')
    const rader = within(seksjon)
      .getAllByRole('row')
      .slice(1)
      .map((rad) => [...rad.querySelectorAll('th, td')].map((c) => c.textContent))
    expect(rader).toEqual([
      ['< 10', 'Syntetisk lav kommentar.', ''],
      ['10 – 1799', 'Syntetisk middels kommentar.', ''],
      ['≥ 1800', 'Endret syntetisk høy kommentar.', 'Ring rekvirent'],
      ['Til stede under cut-off', 'Syntetisk innledning. Syntetisk middels kommentar.', ''],
    ])
    expect(within(seksjon).getByText('Ringegrense: 1800 nmol/L')).toBeTruthy()
    // Kommentaren som er endret i utkastet, står slik den er endret.
    expect(within(seksjon).getByText('Endret syntetisk høy kommentar.')).toBeTruthy()
    expect(within(seksjon).getByRole('button', { name: 'Rediger reglene' })).toBeTruthy()
  })

  it('simulerer en verdi på og rundt grensene, og cut-off', async () => {
    const user = userEvent.setup()
    vis()
    const seksjon = await fortolkningen()
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
    expect(svar()).toBe('≥ 1800 nmol/L · Over referanseområdetEndret syntetisk høy kommentar.Ring rekvirent.')
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
    const k = kilde()
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
    const seksjon = await fortolkningen()
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
})
