/**
 * Det som tas vare på gjennom en oppdatering til en ny versjon av appen.
 *
 * Når brukeren trykker «Oppdater nå» (`Oppdateringsmelding`), lastes siden på
 * nytt. Adressen tar vare på hvilken side som står oppe, men ikke vinduene som
 * står åpne over den, skjemaene som er halvveis skrevet eller hvor langt ned
 * man har rullet. Det tas vare på her:
 *
 * - Tilstanden appen ønsker å beholde, er registrert under en nøkkel mens den
 *   lever (`useBevart`). Rett før siden lastes på nytt, skrives verdiene sammen
 *   med rulleplassene til `sessionStorage`, som bare fanen selv kan lese.
 * - Når den nye versjonen starter, leses bildet og slettes med én gang. Hver
 *   verdi kan hentes én gang, av den første som ber om nøkkelen, og bare en
 *   kort stund etter oppstarten, så et gammelt utkast ikke dukker opp igjen
 *   langt senere.
 *
 * - Bildet hører til brukeren som var logget inn da det ble tatt. Er en annen
 *   logget inn når den nye versjonen starter — fordi økten gikk ut og noen
 *   andre logget inn i den samme fanen — kastes det, så ingen får se eller
 *   lagre det en annen holdt på med.
 *
 * Bare det som tåler JSON (tall, tekst, lister og vanlige objekter) tas vare
 * på. En verdi som ikke gjør det, som et `Map`, må få en egen form
 * (`Bevaringsform`), ellers blir den stående igjen i stedet for å komme
 * tilbake ødelagt.
 */

/** Nøkkelen bildet står under i `sessionStorage`. */
export const LAGRINGSNOKKEL = 'ousfar.oppdatering'

/** Hvor lenge etter oppstarten en bevart verdi kan hentes. Innholdet hentes på nytt, og det kan ta litt tid. */
export const GYLDIG_I = 2 * 60_000

/** Et bilde som er eldre enn dette, er ikke fra en oppdatering, og brukes ikke. */
const FORELDET_ETTER = 5 * 60_000

/** Hvor langt ned et lag var rullet: vinduet selv, eller kroppen i et modalt lag (etter tittelen). */
export interface Rulleplass {
  lag: string | null
  topp: number
}

export interface Oppdateringsbilde {
  /** Når bildet ble tatt, i millisekunder. */
  tatt: number
  /** Brukeren som var logget inn, eller `null` uten innlogging. */
  eier: string | null
  verdier: Record<string, unknown>
  rulling: Rulleplass[]
}

/** Den levende tilstanden: nøkkelen og veien til verdien slik den er nå. */
const levende = new Map<string, () => unknown>()

/** Brukeren som er logget inn nå, satt av `Bevaringseier`. */
let eier: string | null = null

/** Setter brukeren den levende tilstanden hører til, og gir tilbake nullstillingen. */
export function settEier(id: string | null): () => void {
  eier = id
  return () => {
    if (eier === id) eier = null
  }
}

/**
 * Registrerer en verdi som skal tas vare på, og gir tilbake avregistreringen.
 * Registrerer to under samme nøkkel, gjelder den siste.
 */
export function registrer(nokkel: string, hent: () => unknown): () => void {
  levende.set(nokkel, hent)
  return () => {
    if (levende.get(nokkel) === hent) levende.delete(nokkel)
  }
}

/** Sant for det JSON gir tilbake uendret: tekst, tall, sannhetsverdier, `null`, lister og vanlige objekter. */
function erRenData(verdi: unknown): boolean {
  if (verdi === null) return true
  switch (typeof verdi) {
    case 'string':
    case 'boolean':
      return true
    case 'number':
      return Number.isFinite(verdi)
    case 'object': {
      if (Array.isArray(verdi)) return verdi.every(erRenData)
      const prototype = Object.getPrototypeOf(verdi)
      if (prototype !== Object.prototype && prototype !== null) return false
      return Object.values(verdi as Record<string, unknown>).every((v) => v === undefined || erRenData(v))
    }
    default:
      return false
  }
}

/** Kroppen i de modale lagene som står åpne, med tittelen de kjennes igjen på. */
function modaleLag(): { tittel: string; kropp: HTMLElement }[] {
  return [...document.querySelectorAll<HTMLDialogElement>('dialog[open]')].flatMap((lag) => {
    const kropp = lag.querySelector<HTMLElement>('.modallag__kropp')
    const tittel = lag.querySelector('.modallag__tittel')?.textContent?.trim()
    return kropp && tittel ? [{ tittel, kropp }] : []
  })
}

/** Tar bildet av det som skal tas vare på, slik det står nå. */
export function taBilde(): Oppdateringsbilde {
  const verdier: Record<string, unknown> = {}
  for (const [nokkel, hent] of levende) {
    try {
      const verdi = hent()
      if (erRenData(verdi)) verdier[nokkel] = verdi
    } catch {
      // En verdi som ikke lar seg lese, blir stående igjen. Resten tas vare på.
    }
  }
  const rulling: Rulleplass[] = [{ lag: null, topp: window.scrollY }]
  for (const { tittel, kropp } of modaleLag()) rulling.push({ lag: tittel, topp: kropp.scrollTop })
  return { tatt: Date.now(), eier, verdier, rulling: rulling.filter((r) => r.topp > 0) }
}

