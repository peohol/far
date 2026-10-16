/**
 * Én kjøring av kurateringskøen (`docs/kurateringsko.md`), slik arbeidsflyten
 * «Kurateringskø» gjør den:
 *
 * 1. Leser køen fra køgrenen (eller lager en ny).
 * 2. Oppdaterer den: stoffene og tallene fra databasen (høyst én gang i
 *    døgnet), kurateringene i repoet, PR-ene og utrullingene i GitHub,
 *    kurateringsgrenene i OUSFAR, og reservasjonene som har gått ut.
 * 3. Behandler forespørslene på øktgrenene som ikke er besvart, i den
 *    rekkefølgen de kom, én om gangen.
 * 4. Skriver køen tilbake. Har en annen kjøring skrevet imens, begynner den
 *    på nytt fra 1 med køen slik den er nå, så ingen forespørsel blir
 *    behandlet mot en gammel kø.
 * 5. Skriver svarene på øktgrenene, og sletter gamle øktgrener.
 *
 * Svaret skrives først når køen er lagret. Stopper kjøringen mellom de to,
 * ser neste kjøring at forespørselen er behandlet uten svar, og skriver det
 * samme svaret.
 */
import { createHash } from 'node:crypto'
import type { Git } from './git'
import type { Github } from './github'
import { kurateringerIRepo, type Repofil } from './historikk'
import { INNSTILLINGER, type Koinnstillinger } from './innstillinger'
import {
  behandle,
  kobleApnePr,
  oppdaterGrener,
  oppdaterPr,
  oppdaterRepohistorikk,
  oppdaterStoffer,
  oversikt,
  oversiktMarkdown,
  tomTilstand,
  utdaterteOkter,
  utlop,
  vurder,
  type Prinfo,
  type Registerstoff,
  type Utrulling,
} from './ko'
import type { Maling } from './maling'
import { lesForesporsel } from './foresporsel'
import {
  FORESPORSELSFIL,
  KOFIL,
  KOGREN,
  KOMAPPE,
  NESTEFIL,
  OKTGREN,
  OKTPREFIKS,
  OVERSIKTSFIL,
  SVARFIL,
  type Greninfo,
  type Kotilstand,
  type Svar,
} from './modell'

export interface Kjoringsvalg {
  git: Git
  /** `null` når GitHub ikke kan slås opp (lokalt); PR-ene blir da stående. */
  github: Github | null
  /** Leser stoffene og tallene fra databasen; `null` uten testbrukeren. */
  maling: (() => Promise<Maling>) | null
  /** Leser kurateringsgrenene i OUSFAR (`/api/kuratering-ko`); `null` når de ikke kan leses. */
  grener?: (() => Promise<Greninfo[]>) | null
  /** Stoffene fra datafilen, når køen er ny og databasen ikke kan leses. */
  reserveregister: readonly Registerstoff[]
  repo: { migrasjoner: readonly Repofil[]; journaler: readonly Repofil[] }
  na?: () => string
  innst?: Koinnstillinger
  kjoring?: string | null
  /** Les databasen nå, ikke bare når det er lenge siden. */
  tvingMaling?: boolean
  /** Hvor mange ganger kjøringen begynner på nytt når en annen har skrevet køen imens. */
  maksForsok?: number
}

export interface Kjoringsresultat {
  behandlet: { gren: string; id: string | null; handling: string | null; utfall: string; melding: string }[]
  malt: { stoffer: number; feilet: number } | null
  utlopt: string[]
  slettet: string[]
  /** Hvor mange ganger køen ble lest før den kunne skrives. */
  forsok: number
  /** Om køen ble skrevet (den skrives bare når noe er endret). */
  skrevet: boolean
}

const sha256 = (b: Buffer | string) => createHash('sha256').update(b).digest('hex')
const json = (v: unknown) => `${JSON.stringify(v, null, 2)}\n`

/** Køen uten tidspunktet den sist ble vurdert: det som avgjør om noe er endret. */
const innhold = (t: Kotilstand) => JSON.stringify({ ...t, oppdatert_kl: null })

