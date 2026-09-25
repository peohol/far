import { useEffect, useId, useRef, type ReactNode } from 'react'
import { Ikon } from './ikon/Ikon'
import type { Ikonnavn } from './ikon/register'
import { Ikonknapp } from './Ikonknapp'
import '../styles/modallag.css'

/**
 * Et modalt lag over appen — endringsloggen, kontopanelet, brukerlista,
 * historikken, publiseringen, preparatvinduet og redigeringsskjemaene på
 * stoffsiden.
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
 *
 * Med `fot` står en rad nederst i panelet som ikke ruller med kroppen, som
 * knappene i redigeringsskjemaene. Med `vedLukking` kan det som vises, holde
 * laget åpent — som et skjema med endringer som ikke er lagret.
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
  /** En rad nederst i panelet som står fast mens kroppen ruller. */
  fot?: ReactNode
  /**
   * Spørres før laget lukkes med Escape, lukkeknappen eller et klikk utenfor.
   * Gir den `false`, blir laget stående.
   */
  vedLukking?: () => boolean
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
  fot,
  vedLukking,
  children,
}: ModallagProps) {
  const dialog = useRef<HTMLDialogElement>(null)
  const tittelId = useId()
  const rik = meta != null || undertittel != null || merker != null

  // Et lag som forsvinner mens det står åpent — et skjema som er lagret eller
  // avbrutt — gir fokuset tilbake dit det kom fra, slik nettleseren gjør når
  // laget lukkes. Står fokuset alt et annet sted, får det stå.
  // (Fokus som alt står i laget, er ikke der det kom fra: effekten kan kjøres
  // to ganger i utviklingsmodus.)
  const fra = useRef<Element | null>(null)
  useEffect(() => {
    if (!apen) return
    const aktivt = document.activeElement
    if (!dialog.current?.contains(aktivt)) fra.current = aktivt
    return () => {
      const tapt = document.activeElement === null || document.activeElement === document.body
      const tilbake = fra.current
      if (tapt && tilbake instanceof HTMLElement && tilbake.isConnected) tilbake.focus()
    }
  }, [apen])

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

  const kanLukkes = () => vedLukking?.() !== false
  const lukk = () => {
    if (kanLukkes()) dialog.current?.close()
  }

  // Et klikk utenfor panelet treffer selve `<dialog>`, som fyller hele
  // vinduet. Panelet inni fanger sine egne klikk.
  const paaTrykk = (hendelse: React.MouseEvent<HTMLDialogElement>) => {
    if (hendelse.target === dialog.current) lukk()
  }

  // Escape går gjennom nettleserens `cancel`, som kan stanses før laget lukkes.
  const paaAvbryt = (hendelse: React.SyntheticEvent<HTMLDialogElement>) => {
    if (!kanLukkes()) hendelse.preventDefault()
  }

  // Men nettleseren lar ikke `cancel` stanses to ganger på rad uten et klikk
  // imellom, og lukker da laget uansett. Når laget kan ville bli stående, tar
  // det derfor Escape selv, før nettleseren gjør det. Et felt inni som alt har
  // brukt tasten, går foran.
  const paaTast = (hendelse: React.KeyboardEvent<HTMLDialogElement>) => {
    if (!vedLukking || hendelse.key !== 'Escape' || hendelse.defaultPrevented) return
    hendelse.preventDefault()
    lukk()
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
        onClick={lukk}
      />
    </>
  )

  return (
    <dialog
      ref={dialog}
      className={['modallag', ark && 'modallag--ark'].filter(Boolean).join(' ')}
      aria-labelledby={tittelId}
      onClick={paaTrykk}
      onCancel={paaAvbryt}
      onKeyDown={paaTast}
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
        {fot && <div className="modallag__fot">{fot}</div>}
      </div>
    </dialog>
  )
}
