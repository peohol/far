import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * Plassene i toppmenyen en side kan fylle med sitt eget:
 *
 * - `sidesok`: søket i den åpne siden (monografens lokale søk)
 * - `handlinger`: sidens egne handlinger — for monografen «Åpne
 *   fortolkning», «Rediger» og «Lukk»
 *
 * På smale flater flytter begge ned i dokken nederst i vinduet. Globalt
 * fagsøk har sin egen plass (`Toppmeny` sin `sok`), fordi det hører til
 * appen og ikke til siden som står åpen.
 */
export type Toppmenyspor = 'sidesok' | 'handlinger'

type Spor = Partial<Record<Toppmenyspor, HTMLElement | null>>

interface Kontekst {
  spor: Spor
  meld: (navn: Toppmenyspor, element: HTMLElement | null) => void
}

const ToppmenyKontekst = createContext<Kontekst | null>(null)

/**
 * Forbindelsen mellom toppmenyen og sidene under den. Ligger rundt begge, så
 * en side kan legge knappene sine i menyen og likevel beholde sin egen
 * tilstand og sine egne kontekster (seksjonsstyring, redigering osv.) — de
 * tegnes med en portal, som tar konteksten med seg.
 */
export function ToppmenyKilde({ children }: { children: ReactNode }) {
  const [spor, setSpor] = useState<Spor>({})
  // Fast identitet: den brukes som ref, og en ny ref for hver endring ville
  // meldt plassen av og på igjen i det uendelige.
  const meld = useCallback(
    (navn: Toppmenyspor, element: HTMLElement | null) =>
      setSpor((forrige) => (forrige[navn] === element ? forrige : { ...forrige, [navn]: element })),
    [],
  )
  const verdi = useMemo<Kontekst>(() => ({ spor, meld }), [spor, meld])
  return <ToppmenyKontekst.Provider value={verdi}>{children}</ToppmenyKontekst.Provider>
}

/** Toppmenyen melder fra om plassene sine med denne, som ref på elementet. */
export function useMeldSpor(navn: Toppmenyspor) {
  const kontekst = useContext(ToppmenyKontekst)
  const meld = kontekst?.meld
  return useMemo(() => (element: HTMLElement | null) => meld?.(navn, element), [meld, navn])
}

export interface ToppmenyInnholdProps {
  spor: Toppmenyspor
  children: ReactNode
}

/**
 * Legger innholdet i toppmenyens plass. Står siden uten toppmeny rundt seg —
 * som i en test av siden alene — blir innholdet stående der det er skrevet,
 * så ingen knapp forsvinner.
 */
export function ToppmenyInnhold({ spor, children }: ToppmenyInnholdProps) {
  const kontekst = useContext(ToppmenyKontekst)
  if (!kontekst) return <div className="toppmeny__reserve">{children}</div>
  const plass = kontekst.spor[spor]
  // Menyen tegnes før sidene, så plassen finnes fra første oppdatering.
  return plass ? createPortal(children, plass) : null
}
