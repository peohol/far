/**
 * Kurateringskøen (`docs/kurateringsko.md`): forespørslene, reglene for
 * reservasjon, frister, feil og PR-er, prioriteringen, historikken fra repoet,
 * tallene fra en ekte database, og hele livsløpet gjennom git med en lokal
 * kopi av repoet som «origin»: samtidige reservasjoner, avbrudd, nye forsøk,
 * gjenopptakelse og publisering. Stoffene er syntetiske.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { lagFaginnholdslager } from '../faginnhold/lagring'
import { lagFaginnholdsleser } from '../faginnhold/lesing'
import { byggSidemodell, publiseringsplan } from '../faginnhold/stoffside'
import { SITERING } from '../faginnhold/referanser'
import { lesForesporsel } from '../kurateringsko/foresporsel'
import { lagGit, type Git } from '../kurateringsko/git'
import type { Github } from '../kurateringsko/github'
import { kurateringerIRepo } from '../kurateringsko/historikk'
import { INNSTILLINGER, type Koinnstillinger } from '../kurateringsko/innstillinger'
import { kjorKo } from '../kurateringsko/kjoring'
import {
  behandle,
  forfaltModus,
  kobleApnePr,
  oppdaterGrener,
  oppdaterPr,
  oppdaterRepohistorikk,
  oppdaterStoffer,
  oversikt,
  oversiktMarkdown,
  rekkefolge,
  tomTilstand,
  utlop,
  vurder,
  type Prinfo,
  type Registerstoff,
  type Utrulling,
} from '../kurateringsko/ko'
import { maalSide, malRegisteret, REDAKSJONELLE_PANELER } from '../kurateringsko/maling'
import { lagGrenleser } from '../kurateringsko/grener'
import {
  FORESPORSELSFIL,
  KOFIL,
  KOGREN,
  KOMAPPE,
  NESTEFIL,
  SVARFIL,
  type Foresporsel,
  type Greninfo,
  type Kostoff,
  type Kotilstand,
  type Sidemaal,
  type Svar,
} from '../kurateringsko/modell'
import { faginnholdskall, nyDatabase, opprettBruker } from './hjelp/testdatabase'

// Innstillingene uten en pilot og i runde 1, så testene ikke avhenger av hva køen gjør nå.
const INNST: Koinnstillinger = { ...INNSTILLINGER, forrang: [], bare_forrang: false, de_novo_runde: 1 }
const ROT = fileURLToPath(new URL('../../', import.meta.url))
const T0 = '2026-11-02T08:00:00.000Z'
const om = (kl: string, timer: number) => new Date(Date.parse(kl) + timer * 3_600_000).toISOString()

/** Tall for en syntetisk side: `fylt` av de redaksjonelle seksjonene har innhold. */
const maal = (fylt: number, { uten_kilde = 0, referanser = 10, side = true } = {}): Sidemaal => ({
  kl: T0,
  side,
  elementer: side ? Math.max(fylt, uten_kilde) : 0,
  redaksjonelle_paneler: REDAKSJONELLE_PANELER.length,
  paneler_med_innhold: fylt,
  referanser,
  elementer_uten_kilde: uten_kilde,
})

const REGISTER: Registerstoff[] = [
  { stoff: 'alfa', navn: 'Alfa', aktiv: true, maal: maal(12) },
  { stoff: 'beta', navn: 'Beta', aktiv: true, maal: maal(2, { referanser: 1 }) },
  { stoff: 'gamma', navn: 'Gamma', aktiv: true, maal: maal(8, { uten_kilde: 6 }) },
]

let teller = 0
const f = (handling: Foresporsel['handling'], felt: Partial<Foresporsel> = {}) =>
  ({ foresporsel: { versjon: 1, id: `f${(teller += 1)}`, handling, ...felt } as Foresporsel })
const kontekst = (gren: string, na = T0, innst: Koinnstillinger = INNST) => ({ gren, sha256: `sha-${teller}`, na, kjoring: null, innst })

function ny(register = REGISTER, na = T0): Kotilstand {
  const t = tomTilstand(na)
  oppdaterStoffer(t, register, na)
  vurder(t, na, INNST)
  return t
}

describe('forespørselen', () => {
  it('tar imot handlingene med feltene de trenger', () => {
    expect(lesForesporsel(JSON.stringify({ versjon: 1, id: '2026-11-02T08:00Z', handling: 'reserver' }))).toEqual({
      foresporsel: { versjon: 1, id: '2026-11-02T08:00Z', handling: 'reserver' },
    })
    expect(
      lesForesporsel(
        JSON.stringify({ versjon: 1, id: 'a', handling: 'fullfort', oppgave: 'alfa-0001', pr: 12, kunnskapsgrense: '2026-11-01', kurateringsgren: 'kuratering/alfa-0001', grunn: undefined }),
      ).foresporsel,
    ).toMatchObject({ pr: 12, kunnskapsgrense: '2026-11-01', kurateringsgren: 'kuratering/alfa-0001' })
    // Fritekst renses for kontrolltegn.
    expect(lesForesporsel(JSON.stringify({ versjon: 1, id: 'b', handling: 'feilet', oppgave: 'x', grunn: 'linje\n  to' })).foresporsel?.grunn).toBe('linje to')
  })

  it('avviser det køen ikke kan bruke, og sier hva som er galt', () => {
    const feil = (v: unknown) => lesForesporsel(typeof v === 'string' ? v : JSON.stringify(v)).feil ?? []
    expect(feil('{')).toEqual(['Forespørselen er ikke gyldig JSON.'])
    expect(feil({ versjon: 1, id: 'a', handling: 'slett' })).toHaveLength(1)
    expect(feil({ versjon: 1, id: 'a b', handling: 'status' })).toHaveLength(1)
    expect(feil({ versjon: 1, id: 'a', handling: 'fullfort', oppgave: 'x' })).toEqual([
      'fullfort krever feltet kunnskapsgrense.',
      'fullfort krever enten pr (en PR med kurateringen) eller gren (kurateringsgrenen i OUSFAR), ikke begge.',
    ])
    expect(feil({ versjon: 1, id: 'a', handling: 'fullfort', oppgave: 'x', pr: 1, kunnskapsgrense: '2026-02-30' })).toEqual(['kunnskapsgrense må være en dato, ÅÅÅÅ-MM-DD.'])
    expect(feil({ versjon: 1, id: 'a', handling: 'reserver', oppgave: 'x' })).toEqual(['Feltet oppgave hører ikke til handlingen reserver.'])
    expect(feil({ versjon: 1, id: 'a', handling: 'forny', oppgave: 'x', kurateringsgren: 'main' })).toHaveLength(1)
    expect(feil({ versjon: 1, id: 'a', handling: 'forny', oppgave: 'x', jobbgren: 'kuratorjobb/../main' })).toHaveLength(1)
    expect(feil({ versjon: 1, id: 'a', handling: 'feilet', oppgave: 'x', grunn: 'x'.repeat(301) })).toHaveLength(1)
  })
})

describe('reservasjonene', () => {
  it('gir ut det stoffet som står først, og bare ett om gangen', () => {
    const t = ny()
    const a = behandle(t, f('reserver'), kontekst('kurateringsko/okt/a'))
    expect(a).toMatchObject({ utfall: 'ok', oppgave: { stoff: 'beta', modus: 'de_novo', forsok: 1, oppgave: 'beta-0001', kurateringsgren: 'kuratering/beta-0001', jobbgren: 'kuratorjobb/beta-0001' } })
    expect(a.oppgave!.frist_kl).toBe(om(T0, 3))
    // En annen økt samtidig får ingenting; samme økt får den samme igjen.
    expect(behandle(t, f('reserver'), kontekst('kurateringsko/okt/b'))).toMatchObject({ utfall: 'ingen_oppgave' })
    expect(behandle(t, f('reserver'), kontekst('kurateringsko/okt/a'))).toMatchObject({ utfall: 'ok', oppgave: { oppgave: 'beta-0001' } })
    expect(t.stoffer.beta!.status).toBe('reservert')
    expect(t.teller).toBe(1)
  })

  it('gir det samme svaret på den samme forespørselen, og avviser en gjenbrukt ID', () => {
    const t = ny()
    const reserver = f('reserver')
    const forste = behandle(t, reserver, kontekst('kurateringsko/okt/a'))
    expect(behandle(t, reserver, { ...kontekst('kurateringsko/okt/a'), sha256: forste.foresporsel_sha256 })).toEqual(forste)
    expect(behandle(t, reserver, { ...kontekst('kurateringsko/okt/a'), sha256: 'annet' })).toMatchObject({ utfall: 'avvist' })
    expect(t.teller).toBe(1)
  })

  it('reserverer et bestemt stoff, når det er klart', () => {
    const t = ny()
    expect(behandle(t, f('forhandsvis', { stoff: 'Gamma' }), kontekst('kurateringsko/okt/a'))).toMatchObject({ utfall: 'ok', oppgave: { stoff: 'gamma' } })
    expect(t.teller).toBe(0)
    expect(behandle(t, f('reserver', { stoff: 'gamma' }), kontekst('kurateringsko/okt/a'))).toMatchObject({ utfall: 'ok', oppgave: { stoff: 'gamma' } })
    expect(behandle(t, f('reserver', { stoff: 'delta' }), kontekst('kurateringsko/okt/b'))).toMatchObject({ utfall: 'ingen_oppgave' })
  })

  it('lar bare økten som reserverte, fornye og avslutte, og avviser en oppgave som er avsluttet', () => {
    const t = ny()
    const { oppgave } = behandle(t, f('reserver'), kontekst('kurateringsko/okt/a')).oppgave!
    expect(behandle(t, f('forny', { oppgave }), kontekst('kurateringsko/okt/b'))).toMatchObject({ utfall: 'avvist' })
    const fornyet = behandle(t, f('forny', { oppgave, fase: 'Kildesøk', pr: 7 }), kontekst('kurateringsko/okt/a', om(T0, 2)))
    expect(fornyet).toMatchObject({ utfall: 'ok', oppgave: { frist_kl: om(T0, 5), pr: 7 } })
    // Høyst 24 timer fra reservasjonen.
    expect(behandle(t, f('forny', { oppgave }), kontekst('kurateringsko/okt/a', om(T0, 23))).oppgave!.frist_kl).toBe(om(T0, 24))
    behandle(t, f('frigi', { oppgave }), kontekst('kurateringsko/okt/a', om(T0, 23)))
    expect(behandle(t, f('forny', { oppgave }), kontekst('kurateringsko/okt/a', om(T0, 23)))).toMatchObject({ utfall: 'avvist', melding: expect.stringContaining('ikke reservert lenger') })
  })
})

