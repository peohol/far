/**
 * Grunnlaget for søket i hele kunnskapsbasen: alle de publiserte sidene,
 * lest i én omgang og indeksert med den samme koden som søket på én side.
 *
 * Lesingen er fire kall, uansett hvor mange sider det er, og søket kan brukes
 * før de er ferdige (se {@link lesSokeindeks}):
 *
 * 1. `les_stoffer` gir alle stoffsidene på samme form som `les_stoff`.
 * 2. `les_legemidler` gir legemiddeldataene for alle virkestoffene sidene er
 *    koblet til. Hver side får sin del (`utvalgFor`), med de samme
 *    preparatene som seksjonen «Preparater» viser.
 * 3. `les_interaksjoner` gir interaksjonene for alle sidene. Hver side får
 *    dem `byggInteraksjoner` velger for sidens egne nøkler.
 * 4. `les_farmakogenetikk` gir ClinPGx-dataene for alle kjemikaliene sidene er
 *    koblet til, og `les_cpic` CPIC-anbefalingene for de samme. Hver side får
 *    sin del (`farmakogenetikkFor`, `cpicFor`).
 *
 * Hvert treff er et stoff i stoffregisteret. Kodene og navnene til
 * laboratorieanalyttene stoffet er koblet til, er andre veier til det samme
 * stoffet (se `stoffidentitet` i `sok.ts`).
 *
 * Rangeringen skjer bare i `sok.ts`; databasen gir bare innholdet. Klarer ikke
 * legemiddeldataene, ClinPGx-dataene eller CPIC-dataene å lese, indekseres
 * faginnholdet likevel, og feilen står i {@link Kunnskapsbase.festfeil},
 * {@link Kunnskapsbase.clinpgxfeil} eller {@link Kunnskapsbase.cpicfeil}.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { byggSidemodell, type Sidemodell } from './stoffside'
import { tilFeil } from './lagring'
import { TOM_STOFFSIDE, type Stoffsidedata, type Utgave } from './lesing'
import type { Referanseinnhold, Tilstand } from './modell'
import { indekserSide, lagSokeindeks, stoffidentitet, type Sokedokument, type Sokeindeks, type Tilleggstekst } from './sok'
import { ANALYTTKATALOG, type Analyttkatalog } from '../domain/analyttkatalog'
import { analytterForStoff } from '../domain/koblinger'
import { byggStoffregister, STOFFREGISTERDATA, type Registerdata } from '../domain/stoffregister'
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
  sider: Stoffsidedata[]
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
  /** Alle stoffsidene i én tilstand, alfabetisk. */
  lesStoffsider(tilstand: Tilstand): Promise<Stoffsidedata[]>
}

/** Formen `les_stoffer` gir: sidene, og referansene de siterer, én gang. */
interface Samletlesing {
  sider: (Omit<Stoffsidedata, 'referanser'> & { referanser: string[] })[]
  referanser: Utgave<Referanseinnhold>[]
}

export function lagSideleser(klient: SupabaseClient): Sideleser {
  return {
    async lesStoffsider(tilstand) {
      const { data, error } = await klient.rpc('les_stoffer', { sidetilstand: tilstand })
      if (error) throw tilFeil(error)
      const { sider = [], referanser = [] } = (data ?? {}) as Partial<Samletlesing>
      const perId = new Map(referanser.map((r) => [r.id, r]))
      return sider.map((side) => ({
        ...TOM_STOFFSIDE,
        ...side,
        referanser: side.referanser.flatMap((id) => perId.get(id) ?? []),
      }))
    },
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
function lesSidene(sider: Sideleser, tilstand: Tilstand): Promise<Stoffsidedata[]> {
  return sider.lesStoffsider(tilstand)
}

/** Sidene med legemiddeldataene, ClinPGx-dataene og CPIC-dataene de er koblet til. */
async function lesTillegg(
  lest: Stoffsidedata[],
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
   * dem fra katalogen, så søkeordene vedlikeholdes ett sted. De blir andre
   * navn på stoffet koden primært hører til.
   */
  aliaser?: (kode: string) => readonly string[] | undefined
  /** Stoffregisteret sidene hører til. Datafilen når det ikke er gitt. */
  registerdata?: Registerdata
  /** Laboratorieanalyttene koblingene peker på. */
  katalog?: Analyttkatalog
}

const TOM_MODELL = byggSidemodell(TOM_STOFFSIDE)

/**
 * Søkedokumentene for hele kunnskapsbasen: hvert stoff i stoffregisteret —
 * med stoffsidene i databasen som registeret ikke kjenner — indeksert med
 * `indekserSide`, som på siden selv. Stoffene står alfabetisk, så like gode
 * treff kommer i en fast rekkefølge.
 *
 * Et stoff uten side i databasen indekseres med navnet, aliasene og
 * analyttene det er koblet til, så søket finner det som menyen gjør. En side
 * i databasen hvis nøkkel er et alias for et stoff i registeret, er ikke en
 * egen side og indekseres ikke.
 */
export function indekserKunnskapsbase(
  base: Kunnskapsbase,
  { aliaser, registerdata = STOFFREGISTERDATA, katalog = ANALYTTKATALOG }: Indekseringsvalg = {},
): Sokedokument[] {
  const register = byggStoffregister(
    base.sider.flatMap((s) => s.stoff ?? []),
    registerdata,
  )
  const perSlug = new Map(base.sider.flatMap((s) => (s.stoff && s.infoside ? [[s.stoff.slug, s] as const] : [])))
  return register.stoffer.flatMap((stoff) => {
    const data = perSlug.get(stoff.slug)
    const modell = data ? byggSidemodell(data) : TOM_MODELL
    const identitet = stoffidentitet(stoff, analytterForStoff(stoff.slug, register, katalog))
    const andreNavn = (identitet.koder ?? []).flatMap((kode) => aliaser?.(kode) ?? [])
    const tillegg = data
      ? [
          ...legemiddeltekster(base, koblede(modell)),
          ...farmakogenetikktekstene(base, modell),
          ...cpictekstene(base, modell),
        ]
      : []
    return indekserSide({ ...identitet, aliaser: [...(identitet.aliaser ?? []), ...andreNavn] }, modell, tillegg)
  })
}

/** En søkeindeks med feilene fra dataene som ikke kunne leses. */
export type Kunnskapsindeks = Sokeindeks & { festfeil?: string; clinpgxfeil?: string; cpicfeil?: string }

/**
 * Leser og indekserer hele kunnskapsbasen, klar til `sokGlobalt`.
 *
 * Det tregeste er legemiddeldataene og interaksjonene, så søket slipper å
 * vente på dem: `delvis` får først en indeks over stoffene i registeret —
 * navnene, aliasene og analyttene, uten å vente på noe — og så en over alt faginnholdet
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
  const utenTillegg = (lest: Stoffsidedata[]): Kunnskapsbase => ({ sider: lest, legemidler: null, interaksjoner: null })

  delvis?.(indekser(utenTillegg([])))
  const lest = await lesSidene(sider, valg.tilstand ?? 'publisert')
  delvis?.(indekser(utenTillegg(lest)))
  return indekser(await lesTillegg(lest, legemidler, valg.farmakogenetikk ?? null, valg.cpic ?? null))
}