export async function kjorKo(v: Kjoringsvalg): Promise<Kjoringsresultat> {
  const { git, github } = v
  const innst = v.innst ?? INNSTILLINGER
  const na = (v.na ?? (() => new Date().toISOString()))()
  const kjoring = v.kjoring ?? null

  // Det som ikke avhenger av køen, hentes én gang.
  const forste = lesKo(git, git.hoder(`${KOMAPPE}/`))
  const gammel = !forste.t.malt_kl || Date.parse(na) - Date.parse(forste.t.malt_kl) >= innst.maling_timer * 3_600_000
  const maling = v.maling && (v.tvingMaling || gammel) ? await v.maling() : null
  const repospor = kurateringerIRepo(v.repo.migrasjoner, v.repo.journaler)
  const apne = github ? await github.apnePr() : []
  // Kan ikke grenene leses nå, står det køen vet om dem, til neste kjøring.
  const grener = v.grener ? await v.grener().catch((e: unknown) => (console.log(`Kurateringsgrenene kunne ikke leses: ${e instanceof Error ? e.message : String(e)}`), null)) : null
  const prer = new Map<number, Promise<{ info: Prinfo | null; utrulling: Utrulling | null }>>()
  const slaOppPr = (nummer: number) => {
    if (!prer.has(nummer)) {
      prer.set(
        nummer,
        (async () => {
          const info = await github!.pr(nummer)
          const utrulling = info?.tilstand === 'sammenslatt' && info.migrasjoner ? await github!.utrulling(info.sammenslatt_kl!) : null
          return { info, utrulling }
        })(),
      )
    }
    return prer.get(nummer)!
  }
  const synkPr = async (t: Kotilstand) => {
    if (!github) return
    for (const s of Object.values(t.stoffer)) {
      if (!s.pr) continue
      const { info, utrulling } = await slaOppPr(s.pr.nummer)
      oppdaterPr(t, s.stoff, info, utrulling, na)
    }
  }

  const maks = v.maksForsok ?? 5
  for (let forsok = 1; forsok <= maks; forsok += 1) {
    const hoder = git.hoder(`${KOMAPPE}/`)
    const { t, commit: kocommit } = lesKo(git, hoder)
    const for_ = kocommit ? innhold(t) : null

    if (maling) oppdaterStoffer(t, maling.stoffer, na)
    else if (Object.keys(t.stoffer).length === 0) oppdaterStoffer(t, v.reserveregister, na, { malt: false })
    oppdaterRepohistorikk(t, repospor, na)
    await synkPr(t)
    kobleApnePr(t, apne, na)
    oppdaterGrener(t, grener, na, innst)
    const utlopt = utlop(t, na, innst)
    vurder(t, na, innst)

    // Forespørslene på øktgrenene som har noe nytt.
    const okter = Object.fromEntries(Object.entries(hoder).filter(([g]) => g.startsWith(OKTPREFIKS) && OKTGREN.test(g)))
    const nye = Object.keys(okter).filter((g) => t.okter[g]?.besvart_commit !== okter[g])
    const hentet = git.hent(nye)
    const svar: { gren: string; commit: string; svar: Svar }[] = []
    const ventende: { gren: string; commit: string; tekst: string; sha: string; kl: string }[] = []
    for (const gren of nye) {
      const commit = hentet[gren]!
      const fil = git.les(commit, FORESPORSELSFIL)
      const logg = t.okter[gren]
      if (!fil) {
        t.okter[gren] = { ider: logg?.ider ?? [], siste: logg?.siste ?? null, besvart_commit: commit, sist_brukt_kl: logg?.sist_brukt_kl ?? na }
        continue
      }
      const sha = sha256(fil)
      if (logg?.siste && logg.siste.sha256 === sha) {
        // Behandlet før: står svaret der, er grenen besvart; ellers skrives det på nytt.
        const forrige = git.les(commit, SVARFIL)
        let besvart = false
        try {
          besvart = forrige !== null && (JSON.parse(forrige.toString('utf8')) as Svar).foresporsel_sha256 === sha
        } catch {
          besvart = false
        }
        if (besvart) logg.besvart_commit = commit
        else svar.push({ gren, commit, svar: logg.siste.svar })
        continue
      }
      ventende.push({ gren, commit, tekst: fil.toString('utf8'), sha, kl: git.tidspunkt(commit) })
    }
    ventende.sort((a, b) => a.kl.localeCompare(b.kl) || a.gren.localeCompare(b.gren))
    const behandlet: Kjoringsresultat['behandlet'] = []
    for (const f of ventende) {
      const s = behandle(t, lesForesporsel(f.tekst), { gren: f.gren, sha256: f.sha, na, kjoring, innst })
      svar.push({ gren: f.gren, commit: f.commit, svar: s })
      behandlet.push({ gren: f.gren, id: s.foresporsel_id, handling: s.handling, utfall: s.utfall, melding: s.melding })
    }
    if (ventende.length > 0) {
      await synkPr(t)
      oppdaterGrener(t, grener, na, innst)
      vurder(t, na, innst)
    }

    // Øktgrenene som er borte, glemmes; de gamle slettes etter at køen er skrevet.
    const slettes = utdaterteOkter(t, okter, na, innst)
    for (const gren of Object.keys(t.okter)) if (!(gren in okter) && !Object.values(t.stoffer).some((s) => s.reservasjon?.okt === gren)) delete t.okter[gren]

    const skrevet = for_ === null || innhold(t) !== for_
    if (skrevet) {
      const o = oversikt(t, na, innst)
      const ny = git.commit(
        kocommit,
        { [KOFIL]: json(t), [NESTEFIL]: json(o), [OVERSIKTSFIL]: oversiktMarkdown(t, na, innst) },
        `Kurateringskø: ${behandlet.length > 0 ? behandlet.map((b) => `${b.handling ?? 'ugyldig'} ${b.utfall}`).join(', ') : 'oppdatert'}${kjoring ? `\n\n${kjoring}` : ''}`,
      )
      if (!git.skyv(ny, KOGREN)) continue
    }

    for (const s of svar) skrivSvar(git, s.gren, s.commit, s.svar)
    const slettet = slettes.filter((g) => git.slett(g, okter[g]!))
    return { behandlet, malt: maling ? { stoffer: maling.stoffer.length, feilet: maling.feilet } : null, utlopt, slettet, forsok, skrevet }
  }
  throw new Error(`Køen ble skrevet av andre kjøringer ${maks} ganger på rad; prøver igjen ved neste kjøring.`)
}

