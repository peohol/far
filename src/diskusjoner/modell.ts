/**
 * Diskusjonene på fagsidene og fortolkningssidene: hvilken side en tråd står
 * på, formen dataene har, grupperingen i kategorier, reglene for navn og
 * emoji, og søket. Alt her er rene funksjoner; kallene står i `api.ts`, og
 * reglene databasen håndhever, i migrasjonen `*_diskusjoner.sql` og i
 * `docs/diskusjoner.md`.
 */
import { klartekst, type Riktekstdokument } from '../faginnhold/riktekst'
import { erObjekt, tall, tekst, tekstEllerNull } from '../ideer/lesing'
import { fortolkningsnokkel, fortolkningsrute, stoffadresse, type Rute } from '../domain/rute'
import { lesInnlegg, lesKommentarer, rensInnleggstekst, type Innlegg, type Kommentar } from '../traad/modell'

/* --- Sidene ------------------------------------------------------------------- */

/**
 * Siden trådene står på, slik databasen lagrer den: `stoff:<nøkkel>` for en
 * fagside og `fortolkning:<nøkkel>` for fortolkningen av en analytt.
 * Samme form som `intern.er_diskusjonsside()`.
 */
export type Diskusjonsside = `stoff:${string}` | `fortolkning:${string}`

const NOKKEL = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const SIDE = /^(stoff|fortolkning):([a-z0-9]+(?:-[a-z0-9]+)*)$/

/** Siden ruten viser, når den har diskusjoner: en fagside eller fortolkningen av én analytt. */
export function diskusjonssideFor(rute: Rute): Diskusjonsside | null {
  if (rute.side === 'stoff') return NOKKEL.test(rute.stoff) ? `stoff:${rute.stoff}` : null
  if (rute.side === 'fortolkning' && rute.analytt) return NOKKEL.test(rute.analytt) ? `fortolkning:${rute.analytt}` : null
  return null
}

export function lesDiskusjonsside(verdi: unknown): Diskusjonsside | null {
  return typeof verdi === 'string' && SIDE.test(verdi) ? (verdi as Diskusjonsside) : null
}

/** Adressen til siden tråden står på. */
export function adresseForSide(side: Diskusjonsside): string {
  const [, type, nokkel] = SIDE.exec(side) ?? []
  if (!nokkel) return '#/'
  return type === 'stoff' ? stoffadresse(nokkel) : `#/fortolkning/${nokkel}`
}

/** Ruten til siden, for den som navigerer i appen. */
export function ruteForSide(side: Diskusjonsside): Rute {
  const [, type, nokkel = ''] = SIDE.exec(side) ?? []
  return type === 'stoff' ? { side: 'stoff', stoff: nokkel } : fortolkningsrute(nokkel)
}

/** En side med diskusjoner, med navnet brukerne kjenner den på. */
export interface Sidevalg {
  side: Diskusjonsside
  navn: string
}

/** Alle sidene med diskusjoner, delt i fagsidene og fortolkningene, hver alfabetisk. */
export interface Diskusjonssider {
  fagsider: Sidevalg[]
  fortolkninger: Sidevalg[]
}

/** Navnet på fortolkningssiden til en analytt. */
export function fortolkningssidenavn(analytt: { kode: string; visningsnavn?: string | null }): string {
  return `Fortolkning av ${analytt.visningsnavn || analytt.kode}`
}

/**
 * Sidene en tråd kan stå på: fagsiden til hvert stoff og fortolkningen av hver
 * analytt. En nøkkel som ikke kan være en side, og en side som går igjen, tas
 * med én gang.
 */
export function diskusjonssider(
  stoffer: readonly { slug: string; navn: string }[],
  analytter: readonly { kode: string; visningsnavn?: string | null }[],
): Diskusjonssider {
  const valg = (par: [string, string][]): Sidevalg[] => {
    const sider = new Map<string, Sidevalg>()
    for (const [side, navn] of par) if (lesDiskusjonsside(side) && !sider.has(side)) sider.set(side, { side: side as Diskusjonsside, navn })
    return [...sider.values()].sort((a, b) => a.navn.localeCompare(b.navn, 'nb'))
  }
  return {
    fagsider: valg(stoffer.map((s) => [`stoff:${s.slug}`, s.navn])),
    fortolkninger: valg(analytter.map((a) => [`fortolkning:${fortolkningsnokkel(a.kode)}`, fortolkningssidenavn(a)])),
  }
}

/**
 * Navnet på en side, slik brukerne kjenner den. En side lista ikke har (en
 * fagside som er ny siden lista ble laget), får nøkkelen sin.
 */
