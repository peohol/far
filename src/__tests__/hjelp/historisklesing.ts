/**
 * Lesingen av sidene i en database der migrasjonene bare er kjørt til en gitt
 * migrasjon, før stoffet ble fagsidens identitet
 * (`20260929080000_stoffidentitet.sql`): der har sidene ingen nøkkel, og
 * `les_stoff` finnes ikke. Testene av de historiske importene leser da med de
 * utgåtte funksjonene — etter sidens navn eller analyttkoden — som appen
 * brukte da migrasjonene ble skrevet. Appen selv leser etter stoffets nøkkel
 * (`lesStoffside` i `src/faginnhold/lesing.ts`).
 */
import type {
  Innholdselementinnhold,
  Infosideinnhold,
  Laboratorieanalyttinnhold,
  Referanseinnhold,
  Tilstand,
} from '../../faginnhold/modell'
import type { Utgave } from '../../faginnhold/lesing'
import type { Faginnholdskall } from './testdatabase'

/** En side slik de utgåtte funksjonene ga den. Feltene som ikke gjelder, er tomme. */
export interface Historiskside {
  analytt: Utgave<Laboratorieanalyttinnhold> | null
  infoside: Utgave<Infosideinnhold> | null
  elementer: Utgave<Innholdselementinnhold>[]
  /** Komponentsidene til analytten, i rekkefølge, med kodene som hadde dem som hovedside. */
  komponenter: (Utgave<Infosideinnhold> & { koder: string[] })[]
  referanser: Utgave<Referanseinnhold>[]
}

const TOM: Historiskside = { analytt: null, infoside: null, elementer: [], komponenter: [], referanser: [] }

async function les(
  kall: Faginnholdskall,
  bruker: string,
  funksjon: string,
  argumenter: Record<string, unknown>,
): Promise<Historiskside> {
  const rad = await kall.rpc<Record<string, Partial<Historiskside> | null>>(bruker, funksjon, argumenter)
  const side = rad[funksjon]
  if (!side) return TOM
  return {
    analytt: side.analytt ?? null,
    infoside: side.infoside ?? null,
    elementer: side.elementer ?? [],
    komponenter: side.komponenter ?? [],
    referanser: side.referanser ?? [],
  }
}

/** Siden med dette navnet (`les_stoffside`), uten hensyn til store og små bokstaver. */
export function lesSideEtterNavn(kall: Faginnholdskall, bruker: string, navn: string, tilstand: Tilstand) {
  return les(kall, bruker, 'les_stoffside', { sidenavn: navn, sidetilstand: tilstand })
}

/** Hovedsiden til analyttkoden, med analytten (`les_analyttside`). */
export function lesSideEtterKode(kall: Faginnholdskall, bruker: string, kode: string, tilstand: Tilstand) {
  return les(kall, bruker, 'les_analyttside', { analyttkode: kode, sidetilstand: tilstand })
}

/** Navnene på sidene uten analyttkode, alfabetisk (`les_stoffsidenavn`). */
export async function lesSidenavnUtenKode(kall: Faginnholdskall, bruker: string, tilstand: Tilstand): Promise<string[]> {
  const rad = await kall.rpc<{ les_stoffsidenavn: string[] | null }>(bruker, 'les_stoffsidenavn', { sidetilstand: tilstand })
  return rad.les_stoffsidenavn ?? []
}
