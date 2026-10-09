import { useCallback, useState } from 'react'
import { klient } from '../../auth/klient'
import { useBevart } from '../../oppdatering/Bevaring'
import { useProfil } from '../../auth/okt'
import { kilderSomBorSesOver, lagDatakildeleser, type Datakildeleser } from '../../datakilder/status'
import { useJevnligSjekk } from '../../hooks/useJevnligSjekk'
import { Menyvalg, Nedtrekksmeny } from '../toppmeny/Nedtrekksmeny'
import { Autoerstattregler } from './Autoerstattregler'
import { Brukerliste } from './Brukerliste'
import { Datakilder } from './Datakilder'

type Panel = 'brukere' | 'datakilder' | 'autoerstatt' | null

/**
 * Navnene på datakildene som bør ses over, sjekket som idémenyen ser etter nye
 * kommentarer: når appen og fanen åpnes, jevnlig og når «Datakilder» lukkes.
 * Bare én endring per kilde hentes; vurderingen er den samme som i panelet.
 * En sjekk som feiler, endrer ingenting.
 */
function useDatakildetilsyn(admin: boolean, egenLeser?: Datakildeleser) {
  const [kilder, setKilder] = useState<string[]>([])
  const sjekk = useCallback(() => {
    if (!admin) return
    void (async () => {
      const status = await (egenLeser ?? lagDatakildeleser(klient())).status(1)
      setKilder(kilderSomBorSesOver(status))
    })().catch(() => undefined)
  }, [admin, egenLeser])
  useJevnligSjekk(sjekk)
  return { kilder, sjekk }
}

/**
 * Administratorenes egen meny i toppmenyen, til venstre for kontoen: brukerne,
 * driftstatusen for datakildene og autoerstatt-reglene i teksteditorene. Andre ser den ikke. Den er et grensesnitt,
 * ikke en tilgangskontroll: databasen og Edge-funksjonene slår opp rollen selv.
 * Bør en datakilde ses over, står det en prikk på knappen og på «Datakilder».
 */
export function Adminmeny({ leser }: { leser?: Datakildeleser } = {}) {
  const admin = useProfil().role === 'admin'
  const [panel, setPanel] = useBevart<Panel>('adminmeny', null)
  const tilsyn = useDatakildetilsyn(admin, leser)
  const { sjekk } = tilsyn
  const lukkPanel = useCallback(() => {
    setPanel(null)
    sjekk()
  }, [sjekk])
  const sesOver = tilsyn.kilder.length ? `${tilsyn.kilder.join(', ')} bør ses over` : undefined

  if (!admin) return null

  return (
    <>
      <Nedtrekksmeny
        className="adminmeny"
        knapp={{
          ikon: 'shield',
          etikett: `Administrasjon${sesOver ? ` (${sesOver})` : ''}`,
          variant: 'stille',
          storrelse: 'liten',
        }}
        etikett="Administrasjon"
        lag="adminmeny"
        ved={sesOver && <span className="nyprikk toppmeny__prikk" aria-hidden="true" />}
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
                <Menyvalg ikon="reset" tekst="Datakilder" nytt={sesOver} onClick={apne('datakilder')} />
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
