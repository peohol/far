/**
 * Kurateringskøen som rene funksjoner (`docs/kurateringsko.md`): stoffene og
 * det køen vet om dem, prioriteringen, fristene, PR-ene og forespørslene.
 * Skriptet `scripts/kurateringsko.ts` leser og skriver køen på grenen og
 * henter det som kommer utenfra (registeret, repoet, GitHub); alt som avgjør
 * noe, skjer her, så det kan testes uten nettverk.
 *
 * Funksjonene endrer køen de får (en kopi skriptet har lest), og `vurder`
 * regner ut status og prioritet på nytt etter hver endring.
 */
import type { Koinnstillinger } from './innstillinger'
import {
  KOSTATUSER,
  KOVERSJON,
  type Blokkering,
  type Foresporsel,
  type Greninfo,
  type Hendelse,
  type Kooversikt,
  type Kostatus,
  type Kostoff,
  type Kotilstand,
  type Kurateringsappgren,
  type Kurateringspr,
  type Kurateringsspor,
  type Modus,
  type Oppgavesvar,
  type Reservasjon,
  type Sidemaal,
  type Svar,
  type Svarutfall,
  grenartFor,
} from './modell'

const MINUTT = 60_000
const TIME = 60 * MINUTT
const DAG = 24 * TIME

const pluss = (kl: string, ms: number) => new Date(Date.parse(kl) + ms).toISOString()
const dagerMellom = (fra: string, til: string) => (Date.parse(til) - Date.parse(fra)) / DAG

/** Så mange hendelser står i historikken per stoff; resten står i køgrenens commits. */
export const MAKS_HENDELSER = 30
/** Så mange forespørsels-ID-er huskes per øktgren. */
export const MAKS_IDER = 50

export function tomTilstand(na: string): Kotilstand {
  return { versjon: KOVERSJON, oppdatert_kl: na, malt_kl: null, teller: 0, stoffer: {}, okter: {} }
}

function nyttStoff(stoff: string, navn: string): Kostoff {
  return {
    stoff,
    navn,
    status: 'klar',
    modus: null,
    prioritet: { poeng: 0, grunner: [] },
    maal: null,
    reservasjon: null,
    forsok: 0,
    tidligst_kl: null,
    gjenoppta: null,
    pr: null,
    appgren: null,
    blokkeringer: [],
    sist_kuratert: null,
    siste_kjoring: null,
    aktiv: true,
    historikk: [],
  }
}

function logg(s: Kostoff, h: Hendelse) {
  s.historikk.push(h)
  if (s.historikk.length > MAKS_HENDELSER) s.historikk.splice(0, s.historikk.length - MAKS_HENDELSER)
}

function blokker(s: Kostoff, b: Blokkering) {
  s.blokkeringer = [...s.blokkeringer.filter((x) => x.kode !== b.kode), b]
}

const fjernBlokkering = (s: Kostoff, kode: Blokkering['kode']) => {
  s.blokkeringer = s.blokkeringer.filter((b) => b.kode !== kode)
}

/* --- Stoffene ------------------------------------------------------------ */

/** Et stoff slik registeret og målingen av den publiserte siden ga det. */
export interface Registerstoff {
  stoff: string
  navn: string
  aktiv: boolean
  maal: Sidemaal | null
}

/**
 * Stoffene i registeret: nye legges til, navnene og tallene oppdateres, og et
 * stoff som ikke er aktivt lenger (arkivert, i papirkurven, slettet), står
 * som `utenfor`. Ingenting tas ut av køen; historikken står.
 */
export function oppdaterStoffer(t: Kotilstand, register: readonly Registerstoff[], na: string, { malt = true }: { malt?: boolean } = {}) {
  const sett = new Set<string>()
  for (const r of register) {
    sett.add(r.stoff)
    let s = t.stoffer[r.stoff]
    if (!s) {
      s = t.stoffer[r.stoff] = nyttStoff(r.stoff, r.navn)
      logg(s, { kl: na, hendelse: 'oppdaget', melding: 'Nytt stoff i stoffregisteret.' })
    }
    s.navn = r.navn
    if (s.aktiv !== r.aktiv) logg(s, { kl: na, hendelse: r.aktiv ? 'aktiv' : 'ikke_aktiv', melding: r.aktiv ? 'Aktivt i stoffregisteret igjen.' : 'Ikke lenger aktivt i stoffregisteret.' })
    s.aktiv = r.aktiv
    if (r.maal) s.maal = r.maal
  }
  for (const s of Object.values(t.stoffer)) {
    if (!sett.has(s.stoff) && s.aktiv) {
      s.aktiv = false
      logg(s, { kl: na, hendelse: 'ikke_aktiv', melding: 'Ikke lenger i stoffregisteret.' })
    }
  }
  if (malt) t.malt_kl = na
}

/**
 * Kurateringene som står i repoet (migrasjonene og journalene på main). En
 * kuratering som er nyere enn den køen kjenner, er gjort utenom køen og blir
 * den siste. Mens et stoff har en PR køen følger, venter køen på den.
 */
export function oppdaterRepohistorikk(t: Kotilstand, spor: Readonly<Record<string, Kurateringsspor>>, na: string) {
  for (const [stoff, k] of Object.entries(spor)) {
    const s = t.stoffer[stoff]
    if (!s || s.pr || s.appgren || s.reservasjon) continue
    if (s.sist_kuratert && Date.parse(s.sist_kuratert.kl) >= Date.parse(k.kl)) continue
    s.sist_kuratert = k
    logg(s, { kl: na, hendelse: 'kuratering_i_repoet', melding: `En kuratering (${k.modus}) fra ${k.kl.slice(0, 10)} står i repoet.` })
  }
}

/* --- PR-ene og utrullingen ----------------------------------------------- */

/** En PR slik GitHub viser den. */
export interface Prinfo {
  nummer: number
  url: string
  tilstand: 'utkast' | 'klar' | 'sammenslatt' | 'lukket'
  sammenslatt_kl: string | null
  /** Grenen PR-en kommer fra. */
  gren: string | null
  /** Om PR-en endrer migrasjonene, og må rulles ut før kurateringen er publisert. */
  migrasjoner: boolean
}

/** Utrullingen til produksjonen etter en sammenslåing. */
export type Utrulling = { status: 'vellykket'; kl: string } | { status: 'feilet'; kl: string } | { status: 'venter' }

/**
 * PR-en til en ferdig kuratering, slik GitHub viser den nå. Er den slått
 * sammen og rullet ut, er kurateringen publisert og blir den siste i
 * historikken.
 */
