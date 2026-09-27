import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { visningsnavn } from '@delt/profil'
import { useAvatarlenker } from '../../auth/avatarer'
import { useOkt, useProfil } from '../../auth/okt'
import type { Theme } from '../../hooks/useTheme'
import { Endringslogg } from '../Endringslogg'
import { Ideer } from '../ideer/Ideer'
import { Ikon } from '../ikon/Ikon'
import type { Ikonnavn } from '../ikon/register'
import { Ikonknapp } from '../Ikonknapp'
import { VERSJON } from '../Versjonspille'
import { Avatar } from './Avatar'
import { Brukerliste } from './Brukerliste'
import { Datakilder } from './Datakilder'
import { Kontopanel } from './Kontopanel'

type Panel = 'konto' | 'brukere' | 'datakilder' | 'logg' | 'ideer' | null

interface Valg {
  ikon: Ikonnavn
  tekst: string
  hint?: string
  /** Står bare i menyen på smale flater, der knappen ellers ikke får plass. */
  smal?: boolean
  velg: () => void
}

export interface KontomenyProps {
  theme: Theme
  onToggleTheme: () => void
}

/**
 * Kontoen, fra avataren helt til høyre i toppmenyen: hvem appen er logget inn
 * som, og veiene til egen profil, brukerlista, datakildene (administratorer),
 * endringsloggen, idéene og utlogging.
 *
 * Menyen er et lag over appen, som sidemenyen: `data-lag` holder appens egne
 * taster i ro mens den står åpen. Escape, et klikk utenfor eller fokus som
 * går ut av den lukker den, og fokus går tilbake til avataren.
 */
export function Kontomeny({ theme, onToggleTheme }: KontomenyProps) {
  const profil = useProfil()
  const { loggUt } = useOkt()
  const lenker = useAvatarlenker([profil])
  const lenke = profil.avatar_path ? (lenker.get(profil.avatar_path) ?? null) : null
  const navn = visningsnavn(profil)
  const admin = profil.role === 'admin'

  const [apen, setApen] = useState(false)
  const [panel, setPanel] = useState<Panel>(null)
  const knapp = useRef<HTMLButtonElement>(null)
  const meny = useRef<HTMLDivElement>(null)
  const menyId = useId()
  // Fast identitet: `Modallag` kobler den til lukkehendelsen på dialogen.
  const lukkPanel = useCallback(() => setPanel(null), [])

  const lukk = useCallback((tilbake = true) => {
    setApen(false)
    if (tilbake) knapp.current?.focus()
  }, [])

  /** Et valg lukker menyen først, så dialogen den åpner gir fokus tilbake til avataren. */
  const apnePanel = (neste: Exclude<Panel, null>) => () => {
    lukk()
    setPanel(neste)
  }

  const valg: Valg[] = [
    { ikon: 'user', tekst: 'Endre navn og profilbilde', velg: apnePanel('konto') },
    { ikon: 'shield', tekst: 'Brukere', hint: admin ? 'Admin' : undefined, velg: apnePanel('brukere') },
    // Driftstatusen for datakildene er bare for administratorer; databasen avviser andre.
    ...(admin ? [{ ikon: 'reset' as const, tekst: 'Datakilder', hint: 'Admin', velg: apnePanel('datakilder') }] : []),
    { ikon: 'history', tekst: 'Endringslogg', hint: `v${VERSJON}`, velg: apnePanel('logg') },
    { ikon: 'idea', tekst: 'Idéer', velg: apnePanel('ideer') },
    {
      ikon: theme === 'moerkt' ? 'sun' : 'moon',
      tekst: theme === 'moerkt' ? 'Bytt til lyst tema' : 'Bytt til mørkt tema',
      smal: true,
      velg: onToggleTheme,
    },
    { ikon: 'logout', tekst: 'Logg ut', velg: () => void loggUt() },
  ]

  // Fokus inn i menyen når den åpnes, på det første valget.
  useEffect(() => {
    if (apen) meny.current?.querySelector<HTMLElement>('button')?.focus()
  }, [apen])

  useEffect(() => {
    if (!apen) return
    const paaTast = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      lukk()
    }
    // Et trykk utenfor lukker uten å flytte fokus: det går dit brukeren trykket.
    const paaTrykk = (event: PointerEvent) => {
      const mal = event.target as Node
      if (meny.current?.contains(mal) || knapp.current?.contains(mal)) return
      lukk(false)
    }
    window.addEventListener('keydown', paaTast)
    window.addEventListener('pointerdown', paaTrykk)
    return () => {
      window.removeEventListener('keydown', paaTast)
      window.removeEventListener('pointerdown', paaTrykk)
    }
  }, [apen, lukk])

  return (
    <div className="kontomeny">
      <Ikonknapp
        ref={knapp}
        ikon="user"
        etikett={`Kontoen din – ${navn}`}
        variant="aksent"
        className="kontomeny__knapp"
        innhold={<Avatar profil={profil} lenke={lenke} storrelse="liten" />}
        aria-expanded={apen}
        aria-controls={menyId}
        onClick={() => (apen ? lukk() : setApen(true))}
      />

      <div
        ref={meny}
        id={menyId}
        className="kontomeny__panel"
        role="group"
        aria-label="Konto"
        hidden={!apen}
        {...(apen && { 'data-lag': 'kontomeny' })}
        onBlur={(event) => {
          // Tabulator ut av menyen lukker den, men lar fokus gå videre.
          if (apen && !event.currentTarget.contains(event.relatedTarget as Node | null)) {
            if (event.relatedTarget !== knapp.current) lukk(false)
          }
        }}
      >
        <div className="kontomeny__hode">
          <Avatar profil={profil} lenke={lenke} storrelse="middels" />
          <div className="kontomeny__hvem">
            <span className="kontomeny__navn">{navn}</span>
            <span className="kontomeny__brukernavn">{profil.username}</span>
          </div>
          {admin && (
            <span className="kontomeny__merke">
              <Ikon navn="shield" />
              Admin
            </span>
          )}
        </div>
        <ul className="kontomeny__valg">
          {valg.map(({ ikon, tekst, hint, smal, velg }) => (
            <li key={tekst} className={smal ? 'kontomeny__bare-smal' : undefined}>
              <button type="button" className="kontomeny__valgknapp" data-ih="" onClick={velg}>
                <Ikon navn={ikon} storrelse="ui" />
                <span className="kontomeny__tekst">{tekst}</span>
                {hint && <span className="kontomeny__hint">{hint}</span>}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <Kontopanel apen={panel === 'konto'} onLukk={lukkPanel} />
      <Brukerliste apen={panel === 'brukere'} onLukk={lukkPanel} />
      {admin && <Datakilder apen={panel === 'datakilder'} onLukk={lukkPanel} />}
      <Endringslogg apen={panel === 'logg'} onLukk={lukkPanel} />
      <Ideer apen={panel === 'ideer'} onLukk={lukkPanel} />
    </div>
  )
}
