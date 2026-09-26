import { useId } from 'react'
import { referanseoppforinger } from '../../faginnhold/referanser'
import { useLaastMerknad } from './laas'
import { Referansetekst } from './Referansetekst'
import { useSidereferanser } from './Sidereferanser'
import '../../styles/referanser.css'

/** ID-en en referanse har i listen nederst på siden. */
export function listeId(referanse: string): string {
  return `referanse-${referanse}`
}

/**
 * Listen nederst på siden: alle referansene som faktisk brukes der, i samme
 * rekkefølge som numrene. Den bygges av nummereringen hver gang og redigeres
 * aldri for hånd. Redaksjonelle og automatiske referanser står sammen; de
 * automatiske er merket, med sporbarheten og lenkene kilden krever (som
 * lisensen) under teksten. Det er det eneste
 * stedet hele referanseteksten står fast på siden. Uten referanser vises
 * ingenting.
 */
export function Referanseliste({ tittel = 'Referanser' }: { tittel?: string }) {
  const { nummerering, referanser } = useSidereferanser()
  const laast = useLaastMerknad()
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
            {referanse.automatisk && (
              <span className="referanseliste__automatisk">
                <span className="referansemerke">{laast(`Automatisk fra ${referanse.automatisk.kilde}`)}</span>
                {referanse.automatisk.opphav && <span>{referanse.automatisk.opphav}</span>}
                {referanse.automatisk.lenker?.map(({ tekst, lenke }) => (
                  <a key={lenke} href={lenke} target="_blank" rel="noopener noreferrer">
                    {tekst}
                  </a>
                ))}
              </span>
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}
