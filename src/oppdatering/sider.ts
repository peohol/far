/**
 * Hvilke sider en ny versjon berører, og når appen kan ta den i bruk uten å
 * spørre.
 *
 * Hver føring i endringsloggen sier hvilke sider den gjelder (`gjelder`, se
 * `docs/endringslogg.md`). Et område er en side slik den står i adressen, uten
 * `#/` og uten seksjonen på siden — `fortolkning/thc`, `stoff/bupropion`,
 * `stoffregister` — og gjelder også sidene under den: `fortolkning` er hele
 * fortolkningen, `stoff` alle fagsidene og `fortolkning/thc` både fortolkningen
 * av THC-syre og redigeringen av den. `*` står for et hvilket som helst ledd,
 * som i `fortolkning/*\/rediger`. I tillegg finnes {@link VINDUER}, for
 * vinduene som åpnes over en side, og {@link HELE_APPEN}.
 *
 * Meldingen om en ny versjon (`Oppdateringsmelding`) står bare når en av de
 * nye føringene berører siden brukeren er på. Ellers tas den nye versjonen i
 * bruk i stillhet i neste rolige øyeblikk: når brukeren går til en annen side
 * eller nullstiller fortolkningen, og ikke gjør noe mer i et lite øyeblikk
 * etterpå. Da er det ingenting å miste.
 *
 * Fila ligger utenfor innloggingsveggen, sammen med meldingen, og vet ikke
 * noe om innholdet i sidene.
 */
import type { Rute } from '../domain/rute'

/** Området for en endring som berører alle sider, som toppmenyen eller noe felles. */
export const HELE_APPEN = 'hele appen'

/**
 * Området for vinduene som åpnes over sidene (`dialog`), som idéene og
 * varslene. Sidemenyen og diskusjonene står ved siden av sidene og hører til
 * {@link HELE_APPEN}.
 */
export const VINDUER = 'vinduer'

/** Et ledd i et område som står for hvilket som helst ledd. */
export const ETHVERT_LEDD = '*'

export type Sideomrade = typeof HELE_APPEN | typeof VINDUER | Rute['side'] | `${Rute['side']}/${string}`

/** Det `versjon.json` sier om hver av de nyeste føringene som varsles. */
export interface Endringsomrade {
  versjon: string
  /** Mangler når føringen ikke sier hvilke sider den gjelder; da kan den gjelde alle. */
  gjelder?: readonly string[]
}

/**
 * Om området berører siden brukeren er på (`side`, som `fortolkning/thc`),
 * eller vinduet som står åpent over den. Uten en side — på innloggingssiden —
 * berøres den bare av en endring i hele appen.
 */
export function berorer(omrade: string, side: string | null, vinduApent: boolean): boolean {
  if (omrade === HELE_APPEN) return true
  if (omrade === VINDUER) return vinduApent
  if (side === null) return false
  const ledd = side.split('/')
  return omrade.split('/').every((del, i) => i < ledd.length && (del === ETHVERT_LEDD || del === ledd[i]))
}

/**
 * Om brukeren må bes om å oppdatere til den utlagte versjonen nå: når en av
 * føringene som er kommet til siden versjonen som kjører (`kjorer`), berører
 * siden eller vinduet, eller når det ikke lar seg avgjøre — fila sier ikke
 * hvilke sider føringene gjelder, en føring sier det ikke, versjonen som
 * kjører er for gammel til å stå i lista, eller den er trukket tilbake.
 *
 * Lista står nyest først, så de nye føringene er dem foran versjonen som kjører.
 */
export function berortAvNyVersjon(
  endringer: readonly Endringsomrade[] | undefined,
  kjorer: string | undefined,
  side: string | null,
  vinduApent: boolean,
): boolean {
  const her = endringer && kjorer ? endringer.findIndex((e) => e.versjon === kjorer) : -1
  if (!endringer || her < 0) return true
  return endringer
    .slice(0, her)
    .some((e) => !e.gjelder || e.gjelder.some((omrade) => berorer(omrade, side, vinduApent)))
}

/* --- Siden brukeren er på --------------------------------------------------- */

let side: string | null = null
const sidelyttere = new Set<() => void>()
const roligLyttere = new Set<() => void>()

/** Siden brukeren er på, som `fortolkning/thc`, eller `null` før appen har sagt det. */
export function gjeldendeSide(): string | null {
  return side
}

/** Lytter etter en ny side; for `useSyncExternalStore`. */
export function lyttEtterSide(lytter: () => void): () => void {
  sidelyttere.add(lytter)
  return () => void sidelyttere.delete(lytter)
}

/**
 * Appen sier hvilken side brukeren er på. Å gå fra én side til en annen er et
 * rolig øyeblikk; den første siden etter oppstarten er det ikke. `null` når
 * appen tas ned, som ved utlogging.
 */
export function meldSide(ny: string | null): void {
  if (ny === side) return
  const forrige = side
  side = ny
  for (const lytter of sidelyttere) lytter()
  if (forrige !== null && ny !== null) roligOyeblikk()
}

/** Brukeren er ferdig med noe og har ikke noe ulagret, som når fortolkningen nullstilles. */
export function roligOyeblikk(): void {
  for (const lytter of roligLyttere) lytter()
}

/** Lytter etter rolige øyeblikk, og gir tilbake avregistreringen. */
export function vedRoligOyeblikk(lytter: () => void): () => void {
  roligLyttere.add(lytter)
  return () => void roligLyttere.delete(lytter)
}

/** Det brukeren gjør som betyr at hen er i gang med noe igjen. */
const AKTIVITET = ['keydown', 'pointerdown', 'wheel', 'touchstart'] as const

/**
 * Venter til brukeren har latt appen være i `ms` millisekunder, og kaller da
 * `ferdig`. Gjør brukeren noe før det, kalles `avbrutt` i stedet: da er hen i
 * gang med noe igjen, og en omlasting ville tatt tastetrykkene. Gir tilbake
 * en avbrytelse som ikke kaller noen av dem.
 */
export function ventPaaRo(ms: number, ferdig: () => void, avbrutt: () => void): () => void {
  const stopp = () => {
    window.clearTimeout(tidtaker)
    for (const hendelse of AKTIVITET) window.removeEventListener(hendelse, aktiv, true)
  }
  const aktiv = () => {
    stopp()
    avbrutt()
  }
  const tidtaker = window.setTimeout(() => {
    stopp()
    ferdig()
  }, ms)
  for (const hendelse of AKTIVITET) window.addEventListener(hendelse, aktiv, { capture: true, passive: true })
  return stopp
}

/** Bare for testene: glemmer siden og lytterne. */
export function glemSider(): void {
  side = null
  sidelyttere.clear()
  roligLyttere.clear()
}
