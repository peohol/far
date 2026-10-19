// @vitest-environment jsdom
/**
 * Endringsloggen for en side (`Innholdslogg`): knappen i toppmenyen, endringene
 * nyeste først med hvem og når, merkene for person, KI-agent og system,
 * detaljene med kurateringsrapporten og migrasjonen, sammenligningen i
 * historikken, valgene for utkast og rutiner, og å bla bakover.
 *
 * Databasen er erstattet av en leser som husker kallene. Innholdet er syntetisk.
 */
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { Innholdslogg, lenketekst } from '../components/endringslogg/Innholdslogg'
import { FaginnholdskildeProvider } from '../components/stoffside/Faginnholdskilde'
import { TipsLag } from '../components/Tips'
import type { Endringsloggleser, Loggvalg } from '../endringslogg/api'
import type { Endring, Endringsdel, Endringslogg } from '../endringslogg/modell'
import type { Faginnholdslager } from '../faginnhold/lagring'
import { falskLeser } from './hjelp/falskleser'

// Profilbildene får en fast lenke i stedet for en signert fra Storage.
vi.mock('../auth/avatarer', () => ({
  useAvatarlenker: (profiler: { avatar_path: string | null }[]) =>
    new Map(profiler.flatMap((p) => (p.avatar_path ? [[p.avatar_path, `https://bilder.test/${p.avatar_path}`]] : []))),
}))

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Element.prototype.scrollIntoView ??= function () {}
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

const KORT = '00000000-0000-4000-8000-000000000001'

const dosering: Endringsdel = {
  objekt: KORT,
  type: 'innholdselement',
  fra: 1,
  til: 2,
  publisert: true,
  for: { panel: 'dosering', elementtype: 'riktekst', data: {} },
  etter: { panel: 'dosering', elementtype: 'riktekst', data: {} },
  endret: ['data'],
  dataEndret: ['dokument'],
  referanser: null,
  panelreferanser: {},
  delt: false,
}

function endring(id: string, kl: string, ekstra: Partial<Endring> = {}): Endring {
  return {
    id,
    kl,
    aktor: 'bruker',
    eldre: false,
    art: 'redigering',
    agent: null,
    person: { fornavn: 'Rita', etternavn: 'Redaktør' },
    profil: { id: 'rita', username: 'rita', first_name: 'Rita', last_name: 'Redaktør', avatar_path: null, updated_at: '2026-10-01T00:00:00Z' },
    oppsummering: null,
    rapport: null,
    migrasjon: null,
    verifisert: false,
    lenker: [],
    deler: [dosering],
    hendelser: [],
    utkast: false,
    delt: false,
    ...ekstra,
  }
}

const KURATOR = { nokkel: 'chatgpt-monografkurator', navn: 'ChatGPT monografikurator', art: 'ki-agent' as const, beskrivelse: 'Kuraterer fagsidene.', rutine: false }

const KURATERING = endring('k1', '2026-10-13T12:00:00Z', {
  aktor: 'agent',
  art: 'kuratering',
  agent: KURATOR,
  person: null,
  profil: {
    id: 'kuratorbot',
    username: 'kuratorbot',
    first_name: 'Kurator',
    last_name: 'Bot',
    avatar_path: 'kuratorbot/avatar.webp',
    updated_at: '2026-10-13T00:00:00Z',
  },
  oppsummering: 'Dosering ved nyresvikt kontrollert mot SPC',
  rapport: {
    seksjoner: [{ seksjon: 'dosering', nytt: [], endret: ['Maksdose ved nyresvikt'], fjernet: [] }],
    nye_opplysninger: [],
    korrigeringer: ['Feil enhet rettet'],
    kildegrunnlag: ['SPC oppdatert 2026'],
    mangler: ['Data for barn mangler'],
  },
  migrasjon: '20261013120000_syntetisk_kuratering.sql',
  verifisert: true,
  lenker: ['https://github.com/peohol/far/pull/999'],
})

function oppsett(sider: Endringslogg[]) {
  const kall: Loggvalg[] = []
  const leser: Endringsloggleser = {
    les: vi.fn(async (_side, valg = {}) => {
      kall.push(valg)
      return sider[valg.etter ? 1 : 0] ?? { endringer: [], flere: false }
    }),
  }
  const historikk = vi.fn(async () => ({
    hendelser: [],
    revisjoner: [
      { revisjon: 1, innhold: { ...dosering.for, posisjon: 0, infoside: 'x', referanser: [], data: { dokument: null } } },
      { revisjon: 2, innhold: { ...dosering.etter, posisjon: 0, infoside: 'x', referanser: [], data: { dokument: null } } },
    ],
  }))
  return { leser, kall, historikk }
}

