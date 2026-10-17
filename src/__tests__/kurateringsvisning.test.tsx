// @vitest-environment jsdom
/**
 * Versjonene av en fagside og kurateringsgrenene i appen (fase C i
 * `docs/kurateringsgrener-fremdrift.md`): adressene, sammenligningen av to
 * hele utgaver av siden, versjonssiden med gjenopprettingen, kurateringssiden
 * med vurderingen og publiseringen, og versjonslista i menyen på fagsiden.
 *
 * Databasen er erstattet av en klient som husker kallene; at databasen gjør
 * det den skal, prøves i `kurateringsgrener.test.ts` og `sideversjoner.test.ts`.
 * Innholdet er syntetisk.
 */
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { Kurateringsside } from '../components/kuratering/Kurateringsside'
import { Versjonsside } from '../components/kuratering/Versjonsside'
import { Kurateringsoversikt } from '../components/kuratering/Utgavelister'
import { FaginnholdskildeProvider, type Faginnholdskilde } from '../components/stoffside/Faginnholdskilde'
import { Stoffside } from '../components/stoffside/Stoffside'
import { TipsLag } from '../components/Tips'
import { ANALYTTKATALOG } from '../domain/analyttkatalog'
import { adresse, lesRute, sidesti } from '../domain/rute'
import { STOFFREGISTERDATA, byggStoffregister } from '../domain/stoffregister'
import { INGEN_BIVIRKNINGER, type Bivirkning, type Bivirkningsdata } from '../bivirkninger/modell'
import type { Faginnholdslager } from '../faginnhold/lagring'
import { TOM_STOFFSIDE, type Faginnholdsleser, type Stoffsidedata, type Utgave } from '../faginnhold/lesing'
import type { Innholdselementinnhold } from '../faginnhold/modell'
import { sammenlignSider } from '../faginnhold/sidesammenligning'
import type { Kurateringsklient, Sideutgavedata } from '../kuratering/klient'
import {
  agenttilstand,
  rundeUtenEndringer,
  type Agentinfo,
  type Grendetaljer,
  type Grenhendelse,
  type Grensammendrag,
  type Grenstatusdata,
  type Versjonsinfo,
} from '../kuratering/modell'
import { endredeSteder } from '../components/kuratering/Folgagenten'
import { GRUNNSTRUKTUR } from './hjelp/registerstruktur'

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Element.prototype.scrollIntoView ??= function () {}
  window.scrollTo = () => {}
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  }
})

afterEach(cleanup)

const SIDE = '11111111-0000-4000-8000-000000000001'
const DOSERING = '22222222-0000-4000-8000-000000000002'
const INDIKASJON = '33333333-0000-4000-8000-000000000003'
const GREN = '44444444-0000-4000-8000-000000000004'
const REGISTER = byggStoffregister([], STOFFREGISTERDATA, GRUNNSTRUKTUR)
const STOFF = 'citalopram'

const DOK = (tekst: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: tekst }] }] })

function utgave<T>(id: string, innhold: T, revisjon = 1): Utgave<T> {
  return {
    id,
    revisjon,
    publisert_revisjon: revisjon,
    innhold,
    endret_av_fornavn: 'Rita',
    endret_av_etternavn: 'Redaktør',
    endret_kl: '2026-10-01T12:00:00Z',
  }
}

const kort = (panel: string, tekst: string, posisjon = 0): Innholdselementinnhold => ({
  infoside: SIDE,
  panel,
  posisjon,
  elementtype: 'riktekst',
  data: { dokument: DOK(tekst) },
  referanser: [],
})

function side(elementer: Utgave<Innholdselementinnhold>[]): Stoffsidedata {
  return {
    stoff: { id: SIDE, slug: STOFF, navn: 'Citalopram' },
    infoside: utgave(SIDE, { navn: 'Citalopram', slug: STOFF, panelreferanser: {} }),
    elementer,
    referanser: [],
  }
}

const GAMMEL: Sideutgavedata = {
  side: side([utgave(DOSERING, kort('dosering', 'Gammel dosering')), utgave(INDIKASJON, kort('indikasjon', 'Gammel indikasjon'))]),
  bivirkninger: INGEN_BIVIRKNINGER,
}
const NY: Sideutgavedata = {
  side: side([utgave(DOSERING, kort('dosering', 'Ny dosering'), 2), utgave(INDIKASJON, kort('fjernet', 'Gammel indikasjon'), 2)]),
  bivirkninger: INGEN_BIVIRKNINGER,
}