export function navnPaaSide(sider: Diskusjonssider, side: Diskusjonsside): string {
  const funnet = [...sider.fagsider, ...sider.fortolkninger].find((s) => s.side === side)
  if (funnet) return funnet.navn
  const [, type, nokkel = side] = SIDE.exec(side) ?? []
  return type === 'fortolkning' ? fortolkningssidenavn({ kode: nokkel.toUpperCase() }) : nokkel
}

/* --- Formen dataene har ------------------------------------------------------ */

export interface Diskusjonskategori {
  id: string
  navn: string
  emoji: string
  posisjon: number
}

/** En tråd slik lista viser den, uten innleggene. */
export interface Diskusjon {
  id: string
  /** `null`: under «Ukategoriserte», etter at kategorien ble løst opp. */
  kategori_id: string | null
  forfatter_id: string | null
  tittel: string
  posisjon: number
  opprettet_kl: string
  arkivert_kl: string | null
  /** Siste innlegg eller kommentar. */
  siste_kl: string
  kommentarer: number
  nye_kommentarer: number
  /** Noe i tråden er nytt for den innloggede. */
  usett: boolean
  hjerter: number
  mitt_hjerte: boolean
}

export interface Diskusjonsoversikt {
  kategorier: Diskusjonskategori[]
  diskusjoner: Diskusjon[]
}

/** Én tråd med det første innlegget og kommentarene. */
export interface Diskusjonstraad extends Innlegg {
  side: Diskusjonsside
  kategori_id: string | null
  tittel: string
  /** Renset for visning. Tomt når innlegget er skjult. */
  tekst: Riktekstdokument
  /** En administrator har skjult innholdet i det første innlegget. */
  skjult: boolean
  arkivert_kl: string | null
  /** Når tråden ble lest; det er det tråden merkes som sett etter. */
  lest_kl: string
  /** Når den innloggede sist åpnet tråden, før nå. */
  sist_sett: string | null
  kommentarer: Kommentar[]
}

/**
 * Om brukeren kan slette tråden: en administrator alltid, ellers den som
 * startet den, så lenge den ikke er arkivert og ingen andre har skrevet i
 * den. En kommentar som står igjen som «Slettet», teller ikke. Samme regel
 * som `public.slett_diskusjon()`.
 */
export function kanSletteDiskusjon(
  traad: Pick<Diskusjonstraad, 'forfatter_id' | 'arkivert_kl' | 'kommentarer'>,
  bruker: string,
  admin: boolean,
): boolean {
  if (admin) return true
  return (
    traad.forfatter_id === bruker &&
    !traad.arkivert_kl &&
    traad.kommentarer.every((k) => k.slettet || k.forfatter_id === bruker)
  )
}

/** Tekstene i én tråd, til søket. */
export interface Diskusjonstekster {
  id: string
  tittel: string
  tekster: string[]
}

export const TOM_OVERSIKT: Diskusjonsoversikt = { kategorier: [], diskusjoner: [] }

function liste(verdi: unknown): Record<string, unknown>[] {
  return Array.isArray(verdi) ? verdi.filter(erObjekt) : []
}

export function lesDiskusjonsoversikt(data: unknown): Diskusjonsoversikt {
  if (!erObjekt(data)) return TOM_OVERSIKT
  return {
    kategorier: liste(data.kategorier)
      .map((k) => ({ id: tekst(k.id), navn: tekst(k.navn), emoji: tekst(k.emoji), posisjon: tall(k.posisjon) }))
      .filter((k) => k.id && k.navn && k.emoji),
    diskusjoner: liste(data.diskusjoner)
      .map((d) => ({
        id: tekst(d.id),
        kategori_id: tekstEllerNull(d.kategori_id),
        forfatter_id: tekstEllerNull(d.forfatter_id),
        tittel: tekst(d.tittel),
        posisjon: tall(d.posisjon),
        opprettet_kl: tekst(d.opprettet_kl),
        arkivert_kl: tekstEllerNull(d.arkivert_kl),
        siste_kl: tekst(d.siste_kl) || tekst(d.opprettet_kl),
        kommentarer: tall(d.kommentarer),
        nye_kommentarer: tall(d.nye_kommentarer),
        usett: d.usett === true,
        hjerter: tall(d.hjerter),
        mitt_hjerte: d.mitt_hjerte === true,
      }))
      .filter((d) => d.id),
  }
}

