import registerdata from '../data/stoffregister.json'
import { navnenokkel } from './sokenavn'

/**
 * Stoffregisteret: den autoritative lista over stoffene appen har fagsider
 * (monografier) om, og sidemenyens inndeling av dem etter farmakologisk klasse.
 *
 * Et stoff er et legemiddel eller rusmiddel — Bupropion, Nortriptylin, Etanol —
 * med en stabil, URL-vennlig nøkkel (`slug`) som er identiteten til fagsiden:
 * `#/stoff/bupropion`. Nøkkelen endres ikke når navnet som vises endres, og den
 * har ingenting med laboratoriets analyttkoder å gjøre.
 *
 * Fortolkningssystemet er et eget domene: laboratorieanalyttene med kodene
 * laboratoriet rapporterer (`src/domain/analyttkatalog.ts`). De to kobles bare
 * gjennom eksplisitte {@link StoffAnalyttKobling}-er, som står her fordi de
 * hører til registeret, ikke til noen av analyttene. Ett stoff kan ha flere
 * analytter (Diazepam: DIAZ og DMI), én analytt kan gjelde flere stoffer
 * (AMTNORSUM: Amitriptylin og Nortriptylin), og begge kan mangle den andre.
 *
 * Alt dette er data, ikke kode, og står i `src/data/stoffregister.json`:
 *
 * - `stoffer`: nøkkelen, navnet og eventuelle andre navn stoffet er kjent
 *   under (`aliaser`, som metabolittene uten egen fagside: «Norfluoksetin»
 *   hører til Fluoksetin, og engelske navn og forkortelser: «quetiapine»,
 *   «CBD»). Et alias gir ingen egen side; en gammel adresse eller et søk på
 *   det fører til stoffet, og i søket teller et eksakt alias som et eksakt
 *   navn. Det er den eneste lista over søkenavn for stoffsidene i fagsøket.
 *   Søket etter analytter i fortolkningen bruker den ikke.
 * - `analyttkoblinger`: analyttkoden, stoffet, hva analytten er for stoffet
 *   ({@link Analyttrelasjon}) og om stoffet er analyttens primære stoff
 *   (`primar`, standard sann). Hver kode har høyst ett primært stoff: det er
 *   dit koden lenker, og der fortolkningsreglene og datakortene for koden står.
 *   Rekkefølgen per stoff er rekkefølgen analysene vises i, og den første
 *   primære er stoffets hovedanalytt, som eier datakortene uten `gjelder`.
 *
 * Databasen har resten (`les_stoffregister`, se `docs/stoffregister.md`):
 *
 * - fagsidene redaktørene har laget, med nøkkelen og navnet der, og om siden
 *   har innhold. De slås sammen med registeret i
 *   {@link byggStoffregister}: en side for et stoff i registeret gir stoffet
 *   det navnet redaktøren har gitt det, en side for et alias (en metabolitts
 *   gamle komponentside) er ikke et eget stoff, og en side registeret ikke
 *   kjenner, er et nytt stoff.
 * - inndelingen ({@link Registerstruktur}): kategoriene og underkategoriene,
 *   hvor hvert stoff står, og stoffene som er arkivert eller slettet. Et aktivt
 *   stoff uten plassering står i {@link ANDRE_STOFFER}.
 */

/** Hva en laboratorieanalytt er for stoffet den er koblet til. */
export type Analyttrelasjon = 'selve_stoffet' | 'metabolitt' | 'sumanalyse'

export const ANALYTTRELASJONER: Readonly<Record<Analyttrelasjon, string>> = {
  selve_stoffet: 'selve stoffet',
  metabolitt: 'metabolitt',
  sumanalyse: 'sumanalyse',
}

/** Et stoff i registeret. */
export interface Stoff {
  /** Den stabile nøkkelen i adressen, f.eks. «bupropion». */
  slug: string
  /** Navnet som vises, f.eks. «Bupropion». */
  navn: string
  /** Andre navn stoffet er kjent under, uten egen fagside. */
  aliaser: readonly string[]
}

/** Koblingen mellom et stoff og en laboratorieanalytt i fortolkningssystemet. */
export interface StoffAnalyttKobling {
  /** Analyttkoden, f.eks. «HBUP». */
  kode: string
  /** Stoffets nøkkel, f.eks. «bupropion». */
  stoff: string
  relasjon: Analyttrelasjon
  /** Sant når stoffet er analyttens primære stoff: koden lenker hit. */
  primar: boolean
  /** Kort forklaring på forholdet, vist på stoffsiden. */
  merknad?: string
}

