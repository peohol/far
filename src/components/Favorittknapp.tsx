import { Ikonknapp } from './Ikonknapp'

/**
 * Stjernen på en fagside: legger stoffet til i favorittene, eller fjerner det
 * igjen. Navnet sier hva et trykk gjør, så det står også i tooltipen; stjernen
 * er fylt og knappen markert mens stoffet er favoritt.
 */
export function Favorittknapp({
  stoff,
  favoritt,
  onSett,
}: {
  stoff: string
  favoritt: boolean
  onSett: (stoff: string, favoritt: boolean) => void
}) {
  return (
    <Ikonknapp
      ikon="star"
      className="favorittknapp"
      etikett={favoritt ? 'Fjern fra favoritter' : 'Legg til i favoritter'}
      data-favoritt={favoritt ? 'ja' : 'nei'}
      onClick={() => onSett(stoff, !favoritt)}
    />
  )
}
