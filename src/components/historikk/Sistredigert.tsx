import { useCallback, useState } from 'react'
import { fulltNavn, tidspunkt, type Felt } from '../../faginnhold/historikk'
import { innholdsfelter } from '../../faginnhold/innholdsfelter'
import type { Utgave } from '../../faginnhold/lesing'
import type { Innhold, Objekttype } from '../../faginnhold/modell'
import { useRedigering } from '../analyttside/Redigeringskontekst'
import { Historikkvindu } from './Historikkvindu'

/**
 * «Sist redigert av Ola Nordmann 22.09.2026 kl. 14:32», og hvor innholdet kom
 * fra når det ikke ble skrevet i appen: «… · Importert fra Psykofarmaka.pdf,
 * side 7».
 */
export function sistRedigert(utgave: Utgave<unknown>): string {
  const navn = fulltNavn({ fornavn: utgave.endret_av_fornavn, etternavn: utgave.endret_av_etternavn })
  const naar = tidspunkt(utgave.endret_kl)
  const tekst = ['Sist redigert', navn && `av ${navn}`, naar].filter(Boolean).join(' ')
  return utgave.kilde ? `${tekst} · ${utgave.kilde}` : tekst
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
  felter: egneFelter,
}: {
  utgave: Utgave<Innhold[T]>
  type: T
  /** Hva objektet er, f.eks. «Referanseområde». */
  navn: string
  /** Feltene historikken sammenligner, når de trenger mer enn innholdet selv. */
  felter?: (innhold: Innhold[T]) => Felt[]
}) {
  const { gjenopprett } = useRedigering()
  const [apen, setApen] = useState(false)
  const tekst = sistRedigert(utgave)
  const felter = useCallback(
    (innhold: Innhold[T]) => (egneFelter ? egneFelter(innhold) : innholdsfelter(type, innhold)),
    [type, egneFelter],
  )
  const lukk = useCallback(() => setApen(false), [])

  return (
    <>
      <button
        type="button"
        className="sistredigert sistredigert--knapp"
        aria-haspopup="dialog"
        aria-label={`${tekst}. Vis historikken for ${navn.charAt(0).toLowerCase()}${navn.slice(1)}`}
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
