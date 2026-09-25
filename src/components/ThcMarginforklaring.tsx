import { erUtenMargin } from '../domain/thcMotor'
import type { ThcRegelsett } from '../domain/thcRegelsett'
import { formaterProsent } from '../domain/thcPlot'
import { THC_TEKSTBOLKER } from '../domain/thcTekster'
import { formaterIrcak } from '../domain/thcTall'
import {
  MARGINEKSEMPEL,
  endringsfrase,
  hvorOfteForStor,
  margineksempel,
  marginvalg,
  somProsent,
} from '../domain/thcVisning'

/**
 * Hva sikkerhetsmarginen er, i den sammenleggbare «Hva er
 * sikkerhetsmarginen?» under bryteren: hvorfor en målt endring ikke er den
 * sanne, hva hver margin gjør med den, og et eksempel.
 *
 * Ordlyden er eierens egen, delt opp i bolker. Marginene, hvor ofte endringen
 * blir for stor med hver av dem, og eksempelets endringer og konklusjoner
 * leses av regelsettet, så forklaringen stemmer med fortolkningen også når
 * reglene endres. Oppsettet er det samme som i forklaringen under kurvene.
 */
export function ThcMarginforklaring({ regler }: { regler: ThcRegelsett }) {
  const marginer = regler.sikkerhetsmarginer.map(({ margin }) => margin)
  const strengeste = marginer.at(-1)
  const { forrige, aktuell, dager, kronisk } = MARGINEKSEMPEL

  return (
    <div className="thc-forklaring">
      <section className="thc-forklaring__bolk">
        <h3 className="thc-forklaring__tittel">Målinger ≠ sann verdi</h3>
        <div className="thc-forklaring__kropp">
          <ul>
            <li>Det er uunngåelig at det oppstår tilfeldige avvik mellom målinger og den sanne verdien.</li>
            <li>
              Fordi enkeltmålingene er usikre, er også endringen mellom to prøver usikker. Den målte endringen
              er altså forventet å avvike fra den sanne endringen.
            </li>
            <li>
              Det er 50/50 om endringen måles høyere eller lavere enn den sanne endringen. I halvparten av
              tilfellene vil grunnlaget vårt for fortolkning være for strengt – i den andre halvparten vil det
              være for snilt.
            </li>
          </ul>
        </div>
      </section>

      <section className="thc-forklaring__bolk">
        <h3 className="thc-forklaring__tittel">Hva marginen gjør</h3>
        <div className="thc-forklaring__kropp">
          <p>
            Ved hjelp av en statistisk modell av usikkerheten til endringen kan vi justere endringstallet til
            et lavere tall. Dette øker ikke sannsynligheten for at fortolkningen vår er «riktig», men øker
            hvor sikre vi er på at vi ikke bruker et for strengt endringstall.
          </p>
          <dl className="thc-marginvalg">
            {marginer.map((margin) => (
              <div key={margin}>
                <dt>
                  {marginvalg(margin)}
                  {margin === regler.standard_sikkerhetsmargin && ' (standard)'}
                </dt>
                <dd>
                  {erUtenMargin(margin)
                    ? `Prøvene tolkes direkte med de målingene vi har. Vi er ${somProsent(margin)} % sikre ` +
                      'på at endringen vi fortolker, ikke er «for streng» – det er ikke gjort noe for å ' +
                      'kompensere for måleusikkerhet.'
                    : `Endringen justeres så vi er ${somProsent(margin)} % sikre på at den ikke er for stor.`}{' '}
                  Endringen som fortolkes, er for stor {hvorOfteForStor(margin)}.
                  {margin === strengeste &&
                    !erUtenMargin(margin) &&
                    margin !== regler.standard_sikkerhetsmargin &&
                    ' For saker der man ønsker å være ekstra forsiktig, f.eks. der et nytt inntak av ' +
                      'cannabis kan få store konsekvenser for prøvegiver.'}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="thc-forklaring__bolk">
        <h3 className="thc-forklaring__tittel">Eksempel</h3>
        <div className="thc-forklaring__kropp">
          <p>
            {kronisk ? 'Kronisk bruk' : 'Et enkeltinntak'}. Forrige prøve har IRCAK {formaterIrcak(forrige)},
            og {dager} dager senere har denne prøven IRCAK {formaterIrcak(aktuell)} –{' '}
            {endringsfrase(aktuell / forrige - 1)}. Slik fortolkes det med hver margin:
          </p>
          <table className="thc-margineksempel">
            <thead>
              <tr>
                <th scope="col">Margin</th>
                <th scope="col">Fortolket endring</th>
                <th scope="col">Konklusjon</th>
              </tr>
            </thead>
            <tbody>
              {margineksempel(regler).map(({ margin, endring, utfall }) => (
                <tr key={margin}>
                  <th scope="row">{marginvalg(margin)}</th>
                  <td>{formaterProsent(endring * 100)}</td>
                  <td>{THC_TEKSTBOLKER[utfall].tittel}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            Jo større nedgang som legges til grunn, desto mer skal til før kommentaren sier at cannabis har
            vært inntatt etter forrige prøve. Tvilen kommer prøvegiver til gode.
          </p>
        </div>
      </section>
    </div>
  )
}
