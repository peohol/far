/**
 * Grunnlaget for søket i hele kunnskapsbasen: alle de publiserte sidene,
 * lest i én omgang og indeksert med den samme koden som søket på én side.
 *
 * Lesingen er fire kall, uansett hvor mange sider det er, og søket kan brukes
 * før de er ferdige (se {@link lesSokeindeks}):
 *
 * 1. `les_analyttsider` gir alle sidene på samme form som `les_analyttside`,
 *    og `les_stoffsider` sidene for stoffene uten analyttkode, på samme form.
 * 2. `les_legemidler` gir legemiddeldataene for alle virkestoffene sidene er
 *    koblet til. Hver side får sin del (`utvalgFor`), med de samme
 *    preparatene som seksjonen «Preparater» viser.
 * 3. `les_interaksjoner` gir interaksjonene for alle sidene. Hver side får
 *    dem `byggInteraksjoner` velger for sidens egne nøkler.
 * 4. `les_farmakogenetikk` gir ClinPGx-dataene for alle kjemikaliene sidene er
 *    koblet til, og `les_cpic` CPIC-anbefalingene for de samme. Hver side får
 *    sin del (`farmakogenetikkFor`, `cpicFor`).
 *
 * Rangeringen skjer bare i `sok.ts`; databasen gir bare innholdet. Klarer ikke
 * legemiddeldataene, ClinPGx-dataene eller CPIC-dataene å lese, indekseres
 * faginnholdet likevel, og feilen står i {@link Kunnskapsbase.festfeil},
 * {@link Kunnskapsbase.clinpgxfeil} eller {@link Kunnskapsbase.cpicfeil}.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { byggSidemodell, type Sidemodell } from './analyttside'
import { tilFeil } from './lagring'
import { TOM_SIDE, type Analyttsidedata, type Utgave } from './lesing'
import type { Referanseinnhold, Tilstand } from './modell'
import { alfabetisk } from './paneler'
import {
  indekserSide,
  lagSokeindeks,
  type Sideidentitet,
  type Sokedokument,
  type Sokeindeks,
  type Tilleggstekst,
} from './sok'
import { byggInteraksjoner, interaksjonsnokler } from '../legemiddeldata/interaksjoner'
import type { Interaksjonsnokler, Interaksjonsutvalg, Legemiddelleser, Legemiddelutvalg } from '../legemiddeldata/lesing'
import { byggPreparatvisning } from '../legemiddeldata/preparatmodell'
import { interaksjonstekster, koblede, preparattekster, utvalgFor } from '../legemiddeldata/stoffside'
import { farmakogenetikkFor, type Farmakogenetikkleser, type Farmakogenetikkutvalg } from '../clinpgx/lesing'
import { byggFarmakogenetikkvisning, farmakogenetikktekster, kobledeKjemikalier } from '../clinpgx/stoffside'
import type { Cpicleser, Cpicutvalg } from '../cpic/lesing'
import { byggCpicvisning, cpicFor, cpictekster } from '../cpic/stoffside'

/** Alt søket i kunnskapsbasen indekserer. */
export interface Kunnskapsbase {
  sider: Analyttsidedata[]
  /** Legemiddeldataene for alle koblingene, eller `null` uten dem. */
  legemidler: Legemiddelutvalg | null
  /** Interaksjonene for alle koblingene, eller `null` uten dem. */
  interaksjoner: Interaksjonsutvalg | null
  /** Hvorfor legemiddeldataene mangler, når lesingen av dem feilet. */
  festfeil?: string
  /** ClinPGx-dataene for alle koblingene, eller `null` uten dem. */
  farmakogenetikk?: Farmakogenetikkutvalg | null
  /** Hvorfor ClinPGx-dataene mangler, når lesingen av dem feilet. */
  clinpgxfeil?: string
  /** CPIC-dataene for de samme koblingene, eller `null` uten dem. */
  cpic?: Cpicutvalg | null
  /** Hvorfor CPIC-dataene mangler, når lesingen av dem feilet. */
  cpicfeil?: string
}