export interface Registerdata {
  stoffer: { slug: string; navn: string; aliaser?: string[] }[]
  analyttkoblinger: { kode: string; stoff: string; relasjon: string; primar?: boolean; merknad?: string }[]
}

export const STOFFREGISTERDATA: Registerdata = registerdata

/** En fagside slik databasen har den (`les_stoffregister`). */
export interface Stoffoppforing {
  id: string
  slug: string
  navn: string
  /** Om siden har noe mer enn navnet: kort eller kilder. Ukjent regnes som innhold. */
  innhold?: boolean
}

/** En kategori eller underkategori slik databasen har den. */
export interface Kategorirad {
  id: string
  /** Kategorien en underkategori står under; `null` for en kategori. */
  forelder: string | null
  navn: string
  posisjon: number
  /** Navnet på ikonet i ikonregisteret; `null` gir plassholderikonet. */
  ikon: string | null
  arkivert_kl: string | null
}

/** At et stoff står i en kategori. */
export interface Plasseringsrad {
  stoff: string
  kategori: string
}

/**
 * Et stoff som ikke er aktivt: arkivert (alle kan hente det tilbake), i
 * papirkurven (en administrator kan hente det tilbake i 30 dager) eller fjernet
 * for godt.
 */
export type Stoffstatus = 'arkivert' | 'papirkurv' | 'fjernet'

export interface Statusrad {
  stoff: string
  status: Stoffstatus
  endret_kl: string
  /** Navnet på den som endret statusen, når det er kjent. */
  endret_av: string | null
}

/** Inndelingen av registeret, slik databasen har den. */
export interface Registerstruktur {
  kategorier: readonly Kategorirad[]
  plasseringer: readonly Plasseringsrad[]
  status: readonly Statusrad[]
}

/** Kategorien for de aktive stoffene uten plassering. */
export const ANDRE_STOFFER = 'Andre stoffer'

/** ID-en «Andre stoffer» har, så den kan stå blant de andre. Ingen kategori i databasen har den. */
export const ANDRE_STOFFER_ID = 'andre-stoffer'

/** Ett stoff i menyen og på helsiden. */
export interface Registerstoff {
  slug: string
  navn: string
  /** Analyttkodene stoffet er primært stoff for, i registerets rekkefølge. Tom uten. */
  koder: string[]
  /** Om stoffet er koblet til noen laboratorieanalytt, primært eller ikke. */
  analytter: boolean
  /** Om stoffet har en fagside i databasen. Uten den finnes stoffet bare i datafilen. */
  side: boolean
  /** Om fagsiden har noe mer enn navnet. */
  innhold: boolean
}

/** Et stoff som er arkivert eller i papirkurven, med når og av hvem. */
export interface Inaktivtstoff extends Registerstoff {
  endret_kl: string
  endret_av: string | null
}

export interface Registerunderkategori {
  id: string
  navn: string
  ikon: string | null
  stoffer: Registerstoff[]
}

export interface Registerkategori {
  /** ID-en i databasen; {@link ANDRE_STOFFER} har {@link ANDRE_STOFFER_ID}. */
  id: string
  navn: string
  ikon: string | null
  /** Underkategoriene i registerets rekkefølge. Tom når kategorien ikke er delt opp. */
  underkategorier: Registerunderkategori[]
  /** Stoffene direkte i kategorien, ved siden av underkategoriene, alfabetisk. */
  direkte: Registerstoff[]
  /** Alle stoffene i kategorien alfabetisk, uten underkategoriene og hvert én gang. */
  stoffer: Registerstoff[]
}

/** En arkivert kategori eller underkategori. */
export interface Arkivertkategori {
  id: string
  navn: string
  /** Navnet på kategorien en underkategori står under. */
  forelder: string | null
  arkivert_kl: string
  /** Hvor mange stoffer som står i den, med underkategoriene. */
  antall: number
}

/** Hvor et stoff står i registeret: kategorien, og underkategorien når kategorien er delt opp. */
export interface Kategoristi {
  kategori: string
  /** Kategoriens ikon i ikonregisteret, som i {@link Registerkategori}. */
  ikon?: string
  underkategori?: string
}

/** En plass stoffet står i inndelingen, med ID-en til kategorien eller underkategorien det står i. */
export interface Plassering extends Kategoristi {
  id: string
}

