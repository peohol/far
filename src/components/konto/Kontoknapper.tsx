import { useCallback, useState } from 'react'
import { visningsnavn } from '@delt/profil'
import { useAvatarlenker } from '../../auth/avatarer'
import { useProfil } from '../../auth/okt'
import { Verktoyknapp } from '../Toolbar'
import { UsersIcon } from '../icons'
import { Avatar } from './Avatar'
import { Brukerliste } from './Brukerliste'
import { Kontopanel } from './Kontopanel'

type Panel = 'konto' | 'brukere' | null

/**
 * Veiene inn til brukerlista og til din egen konto, først i verktøylinja.
 *
 * Kontoknappen bærer profilbildet ved siden av fornavnet, slik at det alltid
 * er synlig hvem appen er logget inn som.
 */
export function Kontoknapper() {
  const profil = useProfil()
  const lenker = useAvatarlenker([profil])
  const [apent, setApent] = useState<Panel>(null)
  // Fast identitet: `Modallag` kobler den til lukkehendelsen på dialogen.
  const lukk = useCallback(() => setApent(null), [])

  const lenke = profil.avatar_path ? (lenker.get(profil.avatar_path) ?? null) : null

  return (
    <>
      <Verktoyknapp label="Vis brukerne" onClick={() => setApent('brukere')}>
        <UsersIcon />
      </Verktoyknapp>

      <button
        type="button"
        className="kontoknapp"
        aria-haspopup="dialog"
        aria-label={`Kontoen din – ${visningsnavn(profil)}`}
        onClick={() => setApent('konto')}
      >
        <Avatar profil={profil} lenke={lenke} storrelse="liten" />
        <span className="kontoknapp__navn">{profil.first_name || profil.username}</span>
      </button>

      <Kontopanel apen={apent === 'konto'} onLukk={lukk} />
      <Brukerliste apen={apent === 'brukere'} onLukk={lukk} />
    </>
  )
}
