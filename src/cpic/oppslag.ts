/**
 * Oppslaget etter et kjent farmakogenetisk resultat: legemiddel → gen →
 * resultat → CPIC-anbefaling.
 *
 * Brukeren kjenner allerede pasientens fortolkede resultat og velger det for
 * hvert gen CPIC slår opp på for legemiddelet. Oppslaget finner anbefalingene
 * CPIC har for nøyaktig den kombinasjonen, og ingen andre:
 *
 * - En anbefaling vises bare når hvert gen den bygger på er valgt, og verdien
 *   er den CPIC har. Et gen som ikke er valgt, fylles aldri inn, og en
 *   kombinasjon CPIC ikke har, gir ingen anbefaling.
 * - Resultatet velges som CPIC skriver det: fenotype, allelstatus eller andre
 *   kategorier (se `docs/cpic.md`). For et gen CPIC slår opp på
 *   aktivitetsverdi kan brukeren i tillegg velge verdien. Er den ikke valgt,
 *   vises en anbefaling bare når CPIC har en anbefaling for hver av
 *   aktivitetsverdiene resultatet kan ha etter CPICs resultatliste
 *   (`gene_result`), og den samme for alle; ellers sier oppslaget at verdien
 *   må velges.
 * - Populasjonene (f.eks. barn og voksne) står hver for seg.
 *
 * Alt her er rene funksjoner uten tilstand. Valgene lagres ikke noe sted.
 */
import type { Cpicutvalg } from './lesing'
import type { Anbefaling, Legemiddel, Oppslagsmetode } from './modell'
import {
  grupperAnbefalinger,
  resultatFor,
  resultattype,
  sorterAktivitetsverdier,
  type Anbefalingsgruppe,
} from './stoffside'

/* --- Grunnlaget ------------------------------------------------------------ */

/** Et resultat brukeren kan velge for et gen, med verdiene CPIC slår opp på for det. */
export interface Resultatalternativ {
  /** Fenotypen, allelstatusen eller kategorien, som CPIC skrev den. */
  resultat: string
  /**
   * Verdiene CPIC slår opp på for resultatet, stigende for aktivitetsverdier.
   * For gener CPIC slår opp på aktivitetsverdi er det alle verdiene CPICs
   * resultatliste (`gene_result`) gir resultatet, også dem ingen anbefaling
   * for legemiddelet nevner.
   */
  oppslagsverdier: string[]
  /**
   * Om listen over verdier er kjent uavhengig av anbefalingene som skal
   * kontrolleres: fra CPICs resultatliste, eller fordi verdien CPIC slår opp
   * på er selve resultatet (fenotype, allelstatus, «No Result»). Uten det kan
   * en anbefaling aldri gjelde resultatet uten den eksakte verdien.
   */
  kontrollert: boolean
}

/** Et gen anbefalingene for legemiddelet bygger på. */
export interface Oppslagsgen {
  symbol: string
  metode: Oppslagsmetode | null
  /** «fenotype», «aktivitetsverdi» eller «allelstatus». */
  resultattype: string | null
  alternativer: Resultatalternativ[]
}

/** Det som trengs for å slå opp anbefalingene for ett legemiddel. */
export interface Oppslagsgrunnlag {
  legemiddel: Legemiddel
  gener: Oppslagsgen[]
  /** Anbefalingene CPIC slår opp på, i CPICs rekkefølge. */
  anbefalinger: Anbefaling[]
  populasjoner: string[]
  metoder: ReadonlyMap<string, Oppslagsmetode | null>
}

/** Genene anbefalingen slås opp på, etter CPICs oppslagsnøkkel. */
function nokkelgener(a: Anbefaling): string[] {
  return Object.keys(a.oppslagsnokkel)
}

function unike<T>(liste: readonly T[]): T[] {
  return [...new Set(liste)]
}

/**
 * Oppslagsgrunnlaget for hvert legemiddel i utvalget som har anbefalinger CPIC
 * slår opp på, etter navnet. Genene står i retningslinjens rekkefølge, og
 * resultatene i CPICs rekkefølge, eller etter aktivitetsverdien for gener
 * CPIC slår opp på den.
 */