export interface Sideleser {
  /** Alle analyttsidene i én tilstand, sortert på koden. */
  lesAnalyttsider(tilstand: Tilstand): Promise<Analyttsidedata[]>
  /** Sidene for stoffene uten analyttkode i én tilstand, alfabetisk. `analytt` er `null`. */
  lesStoffsider(tilstand: Tilstand): Promise<Analyttsidedata[]>
}

/** Formen `les_analyttsider` og `les_stoffsider` gir: sidene, og referansene de siterer, én gang. */
interface Samletlesing {
  sider: (Omit<Analyttsidedata, 'referanser' | 'regelsett' | 'scenarioregelsett'> & { referanser: string[] })[]
  referanser: Utgave<Referanseinnhold>[]
}

export function lagSideleser(klient: SupabaseClient): Sideleser {
  async function les(funksjon: string, tilstand: Tilstand): Promise<Analyttsidedata[]> {
    const { data, error } = await klient.rpc(funksjon, { sidetilstand: tilstand })
    if (error) throw tilFeil(error)
    const { sider = [], referanser = [] } = (data ?? {}) as Partial<Samletlesing>
    const perId = new Map(referanser.map((r) => [r.id, r]))
    return sider.map((side) => ({
      ...TOM_SIDE,
      ...side,
      referanser: side.referanser.flatMap((id) => perId.get(id) ?? []),
    }))
  }
  return {
    lesAnalyttsider: (tilstand) => les('les_analyttsider', tilstand),
    lesStoffsider: (tilstand) => les('les_stoffsider', tilstand),
  }
}

/** Flest ATC-koder og virkestoff `les_interaksjoner` tar imot i ett kall (migrasjonen `*_interaksjoner.sql`). */
export const MAKS_INTERAKSJONSNOKLER = 100

/**
 * Leser alt søket indekserer: sidene i `tilstand`, og legemiddeldataene og
 * interaksjonene for dem når `legemidler` er gitt.
 */
export async function lesKunnskapsbase(
  sider: Sideleser,
  legemidler: Legemiddelleser | null,
  tilstand: Tilstand = 'publisert',
  farmakogenetikk: Farmakogenetikkleser | null = null,
  cpic: Cpicleser | null = null,
): Promise<Kunnskapsbase> {
  return lesTillegg(await lesSidene(sider, tilstand), legemidler, farmakogenetikk, cpic)
}

/** Sidene i `tilstand`, uten legemiddeldataene. Det første søket kan gjøre. */
async function lesSidene(sider: Sideleser, tilstand: Tilstand): Promise<Analyttsidedata[]> {
  // Stoffsidene uten kode er et tillegg: kan de ikke leses, søkes det i resten.
  return (await Promise.all([sider.lesAnalyttsider(tilstand), sider.lesStoffsider(tilstand).catch(() => [])])).flat()
}

/** Sidene med legemiddeldataene, ClinPGx-dataene og CPIC-dataene de er koblet til. */
async function lesTillegg(
  lest: Analyttsidedata[],
  legemidler: Legemiddelleser | null,
  farmakogenetikk: Farmakogenetikkleser | null,
  cpic: Cpicleser | null,
): Promise<Kunnskapsbase> {
  const modeller = lest.map((s) => byggSidemodell(s))
  const [fest, clinpgx, cpicdata] = await Promise.all([
    lesLegemiddeldata(legemidler, modeller),
    lesForKjemikalier(farmakogenetikk, modeller),
    lesForKjemikalier(cpic, modeller),
  ])
  return {
    sider: lest,
    ...fest,
    farmakogenetikk: clinpgx.utvalg,
    ...(clinpgx.feil && { clinpgxfeil: clinpgx.feil }),
    cpic: cpicdata.utvalg,
    ...(cpicdata.feil && { cpicfeil: cpicdata.feil }),
  }
}