/** Tar bildet, legger det i fanen og laster siden på nytt, med den nye versjonen. */
export function oppdaterOgTaVare(lastInn: () => void = () => window.location.reload()): void {
  try {
    sessionStorage.setItem(LAGRINGSNOKKEL, JSON.stringify(taBilde()))
  } catch {
    // Uten lagring i fanen oppdateres det likevel; det er viktigere enn å huske.
  }
  lastInn()
}

/* --- Etter oppdateringen -------------------------------------------------- */

interface Gjenopprettet {
  eier: string | null
  verdier: Map<string, unknown>
  rulling: Rulleplass[]
  /** Når bildet ble lest, altså når den nye versjonen startet. */
  lest: number
}

let gjenopprettet: Gjenopprettet | null = null

/** Leser bildet fanen fikk før oppdateringen, én gang, og sletter det straks. */
function lesBildet(): Gjenopprettet {
  if (gjenopprettet) return gjenopprettet
  gjenopprettet = { eier: null, verdier: new Map(), rulling: [], lest: Date.now() }
  try {
    const tekst = sessionStorage.getItem(LAGRINGSNOKKEL)
    sessionStorage.removeItem(LAGRINGSNOKKEL)
    if (!tekst) return gjenopprettet
    const bilde = JSON.parse(tekst) as Partial<Oppdateringsbilde>
    if (typeof bilde.tatt !== 'number' || Date.now() - bilde.tatt > FORELDET_ETTER) return gjenopprettet
    gjenopprettet.eier = typeof bilde.eier === 'string' ? bilde.eier : null
    gjenopprettet.verdier = new Map(Object.entries(bilde.verdier ?? {}))
    gjenopprettet.rulling = Array.isArray(bilde.rulling) ? bilde.rulling : []
  } catch {
    // Et ødelagt bilde betyr bare at ingenting gjenopprettes.
  }
  return gjenopprettet
}

/** Om bildet fortsatt kan brukes. */
function gyldig(bilde: Gjenopprettet): boolean {
  return Date.now() - bilde.lest <= GYLDIG_I
}

/**
 * Bildet, når det hører til brukeren som er logget inn (`hvem`). Er det en
 * annen, kastes hele bildet — verdiene og rulleplassene — så ingenting av det
 * kommer tilbake, heller ikke om den første brukeren logger inn igjen.
 */
function bildetTil(hvem: string | null): Gjenopprettet {
  const bilde = lesBildet()
  if (bilde.eier !== hvem) {
    bilde.verdier.clear()
    bilde.rulling = []
  }
  return bilde
}

/**
 * Verdien som ble tatt vare på under nøkkelen for brukeren som er logget inn
 * (`hvem`), uten å hente den ut. `undefined` når det ikke er noen.
 */
export function sePaBevart(nokkel: string, hvem: string | null): { verdi: unknown } | undefined {
  const bilde = bildetTil(hvem)
  if (!gyldig(bilde) || !bilde.verdier.has(nokkel)) return undefined
  return { verdi: bilde.verdier.get(nokkel) }
}

/** Henter verdien ut, så den ikke kommer tilbake en gang til. */
export function hentUtBevart(nokkel: string): void {
  lesBildet().verdier.delete(nokkel)
}

/** Hvor mange forsøk på rad en rulleplass må ha stått, før den regnes som på plass. */
const STABIL_ETTER = 3

/**
 * Ruller vinduet og de modale lagene dit de sto, etter hvert som innholdet er
 * hentet og siden har blitt lang nok. En side som selv ruller til toppen når
 * den åpnes, rulles tilbake igjen: plassen må ha stått noen forsøk på rad før
 * den er ferdig. Gir opp når brukeren selv ruller, klikker eller skriver, eller
 * når tiden er ute. Kalles når det er avklart hvem som er logget inn (`hvem`),
 * og ruller bare for den som tok bildet. Gjør ingenting etter første gang.
 */
export function gjenopprettRulling(hvem: string | null): () => void {
  const bilde = bildetTil(hvem)
  let igjen = bilde.rulling.map((plass) => ({ ...plass, stabil: 0 }))
  bilde.rulling = []
  if (igjen.length === 0) return () => undefined

  const hendelser = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const
  const stopp = () => {
    window.clearInterval(forsok)
    for (const h of hendelser) window.removeEventListener(h, stopp, true)
  }
  const prov = () => {
    if (!gyldig(bilde)) return stopp()
    const lag = modaleLag()
    igjen = igjen.filter((plass) => {
      const element = plass.lag === null ? document.scrollingElement : lag.find((l) => l.tittel === plass.lag)?.kropp
      if (!element || element.scrollHeight - element.clientHeight < plass.topp) return true
      if (Math.abs(element.scrollTop - plass.topp) < 2) plass.stabil += 1
      else {
        element.scrollTop = plass.topp
        plass.stabil = 0
      }
      return plass.stabil < STABIL_ETTER
    })
    if (igjen.length === 0) stopp()
  }
  const forsok = window.setInterval(prov, 150)
  for (const h of hendelser) window.addEventListener(h, stopp, { capture: true, passive: true })
  prov()
  return stopp
}

/** Bare for testene: glemmer bildet, så det leses på nytt. */
export function glemBildet(): void {
  gjenopprettet = null
  eier = null
  levende.clear()
}
