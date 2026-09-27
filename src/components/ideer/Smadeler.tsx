import { useEffect, useId, useState } from 'react'
import { fullTid, kortTid } from '../../ideer/modell'
import { Ikon } from '../ikon/Ikon'
import type { Ikonnavn } from '../ikon/register'

/** Et tidspunkt kort, med hele datoen og klokkeslettet ved peker og for skjermlesere. */
export function Tidspunkt({ iso, endret }: { iso: string; endret?: string | null }) {
  return (
    <>
      <time dateTime={iso} title={fullTid(iso)}>
        {kortTid(iso)}
      </time>
      {endret && (
        <span className="ide-endret" title={`Endret ${fullTid(endret)}`}>
          {' '}
          · endret
        </span>
      )}
    </>
  )
}

/**
 * Hjertet på en idé eller kommentar: antallet, og om den innloggede har gitt
 * et. Knappen sier det samme med `aria-pressed`.
 */
export function Hjerteknapp({
  antall,
  gitt,
  onVeksle,
  hva,
}: {
  antall: number
  gitt: boolean
  onVeksle: () => void
  /** «idéen» eller «kommentaren», til navnet på knappen. */
  hva: string
}) {
  return (
    <button
      type="button"
      className="idehandling hjerteknapp"
      aria-pressed={gitt}
      aria-label={`${gitt ? 'Ta tilbake hjertet på' : 'Gi hjerte til'} ${hva} (${antall})`}
      data-ih=""
      onClick={onVeksle}
    >
      <Ikon navn="heart" storrelse="ui" />
      <span aria-hidden="true">{antall}</span>
    </button>
  )
}

/**
 * En rad med piller der én er valgt, med navnet på raden foran: sorteringen
 * i lista og statusen på en idé.
 */
export function Valgrad<T extends string>({
  navn,
  valg,
  valgt,
  etiketter,
  onVelg,
}: {
  navn: string
  valg: readonly T[]
  valgt: T
  etiketter: Record<T, string>
  onVelg: (verdi: T) => void
}) {
  const id = useId()
  return (
    <div className="idevalg" role="group" aria-labelledby={id}>
      <span id={id} className="idevalg__navn">
        {navn}
      </span>
      {valg.map((v) => (
        <button key={v} type="button" className="sokefilter" aria-pressed={v === valgt} onClick={() => onVelg(v)}>
          {etiketter[v]}
        </button>
      ))}
    </div>
  )
}

/** En liten tekstknapp med ikon i handlingsraden under en idé eller kommentar. */
export function Idehandling({
  ikon,
  children,
  onClick,
  ...rest
}: {
  ikon: Ikonnavn
  children: string
  onClick: () => void
  'aria-expanded'?: boolean
}) {
  return (
    <button type="button" className="idehandling" data-ih="" onClick={onClick} {...rest}>
      <Ikon navn={ikon} storrelse="ui" />
      <span>{children}</span>
    </button>
  )
}

/** Hvor lenge «Bekreft» står før knappen går tilbake til «Slett». */
const BEKREFT_I = 4000

/**
 * Sletting i to trykk: det første gjør knappen om til «Bekreft sletting», det
 * andre sletter. Går fokus ut, eller går det noen sekunder, er den tilbake.
 */
export function Slettknapp({ onSlett, hva }: { onSlett: () => void; hva: string }) {
  const [bekreft, setBekreft] = useState(false)
  useEffect(() => {
    if (!bekreft) return
    const frist = window.setTimeout(() => setBekreft(false), BEKREFT_I)
    return () => window.clearTimeout(frist)
  }, [bekreft])

  return (
    <button
      type="button"
      className="idehandling idehandling--slett"
      data-bekreft={bekreft || undefined}
      aria-label={bekreft ? `Bekreft sletting av ${hva}` : `Slett ${hva}`}
      data-ih=""
      onBlur={() => setBekreft(false)}
      onClick={() => (bekreft ? onSlett() : setBekreft(true))}
    >
      <Ikon navn="trash" storrelse="ui" />
      <span aria-live="polite">{bekreft ? 'Bekreft sletting' : 'Slett'}</span>
    </button>
  )
}
