import type { ReactNode } from 'react'

/**
 * Den dempede raden over hovedinnholdet i hvert steg. Her bor Esc-handlingen,
 * så «angre» alltid ligger på samme sted uansett hvor i flyten man er.
 */
export function StepBar({ children }: { children?: ReactNode }) {
  return <div className="stegbar">{children}</div>
}