export function oppslagsgrunnlag(utvalg: Cpicutvalg): Oppslagsgrunnlag[] {
  const metoder = new Map(utvalg.gener.map((g) => [g.symbol, g.oppslagsmetode]))
  const retningslinjegener = new Map(utvalg.retningslinjer.map((r) => [r.id, r.gener]))
  // CPICs egen liste over resultatene for hvert gen og aktivitetsverdiene som gir dem.
  const resultatliste = new Map<string, string[]>()
  for (const r of utvalg.genresultater) {
    if (!r.aktivitetsverdi) continue
    const nokkel = JSON.stringify([r.gen, r.resultat])
    resultatliste.set(nokkel, unike([...(resultatliste.get(nokkel) ?? []), r.aktivitetsverdi]))
  }
  return utvalg.legemidler
    .map((legemiddel): Oppslagsgrunnlag => {
      const anbefalinger = utvalg.anbefalinger.filter((a) => a.legemiddel_id === legemiddel.id && nokkelgener(a).length > 0)
      const symboler = unike(anbefalinger.flatMap(nokkelgener))
      const rekkefolge = unike([...anbefalinger.flatMap((a) => retningslinjegener.get(a.retningslinje_id) ?? []), ...symboler.sort()])
      const gener = rekkefolge
        .filter((s) => symboler.includes(s))
        .map((symbol): Oppslagsgen => {
          const metode = metoder.get(symbol) ?? null
          const perResultat = new Map<string, string[]>()
          for (const a of anbefalinger) {
            const b = a.betingelser.find((x) => x.gen === symbol)
            const verdi = a.oppslagsnokkel[symbol]
            if (!b || verdi === undefined) continue
            const verdier = perResultat.get(resultatFor(b)) ?? []
            if (!verdier.includes(verdi)) verdier.push(verdi)
            perResultat.set(resultatFor(b), verdier)
          }
          const alternativer = [...perResultat].map(([resultat, verdier]): Resultatalternativ => {
            if (metode !== 'ACTIVITY_SCORE') return { resultat, oppslagsverdier: verdier, kontrollert: true }
            const fraListen = resultatliste.get(JSON.stringify([symbol, resultat]))
            return {
              resultat,
              oppslagsverdier: sorterAktivitetsverdier(unike([...verdier, ...(fraListen ?? [])])),
              kontrollert: fraListen !== undefined || (verdier.length === 1 && verdier[0] === resultat),
            }
          })
          if (metode === 'ACTIVITY_SCORE') {
            // Etter laveste aktivitetsverdi; resultater uten tall («No Result») sist.
            const orden = sorterAktivitetsverdier(alternativer.map((a) => a.oppslagsverdier[0]!))
            alternativer.sort((a, b) => orden.indexOf(a.oppslagsverdier[0]!) - orden.indexOf(b.oppslagsverdier[0]!))
          }
          return { symbol, metode, resultattype: resultattype(metode), alternativer }
        })
      return {
        legemiddel,
        gener,
        anbefalinger,
        populasjoner: unike(anbefalinger.map((a) => a.populasjon ?? '')).filter(Boolean),
        metoder,
      }
    })
    .filter((g) => g.anbefalinger.length > 0)
    .sort((a, b) => a.legemiddel.navn.localeCompare(b.legemiddel.navn, 'en'))
}

/* --- Oppslaget ------------------------------------------------------------- */

/** Det brukeren har valgt for ett gen: resultatet, og eventuelt den eksakte verdien CPIC slår opp på. */
export interface Genvalg {
  resultat: string
  oppslagsverdi?: string
}

/** Valgene, per gen. Et gen som ikke står her, er ikke valgt. */
export type Valg = Readonly<Record<string, Genvalg>>

/** Hvorfor en anbefaling ble valgt, for ett gen. */
export interface Begrunnelse {
  gen: string
  valgt: Genvalg
  /** Resultatet anbefalingen gjelder, som CPIC skrev det. */
  resultat: string
  /** Verdiene CPIC slår opp på som gir anbefalingen (for flere: den er den samme for alle). */
  oppslagsverdier: string[]
}

/** En anbefaling, eller flere CPIC har med samme innhold, som passer valgene. */
export interface Oppslagstreff {
  gruppe: Anbefalingsgruppe
  retningslinje_id: string
  populasjon: string | null
  begrunnelser: Begrunnelse[]
  /** Valgte gener anbefalingen ikke bygger på. */
  ubrukte: string[]
}

/**
 * Når et resultat er valgt uten den eksakte verdien, og anbefalingen ikke kan
 * gis uten den: CPIC har ulike anbefalinger for verdiene (`ulike`), mangler
 * anbefaling for noen av dem (`mangler`), eller verdiene resultatet kan ha, er
 * ikke kjent fra CPICs resultatliste (`ukontrollert`).
 */
export interface Uavklart {
  populasjon: string | null
  gen: string
  resultat: string
  grunn: 'ulike' | 'mangler' | 'ukontrollert'
  /** Alle verdiene CPIC slår opp på for resultatet. */
  oppslagsverdier: string[]
  /** Verdiene CPIC ikke har noen anbefaling for med de andre valgene. */
  uten_anbefaling: string[]
}

export interface Oppslagssvar {
  treff: Oppslagstreff[]
  uavklart: Uavklart[]
  /** Gener som må velges før flere anbefalinger kan slås opp. */
  mangler: string[]
  /** Om noe er valgt, men CPIC ikke har noen anbefaling for kombinasjonen. */
  ingen: boolean
}

function alternativFor(grunnlag: Oppslagsgrunnlag, gen: string, resultat: string): Resultatalternativ | undefined {
  return grunnlag.gener.find((g) => g.symbol === gen)?.alternativer.find((a) => a.resultat === resultat)
}

type Samsvar = 'passer' | 'ufullstendig' | 'passer ikke'

