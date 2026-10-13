/**
 * Forespørselen til en kuratorjobb, lest og kontrollert før noe kjøres. Fila
 * skrives av kuratoren og leses som data; ingenting i den kjøres eller slås
 * opp utenfor det som står her.
 */
import {
  KURATORJOBBVERSJON,
  OPPGAVER,
  SPCGRENSER,
  type Foresporsel,
  type Oppgave,
} from './modell'
import { erDmpAdresse } from './spc'

export type Lest = { foresporsel: Foresporsel; feil?: undefined } | { foresporsel?: undefined; feil: string[] }

const erObjekt = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Flest stoffer én jobb tar med navn. `alle` er ikke begrenset. */
export const MAKS_STOFFER = 25

function heltall(v: unknown, navn: string, grenser: { standard: number; min: number; max: number }, feil: string[]) {
  if (v === undefined) return grenser.standard
  if (typeof v !== 'number' || !Number.isInteger(v) || v < grenser.min || v > grenser.max) {
    feil.push(`${navn} må være et heltall fra ${grenser.min} til ${grenser.max}.`)
    return grenser.standard
  }
  return v
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

  const kjente = new Set(['versjon', 'stoffer', 'oppgaver', 'spc', 'referanse'])
  for (const n of Object.keys(data)) if (!kjente.has(n)) feil.push(`Ukjent felt: ${n}.`)

  if (data.versjon !== KURATORJOBBVERSJON) feil.push(`versjon må være ${KURATORJOBBVERSJON}.`)

  let stoffer: Foresporsel['stoffer'] = []
  if (data.stoffer === 'alle') stoffer = 'alle'
  else if (Array.isArray(data.stoffer) && data.stoffer.length > 0 && data.stoffer.every((s) => typeof s === 'string' && s.trim())) {
    stoffer = [...new Set((data.stoffer as string[]).map((s) => s.trim()))]
    if (stoffer.length > MAKS_STOFFER) feil.push(`Høyst ${MAKS_STOFFER} stoffer per jobb, eller "alle".`)
  } else feil.push('stoffer må være en ikke-tom liste med stoffnøkler, eller "alle".')

  let oppgaver: Oppgave[] = [...OPPGAVER]
  if (data.oppgaver !== undefined) {
    const liste = Array.isArray(data.oppgaver) ? data.oppgaver : []
    const ukjente = liste.filter((o) => !(OPPGAVER as readonly unknown[]).includes(o))
    if (liste.length === 0 || ukjente.length > 0) feil.push(`oppgaver må være en ikke-tom liste med ${OPPGAVER.join(' og/eller ')}.`)
    else oppgaver = OPPGAVER.filter((o) => liste.includes(o))
  }
  if (stoffer === 'alle' && oppgaver.includes('spc')) {
    feil.push('"alle" gjelder bare funksjonstesten; preparatomtalene hentes for stoffer med navn.')
  }

  let spc: Foresporsel['spc']
  if (data.spc !== undefined) {
    if (!erObjekt(data.spc)) feil.push('spc må være et objekt.')
    else {
      const s = data.spc
      for (const n of Object.keys(s)) if (!['adresser', 'maks', 'dpi'].includes(n)) feil.push(`Ukjent felt: spc.${n}.`)
      let adresser: string[] | undefined
      if (s.adresser !== undefined) {
        if (!Array.isArray(s.adresser) || s.adresser.length === 0 || !s.adresser.every((a) => typeof a === 'string')) {
          feil.push('spc.adresser må være en ikke-tom liste med adresser.')
        } else {
          adresser = [...new Set((s.adresser as string[]).map((a) => a.trim()))]
          for (const a of adresser) if (!erDmpAdresse(a)) feil.push(`Ikke en adresse til en preparatomtale hos DMP: ${a}`)
        }
      }
      spc = {
        ...(adresser ? { adresser } : {}),
        maks: heltall(s.maks, 'spc.maks', SPCGRENSER.maks, feil),
        dpi: heltall(s.dpi, 'spc.dpi', SPCGRENSER.dpi, feil),
      }
    }
  }

  let referanse: string | undefined
  if (data.referanse !== undefined) {
    if (typeof data.referanse !== 'string' || data.referanse.length > 200) feil.push('referanse må være en tekst på høyst 200 tegn.')
    else referanse = data.referanse
  }

  if (feil.length > 0) return { feil }
  return {
    foresporsel: {
      versjon: KURATORJOBBVERSJON,
      stoffer,
      oppgaver,
      ...(spc ? { spc } : {}),
      ...(referanse !== undefined ? { referanse } : {}),
    },
  }
}

/**
 * Forespørselen fra feltene i en jobb som startes for hånd i GitHub:
 * stoffene og oppgavene som kommaseparerte lister.
 */
export function foresporselFraFelter(stoffer: string, oppgaver: string): string {
  const liste = (t: string) => t.split(',').map((s) => s.trim()).filter(Boolean)
  const s = stoffer.trim() === 'alle' ? 'alle' : liste(stoffer)
  return JSON.stringify({ versjon: KURATORJOBBVERSJON, stoffer: s, oppgaver: liste(oppgaver) }, null, 2)
}
