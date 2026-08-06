import { useShortcutVisibility } from '../hooks/useShortcutVisibility'

export interface ShortcutProps {
  children: React.ReactNode
  /**
   * Sett når merket alltid skal vises, uavhengig av innstillingen. Brukes for
   * tallene på søkealternativene, som endrer seg fra søk til søk og derfor
   * ikke er noe man kan lære seg.
   */
  always?: boolean
}

/**
 * Merkelappen som viser hvilken tast som utløser en knapp, i liten og dempet
 * skrift så den ikke konkurrerer med knappeteksten. Skjules når brukeren har
 * slått av hurtigtastmerkene; tasten virker like fullt.
 */
export function Shortcut({ children, always = false }: ShortcutProps) {
  const { visible } = useShortcutVisibility()
  if (!always && !visible) return null
  return <kbd className="hurtigtast">{children}</kbd>
}