export function lesDiskusjonstraad(data: unknown): Diskusjonstraad | null {
  if (!erObjekt(data)) return null
  const side = lesDiskusjonsside(data.side)
  const innlegg = lesInnlegg(data)
  if (!innlegg.id || !side) return null
  const skjult = data.skjult === true
  return {
    ...innlegg,
    side,
    kategori_id: tekstEllerNull(data.kategori_id),
    tittel: tekst(data.tittel),
    tekst: rensInnleggstekst(skjult ? null : data.tekst),
    skjult,
    arkivert_kl: tekstEllerNull(data.arkivert_kl),
    lest_kl: tekst(data.lest_kl),
    sist_sett: tekstEllerNull(data.sist_sett),
    kommentarer: lesKommentarer(data.kommentarer),
  }
}

export function lesDiskusjonstekster(data: unknown): Diskusjonstekster[] {
  return liste(data)
    .map((d) => ({
      id: tekst(d.id),
      tittel: tekst(d.tittel),
      tekster: (Array.isArray(d.tekster) ? d.tekster : []).map((t) => klartekst(rensInnleggstekst(t))).filter(Boolean),
    }))
    .filter((d) => d.id)
}

/* --- Kategoriene ------------------------------------------------------------- */

/**
 * Trådene uten kategori, etter at kategorien deres ble løst opp. Navnet og
 * emojien er reservert, så ingen kategori kan hete det samme.
 */
export const UKATEGORISERTE = { navn: 'Ukategoriserte', emoji: '🫧' } as const

/** Lengste kategorinavn. Samme grense som databasen setter. */
export const KATEGORINAVN_MEST = 60

export interface Kategorigruppe {
  kategori: Diskusjonskategori
  diskusjoner: Diskusjon[]
}

export interface Gruppering {
  kategorier: Kategorigruppe[]
  /** Aktive tråder uten kategori. Tom lista står ikke. */
  ukategoriserte: Diskusjon[]
  /** De arkiverte, den sist arkiverte først. */
  arkiv: Diskusjon[]
}

const etterPosisjon = <T extends { posisjon: number }>(a: T, b: T) => a.posisjon - b.posisjon

export function grupper(oversikt: Diskusjonsoversikt): Gruppering {
  const aktive = oversikt.diskusjoner.filter((d) => !d.arkivert_kl).sort(etterPosisjon)
  const kjente = new Set(oversikt.kategorier.map((k) => k.id))
  return {
    kategorier: [...oversikt.kategorier]
      .sort(etterPosisjon)
      .map((kategori) => ({ kategori, diskusjoner: aktive.filter((d) => d.kategori_id === kategori.id) })),
    ukategoriserte: aktive.filter((d) => !d.kategori_id || !kjente.has(d.kategori_id)),
    arkiv: oversikt.diskusjoner
      .filter((d) => d.arkivert_kl)
      .sort((a, b) => Date.parse(b.arkivert_kl ?? '') - Date.parse(a.arkivert_kl ?? '')),
  }
}

/** Hvor mange av trådene som har noe nytt for den innloggede. */
export function antallNye(diskusjoner: readonly Diskusjon[]): number {
  return diskusjoner.filter((d) => d.usett).length
}

/**
 * Oversikten med én tråd flyttet til plass `indeks` i en kategori, slik
 * databasen ordner den (`intern.ordne_diskusjoner()`): tettpakket fra 0.
 */
export function flyttDiskusjon(oversikt: Diskusjonsoversikt, id: string, kategori: string, indeks: number): Diskusjonsoversikt {
  const flyttet = oversikt.diskusjoner.find((d) => d.id === id)
  if (!flyttet) return oversikt
  const aktiveI = (k: string | null) =>
    oversikt.diskusjoner.filter((d) => d.id !== id && d.kategori_id === k && !d.arkivert_kl).sort(etterPosisjon)
  const til = aktiveI(kategori)
  til.splice(Math.max(0, Math.min(indeks, til.length)), 0, { ...flyttet, kategori_id: kategori })
  const fra = flyttet.kategori_id === kategori ? [] : aktiveI(flyttet.kategori_id)
  const nye = new Map([...til, ...fra].map((d, i) => [d.id, { ...d, posisjon: i < til.length ? i : i - til.length }]))
  return { ...oversikt, diskusjoner: oversikt.diskusjoner.map((d) => nye.get(d.id) ?? d) }
}

/** Oversikten med én kategori flyttet til plass `indeks`. */
export function flyttKategori(oversikt: Diskusjonsoversikt, id: string, indeks: number): Diskusjonsoversikt {
  const ordnet = [...oversikt.kategorier].sort(etterPosisjon)
  const fra = ordnet.findIndex((k) => k.id === id)
  if (fra < 0) return oversikt
  const [kategori] = ordnet.splice(fra, 1)
  ordnet.splice(Math.max(0, Math.min(indeks, ordnet.length)), 0, kategori!)
  return { ...oversikt, kategorier: ordnet.map((k, i) => ({ ...k, posisjon: i })) }
}

