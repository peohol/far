import { useEffect, useState } from 'react'
import { fullLenke, type Lenkemal } from '../../direktelenker/mal'
import { useClipboard } from '../../hooks/useClipboard'
import { Ikon } from '../ikon/Ikon'
import '../../styles/direktelenker.css'

/** Hvor lenge knappen sier at lenken er kopiert. */
export const KVITTERING_I = 2500

/**
 * «Lenke» i handlingsraden under en tråd, en idé eller en kommentar: legger
 * direktelenken dit på utklippstavlen. Lenken kan limes inn i
 * nettleseren, eller settes inn i en tekst med knappen for direktelenker i
 * verktøyraden. Knappen sier fra en liten stund når den er kopiert.
 */
export function Kopilenkeknapp({ mal, hva }: { mal: Lenkemal; /** «tråden», «idéen» eller «kommentaren». */ hva: string }) {
  const kopier = useClipboard()
  const [svar, setSvar] = useState<'kopiert' | 'feil' | null>(null)

  useEffect(() => {
    if (!svar) return
    const frist = window.setTimeout(() => setSvar(null), KVITTERING_I)
    return () => window.clearTimeout(frist)
  }, [svar])

  return (
    <button
      type="button"
      className="idehandling kopilenke"
      data-ih=""
      data-kopiert={svar === 'kopiert' || undefined}
      aria-label={`Kopier lenke til ${hva}`}
      onClick={() => void kopier(fullLenke(mal)).then((ok) => setSvar(ok ? 'kopiert' : 'feil'))}
    >
      <Ikon navn={svar === 'kopiert' ? 'done' : 'lenke'} storrelse="ui" />
      <span aria-live="polite">{svar === 'kopiert' ? 'Lenke kopiert' : svar === 'feil' ? 'Fikk ikke kopiert' : 'Lenke'}</span>
    </button>
  )
}