/** Tegnene som skrives om før alt annet enn a–z og 0–9 blir bindestrek. Samme som `intern.stoffslug` i databasen. */
const OMSKRIVING: readonly [RegExp, string][] = [
  [/æ/g, 'ae'],
  [/ø/g, 'o'],
  [/å/g, 'a'],
  [/ß/g, 'ss'],
  [/[áàâäã]/g, 'a'],
  [/[éèêë]/g, 'e'],
  [/[íìîï]/g, 'i'],
  [/[óòôöõ]/g, 'o'],
  [/[úùûü]/g, 'u'],
  [/ý/g, 'y'],
  [/ñ/g, 'n'],
  [/ç/g, 'c'],
]

/**
 * Den URL-vennlige nøkkelen et navn gir: små bokstaver, æ, ø og å skrevet om,
 * og alt annet enn bokstaver og tall som én bindestrek. «Paliperidon
 * (hydroksyrisperidon)» blir «paliperidon-hydroksyrisperidon». Databasen gir
 * nye sider den samme (`intern.stoffslug`), men nøkkelen følger siden etterpå:
 * endres navnet, står nøkkelen.
 */
export function stoffslug(navn: string): string {
  let s = navn.toLowerCase()
  for (const [monster, erstatning] of OMSKRIVING) s = s.replace(monster, erstatning)
  return s.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

/** Formen en nøkkel må ha. */
export const SLUGFORM = /^[a-z0-9]+(-[a-z0-9]+)*$/

/** Om et stoff står i registeret, er arkivert, ligger i papirkurven eller er slettet for godt. */
export type Stofftilstand = 'aktiv' | Stoffstatus

export interface Stoffregister {
  /** De aktive stoffene, alfabetisk. Ikke de arkiverte og ikke dem i papirkurven. */
  stoffer: readonly Stoff[]
  /**
   * Stoffet med denne nøkkelen, også når det er arkivert eller i papirkurven
   * (se {@link status}). Bare de kanoniske nøklene; se {@link kanonisk}.
   */
  finn: (slug: string) => Stoff | undefined
  /**
   * Stoffet en nøkkel eller et navn fører til: stoffets egen nøkkel, eller
   * stoffet et alias hører til, også når navnet er skrevet på en annen måte
   * ({@link navnenokkel}). Brukes for gamle adresser og navn.
   */
  kanonisk: (nokkelEllerNavn: string) => Stoff | undefined
  /** Om stoffet er aktivt, arkivert eller i papirkurven. `fjernet` for et stoff registeret ikke kjenner lenger. */
  status: (slug: string) => Stofftilstand
  /** Alle koblingene, i registerets rekkefølge. */
  koblinger: readonly StoffAnalyttKobling[]
  /** Analyttene koblet til stoffet: de stoffet er primært stoff for først, så de andre, hver i registerets rekkefølge. */
  analytterFor: (slug: string) => StoffAnalyttKobling[]
  /** Stoffene koblet til analytten. */
  stofferFor: (kode: string) => StoffAnalyttKobling[]
  /** Analyttens primære stoff: dit koden lenker. `undefined` når analytten ikke har noe. */
  primartStoffFor: (kode: string) => Stoff | undefined
  /** Stoffet slik menyen viser det, med kodene. `undefined` når registeret ikke kjenner nøkkelen. */
  menystoff: (slug: string) => Registerstoff | undefined
  /** Om inndelingen er hentet fra databasen. Før det er {@link kategorier} og {@link inndeling} tomme. */
  lastet: boolean
  /** Menyen: kategoriene med stoffene, uten tomme kategorier og underkategorier, og {@link ANDRE_STOFFER} sist. */
  kategorier: Registerkategori[]
  /**
   * Hele inndelingen, til redigeringen: også de tomme kategoriene og
   * underkategoriene, og {@link ANDRE_STOFFER} sist, også tom.
   */
  inndeling: Registerkategori[]
  /** De arkiverte kategoriene og underkategoriene, sist arkivert først. */
  arkiverteKategorier: Arkivertkategori[]
  /** De arkiverte stoffene, alfabetisk. */
  arkiv: Inaktivtstoff[]
  /** Stoffene i papirkurven, sist slettet først. Tom for andre enn administratorer, som ikke får den. */
  papirkurv: Inaktivtstoff[]
  /** Kategoriene stoffet står i, i registerets rekkefølge; {@link ANDRE_STOFFER} når ingen. Tom før {@link lastet}. */
  kategorierFor: (slug: string) => Kategoristi[]
  /** Plassene stoffet står i inndelingen, i registerets rekkefølge. Tom når det står i «Andre stoffer». */
  plasseringerFor: (slug: string) => Plassering[]
}

function paaNavn(a: { navn: string }, b: { navn: string }): number {
  return a.navn.localeCompare(b.navn, 'nb')
}

function relasjon(verdi: string): Analyttrelasjon {
  if (verdi in ANALYTTRELASJONER) return verdi as Analyttrelasjon
  throw new Error(`Ukjent relasjon mellom stoff og analytt: «${verdi}».`)
}

const etterPosisjon = (a: Kategorirad, b: Kategorirad) => a.posisjon - b.posisjon

/**
 * Registeret av datafilen, fagsidene i databasen og inndelingen der. Uten
 * databasen er det registeret alene — det adressene og lenkene fra
 * fortolkningen trenger — uten kategorier.
 */
export function byggStoffregister(
  databasestoffer: readonly Stoffoppforing[] = [],
  data: Registerdata = STOFFREGISTERDATA,
  struktur: Registerstruktur | null = null,
): Stoffregister {
  const statusFor = new Map((struktur?.status ?? []).map((s) => [s.stoff, s]))
  const fjernet = (slug: string) => statusFor.get(slug)?.status === 'fjernet'

  const perSlug = new Map<string, Stoff>()
  for (const s of data.stoffer) perSlug.set(s.slug, { slug: s.slug, navn: s.navn, aliaser: s.aliaser ?? [] })
  // Aliasene, og de kanoniske nøklene selv, etter nøkkelen de gir.
  const aliasTil = new Map<string, string>()
  for (const s of perSlug.values()) for (const a of s.aliaser) aliasTil.set(stoffslug(a), s.slug)

  const sider = new Map<string, Stoffoppforing>()
  for (const d of databasestoffer) {
    const kjent = perSlug.get(d.slug)
    if (kjent) perSlug.set(d.slug, { ...kjent, navn: d.navn })
    else if (!aliasTil.has(d.slug)) perSlug.set(d.slug, { slug: d.slug, navn: d.navn, aliaser: [] })
    else continue
    sider.set(d.slug, d)
  }
  // Et stoff som er slettet for godt, er borte, også når datafilen har det.
  for (const slug of perSlug.keys()) if (fjernet(slug)) perSlug.delete(slug)

  // Navnene og aliasene etter navnenøkkelen, for navn som er skrevet på en
  // annen måte; navnene sidene har i databasen, går foran registerets.
  const perNokkel = new Map<string, string>()
  for (const s of data.stoffer) if (perSlug.has(s.slug)) for (const n of [s.navn, ...(s.aliaser ?? [])]) perNokkel.set(navnenokkel(n), s.slug)
  for (const s of perSlug.values()) for (const n of [s.navn, ...s.aliaser]) perNokkel.set(navnenokkel(n), s.slug)

  const koblinger: StoffAnalyttKobling[] = data.analyttkoblinger.map((k) => ({
    kode: k.kode,
    stoff: k.stoff,
    relasjon: relasjon(k.relasjon),
    primar: k.primar ?? true,
    ...(k.merknad && { merknad: k.merknad }),
  }))
  const perStoff = new Map<string, StoffAnalyttKobling[]>()
  const perKode = new Map<string, StoffAnalyttKobling[]>()
  for (const k of koblinger) {
    perStoff.set(k.stoff, [...(perStoff.get(k.stoff) ?? []), k])
    perKode.set(k.kode, [...(perKode.get(k.kode) ?? []), k])
  }
  // Stoffets egne analytter først, i datafilens rekkefølge, så de andre.
  for (const [slug, liste] of perStoff) perStoff.set(slug, [...liste].sort((a, b) => Number(b.primar) - Number(a.primar)))

  const status = (slug: string): Stofftilstand =>
    perSlug.has(slug) ? (statusFor.get(slug)?.status ?? 'aktiv') : 'fjernet'
  const alle = [...perSlug.values()].sort(paaNavn)
  const stoffer = alle.filter((s) => status(s.slug) === 'aktiv')
  const finn = (slug: string) => perSlug.get(slug)
  const kanonisk = (nokkel: string) => {
    const s = stoffslug(nokkel)
    return perSlug.get(s) ?? perSlug.get(aliasTil.get(s) ?? perNokkel.get(navnenokkel(nokkel)) ?? '')
  }
  const analytterFor = (slug: string) => perStoff.get(slug) ?? []
  const stofferFor = (kode: string) => perKode.get(kode.trim().toUpperCase()) ?? []
  const primartStoffFor = (kode: string) => {
    const primar = stofferFor(kode).find((k) => k.primar)
    return primar && perSlug.get(primar.stoff)
  }

  const menystoff = (s: Stoff): Registerstoff => {
    const side = sider.get(s.slug)
    return {
      slug: s.slug,
      navn: s.navn,
      koder: analytterFor(s.slug)
        .filter((k) => k.primar)
        .map((k) => k.kode),
      analytter: analytterFor(s.slug).length > 0,
      side: Boolean(side),
      innhold: side ? (side.innhold ?? true) : false,
    }
  }

  // --- Inndelingen ---
  const rader = struktur?.kategorier ?? []
  const perId = new Map(rader.map((k) => [k.id, k]))
  // En underkategori under en arkivert kategori er arkivert med den.
  const aktiv = (k: Kategorirad) => !k.arkivert_kl && !(k.forelder && perId.get(k.forelder)?.arkivert_kl)
  const barn = (forelder: string | null) =>
    rader.filter((k) => k.forelder === forelder && aktiv(k)).sort(etterPosisjon)
  const iKategori = new Map<string, Registerstoff[]>()
  const plassert = new Set<string>()
  for (const p of struktur?.plasseringer ?? []) {
    const kategori = perId.get(p.kategori)
    const s = perSlug.get(p.stoff)
    if (!kategori || !aktiv(kategori) || !s || status(s.slug) !== 'aktiv') continue
    iKategori.set(p.kategori, [...(iKategori.get(p.kategori) ?? []), menystoff(s)])
    plassert.add(p.stoff)
  }
  const stofferI = (id: string) => [...(iKategori.get(id) ?? [])].sort(paaNavn)
  const unike = (liste: readonly Registerstoff[]) => [...new Map(liste.map((s) => [s.slug, s])).values()].sort(paaNavn)

  const inndeling: Registerkategori[] = barn(null).map((k) => {
    const underkategorier = barn(k.id).map((u) => ({ id: u.id, navn: u.navn, ikon: u.ikon, stoffer: stofferI(u.id) }))
    const direkte = stofferI(k.id)
    return {
      id: k.id,
      navn: k.navn,
      ikon: k.ikon,
      underkategorier,
      direkte,
      stoffer: unike([...direkte, ...underkategorier.flatMap((u) => u.stoffer)]),
    }
  })
  if (struktur) {
    const andre = stoffer.filter((s) => !plassert.has(s.slug)).map(menystoff)
    inndeling.push({ id: ANDRE_STOFFER_ID, navn: ANDRE_STOFFER, ikon: null, underkategorier: [], direkte: andre, stoffer: andre })
  }
  const kategorier = inndeling
    .map((k) => ({ ...k, underkategorier: k.underkategorier.filter((u) => u.stoffer.length > 0) }))
    .filter((k) => k.stoffer.length > 0)

  const arkiverteKategorier = rader
    .filter((k) => k.arkivert_kl)
    .map((k): Arkivertkategori => {
      const ider = new Set([k.id, ...rader.filter((u) => u.forelder === k.id).map((u) => u.id)])
      const antall = new Set(
        (struktur?.plasseringer ?? []).filter((p) => ider.has(p.kategori) && perSlug.has(p.stoff)).map((p) => p.stoff),
      ).size
      return {
        id: k.id,
        navn: k.navn,
        forelder: (k.forelder && perId.get(k.forelder)?.navn) ?? null,
        arkivert_kl: k.arkivert_kl!,
        antall,
      }
    })
    .sort((a, b) => b.arkivert_kl.localeCompare(a.arkivert_kl))

  const inaktive = (hvilken: Stoffstatus) =>
    alle.flatMap((s): Inaktivtstoff[] => {
      const rad = statusFor.get(s.slug)
      return rad?.status === hvilken ? [{ ...menystoff(s), endret_kl: rad.endret_kl, endret_av: rad.endret_av }] : []
    })

  const plasseringerFor = (slug: string): Plassering[] =>
    inndeling.flatMap((k): Plassering[] => {
      if (k.id === ANDRE_STOFFER_ID) return []
      const under = k.underkategorier.filter((u) => u.stoffer.some((s) => s.slug === slug))
      // Underkategoriene vises med kategoriens ikon.
      const kategori = { kategori: k.navn, ...(k.ikon && { ikon: k.ikon }) }
      return [
        ...(k.direkte.some((s) => s.slug === slug) ? [{ id: k.id, ...kategori }] : []),
        ...under.map((u) => ({ id: u.id, ...kategori, underkategori: u.navn })),
      ]
    })
  const kategorierFor = (slug: string): Kategoristi[] => {
    if (!struktur) return []
    const stier = plasseringerFor(slug).map(({ id: _id, ...sti }) => sti)
    return stier.length > 0 ? stier : [{ kategori: ANDRE_STOFFER }]
  }

  return {
    stoffer,
    finn,
    kanonisk,
    status,
    koblinger,
    analytterFor,
    stofferFor,
    primartStoffFor,
    menystoff: (slug) => {
      const s = perSlug.get(slug)
      return s && menystoff(s)
    },
    lastet: Boolean(struktur),
    kategorier,
    inndeling,
    arkiverteKategorier,
    arkiv: inaktive('arkivert'),
    papirkurv: inaktive('papirkurv').sort((a, b) => b.endret_kl.localeCompare(a.endret_kl)),
    kategorierFor,
    plasseringerFor,
  }
}

/** Registeret alene, uten fagsidene og inndelingen i databasen. */
export const STOFFREGISTER = byggStoffregister()

/**
 * Feilene i datafilen: nøkler som ikke har riktig form eller står flere ganger,
 * navn og alias som kolliderer — også når de bare er skrevet ulikt, som
 * «Quetiapine» og «kvetiapin» ({@link navnenokkel}) — koblinger til stoffer
 * som ikke finnes og koder med mer enn ett primært stoff. Tom når alt er i orden. Testene holder den tom.
 */
export function kontrollerStoffregister(data: Registerdata = STOFFREGISTERDATA): string[] {
  const feil: string[] = []
  const slugs = new Set<string>()
  for (const s of data.stoffer) {
    if (!SLUGFORM.test(s.slug)) feil.push(`Stoffet ${s.navn} har en ugyldig nøkkel «${s.slug}».`)
    if (slugs.has(s.slug)) feil.push(`Nøkkelen «${s.slug}» står flere ganger.`)
    slugs.add(s.slug)
    if (!s.navn.trim()) feil.push(`Stoffet «${s.slug}» mangler navn.`)
  }
  const aliaser = new Map<string, string>()
  const navn = new Map<string, string>()
  for (const s of data.stoffer) navn.set(navnenokkel(s.navn), s.slug)
  for (const s of data.stoffer) {
    for (const a of s.aliaser ?? []) {
      const n = stoffslug(a)
      if (slugs.has(n)) feil.push(`Aliaset «${a}» (${s.slug}) er nøkkelen til et annet stoff.`)
      if (aliaser.has(n) && aliaser.get(n) !== s.slug) feil.push(`Aliaset «${a}» står på flere stoffer.`)
      aliaser.set(n, s.slug)
    }
  }
  const eier = new Map(navn)
  for (const s of data.stoffer) {
    for (const a of s.aliaser ?? []) {
      const n = navnenokkel(a)
      if (!n) feil.push(`Aliaset «${a}» (${s.slug}) har ingen bokstaver eller tall.`)
      else if (eier.has(n) && eier.get(n) !== s.slug) feil.push(`Aliaset «${a}» (${s.slug}) er det samme navnet som et annet stoff har.`)
      else eier.set(n, s.slug)
    }
  }
  const primare = new Map<string, number>()
  const par = new Set<string>()
  for (const k of data.analyttkoblinger) {
    if (!slugs.has(k.stoff)) feil.push(`Koblingen ${k.kode} → «${k.stoff}» peker på et stoff som ikke finnes.`)
    if (!(k.relasjon in ANALYTTRELASJONER)) feil.push(`Koblingen ${k.kode} → ${k.stoff} har ukjent relasjon «${k.relasjon}».`)
    if (k.kode !== k.kode.trim().toUpperCase()) feil.push(`Koden «${k.kode}» skal stå med store bokstaver.`)
    if (par.has(`${k.kode}/${k.stoff}`)) feil.push(`Koblingen ${k.kode} → ${k.stoff} står flere ganger.`)
    par.add(`${k.kode}/${k.stoff}`)
    if (k.primar ?? true) primare.set(k.kode, (primare.get(k.kode) ?? 0) + 1)
  }
  for (const [kode, antall] of primare) if (antall > 1) feil.push(`Koden ${kode} har ${antall} primære stoffer.`)
  return feil
}