const versjonsinfo = (nr: number, opphav: Versjonsinfo['opphav'] = 'publisering'): Versjonsinfo => ({
  nr,
  opphav,
  opprettet_kl: '2026-10-01T12:00:00Z',
  fingeravtrykk: '0'.repeat(32),
  endring: { fornavn: 'Rita', etternavn: 'Redaktør', oppsummering: `Endring ${nr}` },
})

function grendetaljer(overstyr: Partial<Grendetaljer> = {}): Grendetaljer {
  return {
    id: GREN,
    stoff: STOFF,
    navn: 'Citalopram',
    art: 'kuratering',
    formaal: 'Syntetisk kuratering',
    status: 'klar',
    runde: 1,
    revisjon: 2,
    blindfase: false,
    kurator: 'Claude monografkurator',
    grunnversjon: 1,
    konflikt: false,
    teknisk_ok: true,
    opprettet_kl: '2026-10-01T12:00:00Z',
    oppdatert_kl: '2026-10-01T12:00:00Z',
    grenrevisjon: {
      revisjon: 2,
      fingeravtrykk: 'a'.repeat(32),
      kl: '2026-10-01T12:00:00Z',
      teknisk: { ok: true, rapport_ok: true, kontrollert_kl: '2026-10-01T12:00:00Z' },
      forhandsvisning: { stoff: NY.side, bivirkninger: { kilder: [], bivirkninger: [] } },
    },
    grunnlag: { ...GAMMEL.side, versjon: versjonsinfo(1) },
    vurderinger: [],
    hendelser: [],
    dokumenter: [],
    hindringer: ['Revisjon 2 er ikke faglig godkjent.'],
    manglende_dokumenter: [],
    ...overstyr,
  }
}

/** Statusen databasen gir for grenen, uten noe nytt. */
function grenstatus(gren: Grendetaljer, overstyr: Partial<Grenstatusdata> = {}): Grenstatusdata {
  return {
    id: gren.id,
    status: gren.status,
    revisjon: gren.revisjon,
    runde: gren.runde,
    blindfase: gren.blindfase,
    oppdatert_kl: gren.oppdatert_kl,
    apne_sperrer: (gren.traader ?? []).filter((t) => t.status === 'apen' && t.art === 'sperrende').length,
    endring: gren.endring ?? 0,
    ...overstyr,
  }
}

const AGENTER: Agentinfo[] = [
  { agent: 'claude-monografkurator', navn: 'Claude monografkurator', roller: ['kurator'], aktiv: true, har_nokkel: true, nokkel_kl: '2026-10-01T12:00:00Z' },
  { agent: 'chatgpt-monografkurator', navn: 'ChatGPT monografkurator', roller: ['kontrollor'], aktiv: true, har_nokkel: false },
]

function klient(gren: Grendetaljer = grendetaljer(), status: Partial<Grenstatusdata> = {}): Kurateringsklient {
  const sammendrag = gren as Grensammendrag
  return {
    oversikt: vi.fn(async () => [sammendrag]),
    les: vi.fn(async () => gren),
    status: vi.fn(async () => grenstatus(gren, status)),
    agenter: vi.fn(async () => AGENTER),
    nyAgentnokkel: vi.fn(async (agent: string) => ({ agent, nokkel: 'far_' + 'b'.repeat(64) })),
    vurder: vi.fn(async () => sammendrag),
    publiser: vi.fn(async () => ({ ok: true, status: 'publisert', versjon: 3 })),
    stans: vi.fn(async () => sammendrag),
    gjenoppta: vi.fn(async () => sammendrag),
    forkast: vi.fn(async () => sammendrag),
    gjenopprettVersjon: vi.fn(async () => grendetaljer({ id: GREN, art: 'gjenoppretting', status: 'arbeid' })),
    kommenter: vi.fn(async () => ({})),
    lukkKommentar: vi.fn(async () => ({})),
    gjenapneKommentar: vi.fn(async () => ({})),
    versjoner: vi.fn(async () => [versjonsinfo(2), versjonsinfo(1, 'basis')]),
    versjon: vi.fn(async (_stoff: string, nr: number) => ({ versjon: versjonsinfo(nr), utgave: nr === 1 ? GAMMEL : NY })),
  }
}

/** En kilde der siden selv er den nye utgaven, og bivirkningene er tomme. */
function kilde(kuratering: Kurateringsklient, kanRedigere = true): Faginnholdskilde {
  const leser = {
    lesStoffside: vi.fn(async (slug: string) => (slug === STOFF ? NY.side : TOM_STOFFSIDE)),
    lesStoffliste: vi.fn(async () => []),
    lesReferanser: vi.fn(async () => []),
    lesReferanseomrader: vi.fn(async () => new Map()),
  } as unknown as Faginnholdsleser
  return {
    leser,
    lager: {} as Faginnholdslager,
    kanRedigere,
    bivirkninger: { les: vi.fn(async (): Promise<Bivirkningsdata> => INGEN_BIVIRKNINGER) },
    kuratering,
  }
}

