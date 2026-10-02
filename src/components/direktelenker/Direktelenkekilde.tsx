import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { navnPaaSide, type Diskusjonsside, type Diskusjonssider } from '../../diskusjoner/modell'

interface Direktelenkekontekst {
  /** Navnet på siden en tråd står på, slik lenkebrikkene viser det. */
  sidenavn: (side: Diskusjonsside) => string
}

const INGEN_SIDER: Diskusjonssider = { fagsider: [], fortolkninger: [] }

const Kontekst = createContext<Direktelenkekontekst>({ sidenavn: (side) => navnPaaSide(INGEN_SIDER, side) })

/** Navnene på sidene diskusjonene kan stå på, til lenkebrikkene i tekstene. Står rundt appen. */
export function Direktelenkekilde({ sider, children }: { sider: Diskusjonssider; children: ReactNode }) {
  const verdi = useMemo<Direktelenkekontekst>(() => ({ sidenavn: (side) => navnPaaSide(sider, side) }), [sider])
  return <Kontekst.Provider value={verdi}>{children}</Kontekst.Provider>
}

export function useDirektelenkekilde(): Direktelenkekontekst {
  return useContext(Kontekst)
}
