import { useId } from 'react'
import type { Referanseniva } from '../../faginnhold/modell'
import { formaterReferanse, komprimer, numreFor, type Referanse } from '../../faginnhold/referanser'
import { useFestbarBoble } from '../../hooks/useFestbarBoble'
import { useBobleplassering } from '../Tips'
import { Referansetekst } from './Referansetekst'
import { useSidereferanser } from './Sidereferanser'
import '../../styles/referanser.css'

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
 * mellomrom, og festes med et klikk, så lenkene kan nås (`useFestbarBoble`).
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
  const { apen, feste, knapp } = useFestbarBoble()

  if (oppforinger.length === 0) return null
  const tekst = komprimer(numre)
  return (
    <span {...feste} className={`referansepille-feste referansepille-feste--${niva}`}>
      <button
        {...knapp}
        type="button"
        className={`referansepille referansepille--${niva}`}
        aria-label={`${oppforinger.length === 1 ? 'Referanse' : 'Referanser'} ${tekst}`}
        aria-controls={apen ? bobleId : undefined}
      >
        {tekst}
      </button>
      {apen && knapp.ref.current && (
        <Referanseboble id={bobleId} anker={knapp.ref.current} oppforinger={oppforinger} />
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
