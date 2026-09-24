/**
 * Felles byggeklosser for preparatene fra FEST: pakningene, styrkene som tall
 * og tekst, deling/knusing/åpning, og hvilke virkestoff som hører til siden.
 * Visningsmodellen `legemiddelform → styrke → preparat` som seksjonen
 * «Preparater» viser, står i `preparatmodell.ts` og bygger på disse.
 *
 * Alt her er avledet av legemiddeldataene fra FEST ({@link Legemiddelutvalg}).
 * Ingenting legges til, rettes eller slås sammen på skjønn.
 *
 * - **Salter og estere** av et koblet virkestoff hører til siden.
 * - Preparater som krever **godkjenningsfritak** har preparattypen
 *   {@link GODKJENNINGSFRITAK}.
 */
import { formaterTall } from '../faginnhold/paneler'
import type { Mengde, Merkevaredata } from './fest'
import type { Legemiddelutvalg } from './lesing'

/** Preparattypen FEST bruker for preparater som krever godkjenningsfritak. */
export const GODKJENNINGSFRITAK = '11'

/** Én pakning av en merkevare. */
export interface Preparatpakning {
  id: string
  varenr: string
  /** F.eks. «100 stk, blisterpakning». */
  tekst: string
  /** Datoen pakningen er meldt midlertidig utgått, når den er det. */
  midlertidig_utgatt: string | null
}

/** En styrke som tall: `fra` og `til` er like når den ikke er et intervall. */
export interface Styrkemengde {
  fra: number
  til: number
  /** Enheten med det styrken er per, f.eks. «mg», «mg/ml» eller «mg/5 ml». */
  enhet: string
}

/**
 * Virkestoffene som hører til siden: de koblede og saltene deres, og hvilke av
 * dem som er salter.
 */
export function egneVirkestoff(utvalg: Legemiddelutvalg, koblet: readonly string[]) {
  const virkestoff = new Map(utvalg.virkestoff.map((v) => [v.id, v]))
  const egne = new Set<string>(koblet)
  const salter = new Set<string>()
  for (const id of koblet) {
    for (const salt of virkestoff.get(id)?.salter ?? []) {
      egne.add(salt)
      salter.add(salt)
    }
  }
  return { egne, salter }
}

/** Alle virkestoffene i merkevaren, med og uten styrke. */
export function virkestoffI(m: Merkevaredata, styrker: ReadonlyMap<string, { virkestoff_id: string }>): string[] {
  return [
    ...m.virkestoff_med_styrke.map((id) => styrker.get(id)?.virkestoff_id).filter((id) => id !== undefined),
    ...m.virkestoff_uten_styrke,
  ]
}

/**
 * Pakningene til hver merkevare, med størrelse, pakningstype og varenummer.
 */
export function pakningerPerMerkevare(utvalg: Legemiddelutvalg): Map<string, Preparatpakning[]> {
  const pakningerFor = new Map<string, Preparatpakning[]>()
  for (const p of utvalg.pakninger) {
    for (const innhold of p.innhold) {
      // Noen pakninger oppgir mengden i stedet for pakningsstørrelsen.
      const storrelse = innhold.pakningsstorrelse ?? innhold.mengde
      const liste = pakningerFor.get(innhold.merkevare_id) ?? []
      liste.push({
        id: p.id,
        varenr: p.varenr,
        tekst: [
          storrelse !== null && `${formaterTall(storrelse)} ${innhold.enhet?.kode ?? ''}`.trim(),
          innhold.pakningstype?.tekst.toLocaleLowerCase('nb'),
        ]
          .filter(Boolean)
          .join(', '),
        midlertidig_utgatt: p.midlertidig_utgatt_dato,
      })
      pakningerFor.set(innhold.merkevare_id, liste)
    }
  }
  return pakningerFor
}

/**
 * Deling, knusing og åpning som FEST oppgir dem. `tekst` er det som vises:
 * delingen med FESTs egne ord («Delbar i 2»); knusing og åpning er ja/nei i
 * FEST og får en setning. «Ikke spesifisert» (0) og «Ukjent» (9) sier
 * ingenting: status `ukjent` og ingen tekst. `varierer` brukes bare når flere
 * merkevarer slås sammen og FEST sier ulikt om dem.
 */
export type Handteringsstatus = 'ja' | 'nei' | 'ukjent' | 'varierer'

export interface Handteringsvalg {
  status: Handteringsstatus
  tekst: string | null
}

export interface Handtering {
  deling: Handteringsvalg
  knusing: Handteringsvalg
  apning: Handteringsvalg
}

const USPESIFISERT = new Set(['0', '9'])
const UKJENT: Handteringsvalg = { status: 'ukjent', tekst: null }
const DELING: Record<string, Handteringsstatus> = { '1': 'nei', '2': 'ja', '4': 'ja' }
const KNUSING: Record<string, Handteringsvalg> = {
  '1': { status: 'ja', tekst: 'Kan knuses' },
  '2': { status: 'nei', tekst: 'Kan ikke knuses' },
}
const APNING: Record<string, Handteringsvalg> = {
  '1': { status: 'ja', tekst: 'Kapselen kan åpnes' },
  '2': { status: 'nei', tekst: 'Kapselen kan ikke åpnes' },
}

export function handteringFor(m: Merkevaredata): Handtering {
  const kjent = <K extends { kode: string }>(k: K | null) => (k && !USPESIFISERT.has(k.kode) ? k : null)
  const deling = kjent(m.deling)
  return {
    deling: deling ? { status: DELING[deling.kode] ?? 'ukjent', tekst: deling.tekst || null } : UKJENT,
    knusing: KNUSING[kjent(m.kan_knuses)?.kode ?? ''] ?? UKJENT,
    apning: APNING[kjent(m.kan_apnes)?.kode ?? ''] ?? UKJENT,
  }
}

/**
 * Bare vanlige nettadresser blir lenker: `https`, og `http` når det er sagt.
 * Mange eldre kildehenvisninger i FEST er `http`.
 */
export function trygLenke(adresse: string | null, { http = false } = {}): string | undefined {
  return adresse && (http ? /^https?:\/\/\S+$/ : /^https:\/\/\S+$/).test(adresse) ? adresse : undefined
}


/** Styrken fra FEST som tall og enhet. `null` uten styrke. */
export function styrkemengde(styrke: Mengde | null, ovre: Mengde | null = null, nevner: Mengde | null = null): Styrkemengde | null {
  if (!styrke) return null
  const per = nevner ? `/${nevner.verdi === 1 ? '' : `${formaterTall(nevner.verdi)} `}${nevner.enhet}` : ''
  return { fra: styrke.verdi, til: ovre?.verdi ?? styrke.verdi, enhet: `${styrke.enhet}${per}` }
}

/** «25 mg», «10–20 mg», «50 mg/5 ml» eller «2 mg/ml». Tom uten styrke. */
export function formaterMengde(mengde: Styrkemengde | null): string {
  if (!mengde) return ''
  const { fra, til, enhet } = mengde
  const tall = fra === til ? formaterTall(fra) : `${formaterTall(fra)}–${formaterTall(til)}`
  return `${tall} ${enhet}`.trim()
}
