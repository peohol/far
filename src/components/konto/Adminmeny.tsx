import { useCallback } from 'react'
import { useBevart } from '../../oppdatering/Bevaring'
import { useProfil } from '../../auth/okt'
import { Menyvalg, Nedtrekksmeny } from '../toppmeny/Nedtrekksmeny'
import { Autoerstattregler } from './Autoerstattregler'
import { Brukerliste } from './Brukerliste'
import { Datakilder } from './Datakilder'

type Panel = 'brukere' | 'datakilder' | 'autoerstatt' | null

/**
 * Administratorenes egen meny i toppmenyen, til venstre for kontoen: brukerne,
 * driftstatusen for datakildene og autoerstatt-reglene i teksteditorene. Andre ser den ikke. Den er et grensesnitt,
 * ikke en tilgangskontroll: databasen og Edge-funksjonene slår opp rollen selv.
 */
export function Adminmeny() {
  const admin = useProfil().role === 'admin'
  const [panel, setPanel] = useBevart<Panel>('adminmeny', null)
  const lukkPanel = useCallback(() => setPanel(null), [])

  if (!admin) return null

  return (
    <>
      <Nedtrekksmeny
        className="adminmeny"
        knapp={{ ikon: 'shield', etikett: 'Administrasjon', variant: 'stille', storrelse: 'liten' }}
        etikett="Administrasjon"
        lag="adminmeny"
      >
        {(lukk) => {
          /** Et valg lukker menyen først, så vinduet det åpner gir fokus tilbake til knappen. */
          const apne = (neste: Exclude<Panel, null>) => () => {
            lukk()
            setPanel(neste)
          }
          return (
            <ul className="nedtrekk__valg">
              <li>
                <Menyvalg ikon="user" tekst="Brukere" onClick={apne('brukere')} />
              </li>
              <li>
                <Menyvalg ikon="reset" tekst="Datakilder" onClick={apne('datakilder')} />
              </li>
              <li>
                <Menyvalg ikon="edit" tekst="Autoerstatt" onClick={apne('autoerstatt')} />
              </li>
            </ul>
          )
        }}
      </Nedtrekksmeny>
      <Brukerliste apen={panel === 'brukere'} onLukk={lukkPanel} />
      <Datakilder apen={panel === 'datakilder'} onLukk={lukkPanel} />
      <Autoerstattregler apen={panel === 'autoerstatt'} onLukk={lukkPanel} />
    </>
  )
}
