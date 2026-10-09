/**
 * Typene OUSFAR henter fra Farmakologiportalen, og hvordan hver rad leses
 * (`docs/farmakologiportalen.md`).
 *
 * Portalens API gir hver type som én liste (`/api/components`,
 * `/api/analyses`, …). Hver rad leses til OUSFARs egne felt (`data`), og
 * raden slik den kom, lagres ved siden av (`raa`). Lesingen er tolerant:
 * et tall som ikke kan leses, står som teksten kilden skrev, en ukjent enhet
 * gir ingen omregning, og et ukjent prøvemateriale ingen matrise. En rad uten
 * ID forkastes. Mangler feltene lesingen bygger på i for mange rader, er
 * formatet endret, og da byttes ingenting inn (`synk.ts`).
 *
 * Feltnavnene i `data` er OUSFARs; reglene for hvilke av dem som er kliniske,
 * står i migrasjonen (`datakilder.feltregler`).
 */
import { lesGrense, lesKonsentrasjonsenhet, type Grense } from '../enheter/konsentrasjon.js'
import { matriseFor } from './provematerialer.js'

/** Økes når lesingen endres, så en endring som bare kommer av ny lesing, kan skilles fra en endring hos kilden. */
export const PARSERVERSJON = 1

export type Rad = Record<string, unknown>

export interface Lesekontekst {
  /** Enhetene i portalen, ID → navn: måleområdet kan oppgi enheten med ID-en. */
  enheter: ReadonlyMap<string, string>
}

export interface Lest {
  id: string
  data: Record<string, unknown>
}

export interface Entitet {
  navn: Entitetnavn
  /** Stien i API-et, under `/api`. */
  sti: string
  /** Feltene lesingen bygger på. Mangler de i mange rader, er formatet endret. */
  kreves: readonly string[]
  les(rad: Rad, kontekst: Lesekontekst): Lest | null
  /** Felt som ikke lagres i rådataene for typen (bilder), i tillegg til `REDAKTORFELT`. */
  utenRaa?: readonly string[]
}

/** Hvem i portalens redaksjon som sist endret en rad: personopplysninger OUSFAR ikke trenger, og som aldri lagres. */
export const REDAKTORFELT = ['approved_by', 'modified_by', 'published_by'] as const

export const ENTITETNAVN = ['enhet', 'provemateriale', 'institusjon', 'laboratorium', 'komponent', 'analyse'] as const
export type Entitetnavn = (typeof ENTITETNAVN)[number]

/* --- Felles lesing -------------------------------------------------------- */

export function tekst(v: unknown): string | null {
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  if (typeof v !== 'string') return null
  const t = v.replace(/ /g, ' ').replace(/\s+/g, ' ').trim()
  return t || null
}

function id(v: unknown): string | null {
  const t = tekst(v)
  return t && /^[0-9A-Za-z_-]{1,40}$/.test(t) ? t : null
}

function sannhet(v: unknown): boolean | null {
  if (v === true || v === 'true' || v === '1') return true
  if (v === false || v === 'false' || v === '0') return false
  return null
}

function liste(v: unknown): string[] {
  const t = typeof v === 'string' ? v : Array.isArray(v) ? v.join(',') : ''
  return [...new Set(t.split(/[,;]/).map((x) => x.trim()).filter((x) => /^[0-9A-Za-z_-]{1,40}$/.test(x)))]
}

/** Et JSON-felt portalen gir som tekst (`metabolites_json`). */
function jsonliste(v: unknown): Rad[] {
  try {
    const verdi = typeof v === 'string' ? JSON.parse(v) : v
    return Array.isArray(verdi) ? verdi.filter((x): x is Rad => typeof x === 'object' && x !== null) : []
  } catch {
    return []
  }
}

/** En enhet slik kilden oppga den, og OUSFARs skrivemåte når den kan regnes om. */
export interface Enhetsfelt {
  original: string | null
  enhet: string | null
}

function enhetsfelt(v: unknown, kontekst: Lesekontekst): Enhetsfelt {
  const t = tekst(v)
  const original = t && /^\d+$/.test(t) ? (kontekst.enheter.get(t) ?? t) : t
  return { original, enhet: lesKonsentrasjonsenhet(original)?.enhet ?? null }
}

/* --- Typene --------------------------------------------------------------- */

const navngitt = (navn: Entitetnavn, sti: string): Entitet => ({
  navn,
  sti,
  kreves: ['id', 'name'],
  les: (rad) => {
    const i = id(rad.id)
    const n = tekst(rad.name) ?? tekst(rad.title)
    return i && n ? { id: i, data: { navn: n } } : null
  },
})

export interface Komponentdata {
  navn: string
  hovedanalyse: boolean | null
  /** Morsubstansen, for en metabolitt. */
  mor_id: string | null
  metabolitter: string[]
  /** Komponentene en gruppe- eller sumanalyse dekker. */
  gruppe: string[]
  cas: string | null
  atc: string[]
  molvekt: { original: string | null; verdi: number | null }
  inchi: string | null
  synlighet: string | null
  utloper: string | null
  mal: string | null
}

export interface Analysedata {
  komponent_id: string
  navn: string
  laboratorium_id: string | null
  laboratorium: string | null
  institusjon_id: string | null
  institusjon: string | null
  provemateriale: { original: string | null; matrise: string | null }
  metode: string | null
  maleomrade: { nedre: Grense | null; ovre: Grense | null; enhet: Enhetsfelt }
  svarenhet: Enhetsfelt
  status: string | null
  synlighet: string | null
  akkreditert: boolean | null
  merknad: string | null
  kode: string | null
}

