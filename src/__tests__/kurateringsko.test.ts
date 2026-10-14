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
  oppdaterPr,
  oppdaterRepohistorikk,
  oppdaterStoffer,
  oversikt,
  rekkefolge,
  tomTilstand,
  utlop,
  vurder,
  type Prinfo,
  type Registerstoff,
  type Utrulling,
} from '../kurateringsko/ko'
import { maalSide, malRegisteret, REDAKSJONELLE_PANELER } from '../kurateringsko/maling'
import { FORESPORSELSFIL, KOFIL, KOGREN, KOMAPPE, NESTEFIL, SVARFIL, type Foresporsel, type Kotilstand, type Sidemaal, type Svar } from '../kurateringsko/modell'
import { faginnholdskall, nyDatabase, opprettBruker } from './hjelp/testdatabase'

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
const kontekst = (gren: string, na = T0, innst: Koinnstillinger = INNSTILLINGER) => ({ gren, sha256: `sha-${teller}`, na, kjoring: null, innst })

function ny(register = REGISTER, na = T0): Kotilstand {
  const t = tomTilstand(na)
  oppdaterStoffer(t, register, na)
  vurder(t, na, INNSTILLINGER)
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
    expect(feil({ versjon: 1, id: 'a', handling: 'fullfort', oppgave: 'x' })).toEqual(['fullfort krever feltet pr.', 'fullfort krever feltet kunnskapsgrense.'])
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
    expect(utlop(t, om(T0, 3.5), INNSTILLINGER)).toEqual([])
    expect(utlop(t, om(T0, 4), INNSTILLINGER)).toEqual(['beta'])
    vurder(t, om(T0, 4), INNSTILLINGER)
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
    vurder(t, na, INNSTILLINGER)
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
      vurder(t, na, INNSTILLINGER)
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
    vurder(t, om(T0, 3), INNSTILLINGER)
    expect(t.stoffer.beta).toMatchObject({ status: 'blokkert', pr: null, blokkeringer: [{ kode: 'pr_lukket' }] })
  })

  it('godtar ikke en PR fra en annen gren som den ferdige kurateringen, men fortsetter på kurateringsgrenen', () => {
    const t = ferdig()
    // Et feil nummer: en annen PR som er slått sammen og rullet ut.
    oppdaterPr(t, 'beta', pr('sammenslatt', { sammenslatt_kl: om(T0, 3), gren: 'claude/noe-annet' }), { status: 'vellykket', kl: om(T0, 3) }, om(T0, 3))
    vurder(t, om(T0, 3), INNSTILLINGER)
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
    vurder(t, om(T0, 4), INNSTILLINGER)
    expect(behandle(t, f('reserver'), kontekst('kurateringsko/okt/c', om(T0, 4)))).toMatchObject({
      utfall: 'ok',
      oppgave: { stoff: 'beta', kurateringsgren: 'kuratering/beta-0001', pr: 91 },
    })
  })

  it('setter publiserte stoffer i køen igjen for evidensovervåkning og nye de novo-runder', () => {
    const t = ny()
    const s = t.stoffer.alfa!
    s.sist_kuratert = { kl: T0, modus: 'de_novo', kunnskapsgrense: '2026-10-01', runde: 1, pr: 5, kilde: 'ko' }
    expect(forfaltModus(s, T0, INNSTILLINGER)).toBeNull()
    const med = { ...INNSTILLINGER, aktive_modi: ['de_novo', 'evidensovervaking'] as const }
    expect(forfaltModus(s, '2027-03-29T00:00:00.000Z', med)).toBeNull()
    expect(forfaltModus(s, '2027-03-30T00:00:00.000Z', med)).toBe('evidensovervaking')
    expect(forfaltModus(s, T0, { ...INNSTILLINGER, de_novo_runde: 2 })).toBe('de_novo')
    // En eldre kuratering av en annen art gir de novo.
    s.sist_kuratert = { ...s.sist_kuratert, modus: 'oppdatering', runde: null }
    expect(forfaltModus(s, T0, INNSTILLINGER)).toBe('de_novo')
  })
})

describe('prioriteringen og stoffene', () => {
  it('setter stoffene som mangler innhold og kilder, og som ikke er kuratert, først', () => {
    const t = ny()
    expect(rekkefolge(t, T0).map((s) => s.stoff)).toEqual(['beta', 'gamma', 'alfa'])
    expect(t.stoffer.beta!.prioritet.grunner).toEqual(expect.arrayContaining(['Aldri kuratert.', 'Bare 1 referanser.']))
    // Nylig kuratert går bakerst.
    oppdaterRepohistorikk(t, { beta: { kl: om(T0, -24), modus: 'oppdatering', kunnskapsgrense: null, runde: null, pr: null, kilde: 'repo' } }, T0)
    vurder(t, T0, INNSTILLINGER)
    expect(rekkefolge(t, T0).map((s) => s.stoff)).toEqual(['gamma', 'alfa', 'beta'])
    // Forrang i innstillingene går foran.
    vurder(t, T0, { ...INNSTILLINGER, forrang: ['alfa'] })
    expect(rekkefolge(t, T0)[0]!.stoff).toBe('alfa')
  })

  it('oppdager nye stoffer, og tar dem som ikke er aktive eller ikke har en fagside, ut av køen', () => {
    const t = ny()
    oppdaterStoffer(t, [...REGISTER.slice(1), { stoff: 'delta', navn: 'Delta', aktiv: true, maal: maal(0, { side: false }) }], om(T0, 1))
    vurder(t, om(T0, 1), INNSTILLINGER)
    expect(t.stoffer.alfa).toMatchObject({ aktiv: false, status: 'utenfor' })
    expect(t.stoffer.delta).toMatchObject({ status: 'blokkert', blokkeringer: [{ kode: 'uten_fagside', kilde: 'system' }] })
    expect(t.stoffer.delta!.historikk[0]).toMatchObject({ hendelse: 'oppdaget' })
    // Siden kommer: blokkeringen forsvinner av seg selv.
    oppdaterStoffer(t, [{ stoff: 'delta', navn: 'Delta', aktiv: true, maal: maal(1) }], om(T0, 2))
    vurder(t, om(T0, 2), INNSTILLINGER)
    expect(t.stoffer.delta).toMatchObject({ status: 'klar', blokkeringer: [] })
    expect(oversikt(t, om(T0, 2)).antall).toMatchObject({ klar: 1, utenfor: 3 })
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
    expect(forfaltModus(t.stoffer.citalopram!, T0, INNSTILLINGER)).toBeNull()
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