async function lesLegemiddeldata(
  legemidler: Legemiddelleser | null,
  modeller: readonly Sidemodell[],
): Promise<Pick<Kunnskapsbase, 'legemidler' | 'interaksjoner' | 'festfeil'>> {
  const tom = { legemidler: null, interaksjoner: null }
  const perSide = modeller.map(koblede).filter((k) => k.length > 0)
  if (!legemidler || perSide.length === 0) return tom

  try {
    const utvalg = await legemidler.les([...new Set(perSide.flat())].sort())
    const nokler = slaSammen(perSide.map((k) => interaksjonsnokler(utvalgFor(utvalg, k), k)))
    const interaksjoner = await lesInteraksjoner(legemidler, nokler)
    return { legemidler: utvalg, interaksjoner }
  } catch (e) {
    return { ...tom, festfeil: e instanceof Error ? e.message : String(e) }
  }
}

/**
 * Dataene fra en kilde for alle kjemikaliene sidene er koblet til i ClinPGx,
 * i ett kall. Feiler lesingen, er dataene `null` og feilen med.
 */
async function lesForKjemikalier<U>(
  leser: { les(ider: readonly string[]): Promise<U> } | null,
  modeller: readonly Sidemodell[],
): Promise<{ utvalg: U | null; feil?: string }> {
  const alle = [...new Set(modeller.flatMap(kobledeKjemikalier))].sort()
  if (!leser || alle.length === 0) return { utvalg: null }
  try {
    return { utvalg: await leser.les(alle) }
  } catch (e) {
    return { utvalg: null, feil: e instanceof Error ? e.message : String(e) }
  }
}

function slaSammen(alle: readonly Interaksjonsnokler[]): Interaksjonsnokler {
  const samlet = (felt: keyof Interaksjonsnokler) => [...new Set(alle.flatMap((n) => n[felt]))].sort()
  return { atc: samlet('atc'), virkestoff: samlet('virkestoff') }
}

/** Interaksjonene for alle nøklene, i så få kall som grensen i databasen tillater. */
async function lesInteraksjoner(leser: Legemiddelleser, { atc, virkestoff }: Interaksjonsnokler): Promise<Interaksjonsutvalg> {
  const deler = Math.max(1, Math.ceil(Math.max(atc.length, virkestoff.length) / MAKS_INTERAKSJONSNOKLER))
  const del = <T>(liste: readonly T[], n: number) =>
    liste.slice(n * MAKS_INTERAKSJONSNOKLER, (n + 1) * MAKS_INTERAKSJONSNOKLER)
  const svar = await Promise.all(
    Array.from({ length: deler }, (_, n) => leser.interaksjoner({ atc: del(atc, n), virkestoff: del(virkestoff, n) })),
  )
  const unike = <T extends { id: string }>(lister: T[][]) => [...new Map(lister.flat().map((x) => [x.id, x])).values()]
  return {
    interaksjoner: unike(svar.map((s) => s.interaksjoner)),
    ikke_vurdert: unike(svar.map((s) => s.ikke_vurdert)),
  }
}

/**
 * Tekstene fra legemiddeldataene på én side — preparatene og interaksjonene —
 * de samme som søket på siden får.
 */
/** Tekstene fra ClinPGx på én side, de samme som søket på siden får. */
function farmakogenetikktekstene(base: Kunnskapsbase, modell: Sidemodell): Tilleggstekst[] {
  const koblet = kobledeKjemikalier(modell)
  if (!base.farmakogenetikk || koblet.length === 0) return []
  return farmakogenetikktekster(byggFarmakogenetikkvisning(farmakogenetikkFor(base.farmakogenetikk, koblet)))
}

/** Tekstene fra CPIC på én side, de samme som søket på siden får. */
function cpictekstene(base: Kunnskapsbase, modell: Sidemodell): Tilleggstekst[] {
  const koblet = kobledeKjemikalier(modell)
  if (!base.cpic || koblet.length === 0) return []
  return cpictekster(byggCpicvisning(cpicFor(base.cpic, koblet)))
}

