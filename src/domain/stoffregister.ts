import registerdata from '../data/stoffregister.json'

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
 *   hører til Fluoksetin). Et alias gir ingen egen side; en gammel adresse
 *   eller et søk på det fører til stoffet.
 * - `analyttkoblinger`: analyttkoden, stoffet, hva analytten er for stoffet
 *   ({@link Analyttrelasjon}) og om stoffet er analyttens primære stoff
 *   (`primar`, standard sann). Hver kode har høyst ett primært stoff: det er
 *   dit koden lenker, og der fortolkningsreglene og datakortene for koden står.
 *   Rekkefølgen per stoff er rekkefølgen analysene vises i, og den første
 *   primære er stoffets hovedanalytt, som eier datakortene uten `gjelder`.
 * - `kategorier`: menyens inndeling, med stoffene ved nøkkelen.
 *
 * Databasen har i tillegg fagsidene redaktørene har laget (`les_stoffliste`),
 * med nøkkelen og navnet der. De slås sammen med registeret i
 * {@link byggStoffregister}: en side for et stoff i registeret gir stoffet det
 * navnet redaktøren har gitt det, en side for et alias (en metabolitts gamle
 * komponentside) er ikke et eget stoff, og en side registeret ikke kjenner, er
 * et nytt stoff i {@link ANDRE_STOFFER} til noen plasserer det.
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

/** Én kategori slik den står i datafilen. */
export interface Registerkategoridata {
  navn: string
  /** Stoffene direkte i kategorien, ved nøkkelen. */
  stoffer?: string[]
  underkategorier?: { navn: string; stoffer: string[] }[]
}

export interface Registerdata {
  stoffer: { slug: string; navn: string; aliaser?: string[] }[]
  analyttkoblinger: { kode: string; stoff: string; relasjon: string; primar?: boolean; merknad?: string }[]
  kategorier: Registerkategoridata[]
}

export const STOFFREGISTERDATA: Registerdata = registerdata

/** En fagside slik databasen har den (`les_stoffliste`). */
export interface Stoffoppforing {
  id: string
  slug: string
  navn: string
}

/** Kategorien for stoffene som ikke står i registeret. */
export const ANDRE_STOFFER = 'Andre stoffer'

