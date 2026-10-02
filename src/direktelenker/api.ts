/**
 * Oppslaget av det en direktelenke peker på (`direktelenke()` i databasen).
 *
 * Svarene huskes en stund, så flere lenkebrikker til samme tråd i en tekst,
 * og forhåndsvisningen når pekeren kommer over en av dem, bare spør én gang.
 * Det som skal avgjøre noe — om en lenke kan settes inn, hvor den fører —
 * spør på nytt (`fersk`).
 */
import { klient } from '../auth/klient'
import { malnokkel, type Lenkemal } from './mal'
import { lesLenkemaal, type Lenkemaal } from './modell'

/** Hvor lenge et svar huskes. */
export const HUSKES_I = 60_000

const husket = new Map<string, { kl: number; svar: Promise<Lenkemaal | null> }>()

/** Det lenken peker på, eller `null` når det ikke finnes. Kaster når oppslaget feiler. */
export function hentLenkemaal(mal: Lenkemal, { fersk = false }: { fersk?: boolean } = {}): Promise<Lenkemaal | null> {
  const nokkel = malnokkel(mal)
  const tidligere = husket.get(nokkel)
  if (tidligere && !fersk && Date.now() - tidligere.kl < HUSKES_I) return tidligere.svar
  const svar = (async () => {
    const { data, error } = await klient().rpc('direktelenke', { slag: mal.slag, id: mal.id, kommentar: mal.kommentar })
    if (error) throw new Error('Fikk ikke slått opp lenken.')
    return lesLenkemaal(mal, data)
  })()
  husket.set(nokkel, { kl: Date.now(), svar })
  // Et oppslag som feilet, huskes ikke: neste brikke prøver igjen.
  svar.catch(() => {
    if (husket.get(nokkel)?.svar === svar) husket.delete(nokkel)
  })
  return svar
}

/** Glemmer alle svarene, som når noe er endret og skal vises slik det er nå. */
export function glemLenkemaal(): void {
  husket.clear()
}