export function oppdaterPr(t: Kotilstand, stoff: string, info: Prinfo | null, utrulling: Utrulling | null, na: string) {
  const s = t.stoffer[stoff]
  const pr = s?.pr
  if (!s || !pr) return
  if (!info) {
    s.pr = null
    blokker(s, { kode: 'pr_ukjent', grunn: `PR #${pr.nummer} finnes ikke.`, kl: na, kilde: 'ko' })
    logg(s, { kl: na, hendelse: 'pr_ukjent', oppgave: pr.oppgave, melding: `PR #${pr.nummer} finnes ikke.` })
    return
  }
  if (pr.kurateringsgren && info.gren !== pr.kurateringsgren) {
    // Et feil nummer: kurateringen er ikke ferdig før PR-en fra kurateringsgrenen er det. Neste
    // forsøk fortsetter på grenen, og køen finner PR-en derfra selv når den er åpen.
    const melding = `PR #${pr.nummer} kommer ikke fra kurateringsgrenen ${pr.kurateringsgren}.`
    s.pr = null
    s.gjenoppta = {
      oppgave: pr.oppgave,
      okt: s.siste_kjoring?.okt ?? '',
      avbrutt_kl: na,
      grunn: melding,
      fase: null,
      jobbgren: pr.jobbgren,
      kurateringsgren: pr.kurateringsgren,
      pr: null,
    }
    logg(s, { kl: na, hendelse: 'pr_feil_gren', oppgave: pr.oppgave, melding })
    return
  }
  pr.url = info.url
  if (info.tilstand === 'lukket') {
    s.pr = null
    blokker(s, { kode: 'pr_lukket', grunn: `PR #${pr.nummer} ble lukket uten å bli slått sammen.`, kl: na, kilde: 'ko' })
    logg(s, { kl: na, hendelse: 'pr_lukket', oppgave: pr.oppgave, melding: `PR #${pr.nummer} ble lukket uten å bli slått sammen.` })
    return
  }
  if (info.tilstand !== pr.tilstand) logg(s, { kl: na, hendelse: `pr_${info.tilstand}`, oppgave: pr.oppgave, melding: `PR #${pr.nummer}: ${info.tilstand}.` })
  pr.tilstand = info.tilstand
  if (info.tilstand !== 'sammenslatt') return
  pr.sammenslatt_kl = info.sammenslatt_kl ?? pr.sammenslatt_kl ?? na
  if (!info.migrasjoner) pr.utrullet_kl = pr.sammenslatt_kl
  else if (utrulling?.status === 'vellykket') pr.utrullet_kl = utrulling.kl
  else if (utrulling?.status === 'feilet') {
    blokker(s, { kode: 'utrulling_feilet', grunn: `Utrullingen etter PR #${pr.nummer} feilet.`, kl: na, kilde: 'system' })
    return
  }
  if (!pr.utrullet_kl) return
  publiser(s, pr, na)
}

function publiser(s: Kostoff, pr: Kurateringspr, na: string) {
  s.sist_kuratert = {
    kl: pr.utrullet_kl!,
    modus: pr.modus,
    kunnskapsgrense: pr.kunnskapsgrense,
    runde: pr.runde,
    pr: pr.nummer,
    kilde: 'ko',
  }
  s.pr = null
  s.forsok = 0
  s.tidligst_kl = null
  s.gjenoppta = null
  fjernBlokkering(s, 'utrulling_feilet')
  logg(s, { kl: na, hendelse: 'publisert', oppgave: pr.oppgave, melding: `PR #${pr.nummer} er rullet ut; kurateringen er publisert.` })
}

/**
 * Åpne PR-er fra kurateringsgrenen til en reservasjon eller et avbrutt
 * forsøk, som kuratoren ikke har meldt: de kobles til, så neste forsøk
 * fortsetter i PR-en i stedet for å lage en til.
 */
export function kobleApnePr(t: Kotilstand, prer: readonly { nummer: number; gren: string }[], na: string) {
  const perGren = new Map(prer.map((p) => [p.gren, p.nummer]))
  for (const s of Object.values(t.stoffer)) {
    const mal = s.reservasjon ?? s.gjenoppta
    const nummer = mal?.kurateringsgren ? perGren.get(mal.kurateringsgren) : undefined
    if (!mal || mal.pr || !nummer) continue
    mal.pr = nummer
    logg(s, { kl: na, hendelse: 'pr_funnet', oppgave: mal.oppgave, melding: `Fant PR #${nummer} fra ${mal.kurateringsgren}.` })
  }
}

/* --- Kurateringsgrenene i OUSFAR ---------------------------------------- */

/** Statusene der kuratoren har neste handling i grenen: køen gir stoffet ut igjen for å rette. */
const KURATORENS_TUR: ReadonlySet<string> = new Set(['arbeid', 'retting', 'tilbakemelding', 'blokkert', 'godkjent'])

const erAktivGren = (status: string) => status !== 'publisert' && status !== 'arkivert'

/** Grenen køen vet om for stoffet: den den følger, den som er reservert, eller den et avbrutt forsøk står i. */
const kjentGren = (s: Kostoff) => s.appgren?.id ?? s.reservasjon?.gren ?? s.gjenoppta?.gren ?? null

/**
 * Hvorfor grenen ikke kan være kurateringen av stoffet i modusen, eller `null`
 * når den kan: den må gjelde samme stoff og ha arten modusen krever
 * (`grenartFor`). Uten modus kontrolleres bare stoffet.
 */
function koblingsfeil(stoff: string, g: Greninfo, modus: Modus | null): string | null {
  if (g.stoff !== stoff) return `Kurateringsgrenen ${g.id} gjelder ${g.stoff}, ikke ${stoff}.`
  if (modus && g.art !== grenartFor(modus)) return `Kurateringsgrenen ${g.id} er en ${g.art}-gren; en ${modus}-kuratering må gjøres i en ${grenartFor(modus)}-gren.`
  return null
}

/**
 * En gren som er meldt eller holdt for stoffet, men som ikke kan være
 * kurateringen av det: koblingen brytes, og stoffet blokkeres
 * (`gren_feil_kobling`) til en riktig gren er koblet. Grenen blir aldri ført
 * som stoffets kuratering.
 */
function brytKobling(s: Kostoff, oppgave: string, grunn: string, na: string) {
  blokker(s, { kode: 'gren_feil_kobling', grunn, kl: na, kilde: 'system' })
  logg(s, { kl: na, hendelse: 'gren_feil_kobling', oppgave, melding: grunn })
}

/** Oppgaven gis tilbake til kuratoren, med grenen å fortsette i (eller ingen). */
function tilKuratoren(s: Kostoff, a: Pick<Kurateringsappgren, 'oppgave' | 'jobbgren'> & { kunnskapsgrense?: string | null }, grunn: string, gren: string | null, na: string) {
  s.gjenoppta = {
    oppgave: a.oppgave,
    okt: s.siste_kjoring?.okt ?? '',
    avbrutt_kl: na,
    grunn,
    fase: null,
    jobbgren: a.jobbgren,
    kurateringsgren: null,
    pr: null,
    gren,
    kunnskapsgrense: a.kunnskapsgrense ?? null,
  }
  s.appgren = null
}

