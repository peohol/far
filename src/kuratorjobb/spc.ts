/**
 * Preparatomtalene (SPC) for kuratorjobbene: hvilke adresser som godtas,
 * hvilke FEST oppgir for et stoff, og kontrollen av fila som ble hentet. Selve
 * hentingen og PDF-verktøyene står i `scripts/kuratorjobb.ts`; her står det
 * som kan prøves uten nett.
 *
 * Ingenting her leser eller tolker innholdet faglig. Tekstuttrekket og
 * sidebildene er hjelpemidler for kuratoren, som selv kontrollerer tabellene
 * visuelt mot originalen.
 */
import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { lagFaginnholdsleser } from '../faginnhold/lesing'
import { byggSidemodell } from '../faginnhold/stoffside'
import { lagLegemiddelleser, type Legemiddelutvalg } from '../legemiddeldata/lesing'
import { koblede } from '../legemiddeldata/stoffside'
import type { Kontroll } from './modell'

/**
 * Adressene til preparatomtaler hos Direktoratet for medisinske produkter
 * (DMP), slik FEST oppgir dem. Bare disse hentes, også når de blir sendt
 * videre: hver adresse på veien må stå her.
 */
export const DMP_ADRESSER: readonly RegExp[] = [/^https:\/\/produktinformasjon\.legemiddelsok\.no\/preparatomtaler\/[A-Za-z0-9._-]+\.pdf$/]

export const erDmpAdresse = (adresse: string): boolean => DMP_ADRESSER.some((r) => r.test(adresse))

/** Største fil som tas imot. Preparatomtalene er vanligvis under én megabyte. */
export const MAKS_PDF_BYTES = 30 * 1024 * 1024

/** Et preparat i FEST som oppgir preparatomtalen. */
export interface Festpreparat {
  merkevare_id: string
  varenavn: string
  navn_form_styrke: string
  produsent: string | null
  atc: string | null
  legemiddelform: string | null
}

/** En preparatomtale FEST oppgir for stoffet, med preparatene som viser til den. */
export interface Festomtale {
  adresse: string
  preparater: Festpreparat[]
}

export interface Festomtaler {
  omtaler: Festomtale[]
  /** Adresser FEST oppgir som ikke er DMPs, og som derfor ikke hentes. */
  avviste: string[]
  /** Preparater uten preparatomtale i FEST (f.eks. sentralt godkjente, der omtalen ligger hos EMA). */
  uten_omtale: Festpreparat[]
}

/** Preparatomtalene i legemiddeldataene appen leser for siden, én gang per adresse, i FESTs rekkefølge. */
export function festomtaler(utvalg: Pick<Legemiddelutvalg, 'merkevarer'>): Festomtaler {
  const perAdresse = new Map<string, Festpreparat[]>()
  const avviste = new Set<string>()
  const uten: Festpreparat[] = []
  for (const m of utvalg.merkevarer) {
    const preparat: Festpreparat = {
      merkevare_id: m.id,
      varenavn: m.varenavn,
      navn_form_styrke: m.navn_form_styrke,
      produsent: m.produsent,
      atc: m.atc?.kode ?? null,
      legemiddelform: m.legemiddelform_lang ?? m.legemiddelform?.tekst ?? null,
    }
    const adresse = m.preparatomtale?.trim()
    if (!adresse) uten.push(preparat)
    else if (!erDmpAdresse(adresse)) avviste.add(adresse)
    else perAdresse.set(adresse, [...(perAdresse.get(adresse) ?? []), preparat])
  }
  return {
    omtaler: [...perAdresse].map(([adresse, preparater]) => ({ adresse, preparater })),
    avviste: [...avviste],
    uten_omtale: uten,
  }
}

/** Svaret på én henting, slik kontrollen trenger det. */
export interface Pdfsvar {
  /** Adressene på veien, den første først og den siste den fila kom fra. */
  adresser: string[]
  status: number
  hoder: Readonly<Record<string, string>>
  bytes: Uint8Array
}

export const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex')

const tekst = (bytes: Uint8Array, fra: number, til: number) => Buffer.from(bytes.subarray(fra, til)).toString('latin1')

/**
 * Kontrollen av fila: at den kom fra DMP hele veien, at den kom hel (lengden
 * og kontrollsummen DMP oppgir), og at den er en PDF. Om PDF-en kan leses,
 * kontrolleres av PDF-verktøyene etterpå.
 */