describe('avbrudd, feil og nye forsøk', () => {
  it('avbryter en reservasjon som går ut, og fortsetter der neste gang', () => {
    const t = ny()
    const forste = behandle(t, f('reserver'), kontekst('kurateringsko/okt/a')).oppgave!
    behandle(t, f('forny', { oppgave: forste.oppgave, fase: 'Migrasjonen skrives', pr: 41 }), kontekst('kurateringsko/okt/a', om(T0, 1)))
    expect(utlop(t, om(T0, 3.5), INNST)).toEqual([])
    expect(utlop(t, om(T0, 4), INNST)).toEqual(['beta'])
    vurder(t, om(T0, 4), INNST)
    expect(t.stoffer.beta).toMatchObject({ status: 'klar', reservasjon: null, forsok: 1, gjenoppta: { oppgave: forste.oppgave, pr: 41, kurateringsgren: forste.kurateringsgren, fase: 'Migrasjonen skrives' } })
    // Gjenopptakelsen går foran alt annet, med de samme grenene og PR-en.
    const andre = behandle(t, f('reserver'), kontekst('kurateringsko/okt/c', om(T0, 4))).oppgave!
    expect(andre).toMatchObject({ stoff: 'beta', forsok: 2, kurateringsgren: forste.kurateringsgren, jobbgren: forste.jobbgren, pr: 41, gjenoppta: { oppgave: forste.oppgave } })
    expect(andre.oppgave).not.toBe(forste.oppgave)
  })

  it('venter etter en feil, og blokkerer etter for mange forsøk', () => {
    const t = ny([REGISTER[0]!])
    let na = T0
    for (let forsok = 1; forsok <= 3; forsok += 1) {
      const { oppgave } = behandle(t, f('reserver'), kontekst(`kurateringsko/okt/${forsok}`, na)).oppgave!
      behandle(t, f('feilet', { oppgave, grunn: 'Syntetisk feil.' }), kontekst(`kurateringsko/okt/${forsok}`, na))
      if (forsok < 3) {
        expect(t.stoffer.alfa).toMatchObject({ status: 'klar', tidligst_kl: om(na, 6) })
        expect(behandle(t, f('reserver'), kontekst('kurateringsko/okt/x', om(na, 1)))).toMatchObject({ utfall: 'ingen_oppgave', melding: expect.stringContaining(om(na, 6)) })
      }
      na = om(na, 7)
    }
    vurder(t, na, INNST)
    expect(t.stoffer.alfa).toMatchObject({ status: 'blokkert', forsok: 3, blokkeringer: [{ kode: 'for_mange_forsok' }] })
    expect(behandle(t, f('tilbakestill', { stoff: 'alfa', grunn: 'Sett på.' }), kontekst('kurateringsko/okt/admin', na))).toMatchObject({ utfall: 'ok' })
    expect(t.stoffer.alfa).toMatchObject({ status: 'klar', forsok: 0, blokkeringer: [], gjenoppta: null })
  })

  it('blokkerer et stoff kuratoren ikke kan gjøre, uten å telle det som et forsøk', () => {
    const t = ny()
    const { oppgave } = behandle(t, f('reserver'), kontekst('kurateringsko/okt/a')).oppgave!
    behandle(t, f('blokkert', { oppgave, grunn: 'Kildene motsier hverandre; trenger en avklaring.' }), kontekst('kurateringsko/okt/a'))
    expect(t.stoffer.beta).toMatchObject({ status: 'blokkert', forsok: 0, blokkeringer: [{ kode: 'agent', kilde: 'agent' }] })
    // Neste stoff kan kurateres.
    expect(behandle(t, f('reserver'), kontekst('kurateringsko/okt/b'))).toMatchObject({ utfall: 'ok', oppgave: { stoff: 'gamma' } })
  })
})

describe('fra ferdig fagarbeid til publisert', () => {
  const pr = (tilstand: Prinfo['tilstand'], endring: Partial<Prinfo> = {}): Prinfo => ({ nummer: 90, url: 'https://github.com/x/y/pull/90', tilstand, sammenslatt_kl: null, gren: 'kuratering/beta-0001', migrasjoner: true, ...endring })

  function ferdig() {
    const t = ny()
    const { oppgave } = behandle(t, f('reserver'), kontekst('kurateringsko/okt/a')).oppgave!
    expect(behandle(t, f('fullfort', { oppgave, pr: 90, kunnskapsgrense: '2026-11-01' }), kontekst('kurateringsko/okt/a', om(T0, 2)))).toMatchObject({ utfall: 'ok' })
    return t
  }

  it('skiller utkast, PR til godkjenning, sammenslått og publisert', () => {
    const t = ferdig()
    expect(t.stoffer.beta).toMatchObject({ status: 'fagarbeid_ferdig', reservasjon: null, pr: { nummer: 90, tilstand: 'ukjent', runde: 1 } })
    // PR-en som venter, holder ikke køen igjen.
    expect(behandle(t, f('reserver'), kontekst('kurateringsko/okt/b', om(T0, 2)))).toMatchObject({ utfall: 'ok', oppgave: { stoff: 'gamma' } })
    const steg = (info: Prinfo, utrulling: Utrulling | null, na: string) => {
      oppdaterPr(t, 'beta', info, utrulling, na)
      vurder(t, na, INNST)
      return t.stoffer.beta!.status
    }
    expect(steg(pr('utkast'), null, om(T0, 3))).toBe('fagarbeid_ferdig')
    expect(steg(pr('klar'), null, om(T0, 4))).toBe('venter_godkjenning')
    expect(steg(pr('sammenslatt', { sammenslatt_kl: om(T0, 5) }), { status: 'venter' }, om(T0, 5))).toBe('sammenslatt')
    expect(steg(pr('sammenslatt', { sammenslatt_kl: om(T0, 5) }), { status: 'feilet', kl: om(T0, 5.1) }, om(T0, 5.2))).toBe('sammenslatt')
    expect(t.stoffer.beta!.blokkeringer).toMatchObject([{ kode: 'utrulling_feilet' }])
    expect(steg(pr('sammenslatt', { sammenslatt_kl: om(T0, 5) }), { status: 'vellykket', kl: om(T0, 6) }, om(T0, 6))).toBe('publisert')
    expect(t.stoffer.beta).toMatchObject({
      pr: null,
      forsok: 0,
      blokkeringer: [],
      modus: null,
      sist_kuratert: { kl: om(T0, 6), modus: 'de_novo', kunnskapsgrense: '2026-11-01', runde: 1, pr: 90, kilde: 'ko' },
    })
    expect(t.stoffer.beta!.historikk.map((h) => h.hendelse)).toEqual(['oppdaget', 'reservert', 'fullfort', 'pr_utkast', 'pr_klar', 'pr_sammenslatt', 'publisert'])
  })

  it('blokkerer når PR-en lukkes uten å bli slått sammen, og avviser en PR som hører til et annet stoff', () => {
    const t = ferdig()
    const { oppgave } = behandle(t, f('reserver'), kontekst('kurateringsko/okt/b')).oppgave!
    expect(behandle(t, f('fullfort', { oppgave, pr: 90, kunnskapsgrense: '2026-11-01' }), kontekst('kurateringsko/okt/b'))).toMatchObject({ utfall: 'avvist' })
    oppdaterPr(t, 'beta', pr('lukket'), null, om(T0, 3))
    vurder(t, om(T0, 3), INNST)
    expect(t.stoffer.beta).toMatchObject({ status: 'blokkert', pr: null, blokkeringer: [{ kode: 'pr_lukket' }] })
  })

  it('godtar ikke en PR fra en annen gren som den ferdige kurateringen, men fortsetter på kurateringsgrenen', () => {
    const t = ferdig()
    // Et feil nummer: en annen PR som er slått sammen og rullet ut.
    oppdaterPr(t, 'beta', pr('sammenslatt', { sammenslatt_kl: om(T0, 3), gren: 'claude/noe-annet' }), { status: 'vellykket', kl: om(T0, 3) }, om(T0, 3))
    vurder(t, om(T0, 3), INNST)
    expect(t.stoffer.beta).toMatchObject({
      status: 'klar',
      pr: null,
      sist_kuratert: null,
      forsok: 1,
      gjenoppta: { oppgave: 'beta-0001', kurateringsgren: 'kuratering/beta-0001', pr: null },
    })
    expect(t.stoffer.beta!.historikk.at(-1)).toMatchObject({ hendelse: 'pr_feil_gren' })
    // Neste forsøk fortsetter på samme gren, og finner den riktige PR-en derfra.
    kobleApnePr(t, [{ nummer: 91, gren: 'kuratering/beta-0001' }], om(T0, 4))
    vurder(t, om(T0, 4), INNST)
    expect(behandle(t, f('reserver'), kontekst('kurateringsko/okt/c', om(T0, 4)))).toMatchObject({
      utfall: 'ok',
      oppgave: { stoff: 'beta', kurateringsgren: 'kuratering/beta-0001', pr: 91 },
    })
  })

  it('setter publiserte stoffer i køen igjen for evidensovervåkning og nye de novo-runder', () => {
    const t = ny()
    const s = t.stoffer.alfa!
    s.sist_kuratert = { kl: T0, modus: 'de_novo', kunnskapsgrense: '2026-10-01', runde: 1, pr: 5, kilde: 'ko' }
    expect(forfaltModus(s, T0, INNST)).toBeNull()
    const med = { ...INNST, aktive_modi: ['de_novo', 'evidensovervaking'] as const }
    expect(forfaltModus(s, '2027-03-29T00:00:00.000Z', med)).toBeNull()
    expect(forfaltModus(s, '2027-03-30T00:00:00.000Z', med)).toBe('evidensovervaking')
    expect(forfaltModus(s, T0, { ...INNST, de_novo_runde: 2 })).toBe('de_novo')
    // En eldre kuratering av en annen art gir de novo.
    s.sist_kuratert = { ...s.sist_kuratert, modus: 'oppdatering', runde: null }
    expect(forfaltModus(s, T0, INNST)).toBe('de_novo')
  })
})