const felles = { register: REGISTER, katalog: ANALYTTKATALOG, onApneFortolkning: vi.fn() }

function vis(innhold: React.ReactNode, k: Faginnholdskilde) {
  render(
    <TipsLag>
      <FaginnholdskildeProvider kilde={k}>{innhold}</FaginnholdskildeProvider>
    </TipsLag>,
  )
}

describe('adressene', () => {
  it('leser og skriver adressene til en versjon og en kurateringsgren', () => {
    expect(lesRute('#/versjon/citalopram/3')).toEqual({ side: 'versjon', stoff: 'citalopram', nr: 3 })
    expect(adresse({ side: 'versjon', stoff: 'citalopram', nr: 3 })).toBe('#/versjon/citalopram/3')
    expect(sidesti({ side: 'versjon', stoff: 'citalopram', nr: 3 })).toBe('versjon/citalopram/3')
    expect(lesRute(`#/kuratering/${GREN}`)).toEqual({ side: 'kuratering', gren: GREN })
    expect(adresse({ side: 'kuratering', gren: GREN })).toBe(`#/kuratering/${GREN}`)
    // Et nummer som ikke er en versjon, eller en ID som ikke er en gren, er ingen side.
    expect(lesRute('#/versjon/citalopram/0').side).toBe('fortolkning')
    expect(lesRute('#/kuratering/ikke-en-id').side).toBe('fortolkning')
  })
})

const SPC: Bivirkningsdata['kilder'][number] = {
            id: 'k1',
            nokkel: 'spc',
            type: 'spc',
            tittel: 'Preparatomtale',
            preparat: null,
            innehaver: null,
            spc_versjon: '2026-01',
            revisjonsdato: null,
            lenke: null,
            kontrollert: null,
            kontrollert_av: null,
            merknad: null,
            importert_kl: '2026-10-01T12:00:00Z',
            importert_av: 'Rita',
            kontekster: [],
}
const hodepine = (frekvens: Bivirkning['frekvens'], fotnote: string | null = null): Bivirkning => ({
  kilde: 'k1',
  kontekst: null,
  organsystem: 'nevrologiske',
  frekvens,
  tekst: 'Hodepine',
  fotnote,
  posisjon: 0,
})

describe('sammenligningen av to utgaver', () => {
  it('viser endrede, fjernede og nye kort felt for felt, og bivirkningene per preparatomtale', () => {
    const ny: Sideutgavedata = {
      side: side([
        utgave(DOSERING, kort('dosering', 'Ny dosering'), 2),
        utgave('55555555-0000-4000-8000-000000000005', kort('farmakokinetikk', 'Ny kinetikk')),
      ]),
      bivirkninger: { kilder: [SPC], bivirkninger: [hodepine('svaert_vanlige')] },
    }
    const endringer = sammenlignSider(GAMMEL, ny).filter((e) => e.endret)
    const per = (tekst: string) => endringer.find((e) => e.for === tekst || e.etter === tekst)
    expect(per('Ny dosering')).toMatchObject({ for: 'Gammel dosering', etter: 'Ny dosering', gruppe: 'Dosering · kort 1' })
    expect(per('Gammel indikasjon')).toMatchObject({ etter: null })
    expect(per('Ny kinetikk')).toMatchObject({ for: null })
    expect(per('Nevrologiske sykdommer · Svært vanlige: Hodepine')).toMatchObject({ for: null, gruppe: 'Bivirkninger fra preparatomtalene' })
  })

  it('viser en bivirkning med samme tekst og ny frekvens eller fotnote som endret', () => {
    const med = (b: Bivirkning): Sideutgavedata => ({ ...GAMMEL, bivirkninger: { kilder: [SPC], bivirkninger: [b] } })
    const endret = (a: Bivirkning, b: Bivirkning) => sammenlignSider(med(a), med(b)).filter((e) => e.endret)
    expect(endret(hodepine('vanlige'), hodepine('sjeldne'))).toEqual([
      expect.objectContaining({ for: 'Nevrologiske sykdommer · Vanlige: Hodepine', etter: 'Nevrologiske sykdommer · Sjeldne: Hodepine' }),
    ])
    expect(endret(hodepine('vanlige'), hodepine('vanlige', 'Ved høye doser'))).toHaveLength(1)
    expect(endret(hodepine('vanlige'), hodepine('vanlige'))).toEqual([])
  })

  it('viser en sidekilde som er byttet ut med en annen, også når antallet er det samme', () => {
    const referanse = (id: string, tittel: string) => utgave(id, { tittel, forfattere: 'A', aar: '2020', lenke: `https://example.org/${id}` } as never)
    const medKilde = (ref: string): Sideutgavedata => ({
      ...GAMMEL,
      side: {
        ...GAMMEL.side,
        infoside: utgave(SIDE, { navn: 'Citalopram', slug: STOFF, panelreferanser: { dosering: [ref] } }),
        referanser: [referanse('a', 'Kilde A'), referanse('b', 'Kilde B')],
      },
    })
    const endret = sammenlignSider(medKilde('a'), medKilde('b')).filter((e) => e.endret)
    expect(endret).toHaveLength(1)
    expect(endret[0]!.for).toContain('Kilde A')
    expect(endret[0]!.etter).toContain('Kilde B')
  })
})

