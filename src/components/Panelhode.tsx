import type { ReactNode } from 'react'
import { Ikon } from './ikon/Ikon'
import type { Ikonnavn } from './ikon/register'

export interface PanelhodeProps {
  children: ReactNode
  /** Ikonet foran tittelen, fra Atlas-registeret. */
  ikon?: Ikonnavn
  /**
   * `toksisk` når panelet sier at noe mangler. Tittelen og ikonet sier det
   * også i ord og form, så fargen er aldri alene om det.
   */
  tone?: 'dempet' | 'toksisk'
  id?: string
}

/**
 * Overskriften i et panel: kursiv serif, dempet, med et valgfritt ikon foran
 * — «Målt konsentrasjon», «Kommentar», «Visualisering» (Atlas `Panel`).
 */
export function Panelhode({ children, ikon, tone = 'dempet', id }: PanelhodeProps) {
  return (
    <div className="panelhode" data-tone={tone}>
      {ikon && <Ikon navn={ikon} className="panelhode__ikon" />}
      <h2 className="panelhode__tittel" id={id}>
        {children}
      </h2>
    </div>
  )
}
