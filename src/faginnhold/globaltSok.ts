/**
 * Grunnlaget for søket i hele kunnskapsbasen: alle de publiserte sidene,
 * lest i én omgang og indeksert med den samme koden som søket på én side.
 *
 * Lesingen er fire kall, uansett hvor mange sider det er:
 *
 * 1. `les_analyttsider` gir alle sidene på samme form som `les_analyttside`,
 *    og `les_stoffsider` sidene for stoffene uten analyttkode, på samme form.
 * 2. `les_legemidler` gir legemiddeldataene for alle virkestoffene sidene er
 *    koblet til. Hver side får sin del (`utvalgFor`), med de samme
 *    preparatene som seksjonen «Preparater» viser.
 * 3. `les_interaksjoner` gir interaksjonene for alle sidene. Hver side får
 *    dem `byggInteraksjoner` velger for sidens egne nøkler.
 *
 * Rangeringen skjer bare i `sok.ts`; databasen gir bare innholdet. Klarer ikke
 * legemiddeldataene å lese, indekseres faginnholdet likevel, og feilen står i
 * {@link Kunnskapsbase.festfeil}.
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

/** Alt søket i kunnskapsbasen indekserer. */
export interface Kunnskapsbase {
  sider: Analyttsidedata[]
  /** Legemiddeldataene for alle koblingene, eller `null` uten dem. */
  legemidler: Legemiddelutvalg | null
  /** Interaksjonene for alle koblingene, eller `null` uten dem. */
  interaksjoner: Interaksjonsutvalg | null
  /** Hvorfor legemiddeldataene mangler, når lesingen av dem feilet. */
  festfeil?: string
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
): Promise<Kunnskapsbase> {
  // Stoffsidene uten kode er et tillegg: kan de ikke leses, søkes det i resten.
  const lest = (
    await Promise.all([sider.lesAnalyttsider(tilstand), sider.lesStoffsider(tilstand).catch(() => [])])
  ).flat()
  const tom: Kunnskapsbase = { sider: lest, legemidler: null, interaksjoner: null }
  const perSide = lest.map((s) => koblede(byggSidemodell(s))).filter((k) => k.length > 0)
  if (!legemidler || perSide.length === 0) return tom

  try {
    const utvalg = await legemidler.les([...new Set(perSide.flat())].sort())
    const nokler = slaSammen(perSide.map((k) => interaksjonsnokler(utvalgFor(utvalg, k), k)))
    const interaksjoner = await lesInteraksjoner(legemidler, nokler)
    return { sider: lest, legemidler: utvalg, interaksjoner }
  } catch (e) {
    return { ...tom, festfeil: e instanceof Error ? e.message : String(e) }
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
   * og komponentene. Hver kode har en side, også uten publisert
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
  komponenter: readonly string[]
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
 * den første koden, og de andre kodene er med som koder på den. En kode i
 * `sider` som ingen informasjonsside viser, indekseres med navnet fra
 * katalogen, som siden selv viser. Et stoff uten analyttkode indekseres
 * under navnet.
 */
export function indekserKunnskapsbase(base: Kunnskapsbase, { aliaser, sider = [] }: Indekseringsvalg = {}): Sokedokument[] {
  const perInfoside = new Map<string, { data: Analyttsidedata; koder: string[] }>()
  for (const data of base.sider) {
    if (!data.infoside) continue
    const koder = data.analytt ? [data.analytt.innhold.kode] : []
    const side = perInfoside.get(data.infoside.id)
    if (side) side.koder.push(...koder)
    else perInfoside.set(data.infoside.id, { data, koder })
  }

  const medInfoside = [...perInfoside.values()].map(({ data, koder }): Indekseringsside => {
    const modell = byggSidemodell(data)
    return {
      navn: data.infoside!.innhold.navn,
      koder,
      komponenter: data.komponenter.map((k) => k.innhold.navn),
      modell,
      tillegg: legemiddeltekster(base, koblede(modell)),
    }
  })
  const indekserte = new Set(medInfoside.flatMap((s) => s.koder))
  const utenInfoside = sider
    .filter((s) => !indekserte.has(s.kode))
    .map(({ kode, navn, komponenter }): Indekseringsside => ({
      navn,
      koder: [kode],
      komponenter,
      modell: TOM_MODELL,
      tillegg: [],
    }))

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

/** Leser og indekserer hele kunnskapsbasen, klar til `sokGlobalt`. */
export async function lesSokeindeks(
  sider: Sideleser,
  legemidler: Legemiddelleser | null,
  valg: Indekseringsvalg & { tilstand?: Tilstand } = {},
): Promise<Sokeindeks & { festfeil?: string }> {
  const base = await lesKunnskapsbase(sider, legemidler, valg.tilstand)
  return { ...lagSokeindeks(indekserKunnskapsbase(base, valg)), ...(base.festfeil && { festfeil: base.festfeil }) }
}