describe('versjonssiden', () => {
  it('viser en tidligere versjon, sammenligner den med den gjeldende, og tar den tilbake som en gren', async () => {
    const k = klient()
    const onGaaTil = vi.fn()
    vis(<Versjonsside stoff={STOFF} nr={1} onGaaTil={onGaaTil} {...felles} />, kilde(k))

    expect(await screen.findByText('Versjon 1 av fagsiden')).toBeTruthy()
    expect(k.versjon).toHaveBeenCalledWith(STOFF, 1)
    // Ingen redigering eller favoritt på en tidligere versjon.
    expect(screen.queryByRole('button', { name: 'Rediger' })).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Sammenlign med den gjeldende' }))
    const lag = await screen.findByRole('dialog', { name: /versjon 1 mot den gjeldende/ })
    expect(within(lag).getAllByText(/dosering/).length).toBeGreaterThan(0)
    // Det fjernede og det nye har sine egne merker (rød og grønn bunn), også her
    // utenfor historikkvinduet.
    const merker = [...lag.querySelectorAll('del, ins')]
    expect(merker.length).toBeGreaterThan(0)
    for (const m of merker) expect(m.className).toBe(m.tagName === 'DEL' ? 'historikk__fjernet' : 'historikk__ny')

    await userEvent.click(screen.getByRole('button', { name: 'Lukk' }))
    await userEvent.click(screen.getByRole('button', { name: 'Ta tilbake denne versjonen' }))
    await userEvent.click(screen.getByRole('button', { name: 'Bekreft at versjon 1 tas tilbake' }))
    await waitFor(() => expect(k.gjenopprettVersjon).toHaveBeenCalledWith(STOFF, 1))
    expect(onGaaTil).toHaveBeenCalledWith({ side: 'kuratering', gren: GREN })
  })

  it('lar bare administratorene ta en versjon tilbake', async () => {
    vis(<Versjonsside stoff={STOFF} nr={1} onGaaTil={vi.fn()} {...felles} />, kilde(klient(), false))
    expect(await screen.findByText('Versjon 1 av fagsiden')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Ta tilbake denne versjonen' })).toBeNull()
  })
})

describe('kurateringssiden', () => {
  it('viser forhåndsvisningen og hindringene, og lar en administrator vurdere revisjonen', async () => {
    const k = klient()
    vis(<Kurateringsside gren={GREN} onGaaTil={vi.fn()} {...felles} />, kilde(k))
    expect(await screen.findByText('Kuratering: Syntetisk kuratering')).toBeTruthy()
    expect(screen.getByText('Revisjon 2 er ikke faglig godkjent.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Publiser' })).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Be om endringer' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Hva må endres' }), 'Doseringen mangler kilde.')
    await userEvent.click(screen.getByRole('button', { name: 'Send tilbake til kuratoren' }))
    await waitFor(() => expect(k.vurder).toHaveBeenCalledWith(GREN, 2, 'endringer', 'Doseringen mangler kilde.'))
  })

  it('krever en begrunnelse også for å godkjenne', async () => {
    const k = klient()
    vis(<Kurateringsside gren={GREN} onGaaTil={vi.fn()} {...felles} />, kilde(k))
    await userEvent.click(await screen.findByRole('button', { name: 'Godkjenn' }))
    const felt = screen.getByRole('textbox', { name: 'Hva er kontrollert' }) as HTMLTextAreaElement
    expect(felt.required).toBe(true)
    // Bare mellomrom er ingen begrunnelse.
    await userEvent.type(felt, '   ')
    await userEvent.click(screen.getByRole('button', { name: 'Godkjenn revisjon 2' }))
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Skriv kort hva som er kontrollert før du godkjenner.')
    expect(k.vurder).not.toHaveBeenCalled()
    await userEvent.type(felt, 'Dosering og kilder kontrollert mot preparatomtalen.')
    await userEvent.click(screen.getByRole('button', { name: 'Godkjenn revisjon 2' }))
    await waitFor(() => expect(k.vurder).toHaveBeenCalledWith(GREN, 2, 'godkjent', 'Dosering og kilder kontrollert mot preparatomtalen.'))
  })

  it('viser at kontrollrunden gjelder den samme revisjonen som den forrige', async () => {
    const tilKontroll = (revisjon: number, data: Record<string, unknown>): Grenhendelse => ({
      hendelse: 'til_kontroll',
      til: 'klar',
      revisjon,
      data,
      kl: '2026-10-01T12:00:00Z',
    })
    const uten = tilKontroll(2, { runde: 2, uten_endringer: true })
    expect(rundeUtenEndringer({ runde: 2, revisjon: 2, hendelser: [uten, tilKontroll(2, { runde: 1 })] })).toBe(true)
    expect(rundeUtenEndringer({ runde: 1, revisjon: 2, hendelser: [tilKontroll(2, { runde: 1 })] })).toBe(false)
    // Etter en ny revisjon gjelder den ikke lenger.
    expect(rundeUtenEndringer({ runde: 2, revisjon: 3, hendelser: [uten] })).toBe(false)

    vis(<Kurateringsside gren={GREN} onGaaTil={vi.fn()} {...felles} />, kilde(klient(grendetaljer({ runde: 2, hendelser: [uten] }))))
    expect(await screen.findByText(/kontrollrunde 2, uten nye endringer/)).toBeTruthy()
  })

  it('publiserer en godkjent gren uten hindringer', async () => {
    const k = klient(grendetaljer({ status: 'godkjent', hindringer: [] }))
    vis(<Kurateringsside gren={GREN} onGaaTil={vi.fn()} {...felles} />, kilde(k))
    await userEvent.click(await screen.findByRole('button', { name: 'Publiser' }))
    await waitFor(() => expect(k.publiser).toHaveBeenCalledWith(GREN, 2))
    expect(await screen.findByText('Publisert som versjon 3 av fagsiden.')).toBeTruthy()
  })
})

