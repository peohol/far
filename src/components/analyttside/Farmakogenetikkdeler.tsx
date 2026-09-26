import type { ReactNode } from 'react'
import { Ikon } from '../ikon/Ikon'
import { Uthev } from '../Uthev'

/**
 * Byggeklossene «Farmakogenetikk» bruker for dataene fra ClinPGx og CPIC:
 * gruppene med detaljkort og lenkene ut til kildene.
 */

/** En gruppe detaljkort med en overskrift som ikke er en egen skuff; siden har bare to nivåer. */
export function Gruppe({
  tittel,
  ingress,
  dempet,
  children,
}: {
  tittel: string
  /** En kort tekst under overskriften om hva gruppen er. */
  ingress?: ReactNode
  dempet?: boolean
  children: ReactNode
}) {
  return (
    <div className="farmakogenetikk__gruppe" data-dempet={dempet || undefined}>
      <p className="farmakogenetikk__gruppetittel" role="heading" aria-level={3}>
        <Uthev tekst={tittel} />
      </p>
      {ingress && <p className="farmakogenetikk__ingress">{ingress}</p>}
      <ul className="interaksjonsliste">{children}</ul>
    </div>
  )
}

/** En lenke ut til kilden, som åpnes i en ny fane. */
export function Kildelenke({ lenke, children }: { lenke: string; children: ReactNode }) {
  return (
    <a className="preparatlenke" href={lenke} target="_blank" rel="noopener noreferrer">
      <Ikon navn="ext" />
      {children}
      <span className="kun-skjermleser"> (åpnes i ny fane)</span>
    </a>
  )
}
