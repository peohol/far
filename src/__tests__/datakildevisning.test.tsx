// @vitest-environment jsdom
/**
 * Driftstatusen for datakildene slik administratorene ser den: kildene med
 * tilstanden, de kliniske endringene først, metadata på forespørsel, og
 * «Hent nå». Databasen er erstattet med en falsk leser.
 */
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { Datakilder } from '../components/konto/Datakilder'
import type { Datakildeleser, Datakildestatus } from '../datakilder/status'

beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  }
})

afterEach(cleanup)

const nylig = new Date(Date.now() - 60 * 60 * 1000).toISOString()

const STATUS: Datakildestatus = {
  kjoringer: [
    {
      kilde: 'clinpgx', id: 4, status: 'fullfort', utlost_av: 'cron', startet_kl: nylig, avsluttet_kl: nylig,
      release: null, versjon: '1', feil: null, endringer: { klinisk: 1, metadata: 1, grunnlag: 0 },
    },
    {
      kilde: 'cpic', id: 2, status: 'feilet', utlost_av: 'manuell', startet_kl: nylig, avsluttet_kl: nylig,
      release: null, versjon: null, feil: 'CPIC svarte 500', endringer: { klinisk: 0, metadata: 0, grunnlag: 0 },
    },
    {
      kilde: 'cpic', id: 1, status: 'fullfort', utlost_av: 'cron', startet_kl: nylig, avsluttet_kl: nylig,
      release: 'v1.60.1', versjon: '82', feil: null, endringer: { klinisk: 0, metadata: 0, grunnlag: 13 },
    },
  ],
  endringer: [
    {
      id: 2, kilde: 'clinpgx', synk_id: 4, type: 'retningslinje', objekt_id: 'PA166104980', kontekst: null, art: 'endret',
      niva: 'klinisk', etikett: 'Annotation of CPIC Guideline for sertraline', felt: ['sammendrag'],
      foer: { sammendrag: 'Gammel anbefaling' }, etter: { sammendrag: 'Ny anbefaling' }, spor: {}, registrert_kl: nylig,
    },
    {
      id: 1, kilde: 'clinpgx', synk_id: 4, type: 'retningslinje', objekt_id: 'PA166104981', kontekst: null, art: 'endret',
      niva: 'metadata', etikett: 'Annotation of DPWG Guideline for sertraline', felt: ['navn'],
      foer: { navn: 'A' }, etter: { navn: 'B' }, spor: {}, registrert_kl: nylig,
    },
  ],
}

function falskLeser(): Datakildeleser & { hentNa: ReturnType<typeof vi.fn> } {
  return {
    status: vi.fn(async () => STATUS),
    hentNa: vi.fn(async () => ({ status: 'uendret' })),
  }
}