/**
 * Kurateringsgrenene i OUSFAR, slik databasen har dem nå (`null` når de ikke
 * kunne leses; da står køen som den er):
 *
 * - en gren som gjelder et annet stoff, eller som ikke har arten
 *   kurateringen krever, kobles aldri til stoffet: er den meldt, brytes
 *   koblingen, og stoffet blokkeres (`gren_feil_kobling`) til riktig gren er
 *   koblet;
 * - en gren kuratoren har åpnet for stoffet uten å melde den, kobles til
 *   reservasjonen, eller til et avbrutt forsøk som står uten gren;
 * - en ferdig kuratering køen følger, står til kontroll til den er publisert.
 *   Ber kontrolløren om endringer, godkjenner den (så kuratoren kan publisere),
 *   eller blir grenen blokkert, gis stoffet ut igjen først i køen, med grenen
 *   å fortsette i; en kontrollrunde teller ikke som et mislykket forsøk. Er den publisert, er kurateringen det; er den
 *   forkastet, må et menneske se på stoffet;
 * - en aktiv gren køen ikke vet om (åpnet utenom køen, eller en
 *   gjenoppretting), holder stoffet ute av køen til den er avsluttet.
 */
export function oppdaterGrener(t: Kotilstand, grener: readonly Greninfo[] | null, na: string, innst: Koinnstillinger) {
  if (!grener) return
  const perId = new Map(grener.map((g) => [g.id, g]))
  const aktive = new Map<string, Greninfo>()
  for (const g of grener) if (erAktivGren(g.status)) aktive.set(g.stoff, g)

  for (const s of Object.values(t.stoffer)) {
    if (s.appgren) folgGren(s, s.appgren, perId.get(s.appgren.id) ?? null, na)
    else avsluttHoldtGren(s, perId.get(s.reservasjon?.gren ?? s.gjenoppta?.gren ?? '') ?? null, na, innst)

    const aktiv = aktive.get(s.stoff)
    // Uten egen gren: reservasjonen, ellers et avbrutt forsøk som står uten grenen sin.
    const uten = s.appgren ? null : s.reservasjon ? (s.reservasjon.gren ? null : s.reservasjon) : s.gjenoppta && !s.gjenoppta.gren ? s.gjenoppta : null
    const feil = aktiv && uten ? koblingsfeil(s.stoff, aktiv, s.reservasjon?.modus ?? s.modus) : null
    if (aktiv && uten && !feil) {
      uten.gren = aktiv.id
      fjernBlokkering(s, 'gren_feil_kobling')
      logg(s, { kl: na, hendelse: 'gren_funnet', oppgave: uten.oppgave, melding: `Fant kurateringsgrenen ${aktiv.id}.` })
    }

    if (aktiv && aktiv.id !== kjentGren(s)) {
      blokker(s, {
        kode: 'annen_gren',
        grunn: `Fagsiden har en aktiv kurateringsgren køen ikke følger (${aktiv.art}, ${aktiv.status}); den må avsluttes først.${feil ? ` ${feil}` : ''}`,
        kl: na,
        kilde: 'system',
      })
    } else fjernBlokkering(s, 'annen_gren')
  }
}

function folgGren(s: Kostoff, a: Kurateringsappgren, g: Greninfo | null, na: string) {
  if (!g) {
    s.appgren = null
    blokker(s, { kode: 'gren_ukjent', grunn: `Kurateringsgrenen ${a.id} finnes ikke.`, kl: na, kilde: 'ko' })
    logg(s, { kl: na, hendelse: 'gren_ukjent', oppgave: a.oppgave, melding: `Kurateringsgrenen ${a.id} finnes ikke.` })
    return
  }
  const feil = koblingsfeil(s.stoff, g, a.modus)
  if (feil) {
    // Oppgaven står igjen uten grenen, så arbeidet kan fortsette når riktig gren er koblet.
    tilKuratoren(s, a, feil, null, na)
    brytKobling(s, a.oppgave, feil, na)
    return
  }
  fjernBlokkering(s, 'gren_feil_kobling')
  if (g.status !== a.status || g.revisjon !== a.revisjon) {
    logg(s, { kl: na, hendelse: `gren_${g.status}`, oppgave: a.oppgave, melding: `Grenen: ${g.status}, revisjon ${g.revisjon}, kontrollrunde ${g.runde}.` })
  }
  a.status = g.status
  a.revisjon = g.revisjon
  a.kontrollrunde = g.runde
  if (g.status === 'stanset') blokker(s, { kode: 'gren_stanset', grunn: 'En administrator har stanset kurateringsgrenen.', kl: na, kilde: 'system' })
  else fjernBlokkering(s, 'gren_stanset')

  if (g.status === 'publisert') {
    s.appgren = null
    grenPublisert(s, g, a, na)
  } else if (g.status === 'arkivert') {
    s.appgren = null
    grenForkastet(s, a.oppgave, na)
  } else if (KURATORENS_TUR.has(g.status)) {
    const grunn =
      g.status === 'tilbakemelding'
        ? `Kontrolløren har bedt om endringer i kontrollrunde ${g.runde}.`
        : g.status === 'godkjent'
          ? `Revisjon ${g.revisjon} er godkjent av kontrolløren; grenen kan publiseres.`
          : g.status === 'blokkert'
          ? 'Publiseringen stoppet; grenen må oppdateres.'
          : 'Grenen er tilbake hos kuratoren.'
    tilKuratoren(s, a, grunn, a.id, na)
    // En kontrollrunde er ikke et mislykket forsøk.
    s.forsok = 0
    s.tidligst_kl = null
    fjernBlokkering(s, 'for_mange_forsok')
    logg(s, { kl: na, hendelse: 'retting', oppgave: a.oppgave, melding: grunn })
  }
}

/** Grenen er publisert: kurateringen er det, og stoffet er ferdig til neste gang det forfaller. */
function grenPublisert(
  s: Kostoff,
  g: Greninfo,
  spor: Pick<Kurateringsappgren, 'oppgave' | 'modus' | 'runde'> & { kunnskapsgrense: string | null },
  na: string,
) {
  s.sist_kuratert = {
    kl: g.publisert_kl ?? na,
    modus: spor.modus,
    kunnskapsgrense: spor.kunnskapsgrense,
    runde: spor.runde,
    pr: null,
    gren: g.id,
    kilde: 'ko',
  }
  s.forsok = 0
  s.tidligst_kl = null
  s.gjenoppta = null
  logg(s, { kl: na, hendelse: 'publisert', oppgave: spor.oppgave, melding: `Kurateringsgrenen er publisert (revisjon ${g.revisjon}).` })
}

