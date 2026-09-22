import { initialer, type Profil } from '@delt/profil'

export type Avatarstorrelse = 'liten' | 'middels' | 'stor'

export interface AvatarProps {
  profil: Pick<Profil, 'first_name' | 'last_name' | 'username' | 'avatar_path'>
  /** Signert lenke til bildet. Uten den vises forbokstavene. */
  lenke?: string | null
  storrelse?: Avatarstorrelse
}

/**
 * Profilbildet, alltid i en sirkel.
 *
 * Uten bilde vises forbokstavene i stedet, slik at raden i brukerlista ser
 * lik ut enten bildet er lagt inn eller ikke. Avataren står alltid sammen med
 * navnet, så den er dekorativ for skjermlesere.
 */
export function Avatar({ profil, lenke, storrelse = 'middels' }: AvatarProps) {
  return (
    <span className={`avatar avatar--${storrelse}`} aria-hidden="true">
      {lenke ? (
        <img className="avatar__bilde" src={lenke} alt="" />
      ) : (
        <span className="avatar__initialer">{initialer(profil)}</span>
      )}
    </span>
  )
}
