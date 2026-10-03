import type { ButtonHTMLAttributes } from 'react'
import { Ikon } from '../ikon/Ikon'
import type { Ikonnavn } from '../ikon/register'
import { useTips } from '../Tips'

export interface ToppmenyknappProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  ikon: Ikonnavn
  children: string
  /**
   * `primar` er sidens hovedhandling (aksentflate, alltid med tekst).
   * `sekundar` får hårlinje, og krymper til bare ikonet på trange flater —
   * med teksten som tooltip og som knappens navn.
   */
  variant?: 'primar' | 'sekundar'
  /**
   * Hvorfor handlingen ikke kan brukes nå, som «Det er ikke noe nytt å
   * publisere». Knappen står da dempet og gjør ingenting, men kan fortsatt
   * nås med peker og tastatur, så grunnen vises som tooltip og meldes til
   * skjermlesere. Brukes i stedet for `disabled`, som ville skjult grunnen.
   */
  avslatt?: string
}

/** En handling med ikon og tekst i toppmenyen, som «Åpne fortolkning». */
export function Toppmenyknapp({
  ikon,
  children,
  variant = 'sekundar',
  avslatt,
  className,
  onClick,
  ...rest
}: ToppmenyknappProps) {
  // Teksten er knappens navn også når den er skjult; tipset er for synet.
  // En avslått knapp viser i stedet grunnen, også for skjermlesere.
  const tips = useTips(avslatt ?? children, { skjermleser: avslatt !== undefined })
  return (
    <>
      <button
        type="button"
        className={['toppmenyknapp', className].filter(Boolean).join(' ')}
        data-variant={variant}
        data-ih=""
        aria-label={children}
        {...(avslatt !== undefined && { 'aria-disabled': true })}
        {...(variant === 'sekundar' || avslatt !== undefined ? tips.props : {})}
        {...rest}
        onClick={avslatt === undefined ? onClick : undefined}
      >
        <span className="toppmenyknapp__ikon">
          <Ikon navn={ikon} storrelse="ui" />
        </span>
        <span className="toppmenyknapp__tekst" aria-hidden="true">
          {children}
        </span>
      </button>
      {tips.forklaring}
    </>
  )
}
