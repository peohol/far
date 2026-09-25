import { useMemo, useState } from 'react'
import { THC_TEKSTBOLKER, THC_TEKSTNOKLER } from '../../domain/thcTekster'
import { fortolkThc, tomThcInndata, type ThcModell } from '../../domain/thcMotor'
import { bruksmonsterbeskrivelse, marginmerke, nivaomrader, somProsent } from '../../domain/thcVisning'
import { antall, ramsOpp } from '../../faginnhold/oppsummering'
import { tilThcModell, type ThcRegelsettutgave } from '../../faginnhold/thcregler'
import { Button } from '../Button'
import { Panelhode } from '../Panelhode'
import { ThcKommentar, ThcKurvebilde } from '../ThcUtfall'
import { ThcSkjema } from '../ThcSkjema'
import { Uthev } from '../Uthev'
import { seksjonsikon } from '../analyttside/panelvisning'
import { Sistredigert } from '../historikk/Sistredigert'
import { Detaljkort, Seksjon } from '../seksjoner/Seksjon'
import { FORTOLKNING } from './Fortolkningsregler'

/**
 * Fortolkningsreglene for THC-syre i urin på analyttsiden for IRCAK
 * (`docs/thc-syre.md`): nivåene, marginene, måleusikkerheten og kurvene
 * konklusjonen avgjøres av, tekstbolkene kommentaren settes sammen av, og en
 * simulator som fortolker med akkurat disse reglene.
 *
 * I lesemodus er det de publiserte reglene, i redigeringsmodus utkastet. Et
 * regelsett som ikke består kontrollen, vises med feilene i stedet.
 *
 * Reglene er seksjonen `fortolkning` på siden, og tekstene og simulatoren
 * detaljkort i den (`docs/seksjoner.md`).
 */
export function Thcregler({ utgave, redigerer }: { utgave: ThcRegelsettutgave; redigerer: boolean }) {
  const modell = useMemo(() => tilThcModell(utgave), [utgave])

  return (
    <Seksjon
      id={FORTOLKNING}
      ikon={seksjonsikon(FORTOLKNING)}
      tittel={<Uthev tekst="Fortolkningsregler" />}
      oppsummering={
        modell.ok
          ? ramsOpp([
              antall(modell.modell.regler.konsentrasjonsnivaer.length, 'nivå', 'nivåer'),
              `Standardmargin ${marginmerke(modell.modell.regler.standard_sikkerhetsmargin)}`,
            ])
          : 'Reglene er ikke gyldige'
      }
      className="regler"
    >
      {modell.ok ? (
        <Reglene modell={modell.modell} />
      ) : (
        <>
          <Panelhode ikon="fallback" tone="toksisk">
            Reglene er ikke gyldige
          </Panelhode>
          <ul className="mangelliste">
            {modell.feil.map((feil) => (
              <li key={feil}>{feil}</li>
            ))}
          </ul>
        </>
      )}
      {redigerer && (
        <div className="redigeringsrad regler__historikk">
          <Sistredigert utgave={utgave.regelsett} type="thc_regelsett" navn="THC-syrereglene" />
        </div>
      )}
    </Seksjon>
  )
}