function grenForkastet(s: Kostoff, oppgave: string, na: string) {
  blokker(s, { kode: 'gren_forkastet', grunn: 'Kurateringsgrenen ble forkastet uten å bli publisert.', kl: na, kilde: 'ko' })
  logg(s, { kl: na, hendelse: 'gren_forkastet', oppgave, melding: 'Kurateringsgrenen ble forkastet.' })
}

/**
 * En gren som er reservert eller står i et avbrutt forsøk, og som er
 * publisert eller forkastet før kuratoren meldte den ferdig (f.eks. en
 * godkjent gren kuratoren publiserte, men kjøringen stoppet før `fullfort`):
 * reservasjonen avsluttes, og stoffet føres som publisert eller blokkeres.
 * Kunnskapsgrensen er da ukjent. En gren som ikke kan være kurateringen av
 * stoffet, kobles fra, hvilken status den enn har.
 */
function avsluttHoldtGren(s: Kostoff, g: Greninfo | null, na: string, innst: Koinnstillinger) {
  if (!g) return
  const r = s.reservasjon
  const oppgave = r?.oppgave ?? s.gjenoppta!.oppgave
  const feil = koblingsfeil(s.stoff, g, r?.modus ?? s.modus)
  if (feil) {
    if (r?.gren === g.id) r.gren = null
    if (s.gjenoppta?.gren === g.id) s.gjenoppta.gren = null
    brytKobling(s, oppgave, feil, na)
    return
  }
  fjernBlokkering(s, 'gren_feil_kobling')
  if (erAktivGren(g.status)) return
  if (r) {
    s.siste_kjoring = { oppgave, okt: r.okt, startet_kl: r.reservert_kl, avsluttet_kl: na, utfall: g.status === 'publisert' ? 'fullfort' : 'feilet' }
    s.reservasjon = null
  }
  if (g.status === 'publisert') {
    const modus = r?.modus ?? s.modus ?? (g.art === 'de_novo' ? 'de_novo' : 'oppdatering')
    const kunnskapsgrense = r?.kunnskapsgrense ?? s.gjenoppta?.kunnskapsgrense ?? null
    grenPublisert(s, g, { oppgave, modus, kunnskapsgrense, runde: modus === 'de_novo' ? innst.de_novo_runde : null }, na)
  } else {
    s.gjenoppta = null
    grenForkastet(s, oppgave, na)
  }
}

/* --- Fristene ------------------------------------------------------------ */

/**
 * Avslutter reservasjonen uten en ferdig kuratering: det kuratoren har laget,
 * står i `gjenoppta`, så neste forsøk fortsetter der. Etter for mange forsøk
 * blokkeres stoffet.
 */
function avbryt(
  s: Kostoff,
  hendelse: string,
  grunn: string,
  na: string,
  innst: Koinnstillinger,
  { ventetid = false, tellForsok = true }: { ventetid?: boolean; tellForsok?: boolean } = {},
) {
  const r = s.reservasjon!
  s.gjenoppta = {
    oppgave: r.oppgave,
    okt: r.okt,
    avbrutt_kl: na,
    grunn,
    fase: r.fase,
    jobbgren: r.jobbgren,
    kurateringsgren: r.kurateringsgren,
    pr: r.pr,
    gren: r.gren ?? null,
    kunnskapsgrense: r.kunnskapsgrense ?? null,
  }
  s.siste_kjoring = { oppgave: r.oppgave, okt: r.okt, startet_kl: r.reservert_kl, avsluttet_kl: na, utfall: hendelse }
  s.reservasjon = null
  if (!tellForsok) s.forsok = Math.max(0, s.forsok - 1)
  if (ventetid) s.tidligst_kl = pluss(na, innst.ventetid_etter_feil_minutter * MINUTT)
  logg(s, { kl: na, hendelse, oppgave: r.oppgave, okt: r.okt, melding: grunn })
  if (s.forsok >= innst.maks_forsok) {
    blokker(s, { kode: 'for_mange_forsok', grunn: `${s.forsok} forsøk uten en ferdig kuratering.`, kl: na, kilde: 'ko' })
  }
}

/** Reservasjonene som har gått ut, avbrytes. Gir stoffene. */
export function utlop(t: Kotilstand, na: string, innst: Koinnstillinger): string[] {
  const utlopt: string[] = []
  for (const s of Object.values(t.stoffer)) {
    if (s.reservasjon && Date.parse(s.reservasjon.frist_kl) <= Date.parse(na)) {
      avbryt(s, 'tidsavbrudd', `Reservasjonen gikk ut ${s.reservasjon.frist_kl} uten å bli fornyet eller avsluttet.`, na, innst)
      utlopt.push(s.stoff)
    }
  }
  return utlopt
}

/* --- Status og prioritet ------------------------------------------------- */

/** Modusen en ny kuratering av stoffet skal ha nå, eller `null` når ingen er forfalt. */
export function forfaltModus(s: Kostoff, na: string, innst: Koinnstillinger): Modus | null {
  const k = s.sist_kuratert
  // Aldri kuratert, en annen art kuratering, eller de novo i en eldre runde: de novo i runden som gjelder.
  if (innst.aktive_modi.includes('de_novo') && (!k || k.modus !== 'de_novo' || (k.runde ?? 0) < innst.de_novo_runde)) return 'de_novo'
  if (innst.aktive_modi.includes('evidensovervaking') && k) {
    const fra = k.kunnskapsgrense ? `${k.kunnskapsgrense}T00:00:00.000Z` : k.kl
    if (dagerMellom(fra, na) >= innst.evidensovervaking_dager) return 'evidensovervaking'
  }
  return null
}

function statusFor(s: Kostoff, innst: Koinnstillinger): Kostatus {
  if (s.reservasjon) return 'reservert'
  if (s.appgren) return s.blokkeringer.some((b) => b.kode === 'gren_stanset') ? 'blokkert' : 'venter_godkjenning'
  if (s.pr) return s.pr.tilstand === 'klar' ? 'venter_godkjenning' : s.pr.tilstand === 'sammenslatt' ? 'sammenslatt' : 'fagarbeid_ferdig'
  if (!s.aktiv || innst.utelatt.includes(s.stoff)) return 'utenfor'
  if (s.blokkeringer.length > 0) return 'blokkert'
  if (s.modus) return 'klar'
  return s.sist_kuratert ? 'publisert' : 'utenfor'
}

/**
 * Hvor høyt stoffet står i køen, med grunnene i klartekst. Bare de klare
 * stoffene har poeng. Høyest først: en avbrutt kuratering som skal
 * fortsettes, stoffene i `forrang`, så de som aldri er kuratert, de som er
 * kuratert for lengst siden, og de som mangler innhold eller kilder.
 */
