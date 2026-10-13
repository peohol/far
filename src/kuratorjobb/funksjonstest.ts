/**
 * Funksjonstesten i kuratorjobbene: leser en fagside med de samme kallene og
 * den samme koden appen bruker, som en vanlig innlogget bruker, og
 * kontrollerer at hver del kan leses og settes sammen slik siden viser den.
 *
 * Resultatet er offentlig (jobbgrenene ligger i et offentlig repo), så det
 * har bare utfall, tall og faste meldinger, aldri innholdet appen leste eller
 * teksten i en feil (`offentligFeil`): det er bak innloggingen.
 *
 * Testen endrer ingenting. Den sammenligner ikke med noen fasit for
 * innholdet — det er kuratorens arbeid — men finner ut om appens faktiske
 * leseoperasjoner virker: `les_stoff`, legemiddeldataene fra FEST,
 * bivirkningene fra preparatomtalene, ClinPGx og CPIC.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { lesBivirkningsdata } from '../bivirkninger/lesing'
import { byggBivirkningsvisning } from '../bivirkninger/stoffside'
import { lagFarmakogenetikkleser, type Farmakogenetikkutvalg } from '../clinpgx/lesing'
import { byggFarmakogenetikkvisning, finnClinpgxkobling, kjemikaliestatuser } from '../clinpgx/stoffside'
import { lagCpicleser } from '../cpic/lesing'
import { byggCpicvisning } from '../cpic/stoffside'
import { lagFaginnholdsleser, type Stoffsidedata } from '../faginnhold/lesing'
import { forekomster } from '../faginnhold/referanser'
import { byggSidemodell } from '../faginnhold/stoffside'
import { byggInteraksjoner, interaksjonsnokler } from '../legemiddeldata/interaksjoner'
import { lagLegemiddelleser, type Legemiddelutvalg } from '../legemiddeldata/lesing'
import { byggPreparatvisning } from '../legemiddeldata/preparatmodell'
import { koblede } from '../legemiddeldata/stoffside'
import { offentligFeil, samletStatus, type Kontroll, type Utfall } from './modell'

/** Data som er eldre enn dette, gir en advarsel. Synkroniseringene går hver natt (FEST) eller hver uke (ClinPGx). */
export const FERSKHET_DAGER = { fest: 3, clinpgx: 10 } as const

export interface Funksjonstestresultat {
  stoff: string
  status: Utfall
  kontroller: Kontroll[]
}

export interface Funksjonstestvalg {
  na?: () => Date
}

const ms = (start: number) => Math.round(performance.now() - start)

function alder(kl: string | null, na: Date): number | null {
  if (!kl) return null
  const t = Date.parse(kl)
  return Number.isFinite(t) ? (na.getTime() - t) / 86_400_000 : null
}

/** Kontrollene av testbrukeren: at den er en vanlig bruker, og at den er logget inn. */
export async function kontrollerBruker(klient: SupabaseClient): Promise<Kontroll[]> {
  const start = performance.now()
  const { data, error } = await klient.rpc('er_admin', {})
  if (error) return [{ id: 'bruker', status: 'feil', melding: `Kunne ikke slå opp rollen (${offentligFeil(error)}).`, rpc: 'er_admin', ms: ms(start) }]
  return [
    data === false
      ? { id: 'bruker', status: 'ok', melding: 'Testbrukeren er en vanlig innlogget bruker, ikke administrator.', rpc: 'er_admin', ms: ms(start) }
      : {
          id: 'bruker',
          status: 'feil',
          melding: 'Testbrukeren er administrator. Testen skal kjøres som en vanlig bruker, som ikke ser utkast.',
          rpc: 'er_admin',
          ms: ms(start),
        },
  ]
}

/**
 * Funksjonstesten for ett stoff. Kaster aldri: en feil i ett kall blir en
 * kontroll med `feil`, og resten kjøres så langt de kan uten det.
 */
