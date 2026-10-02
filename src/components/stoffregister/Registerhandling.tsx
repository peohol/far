import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { Angretoast, type Angring } from '../Angretoast'
import { Ikonknapp } from '../Ikonknapp'
import '../../styles/stoffregister.css'

/**
 * Det helsiden for stoffregisteret og fagsidene gjør med registeret, ett
 * sted: meldingen når databasen sa nei, og «Angre» for det som nettopp ble
 * gjort — som å arkivere et stoff eller legge en fagside i papirkurven. Begge
 * står i foten nederst på siden, over innholdet.
 */
export interface Registerhandling {
  /**
   * Gjør handlingen. Går den, står `angre` som «Angre» i ti sekunder; går den
   * ikke, står meldingen fra databasen. Svarer om den gikk.
   */
  utfor: (handling: () => Promise<unknown>, angre?: { melding: string; angre: () => Promise<unknown> }) => Promise<boolean>
}

const Kontekst = createContext<Registerhandling | null>(null)

export function Registerhandlingskilde({ children }: { children: ReactNode }) {
  const [feil, setFeil] = useState<string | null>(null)
  const [angring, setAngring] = useState<Angring | null>(null)
  const teller = useRef(0)

  const utfor = useCallback<Registerhandling['utfor']>(async (handling, angre) => {
    setFeil(null)
    try {
      await handling()
    } catch (e) {
      setAngring(null)
      setFeil(e instanceof Error ? e.message : String(e))
      return false
    }
    if (angre) {
      teller.current += 1
      setAngring({
        nokkel: teller.current,
        melding: angre.melding,
        angre: async () => {
          await angre.angre()
        },
      })
    }
    return true
  }, [])

  const verdi = useMemo(() => ({ utfor }), [utfor])
  return (
    <Kontekst.Provider value={verdi}>
      {children}
      {(feil || angring) && (
        <div className="registerfot">
          {feil ? (
            <div className="registerfot__feil" role="alert">
              <span>{feil}</span>
              <Ikonknapp ikon="close" etikett="Lukk meldingen" variant="stille" storrelse="liten" onClick={() => setFeil(null)} />
            </div>
          ) : (
            angring && <Angretoast key={angring.nokkel} angring={angring} onFerdig={() => setAngring(null)} />
          )}
        </div>
      )}
    </Kontekst.Provider>
  )
}

export function useRegisterhandling(): Registerhandling {
  const verdi = useContext(Kontekst)
  if (!verdi) throw new Error('useRegisterhandling må brukes i en Registerhandlingskilde.')
  return verdi
}
