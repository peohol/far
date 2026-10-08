/**
 * De kjemiske forbindelsene OUSFAR kjenner: stoffene fagsidene handler om og
 * metabolittene laboratoriene måler, hver med de verifiserte koblingene til
 * de eksterne kildene (`docs/kjemi.md`).
 *
 * En forbindelse er ikke en fagside. Fagsidene (`stoffregister.json`) er
 * virkestoff og rusmidler; en forbindelse er det kjemiske stoffet en analyse
 * faktisk måler, med sin egen molekylvekt. Flere forbindelser kan høre til
 * samme fagside (citalopram og desmetylcitalopram), og én forbindelse kan
 * høre til flere (nortriptylin er eget stoff og metabolitt av amitriptylin).
 *
 * Koblingene står i `src/data/forbindelser.ts` og endres bare der, i en
 * PR: synkroniseringene leser dem og legger aldri til noe selv. En kobling til
 * PubChem er tatt med bare når den er kontrollert mot en uavhengig kilde
 * (`scripts/kurer-forbindelser.ts`); en forbindelse uten verifisert kobling
 * har `uavklart` med grunnen og kandidatene.
 */
import { FORBINDELSESDATA } from '../data/forbindelser.js'

/** Hva forbindelsen er for stoffet på fagsiden. */
export type Forbindelsesrelasjon = 'selve_stoffet' | 'metabolitt'

/**
 * Formen laboratoriene oppgir konsentrasjonen for: den frie forbindelsen
 * (base, syre eller nøytral), et ion (litium) eller et salt. Molekylvekten
 * som brukes i omregningen, er alltid formens — aldri saltet legemiddelet
 * selges som.
 */
export type Forbindelsesform = 'fri' | 'ion' | 'salt'

export interface Stoffkobling {
  stoff: string
  relasjon: Forbindelsesrelasjon
}

/** En kontrollert kobling til PubChem. */
export interface Pubchemkobling {
  cid: number
  /** InChIKey-en PubChem hadde ved kontrollen. Synkroniseringen godtar bare den samme. */
  inchikey: string
  /** Molekylformelen ved kontrollen. */
  formel: string
  /** Datoen koblingen ble kontrollert (ÅÅÅÅ-MM-DD). */
  kontrollert: string
  /** Hva koblingen bygger på, i en setning. */
  grunnlag: string
}

export interface Uavklart {
  grunn: string
  /** CID-ene som kunne passe. */
  kandidater: number[]
}

export interface Forbindelse {
  /** Fast nøkkel, små bokstaver: «desmetylcitalopram». */
  nokkel: string
  navn: string
  /** Navnet i PubChem og de engelske kildene. */
  engelsk: string
  /** Andre engelske navn de uavhengige kildene kan bruke (ChEBI: «desmethyldoxepin»). Brukes bare i kontrollen. */
  synonymer?: string[]
  stoffer: Stoffkobling[]
  form: Forbindelsesform
  merknad?: string
  pubchem?: Pubchemkobling
  uavklart?: Uavklart
}

export const FORBINDELSESRELASJONER: readonly Forbindelsesrelasjon[] = ['selve_stoffet', 'metabolitt']
export const FORBINDELSESFORMER: readonly Forbindelsesform[] = ['fri', 'ion', 'salt']

export const INCHIKEY = /^[A-Z]{14}-[A-Z]{10}-[A-Z]$/
const NOKKEL = /^[a-z0-9][a-z0-9-]*$/

export interface Forbindelsesregister {
  alle: readonly Forbindelse[]
  finn(nokkel: string): Forbindelse | undefined
  /** Forbindelsene som hører til et stoff, selve stoffet først, så metabolittene alfabetisk. */
  forStoff(stoff: string): Forbindelse[]
  /** Forbindelsene med verifisert kobling til PubChem. */
  medPubchem(): (Forbindelse & { pubchem: Pubchemkobling })[]
}