describe('kurateringsgrenene i OUSFAR', () => {
  const GREN = '0b6f3c1e-1111-4000-8000-000000000001'
  const ANNEN = '0b6f3c1e-2222-4000-8000-000000000002'
  const gren = (status: Greninfo['status'], endring: Partial<Greninfo> = {}): Greninfo => ({
    id: GREN,
    stoff: 'beta',
    art: 'de_novo',
    status,
    revisjon: 1,
    runde: 0,
    oppdatert_kl: T0,
    publisert_kl: null,
    ...endring,
  })
  const steg = (t: Kotilstand, grener: Greninfo[] | null, na: string) => {
    oppdaterGrener(t, grener, na, INNST)
    vurder(t, na, INNST)
    return t.stoffer.beta!
  }

  it('følger grenen gjennom kontrollrundene, gir den tilbake til kuratoren for å rette og publisere, og publiserer stoffet', () => {
    const t = ny()
    const { oppgave } = behandle(t, f('reserver'), kontekst('kurateringsko/okt/a')).oppgave!
    // Kuratoren åpner grenen uten å melde den: køen kobler den til reservasjonen.
    steg(t, [gren('arbeid')], om(T0, 0.5))
    expect(t.stoffer.beta!.reservasjon).toMatchObject({ gren: GREN })
    expect(behandle(t, f('fullfort', { oppgave, gren: GREN, kunnskapsgrense: '2026-11-01' }), kontekst('kurateringsko/okt/a', om(T0, 1)))).toMatchObject({ utfall: 'ok' })
    expect(steg(t, [gren('klar', { runde: 1 })], om(T0, 2))).toMatchObject({ status: 'venter_godkjenning', appgren: { id: GREN, status: 'klar', kontrollrunde: 1 } })
    // En gren til kontroll holder ikke køen igjen.
    expect(behandle(t, f('reserver'), kontekst('kurateringsko/okt/b', om(T0, 2)))).toMatchObject({ utfall: 'ok', oppgave: { stoff: 'gamma' } })
    behandle(t, f('frigi', { oppgave: t.stoffer.gamma!.reservasjon!.oppgave }), kontekst('kurateringsko/okt/b', om(T0, 2)))

    // Kontrolløren ber om endringer: stoffet står først, med grenen å fortsette i, og runden teller ikke som et forsøk.
    const etterRunde = steg(t, [gren('tilbakemelding', { runde: 1 })], om(T0, 3))
    expect(etterRunde).toMatchObject({ status: 'klar', appgren: null, forsok: 0, gjenoppta: { oppgave, gren: GREN } })
    expect(rekkefolge(t, om(T0, 3), INNST)[0]!.stoff).toBe('beta')
    const andre = behandle(t, f('reserver'), kontekst('kurateringsko/okt/c', om(T0, 3))).oppgave!
    expect(andre).toMatchObject({ stoff: 'beta', gren: GREN })
    behandle(t, f('fullfort', { oppgave: andre.oppgave, gren: GREN, kunnskapsgrense: '2026-11-01' }), kontekst('kurateringsko/okt/c', om(T0, 4)))

    // Godkjent: tilbake til kuratoren, som publiserer.
    expect(steg(t, [gren('godkjent', { revisjon: 2, runde: 2 })], om(T0, 5))).toMatchObject({ status: 'klar', gjenoppta: { gren: GREN } })
    const tredje = behandle(t, f('reserver'), kontekst('kurateringsko/okt/d', om(T0, 5))).oppgave!
    expect(tredje).toMatchObject({ stoff: 'beta', gren: GREN })
    behandle(t, f('fullfort', { oppgave: tredje.oppgave, gren: GREN, kunnskapsgrense: '2026-11-01' }), kontekst('kurateringsko/okt/d', om(T0, 6)))
    expect(steg(t, [gren('publisert', { revisjon: 2, runde: 2, publisert_kl: om(T0, 6) })], om(T0, 6))).toMatchObject({
      status: 'publisert',
      appgren: null,
      gjenoppta: null,
      sist_kuratert: { kl: om(T0, 6), modus: 'de_novo', kunnskapsgrense: '2026-11-01', runde: 1, pr: null, gren: GREN, kilde: 'ko' },
    })
    expect(oversikt(t, om(T0, 6), INNST).til_gjennomgang).toEqual([])
  })

  it('gir rettinger ut før nye stoffer, og et nytt stoff bare når færre grener enn grensen venter på kontroll', () => {
    const innst = { ...INNST, maks_til_kontroll: 2 }
    const k = (okt: string, timer: number, grener?: Greninfo[] | null) => ({ ...kontekst(`kurateringsko/okt/${okt}`, om(T0, timer), innst), grener })
    const tilKontroll = (stoff: string, nr: number, status: Greninfo['status'] = 'klar') => gren(status, { id: `0b6f3c1e-4444-4000-8000-00000000000${nr}`, stoff, runde: 1 })

    // To grener venter på kontrolløren (også grener køen ikke følger, teller): ingen nye stoffer.
    const t = ny()
    const fulle = [tilKontroll('alfa', 1), tilKontroll('gamma', 2)]
    expect(behandle(t, f('reserver'), k('a', 0, fulle))).toMatchObject({ utfall: 'ingen_oppgave', melding: expect.stringContaining('2 kurateringsgrener venter på kontroll') })
    expect(behandle(t, f('reserver', { stoff: 'beta' }), k('a', 0, fulle))).toMatchObject({ utfall: 'avvist', melding: expect.stringContaining('færre enn 2') })
    // Kan grenene ikke leses, vet køen ikke hvor mange som venter, og gir ikke ut et nytt stoff.
    expect(behandle(t, f('reserver'), k('a', 0, null))).toMatchObject({ utfall: 'ingen_oppgave', melding: expect.stringContaining('kunne ikke leses') })
    // En gren som rettes, venter ikke på kontrolløren.
    const { oppgave } = behandle(t, f('reserver'), k('a', 0, [tilKontroll('alfa', 1), tilKontroll('gamma', 2, 'retting')])).oppgave!
    expect(t.stoffer.beta!.reservasjon).toMatchObject({ oppgave })
    behandle(t, f('fullfort', { oppgave, gren: GREN, kunnskapsgrense: '2026-11-01' }), k('a', 1))

    // Uten grenene fra OUSFAR (lokalt) teller grenene køen følger.
    steg(t, [gren('klar', { runde: 1 })], om(T0, 2))
    expect(behandle(t, f('reserver'), { ...kontekst('kurateringsko/okt/b', om(T0, 2), { ...innst, maks_til_kontroll: 1 }) })).toMatchObject({
      utfall: 'ingen_oppgave',
      melding: expect.stringContaining('1 kurateringsgren venter på kontroll'),
    })

    // Kontrolløren ber om endringer i beta: et nytt stoff venter til beta er rettet, også når det er bedt om ved navn, og når grenene ikke kan leses.
    steg(t, [gren('tilbakemelding', { runde: 1 })], om(T0, 3))
    expect(behandle(t, f('reserver', { stoff: 'gamma' }), k('c', 3, []))).toMatchObject({ utfall: 'avvist', melding: expect.stringContaining('beta skal rettes eller fortsettes først') })
    expect(behandle(t, f('forhandsvis', { stoff: 'alfa' }), k('c', 3, [])).utfall).toBe('avvist')
    expect(oversikt(t, om(T0, 3), innst).holdes_tilbake).toBeNull()
    const retting = behandle(t, f('reserver'), k('c', 3, null)).oppgave!
    expect(retting).toMatchObject({ stoff: 'beta', gren: GREN })
    behandle(t, f('fullfort', { oppgave: retting.oppgave, gren: GREN, kunnskapsgrense: '2026-11-01' }), k('c', 4))
    expect(behandle(t, f('reserver', { stoff: 'gamma' }), k('d', 4, [gren('klar', { runde: 2 })]))).toMatchObject({ utfall: 'ok', oppgave: { stoff: 'gamma' } })
  })

  it('sier i oversikten hvorfor neste stoff ikke gis ut', () => {
    const t = ny()
    const innst = { ...INNST, maks_til_kontroll: 1 }
    const { oppgave } = behandle(t, f('reserver', { stoff: 'beta' }), kontekst('kurateringsko/okt/a')).oppgave!
    behandle(t, f('fullfort', { oppgave, gren: GREN, kunnskapsgrense: '2026-11-01' }), kontekst('kurateringsko/okt/a', om(T0, 1)))
    steg(t, [gren('klar', { runde: 1 })], om(T0, 1))
    expect(oversikt(t, om(T0, 1), innst).holdes_tilbake).toContain('1 kurateringsgren venter på kontroll')
    expect(oversiktMarkdown(t, om(T0, 1), innst)).toContain('Neste stoff gis ikke ut nå: 1 kurateringsgren venter på kontroll')
    expect(oversikt(t, om(T0, 1), INNST).holdes_tilbake).toBeNull()
  })

  it('følger en ny kontrollrunde med samme revisjon som den forrige, når kuratoren har svart uten å rette', () => {
    const t = ny()
    const { oppgave } = behandle(t, f('reserver', { stoff: 'beta' }), kontekst('kurateringsko/okt/a')).oppgave!
    behandle(t, f('fullfort', { oppgave, gren: GREN, kunnskapsgrense: '2026-11-01' }), kontekst('kurateringsko/okt/a', om(T0, 1)))
    steg(t, [gren('klar', { runde: 1 })], om(T0, 1))
    expect(steg(t, [gren('tilbakemelding', { runde: 1 })], om(T0, 2))).toMatchObject({ status: 'klar', appgren: null, gjenoppta: { oppgave, gren: GREN } })
    const igjen = behandle(t, f('reserver'), kontekst('kurateringsko/okt/b', om(T0, 2))).oppgave!
    expect(igjen).toMatchObject({ stoff: 'beta', gren: GREN })
    behandle(t, f('fullfort', { oppgave: igjen.oppgave, gren: GREN, kunnskapsgrense: '2026-11-01' }), kontekst('kurateringsko/okt/b', om(T0, 3)))
    expect(steg(t, [gren('klar', { runde: 2 })], om(T0, 3))).toMatchObject({
      status: 'venter_godkjenning',
      appgren: { id: GREN, status: 'klar', revisjon: 1, kontrollrunde: 2 },
    })
    // En ny runde køen ikke rakk å se, står i historikken også når statusen og revisjonen er de samme.
    expect(steg(t, [gren('klar', { runde: 3 })], om(T0, 4)).historikk.at(-1)).toMatchObject({
      hendelse: 'gren_klar',
      melding: 'Grenen: klar, revisjon 1, kontrollrunde 3.',
    })
    expect(steg(t, [gren('godkjent', { runde: 3 })], om(T0, 5))).toMatchObject({ status: 'klar', gjenoppta: { gren: GREN } })
  })

  it('fører en reservert eller gitt tilbake gren som publisert eller forkastet, også når kuratoren ikke rakk å melde den', () => {
    const t = ny()
    // Godkjent og gitt tilbake til kuratoren, som reserverer og publiserer, men stopper før fullfort.
    const { oppgave } = behandle(t, f('reserver', { stoff: 'beta' }), kontekst('kurateringsko/okt/a')).oppgave!
    behandle(t, f('fullfort', { oppgave, gren: GREN, kunnskapsgrense: '2026-11-01' }), kontekst('kurateringsko/okt/a', om(T0, 1)))
    steg(t, [gren('godkjent', { runde: 1 })], om(T0, 2))
    const igjen = behandle(t, f('reserver'), kontekst('kurateringsko/okt/b', om(T0, 2))).oppgave!
    expect(igjen).toMatchObject({ stoff: 'beta', gren: GREN })
    expect(steg(t, [gren('publisert', { runde: 1, publisert_kl: om(T0, 3) })], om(T0, 3))).toMatchObject({
      status: 'publisert',
      reservasjon: null,
      gjenoppta: null,
      siste_kjoring: { utfall: 'fullfort' },
      // Kunnskapsgrensen fra kontrollrunden følger grenen til publiseringen.
      sist_kuratert: { kl: om(T0, 3), modus: 'de_novo', kunnskapsgrense: '2026-11-01', runde: 1, gren: GREN, kilde: 'ko' },
    })
    // Et fullfort etter at køen har sett publiseringen, godtas uten å endre noe; fra en annen økt avvises det.
    const sen = f('fullfort', { oppgave: igjen.oppgave, gren: GREN, kunnskapsgrense: '2026-11-02' })
    expect(behandle(t, sen, kontekst('kurateringsko/okt/b', om(T0, 3.5)))).toMatchObject({ utfall: 'ok' })
    expect(behandle(t, { foresporsel: { ...sen.foresporsel, id: 'annen' } }, kontekst('kurateringsko/okt/x', om(T0, 3.5))).utfall).toBe('avvist')
    expect(t.stoffer.beta!.sist_kuratert).toMatchObject({ kunnskapsgrense: '2026-11-01' })
    expect(behandle(t, f('reserver', { stoff: 'beta' }), kontekst('kurateringsko/okt/c', om(T0, 4))).utfall).not.toBe('ok')

    // Uten kunnskapsgrense (en gren publisert før den ble meldt ferdig): et sent fullfort fra økten fører den inn.
    const v = ny()
    const uten = behandle(v, f('reserver', { stoff: 'beta' }), kontekst('kurateringsko/okt/a')).oppgave!
    behandle(v, f('forny', { oppgave: uten.oppgave, gren: GREN }), kontekst('kurateringsko/okt/a', om(T0, 1)))
    expect(steg(v, [gren('publisert', { runde: 1, publisert_kl: om(T0, 2) })], om(T0, 2))).toMatchObject({ sist_kuratert: { kunnskapsgrense: null } })
    expect(behandle(v, f('fullfort', { oppgave: uten.oppgave, gren: GREN, kunnskapsgrense: '2026-11-01' }), kontekst('kurateringsko/okt/a', om(T0, 3)))).toMatchObject({ utfall: 'ok' })
    expect(v.stoffer.beta!.sist_kuratert).toMatchObject({ kunnskapsgrense: '2026-11-01', gren: GREN })

    // En gren som står i et avbrutt forsøk, og som forkastes: stoffet blokkeres, og forsøket glemmes.
    const u = ny()
    const a = behandle(u, f('reserver', { stoff: 'beta' }), kontekst('kurateringsko/okt/a')).oppgave!
    behandle(u, f('frigi', { oppgave: a.oppgave, gren: GREN, grunn: 'Tiden strakk ikke til' }), kontekst('kurateringsko/okt/a', om(T0, 1)))
    expect(u.stoffer.beta!.gjenoppta).toMatchObject({ gren: GREN })
    expect(steg(u, [gren('arkivert')], om(T0, 2))).toMatchObject({ status: 'blokkert', gjenoppta: null, blokkeringer: [{ kode: 'gren_forkastet' }] })
  })

  it('blokkerer et stoff med en aktiv gren køen ikke følger, eller en gren som er stanset, forkastet eller borte', () => {
    const t = ny()
    expect(steg(t, [gren('arbeid', { id: ANNEN, art: 'gjenoppretting' })], T0)).toMatchObject({ status: 'blokkert', blokkeringer: [{ kode: 'annen_gren' }] })
    expect(steg(t, [gren('publisert', { id: ANNEN, art: 'gjenoppretting', publisert_kl: T0 })], om(T0, 1)).status).toBe('klar')

    const { oppgave } = behandle(t, f('reserver', { stoff: 'beta' }), kontekst('kurateringsko/okt/a', om(T0, 1))).oppgave!
    behandle(t, f('fullfort', { oppgave, gren: GREN, kunnskapsgrense: '2026-11-01' }), kontekst('kurateringsko/okt/a', om(T0, 2)))
    expect(steg(t, [gren('stanset')], om(T0, 3))).toMatchObject({ status: 'blokkert', blokkeringer: [{ kode: 'gren_stanset' }] })
    expect(steg(t, [gren('klar')], om(T0, 4))).toMatchObject({ status: 'venter_godkjenning', blokkeringer: [] })
    // Kan grenene ikke leses, står køen som den er.
    expect(steg(t, null, om(T0, 5))).toMatchObject({ status: 'venter_godkjenning' })
    expect(steg(t, [gren('arkivert')], om(T0, 6))).toMatchObject({ status: 'blokkert', appgren: null, blokkeringer: [{ kode: 'gren_forkastet' }] })
    expect(behandle(t, f('tilbakestill', { stoff: 'beta', grunn: 'Sett på' }), kontekst('kurateringsko/okt/x', om(T0, 7)))).toMatchObject({ utfall: 'ok' })
    expect(steg(t, [], om(T0, 7)).status).toBe('klar')
  })

  it('gir stoffet tilbake til kuratoren med grenen når et menneske har avgjort, og følger grenen til den er publisert', () => {
    const t = ny()
    const { oppgave } = behandle(t, f('reserver', { stoff: 'beta' }), kontekst('kurateringsko/okt/a')).oppgave!
    // Kuratoren har åpnet grenen, men må stoppe for en menneskelig avgjørelse før fullfort.
    behandle(t, f('blokkert', { oppgave, grunn: 'Krav 3: trenger en avgjørelse' }), kontekst('kurateringsko/okt/a', om(T0, 1)))
    expect(steg(t, [gren('klar')], om(T0, 1))).toMatchObject({ status: 'blokkert', gjenoppta: { oppgave, gren: GREN }, blokkeringer: [{ kode: 'agent' }] })
    // En vanlig tilbakestilling glemmer grenen, og da holder grenen stoffet ute av køen.
    expect(behandle(t, f('tilbakestill', { stoff: 'beta', grunn: 'Avgjort' }), kontekst('kurateringsko/okt/admin', om(T0, 2)))).toMatchObject({ utfall: 'ok' })
    expect(steg(t, [gren('klar')], om(T0, 2))).toMatchObject({ status: 'blokkert', gjenoppta: null, blokkeringer: [{ kode: 'annen_gren' }] })
    expect(behandle(t, f('reserver', { stoff: 'beta' }), kontekst('kurateringsko/okt/b', om(T0, 2))).utfall).toBe('avvist')

    // En gren som ikke finnes, ikke er aktiv, gjelder et annet stoff eller har feil art, avvises, og ingenting endres.
    const grener = [gren('klar'), gren('arbeid', { id: ANNEN, stoff: 'gamma' })]
    const avvist = (gid: string, liste: Greninfo[] | null, melding: string) =>
      expect(behandle(t, f('tilbakestill', { stoff: 'beta', grunn: 'Avgjort', gren: gid }), { ...kontekst('kurateringsko/okt/admin', om(T0, 3)), grener: liste })).toMatchObject({
        utfall: 'avvist',
        melding: expect.stringContaining(melding),
      })
    avvist('0b6f3c1e-3333-4000-8000-000000000003', grener, 'finnes ikke')
    avvist(ANNEN, grener, 'gjelder gamma, ikke beta')
    avvist(GREN, [gren('arkivert')], 'er ikke aktiv (arkivert)')
    avvist(GREN, [gren('stanset')], 'er stanset av en administrator')
    avvist(GREN, [gren('klar', { art: 'kuratering' })], 'en de_novo-kuratering må gjøres i en de_novo-gren')
    avvist(GREN, null, 'kunne ikke leses')
    expect(t.stoffer.beta).toMatchObject({ status: 'blokkert', gjenoppta: null, blokkeringer: [{ kode: 'annen_gren' }] })

    // Med grenen: neste kjøring ser grenen som stoffets, og stoffet gis ut igjen med den.
    expect(behandle(t, f('tilbakestill', { stoff: 'beta', grunn: 'Avgjort', gren: GREN }), { ...kontekst('kurateringsko/okt/admin', om(T0, 3)), grener })).toMatchObject({ utfall: 'ok' })
    expect(steg(t, grener, om(T0, 3))).toMatchObject({ status: 'klar', blokkeringer: [], forsok: 0, gjenoppta: { oppgave, gren: GREN } })
    expect(rekkefolge(t, om(T0, 3), INNST)[0]!.stoff).toBe('beta')
    const igjen = behandle(t, f('reserver', { stoff: 'beta' }), kontekst('kurateringsko/okt/b', om(T0, 3))).oppgave!
    expect(igjen).toMatchObject({ stoff: 'beta', gren: GREN, gjenoppta: { oppgave, gren: GREN } })
    expect(steg(t, grener, om(T0, 3.5))).toMatchObject({ status: 'reservert', blokkeringer: [] })
    expect(behandle(t, f('fullfort', { oppgave: igjen.oppgave, gren: GREN, kunnskapsgrense: '2026-11-01' }), { ...kontekst('kurateringsko/okt/b', om(T0, 4)), grener })).toMatchObject({
      utfall: 'ok',
    })
    expect(steg(t, grener, om(T0, 4))).toMatchObject({ status: 'venter_godkjenning', appgren: { id: GREN, status: 'klar' }, blokkeringer: [] })
    // Så lenge køen følger grenen, avvises tilbakestill, også med grenen.
    expect(behandle(t, f('tilbakestill', { stoff: 'beta', grunn: 'Avgjort', gren: GREN }), { ...kontekst('kurateringsko/okt/admin', om(T0, 4)), grener }).utfall).toBe('avvist')
    expect(steg(t, [gren('publisert', { publisert_kl: om(T0, 5) })], om(T0, 5))).toMatchObject({
      status: 'publisert',
      appgren: null,
      gjenoppta: null,
      sist_kuratert: { kl: om(T0, 5), modus: 'de_novo', kunnskapsgrense: '2026-11-01', gren: GREN, kilde: 'ko' },
    })
  })

  it('beholder det avbrutte forsøket og kunnskapsgrensen når et stoff blokkert under rettingen gis tilbake med grenen', () => {
    const t = ny()
    const a = behandle(t, f('reserver', { stoff: 'beta' }), kontekst('kurateringsko/okt/a')).oppgave!
    behandle(t, f('fullfort', { oppgave: a.oppgave, gren: GREN, kunnskapsgrense: '2026-11-01' }), kontekst('kurateringsko/okt/a', om(T0, 1)))
    steg(t, [gren('tilbakemelding', { runde: 1 })], om(T0, 2))
    const b = behandle(t, f('reserver'), kontekst('kurateringsko/okt/b', om(T0, 2))).oppgave!
    behandle(t, f('blokkert', { oppgave: b.oppgave, grunn: 'Krav 3: trenger en avgjørelse' }), kontekst('kurateringsko/okt/b', om(T0, 3)))
    expect(steg(t, [gren('retting', { runde: 1 })], om(T0, 3))).toMatchObject({ status: 'blokkert', gjenoppta: { oppgave: b.oppgave, gren: GREN, kunnskapsgrense: '2026-11-01' } })
    const grener = [gren('retting', { runde: 1 })]
    expect(behandle(t, f('tilbakestill', { stoff: 'beta', grunn: 'Avgjort', gren: GREN }), { ...kontekst('kurateringsko/okt/admin', om(T0, 4)), grener })).toMatchObject({ utfall: 'ok' })
    expect(steg(t, grener, om(T0, 4))).toMatchObject({ status: 'klar', blokkeringer: [], gjenoppta: { oppgave: b.oppgave, gren: GREN, kunnskapsgrense: '2026-11-01' } })
    expect(behandle(t, f('reserver'), kontekst('kurateringsko/okt/c', om(T0, 4))).oppgave).toMatchObject({ stoff: 'beta', gren: GREN })
    expect(
      lesForesporsel(JSON.stringify({ versjon: 1, id: 'x', handling: 'tilbakestill', stoff: 'beta', grunn: 'Avgjort', gren: GREN })).foresporsel,
    ).toMatchObject({ gren: GREN })
    expect(lesForesporsel(JSON.stringify({ versjon: 1, id: 'x', handling: 'tilbakestill', stoff: 'beta', grunn: 'Avgjort', gren: 'ikke-en-id' })).feil).toBeTruthy()
  })

  it('avviser en gren som hører til et annet stoff, og fullfort uten verken PR eller gren', () => {
    const t = ny()
    const a = behandle(t, f('reserver', { stoff: 'beta' }), kontekst('kurateringsko/okt/a')).oppgave!
    behandle(t, f('fullfort', { oppgave: a.oppgave, gren: GREN, kunnskapsgrense: '2026-11-01' }), kontekst('kurateringsko/okt/a'))
    const b = behandle(t, f('reserver', { stoff: 'gamma' }), kontekst('kurateringsko/okt/b')).oppgave!
    expect(behandle(t, f('forny', { oppgave: b.oppgave, gren: GREN }), kontekst('kurateringsko/okt/b'))).toMatchObject({ utfall: 'avvist' })
    expect(lesForesporsel(JSON.stringify({ versjon: 1, id: 'x', handling: 'fullfort', oppgave: 'o', kunnskapsgrense: '2026-11-01' })).feil).toBeTruthy()
    expect(lesForesporsel(JSON.stringify({ versjon: 1, id: 'x', handling: 'fullfort', oppgave: 'o', kunnskapsgrense: '2026-11-01', gren: 'ikke-en-id' })).feil).toBeTruthy()
    expect(lesForesporsel(JSON.stringify({ versjon: 1, id: 'x', handling: 'fullfort', oppgave: 'o', kunnskapsgrense: '2026-11-01', gren: GREN })).foresporsel).toMatchObject({ gren: GREN })
  })

  it('fører aldri en gren for et annet stoff som stoffets kuratering, verken mens den er aktiv eller når den er publisert', () => {
    const fremmed = (status: Greninfo['status'], endring: Partial<Greninfo> = {}) => gren(status, { id: ANNEN, stoff: 'gamma', ...endring })
    const ingenKuratering = (s: Kostoff) => {
      expect(s).toMatchObject({ sist_kuratert: null, appgren: null })
      expect(s.blokkeringer).toEqual(expect.arrayContaining([expect.objectContaining({ kode: 'gren_feil_kobling', grunn: expect.stringContaining(`gjelder gamma, ikke beta`) })]))
      expect(s.historikk.some((h) => h.hendelse === 'publisert')).toBe(false)
    }

    // Kan køen se grenen, avvises den straks, og reservasjonen står som før.
    const t = ny()
    const a = behandle(t, f('reserver', { stoff: 'beta' }), kontekst('kurateringsko/okt/a')).oppgave!
    const medGrener = { ...kontekst('kurateringsko/okt/a', om(T0, 1)), grener: [fremmed('arbeid')] }
    expect(behandle(t, f('fullfort', { oppgave: a.oppgave, gren: ANNEN, kunnskapsgrense: '2026-11-01' }), medGrener)).toMatchObject({
      utfall: 'avvist',
      melding: expect.stringContaining('gjelder gamma, ikke beta'),
    })
    expect(behandle(t, f('forny', { oppgave: a.oppgave, gren: ANNEN }), { ...medGrener, sha256: 'annen' })).toMatchObject({ utfall: 'avvist' })
    expect(t.stoffer.beta).toMatchObject({ status: 'reservert', reservasjon: { oppgave: a.oppgave, gren: null }, appgren: null })

    // Meldt mens grenene ikke kunne leses: koblingen brytes når køen ser grenen, mens den er aktiv.
    behandle(t, f('fullfort', { oppgave: a.oppgave, gren: ANNEN, kunnskapsgrense: '2026-11-01' }), kontekst('kurateringsko/okt/a', om(T0, 1)))
    const brutt = steg(t, [fremmed('arbeid')], om(T0, 2))
    ingenKuratering(brutt)
    expect(brutt).toMatchObject({ status: 'blokkert', gjenoppta: { oppgave: a.oppgave, gren: null } })
    expect(brutt.historikk.at(-1)).toMatchObject({ hendelse: 'gren_feil_kobling', oppgave: a.oppgave })
    expect(behandle(t, f('reserver', { stoff: 'beta' }), kontekst('kurateringsko/okt/b', om(T0, 2))).utfall).not.toBe('ok')

    // Riktig gren for stoffet kobles til forsøket, og kurateringen fortsetter og publiseres der.
    expect(steg(t, [fremmed('arbeid'), gren('arbeid')], om(T0, 3))).toMatchObject({ status: 'klar', blokkeringer: [], gjenoppta: { oppgave: a.oppgave, gren: GREN } })
    const igjen = behandle(t, f('reserver', { stoff: 'beta' }), kontekst('kurateringsko/okt/b', om(T0, 3))).oppgave!
    expect(igjen).toMatchObject({ stoff: 'beta', gren: GREN, gjenoppta: { oppgave: a.oppgave } })
    behandle(t, f('fullfort', { oppgave: igjen.oppgave, gren: GREN, kunnskapsgrense: '2026-11-01' }), { ...kontekst('kurateringsko/okt/b', om(T0, 4)), grener: [gren('klar')] })
    expect(steg(t, [fremmed('arbeid'), gren('publisert', { publisert_kl: om(T0, 5) })], om(T0, 5))).toMatchObject({ status: 'publisert', sist_kuratert: { gren: GREN } })

    // Publisert: hverken en gren til kontroll eller en reservert gren føres som stoffets kuratering.
    const u = ny()
    const b = behandle(u, f('reserver', { stoff: 'beta' }), kontekst('kurateringsko/okt/a')).oppgave!
    behandle(u, f('fullfort', { oppgave: b.oppgave, gren: ANNEN, kunnskapsgrense: '2026-11-01' }), kontekst('kurateringsko/okt/a', om(T0, 1)))
    ingenKuratering(steg(u, [fremmed('publisert', { publisert_kl: om(T0, 2) })], om(T0, 2)))
    expect(u.stoffer.gamma!.sist_kuratert).toBeNull()

    const v = ny()
    const c = behandle(v, f('reserver', { stoff: 'beta' }), kontekst('kurateringsko/okt/a')).oppgave!
    behandle(v, f('forny', { oppgave: c.oppgave, gren: ANNEN }), kontekst('kurateringsko/okt/a', om(T0, 1)))
    const holdt = steg(v, [fremmed('publisert', { publisert_kl: om(T0, 2) })], om(T0, 2))
    ingenKuratering(holdt)
    expect(holdt).toMatchObject({ reservasjon: { oppgave: c.oppgave, gren: null }, siste_kjoring: { utfall: 'reservert' } })
  })

  it('kobler aldri en gren av en annen art enn kurateringen krever, verken av seg selv, ved fullfort eller ved publisering', () => {
    const avgrenset = (status: Greninfo['status'], endring: Partial<Greninfo> = {}) => gren(status, { art: 'kuratering', ...endring })
    const t = ny()
    const a = behandle(t, f('reserver', { stoff: 'beta' }), kontekst('kurateringsko/okt/a')).oppgave!
    expect(a.modus).toBe('de_novo')
    // En avgrenset kuratering-gren kobles ikke til de novo-reservasjonen.
    const funnet = steg(t, [avgrenset('arbeid')], om(T0, 0.5))
    expect(funnet.reservasjon).toMatchObject({ gren: null })
    expect(funnet.blokkeringer).toEqual([expect.objectContaining({ kode: 'annen_gren', grunn: expect.stringContaining('en de_novo-kuratering må gjøres i en de_novo-gren') })])
    expect(
      behandle(t, f('fullfort', { oppgave: a.oppgave, gren: GREN, kunnskapsgrense: '2026-11-01' }), { ...kontekst('kurateringsko/okt/a', om(T0, 1)), grener: [avgrenset('klar')] }),
    ).toMatchObject({ utfall: 'avvist', melding: expect.stringContaining('er en kuratering-gren') })

    // Meldt uten at køen så grenen: den føres ikke som de novo-kurateringen når den publiseres.
    behandle(t, f('fullfort', { oppgave: a.oppgave, gren: GREN, kunnskapsgrense: '2026-11-01' }), kontekst('kurateringsko/okt/a', om(T0, 1)))
    const publisert = steg(t, [avgrenset('publisert', { publisert_kl: om(T0, 2) })], om(T0, 2))
    expect(publisert).toMatchObject({ sist_kuratert: null, appgren: null, status: 'blokkert', gjenoppta: { oppgave: a.oppgave, gren: null } })
    expect(publisert.blokkeringer).toEqual([expect.objectContaining({ kode: 'gren_feil_kobling' })])

    // Og en evidensovervåkning kan ikke føres på en de novo-gren.
    const u = ny()
    const b = behandle(u, f('reserver', { stoff: 'beta' }), kontekst('kurateringsko/okt/a')).oppgave!
    expect(
      behandle(u, f('fullfort', { oppgave: b.oppgave, gren: GREN, modus: 'evidensovervaking', kunnskapsgrense: '2026-11-01' }), {
        ...kontekst('kurateringsko/okt/a', om(T0, 1)),
        grener: [gren('klar')],
      }),
    ).toMatchObject({ utfall: 'avvist', melding: expect.stringContaining('en evidensovervaking-kuratering må gjøres i en kuratering-gren') })
  })

  it('leser grenene fra OUSFAR med OIDC-tokenet for kjøringen, og bare der det finnes', async () => {
    expect(lagGrenleser({})).toBeNull()
    const kall: { adresse: string; valg?: RequestInit }[] = []
    const hent = async (adresse: string, valg?: RequestInit) => {
      kall.push({ adresse, valg })
      if (adresse.startsWith('https://token')) return Response.json({ value: 'oidc-token' })
      return Response.json({ grener: [gren('klar'), { id: 'tull' }] })
    }
    const les = lagGrenleser(
      { OUSFAR_KO_ADRESSE: 'https://ousfar.example/api/kuratering-ko', ACTIONS_ID_TOKEN_REQUEST_URL: 'https://token.example/?x=1', ACTIONS_ID_TOKEN_REQUEST_TOKEN: 't' },
      hent,
    )!
    expect(await les()).toEqual([gren('klar')])
    expect(kall[0]!.adresse).toBe('https://token.example/?x=1&audience=ousfar')
    expect(kall[1]).toMatchObject({ adresse: 'https://ousfar.example/api/kuratering-ko', valg: { method: 'POST', headers: { Authorization: 'Bearer oidc-token' } } })
  })
})

