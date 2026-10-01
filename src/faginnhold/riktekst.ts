/**
 * Rikteksten på stoffsidene: formen den lagres på, og det som kan
 * leses ut av den.
 *
 * Teksten lagres som et ProseMirror-dokument i JSON — samme form som editoren
 * (TipTap, som i Slaids) arbeider med, og samme form som referansesystemet
 * leter etter siteringer i. Formateringen er bevisst begrenset: fet, kursiv,
 * understreking, senket og hevet skrift, kode, overskrifter i to nivåer,
 * sitater, punktlister, nummererte lister, skillelinjer, lenker og
 * referanser.
 * Fontstørrelse, farger og justering finnes ikke; vanlig fritekst er
 * venstrejustert og ser lik ut overalt.
 *
 * Alt som leses fra databasen, går gjennom {@link rensDokument} før det vises.
 * Det som ikke er på lista over tillatte noder og merker, blir ikke vist som
 * formatering — teksten i det beholdes — og lenker må være nettadresser.
 */
import { SITERING } from './referanser'

export interface Tekstmerke {
  type: string
  attrs?: Record<string, unknown>
}

export interface Riktekstnode {
  type: string
  text?: string
  attrs?: Record<string, unknown>
  marks?: Tekstmerke[]
  content?: Riktekstnode[]
}

/** Et helt dokument: `{ type: 'doc', content: [...] }`. */
export interface Riktekstdokument extends Riktekstnode {
  type: 'doc'
}

/** Nodene som kan stå i en riktekst. Navnene er TipTaps. */
export const NODER = {
  dokument: 'doc',
  avsnitt: 'paragraph',
  overskrift: 'heading',
  skillelinje: 'horizontalRule',
  sitat: 'blockquote',
  tekst: 'text',
  linjeskift: 'hardBreak',
  punktliste: 'bulletList',
  nummerertListe: 'orderedList',
  listepunkt: 'listItem',
  sitering: SITERING,
} as const

/** Merkene tekst kan ha. Navnene er TipTaps. */
export const MERKER = {
  fet: 'bold',
  kursiv: 'italic',
  understreket: 'underline',
  senket: 'subscript',
  hevet: 'superscript',
  kode: 'code',
  lenke: 'link',
} as const

/** Overskriftsnivåene teksten kan ha: 1 er den største. */
export const OVERSKRIFTSNIVAER = [1, 2] as const
export type Overskriftsniva = (typeof OVERSKRIFTSNIVAER)[number]

/** Attributtet overskriftene vises med, så nivået kan leses tilbake og styles uansett element. */
export const OVERSKRIFTSATTRIBUTT = 'data-niva'

/**
 * Elementet en overskrift på `niva` vises som når teksten står under en
 * overskrift på nivå `over`: nivå 1 er ett nivå under den, så strukturen
 * henger sammen for skjermlesere.
 */
export function overskriftselement(over: number, niva: Overskriftsniva): `h${1 | 2 | 3 | 4 | 5 | 6}` {
  return `h${Math.min(Math.max(over, 0) + niva, 6) as 1 | 2 | 3 | 4 | 5 | 6}`
}

/** Overskriftsnivået i nodens `attrs`. Et dypere nivå enn de som finnes, blir det dypeste; noe ugyldig blir nivå 1. */
export function overskriftsniva(attrs: unknown): Overskriftsniva {
  const niva = Number(erObjekt(attrs) ? attrs.level : undefined)
  return OVERSKRIFTSNIVAER.filter((n) => n <= niva).pop() ?? OVERSKRIFTSNIVAER[0]
}

const TILLATTE_NODER = new Set<string>(Object.values(NODER))
const TILLATTE_MERKER = new Set<string>(Object.values(MERKER))

/** Nodene som inneholder blokker; tekst som havner rett i dem, pakkes i et avsnitt. */
const BLOKKBEHOLDERE = new Set<string>([NODER.dokument, NODER.listepunkt, NODER.sitat])
const LISTER = new Set<string>([NODER.punktliste, NODER.nummerertListe])

/** Et tomt dokument: ett tomt avsnitt, slik editoren lager det. */
export function tomtDokument(): Riktekstdokument {
  return { type: 'doc', content: [{ type: NODER.avsnitt }] }
}

/** Sant for en nettadresse lenker kan peke på. */
export function erTrygLenke(verdi: unknown): verdi is string {
  return typeof verdi === 'string' && /^https?:\/\/\S+$/i.test(verdi.trim())
}

function erObjekt(verdi: unknown): verdi is Record<string, unknown> {
  return typeof verdi === 'object' && verdi !== null && !Array.isArray(verdi)
}

