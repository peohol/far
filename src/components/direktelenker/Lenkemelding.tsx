import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Ikon } from '../ikon/Ikon'
import { useOversteLag } from '../Oppdateringsmelding'
import { lyttEtterLenkefeil } from './navigasjon'
import '../../styles/direktelenker.css'

/** Hvor lenge meldingen står. */
export const MELDING_I = 6000

/**
 * Meldingen nederst når en direktelenke ikke kunne åpnes — den peker på noe
 * som er slettet, eller oppslaget feilet. Står i laget som er øverst, så den
 * også synes over et åpent vindu, og forsvinner av seg selv.
 */
export function Lenkemelding() {
  const [melding, setMelding] = useState<{ tekst: string; nr: number } | null>(null)
  useEffect(() => lyttEtterLenkefeil((tekst) => setMelding({ tekst, nr: Date.now() })), [])
  useEffect(() => {
    if (!melding) return
    const frist = window.setTimeout(() => setMelding(null), MELDING_I)
    return () => window.clearTimeout(frist)
  }, [melding])

  const lag = useOversteLag(melding !== null)
  if (!melding || !lag) return null
  return createPortal(
    <div key={melding.nr} className="lenkemelding" role="alert">
      <Ikon navn="lenke" storrelse="ui" />
      <span>{melding.tekst}</span>
      <button type="button" className="lenkemelding__lukk" aria-label="Lukk meldingen" onClick={() => setMelding(null)}>
        <Ikon navn="close" storrelse="ui" />
      </button>
    </div>,
    lag,
  )
}
