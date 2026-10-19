import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * Plassene i toppmenyen en side kan fylle med sitt eget, i to grupper og i den
 * rekkefølgen de står i menyen. Rekkefølgen er den samme om plassene står i
 * toppmenyen, på én rad i dokken eller på to:
 *
 * - `hoved` (første rad i dokken når den går over to):
 *   - `sidesok`: søket i den åpne siden (monografiens lokale søk)
 *   - `hovedhandling`: sidens hovedhandling, som «Åpne fortolkning» eller
 *     «Publiser»
 * - `handlinger` (andre rad):
 *   - `favoritt`: det brukeren merker siden med for seg selv
 *   - `diskusjoner` og `endringslogg`: samtalen om siden og historikken dens
 *   - `redigering`: å endre siden — «Rediger», menyen med mer for siden og
 *     statusen mens den redigeres
 *   - `lukk`: veien ut — «Lukk» eller «Avslutt redigering», alltid sist
 *
 * På smale flater flytter alle ned i dokken nederst i vinduet. Globalt
 * fagsøk har sin egen plass (`Toppmeny` sin `sok`), fordi det hører til
 * appen og ikke til siden som står åpen.
 */
export const TOPPMENYSPOR = {
  hoved: ['sidesok', 'hovedhandling'],
  handlinger: ['favoritt', 'diskusjoner', 'endringslogg', 'redigering', 'lukk'],
} as const

export type Toppmenygruppe = keyof typeof TOPPMENYSPOR
export type Toppmenyspor = (typeof TOPPMENYSPOR)[Toppmenygruppe][number]

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
