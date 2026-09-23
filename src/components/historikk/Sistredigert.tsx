import { useCallback, useState } from 'react'
import { fulltNavn, tidspunkt } from '../../faginnhold/historikk'
import { innholdsfelter } from '../../faginnhold/innholdsfelter'
import type { Utgave } from '../../faginnhold/lesing'
import type { Innhold, Objekttype } from '../../faginnhold/modell'
import { useRedigering } from '../analyttside/Redigeringskontekst'
import { Historikkvindu } from './Historikkvindu'

/** «Sist redigert av Ola Nordmann 22.09.2026 kl. 14:32». */
export function sistRedigert(utgave: Utgave<unknown>): string {
  const navn = fulltNavn({ fornavn: utgave.endret_av_fornavn, etternavn: utgave.endret_av_etternavn })
  const naar = tidspunkt(utgave.endret_kl)
  return ['Sist redigert', navn && `av ${navn}`, naar].filter(Boolean).join(' ')
}

/**
 * «Sist redigert av …» ved et redigerbart objekt. Et trykk åpner historikken
 * for akkurat dette objektet, der en tidligere revisjon kan sammenlignes og
 * gjenopprettes.
 */
export function Sistredigert<T extends Objekttype>({
  utgave,
  type,
  navn,
}: {
  utgave: Utgave<Innhold[T]>
  type: T
  /** Hva objektet er, f.eks. «Referanseområde». */
  navn: string
}) {
  const { gjenopprett } = useRedigering()
  const [apen, setApen] = useState(false)
  const tekst = sistRedigert(utgave)
  const felter = useCallback((innhold: Innhold[T]) => innholdsfelter(type, innhold), [type])
  const lukk = useCallback(() => setApen(false), [])

  return (
    <>
      <button
        type="button"
        className="sistredigert sistredigert--knapp"
        aria-haspopup="dialog"
        aria-label={`${tekst}. Vis historikken for ${navn.toLowerCase()}`}
        onClick={() => setApen(true)}
      >
        {tekst}
      </button>
      {apen && (
        <Historikkvindu
          apen
          navn={navn}
          objekt={utgave.id}
          felter={felter}
          gjeldende={utgave.revisjon}
          onGjenopprett={(fra) => gjenopprett(utgave, fra)}
          onLukk={lukk}
        />
      )}
    </>
  )
}
