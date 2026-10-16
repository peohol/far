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
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
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
import type { Grendetaljer, Grensammendrag, Versjonsinfo } from '../kuratering/modell'
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

function klient(gren: Grendetaljer = grendetaljer()): Kurateringsklient {
  const sammendrag = gren as Grensammendrag
  return {
    oversikt: vi.fn(async () => [sammendrag]),
    les: vi.fn(async () => gren),
    vurder: vi.fn(async () => sammendrag),
    publiser: vi.fn(async () => ({ ok: true, status: 'publisert', versjon: 3 })),
    stans: vi.fn(async () => sammendrag),
    gjenoppta: vi.fn(async () => sammendrag),
    forkast: vi.fn(async () => sammendrag),
    gjenopprettVersjon: vi.fn(async () => grendetaljer({ id: GREN, art: 'gjenoppretting', status: 'arbeid' })),
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

  it('publiserer en godkjent gren uten hindringer', async () => {
    const k = klient(grendetaljer({ status: 'godkjent', hindringer: [] }))
    vis(<Kurateringsside gren={GREN} onGaaTil={vi.fn()} {...felles} />, kilde(k))
    await userEvent.click(await screen.findByRole('button', { name: 'Publiser' }))
    await waitFor(() => expect(k.publiser).toHaveBeenCalledWith(GREN, 2))
    expect(await screen.findByText('Publisert som versjon 3 av fagsiden.')).toBeTruthy()
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
