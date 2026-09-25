import { erUtenMargin, konsentrasjonsniva, type ThcGrunnlag, type ThcKonklusjon } from '../domain/thcMotor'
import type { ThcRegelsett } from '../domain/thcRegelsett'
import { formaterIrcak, formaterTall } from '../domain/thcTall'
import { endringsfrase, forventetNedgang, nivabeskrivelse, somProsent } from '../domain/thcVisning'

/**
 * Grunnlaget for fortolkningen, i vanlig språk — til å lese for den som vil
 * forstå hvordan kommentaren ble til. Ligger som en sammenleggbar
 * «Forklaring» under visualiseringen, etter mønster fra det frittstående
 * THC-COOH-verktøyet, og gjelder derfor bare fortolkning mot forrige prøve.
 *
 * Teksten er delt i fire bolker med hver sin overskrift — hvor stor endringen
 * er, hvorfor den målte endringen ikke er den sanne, hva som var å vente uten
 * et nytt inntak, og konklusjonen — slik at leseren finner igjen leddene i
 * resonnementet uten å lese alt. Brødteksten rykkes inn under overskriften
 * sin, så det synes hva som hører sammen.
 *
 * Grensene, nivåene og faktoren under cut-off leses av regelsettet
 * fortolkningen brukte, så forklaringen alltid stemmer med kommentaren.
 */

export function ThcForklaring({
  grunnlag,
  konklusjon,
  regler,
}: {
  grunnlag: ThcGrunnlag
  konklusjon: ThcKonklusjon
  regler: ThcRegelsett
}) {
  const { forrige, aktuell, dager, kronisk, maltEndring, korrigertEndring, forventet, underCutoff } =
    grunnlag

  // Grensene kommentaren faktisk bruker for bruksmønsteret.
  const { hosFleste, ovreGrense } = forventetNedgang(regler, kronisk, forventet)

  const dagene = dager === 1 ? '1 dag' : `${dager} dager`
  const niva = konsentrasjonsniva(regler, aktuell).navn

  // Uten sikkerhetsmargin er det den målte endringen selv som sammenlignes
  // med kurvene, og forklaringen må kalle den det den er.
  const utenMargin = erUtenMargin(grunnlag.sikkerhetsmargin)
  const endringen = utenMargin ? 'Den målte endringen' : 'Den usikkerhetskorrigerte endringen'

  const vurdering =
    konklusjon === 'nytt_inntak'
      ? `${endringen} viser mindre nedgang enn det som anses mulig selv ved ` +
        'den tregeste dokumenterte utskillelsen. Kommentaren sier derfor at cannabis har vært ' +
        'inntatt etter forrige prøve.'
      : konklusjon === 'vanskelig'
        ? `${endringen} viser mindre nedgang enn forventet, men er fortsatt ` +
          'mulig ved spesielt treg utskillelse. Kommentaren sier derfor at ' +
          (underCutoff
            ? 'inntakstidspunktet ikke kan avgjøres, siden nivået kan svinge over og under ' +
              'påvisningsgrensen uten at noe nytt er inntatt.'
            : 'det er vanskelig å avgjøre hvorvidt cannabis har vært inntatt etter forrige prøve.')
        : `${endringen} ligger innenfor det som er forventet. Kommentaren ` +
          'sier derfor at cannabis ikke nødvendigvis har vært inntatt etter forrige prøve' +
          (underCutoff ? ', selv om den ble rapportert som «ikke påvist».' : '.')

  return (
    <div className="thc-forklaring">
      <section className="thc-forklaring__bolk">
        <h3 className="thc-forklaring__tittel">Hvor stor er endringen mellom målingene?</h3>
        <div className="thc-forklaring__kropp">
          <p>
            IRCAK er målt til {formaterIrcak(aktuell)} i denne prøven og {formaterIrcak(forrige)} i
            forrige — et forholdstall på {formaterTall(maltEndring + 1)} (
            {formaterIrcak(aktuell)}/{formaterIrcak(forrige)}), altså {endringsfrase(maltEndring)}.
          </p>
          {underCutoff && (
            <p>
              THC-syre lå under påvisningsgrensen i forrige prøve, og labsystemet
              kreatininkorrigerte den derfor ikke selv. IRCAK for den prøven er regnet ut her, som
              THC-syre delt på kreatinin (UCAK/NKRE).
            </p>
          )}
        </div>
      </section>

      <section className="thc-forklaring__bolk">
        <h3 className="thc-forklaring__tittel">Målt endring ≠ sann endring</h3>
        <div className="thc-forklaring__kropp">
          {utenMargin ? (
            <p>
              Målinger har usikkerhet, så det sanne forholdstallet kan være noe høyere eller lavere
              enn det målte. Sikkerhetsmarginen står på «Ingen», og da regnes det ikke med
              usikkerheten i det hele tatt: det målte forholdstallet{' '}
              {formaterTall(maltEndring + 1)} sammenlignes rett fram med utskillelseskurvene.
            </p>
          ) : (
            <p>
              Målinger har usikkerhet, så det sanne forholdstallet kan være noe høyere eller lavere
              enn det målte. Korrigert for måleusikkerhet kan vi med{' '}
              {somProsent(grunnlag.sikkerhetsmargin)} % sikkerhet si at det sanne forholdstallet er minst{' '}
              {formaterTall(korrigertEndring + 1)} — tilsvarende {endringsfrase(korrigertEndring)}.
              Det er dette tallet, med tvilen i personens favør, som sammenlignes med
              utskillelseskurvene.
            </p>
          )}
          {underCutoff && !utenMargin && (
            <p>
              Fordi forrige prøve fortolkes under påvisningsgrensen, er måleusikkerheten lagt{' '}
              {/* Hardt mellomrom: tallet og prosenttegnet skal ikke skilles av et linjeskift. */}
              {`${Math.round((regler.maleusikkerhet.faktor_under_cutoff - 1) * 100)}\u00a0%`} høyere til grunn enn
              ellers. Det gjør fortolkningen mer forsiktig.
            </p>
          )}
        </div>
      </section>

      <section className="thc-forklaring__bolk">
        <h3 className="thc-forklaring__tittel">
          Forventet nedgang når et nytt inntak <i>ikke</i> har skjedd
        </h3>
        <div className="thc-forklaring__kropp">
          <p>
            Det er {dagene} mellom prøvene. Forventet endring etter {dagene} ved{' '}
            {kronisk ? 'kronisk bruk' : 'et enkeltinntak'}, når IRCAK i forrige prøve er{' '}
            {formaterIrcak(forrige)} og det <i>ikke</i> har skjedd et nytt inntak:
          </p>
          <ul>
            <li>
              Hos de aller fleste: <strong>minst {hosFleste} % nedgang</strong>
            </li>
            <li>
              Øvre grense for hva som anses mulig: <strong>{ovreGrense} % nedgang</strong>
            </li>
          </ul>
        </div>
      </section>

      <section className="thc-forklaring__bolk">
        <h3 className="thc-forklaring__tittel">Konklusjon</h3>
        <div className="thc-forklaring__kropp">
          <p>{vurdering}</p>
          <p>
            Kommentarens åpning følger konsentrasjonen i denne prøven: {nivabeskrivelse(regler)}.{' '}
            {formaterIrcak(aktuell)} regnes derfor som {niva} konsentrasjon.
          </p>
        </div>
      </section>
    </div>
  )
}