describe('datakildene', () => {
  it('viser hver kilde med tilstanden, og de kliniske endringene uten metadataene', async () => {
    render(<Datakilder apen onLukk={() => {}} leser={falskLeser()} />)
    const clinpgx = await screen.findByRole('region', { name: 'ClinPGx' })
    expect(within(clinpgx).getByText('I orden', { selector: '.merke' })).toBeTruthy()
    expect(within(clinpgx).getByText('Siste henting fant 1 klinisk endring.')).toBeTruthy()
    expect(within(clinpgx).getByText('Annotation of CPIC Guideline for sertraline')).toBeTruthy()
    expect(within(clinpgx).queryByText('Annotation of DPWG Guideline for sertraline')).toBeNull()
    expect(within(clinpgx).getByText('Ny anbefaling')).toBeTruthy()

    const cpic = screen.getByRole('region', { name: 'CPIC' })
    expect(within(cpic).getByText('Feilet', { selector: '.merke' })).toBeTruthy()
    expect(within(cpic).getByText('Siste henting feilet: CPIC svarte 500. Dataene fra siste vellykkede henting står.')).toBeTruthy()
    expect(within(cpic).getByText('v1.60.1')).toBeTruthy()

    await userEvent.click(screen.getByRole('checkbox', { name: 'Vis også endringer i metadata' }))
    expect(within(clinpgx).getByText('Annotation of DPWG Guideline for sertraline')).toBeTruthy()
  })

  it('henter fra kilden når administratoren ber om det, og leser statusen på nytt', async () => {
    const leser = falskLeser()
    render(<Datakilder apen onLukk={() => {}} leser={leser} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Hent fra CPIC nå' }))
    expect(leser.hentNa).toHaveBeenCalledWith('cpic')
    await waitFor(() => expect(screen.getByText('Hentingen er ferdig (Uendret).')).toBeTruthy())
    expect(leser.status).toHaveBeenCalledTimes(2)
  })
})

describe('FEST sammen med ClinPGx og CPIC', () => {
  const fest = (id: number, status: 'fullfort' | 'feilet', ekstra: Partial<Datakildestatus['kjoringer'][number]> = {}) => ({
    kilde: 'fest' as const, id, status, utlost_av: 'cron' as const, startet_kl: nylig, avsluttet_kl: nylig,
    release: null, versjon: null, feil: null, endringer: { klinisk: 0, metadata: 0, grunnlag: 0 }, rader: null,
    ...ekstra,
  })
  const leserMed = (kjoringer: Datakildestatus['kjoringer']): Datakildeleser & { hentNa: ReturnType<typeof vi.fn> } => ({
    status: vi.fn(async () => ({ ...STATUS, kjoringer: [...kjoringer, ...STATUS.kjoringer] })),
    hentNa: vi.fn(async () => ({ status: 'uendret' })),
  })

  it('viser FEST først, med uttrekket, radene og den nattlige jobben, uten endringslogg', async () => {
    const leser = leserMed([fest(9, 'fullfort', { versjon: '2026-09-08T03:09:06', rader: { nye: 3, endrede: 12, utgatte: 1 } })])
    render(<Datakilder apen onLukk={() => {}} leser={leser} />)
    const region = await screen.findByRole('region', { name: 'FEST' })
    expect(screen.getAllByRole('region').map((r) => r.getAttribute('aria-labelledby'))).toEqual([
      'datakilde-fest',
      'datakilde-clinpgx',
      'datakilde-cpic',
    ])
    expect(within(region).getByText('I orden', { selector: '.merke' })).toBeTruthy()
    expect(within(region).getByText('Siste henting byttet inn et nytt uttrekk (rader nye: 3, endrede: 12, utgåtte: 1).')).toBeTruthy()
    expect(within(region).getByText('Uttrekk fra DMP')).toBeTruthy()
    expect(within(region).getByText('08.09.2026')).toBeTruthy()
    expect(within(region).getByText('Nattlig jobb')).toBeTruthy()
    expect(within(region).getByRole('columnheader', { name: 'Utgåtte' })).toBeTruthy()
    expect(within(region).queryByText('Kliniske endringer')).toBeNull()
    expect(within(region).getByText(/logges ikke enkeltvis/)).toBeTruthy()

    // ClinPGx og CPIC vises som før.
    const clinpgx = screen.getByRole('region', { name: 'ClinPGx' })
    expect(within(clinpgx).getByText('Kliniske endringer')).toBeTruthy()
    expect(within(clinpgx).getByText('Ukentlig jobb')).toBeTruthy()
    expect(within(clinpgx).getByRole('columnheader', { name: 'Kliniske' })).toBeTruthy()

    await userEvent.click(within(region).getByRole('button', { name: 'Hent fra FEST nå' }))
    expect(leser.hentNa).toHaveBeenCalledWith('fest')
  })

  it('sier konkret hva som stoppet en FEST-henting, og at de gyldige dataene fortsatt brukes', async () => {
    const feil = 'Strukturkontrollen stoppet FEST-uttrekket, trolig fordi DMP har endret formen på filen: bare 0 % av de 8962 merkevarene har varenavn (krever minst 90 %). Ingenting er byttet inn.'
    render(
      <Datakilder
        apen
        onLukk={() => {}}
        leser={leserMed([fest(10, 'feilet', { feil, utlost_av: 'manuell' }), fest(9, 'fullfort', { versjon: '2026-09-08T03:09:06' })])}
      />,
    )
    const region = await screen.findByRole('region', { name: 'FEST' })
    expect(within(region).getByText('Feilet', { selector: '.merke' })).toBeTruthy()
    expect(
      within(region).getByText(
        `Siste henting feilet: ${feil.replace(/\.$/, '')}. OUSFAR bruker fortsatt siste gyldige FEST-data; ingenting fra den feilede hentingen er tatt i bruk.`,
      ),
    ).toBeTruthy()
    expect(within(region).getByText('Administrator')).toBeTruthy()
    expect(within(region).getByText('08.09.2026')).toBeTruthy()
  })
})
