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
}

/** En handling med ikon og tekst i toppmenyen, som «Åpne fortolkning». */
export function Toppmenyknapp({ ikon, children, variant = 'sekundar', className, ...rest }: ToppmenyknappProps) {
  // Teksten er knappens navn også når den er skjult; tipset er for synet.
  const tips = useTips(children, { skjermleser: false })
  return (
    <button
      type="button"
      className={['toppmenyknapp', className].filter(Boolean).join(' ')}
      data-variant={variant}
      data-ih=""
      aria-label={children}
      {...(variant === 'sekundar' ? tips.props : {})}
      {...rest}
    >
      <span className="toppmenyknapp__ikon">
        <Ikon navn={ikon} storrelse="ui" />
      </span>
      <span className="toppmenyknapp__tekst" aria-hidden="true">
        {children}
      </span>
    </button>
  )
}