describe('prioriteringen og stoffene', () => {
  it('setter stoffene som mangler innhold og kilder, og som ikke er kuratert, først', () => {
    const t = ny()
    expect(rekkefolge(t, T0, INNST).map((s) => s.stoff)).toEqual(['beta', 'gamma', 'alfa'])
    expect(t.stoffer.beta!.prioritet.grunner).toEqual(expect.arrayContaining(['Aldri kuratert.', 'Bare 1 referanser.']))
    // Nylig kuratert går bakerst.
    oppdaterRepohistorikk(t, { beta: { kl: om(T0, -24), modus: 'oppdatering', kunnskapsgrense: null, runde: null, pr: null, kilde: 'repo' } }, T0)
    vurder(t, T0, INNST)
    expect(rekkefolge(t, T0, INNST).map((s) => s.stoff)).toEqual(['gamma', 'alfa', 'beta'])
    // Forrang i innstillingene går foran.
    vurder(t, T0, { ...INNST, forrang: ['alfa'] })
    expect(rekkefolge(t, T0, INNST)[0]!.stoff).toBe('alfa')
  })

  it('gir bare ut stoffene i forrang under en pilot', () => {
    const t = ny()
    const pilot = { ...INNST, forrang: ['alfa'], bare_forrang: true }
    vurder(t, T0, pilot)
    expect(rekkefolge(t, T0, pilot).map((s) => s.stoff)).toEqual(['alfa'])
    expect(oversikt(t, T0, pilot).neste.map((n) => n.stoff)).toEqual(['alfa'])
    expect(t.stoffer.beta!.prioritet.grunner).toContain('Venter: køen gir bare ut stoffene som står først i innstillingene nå.')
    expect(behandle(t, f('reserver', { stoff: 'beta' }), kontekst('kurateringsko/okt/a', T0, pilot))).toMatchObject({
      utfall: 'avvist',
      melding: 'beta kan ikke reserveres nå: køen gir bare ut alfa.',
    })
    const a = behandle(t, f('reserver'), kontekst('kurateringsko/okt/a', T0, pilot))
    expect(a).toMatchObject({ utfall: 'ok', oppgave: { stoff: 'alfa' } })
    behandle(t, f('frigi', { oppgave: a.oppgave!.oppgave }), kontekst('kurateringsko/okt/a', T0, pilot))
    // Når alfa ikke kan gis ut, er det ingenting å gjøre, selv om andre stoffer er klare.
    vurder(t, T0, { ...pilot, utelatt: ['alfa'] })
    expect(behandle(t, f('reserver'), kontekst('kurateringsko/okt/a', T0, { ...pilot, utelatt: ['alfa'] }))).toMatchObject({ utfall: 'ingen_oppgave' })
  })

  it('går gjennom hele registeret i de novo-runde 2 etter piloten, uten å gi ut pilotstoffene igjen', () => {
    expect(INNSTILLINGER).toMatchObject({ forrang: [], bare_forrang: false, aktive_modi: ['de_novo'], de_novo_runde: 2 })
    const t = ny()
    const s = t.stoffer.alfa!
    // Kuratert i den første piloten (runde 1): forfalt i runden i grenene.
    s.sist_kuratert = { kl: T0, modus: 'de_novo', kunnskapsgrense: '2026-10-13', runde: 1, pr: null, kilde: 'repo' }
    expect(forfaltModus(s, T0, INNSTILLINGER)).toBe('de_novo')
    // Publisert fra en gren i piloten (runde 2): ikke forfalt.
    s.sist_kuratert = { kl: T0, modus: 'de_novo', kunnskapsgrense: '2026-10-16', runde: 2, pr: null, gren: '0b6f3c1e-2222-4000-8000-000000000002', kilde: 'ko' }
    expect(forfaltModus(s, T0, INNSTILLINGER)).toBeNull()
  })

  it('oppdager nye stoffer, og tar dem som ikke er aktive eller ikke har en fagside, ut av køen', () => {
    const t = ny()
    oppdaterStoffer(t, [...REGISTER.slice(1), { stoff: 'delta', navn: 'Delta', aktiv: true, maal: maal(0, { side: false }) }], om(T0, 1))
    vurder(t, om(T0, 1), INNST)
    expect(t.stoffer.alfa).toMatchObject({ aktiv: false, status: 'utenfor' })
    expect(t.stoffer.delta).toMatchObject({ status: 'blokkert', blokkeringer: [{ kode: 'uten_fagside', kilde: 'system' }] })
    expect(t.stoffer.delta!.historikk[0]).toMatchObject({ hendelse: 'oppdaget' })
    // Siden kommer: blokkeringen forsvinner av seg selv.
    oppdaterStoffer(t, [{ stoff: 'delta', navn: 'Delta', aktiv: true, maal: maal(1) }], om(T0, 2))
    vurder(t, om(T0, 2), INNST)
    expect(t.stoffer.delta).toMatchObject({ status: 'klar', blokkeringer: [] })
    expect(oversikt(t, om(T0, 2), INNST).antall).toMatchObject({ klar: 1, utenfor: 3 })
  })
})

