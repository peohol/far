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
 * bivirkningene fra preparatomtalene, ClinPGx, CPIC, de kjemiske grunndataene
 * fra PubChem og laboratorieanalysene fra Farmakologiportalen.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { lesBivirkningsdata } from '../bivirkninger/lesing'
import { byggBivirkningsvisning } from '../bivirkninger/stoffside'
import { lagFarmakogenetikkleser, type Farmakogenetikkutvalg } from '../clinpgx/lesing'
import { byggFarmakogenetikkvisning, finnClinpgxkobling, kjemikaliestatuser } from '../clinpgx/stoffside'
import { lagCpicleser } from '../cpic/lesing'
import { byggCpicvisning } from '../cpic/stoffside'
import { VISNINGSENHETER } from '../enheter/konsentrasjon'
import { lagFaginnholdsleser, type Stoffsidedata } from '../faginnhold/lesing'
import { forekomster } from '../faginnhold/referanser'
import { byggSidemodell } from '../faginnhold/stoffside'
import { byggInteraksjoner, interaksjonsnokler } from '../legemiddeldata/interaksjoner'
import { lagLegemiddelleser, type Legemiddelutvalg } from '../legemiddeldata/lesing'
import { byggPreparatvisning } from '../legemiddeldata/preparatmodell'
import { koblede } from '../legemiddeldata/stoffside'
import { komponentnavn, forbindelsesnavn } from '../farmakologiportalen/kurering'
import { lagLableser, type Labutvalg } from '../farmakologiportalen/lesing'
import { bemerkning, byggLabvisning, laboppsummering, labkomponenter, labsoketekster, maleomrade } from '../farmakologiportalen/stoffside'
import { FORBINDELSER, type Forbindelsesregister } from '../kjemi/forbindelser'
import { lagKjemileser, type Kjemiutvalg } from '../kjemi/lesing'
import { byggKjemivisning, formeltekst, kjemicider, kjemioppsummering, kjemisoketekster, molvekttekst, type Kjemivisning } from '../kjemi/stoffside'
import { offentligFeil, samletStatus, type Kontroll, type Utfall } from './modell'

/**
 * Data som er eldre enn dette, gir en advarsel. Synkroniseringene går hver natt
 * (FEST, Farmakologiportalen) eller hver uke (ClinPGx, PubChem).
 */
export const FERSKHET_DAGER = { fest: 3, clinpgx: 10, pubchem: 10, farmakologiportalen: 3 } as const

export interface Funksjonstestresultat {
  stoff: string
  status: Utfall
  kontroller: Kontroll[]
}

export interface Funksjonstestvalg {
  na?: () => Date
  /** Forbindelsene og koblingene deres; appen bruker alltid registeret i `src/data/forbindelser.ts`. */
  register?: Forbindelsesregister
}

/**
 * Klienten med svarene databasen ga, tatt vare på per funksjon, så
 * kontrollene kan se om appens lesere forkastet noe av det de fikk. Kallene
 * går ellers uendret gjennom appens egne lesere.
 */
function medOpptak(klient: SupabaseClient): { klient: SupabaseClient; svar: Map<string, unknown> } {
  const svar = new Map<string, unknown>()
  const rpc = async (funksjon: string, argumenter?: Record<string, unknown>) => {
    const resultat = await klient.rpc(funksjon, argumenter)
    svar.set(funksjon, resultat.data)
    return resultat
  }
  return { klient: new Proxy(klient, { get: (mal, navn, mottaker) => (navn === 'rpc' ? rpc : Reflect.get(mal, navn, mottaker)) }), svar }
}