/**
 * Om teksten er nøyaktig én emoji: ett tegn slik leseren ser det, som er et
 * bildetegn (ikke en bokstav, et tall eller et vanlig tegn). Databasen
 * sjekker det grovere (ingen ASCII); dette er det skjemaet sier fra om.
 */
export function erEnEmoji(verdi: string): boolean {
  const emoji = verdi.trim()
  if (!emoji || /[\u0000-\u007f]/.test(emoji)) return false
  const tegn = [...new Intl.Segmenter('nb', { granularity: 'grapheme' }).segment(emoji)]
  return tegn.length === 1 && /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(emoji)
}

const sammenlign = (verdi: string) => verdi.trim().toLocaleLowerCase('nb')

/**
 * Hva som er galt med navnet på en kategori, eller `null`. `unntak` er
 * kategorien som endres, som får beholde sitt eget navn.
 */
export function kategorinavnFeil(navn: string, kategorier: readonly Diskusjonskategori[], unntak?: string): string | null {
  const renset = navn.trim()
  if (!renset) return 'Gi kategorien et navn.'
  if (renset.length > KATEGORINAVN_MEST) return `Navnet kan ha høyst ${KATEGORINAVN_MEST} tegn.`
  if (sammenlign(renset) === sammenlign(UKATEGORISERTE.navn)) return `«${UKATEGORISERTE.navn}» er reservert.`
  if (kategorier.some((k) => k.id !== unntak && sammenlign(k.navn) === sammenlign(renset))) {
    return 'En annen kategori på siden har det navnet.'
  }
  return null
}

/** Hva som er galt med emojien til en kategori, eller `null`. */
export function emojiFeil(emoji: string, kategorier: readonly Diskusjonskategori[], unntak?: string): string | null {
  const renset = emoji.trim()
  if (!renset) return 'Velg en emoji.'
  if (!erEnEmoji(renset)) return 'Skriv inn én emoji.'
  if (renset === UKATEGORISERTE.emoji) return `${UKATEGORISERTE.emoji} er reservert for «${UKATEGORISERTE.navn}».`
  if (kategorier.some((k) => k.id !== unntak && k.emoji === renset)) return 'En annen kategori på siden har den emojien.'
  return null
}

/* --- Søket -------------------------------------------------------------------- */

export interface Sokstreff {
  diskusjon: Diskusjon
  /** Et utdrag rundt det første treffet i et innlegg, når treffet ikke er i overskriften. */
  utdrag: string | null
}

/** Ordene i søket, i små bokstaver. */
function sokeord(sporring: string): string[] {
  return sporring.toLocaleLowerCase('nb').split(/\s+/).filter(Boolean)
}

/** Hvor mye tekst som står på hver side av treffet i utdraget. */
const UTDRAG_LUFT = 40

function utdrag(tekst: string, ord: string): string {
  const linje = tekst.replace(/\s+/g, ' ')
  const treff = linje.toLocaleLowerCase('nb').indexOf(ord)
  const fra = Math.max(0, treff - UTDRAG_LUFT)
  const til = Math.min(linje.length, treff + ord.length + UTDRAG_LUFT)
  return `${fra > 0 ? '…' : ''}${linje.slice(fra, til).trim()}${til < linje.length ? '…' : ''}`
}

/**
 * Trådene der hvert ord i søket står i overskriften eller i et av innleggene,
 * i den rekkefølgen trådene har. De arkiverte er med.
 */
export function sokIDiskusjoner(
  sporring: string,
  diskusjoner: readonly Diskusjon[],
  tekster: readonly Diskusjonstekster[],
): Sokstreff[] {
  const ord = sokeord(sporring)
  if (ord.length === 0) return []
  const etterId = new Map(tekster.map((t) => [t.id, t.tekster]))
  return diskusjoner.flatMap((diskusjon): Sokstreff[] => {
    const tittel = diskusjon.tittel.toLocaleLowerCase('nb')
    const innlegg = etterId.get(diskusjon.id) ?? []
    const smaa = innlegg.map((t) => t.toLocaleLowerCase('nb'))
    const alt = [tittel, ...smaa].join('\n')
    if (!ord.every((o) => alt.includes(o))) return []
    const iInnlegg = ord.find((o) => !tittel.includes(o))
    const hvor = iInnlegg ? smaa.findIndex((t) => t.includes(iInnlegg)) : -1
    return [{ diskusjon, utdrag: iInnlegg && hvor >= 0 ? utdrag(innlegg[hvor]!, iInnlegg) : null }]
  })
}
