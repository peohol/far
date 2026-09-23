import { useId } from 'react'
import { referanseoppforinger } from '../../faginnhold/referanser'
import { Referansetekst } from './Referansetekst'
import { useSidereferanser } from './Sidereferanser'

/** ID-en en referanse har i listen nederst på siden. */
export function listeId(referanse: string): string {
  return `referanse-${referanse}`
}

/**
 * Listen nederst på siden: alle referansene som faktisk brukes der, i samme
 * rekkefølge som numrene. Den bygges av nummereringen hver gang og redigeres
 * aldri for hånd. Uten referanser vises ingenting.
 */
export function Referanseliste({ tittel = 'Referanser' }: { tittel?: string }) {
  const { nummerering, referanser } = useSidereferanser()
  const overskrift = useId()
  const liste = referanseoppforinger(nummerering, referanser.values())
  if (liste.length === 0) return null

  return (
    <section className="referanseliste" aria-labelledby={overskrift}>
      <h2 id={overskrift} className="referanseliste__tittel">
        {tittel}
      </h2>
      <ol className="referanseliste__liste">
        {liste.map(({ nummer, referanse }) => (
          <li key={referanse.id} id={listeId(referanse.id)} value={nummer} className="referanseliste__punkt">
            <Referansetekst referanse={referanse} />
          </li>
        ))}
      </ol>
    </section>
  )
}
