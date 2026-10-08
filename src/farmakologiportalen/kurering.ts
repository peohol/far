/**
 * Kontrollen som avgjør om en forbindelse kan kobles til en komponent i
 * Farmakologiportalen (`docs/farmakologiportalen.md`). Brukes av
 * `scripts/kurer-farmakologiportalen.ts` når koblingene i
 * `src/data/forbindelser.ts` lages eller kontrolleres på nytt;
 * synkroniseringen kobler aldri noe selv.
 *
 * 1. Portalen må ha nøyaktig én komponent med navnet: forbindelsens norske
 *    eller engelske navn, et synonym, nøkkelen eller et navn fra `fpnavn`,
 *    mot komponentens tittel, tittelen uten det som står i parentes, eller
 *    forkortelsen i parentesen («Tetrahydrocannabinol (THC)»). Gruppe- og
 *    sumanalyser regnes ikke med; de vises fordi de dekker forbindelsen.
 *    Passer flere, og bare én av dem har hele tittelen lik et av navnene,
 *    er det den («Fenytoin», ikke «Fenytoin (bundet)» eller «(fritt)»).
 * 2. Navnet alene gir en **usikker** kobling. Koblingen er **verifisert**
 *    når CAS-nummeret portalen oppgir, er et av CAS-numrene PubChem har for
 *    forbindelsens CID, eller molekylvekten portalen oppgir, stemmer med
 *    PubChems. Ellers slås CAS-nummeret opp i PubChem: er det samme
 *    forbindelse uten hensyn til stereokjemien (samme skjelett i InChIKey,
 *    som desmetylcitalopram og R-desmetylcitalopram), eller har den samme
 *    molekylformel, er koblingen også verifisert — molekylvekten er da den
 *    samme. Er det noe annet, står koblingen som usikker med det CAS-nummeret
 *    viser til (portalen kan ha feil CAS-nummer).
 * 3. Har portalen både et CAS-nummer og en molekylvekt, og ingen av dem
 *    stemmer, er koblingen **uavklart**: navnet kan være det samme for noe
 *    annet. Det samme når ingen eller flere komponenter har navnet.
 *
 * En usikker kobling vises på fagsiden med at den bare er kontrollert på
 * navnet; en uavklart vises ikke.
 */
import type { Fpkobling } from '../kjemi/forbindelser.js'
import { navnenokkel } from '../kjemi/kurering.js'
import { skjelett } from '../kjemi/pubchem.js'
import type { Komponentdata } from './modell.js'

export interface Fpkomponent {
  id: string
  data: Pick<Komponentdata, 'navn' | 'cas' | 'molvekt' | 'gruppe'>
}

/** Det PubChem sier om forbindelsen, til å bekrefte navnetreffet. */
export interface Fpkontroll {
  cid: number | null
  /** Molekylvekten PubChem oppgir (g/mol). */
  molvekt: number | null
  /** CAS-numrene blant PubChems synonymer for CID-en. */
  cas: ReadonlySet<string>
  /** Forbindelsens InChIKey og molekylformel i PubChem, til sammenligningen med CAS-oppslaget. */
  inchikey?: string | null
  formel?: string | null
  /** Det PubChem har under CAS-numrene portalen oppgir, når de er slått opp. */
  casoppslag?: readonly Casoppslag[]
}

/** En forbindelse PubChem har under et CAS-nummer. */
export interface Casoppslag {
  cas: string
  cid: number
  inchikey: string
  formel: string
  tittel: string
}

/** Hvor mye molekylvektene kan skille før de ikke regnes som den samme (avrunding). */
export const MOLVEKT_TOLERANSE = 0.15

export const CAS = /^\d{2,7}-\d{2}-\d$/

/** CAS-numrene i et felt som kan ha flere («59729-33-8, 219861-08-2»). */
export function casnumre(tekst: string | null | undefined): string[] {
  return [...new Set((tekst ?? '').split(/[\s,;/]+/).filter((c) => CAS.test(c)))]
}

/** Navnene en komponent kan kjennes igjen på: tittelen, tittelen uten parentesen, og det i parentesen. */
export function komponentnavn(tittel: string): string[] {
  const parentes = /^(.*?)\s*\(([^()]+)\)\s*$/.exec(tittel)
  const navn = [tittel]
  if (parentes) navn.push(parentes[1]!, ...parentes[2]!.split(/[,/]/))
  return [...new Set(navn.map((n) => navnenokkel(n)).filter(Boolean))]
}

export interface Fpnavn {
  nokkel: string
  navn: string
  engelsk: string
  synonymer?: string[]
  fpnavn?: string[]
}

export function forbindelsesnavn(f: Fpnavn): Set<string> {
  return new Set([f.navn, f.engelsk, f.nokkel, ...(f.synonymer ?? []), ...(f.fpnavn ?? [])].map(navnenokkel).filter(Boolean))
}

const mw = (v: number) => v.toLocaleString('nb-NO', { maximumFractionDigits: 3 })

