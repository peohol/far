import { Ikonknapp } from './Ikonknapp'

/** Tilbake til fortolkningen fra en side over den. `Escape` gjør det samme (se `useLukkMedEscape`). */
export function Lukkeknapp({ onLukk }: { onLukk: () => void }) {
  return <Ikonknapp ikon="close" etikett="Lukk" aria-keyshortcuts="Escape" onClick={onLukk} />
}
