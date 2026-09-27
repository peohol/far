import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { visningsnavn, type Profil } from '@delt/profil'
import { useAvatarlenker } from '../../auth/avatarer'
import { useProfil } from '../../auth/okt'
import { Avatar, type Avatarstorrelse } from '../konto/Avatar'

/**
 * Det alle delene av idévinduet trenger: hvem som er logget inn, om det er en
 * administrator, og profilene og profilbildene til dem som har skrevet noe.
 * Profilene hentes én gang når vinduet åpnes.
 */
interface Idekontekst {
  meg: Profil
  admin: boolean
  profiler: ReadonlyMap<string, Profil>
  lenker: ReadonlyMap<string, string>
}

const Kontekst = createContext<Idekontekst | null>(null)

export function Idekilde({ profiler, children }: { profiler: readonly Profil[]; children: ReactNode }) {
  const meg = useProfil()
  const lenker = useAvatarlenker(profiler as Profil[])
  const verdi = useMemo(
    () => ({ meg, admin: meg.role === 'admin', profiler: new Map(profiler.map((p) => [p.id, p])), lenker }),
    [meg, profiler, lenker],
  )
  return <Kontekst.Provider value={verdi}>{children}</Kontekst.Provider>
}

export function useIdekontekst(): Idekontekst {
  const verdi = useContext(Kontekst)
  if (!verdi) throw new Error('Idévinduet mangler konteksten sin.')
  return verdi
}

/** Profilen til en forfatter. Den innloggede er alltid med, også før profilene er hentet. */
export function useForfatter(id: string | null): Profil | null {
  const { meg, profiler } = useIdekontekst()
  if (id === null) return null
  return profiler.get(id) ?? (id === meg.id ? meg : null)
}

/** Profilbildet til en forfatter, eller en tom sirkel for en slettet kommentar. */
export function Forfatterbilde({ id, storrelse }: { id: string | null; storrelse: Avatarstorrelse }) {
  const { lenker } = useIdekontekst()
  const profil = useForfatter(id)
  if (!profil) return <span className={`avatar avatar--${storrelse} avatar--tom`} aria-hidden="true" />
  const lenke = profil.avatar_path ? (lenker.get(profil.avatar_path) ?? null) : null
  return <Avatar profil={profil} lenke={lenke} storrelse={storrelse} />
}

export function useForfatternavn(id: string | null): string {
  const profil = useForfatter(id)
  return profil ? visningsnavn(profil) : 'Ukjent bruker'
}