describe('historikken i repoet', () => {
  const lesMappe = (mappe: string, monster: RegExp) =>
    readdirSync(join(ROT, mappe))
      .filter((n) => monster.test(n))
      .map((navn) => ({ navn, innhold: readFileSync(join(ROT, mappe, navn), 'utf8') }))

  it('finner de publiserte kurateringene og om de var de novo', () => {
    const spor = kurateringerIRepo(lesMappe('supabase/migrations', /monografkuratering.*\.sql$/), lesMappe('docs/kurateringsjournal', /\.md$/))
    expect(spor.citalopram).toMatchObject({ modus: 'de_novo', runde: 1, kunnskapsgrense: '2026-10-13', kilde: 'repo' })
    expect(spor.citalopram!.kl.slice(0, 10)).toBe('2026-10-13')
    expect(spor.thc).toMatchObject({ modus: 'oppdatering', kunnskapsgrense: '2026-10-10' })
    expect(spor.kvetiapin).toMatchObject({ modus: 'oppdatering' })
    expect(spor.ketamin).toMatchObject({ modus: 'oppdatering' })
    // Hjelpefunksjonene definerer kuratering_start, men kaller den ikke.
    expect(Object.keys(spor).sort()).toEqual(['citalopram', 'ketamin', 'kvetiapin', 'thc'])
  })

  it('bevarer de novo-status etter en avgrenset migrasjon dagen etter', () => {
    const spor = kurateringerIRepo([
      { navn: '20261013160000_citalopram_monografkuratering_de_novo.sql', innhold: "perform intern.kuratering_start('citalopram');" },
      { navn: '20261014090100_citalopram_monografkuratering_spc_og_kilder.sql', innhold: "perform intern.kuratering_start('citalopram');" },
    ], [{
      navn: 'citalopram.md',
      innhold: [
        '- **Kurateringsmodus:** avgrenset oppfølging; siste fullstendige modus: de novo',
        '- **Kunnskapsgrense:** full gjennomgang 2026-10-13; avgrenset SPC-kontroll 2026-10-14',
        '- **Siste fulle kjøring:** 2026-10-13',
        '- **Siste de novo-kjøring:** 2026-10-13',
      ].join('\n'),
    }])
    expect(spor.citalopram).toMatchObject({
      modus: 'de_novo',
      runde: 1,
      kunnskapsgrense: '2026-10-13',
      kilde: 'repo',
    })
    expect(spor.citalopram!.kl.slice(0, 10)).toBe('2026-10-13')

    const t = ny([{ stoff: 'citalopram', navn: 'Citalopram', aktiv: true, maal: maal(14) }])
    oppdaterRepohistorikk(t, spor, T0)
    expect(forfaltModus(t.stoffer.citalopram!, T0, INNST)).toBeNull()
  })

  it('kjenner igjen en kuratering etter kallet, ikke etter navnet eller en kommentar', () => {
    const spor = kurateringerIRepo(
      [
        { navn: '20261101000000_alfa_monografkuratering.sql', innhold: "-- select intern.kuratering_start('beta');\nselect intern.kuratering_start('alfa');" },
        { navn: '20261102000000_noe_annet.sql', innhold: "perform intern.kuratering_start( 'gamma' );" },
      ],
      [],
    )
    expect(Object.keys(spor).sort()).toEqual(['alfa', 'gamma'])
  })
})

