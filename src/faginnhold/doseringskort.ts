/**
 * Doseringen som kort: ett kort per avsnitt, med det som står foran det
 * første kolonet som etikett når avsnittet begynner slik — «Tablett: 5–30 mg»
 * blir kortet «Tablett» med «5–30 mg» som verdi.
 *
 * Det er bare presentasjon. Ingen ord endres, legges til eller tas bort:
 * etiketten er teksten foran kolonet, og verdien er resten av avsnittet med
 * formatering, lenker og referanser som før. Teksten er fri, så delingen
 * gjøres bare når den er entydig; ellers vises avsnittet helt som verdi, og
 * et dokument med annet enn avsnitt vises som vanlig tekst.
 */
import { NODER, type Riktekstnode } from './riktekst'

export interface Doseringskort {
  /** Teksten foran kolonet, eller `null` når avsnittet ikke begynner med en etikett. */
  etikett: string | null
  /** Resten av avsnittet, som innholdet i et avsnitt. */
  innhold: Riktekstnode[]
}

/** Lengste etikett som regnes som en etikett, og ikke som en setning med kolon i. */
const MAKS_ETIKETT = 40

/** «Tablett: 5–30 mg» → «Tablett» og «5–30 mg». Etiketten begynner med en bokstav og har ikke kolon eller tall i seg. */
const ETIKETT = new RegExp(String.raw`^(\p{L}[^:\d]{0,${MAKS_ETIKETT - 1}}):(?:\s+|$)([\s\S]*)$`, 'u')

function delAvsnitt(avsnitt: Riktekstnode): Doseringskort {
  const [forste, ...resten] = avsnitt.content ?? []
  const treff = forste?.type === NODER.tekst && !forste.marks?.length ? ETIKETT.exec(forste.text ?? '') : null
  if (!forste || !treff || (treff[2] === '' && resten.length === 0)) return { etikett: null, innhold: avsnitt.content ?? [] }
  const [, etikett = '', verdi = ''] = treff
  return { etikett: etikett.trim(), innhold: [...(verdi ? [{ ...forste, text: verdi }] : []), ...resten] }
}

/**
 * Kortene for doseringen, eller `null` når dokumentet har annet enn avsnitt
 * (lister, for eksempel) og skal vises som vanlig tekst. Tomme avsnitt hoppes over.
 */
export function doseringskort(dokument: Riktekstnode): Doseringskort[] | null {
  const blokker = (dokument.content ?? []).filter((b) => b.type !== NODER.avsnitt || (b.content ?? []).length > 0)
  if (blokker.length === 0 || blokker.some((b) => b.type !== NODER.avsnitt)) return null
  return blokker.map(delAvsnitt)
}