function legemiddeltekster(base: Kunnskapsbase, koblet: readonly string[]): Tilleggstekst[] {
  if (!base.legemidler || koblet.length === 0) return []
  const utvalg = utvalgFor(base.legemidler, koblet)
  return [
    ...preparattekster(byggPreparatvisning(utvalg, koblet)),
    ...(base.interaksjoner
      ? interaksjonstekster(byggInteraksjoner(base.interaksjoner, interaksjonsnokler(utvalg, koblet)))
      : []),
  ]
}

export interface Indekseringsvalg {
  /**
   * Andre navn en analyttkode er kjent under, som søket etter analytter
   * bruker (`aliaser` på analytten, fra `src/data/aliaser.json`). Appen gir
   * dem fra katalogen, så søkeordene vedlikeholdes ett sted.
   */
  aliaser?: (kode: string) => readonly string[] | undefined
  /**
   * Alle analyttsidene appen har, fra katalogen: koden, navnet siden vises med
   * og komponentene, med hovedkoden først for sider flere koder deler. Hver kode har en side, også uten publisert
   * informasjonsside — da viser siden navnet fra katalogen og
   * fortolkningsreglene. Søket finner også de sidene, på navnet og koden.
   */
  sider?: readonly (Omit<Sideidentitet, 'aliaser' | 'kode'> & { kode: string })[]
}

/** En side slik søket indekserer den: navnet, kodene som viser den, og innholdet. */
interface Indekseringsside {
  navn: string
  /** Tom for et stoff uten analyttkode. */
  koder: string[]
  komponenter: string[]
  modell: Sidemodell
  tillegg: Tilleggstekst[]
}

const TOM_MODELL = byggSidemodell(TOM_SIDE)

/**
 * Søkedokumentene for hele kunnskapsbasen: hver side indeksert med
 * `indekserSide`, som på siden selv. Sidene står alfabetisk, så like gode
 * treff kommer i en fast rekkefølge.
 *
 * Deler flere koder samme informasjonsside, indekseres siden én gang, under
 * den første koden i `sider` (hovedkoden), og de andre kodene er med som
 * koder på den. En kode i `sider` som ingen informasjonsside viser,
 * indekseres med navnet fra katalogen, som siden selv viser — sammen med
 * siden med det navnet, når den er med. Et stoff uten analyttkode indekseres
 * under navnet.
 */
