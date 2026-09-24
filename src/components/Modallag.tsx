import { useEffect, useId, useRef, type ReactNode } from 'react'
import { CloseIcon } from './icons'
import { Ikon } from './ikon/Ikon'
import type { Ikonnavn } from './ikon/register'
import '../styles/modallag.css'

/**
 * Et modalt lag over appen — kontopanelet, brukerlista, historikken og
 * preparatvinduet i dag.
 *
 * Bygget på `<dialog>` med `showModal()`, på samme måte som endringsloggen:
 * nettleseren gir fokusfelle, lukking med Escape, bakgrunn som ikke kan
 * klikkes, og fokuset tilbake dit det kom fra. Appens egne taster holder seg
 * i ro så lenge laget står åpent — vakten mot det ligger i `lagLiggerOver()`.
 */
export interface ModallagProps {
  apen: boolean
  tittel: string
  onLukk: () => void
  /** Ekstra innhold øverst til høyre, ved siden av lukkeknappen. */
  handling?: ReactNode
  /** Bredere panel, for innhold som står side om side. */
  bred?: boolean
  /** Den lille linjen i versaler over tittelen, f.eks. «Kvetiapin · Depottablett». */
  meta?: ReactNode
  /** Ikonet i sirkelen foran tittelen. */
  ikon?: Ikonnavn
  /** Linjen under tittelen, f.eks. produsenten. */
  undertittel?: ReactNode
  /** Merkene under tittelen. */
  merker?: ReactNode
  /** Navnet på lukkeknappen. Ellers «Lukk» og tittelen. */
  lukketekst?: string
  /** Blir et ark nedenfra på smale flater. */
  ark?: boolean
  children: ReactNode
}

export function Modallag({
  apen,
  tittel,
  onLukk,
  handling,
  bred,
  meta,
  ikon,
  undertittel,
  merker,
  lukketekst,
  ark,
  children,
}: ModallagProps) {
  const dialog = useRef<HTMLDialogElement>(null)
  const tittelId = useId()
  const rik = meta != null || ikon != null || undertittel != null || merker != null

  useEffect(() => {
    const el = dialog.current
    if (!el) return
    if (apen && !el.open) el.showModal()
    else if (!apen && el.open) el.close()
  }, [apen])

  // Alle veier ut — Escape, klikk på bakgrunnen, lukkeknappen — ender i
  // nettleserens egen `close`, så tilstanden utenfor holdes i takt ett sted.
  useEffect(() => {
    const el = dialog.current
    if (!el) return
    el.addEventListener('close', onLukk)
    return () => el.removeEventListener('close', onLukk)
  }, [onLukk])

  // Et klikk utenfor panelet treffer selve `<dialog>`, som fyller hele
  // vinduet. Panelet inni fanger sine egne klikk.
  const paaTrykk = (hendelse: React.MouseEvent<HTMLDialogElement>) => {
    if (hendelse.target === dialog.current) dialog.current?.close()
  }

  const handlinger = (
    <div className="modallag__handlinger">
      {handling}
      <button
        type="button"
        className="logg__lukk"
        aria-label={lukketekst ?? `Lukk ${tittel.toLowerCase()}`}
        onClick={() => dialog.current?.close()}
      >
        <CloseIcon />
      </button>
    </div>
  )

  return (
    <dialog
      ref={dialog}
      className={['logg', 'modallag', ark && 'modallag--ark'].filter(Boolean).join(' ')}
      aria-labelledby={tittelId}
      onClick={paaTrykk}
    >
      <div className={bred ? 'logg__panel modallag--bred' : 'logg__panel'}>
        {rik ? (
          <div className="modallag__hode">
            <div className="modallag__metarad">
              <p className="modallag__meta">{meta}</p>
              {handlinger}
            </div>
            <div className="modallag__identitet">
              {ikon && (
                <span className="modallag__ikon">
                  <Ikon navn={ikon} />
                </span>
              )}
              <div className="modallag__navn">
                <h2 id={tittelId} className="modallag__tittel">
                  {tittel}
                </h2>
                {undertittel && <p className="modallag__undertittel">{undertittel}</p>}
              </div>
            </div>
            {merker && <div className="modallag__merker">{merker}</div>}
          </div>
        ) : (
          <div className="logg__topp">
            <h2 id={tittelId} className="logg__tittel">
              {tittel}
            </h2>
            {handlinger}
          </div>
        )}

        <div className="modallag__kropp">{children}</div>
      </div>
    </dialog>
  )
}
