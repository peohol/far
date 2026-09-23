import { useEffect, useId, useRef, type ReactNode } from 'react'
import { CloseIcon } from './icons'

/**
 * Et modalt lag over appen — kontopanelet og brukerlista i dag.
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
  children: ReactNode
}

export function Modallag({ apen, tittel, onLukk, handling, bred, children }: ModallagProps) {
  const dialog = useRef<HTMLDialogElement>(null)
  const tittelId = useId()

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

  return (
    <dialog ref={dialog} className="logg modallag" aria-labelledby={tittelId} onClick={paaTrykk}>
      <div className={bred ? 'logg__panel modallag--bred' : 'logg__panel'}>
        <div className="logg__topp">
          <h2 id={tittelId} className="logg__tittel">
            {tittel}
          </h2>
          <div className="modallag__handlinger">
            {handling}
            <button
              type="button"
              className="logg__lukk"
              aria-label={`Lukk ${tittel.toLowerCase()}`}
              onClick={() => dialog.current?.close()}
            >
              <CloseIcon />
            </button>
          </div>
        </div>

        <div className="modallag__kropp">{children}</div>
      </div>
    </dialog>
  )
}
