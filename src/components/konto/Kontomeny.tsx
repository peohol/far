import { useCallback, useId, useRef, useState } from 'react'
import { useBevart } from '../../oppdatering/Bevaring'
import { visningsnavn } from '@delt/profil'
import { useAvatarlenker } from '../../auth/avatarer'
import { useOkt, useProfil } from '../../auth/okt'
import { useShortcutVisibility } from '../../hooks/useShortcutVisibility'
import { useSkjuling } from '../../hooks/useSkjuling'
import type { Theme } from '../../hooks/useTheme'
import { Bryter } from '../Bryter'
import { Ikon } from '../ikon/Ikon'
import { Menyvalg, Nedtrekksmeny } from '../toppmeny/Nedtrekksmeny'
import { Avatar } from './Avatar'
import { Kontopanel } from './Kontopanel'

export interface KontomenyProps {
  theme: Theme
  onToggleTheme: () => void
}

/**
 * Kontoen, fra avataren helt til høyre i toppmenyen: hvem appen er logget inn
 * som, veien til egen profil, preferansene og utlogging.
 */
export function Kontomeny({ theme, onToggleTheme }: KontomenyProps) {
  const profil = useProfil()
  const { loggUt } = useOkt()
  const lenker = useAvatarlenker([profil])
  const lenke = profil.avatar_path ? (lenker.get(profil.avatar_path) ?? null) : null
  const navn = visningsnavn(profil)

  const [kontopanel, setKontopanel] = useBevart('kontopanel', false)
  const [preferanser, setPreferanser] = useState(false)
  // Fast identitet: `Modallag` kobler den til lukkehendelsen på dialogen.
  const lukkKontopanel = useCallback(() => setKontopanel(false), [])

  return (
    <>
      <Nedtrekksmeny
        className="kontomeny"
        knapp={{
          ikon: 'user',
          etikett: `Kontoen din – ${navn}`,
          variant: 'aksent',
          className: 'kontomeny__knapp',
          innhold: <Avatar profil={profil} lenke={lenke} storrelse="liten" />,
        }}
        etikett="Konto"
        lag="kontomeny"
        // Neste gang menyen åpnes, står preferansene lukket igjen.
        onApne={() => setPreferanser(false)}
      >
        {(lukk) => (
          <>
            <div className="kontomeny__hode">
              <Avatar profil={profil} lenke={lenke} storrelse="middels" />
              <div className="kontomeny__hvem">
                <span className="kontomeny__navn">{navn}</span>
                <span className="kontomeny__brukernavn">{profil.username}</span>
              </div>
              {profil.role === 'admin' && (
                <span className="kontomeny__merke">
                  <Ikon navn="shield" />
                  Admin
                </span>
              )}
            </div>
            <ul className="nedtrekk__valg">
              <li>
                <Menyvalg
                  ikon="user"
                  tekst="Endre navn og profilbilde"
                  onClick={() => {
                    // Menyen lukkes først, så vinduet gir fokus tilbake til avataren.
                    lukk()
                    setKontopanel(true)
                  }}
                />
              </li>
              <Preferanser
                apen={preferanser}
                onVeksle={() => setPreferanser((a) => !a)}
                theme={theme}
                onToggleTheme={onToggleTheme}
              />
              <li>
                <Menyvalg ikon="logout" tekst="Logg ut" onClick={() => void loggUt()} />
              </li>
            </ul>
          </>
        )}
      </Nedtrekksmeny>
      <Kontopanel apen={kontopanel} onLukk={lukkKontopanel} />
    </>
  )
}

/**
 * «Preferanser»: en skuff i menyen med hurtigtastene og temaet. Den glir opp
 * og igjen som skuffene ellers i appen (`useSkjuling`), og lukket innhold
 * nås ikke med tabulator.
 */
function Preferanser({
  apen,
  onVeksle,
  theme,
  onToggleTheme,
}: {
  apen: boolean
  onVeksle: () => void
  theme: Theme
  onToggleTheme: () => void
}) {
  const hurtigtaster = useShortcutVisibility()
  const kropp = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const id = useId()
  useSkjuling(kropp, inner, apen)

  return (
    <li className="nedtrekk__skuff" data-apen={apen || undefined}>
      <Menyvalg ikon="gears" tekst="Preferanser" utvidet={apen} kontrollerer={id} onClick={onVeksle} />
      <div ref={kropp} className="nedtrekk__skuffkropp">
        <div ref={inner} id={id} className="nedtrekk__skuffinner">
          <Bryter className="nedtrekk__bryter" pa={hurtigtaster.visible} onEndre={hurtigtaster.toggle}>
            <Ikon navn="keys" storrelse="ui" />
            Vis hurtigtaster
          </Bryter>
          <Bryter className="nedtrekk__bryter" pa={theme === 'moerkt'} onEndre={onToggleTheme}>
            <Ikon navn="moon" storrelse="ui" />
            Mørkt tema
          </Bryter>
        </div>
      </div>
    </li>
  )
}