describe('tallene fra databasen', () => {
  let resultat: Awaited<ReturnType<typeof malRegisteret>>
  let direkte: Sidemaal

  beforeAll(async () => {
    const db = await nyDatabase()
    const admin = await opprettBruker(db, { brukernavn: 'redaktor', fornavn: 'Rita', etternavn: 'Redaktør', rolle: 'admin' })
    const bruker = await opprettBruker(db, { brukernavn: 'kuratortest', fornavn: 'Kurator', etternavn: 'Test', rolle: 'user' })
    const kall = faginnholdskall(db, admin)
    const lager = lagFaginnholdslager(kall.klientFor(admin))
    const kilde = (await lager.opprettUtkast('referanse', { tittel: 'Syntetisk kilde', forfattere: 'Nordmann O', aar: '2020', lenke: '' })).id
    const side = (await lager.opprettUtkast('infoside', { navn: 'Syntetisk stoff' })).id
    const tekst = (sitert: boolean) => ({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Syntetisk.' }, ...(sitert ? [{ type: SITERING, attrs: { referanser: [kilde] } }] : [])] }],
    })
    await lager.opprettUtkast('innholdselement', { infoside: side, posisjon: 0, panel: 'indikasjon', elementtype: 'riktekst', data: { dokument: tekst(true) } })
    await lager.opprettUtkast('innholdselement', { infoside: side, posisjon: 0, panel: 'dosering', elementtype: 'riktekst', data: { dokument: tekst(false) } })
    const leser = lagFaginnholdsleser(kall.klientFor(admin))
    for (const steg of publiseringsplan(await leser.lesStoffside('syntetisk-stoff', 'utkast'))) await lager.publiserUtkast(steg.id, steg.revisjon)
    const klient = kall.klientFor(bruker)
    resultat = await malRegisteret(klient, T0)
    direkte = maalSide(byggSidemodell(await lagFaginnholdsleser(klient).lesStoffside('syntetisk-stoff', 'publisert')), T0)
  }, 120_000)

  it('leser alle de aktive stoffene i registeret, med tallene for sidene som finnes', () => {
    const syntetisk = resultat.stoffer.find((s) => s.stoff === 'syntetisk-stoff')
    expect(syntetisk).toEqual({ stoff: 'syntetisk-stoff', navn: 'Syntetisk stoff', aktiv: true, maal: direkte })
    expect(direkte).toMatchObject({ side: true, elementer: 2, paneler_med_innhold: 2, referanser: 1, elementer_uten_kilde: 1 })
    // Stoffene i datafilen uten publisert side i denne databasen.
    expect(resultat.stoffer.find((s) => s.stoff === 'citalopram')).toMatchObject({ aktiv: true, maal: { side: false } })
    expect(resultat.stoffer.length).toBeGreaterThan(90)
    expect(resultat.feilet).toBe(0)
    // Bare tall: ingenting av innholdet.
    expect(JSON.stringify(resultat)).not.toContain('Syntetisk kilde')
  })
})

