import { useCallback, useId, useMemo, useState } from 'react'
import { endredeFelt } from '../../faginnhold/historikk'
import type { Regelsettutgave } from '../../faginnhold/lesing'
import { losRegelsett } from '../../regler/kommentarer'
import type { Intervallregelsett, Intervallregelsettinnhold } from '../../regler/modell'
import { regelsettfelter, tekstene } from '../../regler/visning'
import { Button } from '../Button'
import { Sistredigert } from '../historikk/Sistredigert'
import { Regelredigering, type RegelredigeringProps } from './Regelredigering'
import { Regelsimulator, Regeltabell } from './Regeltabell'

/** Ankeret seksjonen har på siden. */
export const FORTOLKNING_ANKER = 'panel-fortolkning'

/** Feltene oppsummeringene sammenligner, med tekstene regelsettet har slått opp. */
export function regelsettfelterMedTekst(regelsett: Intervallregelsett) {
  return regelsettfelter(regelsett, tekstene(regelsett))
}

/**
 * Fortolkningsreglene for koden, på informasjonssiden: kommentaren hver
 * konsentrasjon gir, og en simulator for å prøve en verdi.
 *
 * Regelsettet er et eget objekt og ikke en del av informasjonssiden; det
 * vises her fordi det gjelder koden siden hører til. Kommentarene det peker
 * på, er egne objekter igjen. I redigeringsmodus kan administratorer endre
 * reglene og tekstene, se hva som ikke er publisert og åpne historikken — for
 * regelsettet og for hver kommentar.
 */
export function Fortolkningsregler({
  utgave,
  publisert,
  redigerer,
  onLagre,
  hentNyeste,
}: {
  utgave: Regelsettutgave | null
  /** Det publiserte regelsettet, til å si hva som ikke er publisert ennå. */
  publisert: Regelsettutgave | null
  redigerer: boolean
  onLagre: RegelredigeringProps['onLagre']
  hentNyeste: RegelredigeringProps['hentNyeste']
}) {
  const overskrift = useId()
  const [redigeres, setRedigeres] = useState(false)
  const regelsett = useMemo(() => utgave && losRegelsett(utgave), [utgave])
  const publiserte = useMemo(() => publisert && losRegelsett(publisert), [publisert])
  /** Navnene på kommentarene, som regelsettets egen historikk viser i stedet for tekstene. */
  const navn = useMemo(() => new Map(utgave?.kommentarer.map((k) => [k.id, k.innhold.navn])), [utgave])
  const historikkfelter = useCallback(
    (innhold: Intervallregelsettinnhold) =>
      regelsettfelter(innhold, (id) => navn.get(id) ?? 'En kommentar regelsettet ikke bruker nå'),
    [navn],
  )
  if (!utgave || !regelsett) return null
  const upubliserte =
    redigerer && [utgave.regelsett, ...utgave.kommentarer].some((u) => u.publisert_revisjon !== u.revisjon)
      ? publiserte
        ? endredeFelt(regelsettfelterMedTekst(publiserte), regelsettfelterMedTekst(regelsett))
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
          key={[utgave.regelsett.revisjon, ...utgave.kommentarer.map((k) => k.revisjon)].join('-')}
          start={regelsett}
          onLagre={async (innhold, grunnlag) => {
            await onLagre(innhold, grunnlag)
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
        <div className="redigeringsrad regler__historikk">
          <Sistredigert
            utgave={utgave.regelsett}
            type="intervallregelsett"
            navn="Fortolkningsreglene"
            felter={historikkfelter}
          />
          {upubliserte.length > 0 && (
            <p className="sistredigert">Ikke publisert: {upubliserte.join(', ')}.</p>
          )}
          <details className="regler__kommentarhistorikk">
            <summary className="sistredigert">Historikken for hver kommentar</summary>
            <ul>
              {utgave.kommentarer.map((k) => (
                <li key={k.id}>
                  <span className="sistredigert">{k.innhold.navn}: </span>
                  <Sistredigert utgave={k} type="kommentar" navn={`Kommentaren «${k.innhold.navn}»`} />
                </li>
              ))}
            </ul>
          </details>
        </div>
      )}
    </section>
  )
}