export function byggForbindelsesregister(forbindelser: readonly Forbindelse[]): Forbindelsesregister {
  const perNokkel = new Map(forbindelser.map((f) => [f.nokkel, f]))
  return {
    alle: forbindelser,
    finn: (nokkel) => perNokkel.get(nokkel),
    forStoff: (stoff) =>
      forbindelser
        .flatMap((f) => f.stoffer.filter((s) => s.stoff === stoff).map((s) => ({ f, s })))
        .sort(
          (a, b) =>
            Number(a.s.relasjon !== 'selve_stoffet') - Number(b.s.relasjon !== 'selve_stoffet') ||
            a.f.navn.localeCompare(b.f.navn, 'nb'),
        )
        .map(({ f }) => f),
    medPubchem: () => forbindelser.filter((f): f is Forbindelse & { pubchem: Pubchemkobling } => Boolean(f.pubchem)),
  }
}

/**
 * Feilene i registeret: ukjente stoffer, nøkler som går igjen, en CID brukt
 * av to forbindelser, en kobling uten grunnlag, eller en forbindelse som
 * verken er koblet eller sier hvorfor ikke. Tom når alt stemmer. Kjøres av
 * testene.
 */
export function kontrollerForbindelser(forbindelser: readonly Forbindelse[], stoffer: ReadonlySet<string>): string[] {
  const feil: string[] = []
  const nokler = new Set<string>()
  const cider = new Map<number, string>()
  for (const f of forbindelser) {
    if (!NOKKEL.test(f.nokkel)) feil.push(`${f.nokkel}: ugyldig nøkkel`)
    if (nokler.has(f.nokkel)) feil.push(`${f.nokkel}: står to ganger`)
    nokler.add(f.nokkel)
    if (!f.navn.trim() || !f.engelsk.trim()) feil.push(`${f.nokkel}: mangler navn`)
    if (!FORBINDELSESFORMER.includes(f.form)) feil.push(`${f.nokkel}: ukjent form ${f.form}`)
    if (f.stoffer.length === 0) feil.push(`${f.nokkel}: hører ikke til noe stoff`)
    for (const s of f.stoffer) {
      if (!stoffer.has(s.stoff)) feil.push(`${f.nokkel}: ukjent stoff ${s.stoff}`)
      if (!FORBINDELSESRELASJONER.includes(s.relasjon)) feil.push(`${f.nokkel}: ukjent relasjon ${s.relasjon}`)
    }
    if (f.pubchem && f.uavklart) feil.push(`${f.nokkel}: både koblet og uavklart`)
    if (!f.pubchem && !f.uavklart) feil.push(`${f.nokkel}: verken koblet til PubChem eller merket uavklart`)
    if (f.pubchem) {
      const { cid, inchikey, formel, kontrollert, grunnlag } = f.pubchem
      if (!Number.isInteger(cid) || cid <= 0) feil.push(`${f.nokkel}: ugyldig CID`)
      const forrige = cider.get(cid)
      if (forrige) feil.push(`${f.nokkel}: CID ${cid} er også brukt av ${forrige}`)
      cider.set(cid, f.nokkel)
      if (!INCHIKEY.test(inchikey)) feil.push(`${f.nokkel}: ugyldig InChIKey`)
      if (!formel.trim() || formel.includes('.')) feil.push(`${f.nokkel}: ugyldig formel`)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(kontrollert)) feil.push(`${f.nokkel}: kontrolldatoen mangler`)
      if (!grunnlag.trim()) feil.push(`${f.nokkel}: grunnlaget mangler`)
    }
    if (f.uavklart && !f.uavklart.grunn.trim()) feil.push(`${f.nokkel}: uavklart uten grunn`)
  }
  return feil
}

/** Forbindelsene i datafilen. */
export const FORBINDELSER = byggForbindelsesregister(FORBINDELSESDATA)
