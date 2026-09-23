/**
 * Endringene redigeringen gjør på et regelsett, som rene funksjoner.
 *
 * Hver funksjon tar et regelsett og gir et nytt tilbake; ingenting endres på
 * stedet. De holder regelsettet sammenhengende slik databasen krever det (se
 * `docs/fortolkningsregler.md`): ett intervall mer enn skillepunktene, bare
 * kommentarer som brukes, og ringingen og ringegrensen i takt med
 * intervallene. Det databasen i tillegg kontrollerer, kontrolleres der.
 */
import { round } from '../domain/bands'
import { ringes } from '../domain/intervallregler'
import type { Level } from '../types'
import type { Intervallregel, Intervallregelsett, Regelkommentar } from './modell'

/** Lager ID-en til en ny kommentar. Sendes inn, så testene kan styre den. */
export type NyId = () => string

export const nyKommentarId: NyId = () => crypto.randomUUID()

/** Det minste steget konsentrasjonen oppgis i. */
export function steg(desimaler: number): number {
  return 10 ** -desimaler
}

/** Lista med `nye` satt inn i stedet for `antall` elementer fra `plass`. */
function skjot<T>(liste: readonly T[], plass: number, antall: number, ...nye: T[]): T[] {
  return [...liste.slice(0, plass), ...nye, ...liste.slice(plass + antall)]
}

/* --- Ringingen ----------------------------------------------------------- */

/**
 * Hvor «ring rekvirent» begynner: intervallet, og om ringegrensen er tallet
 * intervallet begynner på eller ett steg under (for regler som er «over
 * ringegrensen»).
 */
export interface Ringstart {
  indeks: number
  over: boolean
}

export function ringstart(regelsett: Intervallregelsett): Ringstart | null {
  const indeks = regelsett.intervaller.findIndex(ringes)
  if (indeks < 0) return null
  const fra = regelsett.skillepunkter[indeks - 1]
  return { indeks, over: regelsett.ringegrense !== null && fra !== undefined && regelsett.ringegrense !== fra }
}

/** Ringer fra og med intervallet i `start` og oppover, med ringegrensen som hører til. */
export function settRing(regelsett: Intervallregelsett, start: Ringstart | null): Intervallregelsett {
  const intervaller = regelsett.intervaller.map((regel, i): Intervallregel => {
    const ring = start !== null && i >= start.indeks
    return { ...regel, handling: ring ? 'ring_rekvirent' : ringes(regel) ? null : regel.handling }
  })
  const fra = start ? regelsett.skillepunkter[start.indeks - 1] : undefined
  const ringegrense =
    fra === undefined
      ? null
      : round(fra - (start?.over ? steg(regelsett.desimaler) : 0), regelsett.desimaler)
  return { ...regelsett, intervaller, ringegrense }
}

/**
 * Ringingen i `neste` gjort sammenhengende igjen etter en endring: fra det
 * første intervallet som ringer og oppover, med ringegrensen på samme side av
 * grensen som i `forrige`.
 */
function medRing(forrige: Intervallregelsett, neste: Intervallregelsett): Intervallregelsett {
  const start = ringstart(neste)
  return settRing(neste, start && { indeks: start.indeks, over: ringstart(forrige)?.over ?? false })
}

/* --- Kommentarene -------------------------------------------------------- */

/** ID-ene til kommentarene regelsettet bruker, i den rekkefølgen de brukes. */
export function brukteKommentarer(regelsett: Intervallregelsett): string[] {
  const ider = regelsett.intervaller.map((r) => r.kommentar)
  if (regelsett.cutoff) ider.push(regelsett.cutoff.kommentar, regelsett.cutoff.innledning)
  return [...new Set(ider)]
}

/**
 * Tar bort kommentarene ingen lenger bruker; databasen godtar dem ikke.
 *
 * Cut-off må bygge på en kommentar et intervall bruker. Har det intervallet
 * cut-off bygde på, fått en annen kommentar eller blitt slått sammen, følger
 * cut-off med til `erstatning` — kommentaren intervallet har nå.
 */
