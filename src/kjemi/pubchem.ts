/**
 * PubChem: kallene og lesingen av svarene (`docs/kjemi.md`).
 *
 * PUG REST (`https://pubchem.ncbi.nlm.nih.gov/rest/pug`) er åpent og uten
 * nøkkel. PubChem ber om høyst fem kall i sekundet og 400 i minuttet; alle
 * kall går gjennom én kø med {@link MINSTE_AVSTAND_MS} mellom hvert. Egenskapene
 * for mange forbindelser hentes i ett kall (`POST …/compound/cid/property/…`).
 *
 * Det som leses, er bare det OUSFAR viser og kontrollerer: formelen,
 * molekylvekten, InChIKey, navnet og stereokjemien. Svaret slik det kom,
 * lagres ved siden av (`raa`).
 */
import { lagHofligHenting, type Hoflighetsvalg } from '../server/hofligHenting.js'
import { INCHIKEY } from './forbindelser.js'

export const PUBCHEM_API = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug'

/** Minste tid mellom to kall: PubChem tillater fem i sekundet og 400 i minuttet. */
export const MINSTE_AVSTAND_MS = 250

/** Egenskapene som hentes, i PubChems navn. */
export const EGENSKAPER = [
  'Title',
  'MolecularFormula',
  'MolecularWeight',
  'MonoisotopicMass',
  'InChIKey',
  'IUPACName',
  'Charge',
  'CovalentUnitCount',
  'DefinedAtomStereoCount',
  'UndefinedAtomStereoCount',
  'DefinedBondStereoCount',
  'UndefinedBondStereoCount',
] as const

/** Flest CID-er i ett kall. */
export const MAKS_PER_KALL = 100

/** Hvem som spør, så PubChem kan si fra. */
export const BRUKERAGENT = 'OUSFAR-datasynk/1.0 (+https://github.com/peohol/far)'

export class PubchemFeil extends Error {
  constructor(
    melding: string,
    readonly status: number | null = null,
  ) {
    super(melding)
    this.name = 'PubchemFeil'
  }
}

export interface PubchemApi {
  /** Egenskapene for CID-ene, slik PubChem ga dem (`PropertyTable.Properties`). */
  egenskaper(cider: readonly number[]): Promise<unknown[]>
  /** CID-ene PubChem har for et navn. Tom når navnet ikke er kjent. */
  cidsForNavn(navn: string): Promise<number[]>
  /** Moderforbindelsen PubChem oppgir for et salt eller en blanding (tom når ingen). */
  moderforbindelser(cid: number): Promise<number[]>
}

export function lagPubchemApi({
  base = PUBCHEM_API,
  ...valg
}: Partial<Hoflighetsvalg> & { base?: string } = {}): PubchemApi {
  const henting = lagHofligHenting({
    avstand: MINSTE_AVSTAND_MS,
    hoder: { accept: 'application/json', 'user-agent': BRUKERAGENT },
    ...valg,
  })

  async function json(res: Response, hva: string): Promise<Record<string, unknown> | null> {
    if (res.status === 404) return null
    const svar = (await res.json().catch(() => null)) as Record<string, unknown> | null
    if (!res.ok || !svar) {
      const fault = svar?.Fault as { Message?: unknown } | undefined
      throw new PubchemFeil(`PubChem svarte ${res.status} for ${hva}${typeof fault?.Message === 'string' ? `: ${fault.Message}` : ''}`, res.status)
    }
    return svar
  }

  return {
    egenskaper: async (cider) => {
      const ut: unknown[] = []
      for (let i = 0; i < cider.length; i += MAKS_PER_KALL) {
        const del = cider.slice(i, i + MAKS_PER_KALL)
        const res = await henting(`${base}/compound/cid/property/${EGENSKAPER.join(',')}/JSON`, {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: `cid=${del.join(',')}`,
        })
        const svar = await json(res, `${del.length} CID-er`)
        const tabell = (svar?.PropertyTable as { Properties?: unknown } | undefined)?.Properties
        if (svar && !Array.isArray(tabell)) throw new PubchemFeil('PubChem ga ikke en egenskapstabell.')
        ut.push(...((tabell as unknown[] | undefined) ?? []))
      }
      return ut
    },
    cidsForNavn: async (navn) =>
      cidListe(await json(await henting(`${base}/compound/name/${encodeURIComponent(navn)}/cids/JSON`), `navnet «${navn}»`)),
    moderforbindelser: async (cid) =>
      cidListe(await json(await henting(`${base}/compound/cid/${cid}/cids/JSON?cids_type=parent`), `moderforbindelsen til CID ${cid}`)),
  }
}

