/**
 * Strukturkontrollen av svarene fra ClinPGx: et sikkerhetsnett mot at API-et
 * endrer formen på et objekt, så lesingen i `modell.ts` stille gir tomme felt
 * — et objekt skal ikke regnes som gyldig bare fordi ID-en fortsatt kan leses.
 *
 * Lesingen i `modell.ts` er med vilje tolerant: et felt som mangler, blir tomt.
 * Det er riktig for innhold som legitimt kan være tomt, men skjuler at et felt
 * har fått nytt navn eller ny form. Kontrollen her skiller derfor mellom
 *
 * - **feltet finnes, men er tomt**: en tom liste eller en tom tekst. Det
 *   godtas alltid;
 * - **feltet er borte eller har en helt annen type**: en liste som er blitt
 *   tekst, et objekt som er blitt en liste, `null` der ClinPGx sender en
 *   verdi, eller et felt ClinPGx alltid har sendt (også tomt), som ikke er
 *   der. Det er et avvik.
 *
 * Kravene gjelder bare felt OUSFAR leser, og bare de ClinPGx sender også når de
 * er tomme (sett i alle svarene fra 26.09.2026). Felt ClinPGx utelater når de er
 * tomme — sammendraget i en preparatomtale, testingen, rsID — er valgfrie: de
 * kan mangle eller være `null`, og bare typen kontrolleres når de har en verdi.
 * Ingen av feltene var `null` i noe svar 26.09.2026.
 *
 * Alt her er rene funksjoner.
 */
import { erObjekt, type Annotasjonstype } from './modell.js'

export type Strukturtype = 'kjemikalie' | Annotasjonstype

type Form = 'tekst' | 'liste' | 'objekt' | 'sannhet' | 'tall'

interface Krav {
  /** Feltet, med punktum for et felt i et objekt: `location.genes`. Et objekt som mangler, gjør feltene i det valgfrie. */
  sti: string
  form: Form | readonly Form[]
  /** Feltet kan mangle eller være `null`. Har det en verdi, må den ha formen. */
  valgfri?: boolean
  /** For en liste: feltene hvert element må ha (som tekst), eller `'tekst'` når elementene er tekster. */
  hver?: readonly string[] | 'tekst'
  /** For et objekt: minst ett av disse feltene må være tekst. */
  ettAv?: readonly string[]
}

const ANNOTASJONSGRUNNLAG: readonly Krav[] = [
  { sti: 'name', form: 'tekst' },
  { sti: 'source', form: 'tekst' },
  { sti: 'relatedGenes', form: 'liste', hver: ['id', 'symbol'] },
  { sti: 'relatedChemicals', form: 'liste', hver: ['id'] },
  { sti: 'literature', form: 'liste' },
  { sti: 'summaryMarkdown', form: 'objekt', valgfri: true, ettAv: ['html', 'markdown'] },
  // Flaggene for dosering, alternativ og annen veiledning er kliniske; de leses som «nei» når de mangler.
  { sti: 'dosingInformation', form: 'sannhet' },
  { sti: 'alternateDrugAvailable', form: 'sannhet' },
  { sti: 'otherPrescribingGuidance', form: 'sannhet' },
  { sti: 'pediatric', form: 'sannhet' },
]

/** Hva hvert objekt må ha. */
export const STRUKTURKRAV: Record<Strukturtype, readonly Krav[]> = {
  kjemikalie: [
    { sti: 'name', form: 'tekst' },
    { sti: 'types', form: 'liste', valgfri: true, hver: 'tekst' },
    { sti: 'linkOuts', form: 'liste', valgfri: true, hver: ['resource', 'resourceId'] },
  ],
  retningslinje: ANNOTASJONSGRUNNLAG,
  preparatomtale: [
    ...ANNOTASJONSGRUNNLAG,
    { sti: 'prescribingGenes', form: 'liste', hver: ['id', 'symbol'] },
    { sti: 'testing', form: 'objekt', valgfri: true, ettAv: ['term'] },
  ],
  klinisk: [
    { sti: 'accessionId', form: 'tekst' },
    { sti: 'name', form: 'tekst' },
    { sti: 'levelOfEvidence', form: 'objekt', ettAv: ['term'] },
    { sti: 'location', form: 'objekt', ettAv: ['displayName', 'name'] },
    { sti: 'location.genes', form: 'liste', hver: ['id', 'symbol'] },
    { sti: 'location.rsid', form: 'tekst', valgfri: true },
    { sti: 'types', form: 'liste', hver: 'tekst' },
    { sti: 'allelePhenotypes', form: 'liste', hver: ['allele', 'phenotype'] },
    { sti: 'relatedChemicals', form: 'liste', hver: ['id'] },
    { sti: 'relatedDiseases', form: 'liste', hver: ['name'] },
    { sti: 'relatedGuidelines', form: 'liste', hver: ['id'] },
    { sti: 'relatedLabels', form: 'liste', hver: ['id'] },
    { sti: 'score', form: ['tall', 'tekst'], valgfri: true },
  ],
}