export function rydd(regelsett: Intervallregelsett, erstatning?: string): Intervallregelsett {
  const iIntervallene = new Set(regelsett.intervaller.map((r) => r.kommentar))
  const { cutoff } = regelsett
  const ryddet =
    cutoff && !iIntervallene.has(cutoff.kommentar)
      ? { ...regelsett, cutoff: { ...cutoff, kommentar: erstatning ?? regelsett.intervaller[0]!.kommentar } }
      : regelsett
  const brukt = new Set(brukteKommentarer(ryddet))
  return { ...ryddet, kommentarer: ryddet.kommentarer.filter((k) => brukt.has(k.id)) }
}

/**
 * En kommentar limes inn i laboratoriesystemet som den står, og er derfor én
 * linje ren tekst. Linjeskift og tabulatorer blir mellomrom alt mens det
 * skrives.
 */
export function somEnLinje(tekst: string): string {
  return tekst.replace(/[\u0000-\u001f\u007f]+/g, ' ')
}

export function settKommentartekst(regelsett: Intervallregelsett, id: string, tekst: string): Intervallregelsett {
  const ren = somEnLinje(tekst)
  return { ...regelsett, kommentarer: regelsett.kommentarer.map((k) => (k.id === id ? { ...k, tekst: ren } : k)) }
}

/** Intervallet får sin egen kommentar, med teksten det hadde, så den kan endres for seg. */
export function egenKommentar(regelsett: Intervallregelsett, indeks: number, nyId: NyId = nyKommentarId): Intervallregelsett {
  const regel = regelsett.intervaller[indeks]
  if (!regel) return regelsett
  const tekst = regelsett.kommentarer.find((k) => k.id === regel.kommentar)?.tekst ?? ''
  const ny: Regelkommentar = { id: nyId(), tekst }
  return rydd(
    {
      ...regelsett,
      intervaller: regelsett.intervaller.map((r, i) => (i === indeks ? { ...r, kommentar: ny.id } : r)),
      kommentarer: [...regelsett.kommentarer, ny],
    },
    ny.id,
  )
}

/** Intervallet bruker en kommentar regelsettet har fra før. */
export function brukKommentar(regelsett: Intervallregelsett, indeks: number, id: string): Intervallregelsett {
  return rydd(
    { ...regelsett, intervaller: regelsett.intervaller.map((r, i) => (i === indeks ? { ...r, kommentar: id } : r)) },
    id,
  )
}

/* --- Intervallene -------------------------------------------------------- */

export function settNiva(regelsett: Intervallregelsett, indeks: number, niva: Level): Intervallregelsett {
  return {
    ...regelsett,
    intervaller: regelsett.intervaller.map((r, i) => (i === indeks ? { ...r, niva } : r)),
  }
}

/**
 * Flytter ett skillepunkt. Det er grensen mellom to naboer, så begge endres
 * med det, og ringegrensen følger når den står ved det.
 */
export function settSkillepunkt(regelsett: Intervallregelsett, indeks: number, verdi: number): Intervallregelsett {
  const skillepunkter = regelsett.skillepunkter.map((s, i) => (i === indeks ? verdi : s))
  return medRing(regelsett, { ...regelsett, skillepunkter })
}

/** Feilen i en ny grense inne i intervallet, eller `null` når den kan brukes. */
export function kontrollerDeling(regelsett: Intervallregelsett, indeks: number, verdi: number): string | null {
  const fra = regelsett.skillepunkter[indeks - 1]
  const til = regelsett.skillepunkter[indeks]
  if (!Number.isFinite(verdi) || verdi <= 0) return 'Grensen må være et tall over null.'
  if (round(verdi, regelsett.desimaler) !== verdi) {
    return `Grensen kan ha høyst ${regelsett.desimaler} desimaler.`
  }
  if ((fra !== undefined && verdi <= fra) || (til !== undefined && verdi >= til)) {
    return 'Grensen må ligge inne i intervallet.'
  }
  return null
}

/**
 * Deler intervallet i to ved `verdi`. Begge halvdelene får regelen det hadde,
 * og deler kommentaren til den gis en egen.
 */
