import registerdata from '../data/stoffregister.json'
import type { Analyttkatalog } from './analyttkatalog'

/**
 * Stoffregisteret: sidemenyens inndeling av stoffene etter farmakologisk
 * klasse, med og uten analyttkode om hverandre.
 *
 * Inndelingen er data, ikke kode. Den står i `src/data/stoffregister.json`:
 * kategoriene i den rekkefølgen menyen viser dem, eventuelt delt i
 * underkategorier, og stoffene i hver ved navnet på informasjonssiden. Et
 * stoff kan stå i flere kategorier — lamotrigin er både antiepileptikum og
 * stemningsstabiliserende. En kategori med `metode` tar med alle analyttene i
 * analysemetoden, med kategoriene fra datasettet som underkategorier, så et
 * nytt antihypertensivum havner på plass av seg selv.
 *
 * Navnene slås opp i katalogen (kodene appen kan fortolke) og i stoffsidene
 * uten kode. Et navn som ikke finnes der, utelates — en side som ennå ikke er
 * publisert, dukker opp når den er det. Et stoff som finnes, men ikke står i
 * registeret (en ny stoffside en redaktør har laget), havner i
 * {@link ANDRE_STOFFER} til noen plasserer det, så menyen aldri viser færre
 * stoffer enn appen har.
 */

/** Én kategori slik den står i datafilen. */
export interface Registerkategoridata {
  navn: string
  /** Stoffene direkte i kategorien, ved sidenavnet. */
  stoffer?: string[]
  underkategorier?: { navn: string; stoffer: string[] }[]
  /** Alle analyttene i analysemetoden, delt etter kategorien i datasettet. */
  metode?: string
}

export interface Registerdata {
  kategorier: Registerkategoridata[]
  /**
   * Metabolittene som står på moderstoffets side (metabolitt → moderstoff).
   * Katalogen bruker dem (`SAMMENSLATTE` i `analyttkatalog.ts`); i
   * kategoriene står bare moderstoffet.
   */
  sammenslatte?: Record<string, string>
  /** Visningstittel for kanoniske sider som samler flere nært beslektede analytter. */
  sidetitler?: Record<string, string>
}

export const STOFFREGISTER: Registerdata = registerdata

/** Kategorien for stoffene som ikke står i registeret. */
export const ANDRE_STOFFER = 'Andre stoffer'

/** Ett stoff i menyen, og siden det fører til. */
export interface Registerstoff {
  /** Fagssidens navn i lista, f.eks. «Amitriptylin» eller «Etanol». */
  navn: string
  /** Informasjonssiden, f.eks. «Amitriptylin». */
  side: string
  /** Analyttkoden, eller `null` for et stoff laboratoriet ikke har noen analyse for. */
  kode: string | null
  /**
   * Alle kodene som viser siden, med `kode` først. Flere når en metabolitt er
   * slått sammen med moderstoffets side: tramadol har TRAM og OTRAM.
   */
  koder: string[]
}

export interface Registerunderkategori {
  navn: string
  stoffer: Registerstoff[]
}

export interface Registerkategori {
  navn: string
  /** Underkategoriene i registerets rekkefølge. Tom når kategorien ikke er delt opp. */
  underkategorier: Registerunderkategori[]
  /** Alle stoffene i kategorien alfabetisk, uten underkategoriene og hvert én gang. */
  stoffer: Registerstoff[]
}

function nokkel(navn: string): string {
  return navn.trim().toLocaleLowerCase('nb')
}

function paaNavn(a: Registerstoff, b: Registerstoff): number {
  return a.navn.localeCompare(b.navn, 'nb')
}

/** Stoffene alfabetisk, hvert én gang. */
function ordnet(stoffer: readonly Registerstoff[]): Registerstoff[] {
  const sett = new Map(stoffer.map((s) => [s.kode ?? `side:${nokkel(s.side)}`, s]))
  return [...sett.values()].sort(paaNavn)
}

/**
 * En kategori med `metode` slik den ville stått i datafilen: analyttene i
 * metoden, delt etter kategorien de har i datasettet, eller direkte i
 * kategorien når metoden ikke er delt opp.
 */
function utvidMetode(k: Registerkategoridata, katalog: Analyttkatalog): Registerkategoridata {
  if (!k.metode) return k
  const iMetoden = katalog.oppforinger.filter((o) => o.analysemetode === k.metode)
  const sider = (kategori: string) => iMetoden.filter((o) => o.kategori === kategori).map((o) => o.sidenavn)
  const navn = [...new Set(iMetoden.map((o) => o.kategori))].filter(Boolean).sort((a, b) => a.localeCompare(b, 'nb'))
  return {
    navn: k.navn,
    stoffer: [...(k.stoffer ?? []), ...sider('')],
    underkategorier: [...(k.underkategorier ?? []), ...navn.map((n) => ({ navn: n, stoffer: sider(n) }))],
  }
}