const FORMNAVN: Record<Form, string> = {
  tekst: 'tekst',
  liste: 'liste',
  objekt: 'objekt',
  sannhet: 'sann/usann',
  tall: 'tall',
}

function formen(verdi: unknown): Form | null {
  if (typeof verdi === 'string') return 'tekst'
  if (Array.isArray(verdi)) return 'liste'
  if (erObjekt(verdi)) return 'objekt'
  if (typeof verdi === 'boolean') return 'sannhet'
  if (typeof verdi === 'number') return 'tall'
  return null
}

function beskriv(verdi: unknown): string {
  if (verdi === undefined) return 'mangler'
  if (verdi === null) return 'er tomt (null)'
  const form = formen(verdi)
  return form ? `er ${FORMNAVN[form]}` : `er ${typeof verdi}`
}

/** Om et element i en liste har feltene som tekst (tomme godtas). */
function elementOk(element: unknown, hver: Krav['hver']): boolean {
  if (hver === undefined) return true
  if (hver === 'tekst') return typeof element === 'string'
  return erObjekt(element) && hver.every((f) => typeof element[f] === 'string')
}

/**
 * Avvikene i formen på ett objekt fra ClinPGx, som korte tekster:
 * «relatedGenes er tekst, ventet liste». Tom liste når formen er som ventet.
 */
export function strukturavvik(type: Strukturtype, objekt: unknown): string[] {
  if (!erObjekt(objekt)) return [`${beskriv(objekt)}, ventet objekt`]
  const avvik: string[] = []
  for (const krav of STRUKTURKRAV[type]) {
    const deler = krav.sti.split('.')
    const forelder = deler.slice(0, -1).reduce<unknown>((o, d) => (erObjekt(o) ? o[d] : undefined), objekt)
    // Et objekt som mangler eller har feil form, er et avvik for seg; feltene i det kontrolleres ikke.
    if (!erObjekt(forelder)) continue
    const verdi = forelder[deler.at(-1)!]
    const former: readonly Form[] = typeof krav.form === 'string' ? [krav.form] : krav.form
    const ventet = former.map((f) => FORMNAVN[f]).join(' eller ')
    if (krav.valgfri && (verdi === undefined || verdi === null)) continue
    const form = formen(verdi)
    if (!form || !former.includes(form)) {
      avvik.push(`${krav.sti} ${beskriv(verdi)}, ventet ${ventet}`)
      continue
    }
    if (form === 'liste' && krav.hver && !(verdi as unknown[]).every((e) => elementOk(e, krav.hver))) {
      const felt = krav.hver === 'tekst' ? 'tekster' : `objekter med ${krav.hver.join(' og ')}`
      avvik.push(`${krav.sti} har elementer som ikke er ${felt}`)
    }
    if (form === 'objekt' && krav.ettAv && !krav.ettAv.some((f) => typeof (verdi as Record<string, unknown>)[f] === 'string')) {
      avvik.push(`${krav.sti} mangler ${krav.ettAv.join(' eller ')}`)
    }
  }
  return avvik
}

/** Én linje for loggen om objektene som har feil form; de tre første står med navn. */
export function strukturfeiltekst(avvik: readonly { type: Strukturtype; id: string; avvik: readonly string[] }[]): string {
  const TYPENAVN: Record<Strukturtype, string> = {
    kjemikalie: 'kjemikaliet',
    retningslinje: 'retningslinjen',
    preparatomtale: 'preparatomtalen',
    klinisk: 'den kliniske annotasjonen',
  }
  const vist = avvik.slice(0, 3).map((a) => `${TYPENAVN[a.type]} ${a.id}: ${a.avvik.join(', ')}`)
  const resten = avvik.length > 3 ? ` (og ${avvik.length - 3} til)` : ''
  return (
    `Svaret fra ClinPGx har trolig endret form: ${vist.join('; ')}${resten}. ` +
    'Kjemikaliet er ikke byttet inn; dataene fra før står.'
  )
}
