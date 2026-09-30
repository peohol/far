import { lagSignal } from '../../domain/signal'
import type { Diskusjonsside } from '../../diskusjoner/modell'

/**
 * Veien inn til en tråd fra andre steder i appen, som et varsel om en ny
 * kommentar. Varselet går til siden tråden står på; diskusjonsmenyen på den
 * siden tar tråden og åpner den.
 *
 * Tråden venter her til menyen for siden står: den som ber om den, er ofte på
 * en annen side, og menyen der byttes ut først når adressen er fulgt.
 */
let venter: { side: Diskusjonsside; diskusjon: string } | null = null
const signal = lagSignal()

/** Åpner tråden i diskusjonsmenyen på siden. Siden må man selv gå til. */
export function visDiskusjon(side: Diskusjonsside, diskusjon: string): void {
  venter = { side, diskusjon }
  signal.send()
}

/** Tråden som venter på å bli åpnet på siden, om noen. Den venter ikke lenger etterpå. */
export function taDiskusjon(side: Diskusjonsside): string | null {
  if (venter?.side !== side) return null
  const { diskusjon } = venter
  venter = null
  return diskusjon
}

/** Hører etter `visDiskusjon`. Gir tilbake funksjonen som slutter å høre etter. */
export const lyttEtterDiskusjon = signal.lytt