export async function funksjonstest(klient: SupabaseClient, stoff: string, { na = () => new Date() }: Funksjonstestvalg = {}): Promise<Funksjonstestresultat> {
  const kontroller: Kontroll[] = []
  const legg = (k: Kontroll) => kontroller.push(k)

  /** Kjører ett kall som en kontroll. Gir svaret, eller `undefined` når kallet feilet. */
  async function kall<T>(id: string, rpc: string, arbeid: () => Promise<T>, vurder: (svar: T) => Omit<Kontroll, 'id' | 'rpc' | 'ms'>): Promise<T | undefined> {
    const start = performance.now()
    try {
      const resultat = await arbeid()
      legg({ id, rpc, ms: ms(start), ...vurder(resultat) })
      return resultat
    } catch (e) {
      legg({ id, rpc, ms: ms(start), status: 'feil', melding: `${rpc} feilet (${offentligFeil(e)}).` })
      return undefined
    }
  }

  /** At appen kan bygge visningen av dataene, slik siden gjør. */
  function bygg(id: string, hva: string, arbeid: () => unknown) {
    try {
      arbeid()
      legg({ id, status: 'ok', melding: `${hva} kan bygges av svaret.` })
    } catch (e) {
      legg({ id, status: 'feil', melding: `${hva} kan ikke bygges av svaret (${offentligFeil(e)}).` })
    }
  }

  const faginnhold = lagFaginnholdsleser(klient)

  /* --- Fagsiden ----------------------------------------------------------- */

  const side = await kall<Stoffsidedata>('les_stoff', 'les_stoff', () => faginnhold.lesStoffside(stoff, 'publisert'), (s) => {
    if (!s.infoside || !s.stoff) return { status: 'feil', melding: `Fant ingen publisert fagside med nøkkelen «${stoff}».` }
    if (s.stoff.slug !== stoff) return { status: 'feil', melding: `Siden har nøkkelen «${s.stoff.slug}», ikke «${stoff}».` }
    const antall = { elementer: s.elementer.length, referanser: s.referanser.length }
    return s.elementer.length === 0
      ? { status: 'advarsel', melding: 'Den publiserte siden har ingen innholdselementer.', antall }
      : { status: 'ok', melding: 'Den publiserte siden ble lest.', antall }
  })

  const modell = (() => {
    if (!side?.infoside) return null
    try {
      const m = byggSidemodell(side)
      legg({ id: 'sidemodell', status: 'ok', melding: 'Siden kan settes sammen slik appen viser den.' })
      return m
    } catch (e) {
      legg({ id: 'sidemodell', status: 'feil', melding: `Siden kan ikke settes sammen (${offentligFeil(e)}).` })
      return null
    }
  })()

  if (modell) {
    const kjente = new Set(modell.referanser.map((r) => r.id))
    const elementer = [...modell.paneler.values()].flat()
    const sitert = [...new Set(forekomster({ elementer, panelreferanser: modell.panelreferanser }).flatMap((f) => f.ider))]
    const mangler = sitert.filter((id) => !kjente.has(id))
    legg(
      mangler.length === 0
        ? { id: 'referanser', status: 'ok', melding: 'Alle referansene siden siterer, ble lest med den.', antall: { sitert: sitert.length } }
        : {
            id: 'referanser',
            status: 'feil',
            melding: `Siden siterer ${mangler.length} referanser som ikke kom med i svaret.`,
            antall: { sitert: sitert.length, mangler: mangler.length },
          },
    )
  }

  await kall('utkast_skjult', 'les_stoff', () => faginnhold.lesStoffside(stoff, 'utkast'), (s) =>
    s.infoside === null && s.elementer.length === 0
      ? { status: 'ok', melding: 'Utkastet er skjult for en vanlig bruker, som det skal.' }
      : { status: 'feil', melding: 'En vanlig bruker fikk lese utkastet til siden.' },
  )

  await kall('stoffliste', 'les_stoffliste', () => faginnhold.lesStoffliste('publisert'), (liste) =>
    liste.some((s) => s.slug === stoff)
      ? { status: 'ok', melding: 'Siden står i lista over fagsider.', antall: { sider: liste.length } }
      : { status: 'feil', melding: 'Siden står ikke i lista over fagsider.', antall: { sider: liste.length } },
  )

  /* --- Legemiddeldataene fra FEST ----------------------------------------- */

  const virkestoff = modell ? koblede(modell) : []
  if (!modell) legg({ id: 'fest', status: 'feil', melding: 'Kunne ikke lese koblingen til FEST uten siden.' })
  else if (virkestoff.length === 0) legg({ id: 'fest', status: 'ikke_aktuelt', melding: 'Siden er ikke koblet til virkestoff i FEST.' })
  else {
    const legemidler = lagLegemiddelleser(klient)
    const utvalg = await kall<Legemiddelutvalg>('fest', 'les_legemidler', () => legemidler.les(virkestoff), (u) => {
      const funnet = new Set(u.virkestoff.map((v) => v.id))
      const mangler = virkestoff.filter((id) => !funnet.has(id))
      const antall = { virkestoff: u.virkestoff.length, merkevarer: u.merkevarer.length, pakninger: u.pakninger.length }
      if (mangler.length > 0) return { status: 'feil', melding: `${mangler.length} av virkestoffene siden er koblet til, finnes ikke i FEST-kopien.`, antall: { ...antall, mangler: mangler.length } }
      const dager = alder(u.kontrollert_kl, na())
      if (dager === null || dager > FERSKHET_DAGER.fest) {
        return { status: 'advarsel', melding: `FEST-kopien ble sist kontrollert ${u.kontrollert_kl ?? 'aldri'}.`, antall }
      }
      if (u.merkevarer.length === 0) return { status: 'advarsel', melding: 'FEST har ingen preparater med virkestoffene.', antall }
      return { status: 'ok', melding: `Legemiddeldataene ble lest (FEST kontrollert ${u.kontrollert_kl}).`, antall }
    })
    if (utvalg) {
      bygg('preparatvisning', 'Preparatseksjonen', () => byggPreparatvisning(utvalg, virkestoff))
      const nokler = interaksjonsnokler(utvalg, virkestoff)
      const interaksjoner = await kall('interaksjoner', 'les_interaksjoner', () => legemidler.interaksjoner(nokler), (i) => ({
        status: 'ok',
        melding: 'Interaksjonene ble lest.',
        antall: { interaksjoner: i.interaksjoner.length, ikke_vurdert: i.ikke_vurdert.length },
      }))
      if (interaksjoner) bygg('interaksjonsvisning', 'Interaksjonsseksjonen', () => byggInteraksjoner(interaksjoner, nokler))
    }
  }

  /* --- Bivirkningene fra preparatomtalene --------------------------------- */

  {
    const start = performance.now()
    const { data, error } = await klient.rpc('les_bivirkninger', { stoff })
    if (error) legg({ id: 'bivirkninger', rpc: 'les_bivirkninger', ms: ms(start), status: 'feil', melding: `les_bivirkninger feilet (${offentligFeil(error)}).` })
    else {
      const rader = Array.isArray((data as { bivirkninger?: unknown } | null)?.bivirkninger) ? (data as { bivirkninger: unknown[] }).bivirkninger.length : 0
      const lest = lesBivirkningsdata(data)
      const antall = { kilder: lest.kilder.length, rader, rader_appen_viser: lest.bivirkninger.length }
      legg(
        lest.bivirkninger.length < rader
          ? { id: 'bivirkninger', rpc: 'les_bivirkninger', ms: ms(start), status: 'feil', melding: `Appen forkaster ${rader - lest.bivirkninger.length} av radene den får.`, antall }
          : lest.kilder.length === 0
            ? { id: 'bivirkninger', rpc: 'les_bivirkninger', ms: ms(start), status: 'ikke_aktuelt', melding: 'Ingen bivirkninger er importert fra preparatomtaler for siden.', antall }
            : { id: 'bivirkninger', rpc: 'les_bivirkninger', ms: ms(start), status: 'ok', melding: 'Bivirkningene ble lest, og appen viser alle radene.', antall },
      )
      if (lest.kilder.length > 0) bygg('bivirkningsvisning', 'Bivirkningsseksjonen', () => byggBivirkningsvisning(lest))
    }
  }

  /* --- ClinPGx og CPIC ---------------------------------------------------- */

  const kobling = modell ? finnClinpgxkobling(modell).kobling : null
  const kjemikalier = kobling?.kjemikalier.map((k) => k.clinpgx_id) ?? []
  if (!modell) legg({ id: 'clinpgx', status: 'feil', melding: 'Kunne ikke lese koblingen til ClinPGx uten siden.' })
  else if (kjemikalier.length === 0) {
    legg({ id: 'clinpgx', status: 'ikke_aktuelt', melding: 'Siden er ikke koblet til ClinPGx.' })
    legg({ id: 'cpic', status: 'ikke_aktuelt', melding: 'Siden er ikke koblet til ClinPGx, som CPIC slås opp etter.' })
  } else {
    const pgx = await kall<Farmakogenetikkutvalg>('clinpgx', 'les_farmakogenetikk', () => lagFarmakogenetikkleser(klient).les(kjemikalier), (u) => {
      const statuser = kjemikaliestatuser(u, kobling!)
      const ikkeHentet = statuser.filter((s) => !s.sist_hentet_kl).length
      const feilet = statuser.filter((s) => s.feil || !s.finnes).length
      const antall = { kjemikalier: statuser.length, retningslinjer: u.retningslinjer.length, preparatomtaler: u.preparatomtaler.length, kliniske: u.kliniske.length }
      if (ikkeHentet > 0) return { status: 'advarsel', melding: `${ikkeHentet} av kjemikaliene er ikke hentet fra ClinPGx ennå.`, antall: { ...antall, ikke_hentet: ikkeHentet } }
      if (feilet > 0) return { status: 'advarsel', melding: `${feilet} av kjemikaliene hadde feil ved siste henting, eller finnes ikke i ClinPGx.`, antall: { ...antall, feilet } }
      const dager = alder(u.kontrollert_kl, na())
      if (dager === null || dager > FERSKHET_DAGER.clinpgx) return { status: 'advarsel', melding: `ClinPGx ble sist synkronisert ${u.kontrollert_kl ?? 'aldri'}.`, antall }
      return { status: 'ok', melding: `ClinPGx-dataene ble lest (synkronisert ${u.kontrollert_kl}).`, antall }
    })
    if (pgx) bygg('farmakogenetikkvisning', 'Farmakogenetikkseksjonen', () => byggFarmakogenetikkvisning(pgx))

    const cpic = await kall('cpic', 'les_cpic', () => lagCpicleser(klient).les(kjemikalier), (u) => {
      const antall = { legemidler: u.legemidler.length, par: u.par.length, retningslinjer: u.retningslinjer.length, anbefalinger: u.anbefalinger.length }
      if (!u.kilde.release) return { status: 'advarsel', melding: 'CPIC-kopien har ingen release; den er kanskje aldri hentet.', antall }
      return u.legemidler.length === 0
        ? { status: 'ok', melding: `CPIC (release ${u.kilde.release}) har ingenting for kjemikaliene.`, antall }
        : { status: 'ok', melding: `CPIC-dataene ble lest (release ${u.kilde.release}).`, antall }
    })
    if (cpic) bygg('cpicvisning', 'CPIC-visningen', () => byggCpicvisning(cpic))
  }

  return { stoff, status: samletStatus(kontroller.map((k) => k.status)), kontroller }
}
