import { Fragment } from 'react'
import { Kodepille } from './Kodepille'

export interface MetalinjeProps {
  /** Analyttkodene, i den rekkefølgen de står. Moduler med flere koder har alle. */
  koder: string[]
  /** Analysemetoden, f.eks. «SPFA». */
  metode: string
  /** Kategorien innenfor metoden. Utelates når metoden ikke er delt opp. */
  kategori?: string
  /**
   * Sant når kodene skal føre til stoffsiden — i fortolkningsmodulene.
   * På stoffsiden selv står koden som tekst.
   */
  lenker?: boolean
}

/**
 * Linjen over et stoffnavn i fortolkningsmodulene: «KVE · SPFA ›
 * Antipsykotika». Kodene står i aksentfargen; metoden og kategorien hører
 * sammen (Atlas `MetaLine`). Informasjonssiden har kategoriene fra
 * stoffregisteret over navnet i stedet, og koden og metoden under
 * (`Identitetspanel.tsx`).
 */
export function Metalinje({ koder, metode, kategori, lenker = false }: MetalinjeProps) {
  return (
    <p className="metalinje">
      {koder.map((kode, i) => (
        <Fragment key={kode}>
          {i > 0 && <span aria-hidden="true">·</span>}
          {lenker ? <Kodepille kode={kode} /> : <span className="metalinje__kode">{kode}</span>}
        </Fragment>
      ))}
      <span aria-hidden="true">·</span>
      <span>
        {metode}
        {kategori && (
          <>
            {' '}
            <span aria-hidden="true">›</span> {kategori}
          </>
        )}
      </span>
    </p>
  )
}
