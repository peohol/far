import { Suspense, lazy } from 'react'
import type { BildevelgerProps } from './Bildevelger'

/**
 * Bildevelgeren, lastet først når den trengs.
 *
 * Beskjæringen drar med seg et eget bibliotek, og det hører ikke til på
 * innloggingssiden — som er det første alle møter. Her hentes det når noen
 * faktisk skal bytte profilbilde.
 */
const Bildevelger = lazy(() =>
  import('./Bildevelger').then((modul) => ({ default: modul.Bildevelger })),
)

export function Bildevelgerlast(props: BildevelgerProps) {
  return (
    <Suspense fallback={<div className="bildevelger__visning">{props.visning}</div>}>
      <Bildevelger {...props} />
    </Suspense>
  )
}
