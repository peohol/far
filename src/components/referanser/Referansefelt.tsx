import type { Referanseniva } from '../../faginnhold/modell'
import { numreFor } from '../../faginnhold/referanser'
import { Referansepille } from './Referansepille'
import { useSidereferanser } from './Sidereferanser'
import '../../styles/referanser.css'

/** Hva feltet gjelder, som hjelpetekst. */
const GJELDER: Record<Exclude<Referanseniva, 'inline'>, string> = {
  panel: 'Gjelder hele seksjonen',
  element: 'Gjelder hele kortet',
}

/**
 * Referansefeltet nederst i et panel eller kort: kildene som gjelder hele
 * beholderen, som nummerpille, avgrenset fra teksten over. Står en automatisk
 * datakilde blant dem, som FEST, står sporbarheten hennes — uttrekket og
 * kontrollen — diskret ved siden av, i stedet for en løpende «Kilde: …» i
 * innholdet.
 *
 * Uten referanser siden kjenner, vises ingenting.
 */
export function Referansefelt({
  ider,
  niva = 'element',
}: {
  ider: readonly string[]
  niva?: Exclude<Referanseniva, 'inline'>
}) {
  const { nummerering, referanser } = useSidereferanser()
  if (numreFor(ider, nummerering).length === 0) return null
  const opphav = [
    ...new Set(ider.flatMap((id) => referanser.get(id)?.automatisk?.opphav ?? [])),
  ]

  return (
    <div className={`referansefelt referansefelt--${niva}`} title={GJELDER[niva]}>
      <span className="referansefelt__etikett">Kilder</span>
      <Referansepille ider={ider} niva={niva} />
      {opphav.length > 0 && (
        <span className="referansefelt__opphav">
          {opphav.map((tekst) => (
            <span key={tekst}>{tekst} · kan ikke redigeres</span>
          ))}
        </span>
      )}
    </div>
  )
}
