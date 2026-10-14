/**
 * Endringsloggen for innholdssidene, slik databasen gir den
 * (`public.les_endringslogg`, `docs/innholdsendringer.md`).
 *
 * Hver endring er én lagring, publisering, handling i stoffregisteret eller
 * kuratering, med hvem som gjorde den — en person, en navngitt KI-agent eller
 * systemet — og delene den består av: objektene den endret, med revisjonene
 * før og etter, og hendelsene som ikke har revisjoner. Det er ikke appens egen
 * endringslogg over versjonene (`src/data/endringslogg.ts`).
 */
import type { Profil } from '@delt/profil'

/** Repoet migrasjonene og agentenes endringer ligger i. */
export const REPO = 'https://github.com/peohol/far'

/** Hvilken side loggen gjelder. */
export type Endringsside =
  | { stoff: string }
  | { stoffregister: true }
  | { analyttkoder: string[]; moduler: string[]; thc: boolean }

export type Aktor = 'bruker' | 'agent' | 'system'

/** Profilen en endring vises med: personens egen, eller den en agent har fått. */
export type Endringsprofil = Pick<Profil, 'id' | 'username' | 'first_name' | 'last_name' | 'avatar_path' | 'updated_at'>

export interface Endringsagent {
  nokkel: string
  navn: string
  art: 'ki-agent' | 'system'
  beskrivelse: string
  /** En rutine, som ryddingen av papirkurven: skjult i loggen til man ber om den. */
  rutine: boolean
}

/** Kjennetegnene til et objekt før eller etter: nok til å si hva som ble endret. */
export type Kjennetegn = Record<string, unknown>

export interface Listeendring {
  lagt_til: number
  fjernet: number
}

/** Ett objekt en endring endret, fra revisjonen før til revisjonen etter. */
export interface Endringsdel {
  objekt: string
  type: string
  /** Revisjonen før endringen; mangler når objektet ble opprettet. */
  fra: number | null
  til: number
  /** Om endringen ble publisert. */
  publisert: boolean
  for: Kjennetegn | null
  etter: Kjennetegn
  /** Feltene som ble endret; mangler når objektet ble opprettet. */
  endret: string[]
  /** For et kort: feltene i dataene som ble endret. */
  dataEndret: string[]
  /** For et kort: referansene som ble lagt til og fjernet. */
  referanser: Listeendring | null
  /** For en fagside: referansene som ble lagt til og fjernet per panel. */
  panelreferanser: Record<string, Listeendring>
  /** En referanse eller kommentar som også brukes andre steder enn på siden. */
  delt: boolean
}

/** Det i en endring som ikke har revisjoner: stoffregisteret og bivirkningene. */
export interface Hendelse {
  hendelse: string
  kl: string
  data: Record<string, unknown>
}

/** Rapporten en KI-agent avslutter en kuratering med. */
export interface Rapport {
  seksjoner: { seksjon: string; nytt: string[]; endret: string[]; fjernet: string[] }[]
  nye_opplysninger: string[]
  korrigeringer: string[]
  kildegrunnlag: string[]
  mangler: string[]
}

export interface Endring {
  id: string
  kl: string
  aktor: Aktor
  /** Satt sammen av revisjonene fra før loggen fantes. */
  eldre: boolean
  art: 'redigering' | 'kuratering'
  agent: Endringsagent | null
  person: { fornavn: string; etternavn: string } | null
  /** Profilbildet til den som gjorde endringen; mangler for systemet. */
  profil: Endringsprofil | null
  /** Det personen eller agenten skrev; uten den beskrives endringen av delene. */
  oppsummering: string | null
  rapport: Rapport | null
  /** Migrasjonen en agent eller systemet gjorde endringen med. */
  migrasjon: string | null
  /** Migrasjonen er kjørt og registrert i databasens migrasjonshistorikk. */
  verifisert: boolean
  lenker: string[]
  deler: Endringsdel[]
  hendelser: Hendelse[]
  /** Ingenting av den er publisert ennå (bare administratorer ser slike). */
  utkast: boolean
  /**
   * Den gjaldt bare delte referanser og kommentarer siden bruker. Hva den
   * ellers gjaldt (som en kuratering av en annen fagside), er utelatt.
   */
  delt: boolean
}

export interface Endringslogg {
  endringer: Endring[]
  /** Det finnes eldre endringer enn de som er hentet. */
  flere: boolean
}

/** Hvor neste side av loggen begynner: etter den siste endringen som er hentet. */
export interface Loggmarkor {
  kl: string
  id: string
}

export const markorEtter = (endring: Endring): Loggmarkor => ({ kl: endring.kl, id: endring.id })

const erObjekt = (verdi: unknown): verdi is Record<string, unknown> =>
  typeof verdi === 'object' && verdi !== null && !Array.isArray(verdi)
const tekst = (verdi: unknown): string | null => (typeof verdi === 'string' && verdi.trim() !== '' ? verdi : null)
const tall = (verdi: unknown): number | null => (typeof verdi === 'number' && Number.isFinite(verdi) ? verdi : null)
const tekster = (verdi: unknown): string[] => (Array.isArray(verdi) ? verdi.filter((v): v is string => typeof v === 'string') : [])

function lesListeendring(verdi: unknown): Listeendring | null {
  if (!erObjekt(verdi)) return null
  return { lagt_til: tall(verdi.lagt_til) ?? 0, fjernet: tall(verdi.fjernet) ?? 0 }
}

