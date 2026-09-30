import { useRef } from 'react'

/**
 * Et trykk på bakgrunnen bak et lag — utenfor panelet i en modal, eller på
 * mørkleggingen bak sidemenyen — skal lukke laget. Men bare når trykket både
 * begynner og slutter der: den som markerer tekst i laget og slipper
 * museknappen utenfor, eller trykker utenfor og slipper i laget, har ikke
 * trykket utenfor. Nettleseren sender da likevel et klikk til den nærmeste
 * felles forelderen, som for en `<dialog>` er selve bakgrunnen — derfor
 * holdes det rede på hvor trykket begynte og hvor det sluttet.
 *
 * Gir hendelsene som skal på elementet som er bakgrunnen. `vedTrykk` kalles
 * bare når trykket traff elementet selv, ikke noe inni det.
 */
export function useTrykkUtenfor<T extends HTMLElement>(vedTrykk: () => void) {
  const begynte = useRef(false)
  const sluttet = useRef(false)
  const paaSelve = (hendelse: React.SyntheticEvent<T>) => hendelse.target === hendelse.currentTarget
  return {
    onPointerDown: (hendelse: React.PointerEvent<T>) => {
      begynte.current = paaSelve(hendelse)
      sluttet.current = false
    },
    onPointerUp: (hendelse: React.PointerEvent<T>) => {
      sluttet.current = paaSelve(hendelse)
    },
    onClick: (hendelse: React.MouseEvent<T>) => {
      const utenfor = begynte.current && sluttet.current && paaSelve(hendelse)
      begynte.current = false
      sluttet.current = false
      if (utenfor) vedTrykk()
    },
  }
}