/* --- Hele livsløpet gjennom git -------------------------------------------- */

describe('livsløpet gjennom git', () => {
  const mapper: string[] = []
  afterEach(() => {
    for (const m of mapper.splice(0)) rmSync(m, { recursive: true, force: true })
  })

  const kjorGit = (mappe: string, args: string[], env: NodeJS.ProcessEnv = {}) =>
    execFileSync('git', ['-c', 'user.name=Syntetisk', '-c', 'user.email=syntetisk@example.invalid', '-c', 'init.defaultBranch=main', ...args], {
      cwd: mappe,
      encoding: 'utf8',
      env: { ...process.env, ...env },
      stdio: 'pipe',
    })

  /** Et «origin» med main, klonen køen skriver gjennom, og en kuratoren skriver forespørsler fra. */
  function oppsett() {
    const mappe = mkdtempSync(join(tmpdir(), 'kurateringsko-'))
    mapper.push(mappe)
    kjorGit(mappe, ['init', '-q', '--bare', 'origin.git'])
    for (const navn of ['ko', 'kurator']) kjorGit(mappe, ['init', '-q', navn])
    const kurator = join(mappe, 'kurator')
    writeFileSync(join(kurator, 'README.md'), 'Syntetisk\n')
    kjorGit(kurator, ['add', '-A'])
    kjorGit(kurator, ['commit', '-qm', 'Start'])
    kjorGit(kurator, ['remote', 'add', 'origin', '../origin.git'])
    kjorGit(kurator, ['push', '-q', 'origin', 'HEAD:refs/heads/main'])
    kjorGit(join(mappe, 'ko'), ['remote', 'add', 'origin', '../origin.git'])
    return { mappe, kurator, origin: join(mappe, 'origin.git'), git: lagGit(join(mappe, 'ko')) }
  }

  let sekund = 0
  /** Kuratoren skriver en forespørsel på øktgrenen, oppå det som står der (med svarene). */
  function sporr(o: ReturnType<typeof oppsett>, gren: string, foresporsel: Omit<Foresporsel, 'versjon'>) {
    const finnes = kjorGit(o.kurator, ['ls-remote', '--heads', 'origin', gren]).trim() !== ''
    kjorGit(o.kurator, ['fetch', '-q', 'origin', finnes ? gren : 'main'])
    kjorGit(o.kurator, ['checkout', '-q', '-B', 'arbeid', 'FETCH_HEAD'])
    mkdirSync(join(o.kurator, KOMAPPE), { recursive: true })
    writeFileSync(join(o.kurator, FORESPORSELSFIL), JSON.stringify({ versjon: 1, ...foresporsel }))
    kjorGit(o.kurator, ['add', '-A'])
    // Faste, stigende tidspunkter, så rekkefølgen forespørslene kom i, er kjent.
    const dato = new Date(Date.parse('2026-11-02T07:00:00Z') + (sekund += 1) * 1000).toISOString()
    kjorGit(o.kurator, ['commit', '-qm', `Forespørsel ${foresporsel.id}`], { GIT_COMMITTER_DATE: dato, GIT_AUTHOR_DATE: dato })
    kjorGit(o.kurator, ['push', '-q', 'origin', `HEAD:refs/heads/${gren}`])
  }

  const vis = (o: ReturnType<typeof oppsett>, ref: string, fil: string) => JSON.parse(kjorGit(o.origin, ['show', `${ref}:${fil}`]))
  const svar = (o: ReturnType<typeof oppsett>, gren: string) => vis(o, gren, SVARFIL) as Svar
  const ko = (o: ReturnType<typeof oppsett>) => vis(o, KOGREN, KOFIL) as Kotilstand
  const commits = (o: ReturnType<typeof oppsett>, ref: string) => Number(kjorGit(o.origin, ['rev-list', '--count', ref]).trim())

  /** Et GitHub med PR-ene testen setter. */
  function falskGithub() {
    const prer = new Map<number, Prinfo>()
    const g: Github & { prer: typeof prer; utrullet: Utrulling; apne: { nummer: number; gren: string }[] } = {
      prer,
      utrullet: { status: 'venter' },
      apne: [],
      pr: async (n) => prer.get(n) ?? null,
      apnePr: async () => g.apne,
      utrulling: async () => g.utrullet,
    }
    return g
  }

  const kjor = (o: ReturnType<typeof oppsett>, na: string, github: Github | null = null, git: Git = o.git) =>
    kjorKo({
      git,
      github,
      maling: async () => ({ stoffer: REGISTER, feilet: 0 }),
      reserveregister: [],
      repo: { migrasjoner: [], journaler: [] },
      na: () => na,
      kjoring: 'https://example.invalid/kjoring',
      innst: INNST,
    })

  it('samtidige reservasjoner, feil, tidsavbrudd, gjenopptakelse og publisering', async () => {
    const o = oppsett()
    const github = falskGithub()

    // Første kjøring lager køen på en egen gren, uten noe fra main.
    await kjor(o, T0, github)
    expect(Object.keys(ko(o).stoffer).sort()).toEqual(['alfa', 'beta', 'gamma'])
    expect(kjorGit(o.origin, ['ls-tree', '-r', '--name-only', KOGREN]).trim().split('\n').sort()).toEqual([KOFIL, NESTEFIL, `${KOMAPPE}/oversikt.md`].sort())
    expect(vis(o, KOGREN, NESTEFIL).neste.map((n: { stoff: string }) => n.stoff)).toEqual(['beta', 'gamma', 'alfa'])

    // To kuratorer ber om en oppgave samtidig: den første får den, den andre ingenting.
    sporr(o, 'kurateringsko/okt/en', { id: '1', handling: 'reserver' })
    sporr(o, 'kurateringsko/okt/to', { id: '1', handling: 'reserver' })
    const forste = await kjor(o, T0, github)
    expect(forste.behandlet.map((b) => [b.gren, b.utfall])).toEqual([
      ['kurateringsko/okt/en', 'ok'],
      ['kurateringsko/okt/to', 'ingen_oppgave'],
    ])
    const oppgave = svar(o, 'kurateringsko/okt/en').oppgave!
    expect(oppgave).toMatchObject({ stoff: 'beta', modus: 'de_novo', forsok: 1 })
    expect(svar(o, 'kurateringsko/okt/en')).toMatchObject({ foresporsel_id: '1', kjoring: 'https://example.invalid/kjoring' })
    expect(svar(o, 'kurateringsko/okt/to')).toMatchObject({ utfall: 'ingen_oppgave', ko: { aktive: [{ stoff: 'beta' }] } })

    // En kjøring uten noe nytt endrer ingenting.
    const kocommits = commits(o, KOGREN)
    expect((await kjor(o, T0, github)).skrevet).toBe(true) // registrerer at svarene står
    expect((await kjor(o, T0, github)).skrevet).toBe(false)
    expect(commits(o, KOGREN)).toBe(kocommits + 1)

    // Kuratoren fornyer, lager PR-en og feiler så.
    sporr(o, 'kurateringsko/okt/en', { id: '2', handling: 'forny', oppgave: oppgave.oppgave, fase: 'Kildesøk' })
    await kjor(o, om(T0, 1), github)
    expect(svar(o, 'kurateringsko/okt/en')).toMatchObject({ foresporsel_id: '2', utfall: 'ok', oppgave: { frist_kl: om(T0, 4) } })
    github.apne = [{ nummer: 77, gren: oppgave.kurateringsgren }]
    sporr(o, 'kurateringsko/okt/en', { id: '3', handling: 'feilet', oppgave: oppgave.oppgave, grunn: 'Syntetisk feil i kuratorjobben.' })
    await kjor(o, om(T0, 2), github)
    expect(ko(o).stoffer.beta).toMatchObject({ status: 'klar', tidligst_kl: om(T0, 8), gjenoppta: { oppgave: oppgave.oppgave, pr: 77 } })

    // Mens beta venter, får en ny økt neste stoff; den går ut på tid.
    sporr(o, 'kurateringsko/okt/tre', { id: '1', handling: 'reserver' })
    await kjor(o, om(T0, 3), github)
    expect(svar(o, 'kurateringsko/okt/tre').oppgave).toMatchObject({ stoff: 'gamma' })
    const utlopt = await kjor(o, om(T0, 6.5), github)
    expect(utlopt.utlopt).toEqual(['gamma'])

    // Etter ventetiden fortsetter neste økt den avbrutte kurateringen av beta, i samme gren og PR.
    sporr(o, 'kurateringsko/okt/fire', { id: '1', handling: 'reserver' })
    await kjor(o, om(T0, 8), github)
    const andre = svar(o, 'kurateringsko/okt/fire').oppgave!
    expect(andre).toMatchObject({ stoff: 'beta', forsok: 2, kurateringsgren: oppgave.kurateringsgren, pr: 77, gjenoppta: { oppgave: oppgave.oppgave } })

    // Ferdig: PR-en følges til den er rullet ut.
    sporr(o, 'kurateringsko/okt/fire', { id: '2', handling: 'fullfort', oppgave: andre.oppgave, pr: 77, kunnskapsgrense: '2026-11-01' })
    github.prer.set(77, { nummer: 77, url: 'https://example.invalid/pull/77', tilstand: 'utkast', sammenslatt_kl: null, gren: oppgave.kurateringsgren, migrasjoner: true })
    await kjor(o, om(T0, 9), github)
    expect(ko(o).stoffer.beta!.status).toBe('fagarbeid_ferdig')
    github.prer.set(77, { ...github.prer.get(77)!, tilstand: 'klar' })
    await kjor(o, om(T0, 10), github)
    expect(ko(o).stoffer.beta!.status).toBe('venter_godkjenning')
    github.prer.set(77, { ...github.prer.get(77)!, tilstand: 'sammenslatt', sammenslatt_kl: om(T0, 11) })
    await kjor(o, om(T0, 11), github)
    expect(ko(o).stoffer.beta!.status).toBe('sammenslatt')
    github.utrullet = { status: 'vellykket', kl: om(T0, 11.2) }
    await kjor(o, om(T0, 12), github)
    expect(ko(o).stoffer.beta).toMatchObject({ status: 'publisert', sist_kuratert: { pr: 77, kunnskapsgrense: '2026-11-01', modus: 'de_novo', kilde: 'ko' } })
    expect(vis(o, KOGREN, NESTEFIL).antall).toMatchObject({ publisert: 1, klar: 2 })
  }, 120_000)

  it('gir ikke ut et nytt stoff når grenene i OUSFAR ikke kunne leses', async () => {
    const o = oppsett()
    const med = (grener: () => Promise<Greninfo[]>) =>
      kjorKo({ git: o.git, github: null, maling: async () => ({ stoffer: REGISTER, feilet: 0 }), grener, reserveregister: [], repo: { migrasjoner: [], journaler: [] }, na: () => T0, innst: INNST })
    sporr(o, 'kurateringsko/okt/en', { id: '1', handling: 'reserver' })
    await med(async () => {
      throw new Error('Syntetisk: OUSFAR svarer ikke.')
    })
    expect(svar(o, 'kurateringsko/okt/en')).toMatchObject({ utfall: 'ingen_oppgave', melding: expect.stringContaining('kunne ikke leses') })
    sporr(o, 'kurateringsko/okt/en', { id: '2', handling: 'reserver' })
    await med(async () => [])
    expect(svar(o, 'kurateringsko/okt/en')).toMatchObject({ utfall: 'ok', oppgave: { stoff: 'beta' } })
  }, 60_000)

  it('skriver svaret på nytt når kjøringen stoppet etter at køen var lagret', async () => {
    const o = oppsett()
    await kjor(o, T0)
    sporr(o, 'kurateringsko/okt/en', { id: '1', handling: 'reserver' })
    // Svaret kommer ikke fram: skyvingen til øktgrenen feiler.
    const uten: Git = { ...o.git, skyv: (c, g) => (g.startsWith('kurateringsko/okt/') ? false : o.git.skyv(c, g)) }
    await kjor(o, T0, null, uten)
    expect(kjorGit(o.origin, ['ls-tree', '--name-only', '-r', 'kurateringsko/okt/en']).includes(SVARFIL)).toBe(false)
    expect(Object.values(ko(o).stoffer).filter((s) => s.reservasjon)).toHaveLength(1)
    // Neste kjøring skriver det samme svaret, uten å reservere en gang til.
    const neste = await kjor(o, om(T0, 0.5))
    expect(neste.behandlet).toEqual([])
    expect(svar(o, 'kurateringsko/okt/en')).toMatchObject({ utfall: 'ok', oppgave: { stoff: 'beta', oppgave: 'beta-0001' } })
    expect(ko(o).teller).toBe(1)
  }, 60_000)

  it('begynner på nytt når en annen kjøring skrev køen imens', async () => {
    const o = oppsett()
    await kjor(o, T0)
    sporr(o, 'kurateringsko/okt/en', { id: '1', handling: 'reserver' })
    sporr(o, 'kurateringsko/okt/to', { id: '1', handling: 'reserver' })
    // Kjøringen «en» skriver køen mens «to» holder på; «to» må lese den på nytt.
    let forstyrret = false
    const git: Git = {
      ...o.git,
      skyv: (c, g) => {
        if (g === KOGREN && !forstyrret) {
          forstyrret = true
          return false
        }
        return o.git.skyv(c, g)
      },
    }
    const resultat = await kjor(o, T0, null, git)
    expect(resultat.forsok).toBe(2)
    expect(resultat.behandlet.map((b) => b.utfall)).toEqual(['ok', 'ingen_oppgave'])
    expect(ko(o).teller).toBe(1)
  }, 60_000)

  it('sletter gamle øktgrener uten noe nytt og uten reservasjon', async () => {
    const o = oppsett()
    await kjor(o, T0)
    sporr(o, 'kurateringsko/okt/gammel', { id: '1', handling: 'status' })
    await kjor(o, T0)
    await kjor(o, T0)
    expect((await kjor(o, om(T0, 24 * 13))).slettet).toEqual([])
    expect((await kjor(o, om(T0, 24 * 15))).slettet).toEqual(['kurateringsko/okt/gammel'])
    expect(kjorGit(o.origin, ['branch', '--list', 'kurateringsko/okt/*']).trim()).toBe('')
    await kjor(o, om(T0, 24 * 15 + 1))
    expect(ko(o).okter).toEqual({})
  }, 60_000)
})