export function prioriter(s: Kostoff, na: string, innst: Koinnstillinger): Kostoff['prioritet'] {
  if (s.status !== 'klar') return { poeng: 0, grunner: [] }
  const v = innst.vekter
  let poeng = 0
  const grunner: string[] = []
  const legg = (p: number, grunn: string) => {
    if (p <= 0) return
    poeng += p
    grunner.push(grunn)
  }
  if (s.gjenoppta) legg(v.gjenoppta, `Fortsetter den avbrutte kurateringen ${s.gjenoppta.oppgave}.`)
  const plass = innst.forrang.indexOf(s.stoff)
  if (plass >= 0) legg(v.forrang * (1 - plass / innst.forrang.length), 'Står først i innstillingene.')
  else if (!gisUt(s, innst)) grunner.push('Venter: køen gir bare ut stoffene som står først i innstillingene nå.')
  if (s.modus === 'de_novo') legg(v.de_novo, 'De novo-kuratering i runden som gjelder.')
  if (!s.sist_kuratert) {
    legg(v.aldri_kuratert, 'Aldri kuratert.')
    legg(2 * v.alder_per_aar, 'Ingen kuratering å regne alderen fra.')
  } else {
    // Hele dager, så prioriteringen bare endres én gang i døgnet.
    const aar = Math.min(2, Math.max(0, Math.floor(dagerMellom(s.sist_kuratert.kl, na)) / 365))
    legg(aar * v.alder_per_aar, `Sist kuratert ${s.sist_kuratert.kl.slice(0, 10)}.`)
  }
  const m = s.maal
  if (!m) grunner.push('Siden er ikke målt ennå.')
  else if (m.side) {
    if (m.redaksjonelle_paneler > 0) {
      const mangler = m.redaksjonelle_paneler - m.paneler_med_innhold
      legg((mangler / m.redaksjonelle_paneler) * v.manglende_innhold, `${mangler} av ${m.redaksjonelle_paneler} redaksjonelle seksjoner er tomme.`)
    }
    if (m.elementer > 0) legg((m.elementer_uten_kilde / m.elementer) * v.uten_kilde, `${m.elementer_uten_kilde} av ${m.elementer} elementer har ingen kilde.`)
    if (m.referanser < innst.faa_referanser) legg(v.faa_referanser, `Bare ${m.referanser} referanser.`)
  }
  return { poeng: Math.round(poeng * 10) / 10, grunner }
}

/** Regner ut status, modus og prioritet for alle stoffene, og blokkeringene som følger av dem. */
export function vurder(t: Kotilstand, na: string, innst: Koinnstillinger) {
  for (const s of Object.values(t.stoffer)) {
    if (s.maal && !s.maal.side && !s.reservasjon && !s.pr && !s.appgren) {
      if (!s.blokkeringer.some((b) => b.kode === 'uten_fagside')) {
        blokker(s, { kode: 'uten_fagside', grunn: 'Stoffet har ingen publisert fagside å kuratere.', kl: na, kilde: 'system' })
      }
    } else fjernBlokkering(s, 'uten_fagside')
    if (s.tidligst_kl && Date.parse(s.tidligst_kl) <= Date.parse(na)) s.tidligst_kl = null
    s.modus = s.reservasjon?.modus ?? s.pr?.modus ?? s.appgren?.modus ?? forfaltModus(s, na, innst)
    s.status = statusFor(s, innst)
    s.prioritet = prioriter(s, na, innst)
  }
  t.oppdatert_kl = na
}

/** De klare stoffene, i den rekkefølgen køen gir dem ut. Et stoff som venter etter en feil, står sist. */
/** Om køen gir ut stoffet nå: alltid, unntatt når bare stoffene i `forrang` gis ut. */
function gisUt(s: Kostoff, innst: Koinnstillinger): boolean {
  return !innst.bare_forrang || innst.forrang.includes(s.stoff) || Boolean(s.gjenoppta)
}

export function rekkefolge(t: Kotilstand, na: string, innst: Koinnstillinger): Kostoff[] {
  const venter = (s: Kostoff) => Boolean(s.tidligst_kl && Date.parse(s.tidligst_kl) > Date.parse(na))
  return Object.values(t.stoffer)
    .filter((s) => s.status === 'klar' && gisUt(s, innst))
    .sort((a, b) => Number(venter(a)) - Number(venter(b)) || b.prioritet.poeng - a.prioritet.poeng || a.stoff.localeCompare(b.stoff))
}

/* --- Oversikten ---------------------------------------------------------- */

export function oversikt(t: Kotilstand, na: string, innst: Koinnstillinger, antallNeste = 10): Kooversikt {
  const stoffer = Object.values(t.stoffer).sort((a, b) => a.stoff.localeCompare(b.stoff))
  const antall = Object.fromEntries(KOSTATUSER.map((s) => [s, 0])) as Record<Kostatus, number>
  for (const s of stoffer) antall[s.status] += 1
  return {
    oppdatert_kl: t.oppdatert_kl,
    malt_kl: t.malt_kl,
    antall,
    aktive: stoffer.flatMap((s) =>
      s.reservasjon ? [{ stoff: s.stoff, oppgave: s.reservasjon.oppgave, okt: s.reservasjon.okt, frist_kl: s.reservasjon.frist_kl, fase: s.reservasjon.fase }] : [],
    ),
    neste: rekkefolge(t, na, innst)
      .slice(0, antallNeste)
      .map((s) => ({ stoff: s.stoff, modus: s.modus!, poeng: s.prioritet.poeng, grunner: s.prioritet.grunner, tidligst_kl: s.tidligst_kl })),
    til_gjennomgang: stoffer.flatMap((s) => [
      ...(s.pr ? [{ stoff: s.stoff, pr: s.pr.nummer, status: s.status }] : []),
      ...(s.appgren ? [{ stoff: s.stoff, gren: s.appgren.id, grenstatus: s.appgren.status, status: s.status }] : []),
    ]),
    blokkert: stoffer.filter((s) => s.status === 'blokkert').map((s) => ({ stoff: s.stoff, blokkeringer: s.blokkeringer })),
  }
}

const STATUSNAVN: Record<Kostatus, string> = {
  klar: 'Klar',
  reservert: 'Reservert',
  fagarbeid_ferdig: 'Fagarbeid ferdig (utkast-PR)',
  venter_godkjenning: 'Venter på godkjenning',
  sammenslatt: 'Slått sammen, venter på utrulling',
  publisert: 'Publisert',
  blokkert: 'Blokkert',
  utenfor: 'Utenfor køen',
}

