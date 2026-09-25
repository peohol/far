import { useId, type Ref } from 'react'
import { Tallfelt } from './Tallfelt'
import { Tips } from './Tips'
import { Trinnbryter } from './Trinnbryter'
import type { ThcInndata } from '../domain/thcMotor'
import type { ThcRegelsett } from '../domain/thcRegelsett'
import { beregnIrcak, formaterIrcak } from '../domain/thcTall'
import { marginvalg } from '../domain/thcVisning'

/**
 * Hva sikkerhetsmarginen er: først hvorfor en målt endring ikke er den sanne,
 * så hva marginen gjør med den. Ordlyden er eierens egen; bare de rette
 * anførselstegnene er satt inn, som ellers i appen.
 */
const MARGINTIPS = (
  <>
    <section className="tipsboble__bolk">
      <h3 className="tipsboble__tittel">Målinger ≠ sann verdi</h3>
      <p>Det er uunngåelig at det oppstår tilfeldige avvik mellom målinger og den sanne verdien.</p>
      <p>
        Fordi enkeltmålingene er usikre, vil også endringen mellom to prøver være usikre. Den målte endringen
        er altså forventet å avvike fra den sanne endringen.
      </p>
      <p>
        Det er 50/50 om endringen måles høyere eller lavere enn den sanne endringen. I halvparten av
        tilfellene vil grunnlaget vårt for fortolkning være for strengt – i den andre halvparten vil det være
        for snilt.
      </p>
    </section>
    <section className="tipsboble__bolk">
      <h3 className="tipsboble__tittel">Sikkerhetsmargin</h3>
      <p>
        Hvis vi tolker prøvene direkte med de målingene vi har, er vi 50 % sikre på at endringen vi bruker i
        fortolkningen, ikke er «for streng». «Ingen sikkerhetsmargin» betyr egentlig bare at vi ikke har gjort
        noe for å kompensere for måleusikkerhet.
      </p>
      <p>
        Men vi kan kompensere om vi ønsker. Ved hjelp av en statistisk modell av usikkerheten til endringen,
        kan vi justere endringstallet til et lavere tall. Dette øker ikke sannsynligheten for at fortolkningen
        vår er «riktig», men øker hvor sikre vi er på at vi ikke bruker et for strengt endringstall.
      </p>
      <p>
        Med 90 % sikkerhet (standard) justerer vi endringen som fortolkes så vi er 90 % sikre på at endringen
        vi fortolker, ikke er for stor. I 1 av 10 tilfeller vil vi altså bruke en for stor endring i
        fortolkningen – mot annethvert tilfelle hvis vi ikke hadde noen sikkerhetsmargin.
      </p>
      <p>
        Sikkerheten kan økes til 99 % i saker der man ønsker å være ekstra forsiktig, f.eks. i saker der et
        nytt inntak av cannabis kan få store konsekvenser for prøvegiver.
      </p>
    </section>
  </>
)

/**
 * Banneret over sikkerhetsmarginen når forrige prøve fortolkes under
 * påvisningsgrensen. Ordlyden er eierens egen.
 */
const UNDER_CUTOFF_BANNER =
  'Fordi vi nå fortolker konsentrasjoner under påvisningsgrensen, legges større måleusikkerhet til grunn. ' +
  'Dette gjør fortolkningen mer forsiktig.'

export interface ThcSkjemaProps {
  inndata: ThcInndata
  onEndre: <K extends keyof ThcInndata>(felt: K, verdi: ThcInndata[K]) => void
  /** Reglene skjemaet fylles ut mot: sikkerhetsmarginene står der. */
  regler: ThcRegelsett
  /** Feltet som står først, og som får fokus når skjemaet åpnes eller nullstilles. */
  forsteFelt?: Ref<HTMLInputElement>
}

/**
 * Feltene i THC-syrefortolkningen: bruksmønsteret, forrige og denne prøven og
 * sikkerhetsmarginen. Brukes både i fortolkningsmodulen og i simulatoren på
 * analyttsiden, så de spør på samme måte.
 */
