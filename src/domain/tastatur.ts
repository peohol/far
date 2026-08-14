/**
 * Reglene for hva et tastetrykk lander på.
 *
 * `Enter` og mellomrom skal bekrefte det samme overalt i appen — velge
 * alternativet, kopiere kommentaren, gå videre. Mellomrom har bare den jobben
 * der tasten ikke alt har en: står fokus i en avkryssing eller på en knapp,
 * skal mellomrom huke av og trykke som før, og står fokus i et tekstfelt, skal
 * det bli et mellomrom i teksten. Konsentrasjonsfeltene tar bare tall
 * ({@link ../components/Tallfelt}), så der blir mellomrom ikke stående som noe
 * tegn, og tasten er ledig til å bekrefte.
 *
 * Reglene leser bare selve elementet og er derfor rene: DOM-en leses av i
 * `src/hooks/useKeyboard.ts`, som er det eneste stedet som trenger å vite
 * hvordan {@link Fokusert} fylles ut.
 */

/** Det reglene trenger å vite om elementet som har fokus. */
export interface Fokusert {
  /** Tagnavnet, som `Element.tagName` — «INPUT», «BUTTON», «SUMMARY» … */
  tag: string
  /** `type` på et felt, som `HTMLInputElement.type`. */
  type?: string | undefined
  /** Sant for feltene som bare tar tall — se `Tallfelt`. */
  tallfelt?: boolean | undefined
  /** Sant for områder som er gjort redigerbare (`contenteditable`). */
  redigerbart?: boolean | undefined
}

/**
 * Hva slags element tastetrykket lander på:
 *
 * - `tall` — felt som bare tar tall. Mellomrom blir ikke stående som et tegn.
 * - `tekst` — felt som tar fritekst. Mellomrom hører til i teksten.
 * - `veksling` — avkryssing eller radioknapp. Mellomrom huker av.
 * - `trykk` — knapp, nedtrekksliste, sammendrag. Mellomrom trykker eller åpner.
 * - `annet` — alt annet. Mellomrom har ingen jobb her.
 */
export type Fokustype = 'tall' | 'tekst' | 'veksling' | 'trykk' | 'annet'

/** Felt der det som tastes blir stående som tegn. */
const TEKSTFELT = new Set(['text', 'search', 'tel', 'url', 'email', 'password'])

/** Felt der mellomrom huker av. */
const VEKSLINGER = new Set(['checkbox', 'radio'])

/** Felt som trykkes som en knapp. */
const KNAPPEFELT = new Set(['button', 'submit', 'reset', 'image', 'file', 'color'])

/** Elementer der mellomrom trykker, folder ut eller åpner noe. */
const TRYKKELEMENTER = new Set(['BUTTON', 'SELECT', 'SUMMARY', 'OPTION', 'A'])

export function fokustype(fokus: Fokusert | null | undefined): Fokustype {
  if (!fokus) return 'annet'
  if (fokus.redigerbart) return 'tekst'

  const tag = fokus.tag.toUpperCase()
  if (tag === 'TEXTAREA') return 'tekst'
  if (TRYKKELEMENTER.has(tag)) return 'trykk'
  if (tag !== 'INPUT') return 'annet'

  if (fokus.tallfelt) return 'tall'
  // Et felt uten `type` er et tekstfelt, slik nettleseren også leser det.
  const type = (fokus.type ?? 'text').toLowerCase()
  if (VEKSLINGER.has(type)) return 'veksling'
  if (KNAPPEFELT.has(type)) return 'trykk'
  if (TEKSTFELT.has(type)) return 'tekst'
  if (type === 'number') return 'tall'
  // Dato-, tid- og skalafelt: mellomrom skriver ingenting her, og feltet
  // trenger ikke tasten til noe eget.
  return 'annet'
}

/**
 * Sant når mellomrom er ledig der fokus står, og derfor skal gjøre det samme
 * som `Enter`.
 */
export function mellomromErLedig(fokus: Fokusert | null | undefined): boolean {
  const type = fokustype(fokus)
  return type === 'tall' || type === 'annet'
}

/**
 * Sant når det brukeren taster hører hjemme i feltet som står fokusert.
 *
 * Tallene 1, 2 … er hurtigtaster flere steder i appen, og de skal skrives inn
 * i stedet for å velge noe når det står et felt som tar dem imot.
 */
export function feltetTarTegnene(fokus: Fokusert | null | undefined): boolean {
  const type = fokustype(fokus)
  return type === 'tall' || type === 'tekst'
}