describe('kommentartrådene', () => {
  it('viser trådene festet til kort og felt, og lar en administrator åpne, svare på og lukke dem', async () => {
    const traad = {
      id: '66666666-0000-4000-8000-000000000006',
      art: 'sperrende' as const,
      anker: { objekt: DOSERING, felt: 'Tekst' },
      revisjon: 1,
      status: 'apen' as const,
      venter_pa_kurator: true,
      kommentarer: [{ id: '66666666-0000-4000-8000-000000000006', handling: 'kommentar' as const, tekst: 'Kilde mangler.', revisjon: 1, av: 'ChatGPT', kl: '2026-10-01T12:00:00Z' }],
    }
    const k = klient(grendetaljer({ traader: [traad] }))
    vis(<Kurateringsside gren={GREN} onGaaTil={vi.fn()} {...felles} />, kilde(k))
    await userEvent.click(await screen.findByRole('button', { name: 'Kommentarer (1 åpne, 1 sperrende)' }))
    const lag = await screen.findByRole('dialog', { name: 'Kommentarer' })
    const rad = within(lag).getByRole('region', { name: 'Tråd: Dosering · kort 1 · Tekst' })
    expect(within(rad).getByText('venter på kuratoren')).toBeTruthy()
    expect(within(rad).getByText('Kilde mangler.')).toBeTruthy()

    await userEvent.type(within(rad).getByRole('textbox', { name: 'Svar' }), 'Sett.')
    await userEvent.click(within(rad).getByRole('button', { name: 'Svar' }))
    await waitFor(() => expect(k.kommenter).toHaveBeenCalledWith(GREN, { tekst: 'Sett.', svarPa: traad.id }))
    await userEvent.click(within(rad).getByRole('button', { name: 'Lukk tråden' }))
    await waitFor(() => expect(k.lukkKommentar).toHaveBeenCalledWith(GREN, traad.id))

    await userEvent.selectOptions(within(lag).getByRole('combobox', { name: 'Gjelder' }), 'Dosering · kort 1')
    await userEvent.selectOptions(within(lag).getByRole('combobox', { name: 'Felt' }), 'Tekst')
    await userEvent.type(within(lag).getByRole('textbox', { name: 'Ny kommentar' }), 'Doseringen mangler maksdose.')
    await userEvent.click(within(lag).getByRole('button', { name: 'Legg inn kommentaren' }))
    await waitFor(() =>
      expect(k.kommenter).toHaveBeenLastCalledWith(GREN, {
        tekst: 'Doseringen mangler maksdose.',
        art: 'sperrende',
        anker: { objekt: DOSERING, felt: 'Tekst' },
      }),
    )
  })
})

