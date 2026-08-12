import { useId, type ReactNode } from 'react'

export interface TipsProps {
  /**
   * Forklaringen som vises i boblen. Én streng når det holder med en setning
   * eller to; ellers `tips__bolk`-seksjoner med hver sin `tips__tittel`.
   */
  forklaring: ReactNode
  children: ReactNode
  /** Egen klasse på ankeret, til plassering og skrift der det står. */
  className?: string
  /**
   * Fast id på boblen. Trengs bare når noe annet enn ankeret selv skal peke
   * på forklaringen med `aria-describedby` — ellers lages en.
   */
  id?: string
}

/**
 * Et navn eller en overskrift med en forklaring bak seg. Prikkestreken under
 * teksten er hintet om at det er noe å hente, og boblen vises både ved peker
 * og ved tastaturfokus — skjermlesere får den samme teksten gjennom
 * `aria-describedby`, så forklaringen aldri er ren museinformasjon.
 *
 * Ankeret og boblen er søsken, ikke far og barn: da kan boblen spenne over
 * hele bredden til nærmeste posisjonerte forelder i stedet for å klemmes inn
 * i ankerets egen. Forelderen må derfor være `position: relative` — og et
 * blokkelement, siden boblen er det.
 *
 * Selve navnet legges i en `tipsanker__navn` blant barna, så prikkestreken
 * havner på teksten og ikke på det som eventuelt står ved siden av — en
 * fargestrek i en legende, for eksempel.
 */
export function Tips({ forklaring, children, className, id }: TipsProps) {
  const laget = useId()
  const boble = id ?? laget
  return (
    <>
      <span
        className={className ? `tipsanker ${className}` : 'tipsanker'}
        tabIndex={0}
        aria-describedby={boble}
      >
        {children}
      </span>
      <div className="tips" id={boble} role="tooltip">
        {forklaring}
      </div>
    </>
  )
}