/** Om anbefalingen passer valgene: hvert gen den slås opp på er valgt med den verdien CPIC har. */
function samsvar(a: Anbefaling, valg: Valg): Samsvar {
  let ufullstendig = false
  for (const gen of nokkelgener(a)) {
    const v = valg[gen]
    if (!v) {
      ufullstendig = true
      continue
    }
    const b = a.betingelser.find((x) => x.gen === gen)
    if (!b || resultatFor(b) !== v.resultat) return 'passer ikke'
    if (v.oppslagsverdi !== undefined && v.oppslagsverdi !== a.oppslagsnokkel[gen]) return 'passer ikke'
  }
  return ufullstendig ? 'ufullstendig' : 'passer'
}

/**
 * Anbefalingene CPIC har for valgene. Anbefalingene som passer, grupperes per
 * retningslinje og populasjon. Er et gen valgt uten den eksakte verdien,
 * kontrolleres det mot alle verdiene resultatet kan ha etter CPICs
 * resultatliste, ikke mot anbefalingene selv. Mangler CPIC anbefaling for noen
 * av dem, har ulikt innhold for dem, eller er verdiene ikke kjent fra listen,
 * vises ingen av dem, bare hva som må velges: en anbefaling gjelder aldri en
 * verdi CPIC ikke har den for.
 */
export function slaOpp(grunnlag: Oppslagsgrunnlag, valg: Valg): Oppslagssvar {
  const passer: Anbefaling[] = []
  const ufullstendige: Anbefaling[] = []
  for (const a of grunnlag.anbefalinger) {
    const s = samsvar(a, valg)
    if (s === 'passer') passer.push(a)
    else if (s === 'ufullstendig') ufullstendige.push(a)
  }

  const deler = new Map<string, Anbefaling[]>()
  for (const a of passer) {
    const nokkel = JSON.stringify([a.retningslinje_id, a.populasjon])
    deler.set(nokkel, [...(deler.get(nokkel) ?? []), a])
  }

  const treff: Oppslagstreff[] = []
  const uavklart: Uavklart[] = []
  for (const anbefalinger of deler.values()) {
    const forste = anbefalinger[0]!
    const grupper = grupperAnbefalinger(anbefalinger, grunnlag.metoder)
    // Gener valgt uten eksakt verdi, der verdiene ikke er gitt av resultatet alene.
    const apne = unike(anbefalinger.flatMap(nokkelgener))
      .filter((gen) => valg[gen]?.oppslagsverdi === undefined)
      .map((gen) => {
        const alternativ = alternativFor(grunnlag, gen, valg[gen]!.resultat)
        const alle = alternativ?.oppslagsverdier ?? []
        const dekket = unike(anbefalinger.map((a) => a.oppslagsnokkel[gen]!))
        return { gen, alle, dekket, kontrollert: alternativ?.kontrollert ?? false, uten: alle.filter((v) => !dekket.includes(v)) }
      })
      .filter((g) => g.alle.length > 1 || !g.kontrollert)
    // Anbefalingen gjelder uten verdien bare når hver verdi resultatet kan ha, er
    // kjent uavhengig av anbefalingene, og CPIC har én og samme anbefaling for alle.
    const grunner = apne.map((g) => ({
      ...g,
      grunn: !g.kontrollert
        ? ('ukontrollert' as const)
        : g.uten.length > 0
          ? ('mangler' as const)
          : grupper.length > 1 && g.dekket.length > 1
            ? ('ulike' as const)
            : null,
    }))
    const uklare = grunner.filter((g) => g.grunn !== null)
    if (uklare.length > 0 || (grupper.length > 1 && apne.length > 0)) {
      for (const g of uklare.length > 0 ? uklare : grunner) {
        uavklart.push({
          populasjon: forste.populasjon,
          gen: g.gen,
          resultat: valg[g.gen]!.resultat,
          grunn: g.grunn ?? 'ulike',
          oppslagsverdier: g.alle,
          uten_anbefaling: g.uten,
        })
      }
      continue
    }
    // Ellers er hver gruppe en egen anbefaling CPIC har for nøyaktig disse valgene.
    for (const gruppe of grupper) {
      const egne = anbefalinger.filter((a) => gruppe.anbefalinger.includes(a.id))
      const gener = grunnlag.gener.map((g) => g.symbol).filter((gen) => egne.some((a) => gen in a.oppslagsnokkel))
      treff.push({
        gruppe,
        retningslinje_id: forste.retningslinje_id,
        populasjon: forste.populasjon,
        begrunnelser: gener.map((gen) => ({
          gen,
          valgt: valg[gen]!,
          resultat: valg[gen]!.resultat,
          oppslagsverdier: sorterAktivitetsverdier(unike(egne.map((a) => a.oppslagsnokkel[gen]!))),
        })),
        ubrukte: Object.keys(valg).filter((gen) => !gener.includes(gen)),
      })
    }
  }

  const valgte = Object.keys(valg)
  const mangler = grunnlag.gener
    .map((g) => g.symbol)
    .filter((gen) => !valgte.includes(gen) && ufullstendige.some((a) => gen in a.oppslagsnokkel))
  return {
    treff,
    uavklart,
    mangler,
    ingen: valgte.length > 0 && passer.length === 0 && ufullstendige.length === 0,
  }
}