describe('følg agenten', () => {
  const naa = () => new Date().toISOString()

  /** Kortet på siden, seksjonen det står i, og om seksjonen er åpen. */
  const doseringen = () => {
    const element = document.getElementById(`element-${DOSERING}`)
    const seksjon = element?.closest('.skuff--seksjon')
    return { element, apen: seksjon?.hasAttribute('data-apen') ?? false }
  }

  it('viser hva agenten gjør, åpner og merker kortet den arbeider med når den følges, og slutter å følge når man ruller selv', async () => {
    const gren = grendetaljer({ status: 'arbeid' })
    const k = klient(gren, { aktivitet: { tekst: 'Kontrollerer doseringen', objekt: DOSERING, kl: naa() } })
    vis(<Kurateringsside gren={GREN} onGaaTil={vi.fn()} {...felles} />, kilde(k))
    expect(await screen.findByText('Agenten arbeider')).toBeTruthy()
    expect(await screen.findByText(/Kontrollerer doseringen/)).toBeTruthy()
    await waitFor(() => expect(doseringen().element).toBeTruthy())
    expect(doseringen().apen).toBe(false)
    const bryter = screen.getByRole('switch', { name: 'Følg agenten' }) as HTMLInputElement
    await userEvent.click(bryter)
    await waitFor(() => expect(doseringen().apen).toBe(true))
    expect(doseringen().element!.classList.contains('utgave--agent')).toBe(true)
    expect(doseringen().element!.getAttribute('data-agentmerke')).toBe('Agenten arbeider her')
    window.dispatchEvent(new WheelEvent('wheel'))
    await waitFor(() => expect(bryter.checked).toBe(false))
    // Følges agenten ikke lenger, er merket borte; seksjonen står åpen.
    expect(doseringen().element!.classList.contains('utgave--agent')).toBe(false)
    expect(doseringen().apen).toBe(true)
  })

  it('åpner og lyser opp det som er endret når en ny revisjon kommer mens agenten følges, uten å tegne siden på nytt', async () => {
    const forrige = grendetaljer({ status: 'arbeid' })
    forrige.grenrevisjon = { ...forrige.grenrevisjon!, forhandsvisning: { stoff: GAMMEL.side, bivirkninger: { kilder: [], bivirkninger: [] } } }
    const neste = grendetaljer({ status: 'arbeid', revisjon: 3 })
    neste.grenrevisjon = { ...neste.grenrevisjon!, revisjon: 3 }
    const k = klient(forrige)
    vis(<Kurateringsside gren={GREN} onGaaTil={vi.fn()} {...felles} />, kilde(k))
    await waitFor(() => expect(doseringen().element).toBeTruthy())
    const siden = document.querySelector('.stoffside')
    await userEvent.click(screen.getByRole('switch', { name: 'Følg agenten' }))
    expect(doseringen().apen).toBe(false)

    vi.mocked(k.les).mockResolvedValue(neste)
    vi.mocked(k.status).mockResolvedValue(grenstatus(neste))
    act(() => {
      window.dispatchEvent(new Event('focus'))
    })
    await waitFor(() => expect(doseringen().apen).toBe(true))
    expect(doseringen().element!.classList.contains('utgave--nylig')).toBe(true)
    expect(doseringen().element!.classList.contains('utgave--agent')).toBe(true)
    // Siden er den samme; bare innholdet er byttet.
    expect(document.querySelector('.stoffside')).toBe(siden)
  })

  it('åpner kortet i seksjonen det er flyttet til, ikke der det sto', async () => {
    const forrige = grendetaljer({ status: 'arbeid' })
    forrige.grenrevisjon = { ...forrige.grenrevisjon!, forhandsvisning: { stoff: GAMMEL.side, bivirkninger: { kilder: [], bivirkninger: [] } } }
    const flyttet = side([utgave(DOSERING, kort('indikasjon', 'Ny dosering'), 2), utgave(INDIKASJON, kort('fjernet', 'Gammel indikasjon'), 2)])
    const neste = grendetaljer({ status: 'arbeid', revisjon: 3 })
    neste.grenrevisjon = { ...neste.grenrevisjon!, revisjon: 3, forhandsvisning: { stoff: flyttet, bivirkninger: { kilder: [], bivirkninger: [] } } }
    const k = klient(forrige)
    vis(<Kurateringsside gren={GREN} onGaaTil={vi.fn()} {...felles} />, kilde(k))
    await waitFor(() => expect(doseringen().element?.closest('#panel-dosering')).toBeTruthy())
    await userEvent.click(screen.getByRole('switch', { name: 'Følg agenten' }))

    vi.mocked(k.les).mockResolvedValue(neste)
    vi.mocked(k.status).mockResolvedValue(grenstatus(neste))
    act(() => {
      window.dispatchEvent(new Event('focus'))
    })
    await waitFor(() => expect(doseringen().element?.closest('#panel-indikasjon')).toBeTruthy())
    await waitFor(() => expect(doseringen().apen).toBe(true))
    expect(doseringen().element!.classList.contains('utgave--agent')).toBe(true)
  })

  it('har rammen, men ikke merket «Agenten arbeider her», når agenten venter', async () => {
    const gren = grendetaljer({ status: 'arbeid' })
    // Siste aktivitet for en time siden: agenten venter.
    const k = klient(gren, { aktivitet: { tekst: 'Kontrollerer doseringen', objekt: DOSERING, kl: new Date(Date.now() - 3_600_000).toISOString() } })
    vis(<Kurateringsside gren={GREN} onGaaTil={vi.fn()} {...felles} />, kilde(k))
    expect(await screen.findByText('Venter')).toBeTruthy()
    await waitFor(() => expect(doseringen().element).toBeTruthy())
    await userEvent.click(screen.getByRole('switch', { name: 'Følg agenten' }))
    await waitFor(() => expect(doseringen().element!.classList.contains('utgave--agent')).toBe(true))
    expect(doseringen().element!.hasAttribute('data-agentmerke')).toBe(false)
  })

  it('leser grenen på nytt når statusen sier at det er kommet en ny revisjon, men bare én gang', async () => {
    const k = klient(grendetaljer(), { revisjon: 3 })
    vis(<Kurateringsside gren={GREN} onGaaTil={vi.fn()} {...felles} />, kilde(k))
    await waitFor(() => expect(k.les).toHaveBeenCalledTimes(2))
    await new Promise((r) => setTimeout(r, 50))
    expect(k.les).toHaveBeenCalledTimes(2)
  })

  it('leser grenen på nytt når det er kommet et nytt svar eller en ny merknad, også når sperrene står som før', async () => {
    const k = klient(grendetaljer({ endring: 7 }), { endring: 8 })
    vis(<Kurateringsside gren={GREN} onGaaTil={vi.fn()} {...felles} />, kilde(k))
    await waitFor(() => expect(k.les).toHaveBeenCalledTimes(2))
    await new Promise((r) => setTimeout(r, 50))
    expect(k.les).toHaveBeenCalledTimes(2)
    // Uten noe nytt leses den ikke på nytt.
    const uendret = klient(grendetaljer({ endring: 8 }), { endring: 8 })
    vis(<Kurateringsside gren={GREN} onGaaTil={vi.fn()} {...felles} />, kilde(uendret))
    await waitFor(() => expect(uendret.status).toHaveBeenCalled())
    await new Promise((r) => setTimeout(r, 50))
    expect(uendret.les).toHaveBeenCalledTimes(1)
  })

  it('skiller mellom en agent som arbeider, venter, er stanset og en brutt tilkobling', () => {
    const gren = grendetaljer({ status: 'arbeid' })
    const kl = '2026-10-01T12:00:00Z'
    const t = Date.parse(kl)
    const s = grenstatus(gren, { aktivitet: { tekst: 'Søker', kl } })
    expect(agenttilstand(s, false, t + 60_000)).toBe('aktiv')
    // Uten noe nytt fra kuratoren på ti minutter er det ikke belegg for at den arbeider.
    expect(agenttilstand(s, false, t + 10 * 60_000)).toBe('venter')
    expect(agenttilstand({ ...s, status: 'klar' }, false, t + 60_000)).toBe('venter')
    expect(agenttilstand({ ...s, status: 'stanset' }, false, t)).toBe('stanset')
    expect(agenttilstand({ ...s, status: 'publisert' }, false, t)).toBe('avsluttet')
    expect(agenttilstand(s, true, t)).toBe('brutt')
  })

  it('finner stedene som er endret fra én revisjon til den neste', () => {
    expect(endredeSteder(GAMMEL, NY)).toEqual([{ kort: DOSERING, seksjon: 'dosering' }])
    expect(endredeSteder(NY, NY)).toEqual([])
    const bivirkninger: Sideutgavedata = { ...NY, bivirkninger: { ...INGEN_BIVIRKNINGER, kilder: [SPC] } }
    expect(endredeSteder(NY, bivirkninger)).toEqual([{ seksjon: 'bivirkninger' }])
  })
})

