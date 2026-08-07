import type { CSSProperties } from 'react'
import { CopyIcon } from './icons'
import type { Flash } from '../hooks/useCopyFlash'

export interface CopyFlashProps {
  flash: Flash
  /** Hvor lenge blinket varer. Samme tall som rydder det bort igjen. */
  varighet: number
}

/**
 * Kvitteringen som bekrefter at kommentaren ligger på utklippstavlen.
 *
 * Den ligger fast i vinduet, rett over knappen som ble brukt, og overlever
 * derfor at steget under byttes ut midt i animasjonen.
 */
export function CopyFlash({ flash, varighet }: CopyFlashProps) {
  return (
    <div
      className="kopiblink"
      style={
        {
          left: `${flash.x}px`,
          top: `${flash.y}px`,
          '--blink-tid': `${varighet}ms`,
        } as CSSProperties
      }
      aria-hidden="true"
    >
      <CopyIcon className="kopiblink__ikon" />
      Kopiert
    </div>
  )
}