/** Hvor et stoff står i registeret: kategorien, og underkategorien når kategorien er delt opp. */
export interface Kategoristi {
  kategori: string
  underkategori?: string
}

/**
 * Kategoriene stoffsiden står i, i registerets rekkefølge — de samme som
 * sidemenyen viser den under. Står stoffet i en underkategori, er det den som
 * gjelder. En side registeret ikke plasserer, står i {@link ANDRE_STOFFER},
 * som i menyen.
 */
export function kategorierFor(
  side: string,
  katalog: Analyttkatalog,
  register: Registerdata = STOFFREGISTER,
): Kategoristi[] {
  const kode = katalog.kodeForSide(side)
  const kanonisk = (kode && katalog.finn(kode)?.sidenavn) || side
  const har = (stoffer: readonly string[] = []) =>
    stoffer.some((s) => {
      const k = katalog.kodeForSide(s)
      const sammenlign = (k && katalog.finn(k)?.sidenavn) || s
      return nokkel(sammenlign) === nokkel(kanonisk)
    })
  const stier = register.kategorier.flatMap((data): Kategoristi[] => {
    const k = utvidMetode(data, katalog)
    const under = (k.underkategorier ?? []).filter((u) => har(u.stoffer))
    if (under.length > 0) return under.map((u) => ({ kategori: k.navn, underkategori: u.navn }))
    return har(k.stoffer) ? [{ kategori: k.navn }] : []
  })
  return stier.length > 0 ? stier : [{ kategori: ANDRE_STOFFER }]
}

/**
 * Bygger menyen av registeret, katalogen og navnene på stoffsidene uten kode.
 * Kategorier og underkategorier uten noen stoffer som finnes, utelates.
 */
export function byggStoffregister(
  katalog: Analyttkatalog,
  stoffsider: readonly string[],
  register: Registerdata = STOFFREGISTER,
): Registerkategori[] {
  // Alt appen har en side for, etter sidenavnet: kodene og stoffsidene uten
  // kode. Deler flere koder en side — en metabolitt slått sammen med
  // moderstoffet — står siden én gang, ved hovedkoden.
  const perSide = new Map<string, Registerstoff[]>()
  const leggTil = (stoff: Registerstoff) =>
    perSide.set(nokkel(stoff.side), [...(perSide.get(nokkel(stoff.side)) ?? []), stoff])
  for (const o of katalog.oppforinger) {
    const paSiden = katalog.paSiden(o.sidenavn)
    if (paSiden[0]?.kode === o.kode) {
      const fellesSide = paSiden.length > 1 || o.komponenter.length > 1
      leggTil({ navn: fellesSide ? o.sidetittel : o.navn, side: o.sidenavn, kode: o.kode, koder: paSiden.map((p) => p.kode) })
    }
  }
  // En database-side som katalogen allerede kan sende til en kanonisk side,
  // er en komponent/alias og skal ikke dukke opp som en egen menylinje.
  for (const navn of stoffsider) {
    if (!perSide.has(nokkel(navn)) && !katalog.kodeForSide(navn)) leggTil({ navn, side: navn, kode: null, koder: [] })
  }

  const katalogside = (navn: string) => {
    const kode = katalog.kodeForSide(navn)
    return (kode && katalog.finn(kode)?.sidenavn) || navn
  }
  const plassert = new Set<string>()
  const slaaOpp = (navn: readonly string[]) =>
    ordnet(
      navn.flatMap((n) => {
        const side = katalogside(n)
        plassert.add(nokkel(side))
        return perSide.get(nokkel(side)) ?? []
      }),
    )

  const kategorier = register.kategorier.map((data): Registerkategori => {
    const k = utvidMetode(data, katalog)
    const underkategorier = (k.underkategorier ?? [])
      .map((u) => ({ navn: u.navn, stoffer: slaaOpp(u.stoffer) }))
      .filter((u) => u.stoffer.length > 0)
    return {
      navn: k.navn,
      underkategorier,
      stoffer: ordnet([...slaaOpp(k.stoffer ?? []), ...underkategorier.flatMap((u) => u.stoffer)]),
    }
  })

  const andre = ordnet([...perSide.entries()].filter(([side]) => !plassert.has(side)).flatMap(([, stoffer]) => stoffer))
  if (andre.length > 0) kategorier.push({ navn: ANDRE_STOFFER, underkategorier: [], stoffer: andre })

  return kategorier.filter((k) => k.stoffer.length > 0)
}