export function kurerFp(f: Fpnavn, komponenter: readonly Fpkomponent[], kontroll: Fpkontroll, idag: string): Fpkobling {
  const navn = forbindelsesnavn(f)
  const navnetreff = komponenter.filter((k) => k.data.gruppe.length === 0 && komponentnavn(k.data.navn).some((n) => navn.has(n)))
  const heleTittelen = navnetreff.filter((k) => navn.has(navnenokkel(k.data.navn)))
  const kandidater = navnetreff.length > 1 && heleTittelen.length === 1 ? heleTittelen : navnetreff
  if (kandidater.length === 0) {
    return { status: 'uavklart', grunn: `Ingen komponent i Farmakologiportalen har navnet «${f.navn}».`, kandidater: [], kontrollert: idag }
  }
  if (kandidater.length > 1) {
    return {
      status: 'uavklart',
      grunn: `${kandidater.length} komponenter i Farmakologiportalen har navnet: ${kandidater.map((k) => `«${k.data.navn}»`).join(', ')}.`,
      kandidater: kandidater.map((k) => k.id),
      kontrollert: idag,
    }
  }
  const [k] = kandidater as [Fpkomponent]
  const andre = navnetreff.filter((x) => x !== k)
  const treff =
    andre.length === 0
      ? `Eneste komponent i Farmakologiportalen med navnet («${k.data.navn}», ID ${k.id})`
      : `Komponenten i Farmakologiportalen med nøyaktig navnet («${k.data.navn}», ID ${k.id}; ellers ${andre.map((x) => `«${x.data.navn}»`).join(', ')})`
  const pubchem = kontroll.cid ? `PubChem (CID ${kontroll.cid})` : 'PubChem'
  const cas = casnumre(k.data.cas)
  const casTreff = cas.find((c) => kontroll.cas.has(c))
  const fpMolvekt = k.data.molvekt.verdi
  const mwTreff = fpMolvekt !== null && kontroll.molvekt !== null && Math.abs(fpMolvekt - kontroll.molvekt) <= MOLVEKT_TOLERANSE

  if (casTreff || mwTreff) {
    const bekreftet = [
      casTreff && `CAS-nummeret ${casTreff} er også PubChems`,
      mwTreff && `molekylvekten ${mw(fpMolvekt!)} g/mol stemmer med ${pubchem} (${mw(kontroll.molvekt!)})`,
    ].filter(Boolean)
    return {
      status: 'verifisert',
      id: k.id,
      navn: k.data.navn,
      kontrollert: idag,
      grunnlag: `${treff}; ${bekreftet.join(', og ')}${casTreff && !mwTreff ? ` (${pubchem})` : ''}.`,
    }
  }

  // CAS-nummeret slått opp i PubChem: samme forbindelse uten stereokjemien, eller samme molekylformel.
  const oppslag = (kontroll.casoppslag ?? []).filter((o) => cas.includes(o.cas))
  const sammeSkjelett = kontroll.inchikey ? oppslag.find((o) => skjelett(o.inchikey) === skjelett(kontroll.inchikey!)) : undefined
  const sammeFormel = kontroll.formel ? oppslag.find((o) => o.formel === kontroll.formel) : undefined
  const viaCas = sammeSkjelett ?? sammeFormel
  if (viaCas) {
    const hvordan = sammeSkjelett
      ? `samme forbindelse som ${pubchem} uten hensyn til stereokjemien (InChIKey-skjelett ${skjelett(viaCas.inchikey)})`
      : `samme molekylformel (${viaCas.formel}) og dermed samme molekylvekt som ${pubchem}`
    return {
      status: 'verifisert',
      id: k.id,
      navn: k.data.navn,
      kontrollert: idag,
      grunnlag: `${treff}; CAS-nummeret ${viaCas.cas} er i PubChem CID ${viaCas.cid} («${viaCas.tittel}»), ${hvordan}.`,
    }
  }

  // Et avvik i CAS-nummeret er bare et avvik når PubChem har noe å sammenligne med.
  const casAvvik = cas.length > 0 && (kontroll.cas.size > 0 || oppslag.length > 0)
  const mwAvvik = fpMolvekt !== null && kontroll.molvekt !== null
  if (casAvvik && mwAvvik) {
    return {
      status: 'uavklart',
      grunn: `«${k.data.navn}» (ID ${k.id}) har navnet, men verken CAS-nummeret (${cas.join(', ')}) eller molekylvekten (${mw(fpMolvekt!)} g/mol) stemmer med ${pubchem}.`,
      kandidater: [k.id],
      kontrollert: idag,
    }
  }
  const annet = oppslag[0]
  const hvorfor = casAvvik
    ? `CAS-nummeret portalen oppgir (${cas.join(', ')}), er ikke blant PubChems${
        annet ? `, men hos PubChem «${annet.tittel}» (CID ${annet.cid}, ${annet.formel})` : ''
      }, og molekylvekten er ikke oppgitt`
    : mwAvvik
      ? `molekylvekten portalen oppgir (${mw(fpMolvekt!)} g/mol), stemmer ikke med ${pubchem} (${mw(kontroll.molvekt!)}), og CAS-nummeret er ikke oppgitt`
      : kontroll.cid === null
        ? 'forbindelsen har ingen verifisert kobling til PubChem å kontrollere mot'
        : 'portalen oppgir verken CAS-nummer eller molekylvekt som kan kontrolleres mot PubChem'
  return { status: 'usikker', id: k.id, navn: k.data.navn, kontrollert: idag, grunnlag: `${treff}, men ${hvorfor}.` }
}