function rensMerker(merker: unknown): Tekstmerke[] | undefined {
  if (!Array.isArray(merker)) return undefined
  const rensede = merker.flatMap((merke): Tekstmerke[] => {
    if (!erObjekt(merke) || typeof merke.type !== 'string' || !TILLATTE_MERKER.has(merke.type)) return []
    if (merke.type !== MERKER.lenke) return [{ type: merke.type }]
    const href = erObjekt(merke.attrs) ? merke.attrs.href : undefined
    return erTrygLenke(href) ? [{ type: MERKER.lenke, attrs: { href: href.trim() } }] : []
  })
  return rensede.length > 0 ? rensede : undefined
}

function siteringsider(attrs: unknown): string[] {
  const ider = erObjekt(attrs) ? attrs.referanser : undefined
  return Array.isArray(ider) ? [...new Set(ider.filter((id): id is string => typeof id === 'string'))] : []
}

/**
 * Nodene i `innhold`, renset. En node som ikke er tillatt, erstattes av
 * innholdet sitt, så teksten i den ikke går tapt.
 */
function rensInnhold(innhold: unknown): Riktekstnode[] {
  if (!Array.isArray(innhold)) return []
  return innhold.flatMap((node): Riktekstnode[] => {
    if (!erObjekt(node) || typeof node.type !== 'string') return []

    if (node.type === NODER.tekst) {
      if (typeof node.text !== 'string' || node.text === '') return []
      const marks = rensMerker(node.marks)
      return [{ type: NODER.tekst, text: node.text, ...(marks && { marks }) }]
    }
    if (node.type === NODER.sitering) {
      const referanser = siteringsider(node.attrs)
      return referanser.length > 0 ? [{ type: SITERING, attrs: { referanser } }] : []
    }
    if (node.type === NODER.linjeskift || node.type === NODER.skillelinje) return [{ type: node.type }]
    if (!TILLATTE_NODER.has(node.type) || node.type === NODER.dokument) return rensInnhold(node.content)

    const content = rensInnhold(node.content)
    if (LISTER.has(node.type)) {
      const punkter = content.filter((n) => n.type === NODER.listepunkt)
      return punkter.length > 0 ? [{ type: node.type, content: punkter }] : []
    }
    if (BLOKKBEHOLDERE.has(node.type)) return [{ type: node.type, content: blokker(content) }]
    // Et avsnitt og en overskrift inneholder bare tekstnivå.
    const tekstniva = content.flatMap((n) => (erTekstniva(n) ? [n] : (n.content ?? []).filter(erTekstniva)))
    return [
      {
        type: node.type,
        ...(node.type === NODER.overskrift && { attrs: { level: overskriftsniva(node.attrs) } }),
        ...(tekstniva.length > 0 && { content: tekstniva }),
      },
    ]
  })
}

function erTekstniva(node: Riktekstnode): boolean {
  return node.type === NODER.tekst || node.type === NODER.sitering || node.type === NODER.linjeskift
}

/** Blokker for en blokkbeholder: løs tekst samles i avsnitt, og beholderen er aldri tom. */
function blokker(innhold: Riktekstnode[]): Riktekstnode[] {
  const resultat: Riktekstnode[] = []
  let lose: Riktekstnode[] = []
  const tom = () => {
    if (lose.length > 0) resultat.push({ type: NODER.avsnitt, content: lose })
    lose = []
  }
  for (const node of innhold) {
    if (erTekstniva(node)) lose.push(node)
    else {
      tom()
      resultat.push(node)
    }
  }
  tom()
  return resultat.length > 0 ? resultat : [{ type: NODER.avsnitt }]
}

/**
 * Et dokument fra databasen eller editoren, renset til det som kan vises.
 * Alt som ikke er et dokument, blir et tomt dokument.
 */
export function rensDokument(verdi: unknown): Riktekstdokument {
  if (!erObjekt(verdi) || verdi.type !== NODER.dokument) return tomtDokument()
  return { type: 'doc', content: blokker(rensInnhold(verdi.content)) }
}

/** Sant når dokumentet verken har tekst eller siteringer. */
export function erTomt(dokument: Riktekstnode): boolean {
  if (dokument.type === NODER.tekst) return !dokument.text?.trim()
  if (dokument.type === NODER.sitering) return false
  return (dokument.content ?? []).every(erTomt)
}

/**
 * Teksten i dokumentet uten formatering, med blokkene på hver sin linje.
 * Siteringene er ikke tekst og utelates. Brukes av søket.
 */
export function klartekst(dokument: Riktekstnode): string {
  if (dokument.type === NODER.tekst) return dokument.text ?? ''
  if (dokument.type === NODER.linjeskift) return '\n'
  const deler = (dokument.content ?? []).map(klartekst)
  return BLOKKBEHOLDERE.has(dokument.type) || LISTER.has(dokument.type) ? deler.filter(Boolean).join('\n') : deler.join('')
}