export function kontrollerPdfsvar(svar: Pdfsvar): Kontroll[] {
  const k: Kontroll[] = []
  const utenfor = svar.adresser.filter((a) => !erDmpAdresse(a))
  k.push(
    utenfor.length === 0
      ? { id: 'adresse', status: 'ok', melding: `Hentet fra DMP: ${svar.adresser.at(-1)}` }
      : { id: 'adresse', status: 'feil', melding: `Sendt videre til en adresse som ikke er DMPs: ${utenfor.join(', ')}` },
  )
  k.push(
    svar.status === 200
      ? { id: 'http', status: 'ok', melding: 'DMP svarte 200.' }
      : { id: 'http', status: 'feil', melding: `DMP svarte ${svar.status}.` },
  )
  const type = svar.hoder['content-type'] ?? ''
  k.push(
    /^application\/pdf\b/i.test(type)
      ? { id: 'innholdstype', status: 'ok', melding: 'Innholdstypen er application/pdf.' }
      : { id: 'innholdstype', status: 'feil', melding: `Innholdstypen er «${type || 'ikke oppgitt'}», ikke application/pdf.` },
  )
  const lengde = svar.hoder['content-length']
  const n = svar.bytes.length
  k.push(
    n > MAKS_PDF_BYTES
      ? { id: 'lengde', status: 'feil', melding: `Fila er større enn ${MAKS_PDF_BYTES} byte.`, antall: { bytes: n } }
      : lengde === undefined
        ? { id: 'lengde', status: 'advarsel', melding: 'DMP oppga ikke lengden; den kan ikke kontrolleres.', antall: { bytes: n } }
        : Number(lengde) === n
          ? { id: 'lengde', status: 'ok', melding: `Lengden er den DMP oppga (${n} byte).`, antall: { bytes: n } }
          : { id: 'lengde', status: 'feil', melding: `Fikk ${n} byte, DMP oppga ${lengde}.`, antall: { bytes: n } },
  )
  const md5 = svar.hoder['content-md5']
  const egen = createHash('md5').update(svar.bytes).digest('base64')
  k.push(
    md5 === undefined
      ? { id: 'kontrollsum', status: 'advarsel', melding: 'DMP oppga ingen MD5-sum; fila er bare kontrollert med lengden.' }
      : md5 === egen
        ? { id: 'kontrollsum', status: 'ok', melding: 'MD5-summen er den DMP oppga.' }
        : { id: 'kontrollsum', status: 'feil', melding: `MD5-summen er ${egen}, DMP oppga ${md5}.` },
  )
  const start = tekst(svar.bytes, 0, 5)
  const slutt = tekst(svar.bytes, Math.max(0, n - 2048), n)
  k.push(
    start === '%PDF-' && slutt.includes('%%EOF')
      ? { id: 'pdf', status: 'ok', melding: 'Fila begynner og slutter som en PDF.' }
      : { id: 'pdf', status: 'feil', melding: start === '%PDF-' ? 'Fila mangler PDF-avslutningen (%%EOF); den kan være avkuttet.' : 'Fila er ikke en PDF.' },
  )
  return k
}

/** Feltene fra `pdfinfo` som tas vare på. */
export interface Pdfinfo {
  sider: number | null
  pdfversjon: string | null
  kryptert: boolean
  tittel: string | null
  laget: string | null
  endret: string | null
  produsent: string | null
}

/** Utskriften fra `pdfinfo`, lest. */
export function lesPdfinfo(utskrift: string): Pdfinfo {
  const felt = new Map<string, string>()
  for (const linje of utskrift.split('\n')) {
    const skille = linje.indexOf(':')
    if (skille > 0) felt.set(linje.slice(0, skille).trim(), linje.slice(skille + 1).trim())
  }
  const verdi = (n: string) => felt.get(n) || null
  const sider = Number(felt.get('Pages'))
  return {
    sider: Number.isInteger(sider) && sider > 0 ? sider : null,
    pdfversjon: verdi('PDF version'),
    kryptert: (felt.get('Encrypted') ?? 'no').toLowerCase() !== 'no',
    tittel: verdi('Title'),
    laget: verdi('CreationDate'),
    endret: verdi('ModDate'),
    produsent: verdi('Producer'),
  }
}

/** Overskriftene som avgrenser avsnitt 4.8 i en preparatomtale, hver på en linje for seg (QRD-malen). */
export const AVSNITT_4_8 = { start: /^[ \t]*4\.8\.?[ \t]+Bivirkninger/im, neste: /^[ \t]*4\.9\.?[ \t]+Overdos/im }

/**
 * Sidene et avsnitt står på (1-basert): fra siden med overskriften til siden
 * med overskriften på det neste. `null` når overskriften ikke finnes i
 * teksten. Bare et hjelpemiddel for å finne fram; kuratoren leser selv.
 */
export function finnAvsnitt(sider: readonly string[], avsnitt: { start: RegExp; neste: RegExp }): { fra: number; til: number } | null {
  const fra = sider.findIndex((s) => avsnitt.start.test(s))
  if (fra === -1) return null
  const etter = sider.findIndex((s, i) => i >= fra && avsnitt.neste.test(s))
  return { fra: fra + 1, til: (etter === -1 ? sider.length - 1 : etter) + 1 }
}

/**
 * Preparatomtalene FEST oppgir for stoffet, lest slik appen leser dem: siden
 * med `les_stoff`, virkestoffene den er koblet til, og legemiddeldataene for
 * dem med `les_legemidler`. `null` når siden ikke finnes eller ikke er koblet.
 */
export async function lesFestomtaler(
  klient: SupabaseClient,
  stoff: string,
): Promise<(Festomtaler & { kontrollert_kl: string | null }) | null> {
  const side = await lagFaginnholdsleser(klient).lesStoffside(stoff, 'publisert')
  if (!side.infoside) return null
  const virkestoff = koblede(byggSidemodell(side))
  if (virkestoff.length === 0) return null
  const utvalg = await lagLegemiddelleser(klient).les(virkestoff)
  return { ...festomtaler(utvalg), kontrollert_kl: utvalg.kontrollert_kl }
}