function cidListe(svar: Record<string, unknown> | null): number[] {
  const liste = (svar?.IdentifierList as { CID?: unknown } | undefined)?.CID
  return Array.isArray(liste) ? liste.filter((c): c is number => Number.isInteger(c) && c > 0) : []
}

/* --- Lesingen -------------------------------------------------------------- */

/** En forbindelse i PubChem, slik OUSFAR lagrer den. */
export interface Pubchemdata {
  cid: number
  tittel: string
  formel: string
  /** Molekylvekten slik PubChem oppgir den (g/mol), som tekst så presisjonen står. */
  molvekt: string
  monoisotopisk_masse: string | null
  inchikey: string
  iupac: string | null
  ladning: number
  /** Antall kovalente enheter: mer enn én er et salt eller en blanding. */
  enheter: number
  stereo: { definerte: number; udefinerte: number; definerte_bindinger: number; udefinerte_bindinger: number }
}

/** Øk når lesingen endres, så en endring i parseren ikke ser ut som en endring hos PubChem. */
export const PARSERVERSJON = 1

function tall(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN
  return Number.isFinite(n) ? n : null
}

function tekst(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

/**
 * Én rad i egenskapstabellen, eller hvorfor den ikke kan brukes. Felt OUSFAR
 * ikke viser, kan mangle; de som brukes i kontrollen og omregningen, må være
 * der med riktig form (strukturkontrollen).
 */
export function lesPubchemrad(rad: unknown): { data: Pubchemdata } | { avvik: string } {
  if (typeof rad !== 'object' || rad === null) return { avvik: 'raden er ikke et objekt' }
  const o = rad as Record<string, unknown>
  const cid = tall(o.CID)
  if (!cid || !Number.isInteger(cid)) return { avvik: 'CID mangler' }
  const formel = tekst(o.MolecularFormula)
  const molvekt = tekst(typeof o.MolecularWeight === 'number' ? String(o.MolecularWeight) : o.MolecularWeight)
  const inchikey = tekst(o.InChIKey)
  if (!formel) return { avvik: `CID ${cid}: MolecularFormula mangler` }
  if (!molvekt || !(Number(molvekt) > 0)) return { avvik: `CID ${cid}: MolecularWeight mangler eller er ikke et tall` }
  if (!inchikey || !INCHIKEY.test(inchikey)) return { avvik: `CID ${cid}: InChIKey mangler eller har feil form` }
  return {
    data: {
      cid,
      tittel: tekst(o.Title) ?? `CID ${cid}`,
      formel,
      molvekt,
      monoisotopisk_masse: tekst(typeof o.MonoisotopicMass === 'number' ? String(o.MonoisotopicMass) : o.MonoisotopicMass),
      inchikey,
      iupac: tekst(o.IUPACName),
      ladning: tall(o.Charge) ?? 0,
      enheter: tall(o.CovalentUnitCount) ?? 1,
      stereo: {
        definerte: tall(o.DefinedAtomStereoCount) ?? 0,
        udefinerte: tall(o.UndefinedAtomStereoCount) ?? 0,
        definerte_bindinger: tall(o.DefinedBondStereoCount) ?? 0,
        udefinerte_bindinger: tall(o.UndefinedBondStereoCount) ?? 0,
      },
    },
  }
}

/** Den første blokken i InChIKey: skjelettet uten stereokjemi og protonering. */
export function skjelett(inchikey: string): string {
  return inchikey.slice(0, 14)
}
