import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent,
} from 'react'
import type { Referanseniva } from '../../faginnhold/modell'
import { formaterReferanse, komprimer, numreFor, type Referanse } from '../../faginnhold/referanser'
import { useBobleplassering } from '../Tips'
import { Referansetekst } from './Referansetekst'
import { useSidereferanser } from './Sidereferanser'
import '../../styles/referanser.css'

/**
 * Hvor lenge boblen blir stående etter at pekeren har forlatt pillen, så den
 * rekker å flytte seg over luften og inn i boblen.
 */
export const LUKKETID = 150

export interface ReferansepilleProps {
  /** Referansene siteringen viser til, i den rekkefølgen de er lagret. */
  ider: readonly string[]
  /**
   * `inline` står i tekstlinjen. `element` og `panel` står for seg, i
   * referansefeltet nederst i kortet eller panelet (`Referansefelt`).
   */
  niva?: Referanseniva
}

/**
 * En sitering: numrene på siden i en liten pille, komprimert som i Slaids
 * («1–3, 5»), med referansene selv i en boble.
 *
 * Boblen åpnes ved peker over pillen, og ved klikk, trykk, Enter eller
 * mellomrom. Et klikk fester den, så lenkene kan nås; et nytt klikk, Escape,
 * et trykk utenfor eller fokus som går videre, lukker den. Boblen står i
 * dokumentet rett etter knappen, så tastaturet og skjermlesere når den i
 * vanlig rekkefølge.
 *
 * Viser ingen av ID-ene til en referanse siden kjenner, vises ingenting.
 */
export function Referansepille({ ider, niva = 'inline' }: ReferansepilleProps) {
  const { nummerering, referanser } = useSidereferanser()
  const numre = numreFor(ider, nummerering)
  const oppforinger = numre.flatMap((nummer) => {
    const id = ider.find((i) => nummerering.get(i) === nummer)
    const referanse = id ? referanser.get(id) : undefined
    return referanse ? [{ nummer, referanse }] : []
  })

  const bobleId = useId()
  const feste = useRef<HTMLElement>(null)
  const knapp = useRef<HTMLButtonElement>(null)
  const [peker, setPeker] = useState(false)
  const [festet, setFestet] = useState(false)
  const lukking = useRef<ReturnType<typeof setTimeout>>()
  const apen = peker || festet

  const avbrytLukking = () => clearTimeout(lukking.current)
  useEffect(() => avbrytLukking, [])

  const lukk = useCallback(() => {
    clearTimeout(lukking.current)
    setPeker(false)
    setFestet(false)
  }, [])

  // Et trykk utenfor lukker. På berøring kommer det ingen «pekeren forlot».
  useEffect(() => {
    if (!apen) return
    const paaTrykk = (event: Event) => {
      if (event.target instanceof Node && feste.current?.contains(event.target)) return
      lukk()
    }
    document.addEventListener('pointerdown', paaTrykk, true)
    return () => document.removeEventListener('pointerdown', paaTrykk, true)
  }, [apen, lukk])

  if (oppforinger.length === 0) return null
  const tekst = komprimer(numre)
  return (
    <span
      ref={feste}
      className={`referansepille-feste referansepille-feste--${niva}`}
      // Berøring åpner med trykket, ikke med «pekeren kom»: ellers ville
      // trykket åpnet og lukket boblen i samme bevegelse.
      onPointerEnter={(event: PointerEvent) => {
        if (event.pointerType === 'touch') return
        avbrytLukking()
        setPeker(true)
      }}
      onPointerLeave={(event: PointerEvent) => {
        if (event.pointerType === 'touch') return
        avbrytLukking()
        lukking.current = setTimeout(() => setPeker(false), LUKKETID)
      }}
      onBlur={(event: FocusEvent) => {
        const neste = event.relatedTarget
        if (neste instanceof Node && feste.current?.contains(neste)) return
        setFestet(false)
      }}
      onKeyDown={(event: KeyboardEvent) => {
        if (event.key !== 'Escape' || !apen) return
        event.stopPropagation()
        lukk()
        knapp.current?.focus()
      }}
    >
      <button
        ref={knapp}
        type="button"
        className={`referansepille referansepille--${niva}`}
        aria-label={`${oppforinger.length === 1 ? 'Referanse' : 'Referanser'} ${tekst}`}
        aria-expanded={apen}
        aria-controls={apen ? bobleId : undefined}
        onClick={() => {
          if (festet) lukk()
          else setFestet(true)
        }}
      >
        {tekst}
      </button>
      {apen && knapp.current && (
        <Referanseboble id={bobleId} anker={knapp.current} oppforinger={oppforinger} />
      )}
    </span>
  )
}

function Referanseboble({
  id,
  anker,
  oppforinger,
}: {
  id: string
  anker: HTMLElement
  oppforinger: { nummer: number; referanse: Referanse }[]
}) {
  // Boblen måles på nytt bare når teksten i den endres, ikke ved hver tegning.
  const tekst = oppforinger.map((o) => `${o.nummer} ${formaterReferanse(o.referanse)}`).join('\n')
  const { boble, innhold, klasser, stil } = useBobleplassering<HTMLSpanElement>(anker, tekst)
  // Spenn, ikke div og ol: pillen står ofte inne i et avsnitt, der bare
  // tekstnivå-elementer er gyldige. Rollene gir listen tilbake til
  // skjermleserne.
  return (
    <span ref={boble} id={id} className={`${klasser} tipsboble--interaktiv referanseboble`} style={stil}>
      <span ref={innhold} className="tipsboble__innhold referanseboble__innhold" role="list">
        {oppforinger.map(({ nummer, referanse }) => (
          <span key={referanse.id} role="listitem" className="referanseboble__punkt">
            <span className="referanseboble__nummer">{nummer}</span>
            <span className="referanseboble__tekst">
              <Referansetekst referanse={referanse} />
            </span>
          </span>
        ))}
      </span>
    </span>
  )
}