/** Ett stoff i menyen. */
export interface Registerstoff {
  slug: string
  navn: string
  /** Analyttkodene stoffet er primært stoff for, i registerets rekkefølge. Tom uten. */
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

/** Hvor et stoff står i registeret: kategorien, og underkategorien når kategorien er delt opp. */
export interface Kategoristi {
  kategori: string
  underkategori?: string
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

export interface Stoffregister {
  /** Alle stoffene, alfabetisk. */
  stoffer: readonly Stoff[]
  /** Stoffet med denne nøkkelen. Bare de kanoniske nøklene; se {@link kanonisk}. */
  finn: (slug: string) => Stoff | undefined
  /**
   * Stoffet en nøkkel eller et navn fører til: stoffets egen nøkkel, eller
   * stoffet et alias hører til. Brukes for gamle adresser og navn.
   */
  kanonisk: (nokkelEllerNavn: string) => Stoff | undefined
  /** Alle koblingene, i registerets rekkefølge. */
  koblinger: readonly StoffAnalyttKobling[]
  /** Analyttene koblet til stoffet: de stoffet er primært stoff for først, så de andre, hver i registerets rekkefølge. */
  analytterFor: (slug: string) => StoffAnalyttKobling[]
  /** Stoffene koblet til analytten. */
  stofferFor: (kode: string) => StoffAnalyttKobling[]
  /** Analyttens primære stoff: dit koden lenker. `undefined` når analytten ikke har noe. */
  primartStoffFor: (kode: string) => Stoff | undefined
  /** Menyen: kategoriene med stoffene, uten tomme kategorier. */
  kategorier: Registerkategori[]
  /** Kategoriene stoffet står i, i registerets rekkefølge; {@link ANDRE_STOFFER} når ingen. */
  kategorierFor: (slug: string) => Kategoristi[]
}

function paaNavn(a: { navn: string }, b: { navn: string }): number {
  return a.navn.localeCompare(b.navn, 'nb')
}

function relasjon(verdi: string): Analyttrelasjon {
  if (verdi in ANALYTTRELASJONER) return verdi as Analyttrelasjon
  throw new Error(`Ukjent relasjon mellom stoff og analytt: «${verdi}».`)
}

/**
 * Registeret av datafilen og fagsidene i databasen. Uten databasen er det
 * registeret alene — det adressene og lenkene fra fortolkningen trenger.
 */
export function byggStoffregister(
  databasestoffer: readonly Stoffoppforing[] = [],
  data: Registerdata = STOFFREGISTERDATA,
): Stoffregister {
  const perSlug = new Map<string, Stoff>()
  for (const s of data.stoffer) perSlug.set(s.slug, { slug: s.slug, navn: s.navn, aliaser: s.aliaser ?? [] })
  // Aliasene, og de kanoniske nøklene selv, etter nøkkelen de gir.
  const aliasTil = new Map<string, string>()
  for (const s of perSlug.values()) for (const a of s.aliaser) aliasTil.set(stoffslug(a), s.slug)

  for (const d of databasestoffer) {
    const kjent = perSlug.get(d.slug)
    if (kjent) perSlug.set(d.slug, { ...kjent, navn: d.navn })
    else if (!aliasTil.has(d.slug)) perSlug.set(d.slug, { slug: d.slug, navn: d.navn, aliaser: [] })
  }

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

  const stoffer = [...perSlug.values()].sort(paaNavn)
  const finn = (slug: string) => perSlug.get(slug)
  const kanonisk = (nokkel: string) => {
    const s = stoffslug(nokkel)
    return perSlug.get(s) ?? perSlug.get(aliasTil.get(s) ?? '')
  }
  const analytterFor = (slug: string) => perStoff.get(slug) ?? []
  const stofferFor = (kode: string) => perKode.get(kode.trim().toUpperCase()) ?? []
  const primartStoffFor = (kode: string) => {
    const primar = stofferFor(kode).find((k) => k.primar)
    return primar && perSlug.get(primar.stoff)
  }

  const menystoff = (s: Stoff): Registerstoff => ({
    slug: s.slug,
    navn: s.navn,
    koder: analytterFor(s.slug)
      .filter((k) => k.primar)
      .map((k) => k.kode),
  })
  const plassert = new Set<string>()
  const slaaOpp = (slugs: readonly string[] = []) =>
    slugs
      .flatMap((slug) => {
        const s = perSlug.get(slug)
        if (!s) return []
        plassert.add(slug)
        return [menystoff(s)]
      })
      .sort(paaNavn)
  const unike = (liste: readonly Registerstoff[]) => [...new Map(liste.map((s) => [s.slug, s])).values()].sort(paaNavn)

  const kategorier = data.kategorier.map((k): Registerkategori => {
    const underkategorier = (k.underkategorier ?? [])
      .map((u) => ({ navn: u.navn, stoffer: slaaOpp(u.stoffer) }))
      .filter((u) => u.stoffer.length > 0)
    return {
      navn: k.navn,
      underkategorier,
      stoffer: unike([...slaaOpp(k.stoffer), ...underkategorier.flatMap((u) => u.stoffer)]),
    }
  })
  const andre = stoffer.filter((s) => !plassert.has(s.slug)).map(menystoff)
  if (andre.length > 0) kategorier.push({ navn: ANDRE_STOFFER, underkategorier: [], stoffer: andre })

  const kategorierFor = (slug: string): Kategoristi[] => {
    const stier = data.kategorier.flatMap((k): Kategoristi[] => {
      const under = (k.underkategorier ?? []).filter((u) => u.stoffer.includes(slug))
      if (under.length > 0) return under.map((u) => ({ kategori: k.navn, underkategori: u.navn }))
      return k.stoffer?.includes(slug) ? [{ kategori: k.navn }] : []
    })
    return stier.length > 0 ? stier : [{ kategori: ANDRE_STOFFER }]
  }

  return {
    stoffer,
    finn,
    kanonisk,
    koblinger,
    analytterFor,
    stofferFor,
    primartStoffFor,
    kategorier: kategorier.filter((k) => k.stoffer.length > 0),
    kategorierFor,
  }
}

/** Registeret alene, uten fagsidene i databasen. */
export const STOFFREGISTER = byggStoffregister()

/**
 * Feilene i datafilen: nøkler som ikke har riktig form eller står flere ganger,
 * alias som kolliderer, koblinger til stoffer som ikke finnes, koder med mer
 * enn ett primært stoff, og kategorier som nevner ukjente stoffer. Tom når
 * alt er i orden. Testene holder den tom.
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
  for (const s of data.stoffer) {
    for (const a of s.aliaser ?? []) {
      const n = stoffslug(a)
      if (slugs.has(n)) feil.push(`Aliaset «${a}» (${s.slug}) er nøkkelen til et annet stoff.`)
      if (aliaser.has(n) && aliaser.get(n) !== s.slug) feil.push(`Aliaset «${a}» står på flere stoffer.`)
      aliaser.set(n, s.slug)
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
  for (const k of data.kategorier) {
    for (const slug of [...(k.stoffer ?? []), ...(k.underkategorier ?? []).flatMap((u) => u.stoffer)]) {
      if (!slugs.has(slug)) feil.push(`Kategorien ${k.navn} nevner stoffet «${slug}», som ikke finnes.`)
    }
  }
  return feil
}
