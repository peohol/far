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
import type { Mengde, Merkevaredata, Pakningsdata, Pakningsinnhold } from './fest'
import type { Legemiddelutvalg } from './lesing'

/** Preparattypen FEST bruker for preparater som krever godkjenningsfritak. */
export const GODKJENNINGSFRITAK = '11'

/** Én pakning av en merkevare. */
export interface Preparatpakning {
  id: string
  varenr: string
  /** F.eks. «100 stk, blisterpakning». */
  tekst: string
  /** Datoen pakningen er meldt midlertidig utgått, når den er det i dag ({@link midlertidigUtgatt}). */
  midlertidig_utgatt: string | null
  /** Byttegruppene i FEST pakningen hører til i dag ({@link gjeldendeByttegrupper}). */
  byttegrupper: string[]
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
 * Om en periode i FEST gjelder `idag`, med første og siste dag. Datoene er
 * `ÅÅÅÅ-MM-DD`, eventuelt med klokkeslett, og sammenlignes som tekst. Mangler
 * en grense, er perioden åpen den veien.
 */
export function gjelderIdag(fra: string | null | undefined, til: string | null | undefined, idag: string): boolean {
  const dag = (dato: string | null | undefined) => dato?.slice(0, 10) || null
  const f = dag(fra)
  const t = dag(til)
  return (!f || f <= idag) && (!t || t >= idag)
}

/**
 * Datoen pakningen ble midlertidig utgått, når den er det `idag`. En dato
 * fram i tid er bare meldt, og pakningen er fortsatt å få.
 */
export function midlertidigUtgatt(p: Pick<Pakningsdata, 'midlertidig_utgatt_dato'>, idag: string): string | null {
  const dato = p.midlertidig_utgatt_dato
  return dato && gjelderIdag(dato, null, idag) ? dato : null
}

/**
 * Byttegruppene pakningen hører til `idag`: ikke før dagen den går inn i
 * gruppen (FEST melder nye byttbarheter på forhånd), og ingen når pakningen
 * er avregistrert. Gruppens egen gyldighet sjekkes for seg.
 */
export function gjeldendeByttegrupper(
  p: Pick<Pakningsdata, 'byttegrupper' | 'byttegrupper_fra' | 'avregistrert_dato'>,
  idag: string,
): string[] {
  // Avregistreringsdatoen er den første dagen pakningen ikke er på markedet.
  const avregistrert = p.avregistrert_dato?.slice(0, 10)
  if (avregistrert && avregistrert <= idag) return []
  return p.byttegrupper.filter((id) => gjelderIdag(p.byttegrupper_fra?.[id], null, idag))
}

/**
 * Pakningene til hver merkevare, med størrelse, pakningstype og varenummer.
 */
export function pakningerPerMerkevare(utvalg: Legemiddelutvalg, idag: string): Map<string, Preparatpakning[]> {
  const pakningerFor = new Map<string, Preparatpakning[]>()
  for (const p of utvalg.pakninger) {
    for (const innhold of p.innhold) {
      const storrelse = pakningsstorrelse(innhold)
      const liste = pakningerFor.get(innhold.merkevare_id) ?? []
      liste.push({
        id: p.id,
        varenr: p.varenr,
        tekst: [
          storrelse !== null && `${storrelse} ${innhold.enhet?.kode ?? ''}`.trim(),
          innhold.pakningstype?.tekst.toLocaleLowerCase('nb'),
        ]
          .filter(Boolean)
          .join(', '),
        midlertidig_utgatt: midlertidigUtgatt(p, idag),
        byttegrupper: gjeldendeByttegrupper(p, idag),
      })
      pakningerFor.set(innhold.merkevare_id, liste)
    }
  }
  return pakningerFor
}

/**
 * Størrelsen på pakningen som tekst: tallet; FESTs egen tekst når størrelsen
 * ikke er ett tall, f.eks. «98 x 1» for en endosepakning; ellers antall og
 * mengde, eller bare mengden, som noen pakninger oppgir i stedet.
 */
function pakningsstorrelse(i: Pakningsinnhold): string | null {
  if (i.pakningsstorrelse !== null) return formaterTall(i.pakningsstorrelse)
  if (i.pakningsstorrelse_tekst) return i.pakningsstorrelse_tekst
  if (i.mengde === null) return null
  return i.antall === null ? formaterTall(i.mengde) : `${formaterTall(i.antall)} x ${formaterTall(i.mengde)}`
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
