import type { Manglende as Manglendekilder } from '../../faginnhold/globaltSok'
import { Button } from '../Button'
import { manglertekst } from './treffvisning'

/**
 * Hva søket mangler fordi det ikke kunne hentes, med en knapp som prøver
 * igjen. Står ikke når alt er med, og knappen står ikke mens det hentes.
 */
export function Manglende({
  mangler,
  henter,
  onProvIgjen,
  className,
}: {
  mangler: Manglendekilder | undefined
  henter: boolean
  onProvIgjen: () => void
  className: string
}) {
  const tekst = manglertekst(mangler)
  if (!tekst) return null
  return (
    <div className={className} role="note">
      <p>{tekst}</p>
      {!henter && (
        <Button variant="subtle" onClick={onProvIgjen}>
          Prøv igjen
        </Button>
      )}
    </div>
  )
}