/** Køen som en tabell i Markdown, for folk. */
export function oversiktMarkdown(t: Kotilstand, na: string, innst: Koinnstillinger): string {
  const o = oversikt(t, na, innst, 1000)
  const celle = (v: string) => v.replace(/\|/g, '\\|')
  const linjer = [
    '# Kurateringskøen',
    '',
    `Oppdatert ${t.oppdatert_kl}. Stoffene sist lest fra databasen ${t.malt_kl ?? 'aldri'}. Lages av arbeidsflyten «Kurateringskø»; se \`docs/kurateringsko.md\` på main.`,
    '',
    KOSTATUSER.filter((s) => o.antall[s] > 0).map((s) => `${STATUSNAVN[s]}: ${o.antall[s]}`).join(' · '),
    '',
    '## Pågår',
    '',
    ...(o.aktive.length === 0 ? ['Ingen kurateringer er reservert nå.'] : o.aktive.map((a) => `- **${a.stoff}** (${a.oppgave}), frist ${a.frist_kl}${a.fase ? `: ${celle(a.fase)}` : ''}`)),
    '',
    '## Til gjennomgang',
    '',
    ...(o.til_gjennomgang.length === 0
      ? ['Ingen kurateringer venter.']
      : o.til_gjennomgang.map((g) => `- **${g.stoff}**: ${g.pr ? `PR #${g.pr}` : `kurateringsgren i OUSFAR (${g.grenstatus})`}, ${STATUSNAVN[g.status].toLowerCase()}`)),
    '',
    '## Blokkert',
    '',
    ...(o.blokkert.length === 0 ? ['Ingen.'] : o.blokkert.map((b) => `- **${b.stoff}**: ${b.blokkeringer.map((x) => celle(x.grunn)).join(' ')}`)),
    '',
    '## Køen',
    '',
    '| # | Stoff | Modus | Poeng | Hvorfor |',
    '| --- | --- | --- | --- | --- |',
    ...o.neste.map((n, i) => `| ${i + 1} | ${n.stoff} | ${n.modus} | ${n.poeng} | ${celle(n.grunner.join(' '))}${n.tidligst_kl ? ` Venter til ${n.tidligst_kl}.` : ''} |`),
    '',
  ]
  return `${linjer.join('\n')}\n`
}

/* --- Forespørslene ------------------------------------------------------- */

export interface Behandlingskontekst {
  /** Øktgrenen forespørselen står på. */
  gren: string
  /** SHA-256 av forespørselsfila. */
  sha256: string
  na: string
  kjoring: string | null
  innst: Koinnstillinger
  /** Kurateringsgrenene i OUSFAR, når de kunne leses: en meldt gren må passe til stoffet og modusen. */
  grener?: readonly Greninfo[] | null
}

/** Stoffet med nøkkelen eller navnet. */
export function finnStoff(t: Kotilstand, navn: string): Kostoff | undefined {
  const n = navn.trim().toLowerCase()
  return t.stoffer[n] ?? Object.values(t.stoffer).find((s) => s.navn.toLowerCase() === n)
}

function oppgavesvar(s: Kostoff, r: Pick<Reservasjon, 'oppgave' | 'modus' | 'frist_kl' | 'jobbgren' | 'kurateringsgren' | 'pr' | 'gren'>): Oppgavesvar {
  return {
    oppgave: r.oppgave,
    stoff: s.stoff,
    navn: s.navn,
    modus: r.modus,
    forsok: s.forsok,
    frist_kl: r.frist_kl,
    jobbgren: r.jobbgren,
    kurateringsgren: r.kurateringsgren,
    pr: r.pr,
    gren: r.gren ?? null,
    gjenoppta: s.gjenoppta,
    sist_kuratert: s.sist_kuratert,
    maal: s.maal,
    prioritet: s.prioritet,
  }
}

type Valg = { stoff: Kostoff } | { utfall: Exclude<Svarutfall, 'ok'>; melding: string }

/** Stoffet en reservasjon skal få: det oppgitte, eller det første i køen. */
function velg(t: Kotilstand, f: Foresporsel, k: Behandlingskontekst): Valg {
  const aktive = Object.values(t.stoffer).filter((s) => s.reservasjon)
  if (aktive.length >= k.innst.maks_aktive) {
    return {
      utfall: 'ingen_oppgave',
      melding: `${aktive.length} kuratering${aktive.length === 1 ? '' : 'er'} pågår allerede (${aktive.map((s) => `${s.stoff} til ${s.reservasjon!.frist_kl}`).join(', ')}); høyst ${k.innst.maks_aktive} om gangen.`,
    }
  }
  if (f.stoff) {
    const s = finnStoff(t, f.stoff)
    if (!s) return { utfall: 'avvist', melding: `Køen kjenner ikke stoffet «${f.stoff}».` }
    if (s.status !== 'klar') return { utfall: 'avvist', melding: `${s.stoff} kan ikke reserveres nå: ${STATUSNAVN[s.status].toLowerCase()}.` }
    if (!gisUt(s, k.innst)) return { utfall: 'avvist', melding: `${s.stoff} kan ikke reserveres nå: køen gir bare ut ${k.innst.forrang.join(', ')}.` }
    if (s.tidligst_kl && Date.parse(s.tidligst_kl) > Date.parse(k.na)) return { utfall: 'avvist', melding: `${s.stoff} venter etter en feil til ${s.tidligst_kl}.` }
    return { stoff: s }
  }
  const forste = rekkefolge(t, k.na, k.innst)[0]
  if (!forste) return { utfall: 'ingen_oppgave', melding: 'Ingen stoffer er klare for kuratering nå.' }
  if (forste.tidligst_kl && Date.parse(forste.tidligst_kl) > Date.parse(k.na)) {
    return { utfall: 'ingen_oppgave', melding: `Ingen stoffer er klare før ${forste.tidligst_kl}.` }
  }
  return { stoff: forste }
}

/** Grenene en ny kuratering skal bruke: de fra et avbrutt forsøk, ellers nye etter oppgaven. */
function grener(s: Kostoff, oppgave: string) {
  return {
    jobbgren: s.gjenoppta?.jobbgren ?? `kuratorjobb/${oppgave}`,
    kurateringsgren: s.gjenoppta?.kurateringsgren ?? `kuratering/${oppgave}`,
    pr: s.gjenoppta?.pr ?? null,
    gren: s.gjenoppta?.gren ?? null,
    kunnskapsgrense: s.gjenoppta?.kunnskapsgrense ?? null,
  }
}

/**
 * Behandler én forespørsel og gir svaret. En forespørsel med samme ID og
 * innhold som den forrige på grenen, gir det samme svaret uten å endre noe,
 * så en forespørsel som behandles to ganger (f.eks. etter et avbrudd), aldri
 * gir to reservasjoner. `lest` er forespørselen, eller hva som var galt med
 * den.
 */
export function behandle(t: Kotilstand, lest: { foresporsel: Foresporsel } | { feil: string[] }, k: Behandlingskontekst): Svar {
  const okt = (t.okter[k.gren] ??= { ider: [], siste: null, besvart_commit: null, sist_brukt_kl: k.na })
  okt.sist_brukt_kl = k.na
  const f = 'foresporsel' in lest ? lest.foresporsel : null
  const svar = (utfall: Svarutfall, melding: string, ekstra: Partial<Svar> = {}): Svar => ({
    versjon: KOVERSJON,
    foresporsel_id: f?.id ?? null,
    foresporsel_sha256: k.sha256,
    handling: f?.handling ?? null,
    utfall,
    melding,
    behandlet_kl: k.na,
    kjoring: k.kjoring,
    ...ekstra,
  })

  if (!f) {
    const s = svar('avvist', `Forespørselen kan ikke brukes: ${(lest as { feil: string[] }).feil.join(' ')}`)
    okt.siste = { id: '', sha256: k.sha256, svar: s }
    return s
  }
  if (okt.siste?.id === f.id) {
    if (okt.siste.sha256 === k.sha256) return okt.siste.svar
    return svar('avvist', `ID-en ${f.id} er brukt før på grenen med et annet innhold; bruk en ny ID for hver forespørsel.`)
  }
  if (okt.ider.includes(f.id)) return svar('avvist', `ID-en ${f.id} er brukt før på grenen; bruk en ny ID for hver forespørsel.`)

  const resultat = utfor(t, f, k, svar)
  okt.ider = [f.id, ...okt.ider].slice(0, MAKS_IDER)
  okt.siste = { id: f.id, sha256: k.sha256, svar: resultat }
  vurder(t, k.na, k.innst)
  return resultat
}

function utfor(t: Kotilstand, f: Foresporsel, k: Behandlingskontekst, svar: (u: Svarutfall, m: string, e?: Partial<Svar>) => Svar): Svar {
  const { na, innst } = k
  switch (f.handling) {
    case 'status':
      return svar('ok', 'Oversikten over køen.', { ko: oversikt(t, na, k.innst) })

    case 'forhandsvis':
    case 'reserver': {
      const egen = Object.values(t.stoffer).find((s) => s.reservasjon?.okt === k.gren)
      if (egen) return svar('ok', `Økten har allerede reservert ${egen.stoff}; fortsett med den.`, { oppgave: oppgavesvar(egen, egen.reservasjon!) })
      const valg = velg(t, f, k)
      if (!('stoff' in valg)) return svar(valg.utfall, valg.melding, valg.utfall === 'ingen_oppgave' ? { ko: oversikt(t, na, k.innst) } : {})
      const s = valg.stoff
      const frist_kl = pluss(na, innst.reservasjon_minutter * MINUTT)
      if (f.handling === 'forhandsvis') {
        const oppgave = `${s.stoff}-forhandsvisning`
        return svar('ok', `${s.stoff} er neste; ingenting er reservert.`, { oppgave: oppgavesvar(s, { oppgave, modus: s.modus!, frist_kl, ...grener(s, oppgave) }) })
      }
      t.teller += 1
      const oppgave = `${s.stoff}-${String(t.teller).padStart(4, '0')}`
      s.reservasjon = { oppgave, okt: k.gren, modus: s.modus!, reservert_kl: na, fornyet_kl: na, frist_kl, fase: null, ...grener(s, oppgave) }
      s.forsok += 1
      s.siste_kjoring = { oppgave, okt: k.gren, startet_kl: na, avsluttet_kl: null, utfall: 'reservert' }
      logg(s, {
        kl: na,
        hendelse: 'reservert',
        oppgave,
        okt: k.gren,
        melding: `Forsøk ${s.forsok}, ${s.modus}${s.gjenoppta ? `, fortsetter ${s.gjenoppta.oppgave}` : ''}.`,
      })
      return svar('ok', `${s.stoff} er reservert til ${frist_kl}.`, { oppgave: oppgavesvar(s, s.reservasjon) })
    }

    case 'tilbakestill': {
      const s = finnStoff(t, f.stoff!)
      if (!s) return svar('avvist', `Køen kjenner ikke stoffet «${f.stoff}».`)
      if (s.reservasjon) return svar('avvist', `${s.stoff} er reservert av ${s.reservasjon.okt}; frigi reservasjonen, eller vent til ${s.reservasjon.frist_kl}.`)
      if (s.pr && s.pr.tilstand !== 'lukket') return svar('avvist', `${s.stoff} har PR #${s.pr.nummer}, som køen følger til den er slått sammen eller lukket.`)
      if (s.appgren) return svar('avvist', `${s.stoff} har en kurateringsgren i OUSFAR, som køen følger til den er publisert eller forkastet.`)
      // Med `gren`: stoffet gis tilbake til kuratoren med grenen, f.eks. etter en menneskelig avgjørelse.
      const g = f.gren ? k.grener?.find((x) => x.id === f.gren) : undefined
      if (f.gren) {
        const uendret = `${s.stoff} er ikke tilbakestilt.`
        if (!k.grener) return svar('avvist', `Kurateringsgrenene i OUSFAR kunne ikke leses nå; prøv igjen senere. ${uendret}`)
        if (!g) return svar('avvist', `Kurateringsgrenen ${f.gren} finnes ikke. ${uendret}`)
        if (!erAktivGren(g.status)) return svar('avvist', `Kurateringsgrenen ${g.id} er ikke aktiv (${g.status}). ${uendret}`)
        if (!s.modus) return svar('avvist', `Ingen kuratering av ${s.stoff} er forfalt. ${uendret}`)
        const feil = koblingsfeil(s.stoff, g, s.modus)
        if (feil) return svar('avvist', `${feil} ${uendret}`)
      }
      // Et avbrutt forsøk i samme gren beholder oppgaven, jobbgrenen og kunnskapsgrensen.
      const holdt = g && s.gjenoppta?.gren === g.id ? s.gjenoppta : null
      s.blokkeringer = []
      s.forsok = 0
      s.tidligst_kl = null
      s.gjenoppta = null
      logg(s, { kl: na, hendelse: 'tilbakestilt', okt: k.gren, melding: g ? `${f.grunn} Gitt tilbake med kurateringsgrenen ${g.id}.` : f.grunn })
      if (!g) return svar('ok', `${s.stoff} er tilbakestilt.`)
      tilKuratoren(s, holdt ?? { oppgave: s.siste_kjoring?.oppgave ?? `${s.stoff}-tilbakestilt`, jobbgren: null }, `Tilbakestilt med kurateringsgrenen ${g.id}: ${f.grunn}`, g.id, na)
      return svar('ok', `${s.stoff} er tilbakestilt og gis tilbake til kuratoren med kurateringsgrenen ${g.id}.`)
    }

    default: {
      const s = Object.values(t.stoffer).find((x) => x.reservasjon?.oppgave === f.oppgave)
      if (!s) {
        const publisert = f.handling === 'fullfort' && f.gren ? Object.values(t.stoffer).find((x) => x.siste_kjoring?.oppgave === f.oppgave && x.siste_kjoring?.okt === k.gren && x.sist_kuratert?.gren === f.gren) : null
        if (publisert) {
          // Køen så publiseringen før kuratoren meldte den: kurateringen er alt ført, men kunnskapsgrensen tas med.
          const spor = publisert.sist_kuratert!
          if (!spor.kunnskapsgrense) {
            spor.kunnskapsgrense = f.kunnskapsgrense!
            logg(publisert, { kl: na, hendelse: 'fullfort', oppgave: f.oppgave, okt: k.gren, melding: `Kunnskapsgrense ${f.kunnskapsgrense}.` })
          }
          return svar('ok', `${publisert.stoff} er alt ført som publisert fra kurateringsgrenen ${f.gren}.`)
        }
        const tidligere = Object.values(t.stoffer).find((x) => x.siste_kjoring?.oppgave === f.oppgave || x.gjenoppta?.oppgave === f.oppgave)
        return svar(
          'avvist',
          tidligere
            ? `Oppgaven ${f.oppgave} er ikke reservert lenger (${tidligere.siste_kjoring?.utfall ?? 'avsluttet'}). Reserver på nytt for å fortsette.`
            : `Køen kjenner ikke oppgaven ${f.oppgave}.`,
        )
      }
      const r = s.reservasjon!
      if (r.okt !== k.gren) return svar('avvist', `Oppgaven ${f.oppgave} tilhører økten ${r.okt}.`)
      if (f.pr !== undefined) {
        const annen = Object.values(t.stoffer).find((x) => x !== s && (x.pr?.nummer === f.pr || x.reservasjon?.pr === f.pr))
        if (annen) return svar('avvist', `PR #${f.pr} hører til ${annen.stoff}.`)
      }
      if (f.gren !== undefined) {
        const annen = Object.values(t.stoffer).find((x) => x !== s && kjentGren(x) === f.gren)
        if (annen) return svar('avvist', `Kurateringsgrenen ${f.gren} hører til ${annen.stoff}.`)
        // En gren køen ikke ser ennå, kontrolleres når den leses.
        const g = k.grener?.find((x) => x.id === f.gren)
        const feil = g ? koblingsfeil(s.stoff, g, f.modus ?? r.modus) : null
        if (feil) return svar('avvist', `${feil} Meld kurateringsgrenen for ${s.stoff}; reservasjonen står som før.`)
        if (g) fjernBlokkering(s, 'gren_feil_kobling')
      }
      if (f.fase !== undefined) r.fase = f.fase
      if (f.jobbgren) r.jobbgren = f.jobbgren
      if (f.kurateringsgren) r.kurateringsgren = f.kurateringsgren
      if (f.pr !== undefined) r.pr = f.pr
      if (f.gren !== undefined) r.gren = f.gren

      switch (f.handling) {
        case 'forny': {
          r.fornyet_kl = na
          const lengst = pluss(r.reservert_kl, innst.maks_reservasjon_timer * TIME)
          const ny = pluss(na, innst.reservasjon_minutter * MINUTT)
          r.frist_kl = Date.parse(ny) < Date.parse(lengst) ? ny : lengst
          logg(s, { kl: na, hendelse: 'fornyet', oppgave: r.oppgave, okt: k.gren, melding: f.fase })
          return svar('ok', `Reservasjonen av ${s.stoff} varer til ${r.frist_kl}.`, { oppgave: oppgavesvar(s, r) })
        }
        case 'fullfort': {
          const modus = f.modus ?? r.modus
          const runde = modus === 'de_novo' ? innst.de_novo_runde : null
          const avslutt = (melding: string) => {
            s.siste_kjoring = { oppgave: r.oppgave, okt: r.okt, startet_kl: r.reservert_kl, avsluttet_kl: na, utfall: 'fullfort' }
            s.reservasjon = null
            s.gjenoppta = null
            s.tidligst_kl = null
            fjernBlokkering(s, 'for_mange_forsok')
            logg(s, { kl: na, hendelse: 'fullfort', oppgave: r.oppgave, okt: k.gren, melding })
          }
          if (f.gren) {
            s.appgren = {
              id: f.gren,
              oppgave: r.oppgave,
              modus,
              runde,
              kunnskapsgrense: f.kunnskapsgrense!,
              jobbgren: r.jobbgren,
              registrert_kl: na,
              status: 'ukjent',
              revisjon: null,
              kontrollrunde: null,
            }
            avslutt(`Kurateringsgrenen ${f.gren}, kunnskapsgrense ${f.kunnskapsgrense}.`)
            return svar('ok', `${s.stoff} er sendt til kontroll; køen følger kurateringsgrenen til den er publisert.`)
          }
          s.pr = {
            nummer: f.pr!,
            url: null,
            oppgave: r.oppgave,
            modus,
            runde,
            kunnskapsgrense: f.kunnskapsgrense!,
            kurateringsgren: r.kurateringsgren,
            jobbgren: r.jobbgren,
            registrert_kl: na,
            tilstand: 'ukjent',
            sammenslatt_kl: null,
            utrullet_kl: null,
          }
          avslutt(`PR #${f.pr}, kunnskapsgrense ${f.kunnskapsgrense}.`)
          return svar('ok', `${s.stoff} er ferdig fra kuratoren; køen følger PR #${f.pr} til den er publisert.`)
        }
        case 'feilet':
          avbryt(s, 'feilet', f.grunn!, na, innst, { ventetid: true })
          return svar('ok', `${s.stoff} er satt tilbake i køen etter feilen${s.tidligst_kl ? `, tidligst ${s.tidligst_kl}` : ''}.`)
        case 'blokkert':
          avbryt(s, 'blokkert', f.grunn!, na, innst, { tellForsok: false })
          blokker(s, { kode: 'agent', grunn: f.grunn!, kl: na, kilde: 'agent' })
          return svar('ok', `${s.stoff} er blokkert til et menneske har sett på det.`)
        case 'frigi':
          avbryt(s, 'frigitt', f.grunn ?? 'Frigitt av kuratoren.', na, innst, { tellForsok: false })
          if (s.gjenoppta && !s.gjenoppta.pr && !s.gjenoppta.gren && !s.gjenoppta.fase) s.gjenoppta = null
          return svar('ok', `${s.stoff} er frigitt og står i køen igjen.`)
        default:
          return svar('avvist', `Ukjent handling ${f.handling}.`)
      }
    }
  }
}

/**
 * Øktgrenene som kan slettes: ingen ny forespørsel siden svaret, ingen
 * aktiv reservasjon, og ikke brukt på en stund. `hoder` er commitene grenene
 * står på nå.
 */
export function utdaterteOkter(t: Kotilstand, hoder: Readonly<Record<string, string>>, na: string, innst: Koinnstillinger): string[] {
  const reservert = new Set(Object.values(t.stoffer).flatMap((s) => (s.reservasjon ? [s.reservasjon.okt] : [])))
  return Object.entries(hoder)
    .filter(([gren, sha]) => {
      const okt = t.okter[gren]
      return okt && okt.besvart_commit === sha && !reservert.has(gren) && dagerMellom(okt.sist_brukt_kl, na) >= innst.okt_slettes_etter_dager
    })
    .map(([gren]) => gren)
}