/** Køen på køgrenen, eller en ny når grenen ikke finnes. */
function lesKo(git: Git, hoder: Readonly<Record<string, string>>): { t: Kotilstand; commit: string | null } {
  const sha = hoder[KOGREN]
  if (!sha) return { t: tomTilstand(new Date(0).toISOString()), commit: null }
  const commit = git.hent([KOGREN])[KOGREN]!
  const fil = git.les(commit, KOFIL)
  if (!fil) throw new Error(`${KOFIL} mangler på ${KOGREN}.`)
  const t = JSON.parse(fil.toString('utf8')) as Kotilstand
  // Køer fra før kurateringsgrenene har ikke feltet.
  for (const s of Object.values(t.stoffer)) s.appgren ??= null
  return { t, commit }
}

/** Svaret på øktgrenen. Har kuratoren skrevet på grenen imens, legges svaret oppå. */
function skrivSvar(git: Git, gren: string, commit: string, svar: Svar) {
  let forelder = commit
  for (let forsok = 0; forsok < 3; forsok += 1) {
    const ny = git.commit(forelder, { [SVARFIL]: json(svar) }, `Kurateringskø: ${svar.handling ?? 'forespørsel'} ${svar.utfall}`)
    if (git.skyv(ny, gren)) return
    forelder = git.hent([gren])[gren]!
  }
}