function Reglene({ modell }: { modell: ThcModell }) {
  const { regler, tekster } = modell
  const { maleusikkerhet } = regler

  return (
    <>
      <p className="regler__ingress">
        <Uthev
          tekst={
            'Slik kommenterer fortolkningen THC-syre i urin. Konsentrasjonen i prøven gir nivået i åpningen. ' +
            'Endringen fra forrige prøve korrigeres for måleusikkerhet og sammenlignes med tre ' +
            'utskillelseskurver; hvilke kurver den ligger over, avgjør konklusjonen.'
          }
        />
      </p>

      <dl className="regler__grenser">
        {nivaomrader(regler).map(({ navn, omrade }) => (
          <Grense key={navn} navn={`Nivå «${navn}»`} verdi={omrade} />
        ))}
      </dl>
      <dl className="regler__grenser">
        <Grense
          navn="Sikkerhetsmarginer"
          verdi={regler.sikkerhetsmarginer.map((m) => marginmerke(m.margin)).join(' · ')}
        />
        <Grense navn="Standard" verdi={marginmerke(regler.standard_sikkerhetsmargin)} />
        <Grense navn="Måleusikkerhet THC-syre" verdi={`${somProsent(maleusikkerhet.cv_thc)} %`} />
        <Grense navn="Kreatinin" verdi={`${somProsent(maleusikkerhet.cv_kreatinin)} %`} />
        <Grense
          navn="Under cut-off"
          verdi={`${somProsent(maleusikkerhet.faktor_under_cutoff - 1)} % høyere`}
        />
        <Grense navn="Varsel ved mer enn" verdi={antall(regler.varsel_dager_mellom, 'dag', 'dager')} />
      </dl>
      <dl className="regler__monstre">
        <div>
          <dt>Kronisk bruk</dt>
          <dd>{bruksmonsterbeskrivelse(regler, true)}</dd>
        </div>
        <div>
          <dt>Enkeltinntak</dt>
          <dd>{bruksmonsterbeskrivelse(regler, false)}</dd>
        </div>
      </dl>

      <Detaljkort id="tekster" tittel="Tekstbolkene" oppsummering={antall(THC_TEKSTNOKLER.length, 'bolk', 'bolker')}>
        <ol className="regeltekster">
          {THC_TEKSTNOKLER.map((nokkel) => (
            <li key={nokkel} className="regeltekst">
              <p className="regeltekst__nummer">{THC_TEKSTBOLKER[nokkel].tittel}</p>
              <p className="regler__ingress">
                <Uthev tekst={THC_TEKSTBOLKER[nokkel].brukes} />
              </p>
              <p className="kommentartekst">
                <Uthev tekst={tekster[nokkel]} />
              </p>
            </li>
          ))}
        </ol>
      </Detaljkort>

      <Simulator modell={modell} />
    </>
  )
}

function Grense({ navn, verdi }: { navn: string; verdi: string }) {
  return (
    <div className="regler__grense">
      <dt>
        <Uthev tekst={navn} />
      </dt>
      <dd>{verdi}</dd>
    </div>
  )
}

/**
 * Fortolkningsmodulen i det små: det samme skjemaet og den samme kommentaren,
 * med reglene som vises over, og hvilke tekstbolker kommentaren ble satt
 * sammen av. Det er ingenting å kopiere.
 */
function Simulator({ modell }: { modell: ThcModell }) {
  const { regler } = modell
  const [inndata, setInndata] = useState(() => tomThcInndata(regler))
  const resultat = useMemo(() => fortolkThc(inndata, modell), [inndata, modell])

  return (
    <Detaljkort
      id="simulator"
      tittel="Prøv reglene"
      oppsummering="Fyll inn en prøve"
      handlinger={
        <Button variant="subtle" className="redigeringsknapp" onClick={() => setInndata(tomThcInndata(regler))}>
          Nullstill
        </Button>
      }
      className="simulator"
    >
      <p className="regler__ingress">Fyll inn slik som i fortolkningen. Kommentaren regnes ut med reglene over.</p>
      <ThcSkjema
        inndata={inndata}
        regler={regler}
        onEndre={(felt, verdi) => setInndata((forrige) => ({ ...forrige, [felt]: verdi }))}
      />
      <div className="simulator__resultat">
        {resultat.type === 'kommentar' && (
          <p className="simulator__scenario" role="status">
            Tekstbolker: {resultat.bolker.map((nokkel) => THC_TEKSTBOLKER[nokkel].tittel).join(', ')}.
          </p>
        )}
        <ThcKommentar
          resultat={resultat}
          regler={regler}
          onIngenTidligere={() => setInndata((forrige) => ({ ...forrige, ingenTidligere: true }))}
        />
        <ThcKurvebilde resultat={resultat} regler={regler} />
      </div>
    </Detaljkort>
  )
}
