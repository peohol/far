/**
 * Stoffregisteret slik databasen har det (`les_stoffregister`), og endringene
 * i det, regnet ut i appen så de vises før databasen har svart.
 *
 * Reglene for hvem som får gjøre hva, håndheves i databasen. Her står de
 * samme reglene en gang til, så knappene kan sies å ikke virke — med hvorfor —
 * før noen trykker på dem.
 */
import type { Riktekstdokument } from '../faginnhold/riktekst'
import {
  ANDRE_STOFFER_ID,
  type Kategorirad,
  type Plasseringsrad,
  type Registerkategori,
  type Registerstoff,
  type Registerstruktur,
  type Statusrad,
  type Stoffoppforing,
  type Stoffstatus,
} from '../domain/stoffregister'

/** En fagside med den korte oppsummeringen av stoffet (rikteksten i panelet «Identitet»). */
export interface Registerside extends Stoffoppforing {
  oppsummering: Riktekstdokument | null
}

/** Alt `les_stoffregister` gir: fagsidene og inndelingen. */
export interface Registerdatabase {
  sider: Registerside[]
  struktur: Registerstruktur
}

const STATUSER: readonly Stoffstatus[] = ['arkivert', 'papirkurv', 'fjernet']

const tekst = (v: unknown): string | null => (typeof v === 'string' ? v : null)
const objekter = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v) ? v.filter((r): r is Record<string, unknown> => typeof r === 'object' && r !== null) : []

/** Svaret fra `les_stoffregister`. Rader som ikke har det de skal, hoppes over. */
export function lesRegisterdatabase(data: unknown): Registerdatabase {
  const rot = typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {}
  const kategorier = objekter(rot.kategorier).flatMap((r): Kategorirad[] => {
    const id = tekst(r.id)
    const navn = tekst(r.navn)
    if (!id || !navn) return []
    return [
      {
        id,
        forelder: tekst(r.forelder),
        navn,
        posisjon: typeof r.posisjon === 'number' ? r.posisjon : 0,
        ikon: tekst(r.ikon),
        arkivert_kl: tekst(r.arkivert_kl),
      },
    ]
  })
  const plasseringer = objekter(rot.plasseringer).flatMap((r): Plasseringsrad[] => {
    const stoff = tekst(r.stoff)
    const kategori = tekst(r.kategori)
    return stoff && kategori ? [{ stoff, kategori }] : []
  })
  const status = objekter(rot.status).flatMap((r): Statusrad[] => {
    const stoff = tekst(r.stoff)
    const s = tekst(r.status) as Stoffstatus | null
    if (!stoff || !s || !STATUSER.includes(s)) return []
    return [{ stoff, status: s, endret_kl: tekst(r.endret_kl) ?? '', endret_av: tekst(r.endret_av) }]
  })
  const sider = objekter(rot.sider).flatMap((r): Registerside[] => {
    const id = tekst(r.id)
    const slug = tekst(r.slug)
    const navn = tekst(r.navn)
    if (!id || !slug || !navn) return []
    const oppsummering = r.oppsummering
    return [
      {
        id,
        slug,
        navn,
        innhold: r.innhold !== false,
        oppsummering:
          typeof oppsummering === 'object' && oppsummering !== null && (oppsummering as { type?: unknown }).type === 'doc'
            ? (oppsummering as Riktekstdokument)
            : null,
      },
    ]
  })
  return { sider, struktur: { kategorier, plasseringer, status } }
}

/** En endring i inndelingen, slik appen viser den før databasen har svart. */
export type Registerendring =
  | { type: 'endre-kategori'; kategori: string; navn: string }
  | { type: 'flytt-kategori'; kategori: string; forelder: string | null; indeks: number }
  | { type: 'arkiver-kategori'; kategori: string; arkivert: boolean }
  | { type: 'slett-kategori'; kategori: string }
  | { type: 'plasser-stoff'; stoff: string; fra: string | null; til: string | null }
  | { type: 'sett-status'; stoff: string; status: Stoffstatus | null }

/** Søsknene under `forelder`, uten de arkiverte, i rekkefølgen. */
function sosken(kategorier: readonly Kategorirad[], forelder: string | null): Kategorirad[] {
  return kategorier.filter((k) => k.forelder === forelder && !k.arkivert_kl).sort((a, b) => a.posisjon - b.posisjon)
}

/** Søsknene under `forelder` med plassene 0, 1, 2 … i den rekkefølgen de står i `ordnet`. */
function ordne(kategorier: readonly Kategorirad[], forelder: string | null, ordnet: readonly Kategorirad[]): Kategorirad[] {
  const plass = new Map(ordnet.map((k, i) => [k.id, i]))
  return kategorier.map((k) => (k.forelder === forelder && plass.has(k.id) ? { ...k, posisjon: plass.get(k.id)! } : k))
}