export function delIntervall(regelsett: Intervallregelsett, indeks: number, verdi: number): Intervallregelsett {
  const feil = kontrollerDeling(regelsett, indeks, verdi)
  if (feil) throw new Error(feil)
  const regel = regelsett.intervaller[indeks]!
  return medRing(regelsett, {
    ...regelsett,
    skillepunkter: skjot(regelsett.skillepunkter, indeks, 0, verdi),
    intervaller: skjot(regelsett.intervaller, indeks + 1, 0, { ...regel }),
  })
}

/**
 * Slår intervallet sammen med det over. Grensen mellom dem forsvinner, og det
 * sammenslåtte intervallet beholder regelen til det nederste.
 */
export function slaSammen(regelsett: Intervallregelsett, indeks: number): Intervallregelsett {
  if (indeks < 0 || indeks >= regelsett.skillepunkter.length) return regelsett
  return rydd(
    medRing(regelsett, {
      ...regelsett,
      skillepunkter: skjot(regelsett.skillepunkter, indeks, 1),
      intervaller: skjot(regelsett.intervaller, indeks + 1, 1),
    }),
    regelsett.intervaller[indeks]!.kommentar,
  )
}

export function settDesimaler(regelsett: Intervallregelsett, desimaler: number): Intervallregelsett {
  return medRing(regelsett, { ...regelsett, desimaler })
}

/* --- Cut-off ------------------------------------------------------------- */

/**
 * Slår «Til stede under cut-off» på eller av. Slås den på, får den en tom
 * innledning og kommentaren til det første intervallet innenfor
 * referanseområdet, slik dagens regler har det.
 */
export function settCutoff(regelsett: Intervallregelsett, pa: boolean, nyId: NyId = nyKommentarId): Intervallregelsett {
  if (!pa) return rydd({ ...regelsett, cutoff: null })
  if (regelsett.cutoff) return regelsett
  const grunnlag = regelsett.intervaller.find((r) => r.niva === 'innenfor') ?? regelsett.intervaller[0]!
  const innledning: Regelkommentar = { id: nyId(), tekst: '' }
  return {
    ...regelsett,
    cutoff: { innledning: innledning.id, kommentar: grunnlag.kommentar },
    kommentarer: [...regelsett.kommentarer, innledning],
  }
}

/** Kommentaren cut-off-innledningen settes foran. */
export function settCutoffKommentar(regelsett: Intervallregelsett, id: string): Intervallregelsett {
  if (!regelsett.cutoff) return regelsett
  return rydd({ ...regelsett, cutoff: { ...regelsett.cutoff, kommentar: id } })
}

/* --- Kontrollen før lagring ---------------------------------------------- */

/** Regelsettet slik det sendes: tekstene uten mellomrom i endene. */
export function klargjor(regelsett: Intervallregelsett): Intervallregelsett {
  return { ...regelsett, kommentarer: regelsett.kommentarer.map((k) => ({ ...k, tekst: k.tekst.trim() })) }
}

/** Det lengste en kommentar kan være, som i databasen. */
export const KOMMENTAR_MAKS = 4000

/**
 * Det som kan sies før regelsettet sendes: grensene og tekstene. Databasen
 * kontrollerer resten og svarer med en melding som kan vises. `null` når
 * ingenting er å utsette.
 */
export function kontrollerRegelsett(regelsett: Intervallregelsett): string | null {
  const { desimaler, skillepunkter } = regelsett
  if (!Number.isInteger(desimaler) || desimaler < 0 || desimaler > 6) return 'Desimalene må være et helt tall fra 0 til 6.'
  for (const [i, s] of skillepunkter.entries()) {
    if (!Number.isFinite(s) || s <= 0) return 'Grensene må være tall over null.'
    if (round(s, desimaler) !== s) return `Grensene kan ha høyst ${desimaler} desimaler.`
    if (i > 0 && s <= skillepunkter[i - 1]!) return 'Grensene må stige nedenfra og opp.'
  }
  for (const kommentar of regelsett.kommentarer) {
    if (!kommentar.tekst.trim()) return 'Alle kommentarene må ha tekst.'
    if (somEnLinje(kommentar.tekst) !== kommentar.tekst) return 'En kommentar må stå på én linje.'
    if (kommentar.tekst.trim().length > KOMMENTAR_MAKS) return `En kommentar kan ha høyst ${KOMMENTAR_MAKS} tegn.`
  }
  return null
}