function vis(sider: Endringslogg[], admin = false) {
  const o = oppsett(sider)
  const kilde = { leser: falskLeser({ lesHistorikk: o.historikk as never }), lager: {} as Faginnholdslager, kanRedigere: admin }
  render(
    <TipsLag>
      <FaginnholdskildeProvider kilde={kilde}>
        <Innholdslogg side={{ stoff: 'syntetin' }} sidenavn="Syntetin" leser={o.leser} admin={admin} />
      </FaginnholdskildeProvider>
    </TipsLag>,
  )
  return { user: userEvent.setup(), ...o }
}

describe('endringsloggen for en side', () => {
  it('viser endringene nyeste først, med hvem, når og hva', async () => {
    const { user } = vis([
      {
        endringer: [KURATERING, endring('e1', '2026-10-12T08:15:00Z')],
        flere: false,
      },
    ])
    await user.click(screen.getByRole('button', { name: 'Endringslogg' }))
    const lag = await screen.findByRole('dialog', { name: 'Endringslogg: Syntetin' })
    const foringer = await within(lag).findAllByRole('listitem')
    const [forste, andre] = foringer.filter((f) => f.classList.contains('loggskuff'))
    expect(forste?.querySelector('.innholdslogg__hvem')?.textContent).toBe('Kurator Bot')
    expect(forste?.querySelector('.innholdslogg__tid')?.textContent).toBe('13.10.2026 kl. 14:00')
    expect(forste?.textContent).toContain('Dosering ved nyresvikt kontrollert mot SPC')
    expect(within(forste!).getByText('KI-agent')).toBeTruthy()
    expect(within(forste!).getByText('Kuratering')).toBeTruthy()
    expect(andre?.textContent).toContain('Rita Redaktør')
    // Uten oppsummering beskriver loggen endringen selv.
    expect(andre?.textContent).toContain('Dosering oppdatert')
    expect(within(andre!).getByText('Person')).toBeTruthy()
  })

  it('viser hvem som gjorde endringen med profilbildet, også for kuratorboten', async () => {
    const system = endring('s1', '2026-10-11T08:00:00Z', { aktor: 'system', person: null, profil: null })
    const { user } = vis([{ endringer: [KURATERING, endring('e1', '2026-10-12T08:15:00Z'), system], flere: false }])
    await user.click(screen.getByRole('button', { name: 'Endringslogg' }))
    const lag = await screen.findByRole('dialog', { name: 'Endringslogg: Syntetin' })
    const [kurator, rita, systemet] = (await within(lag).findAllByRole('listitem')).filter((f) =>
      f.classList.contains('loggskuff'),
    )
    // Agentens egen profil gir bildet og navnet; agentnavnet står i detaljene.
    expect(kurator!.querySelector('.avatar img')?.getAttribute('src')).toBe('https://bilder.test/kuratorbot/avatar.webp')
    expect(kurator!.querySelector('.innholdslogg__hvem')?.textContent).toBe('Kurator Bot')
    await user.click(within(kurator!).getByRole('button', { expanded: false }))
    expect(within(kurator!).getByText('ChatGPT monografikurator')).toBeTruthy()
    // Uten profilbilde: forbokstavene.
    expect(rita!.querySelector('.avatar img')).toBeNull()
    expect(rita!.querySelector('.avatar__initialer')?.textContent).toBe('RR')
    // Systemet har ingen profil.
    expect(systemet!.querySelector('.avatar--system')).not.toBeNull()
    expect(systemet!.querySelector('.innholdslogg__hvem')?.textContent).toBe('Systemet')
  })

  it('viser rapporten, migrasjonen og lenkene når en kuratering foldes ut', async () => {
    const { user } = vis([{ endringer: [KURATERING], flere: false }])
    await user.click(screen.getByRole('button', { name: 'Endringslogg' }))
    await user.click(await screen.findByRole('button', { name: /Kurator Bot/ }))
    const lag = screen.getByRole('dialog')
    expect(within(lag).getByText('Endret: Maksdose ved nyresvikt')).toBeTruthy()
    expect(within(lag).getByText('Feil enhet rettet')).toBeTruthy()
    expect(within(lag).getByText('SPC oppdatert 2026')).toBeTruthy()
    expect(within(lag).getByText('Data for barn mangler')).toBeTruthy()
    expect(lag?.textContent).toContain('bekreftet kjørt i databasen')
    expect(within(lag).getByRole('link', { name: /PR #999/ }).getAttribute('href')).toBe('https://github.com/peohol/far/pull/999')
    expect(within(lag).getByRole('link', { name: /Se migrasjonen/ }).getAttribute('href')).toBe(
      'https://github.com/peohol/ousfar/blob/main/supabase/migrations/20261013120000_syntetisk_kuratering.sql',
    )
  })

  it('merker en endring av en delt referanse og sier hva det betyr', async () => {
    const delt = endring('d1', '2026-10-12T08:15:00Z', {
      delt: true,
      aktor: 'system',
      person: null,
      deler: [{ ...dosering, type: 'referanse', for: { tittel: 'Felles kilde' }, etter: { tittel: 'Felles kilde, rettet' }, endret: ['innhold'], delt: true }],
    })
    const { user } = vis([{ endringer: [delt], flere: false }])
    await user.click(screen.getByRole('button', { name: 'Endringslogg' }))
    const lag = await screen.findByRole('dialog', { name: 'Endringslogg: Syntetin' })
    const [foring] = (await within(lag).findAllByRole('listitem')).filter((f) => f.classList.contains('loggskuff'))
    expect(within(foring!).getByText('Delt')).toBeTruthy()
    expect(foring!.textContent).toContain('Referanser: den delte referansen «Felles kilde, rettet» endret')
    await user.click(within(foring!).getByRole('button', { name: /System/ }))
    expect(lag.textContent).toContain('også brukes andre steder')
  })

  it('åpner historikken med revisjonene endringen gikk mellom', async () => {
    const { user, historikk } = vis([{ endringer: [endring('e1', '2026-10-12T08:15:00Z')], flere: false }])
    await user.click(screen.getByRole('button', { name: 'Endringslogg' }))
    await user.click(await screen.findByRole('button', { name: /Rita Redaktør/ }))
    await user.click(screen.getByRole('button', { name: 'Sammenlign' }))
    expect(await screen.findByRole('dialog', { name: 'Historikk: Dosering' })).toBeTruthy()
    expect(historikk).toHaveBeenCalledWith(KORT)
  })

  it('lar administratorer velge bort utkastene, og alle ta med rutinene', async () => {
    const { user, kall } = vis([{ endringer: [], flere: false }], true)
    await user.click(screen.getByRole('button', { name: 'Endringslogg' }))
    await screen.findByText('Ingen endringer å vise ennå.')
    expect(kall.at(-1)).toMatchObject({ medUtkast: true, medRutiner: false })
    await user.click(screen.getByRole('switch', { name: 'Vis utkast' }))
    await waitFor(() => expect(kall.at(-1)).toMatchObject({ medUtkast: false }))
    await user.click(screen.getByRole('switch', { name: 'Vis rutineendringer' }))
    await waitFor(() => expect(kall.at(-1)).toMatchObject({ medRutiner: true }))
  })

  it('har ikke valget for utkast for andre enn administratorer', async () => {
    const { user, kall } = vis([{ endringer: [], flere: false }])
    await user.click(screen.getByRole('button', { name: 'Endringslogg' }))
    await screen.findByText('Ingen endringer å vise ennå.')
    expect(screen.queryByRole('switch', { name: 'Vis utkast' })).toBeNull()
    expect(kall.at(-1)).toMatchObject({ medUtkast: false })
  })

  it('henter eldre endringer etter den siste', async () => {
    const { user, kall } = vis([
      { endringer: [endring('e2', '2026-10-12T09:00:00Z')], flere: true },
      { endringer: [endring('e1', '2026-10-11T09:00:00Z', { oppsummering: 'Den eldste' })], flere: false },
    ])
    await user.click(screen.getByRole('button', { name: 'Endringslogg' }))
    await user.click(await screen.findByRole('button', { name: 'Vis eldre endringer' }))
    expect(await screen.findByText('Den eldste')).toBeTruthy()
    expect(kall.at(-1)?.etter).toEqual({ kl: '2026-10-12T09:00:00Z', id: 'e2' })
    expect(screen.queryByRole('button', { name: 'Vis eldre endringer' })).toBeNull()
  })

  it('viser feilen når loggen ikke kan hentes', async () => {
    const leser: Endringsloggleser = { les: vi.fn(async () => Promise.reject(new Error('Endringsloggen er ikke satt opp i databasen ennå.'))) }
    render(
      <TipsLag>
        <FaginnholdskildeProvider kilde={{ leser: falskLeser({}), lager: {} as Faginnholdslager, kanRedigere: false }}>
          <Innholdslogg side={{ stoffregister: true }} sidenavn="Stoffregisteret" leser={leser} admin={false} />
        </FaginnholdskildeProvider>
      </TipsLag>,
    )
    await userEvent.setup().click(screen.getByRole('button', { name: 'Endringslogg' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/ikke satt opp/)
  })
})

describe('lenkene', () => {
  it('kalles PR og commit', () => {
    expect(lenketekst('https://github.com/peohol/far/pull/187')).toBe('PR #187')
    expect(lenketekst('https://github.com/peohol/far/commit/a1b2c3d4e5')).toBe('Commit a1b2c3d')
  })
})