/** Inndelingen etter endringen. `naa` er tidspunktet en arkivering eller sletting får. */
export function endreStruktur(s: Registerstruktur, e: Registerendring, naa = new Date().toISOString()): Registerstruktur {
  switch (e.type) {
    case 'endre-kategori':
      return { ...s, kategorier: s.kategorier.map((k) => (k.id === e.kategori ? { ...k, navn: e.navn } : k)) }
    case 'flytt-kategori': {
      const kategori = s.kategorier.find((k) => k.id === e.kategori)
      if (!kategori) return s
      const flyttet = { ...kategori, forelder: e.forelder }
      let kategorier = s.kategorier.map((k) => (k.id === e.kategori ? flyttet : k))
      if (kategori.forelder !== e.forelder) {
        kategorier = ordne(kategorier, kategori.forelder, sosken(kategorier, kategori.forelder))
      }
      const nye = sosken(kategorier, e.forelder).filter((k) => k.id !== e.kategori)
      nye.splice(Math.max(0, Math.min(e.indeks, nye.length)), 0, flyttet)
      return { ...s, kategorier: ordne(kategorier, e.forelder, nye) }
    }
    case 'arkiver-kategori': {
      const kategori = s.kategorier.find((k) => k.id === e.kategori)
      if (!kategori || Boolean(kategori.arkivert_kl) === e.arkivert) return s
      const endret = e.arkivert
        ? { ...kategori, arkivert_kl: naa }
        : { ...kategori, arkivert_kl: null, posisjon: Number.MAX_SAFE_INTEGER }
      const kategorier = s.kategorier.map((k) => (k.id === e.kategori ? endret : k))
      return { ...s, kategorier: ordne(kategorier, kategori.forelder, sosken(kategorier, kategori.forelder)) }
    }
    case 'slett-kategori': {
      const borte = new Set([e.kategori, ...s.kategorier.filter((k) => k.forelder === e.kategori).map((k) => k.id)])
      const forelder = s.kategorier.find((k) => k.id === e.kategori)?.forelder ?? null
      const kategorier = s.kategorier.filter((k) => !borte.has(k.id))
      return {
        ...s,
        kategorier: ordne(kategorier, forelder, sosken(kategorier, forelder)),
        plasseringer: s.plasseringer.filter((p) => !borte.has(p.kategori)),
      }
    }
    case 'plasser-stoff': {
      const uten = s.plasseringer.filter((p) => !(p.stoff === e.stoff && (p.kategori === e.fra || p.kategori === e.til)))
      return { ...s, plasseringer: e.til ? [...uten, { stoff: e.stoff, kategori: e.til }] : uten }
    }
    case 'sett-status': {
      const uten = s.status.filter((r) => r.stoff !== e.stoff)
      return {
        ...s,
        status: e.status ? [...uten, { stoff: e.stoff, status: e.status, endret_kl: naa, endret_av: null }] : uten,
      }
    }
  }
}

/* --- Reglene -------------------------------------------------------------------- */

/** Svaret på om noe kan gjøres: ja, eller nei med hvorfor, i en setning som kan vises. */
export type Lov = { lov: true } | { lov: false; grunn: string }

const JA: Lov = { lov: true }
const nei = (grunn: string): Lov => ({ lov: false, grunn })

/**
 * Om fagsiden kan legges i papirkurven. Alle kan slette en side som bare har
 * et navn; en side med innhold bare en administrator. Et stoff uten side i
 * databasen, eller som fortolkningen lenker til, kan bare arkiveres: siden
 * lenkene dit skal virke, kan den ikke forsvinne.
 */
export function kanSletteStoff(stoff: Registerstoff, admin: boolean): Lov {
  if (stoff.analytter) {
    return nei('Fagsiden er koblet til laboratorieanalyser i fortolkningen og kan ikke slettes. Arkiver den i stedet.')
  }
  if (!stoff.side) return nei('Stoffet har ingen fagside å slette. Arkiver det i stedet.')
  if (stoff.innhold && !admin) return nei('Bare administratorer kan slette en fagside med innhold. Arkiver den i stedet.')
  return JA
}

/** Om kategorien kan slettes. En kategori med stoffer bare av en administrator. */
export function kanSletteKategori(kategori: Pick<Registerkategori, 'stoffer'>, admin: boolean): Lov {
  if (kategori.stoffer.length > 0 && !admin) {
    return nei('Kategorien har stoffer. Flytt dem først, eller be en administrator slette den.')
  }
  return JA
}

/** Om noe kan plasseres i kategorien: ikke i «Andre stoffer», som er det som står igjen uten plass. */
export const erEkteKategori = (id: string) => id !== ANDRE_STOFFER_ID