describe('agentene', () => {
  it('lister agentene og lager en ny nøkkel som vises én gang, med adressen til ChatGPT', async () => {
    const k = klient()
    const { rerender } = render(<Kurateringsoversikt apen klient={k} onLukk={vi.fn()} />)
    const liste = await screen.findByRole('list', { name: 'Agentene' })
    expect(within(liste).getByText(/Claude monografkurator · Kurator/)).toBeTruthy()
    expect(within(liste).getByText(/Ingen nøkkel · aldri sett/)).toBeTruthy()
    // Lista hentes på nytt etter den nye nøkkelen; feiler det, står nøkkelen likevel.
    vi.mocked(k.agenter).mockRejectedValueOnce(new Error('Nettverksfeil'))
    await userEvent.click(within(liste).getByRole('button', { name: 'Lag nøkkel' }))
    await userEvent.click(within(liste).getByRole('button', { name: 'Bekreft ny nøkkel til ChatGPT monografkurator.' }))
    await waitFor(() => expect(k.nyAgentnokkel).toHaveBeenCalledWith('chatgpt-monografkurator'))
    expect(await screen.findByText(/Fikk ikke hentet: Nettverksfeil/)).toBeTruthy()
    const mcp = screen.getByRole('textbox', { name: 'Adressen til ChatGPT (MCP)' }) as HTMLInputElement
    expect(mcp.value).toBe(`${window.location.origin}/api/kuratering-mcp?nokkel=far_${'b'.repeat(64)}`)
    expect(screen.getByText(/Ny nøkkel til ChatGPT monografkurator/)).toBeTruthy()

    // Lukkes laget, er nøkkelen borte også når det åpnes igjen.
    rerender(<Kurateringsoversikt apen={false} klient={k} onLukk={vi.fn()} />)
    rerender(<Kurateringsoversikt apen klient={k} onLukk={vi.fn()} />)
    await screen.findByRole('list', { name: 'Agentene' })
    expect(screen.queryByRole('textbox', { name: 'Adressen til ChatGPT (MCP)' })).toBeNull()
  })

  it('viser aldri en nøkkel som kommer etter at laget er lukket', async () => {
    const k = klient()
    let svar: (v: { agent: string; nokkel: string }) => void = () => {}
    vi.mocked(k.nyAgentnokkel).mockImplementationOnce(() => new Promise((r) => (svar = r)))
    const { rerender } = render(<Kurateringsoversikt apen klient={k} onLukk={vi.fn()} />)
    const liste = await screen.findByRole('list', { name: 'Agentene' })
    await userEvent.click(within(liste).getByRole('button', { name: 'Lag nøkkel' }))
    await userEvent.click(within(liste).getByRole('button', { name: 'Bekreft ny nøkkel til ChatGPT monografkurator.' }))
    await waitFor(() => expect(k.nyAgentnokkel).toHaveBeenCalled())
    // Laget lukkes før svaret kommer, og åpnes igjen etterpå.
    rerender(<Kurateringsoversikt apen={false} klient={k} onLukk={vi.fn()} />)
    await act(async () => svar({ agent: 'chatgpt-monografkurator', nokkel: 'far_' + 'c'.repeat(64) }))
    rerender(<Kurateringsoversikt apen klient={k} onLukk={vi.fn()} />)
    await screen.findByRole('list', { name: 'Agentene' })
    expect(screen.queryByRole('textbox', { name: 'Adressen til ChatGPT (MCP)' })).toBeNull()
    expect(screen.queryByText(/c{64}/)).toBeNull()
  })
})

describe('på fagsiden', () => {
  it('viser versjonene i menyen, og en aktiv kurateringsgren for administratorene', async () => {
    const k = klient()
    vis(<Stoffside stoff={STOFF} onLukk={vi.fn()} {...felles} />, kilde(k))
    expect(await screen.findByText(/Kuratering pågår i en egen arbeidsversjon/)).toBeTruthy()
    await userEvent.click(await screen.findByRole('button', { name: 'Mer for fagsiden' }))
    await userEvent.click(screen.getByRole('button', { name: /Versjoner/ }))
    const lag = await screen.findByRole('dialog', { name: 'Versjoner av Citalopram' })
    expect(within(lag).getByRole('link', { name: /Versjon 2 \(gjeldende\)/ }).getAttribute('href')).toBe('#/versjon/citalopram/2')
  })

  it('viser arbeidsoversikten over grenene', async () => {
    render(<Kurateringsoversikt apen klient={klient()} onLukk={vi.fn()} />)
    const lenke = await screen.findByRole('link', { name: /Citalopram · Til kontroll/ })
    expect(lenke.getAttribute('href')).toBe(`#/kuratering/${GREN}`)
  })
})
