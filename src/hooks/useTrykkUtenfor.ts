import { useRef } from 'react'

/**
 * Et trykk på bakgrunnen bak et lag — utenfor panelet i en modal, eller på
 * mørkleggingen bak sidemenyen — skal lukke laget. Men bare når trykket både
 * begynner og slutter der: den som markerer tekst i laget og slipper
 * museknappen utenfor, har ikke trykket utenfor. Nettleseren sender da
 * likevel et klikk til den nærmeste felles forelderen, som for en `<dialog>`
 * er selve bakgrunnen.
 *
 * Gir hendelsene som skal på elementet som er bakgrunnen. `vedTrykk` kalles
 * bare når trykket traff elementet selv, ikke noe inni det.
 */
export function useTrykkUtenfor<T extends HTMLElement>(vedTrykk: () => void) {
  const startetUtenfor = useRef(false)
  return {
    onPointerDown: (hendelse: React.PointerEvent<T>) => {
      startetUtenfor.current = hendelse.target === hendelse.currentTarget
    },
    onClick: (hendelse: React.MouseEvent<T>) => {
      const startet = startetUtenfor.current
      startetUtenfor.current = false
      if (startet && hendelse.target === hendelse.currentTarget) vedTrykk()
    },
  }
}