export function indekserKunnskapsbase(base: Kunnskapsbase, { aliaser, sider = [] }: Indekseringsvalg = {}): Sokedokument[] {
  const perInfoside = new Map<string, { data: Analyttsidedata; koder: string[]; komponenter: string[] }>()
  for (const data of base.sider) {
    if (!data.infoside) continue
    const koder = data.analytt ? [data.analytt.innhold.kode] : []
    const komponenter = data.komponenter.map((k) => k.innhold.navn)
    const side = perInfoside.get(data.infoside.id)
    if (side) {
      side.koder.push(...koder)
      side.komponenter.push(...komponenter.filter((k) => !side.komponenter.includes(k)))
    } else perInfoside.set(data.infoside.id, { data, koder, komponenter })
  }

  const medInfoside = [...perInfoside.values()].map(({ data, koder, komponenter }): Indekseringsside => {
    const modell = byggSidemodell(data)
    return {
      navn: data.infoside!.innhold.navn,
      koder,
      komponenter,
      modell,
      tillegg: [
        ...legemiddeltekster(base, koblede(modell)),
        ...farmakogenetikktekstene(base, modell),
        ...cpictekstene(base, modell),
      ],
    }
  })
  // En kode uten egen informasjonsside som viser en side som alt er med — en
  // metabolitt slått sammen med moderstoffet — blir en kode til på den siden.
  const indekserte = new Set(medInfoside.flatMap((s) => s.koder))
  const perNavn = new Map(medInfoside.map((s) => [s.navn.toLocaleLowerCase('nb'), s]))
  const utenInfoside: Indekseringsside[] = []
  for (const { kode, navn, komponenter } of sider) {
    if (indekserte.has(kode)) continue
    const side = perNavn.get(navn.toLocaleLowerCase('nb'))
    if (side) {
      side.koder.push(kode)
      side.komponenter = [...side.komponenter, ...komponenter.filter((k) => !side.komponenter.includes(k))]
      continue
    }
    const ny: Indekseringsside = { navn, koder: [kode], komponenter: [...komponenter], modell: TOM_MODELL, tillegg: [] }
    perNavn.set(navn.toLocaleLowerCase('nb'), ny)
    utenInfoside.push(ny)
  }

  // Kodene på hver side i den rekkefølgen `sider` har dem: hovedkoden først.
  // En kode `sider` ikke har, beholder plassen databasen ga den, foran.
  const plass = new Map(sider.map((s, i) => [s.kode, i]))
  for (const side of [...medInfoside, ...utenInfoside]) {
    side.koder.sort((a, b) => (plass.get(a) ?? -1) - (plass.get(b) ?? -1))
  }
  const alle = [...medInfoside, ...utenInfoside].sort(
    (a, b) => alfabetisk(a.navn, b.navn) || ((a.koder[0] ?? '') < (b.koder[0] ?? '') ? -1 : 1),
  )
  return alle.flatMap(({ navn, koder, komponenter, modell, tillegg }) => {
    const [kode, ...andre] = koder
    const kjente = new Set([navn, ...komponenter].map((n) => n.toLocaleLowerCase('nb')))
    const andreNavn = [...new Set(koder.flatMap((k) => aliaser?.(k) ?? []))].filter(
      (a) => !kjente.has(a.toLocaleLowerCase('nb')),
    )
    const dokumenter = indekserSide(
      { ...(kode && { kode }), navn, komponenter, ...(andreNavn.length > 0 && { aliaser: andreNavn }) },
      modell,
      tillegg,
    )
    return [...dokumenter, ...andre.map((tekst): Sokedokument => ({ sted: { side: { kode, navn } }, felt: 'kode', tekst }))]
  })
}

/** En søkeindeks med feilene fra dataene som ikke kunne leses. */
export type Kunnskapsindeks = Sokeindeks & { festfeil?: string; clinpgxfeil?: string; cpicfeil?: string }

/**
 * Leser og indekserer hele kunnskapsbasen, klar til `sokGlobalt`.
 *
 * Det tregeste er legemiddeldataene og interaksjonene, så søket slipper å
 * vente på dem: `delvis` får først en indeks over sidene i katalogen — navnene,
 * kodene og komponentene, uten å vente på noe — og så en over alt faginnholdet
 * på sidene. Det som er lest, er det samme som i den endelige indeksen, så
 * treffene på stoffene står fast, og treffene i preparatene og interaksjonene
 * kommer til under dem.
 */
export async function lesSokeindeks(
  sider: Sideleser,
  legemidler: Legemiddelleser | null,
  valg: Indekseringsvalg & { tilstand?: Tilstand; farmakogenetikk?: Farmakogenetikkleser; cpic?: Cpicleser } = {},
  delvis?: (indeks: Kunnskapsindeks) => void,
): Promise<Kunnskapsindeks> {
  const indekser = (base: Kunnskapsbase): Kunnskapsindeks => ({
    ...lagSokeindeks(indekserKunnskapsbase(base, valg)),
    ...(base.festfeil && { festfeil: base.festfeil }),
    ...(base.clinpgxfeil && { clinpgxfeil: base.clinpgxfeil }),
    ...(base.cpicfeil && { cpicfeil: base.cpicfeil }),
  })
  const utenTillegg = (lest: Analyttsidedata[]): Kunnskapsbase => ({ sider: lest, legemidler: null, interaksjoner: null })

  delvis?.(indekser(utenTillegg([])))
  const lest = await lesSidene(sider, valg.tilstand ?? 'publisert')
  delvis?.(indekser(utenTillegg(lest)))
  return indekser(await lesTillegg(lest, legemidler, valg.farmakogenetikk ?? null, valg.cpic ?? null))
}
