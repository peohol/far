import { Fragment, type HTMLAttributes } from 'react'
import { useShortcutVisibility } from '../hooks/useShortcutVisibility'

export interface ShortcutProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  /** Snarveien slik den skrives, f.eks. «Esc», «↵» eller «Ctrl + K». */
  children: string
  /**
   * Sett når merket alltid skal vises, uavhengig av innstillingen. Brukes for
   * tallene på søkealternativene, som endrer seg fra søk til søk og derfor
   * ikke er noe man kan lære seg.
   */
  always?: boolean
}

/**
 * Tastene i en snarvei, i den rekkefølgen de trykkes: «Ctrl + K» → Ctrl, K.
 * Plusset må ha luft rundt seg for å skille tastene, så en snarvei på selve
 * plusstasten («Ctrl + +») blir stående.
 */
export function taster(snarvei: string): string[] {
  return snarvei.split(/\s+\+\s+/).filter(Boolean)
}

/**
 * Snarveien til en knapp, tegnet som tastene på et tastatur: én tast per
 * tast, med «+» mellom når flere trykkes sammen. Skjules når brukeren har
 * slått av hurtigtastmerkene; tasten virker like fullt.
 *
 * Merket er en `<kbd>` med én `<kbd>` per tast, slik HTML beskriver en
 * tastekombinasjon.
 */
export function Shortcut({ children, always = false, className, ...rest }: ShortcutProps) {
  const { visible } = useShortcutVisibility()
  if (!always && !visible) return null
  return (
    <kbd className={['hurtigtast', className].filter(Boolean).join(' ')} {...rest}>
      {taster(children).map((tast, i) => (
        <Fragment key={i}>
          {i > 0 && <span className="hurtigtast__pluss">+</span>}
          <kbd className="tast">{tast}</kbd>
        </Fragment>
      ))}
    </kbd>
  )
}
