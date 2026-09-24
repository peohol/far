import { useEffect, useId, useRef, type ReactNode } from 'react'
import { Ikon } from './ikon/Ikon'
import type { Ikonnavn } from './ikon/register'
import { Ikonknapp } from './Ikonknapp'
import '../styles/modallag.css'

/**
 * Et modalt lag over appen — endringsloggen, kontopanelet, brukerlista,
 * historikken, publiseringen og preparatvinduet.
 *
 * Bygget på `<dialog>` med `showModal()`. Nettleseren gir da fokusfelle,
 * lukking med Escape, bakgrunn som ikke kan klikkes, og fokuset tilbake dit
 * det kom fra — alt sammen uten egen kode, og mer robust enn en håndskrevet
 * variant ville blitt. Appens egne taster holder seg i ro så lenge laget
 * står åpent — vakten mot det ligger i `lagLiggerOver()`.
 *
 * Hodet er enkelt (ikon, tittel og knapper på én rad) eller, med `meta`,
 * `undertittel` eller `merker`, et hevet hode med identiteten til det som
 * vises, som i preparatvinduet.
 */
export interface ModallagProps {
  apen: boolean
  tittel: string
  onLukk: () => void
  /** Ikonet i sirkelen foran tittelen. */
  ikon?: Ikonnavn
  /** Ekstra innhold øverst til høyre, ved siden av lukkeknappen. */
  handling?: ReactNode
  /** Bredere panel, for innhold som står side om side. */
  bred?: boolean
  /** Den lille linjen i versaler over tittelen, f.eks. «Kvetiapin · Depottablett». */
  meta?: ReactNode
  /** Linjen under tittelen, f.eks. produsenten. */
  undertittel?: ReactNode
  /** Merkene under tittelen. */
  merker?: ReactNode
  /** Navnet på lukkeknappen. Ellers «Lukk» og tittelen. */
  lukketekst?: string
  /** Blir et ark nedenfra på smale flater. */
  ark?: boolean
  /**
   * Hvor fokus skal stå når laget åpnes (en CSS-velger i laget). Uten den
   * lander fokus der nettleseren finner det første fokuserbare.
   */
  autofokus?: string
  /** Innholdet står rett i panelet, uten den vanlige luften rundt. */
  tettKropp?: boolean
  children: ReactNode
}

export function Modallag({
  apen,
  tittel,
  onLukk,
  ikon,
  handling,
  bred,
  meta,
  undertittel,
  merker,
  lukketekst,
  ark,
  autofokus,
  tettKropp,
  children,
}: ModallagProps) {
  const dialog = useRef<HTMLDialogElement>(null)
  const tittelId = useId()
  const rik = meta != null || undertittel != null || merker != null

  useEffect(() => {
    const el = dialog.current
    if (!el) return
    if (apen && !el.open) {
      el.showModal()
      if (autofokus) el.querySelector<HTMLElement>(autofokus)?.focus()
    } else if (!apen && el.open) {
      el.close()
    }
  }, [apen, autofokus])

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

  const ikonsirkel = ikon && (
    <span className="modallag__ikon">
      <Ikon navn={ikon} storrelse="underpunkt" />
    </span>
  )
  const overskrift = (
    <h2 id={tittelId} className="modallag__tittel">
      {tittel}
    </h2>
  )
  // På smale flater får den ekstra handlingen en egen rad under tittelen,
  // så tittelen ikke blir presset sammen.
  const handlinger = (
    <>
      {handling && <div className="modallag__handling">{handling}</div>}
      <Ikonknapp
        ikon="close"
        etikett={lukketekst ?? `Lukk ${tittel.charAt(0).toLowerCase()}${tittel.slice(1)}`}
        utenTips
        onClick={() => dialog.current?.close()}
      />
    </>
  )

  return (
    <dialog
      ref={dialog}
      className={['modallag', ark && 'modallag--ark'].filter(Boolean).join(' ')}
      aria-labelledby={tittelId}
      onClick={paaTrykk}
    >
      <div className={['modallag__panel', bred && 'modallag__panel--bred'].filter(Boolean).join(' ')}>
        {rik ? (
          <div className="modallag__hode">
            <div className="modallag__metarad">
              <p className="modallag__meta">{meta}</p>
              {handlinger}
            </div>
            <div className="modallag__identitet">
              {ikonsirkel}
              <div className="modallag__navn">
                {overskrift}
                {undertittel && <p className="modallag__undertittel">{undertittel}</p>}
              </div>
            </div>
            {merker && <div className="modallag__merker">{merker}</div>}
          </div>
        ) : (
          <div className="modallag__topp">
            {ikonsirkel}
            {overskrift}
            {handlinger}
          </div>
        )}

        <div className={tettKropp ? 'modallag__kropp modallag__kropp--tett' : 'modallag__kropp'}>
          {children}
        </div>
      </div>
    </dialog>
  )
}