/** Antallet rader i en liste i et rått svar, før appens leser har sett på dem. */
function raderISvar(svar: unknown, felt: string): number {
  const liste = typeof svar === 'object' && svar !== null ? (svar as Record<string, unknown>)[felt] : undefined
  return Array.isArray(liste) ? liste.length : 0
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
export async function funksjonstest(
  klient: SupabaseClient,
  stoff: string,
  { na = () => new Date(), register = FORBINDELSER }: Funksjonstestvalg = {},
): Promise<Funksjonstestresultat> {
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

  /* --- Kjemiske grunndata og laboratorieanalysene ------------------------- */

  // Begge seksjonene finner forbindelsene etter stoffets nøkkel i registeret
  // over forbindelser, ikke etter koblinger på siden (`docs/kjemi.md`).
  const forbindelser = register.forStoff(stoff)
  const kjemi = await kjemikontroller()
  await labkontroller(kjemi)

  /** `les_kjemi` og seksjonen «Kjemiske grunndata». Gir visningen laboratorieanalysene regner om med. */
  async function kjemikontroller(): Promise<Kjemivisning | null> {
    if (forbindelser.length === 0) {
      legg({ id: 'kjemi', status: 'advarsel', melding: 'Stoffet har ingen forbindelser i registeret over forbindelser, så seksjonen «Kjemiske grunndata» vises ikke.' })
      return null
    }
    const cider = kjemicider(stoff, register)
    const uavklarte = forbindelser.filter((f) => !f.pubchem).length
    if (cider.length === 0) {
      legg({ id: 'kjemi', status: 'advarsel', melding: 'Ingen av forbindelsene er koblet sikkert til PubChem.', antall: { forbindelser: forbindelser.length, uavklarte } })
      return byggKjemivisning(stoff, null, register)
    }
    const opptak = medOpptak(klient)
    const utvalg = await kall<Kjemiutvalg>('kjemi', 'les_kjemi', () => lagKjemileser(opptak.klient).les(cider), (u) => {
      const rader = raderISvar(opptak.svar.get('les_kjemi'), 'forbindelser')
      const etterCid = new Map(u.forbindelser.map((p) => [p.cid, p]))
      const koblede = forbindelser.flatMap((f) => (f.pubchem ? [f.pubchem] : []))
      const avvik = koblede.filter((k) => {
        const p = etterCid.get(k.cid)
        return p && (p.data.inchikey !== k.inchikey || p.data.formel !== k.formel)
      }).length
      const ikkeHentet = koblede.filter((k) => !etterCid.has(k.cid)).length
      const ukjente = u.forbindelser.filter((p) => !koblede.some((k) => k.cid === p.cid)).length
      const antall = { forbindelser: forbindelser.length, hentet: koblede.length - ikkeHentet, ikke_hentet: ikkeHentet, uavklarte, rader, rader_appen_viser: u.forbindelser.length }
      if (ukjente > 0) return { status: 'feil', melding: `Svaret har ${ukjente} forbindelser stoffet ikke er koblet til.`, antall }
      if (avvik > 0) return { status: 'feil', melding: `${avvik} av forbindelsene har en annen InChIKey eller formel i kopien enn koblingen ble kontrollert mot.`, antall }
      if (u.forbindelser.length < rader) return { status: 'feil', melding: `Appen forkaster ${rader - u.forbindelser.length} av forbindelsene den får.`, antall }
      if (ikkeHentet > 0) return { status: 'advarsel', melding: `${ikkeHentet} av de koblede forbindelsene er ikke hentet fra PubChem ennå.`, antall }
      const eldst = byggKjemivisning(stoff, u, register).kontrollert_kl
      const dager = alder(eldst, na())
      if (dager === null || dager > FERSKHET_DAGER.pubchem) return { status: 'advarsel', melding: `PubChem-dataene ble sist kontrollert ${eldst ?? 'aldri'}.`, antall }
      if (uavklarte > 0) return { status: 'advarsel', melding: `${uavklarte} av forbindelsene er ikke koblet sikkert til PubChem og vises uten data.`, antall }
      return { status: 'ok', melding: `De kjemiske grunndataene ble lest, og koblingene stemmer (kontrollert ${eldst}).`, antall }
    })
    if (!utvalg) return null
    let visning: Kjemivisning | null = null
    bygg('kjemivisning', 'Seksjonen «Kjemiske grunndata»', () => {
      const v = byggKjemivisning(stoff, utvalg, register)
      if (v.rader.length !== forbindelser.length) throw new Error('Seksjonen viser ikke alle forbindelsene.')
      for (const r of v.rader) {
        if (!r.data) continue
        const molvekt = Number(r.data.molvekt)
        if (!formeltekst(r.data.formel) || !molvekttekst(r.data.molvekt) || !Number.isFinite(molvekt) || molvekt <= 0) throw new Error('Formelen eller molekylvekten kan ikke vises.')
      }
      kjemioppsummering(v)
      kjemisoketekster(v)
      visning = v
    })
    return visning
  }

  /** `les_laboratorieanalyser` og seksjonen «Analyse ved norske laboratorier». */
  async function labkontroller(kjemivisning: Kjemivisning | null) {
    const komponenter = labkomponenter(stoff, register)
    if (komponenter.length === 0) {
      legg({
        id: 'laboratorieanalyser',
        status: forbindelser.length === 0 ? 'advarsel' : 'ikke_aktuelt',
        melding:
          forbindelser.length === 0
            ? 'Stoffet har ingen forbindelser i registeret, så laboratorieanalysene kan ikke slås opp.'
            : 'Ingen av forbindelsene er koblet til Farmakologiportalen.',
      })
      return
    }
    const opptak = medOpptak(klient)
    const utvalg = await kall<Labutvalg>('laboratorieanalyser', 'les_laboratorieanalyser', () => lagLableser(opptak.klient).les(komponenter), (u) => {
      const svar = opptak.svar.get('les_laboratorieanalyser')
      const rader = { komponenter: raderISvar(svar, 'komponenter'), analyser: raderISvar(svar, 'analyser'), laboratorier: raderISvar(svar, 'laboratorier') }
      const etterId = new Map(u.komponenter.map((k) => [k.id, k.data]))
      const koblede = forbindelser.flatMap((f) => {
        const id = register.fpId(f)
        return id ? [{ f, id }] : []
      })
      const mangler = koblede.filter((k) => !etterId.has(k.id)).length
      const grupper = koblede.filter((k) => (etterId.get(k.id)?.gruppe.length ?? 0) > 0).length
      const nyttNavn = koblede.filter((k) => {
        const komponent = etterId.get(k.id)
        if (!komponent) return false
        // Koblingen ble gjort på et av navnene, eller komponentens tittel den gang.
        const tittel = k.f.farmakologiportalen && 'navn' in k.f.farmakologiportalen ? [k.f.farmakologiportalen.navn] : []
        const navn = forbindelsesnavn({ ...k.f, fpnavn: [...(k.f.fpnavn ?? []), ...tittel] })
        return !komponentnavn(komponent.navn).some((n) => navn.has(n))
      }).length
      const usikre = koblede.filter((k) => k.f.farmakologiportalen?.status === 'usikker').length
      const antall = {
        forbindelser: forbindelser.length,
        koblet: koblede.length,
        usikre,
        komponenter: u.komponenter.length,
        analyser: u.analyser.length,
        laboratorier: u.laboratorier.length,
      }
      if (!u.kilde.kontrollert_kl) return { status: 'advarsel', melding: 'Farmakologiportalen er aldri hentet.', antall }
      const forkastet = rader.komponenter - u.komponenter.length + (rader.analyser - u.analyser.length) + (rader.laboratorier - u.laboratorier.length)
      if (forkastet > 0) return { status: 'feil', melding: `Appen forkaster ${forkastet} av radene den får.`, antall: { ...antall, forkastet } }
      if (mangler > 0) return { status: 'feil', melding: `${mangler} av komponentene stoffet er koblet til, finnes ikke i kopien av Farmakologiportalen.`, antall: { ...antall, mangler } }
      if (grupper > 0) return { status: 'feil', melding: `${grupper} av komponentene stoffet er koblet til, er gruppe- eller sumanalyser.`, antall: { ...antall, grupper } }
      if (nyttNavn > 0) return { status: 'advarsel', melding: `${nyttNavn} av komponentene har et annet navn i portalen enn koblingen ble kontrollert mot.`, antall: { ...antall, nytt_navn: nyttNavn } }
      const dager = alder(u.kilde.kontrollert_kl, na())
      if (dager === null || dager > FERSKHET_DAGER.farmakologiportalen) {
        return { status: 'advarsel', melding: `Farmakologiportalen ble sist kontrollert ${u.kilde.kontrollert_kl}.`, antall }
      }
      return { status: 'ok', melding: `Laboratorieanalysene ble lest, og koblingene stemmer (kontrollert ${u.kilde.kontrollert_kl}).`, antall }
    })
    if (!utvalg) return
    try {
      const visning = byggLabvisning(stoff, utvalg, kjemivisning, register)
      const rader = visning.tabeller.flatMap((t) => t.rader)
      if (rader.some((r) => r.forbindelse && !forbindelser.includes(r.forbindelse))) throw new Error('En rad hører til en forbindelse stoffet ikke har.')
      // Måleområdet i hver enhet brukeren kan velge, og bemerkningen, slik tabellene viser dem.
      let ikkeOmregnet = 0
      for (const r of rader) {
        const omrader = VISNINGSENHETER.map((e) => maleomrade(r, e))
        if (omrader.some((m) => !m.omregnet && m.tekst !== 'Ikke oppgitt')) ikkeOmregnet += 1
        bemerkning(r)
      }
      // En verifisert kobling med molekylvekt fra PubChem skal regnes om med den.
      const medMolvekt = new Set((kjemivisning?.rader ?? []).filter((r) => r.data).map((r) => r.forbindelse.nokkel))
      const utenMolvekt = rader.filter(
        (r) => r.forbindelse?.farmakologiportalen?.status === 'verifisert' && medMolvekt.has(r.forbindelse.nokkel) && r.molvekt === null,
      ).length
      laboppsummering(visning)
      labsoketekster(visning)
      const antall = { tabeller: visning.tabeller.length, rader: rader.length, ikke_omregnet: ikkeOmregnet, usikre: visning.usikre.length }
      legg(
        utenMolvekt > 0
          ? { id: 'laboratorievisning', status: 'feil', melding: `${utenMolvekt} av radene regnes ikke om, selv om molekylvekten fra PubChem finnes.`, antall: { ...antall, uten_molvekt: utenMolvekt } }
          : { id: 'laboratorievisning', status: 'ok', melding: 'Seksjonen «Analyse ved norske laboratorier» kan bygges av svaret, i alle enhetene.', antall },
      )
    } catch (e) {
      legg({ id: 'laboratorievisning', status: 'feil', melding: `Seksjonen «Analyse ved norske laboratorier» kan ikke bygges av svaret (${offentligFeil(e)}).` })
    }
  }

  return { stoff, status: samletStatus(kontroller.map((k) => k.status)), kontroller }
}