export const ENTITETER: readonly Entitet[] = [
  navngitt('enhet', '/units'),
  navngitt('provemateriale', '/sampletypes'),
  {
    navn: 'institusjon',
    sti: '/institutions',
    kreves: ['id', 'name'],
    les: (rad) => {
      const i = id(rad.id)
      const n = tekst(rad.name) ?? tekst(rad.title)
      return i && n ? { id: i, data: { navn: n, nettsted: tekst(rad.weburl) } } : null
    },
  },
  {
    navn: 'laboratorium',
    sti: '/labs',
    kreves: ['id', 'name', 'institution_id'],
    les: (rad) => {
      const i = id(rad.id)
      const n = tekst(rad.name) ?? tekst(rad.title)
      if (!i || !n) return null
      return {
        id: i,
        data: {
          navn: n,
          institusjon_id: id(rad.institution_id),
          institusjon: tekst(rad.institution),
          nettsted: tekst(rad.weburl),
          // Portalen viser ikke analysene ved et laboratorium som ikke er aktivt (bl.a. sitt eget testsystem).
          aktiv: sannhet(rad.active),
        },
      }
    },
  },
  {
    navn: 'komponent',
    sti: '/components',
    kreves: ['id', 'title', 'is_main_analysis', 'molecular_weight', 'cas_number', 'analyses_in_group'],
    utenRaa: ['image'],
    les: (rad) => {
      const i = id(rad.id)
      const n = tekst(rad.title) ?? tekst(rad.name)
      if (!i || !n) return null
      const mw = tekst(rad.molecular_weight)
      // Bare et rent tall er en molekylvekt; «239,74 (enalaprilat)» er ikke entydig.
      const mwTreff = mw ? /^(\d+(?:[.,]\d+)?)\s*(?:g\/mol)?$/i.exec(mw) : null
      const mwTall = mwTreff ? Number(mwTreff[1]!.replace(',', '.')) : null
      const mor = jsonliste(rad.mother_component_json).map((m) => id(m.mother_component_id)).find(Boolean) ?? null
      const data: Komponentdata = {
        navn: n,
        hovedanalyse: sannhet(rad.is_main_analysis),
        mor_id: mor,
        metabolitter: liste(rad.metabolites),
        gruppe: liste(rad.analyses_in_group),
        cas: tekst(rad.cas_number),
        atc: (tekst(rad.atc) ?? '').split(/[,;\s]+/).filter((a) => /^[A-Z]\d{2}[A-Z]{0,2}\d{0,2}$/.test(a)),
        molvekt: { original: mw, verdi: mwTall && mwTall > 0 ? mwTall : null },
        inchi: tekst(rad.inchi_code),
        synlighet: tekst(rad.visibility),
        utloper: tekst(rad.expire_date),
        mal: tekst(rad.content_template_id),
      }
      return { id: i, data: { ...data } }
    },
  },
  {
    navn: 'analyse',
    sti: '/analyses',
    kreves: ['id', 'analysis_archetype_id', 'lab_id', 'sampletype_name', 'method', 'meassurearea_lower', 'meassurearea_upper', 'meassurearea_unit'],
    les: (rad, kontekst) => {
      const i = id(rad.id)
      const komponent = id(rad.analysis_archetype_id)
      if (!i || !komponent) return null
      const provemateriale = tekst(rad.sampletype_name)
      const metode = tekst(rad.method)
      const nedre = lesGrense(rad.meassurearea_lower)
      const ovre = lesGrense(rad.meassurearea_upper)
      const oppgitt = enhetsfelt(rad.meassurearea_unit, kontekst)
      // En enhet som bare står i selve verdien («20 µg/L»), gjelder området når feltet for enheten er tomt.
      const iVerdien = nedre?.enhet ?? ovre?.enhet ?? null
      const enhet = oppgitt.original ? oppgitt : iVerdien ? { original: iVerdien, enhet: iVerdien } : oppgitt
      const data: Analysedata = {
        komponent_id: komponent,
        navn: tekst(rad.title) ?? tekst(rad.name) ?? tekst(rad.analysis_archetype_name) ?? komponent,
        laboratorium_id: id(rad.lab_id),
        laboratorium: tekst(rad.lab),
        institusjon_id: id(rad.institution_id),
        institusjon: tekst(rad.institution),
        provemateriale: { original: provemateriale, matrise: matriseFor(provemateriale)?.nokkel ?? null },
        metode: metode && !/^unknown$/i.test(metode) ? metode : null,
        maleomrade: { nedre, ovre, enhet },
        svarenhet: enhetsfelt(rad.response_unit_name ?? rad.response_unit_id, kontekst),
        status: tekst(rad.status),
        synlighet: tekst(rad.visibility),
        akkreditert: sannhet(rad.accredited),
        merknad: tekst(rad.special_concerns_override) ?? tekst(rad.special_concerns_text) ?? tekst(rad.special_concerns),
        kode: tekst(rad.code),
      }
      return { id: i, data: { ...data } }
    },
  },
]

export function entitet(navn: Entitetnavn): Entitet {
  return ENTITETER.find((e) => e.navn === navn)!
}
