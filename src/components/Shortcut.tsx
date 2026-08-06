/**
 * Merkelappen som viser hvilken tast som utløser en knapp.
 *
 * Alle knapper med hurtigtast merkes med denne, i liten og dempet skrift så
 * den ikke konkurrerer med selve knappeteksten.
 */
export function Shortcut({ children }: { children: React.ReactNode }) {
  return <kbd className="hurtigtast">{children}</kbd>
}