function lesDel(verdi: unknown): Endringsdel | null {
  if (!erObjekt(verdi)) return null
  const objekt = tekst(verdi.objekt)
  const type = tekst(verdi.type)
  const til = tall(verdi.til)
  if (!objekt || !type || til === null) return null
  const panelreferanser: Record<string, Listeendring> = {}
  if (erObjekt(verdi.panelreferanser)) {
    for (const [panel, endring] of Object.entries(verdi.panelreferanser)) {
      const lest = lesListeendring(endring)
      if (lest) panelreferanser[panel] = lest
    }
  }
  return {
    objekt,
    type,
    fra: tall(verdi.fra),
    til,
    publisert: verdi.publisert === true,
    for: erObjekt(verdi.for) ? verdi.for : null,
    etter: erObjekt(verdi.etter) ? verdi.etter : {},
    endret: tekster(verdi.endret),
    dataEndret: tekster(verdi.data_endret),
    referanser: lesListeendring(verdi.referanser),
    panelreferanser,
    delt: verdi.delt === true,
  }
}

function lesHendelse(verdi: unknown): Hendelse | null {
  if (!erObjekt(verdi)) return null
  const hendelse = tekst(verdi.hendelse)
  if (!hendelse) return null
  return { hendelse, kl: tekst(verdi.kl) ?? '', data: erObjekt(verdi.data) ? verdi.data : {} }
}

function lesProfil(verdi: unknown): Endringsprofil | null {
  if (!erObjekt(verdi)) return null
  const id = tekst(verdi.id)
  if (!id) return null
  return {
    id,
    username: tekst(verdi.username) ?? '',
    first_name: tekst(verdi.first_name) ?? '',
    last_name: tekst(verdi.last_name) ?? '',
    avatar_path: tekst(verdi.avatar_path),
    updated_at: tekst(verdi.updated_at) ?? '',
  }
}

function lesRapport(verdi: unknown): Rapport | null {
  if (!erObjekt(verdi)) return null
  const seksjoner = Array.isArray(verdi.seksjoner)
    ? verdi.seksjoner.filter(erObjekt).flatMap((s) => {
        const seksjon = tekst(s.seksjon)
        return seksjon ? [{ seksjon, nytt: tekster(s.nytt), endret: tekster(s.endret), fjernet: tekster(s.fjernet) }] : []
      })
    : []
  return {
    seksjoner,
    nye_opplysninger: tekster(verdi.nye_opplysninger),
    korrigeringer: tekster(verdi.korrigeringer),
    kildegrunnlag: tekster(verdi.kildegrunnlag),
    mangler: tekster(verdi.mangler),
  }
}

const AKTORER: readonly Aktor[] = ['bruker', 'agent', 'system']

function lesEndring(verdi: unknown): Endring | null {
  if (!erObjekt(verdi)) return null
  const id = tekst(verdi.id)
  const kl = tekst(verdi.kl)
  const aktor = AKTORER.find((a) => a === verdi.aktor)
  if (!id || !kl || !aktor) return null
  const agent = erObjekt(verdi.agent) && tekst(verdi.agent.nokkel) ? verdi.agent : null
  const person = erObjekt(verdi.person) ? verdi.person : null
  return {
    id,
    kl,
    aktor,
    eldre: verdi.eldre === true,
    art: verdi.art === 'kuratering' ? 'kuratering' : 'redigering',
    agent: agent && {
      nokkel: tekst(agent.nokkel)!,
      navn: tekst(agent.navn) ?? tekst(agent.nokkel)!,
      art: agent.art === 'system' ? 'system' : 'ki-agent',
      beskrivelse: tekst(agent.beskrivelse) ?? '',
      rutine: agent.rutine === true,
    },
    person: person && { fornavn: tekst(person.fornavn) ?? '', etternavn: tekst(person.etternavn) ?? '' },
    profil: lesProfil(verdi.profil),
    oppsummering: tekst(verdi.oppsummering),
    rapport: lesRapport(verdi.rapport),
    migrasjon: tekst(verdi.migrasjon),
    verifisert: verdi.verifisert === true,
    lenker: tekster(verdi.lenker),
    deler: Array.isArray(verdi.deler) ? verdi.deler.map(lesDel).filter((d): d is Endringsdel => d !== null) : [],
    hendelser: Array.isArray(verdi.hendelser) ? verdi.hendelser.map(lesHendelse).filter((h): h is Hendelse => h !== null) : [],
    utkast: verdi.utkast === true,
    delt: verdi.delt === true,
  }
}

/** Svaret fra databasen, lest forsiktig: det som ikke kan leses, hoppes over. */
export function lesEndringslogg(data: unknown): Endringslogg {
  if (!erObjekt(data)) return { endringer: [], flere: false }
  return {
    endringer: Array.isArray(data.endringer) ? data.endringer.map(lesEndring).filter((e): e is Endring => e !== null) : [],
    flere: data.flere === true,
  }
}

/** Lenken til migrasjonsfila i repoet, og til historikken dens (der PR-en står). */
export function migrasjonslenker(migrasjon: string): { fil: string; historikk: string } {
  const sti = `supabase/migrations/${encodeURIComponent(migrasjon)}`
  return { fil: `${REPO}/blob/main/${sti}`, historikk: `${REPO}/commits/main/${sti}` }
}