/* --- Arbeidsflyten ---------------------------------------------------------- */

describe('arbeidsflyten', () => {
  const flyt = readFileSync(`${ROT}.github/workflows/kurateringsko.yml`, 'utf8')

  it('leser kurateringsgrenene med OIDC-tokenet, bare fra jobben på main', () => {
    const ko = flyt.slice(flyt.indexOf('\n  ko:'))
    expect(ko).toContain('id-token: write')
    expect(ko).toContain('OUSFAR_KO_ADRESSE: https://ousfar.vercel.app/api/kuratering-ko')
    expect(flyt.slice(0, flyt.indexOf('\n  ko:'))).not.toContain('id-token')
  })

  it('kjører køen bare fra main, og videresender uten hemmeligheter', () => {
    const ko = flyt.slice(flyt.indexOf('\n  ko:'))
    expect(ko).toContain("github.ref == 'refs/heads/main'")
    expect(ko).toContain('group: kurateringsko')
    expect(ko).toContain('cancel-in-progress: false')
    expect(flyt.slice(0, flyt.indexOf('\n  ko:'))).not.toContain('secrets.')
    for (const linje of flyt.split('\n').filter((l) => l.includes('${{'))) expect(linje, linje).toMatch(/^\s*(?!run:)[A-Za-z_-]+:\s/)
  })

  it('køens filer slås aldri sammen med main', () => {
    expect(existsSync(`${ROT}${KOMAPPE}`)).toBe(false)
  })
})
