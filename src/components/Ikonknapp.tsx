import { forwardRef, useCallback, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Ikon } from './ikon/Ikon'
import type { Ikonnavn } from './ikon/register'
import { useTips } from './Tips'

/**
 * - `myk`: hevet flate — vanlige handlinger i toppmenyen
 * - `stille`: gjennomsiktig — innstillinger som hurtigtaster og tema
 * - `aksent`: aksentflate — kontoen
 * - `kant`: gjennomsiktig med hårlinje
 */
export type Ikonknappvariant = 'myk' | 'stille' | 'aksent' | 'kant'

export interface IkonknappProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  ikon: Ikonnavn
  /** Knappens navn. Blir tilgjengelig navn og tooltip, og er påkrevd. */
  etikett: string
  variant?: Ikonknappvariant
  /** `kontroll` er 42 px, `liten` 38 px. Begge blir minst 44 px på smale flater. */
  storrelse?: 'kontroll' | 'liten'
  /** Noe som skal stå i knappen i stedet for ikonet, som et profilbilde. */
  innhold?: ReactNode
  /**
   * Uten tooltip, der boblen ikke kan vises: i et modalt lag ligger siden,
   * og dermed boblen, under laget. Navnet står fortsatt for skjermlesere.
   */
  utenTips?: boolean
}

/**
 * Rund ikonknapp. Navnet står som tooltip ved peker og fokus, og som
 * knappens navn for skjermlesere — som derfor ikke får det to ganger.
 * Ikonet spiller animasjonen sin når knappen får peker eller fokus.
 */
export const Ikonknapp = forwardRef<HTMLButtonElement, IkonknappProps>(function Ikonknapp(
  { ikon, etikett, variant = 'myk', storrelse = 'kontroll', innhold, utenTips, className, ...rest },
  ref,
) {
  const tips = useTips(etikett, { skjermleser: false })
  const { ref: tipsRef, ...tipsprops } = tips.props
  // Tipset og den som bruker knappen, skal begge ha det samme elementet.
  const settRef = useCallback(
    (element: HTMLButtonElement | null) => {
      tipsRef(element)
      if (typeof ref === 'function') ref(element)
      else if (ref) ref.current = element
    },
    [tipsRef, ref],
  )

  return (
    <button
      ref={settRef}
      type="button"
      className={['ikonknapp', className].filter(Boolean).join(' ')}
      data-variant={variant}
      data-storrelse={storrelse}
      data-ih=""
      aria-label={etikett}
      {...(utenTips ? {} : tipsprops)}
      {...rest}
    >
      {innhold ?? <Ikon navn={ikon} storrelse="ui" />}
    </button>
  )
})
