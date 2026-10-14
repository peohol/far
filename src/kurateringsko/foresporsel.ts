/**
 * Forespørselen til kurateringskøen, lest og kontrollert før køen endres.
 * Fila skrives av kuratoren og leses som data.
 */
import { JOBBGREN } from '../kuratorjobb/modell'
import { HANDLINGER, KOVERSJON, KURATERINGSPREFIKS, MODI, type Foresporsel, type Handling } from './modell'

export type Lest = { foresporsel: Foresporsel; feil?: undefined } | { foresporsel?: undefined; feil: string[] }

const erObjekt = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

const ID = /^[A-Za-z0-9][A-Za-z0-9._:+-]{0,79}$/
const DATO = /^\d{4}-\d{2}-\d{2}$/
export const KURATERINGSGREN = /^kuratering\/(?!.*\.\.)(?!.*\/\/)[A-Za-z0-9._-][A-Za-z0-9._/-]{0,99}$/

/** Høyst så mange tegn i de frie tekstene (grunn, fase). De står på en offentlig gren. */
export const MAKS_TEKST = 300

/** Feltene hver handling krever, og de den ellers tar. */
const FELTER: Record<Handling, { krever: readonly string[]; tar: readonly string[] }> = {
  status: { krever: [], tar: [] },
  forhandsvis: { krever: [], tar: ['stoff'] },
  reserver: { krever: [], tar: ['stoff'] },
  forny: { krever: ['oppgave'], tar: ['fase', 'jobbgren', 'kurateringsgren', 'pr'] },
  fullfort: { krever: ['oppgave', 'pr', 'kunnskapsgrense'], tar: ['modus', 'fase', 'jobbgren', 'kurateringsgren'] },
  feilet: { krever: ['oppgave', 'grunn'], tar: ['fase'] },
  blokkert: { krever: ['oppgave', 'grunn'], tar: ['fase'] },
  frigi: { krever: ['oppgave'], tar: ['grunn'] },
  tilbakestill: { krever: ['stoff', 'grunn'], tar: [] },
}

function gyldigDato(t: string): boolean {
  if (!DATO.test(t)) return false
  const d = new Date(`${t}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === t
}

/** En fri tekst uten kontrolltegn og med vanlige mellomrom. */
function renTekst(v: string): string {
  return v.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Forespørselen i JSON-teksten, eller hva som er galt med den. */
export function lesForesporsel(tekst: string): Lest {
  let data: unknown
  try {
    data = JSON.parse(tekst)
  } catch {
    return { feil: ['Forespørselen er ikke gyldig JSON.'] }
  }
  if (!erObjekt(data)) return { feil: ['Forespørselen må være et JSON-objekt.'] }
  const feil: string[] = []
  if (data.versjon !== KOVERSJON) feil.push(`versjon må være ${KOVERSJON}.`)
  if (typeof data.id !== 'string' || !ID.test(data.id)) feil.push('id må være en tekst på 1–80 tegn: bokstaver, tall og . _ : + -, ny for hver forespørsel.')
  const handling = data.handling as Handling
  if (!HANDLINGER.includes(handling)) {
    feil.push(`handling må være en av ${HANDLINGER.join(', ')}.`)
    return { feil }
  }
  const { krever, tar } = FELTER[handling]
  const lovlige = new Set(['versjon', 'id', 'handling', ...krever, ...tar])
  for (const n of Object.keys(data)) if (!lovlige.has(n)) feil.push(`Feltet ${n} hører ikke til handlingen ${handling}.`)
  for (const n of krever) if (data[n] === undefined || data[n] === null || data[n] === '') feil.push(`${handling} krever feltet ${n}.`)

  const ut: Foresporsel = { versjon: KOVERSJON, id: String(data.id), handling }
  const tekstfelt = (navn: 'stoff' | 'oppgave' | 'fase' | 'grunn', maks: number) => {
    const v = data[navn]
    if (v === undefined) return
    if (typeof v !== 'string' || !renTekst(v) || renTekst(v).length > maks) feil.push(`${navn} må være en tekst på høyst ${maks} tegn.`)
    else ut[navn] = renTekst(v)
  }
  tekstfelt('stoff', 80)
  tekstfelt('oppgave', 80)
  tekstfelt('fase', MAKS_TEKST)
  tekstfelt('grunn', MAKS_TEKST)

  if (data.jobbgren !== undefined) {
    if (typeof data.jobbgren !== 'string' || !JOBBGREN.test(data.jobbgren)) feil.push('jobbgren må være en jobbgren under kuratorjobb/.')
    else ut.jobbgren = data.jobbgren
  }
  if (data.kurateringsgren !== undefined) {
    if (typeof data.kurateringsgren !== 'string' || !KURATERINGSGREN.test(data.kurateringsgren)) feil.push(`kurateringsgren må være en gren under ${KURATERINGSPREFIKS}.`)
    else ut.kurateringsgren = data.kurateringsgren
  }
  if (data.pr !== undefined) {
    if (typeof data.pr !== 'number' || !Number.isInteger(data.pr) || data.pr < 1) feil.push('pr må være nummeret på PR-en, et positivt heltall.')
    else ut.pr = data.pr
  }
  if (data.kunnskapsgrense !== undefined) {
    if (typeof data.kunnskapsgrense !== 'string' || !gyldigDato(data.kunnskapsgrense)) feil.push('kunnskapsgrense må være en dato, ÅÅÅÅ-MM-DD.')
    else ut.kunnskapsgrense = data.kunnskapsgrense
  }
  if (data.modus !== undefined) {
    if (!MODI.includes(data.modus as never)) feil.push(`modus må være en av ${MODI.join(', ')}.`)
    else ut.modus = data.modus as Foresporsel['modus']
  }
  return feil.length > 0 ? { feil } : { foresporsel: ut }
}
