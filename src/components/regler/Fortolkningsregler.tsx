import { useId, useState } from 'react'
import { endredeFelt } from '../../faginnhold/historikk'
import type { Utgave } from '../../faginnhold/lesing'
import type { Intervallregelsett } from '../../regler/modell'
import { regelsettfelter } from '../../regler/visning'
import { Button } from '../Button'
import { Sistredigert } from '../historikk/Sistredigert'
import { Regelredigering, type RegelredigeringProps } from './Regelredigering'
import { Regelsimulator, Regeltabell } from './Regeltabell'

/** Ankeret seksjonen har på siden. */
export const FORTOLKNING_ANKER = 'panel-fortolkning'

/**
 * Fortolkningsreglene for koden, på informasjonssiden: kommentaren hver
 * konsentrasjon gir, og en simulator for å prøve en verdi.
 *
 * Regelsettet er et eget objekt og ikke en del av informasjonssiden; det
 * vises her fordi det gjelder koden siden hører til. I redigeringsmodus kan
 * administratorer endre det, se hva som ikke er publisert og åpne
 * historikken.
 */
export function Fortolkningsregler({
  utgave,
  publisert,
  redigerer,
  onLagre,
  hentNyeste,
}: {
  utgave: Utgave<Intervallregelsett> | null
  /** Det publiserte regelsettet, til å si hva som ikke er publisert ennå. */
  publisert: Utgave<Intervallregelsett> | null
  redigerer: boolean
  onLagre: RegelredigeringProps['onLagre']
  hentNyeste: RegelredigeringProps['hentNyeste']
}) {
  const overskrift = useId()
  const [redigeres, setRedigeres] = useState(false)
  if (!utgave) return null
  const regelsett = utgave.innhold
  const upubliserte =
    redigerer && utgave.publisert_revisjon !== utgave.revisjon
      ? publisert
        ? endredeFelt(regelsettfelter(publisert.innhold), regelsettfelter(regelsett))
        : ['Hele regelsettet']
      : []

  return (
    <section id={FORTOLKNING_ANKER} className="kort kort--start infopanel regler" aria-labelledby={overskrift}>
      <div className="infopanel__hode">
        <h2 id={overskrift} className="infopanel__tittel">
          Fortolkning
        </h2>
        {redigerer && !redigeres && (
          <Button variant="subtle" className="redigeringsknapp" onClick={() => setRedigeres(true)}>
            Rediger reglene
          </Button>
        )}
      </div>
      {redigeres && redigerer ? (
        <Regelredigering
          key={utgave.revisjon}
          start={regelsett}
          onLagre={async (innhold, forventet) => {
            await onLagre(innhold, forventet)
            setRedigeres(false)
          }}
          hentNyeste={hentNyeste}
          onAvbryt={() => setRedigeres(false)}
        />
      ) : (
        <>
          <p className="regler__ingress">
            Kommentaren fortolkningen gir for {regelsett.analyttkode}, etter målt konsentrasjon.
          </p>
          <Regeltabell regelsett={regelsett} />
          <Regelsimulator regelsett={regelsett} />
        </>
      )}
      {redigerer && (
        <div className="redigeringsrad">
          <Sistredigert utgave={utgave} type="intervallregelsett" navn="Fortolkningsreglene" />
          {upubliserte.length > 0 && (
            <p className="sistredigert">Ikke publisert: {upubliserte.join(', ')}.</p>
          )}
        </div>
      )}
    </section>
  )
}