export function ThcSkjema({ inndata, onEndre, regler, forsteFelt }: ThcSkjemaProps) {
  const tipsId = useId()

  // Avkryssingen står inne i «Forrige prøve», så den gjelder bare når det
  // finnes en forrige prøve å fortolke.
  const underCutoff = !inndata.ingenTidligere && inndata.forrigeUnderCutoff
  const beregnetIrcak = underCutoff ? beregnIrcak(inndata.forrigeUcak, inndata.forrigeNkre) : null

  // Valgene på bryteren er regelsettets marginer, fra ingen margin til den
  // strengeste. Står skjemaet på en margin regelsettet ikke har, står bryteren
  // på ingen av dem, og fortolkningen sier fra.
  const marginer = regler.sikkerhetsmarginer.map(({ margin }) => ({
    verdi: margin,
    merke: marginvalg(margin),
  }))

  return (
    <div className="thc-skjema">
      <div className="avkryssinger">
        <label className="avkryssing">
          <input
            type="checkbox"
            checked={inndata.kronisk}
            onChange={(e) => onEndre('kronisk', e.target.checked)}
          />
          Legg kronisk bruk til grunn
        </label>
        <label className="avkryssing">
          <input
            type="checkbox"
            checked={inndata.ingenTidligere}
            onChange={(e) => onEndre('ingenTidligere', e.target.checked)}
          />
          Ingen tidligere prøve tilgjengelig
        </label>
      </div>

      <div className="thc-prover">
        {!inndata.ingenTidligere && (
          <fieldset className="feltgruppe">
            <legend>Forrige prøve</legend>
            {/* Var urinen så fortynnet at THC-syre havnet under
                påvisningsgrensen, svarer labsystemet «ikke påvist» og
                regner ingen IRCAK. De to interne tallene tastes da i
                stedet, og IRCAK regnes ut av dem. */}
            <label className="avkryssing avkryssing--felt">
              <input
                type="checkbox"
                checked={inndata.forrigeUnderCutoff}
                onChange={(e) => onEndre('forrigeUnderCutoff', e.target.checked)}
              />
              Under cut-off
            </label>
            {inndata.forrigeUnderCutoff ? (
              <>
                <div className="feltrad feltrad--par">
                  <label className="skjemafelt">
                    <span>UCAK (THC-syre)</span>
                    <Tallfelt
                      ref={forsteFelt}
                      value={inndata.forrigeUcak}
                      onChange={(verdi) => onEndre('forrigeUcak', verdi)}
                    />
                  </label>
                  <label className="skjemafelt">
                    <span>NKRE (kreatinin)</span>
                    <Tallfelt
                      value={inndata.forrigeNkre}
                      onChange={(verdi) => onEndre('forrigeNkre', verdi)}
                    />
                  </label>
                </div>
                <p className="thc-beregnet" role="status">
                  Beregnet IRCAK:{' '}
                  <strong>{beregnetIrcak === null ? '–' : formaterIrcak(beregnetIrcak)}</strong>
                </p>
              </>
            ) : (
              <label className="skjemafelt">
                <span>IRCAK</span>
                <Tallfelt
                  ref={forsteFelt}
                  value={inndata.forrigeVerdi}
                  onChange={(verdi) => onEndre('forrigeVerdi', verdi)}
                />
              </label>
            )}
            <label className="skjemafelt">
              <span>Prøvedato</span>
              <input
                className="inndatafelt"
                type="date"
                value={inndata.forrigeDato}
                onChange={(e) => onEndre('forrigeDato', e.target.value)}
              />
            </label>
          </fieldset>
        )}

        <fieldset className="feltgruppe">
          <legend>Denne prøven</legend>
          <label className="skjemafelt">
            <span>IRCAK</span>
            <Tallfelt
              ref={inndata.ingenTidligere ? forsteFelt : undefined}
              value={inndata.aktuellVerdi}
              onChange={(verdi) => onEndre('aktuellVerdi', verdi)}
            />
          </label>
          {/* Uten en tidligere prøve å telle døgn mot brukes ikke datoen,
              og da skal den heller ikke fylles ut. */}
          {!inndata.ingenTidligere && (
            <label className="skjemafelt">
              <span>Prøvedato</span>
              <input
                className="inndatafelt"
                type="date"
                value={inndata.aktuellDato}
                onChange={(e) => onEndre('aktuellDato', e.target.value)}
              />
            </label>
          )}
        </fieldset>
      </div>

      {/* Sikkerhetsmarginen gjelder bare sammenligningen mot forrige
          prøve, så uten en slik prøve er den ikke noe å ta stilling
          til — samme grunn som datoene skjules av. */}
      {!inndata.ingenTidligere && (
        <div className="thc-margin">
          {underCutoff && (
            <p className="notis" role="note">
              {UNDER_CUTOFF_BANNER}
            </p>
          )}
          <div className="thc-margin__hode">
            <Tips forklaring={MARGINTIPS} id={tipsId}>
              Sikkerhetsmargin
            </Tips>
          </div>
          <Trinnbryter
            etikett="Sikkerhetsmargin"
            valg={marginer}
            verdi={inndata.sikkerhetsmargin}
            onVelg={(margin) => onEndre('sikkerhetsmargin', margin)}
            beskrevetAv={tipsId}
          />
        </div>
      )}
    </div>
  )
}
